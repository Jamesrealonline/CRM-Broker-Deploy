-- ========================================================
-- MIGRATION 020: CONTRACTS, MULTI-TIER COMMISSIONS, CONTRACT REVISIONS & DEBT AGING
-- ========================================================

-- 1. BẢNG LỊCH THANH TOÁN TIẾN ĐỘ & CÔNG NỢ HỢP ĐỒNG (contract_installments)
CREATE TABLE IF NOT EXISTS public.contract_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
    installment_number INT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(15, 2) DEFAULT 0 CHECK (paid_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue')),
    paid_date TIMESTAMPTZ,
    receipt_code TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_contract_installment UNIQUE (contract_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_installments_contract ON public.contract_installments(contract_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.contract_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.contract_installments(status);

-- 2. BẢNG SỔ CÁI HOA HỒNG & CLAWBACK (commission_entries)
CREATE TABLE IF NOT EXISTS public.commission_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    recipient_role TEXT NOT NULL,
    rate_percent NUMERIC(5, 2) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_eligibility' CHECK (status IN ('pending_eligibility', 'eligible', 'collected_from_developer', 'paid', 'clawback')),
    condition_threshold_percent NUMERIC(5, 2) DEFAULT 100 CHECK (condition_threshold_percent >= 0 AND condition_threshold_percent <= 100),
    clawback_source_id UUID REFERENCES public.commission_entries(id),
    policy_version TEXT DEFAULT '2026.v1',
    pit_tax_percent NUMERIC(5, 2) DEFAULT 10,
    pit_tax_amount NUMERIC(15, 2) DEFAULT 0,
    net_payable_amount NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_contract ON public.commission_entries(contract_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipient ON public.commission_entries(recipient_id);
CREATE INDEX IF NOT EXISTS idx_comm_status ON public.commission_entries(status);

-- 3. BẢNG VÒNG ĐỜI HỢP ĐỒNG & ĐỔI CĂN / HỦY CỌC (contract_revisions)
CREATE TABLE IF NOT EXISTS public.contract_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
    revision_type TEXT NOT NULL CHECK (revision_type IN ('unit_change', 'transfer', 'cancellation', 'penalty')),
    old_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revisions_contract ON public.contract_revisions(contract_id);
CREATE INDEX IF NOT EXISTS idx_revisions_status ON public.contract_revisions(status);

-- 4. BẢNG ĐỐI SOÁT SAO KÊ NGÂN HÀNG (bank_statements)
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_ref_code TEXT NOT NULL UNIQUE,
    trans_date TIMESTAMPTZ NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    matched_contract_id UUID REFERENCES public.contracts(id),
    matched_installment_id UUID REFERENCES public.contract_installments(id),
    status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'disputed')),
    reconciled_by UUID REFERENCES public.profiles(id),
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_status ON public.bank_statements(status);
CREATE INDEX IF NOT EXISTS idx_bank_ref_code ON public.bank_statements(bank_ref_code);

-- 5. BẬT RLS CHO CÁC BẢNG
ALTER TABLE public.contract_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES CƠ BẢN
CREATE POLICY p_installments_select ON public.contract_installments
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_comm_entries_select ON public.commission_entries
    FOR SELECT USING (
        auth.uid() = recipient_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'accountant', 'sales_manager'))
    );

CREATE POLICY p_revisions_select ON public.contract_revisions
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_bank_statements_select ON public.bank_statements
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'accountant'))
    );

-- 7. RPC MAKER-CHECKER DUYỆT REVISION HỢP ĐỒNG (approve_contract_revision)
CREATE OR REPLACE FUNCTION public.approve_contract_revision(
    p_revision_id UUID,
    p_approver_id UUID,
    p_action TEXT, -- 'approved' | 'rejected'
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rev RECORD;
    v_approver_role TEXT;
BEGIN
    SELECT * INTO v_rev FROM public.contract_revisions WHERE id = p_revision_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy yêu cầu điều chỉnh hợp đồng');
    END IF;

    IF v_rev.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Yêu cầu này đã được xử lý trước đó');
    END IF;

    -- Maker-Checker: Người tạo không được phép tự duyệt
    IF v_rev.requested_by = p_approver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'maker_checker_violation: Người tạo yêu cầu không được phép tự duyệt');
    END IF;

    -- Kiểm tra vai trò người duyệt (Chỉ Admin, Director, Sales Manager)
    SELECT role INTO v_approver_role FROM public.profiles WHERE id = p_approver_id;
    IF v_approver_role NOT IN ('admin', 'director', 'sales_manager') THEN
        RETURN jsonb_build_object('success', false, 'error', 'forbidden: Chỉ Quản lý sàn, Giám đốc hoặc Admin mới có quyền duyệt');
    END IF;

    IF p_action = 'rejected' THEN
        UPDATE public.contract_revisions
        SET status = 'rejected', approved_by = p_approver_id, approved_at = now(), notes = p_notes, updated_at = now()
        WHERE id = p_revision_id;
        RETURN jsonb_build_object('success', true, 'action', 'rejected');
    END IF;

    -- Nếu approved: Cập nhật hợp đồng tương ứng
    IF p_action = 'approved' THEN
        UPDATE public.contract_revisions
        SET status = 'approved', approved_by = p_approver_id, approved_at = now(), notes = p_notes, updated_at = now()
        WHERE id = p_revision_id;

        -- Trường hợp hủy hợp đồng (cancellation): kích hoạt clawback hoa hồng
        IF v_rev.revision_type = 'cancellation' THEN
            UPDATE public.contracts SET status = 'cancelled', updated_at = now() WHERE id = v_rev.contract_id;

            -- Tạo bút toán clawback âm
            INSERT INTO public.commission_entries (
                contract_id, recipient_id, recipient_role, rate_percent, amount, status, clawback_source_id, notes
            )
            SELECT 
                contract_id, recipient_id, recipient_role, rate_percent, -amount, 'clawback', id,
                'Thu hồi hoa hồng do hủy hợp đồng'
            FROM public.commission_entries
            WHERE contract_id = v_rev.contract_id AND status <> 'clawback';
        END IF;

        -- Trường hợp đổi căn (unit_change): Cập nhật mã căn mới
        IF v_rev.revision_type = 'unit_change' AND (v_rev.new_data->>'unit_code') IS NOT NULL THEN
            UPDATE public.contracts 
            SET unit_code = v_rev.new_data->>'unit_code', updated_at = now() 
            WHERE id = v_rev.contract_id;
        END IF;

        RETURN jsonb_build_object('success', true, 'action', 'approved');
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Thao tác không hợp lệ');
END;
$$;
