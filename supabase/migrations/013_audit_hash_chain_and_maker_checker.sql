-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 013: APPEND-ONLY AUDIT HASH CHAIN & FINANCIAL MAKER-CHECKER
-- Giai đoạn P1.2: Bảo vệ tính toàn vẹn kiểm toán & Kiểm soát giao dịch tài chính
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. BẢO VỆ TOÀN VẸN AUDIT LOGS (APPEND-ONLY + HASH CHAIN)
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64);

-- Trigger chặn đứng mọi thao tác UPDATE hoặc DELETE trên audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Bảo mật kiểm toán nghiêm ngặt: Bảng audit_logs là append-only, nghiêm cấm mọi hành vi UPDATE hoặc DELETE.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_modification
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- 2. TÍNH TOÁN HASH CHAIN TỰ ĐỘNG KHI INSERT AUDIT LOG
CREATE OR REPLACE FUNCTION generate_audit_log_hash()
RETURNS TRIGGER AS $$
DECLARE
    v_last_hash VARCHAR(64);
    v_payload TEXT;
BEGIN
    -- Lấy hash của bản ghi gần nhất
    SELECT current_hash INTO v_last_hash 
    FROM audit_logs 
    WHERE current_hash IS NOT NULL 
    ORDER BY created_at DESC, id DESC 
    LIMIT 1;

    NEW.prev_hash := COALESCE(v_last_hash, '0000000000000000000000000000000000000000000000000000000000000000');

    -- Nội dung chuỗi băm: prev_hash + user_id + action + table_name + record_id + created_at
    v_payload := NEW.prev_hash || '|' || 
                 COALESCE(NEW.user_id::text, '') || '|' || 
                 COALESCE(NEW.actor_id::text, '') || '|' || 
                 COALESCE(NEW.action, '') || '|' || 
                 COALESCE(NEW.table_name, '') || '|' || 
                 COALESCE(NEW.record_id::text, '') || '|' || 
                 NEW.created_at::text;

    NEW.current_hash := encode(digest(v_payload, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_audit_log_hash ON audit_logs;
CREATE TRIGGER trg_generate_audit_log_hash
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION generate_audit_log_hash();

-- 3. BỔ SUNG MAKER-CHECKER & REVERSAL TRÊN TRANSACTIONS
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'confirmed', -- draft, pending_approval, approved, confirmed, rejected
ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reversal_of_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

-- Trigger chặn sửa/xóa giao dịch tài chính đã confirmed hoặc approved
CREATE OR REPLACE FUNCTION prevent_confirmed_tx_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'confirmed' OR OLD.approval_status = 'approved' THEN
            RAISE EXCEPTION 'Giao dịch tài chính đã xác nhận/phê duyệt bị khóa xóa. Vui lòng lập giao dịch bù trừ (offsetting/reversal).';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (OLD.status = 'confirmed' OR OLD.approval_status = 'approved') THEN
            -- Không cho phép sửa đổi số tiền hoặc giá trị hợp đồng
            IF OLD.amount != NEW.amount OR OLD.deal_value != NEW.deal_value OR OLD.commission_amount != NEW.commission_amount THEN
                RAISE EXCEPTION 'Hợp đồng/giao dịch đã phê duyệt bị khóa sửa đổi giá trị tài chính. Vui lòng tạo giao dịch bù trừ (offsetting/reversal).';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_confirmed_tx_modification ON transactions;
CREATE TRIGGER trg_prevent_confirmed_tx_modification
    BEFORE UPDATE OR DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_confirmed_tx_modification();

-- 4. RPC PHÊ DUYỆT GIAO DỊCH / HỢP ĐỒNG (CƯỠNG CHẾ MAKER-CHECKER)
CREATE OR REPLACE FUNCTION approve_contract_transaction(
    p_tx_id UUID,
    p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tx RECORD;
    v_approver_role VARCHAR;
BEGIN
    SELECT * INTO v_tx FROM transactions WHERE id = p_tx_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy giao dịch hợp đồng với ID %', p_tx_id;
    END IF;

    SELECT role INTO v_approver_role FROM profiles WHERE id = p_approver_id;
    IF v_approver_role NOT IN ('admin', 'director', 'sales_manager') THEN
        RAISE EXCEPTION 'Từ chối thao tác: Vai trò "%" không có quyền phê duyệt hợp đồng/hoa hồng.', v_approver_role;
    END IF;

    -- NGUYÊN TẮC MAKER-CHECKER: Người tạo không được phép tự duyệt
    IF v_tx.created_by IS NOT NULL AND v_tx.created_by = p_approver_id THEN
        RAISE EXCEPTION 'Maker-Checker vi phạm: Người lập hợp đồng/hoa hồng không được phép tự duyệt cho chính mình.';
    END IF;

    IF v_tx.approval_status = 'approved' THEN
        RAISE EXCEPTION 'Hợp đồng này đã được phê duyệt trước đó vào lúc %', v_tx.approved_at;
    END IF;

    UPDATE transactions
    SET approval_status = 'approved',
        status = 'confirmed',
        approved_by = p_approver_id,
        approved_at = NOW()
    WHERE id = p_tx_id;

    -- Ghi audit log
    INSERT INTO audit_logs (
        user_id,
        actor_id,
        action,
        table_name,
        record_id,
        new_data,
        ip_address
    ) VALUES (
        p_approver_id,
        p_approver_id,
        'contract_approved',
        'transactions',
        p_tx_id,
        jsonb_build_object(
            'approved_by', p_approver_id,
            'approver_role', v_approver_role,
            'created_by', v_tx.created_by,
            'amount', v_tx.amount
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_tx_id,
        'approval_status', 'approved',
        'approved_by', p_approver_id
    );
END;
$$;

-- 5. RPC TẠO GIAO DỊCH BÙ TRỪ (REVERSAL / OFFSETTING TRANSACTION)
CREATE OR REPLACE FUNCTION create_reversal_transaction(
    p_original_tx_id UUID,
    p_reason TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig RECORD;
    v_new_tx_id UUID := uuid_generate_v4();
    v_new_code TEXT;
BEGIN
    SELECT * INTO v_orig FROM transactions WHERE id = p_original_tx_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy giao dịch gốc để lập bù trừ.';
    END IF;

    IF v_orig.is_reversal THEN
        RAISE EXCEPTION 'Không thể tạo giao dịch bù trừ trên một giao dịch đã là bù trừ.';
    END IF;

    v_new_code := 'REV-' || v_orig.code;

    INSERT INTO transactions (
        id,
        lead_id,
        project_id,
        type,
        code,
        amount,
        deal_value,
        commission_amount,
        sale_commission_amount,
        unit_code,
        status,
        approval_status,
        is_reversal,
        reversal_of_id,
        reversal_reason,
        created_by,
        transaction_date,
        notes
    ) VALUES (
        v_new_tx_id,
        v_orig.lead_id,
        v_orig.project_id,
        'reversal',
        v_new_code,
        -1 * ABS(v_orig.amount),
        -1 * ABS(v_orig.deal_value),
        -1 * ABS(v_orig.commission_amount),
        -1 * ABS(COALESCE(v_orig.sale_commission_amount, 0)),
        v_orig.unit_code,
        'confirmed',
        'approved',
        true,
        p_original_tx_id,
        p_reason,
        p_user_id,
        NOW(),
        'Giao dịch bù trừ hủy/hoàn cho mã ' || v_orig.code || ': ' || p_reason
    );

    -- Ghi audit log
    INSERT INTO audit_logs (
        user_id,
        actor_id,
        action,
        table_name,
        record_id,
        new_data,
        ip_address
    ) VALUES (
        p_user_id,
        p_user_id,
        'reversal_transaction_created',
        'transactions',
        v_new_tx_id,
        jsonb_build_object(
            'original_tx_id', p_original_tx_id,
            'original_code', v_orig.code,
            'reversal_amount', -1 * ABS(v_orig.amount),
            'reason', p_reason
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'reversal_tx_id', v_new_tx_id,
        'code', v_new_code,
        'amount', -1 * ABS(v_orig.amount)
    );
END;
$$;
