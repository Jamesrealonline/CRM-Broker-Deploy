-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 018: COMPREHENSIVE HR LIFECYCLE & PERSONNEL MANAGEMENT
-- Quản trị nhân sự đầy đủ vòng đời: Tuyển dụng (ATS) -> Nhận việc -> 
-- Hồ sơ 360 & Bảo mật dữ liệu cá nhân -> Đào tạo -> Hiệu suất -> Phép -> 
-- Điều chuyển / Thăng giáng (Maker-Checker) -> Kỷ luật -> Nghỉ việc
-- ========================================================

-- 1. MỞ RỘNG VAI TRÒ HR_ADMIN TRÊN BẢNG PROFILES (ADDITIVE)
DO $$
BEGIN
    -- Cập nhật check constraint role nếu tồn tại
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
        role IN (
            'admin', 
            'director', 
            'hr_admin',
            'marketing_manager', 
            'sales_manager', 
            'team_leader', 
            'sale_agent'
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. BẢNG HỒ SƠ CÔNG VIỆC NHÂN SỰ: employee_records (1-1 với profiles)
CREATE TABLE IF NOT EXISTS public.employee_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    employment_type VARCHAR(50) NOT NULL DEFAULT 'official' CHECK (employment_type IN ('official', 'probation', 'collaborator')),
    title VARCHAR(100) NOT NULL DEFAULT 'Chuyên viên kinh doanh',
    level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
    direct_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    probation_end_date DATE,
    termination_date DATE,
    recruited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recruitment_source VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'official' CHECK (status IN ('candidate', 'onboarding', 'probation', 'official', 'on_leave', 'terminated')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BẢNG DỮ LIỆU NHẠY CẢM NHÂN SỰ: employee_private (RLS riêng biệt, tối đa bảo mật)
CREATE TABLE IF NOT EXISTS public.employee_private (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    date_of_birth DATE,
    id_card_number TEXT,
    id_card_issue_date DATE,
    id_card_issue_place TEXT,
    permanent_address TEXT,
    current_address TEXT,
    tax_id TEXT,
    bank_account_number TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BẢNG LỊCH SỬ BIẾN ĐỘNG NHÂN SỰ: personnel_events (APPEND-ONLY AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.personnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (
        event_type IN (
            'hired', 
            'activated', 
            'probation_passed', 
            'contract_signed', 
            'contract_renewed', 
            'contract_ended', 
            'promoted', 
            'demoted', 
            'transferred', 
            'leave_started', 
            'leave_ended', 
            'locked', 
            'unlocked', 
            'warned', 
            'terminated', 
            'rehired'
        )
    ),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BẢNG YÊU CẦU ĐIỀU CHUYỂN / THĂNG GIÁNG: personnel_transfer_requests (MAKER-CHECKER)
CREATE TABLE IF NOT EXISTS public.personnel_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('transfer', 'promotion', 'demotion', 'title_change')),
    from_agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    to_agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    from_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    to_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    from_role VARCHAR(50),
    to_role VARCHAR(50),
    from_direct_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    to_direct_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    effective_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'cancelled')),
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. HỢP ĐỒNG LAO ĐỘNG & CHỨNG CHỈ HÀNH NGHỀ
CREATE TABLE IF NOT EXISTS public.employment_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contract_number VARCHAR(100) NOT NULL,
    contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('probation', 'labor', 'collaborator', 'service')),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.broker_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    certificate_number VARCHAR(100) NOT NULL,
    issuing_authority VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'expired', 'revoked')),
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('id_card', 'degree', 'broker_cert', 'resume', 'health_cert', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    expiry_date DATE,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. QUẢN LÝ NGHỈ PHÉP: leave_types, leave_balances, leave_requests
CREATE TABLE IF NOT EXISTS public.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_days_per_year INT DEFAULT 12,
    is_paid BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true
);

INSERT INTO public.leave_types (code, name, default_days_per_year, is_paid, requires_approval)
VALUES 
    ('annual', 'Nghỉ phép năm', 12, true, true),
    ('sick', 'Nghỉ ốm hưởng BHXH', 0, false, true),
    ('unpaid', 'Nghỉ không hưởng lương', 0, false, true),
    ('maternity', 'Nghỉ thai sản', 180, true, true),
    ('bereavement', 'Nghỉ chế độ hiếu hỉ', 3, true, true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    year INT NOT NULL,
    leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE CASCADE,
    total_entitlement NUMERIC(4,1) DEFAULT 12.0,
    used_days NUMERIC(4,1) DEFAULT 0.0,
    remaining_days NUMERIC(4,1) GENERATED ALWAYS AS (total_entitlement - used_days) STORED,
    UNIQUE(user_id, year, leave_type_id)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(4,1) NOT NULL,
    reason TEXT NOT NULL,
    substitute_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TUYỂN DỤNG ATS: requisitions, candidates, interviews
CREATE TABLE IF NOT EXISTS public.job_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    target_count INT NOT NULL DEFAULT 1,
    hired_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'filled', 'cancelled')),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES public.job_requisitions(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    phone_normalized VARCHAR(20) NOT NULL,
    phone_hash TEXT NOT NULL,
    email VARCHAR(255),
    email_hash TEXT,
    source VARCHAR(100) NOT NULL DEFAULT 'direct',
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
    is_rehire BOOLEAN DEFAULT false,
    previous_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES public.profiles(id),
    interview_date TIMESTAMPTZ NOT NULL,
    score INT CHECK (score BETWEEN 1 AND 10),
    feedback TEXT,
    result VARCHAR(50) DEFAULT 'pending' CHECK (result IN ('pending', 'pass', 'fail')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. HIỆU SUẤT, CHỈ TIÊU & COACHING 1-1
CREATE TABLE IF NOT EXISTS public.performance_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) NOT NULL, -- '2026-Q1', '2026-11'
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    revenue_target NUMERIC(18,2) DEFAULT 0,
    contracts_target INT DEFAULT 0,
    leads_target INT DEFAULT 0,
    recruits_target INT DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period, user_id, team_id, agency_id)
);

CREATE TABLE IF NOT EXISTS public.coaching_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT NOT NULL,
    action_items TEXT,
    is_private BOOLEAN DEFAULT true, -- Ẩn với nhân sự trừ khi được chia sẻ
    shared_with_employee BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL,
    score NUMERIC(3,1) CHECK (score BETWEEN 1.0 AND 5.0),
    summary TEXT,
    employee_acknowledged BOOLEAN DEFAULT false,
    employee_comments TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. KỶ LUẬT & KHEN THƯỞNG: disciplinary_records
CREATE TABLE IF NOT EXISTS public.disciplinary_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('reminder', 'warning', 'reprimand', 'dismissal', 'award')),
    title VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    basis TEXT,
    issued_by UUID NOT NULL REFERENCES public.profiles(id),
    document_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'appealed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CHECKLIST NHẬN VIỆC (ONBOARDING)
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    assigned_mentor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date DATE,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 12. STORED PROCEDURE: apply_personnel_transfer (ATOMIC & MAKER-CHECKER)
-- ========================================================
CREATE OR REPLACE FUNCTION public.apply_personnel_transfer(
    p_request_id UUID,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_req RECORD;
    v_target_profile RECORD;
    v_actor_role TEXT;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- 1. Kiểm tra request
    SELECT * INTO v_req 
    FROM public.personnel_transfer_requests 
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Yêu cầu điều chuyển không tồn tại (ID: %)', p_request_id;
    END IF;

    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'Yêu cầu này đã được xử lý hoặc đã kết thúc (Trạng thái: %)', v_req.status;
    END IF;

    -- 2. Kiểm tra thẩm quyền phê duyệt
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;
    IF v_actor_role NOT IN ('admin', 'director', 'sales_manager', 'hr_admin') THEN
        RAISE EXCEPTION 'forbidden: Bạn không có quyền phê duyệt yêu cầu nhân sự này!';
    END IF;

    -- Không cho phép tự duyệt yêu cầu của chính mình
    IF v_req.user_id = p_actor_id THEN
        RAISE EXCEPTION 'invalid_operation: Bạn không thể tự phê duyệt yêu cầu điều chuyển của chính mình!';
    END IF;

    -- 3. Đọc dữ liệu hiện tại của nhân sự
    SELECT * INTO v_target_profile FROM public.profiles WHERE id = v_req.user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nhân sự không tồn tại trong hệ thống!';
    END IF;

    v_old_values := jsonb_build_object(
        'agency_id', v_target_profile.agency_id,
        'team_id', v_target_profile.team_id,
        'role', v_target_profile.role
    );

    v_new_values := jsonb_build_object(
        'agency_id', COALESCE(v_req.to_agency_id, v_target_profile.agency_id),
        'team_id', v_req.to_team_id,
        'role', COALESCE(v_req.to_role, v_target_profile.role)
    );

    -- 4. Cập nhật hồ sơ profiles
    UPDATE public.profiles
    SET 
        agency_id = COALESCE(v_req.to_agency_id, agency_id),
        team_id = v_req.to_team_id,
        role = COALESCE(v_req.to_role, role),
        updated_at = NOW()
    WHERE id = v_req.user_id;

    -- 5. Cập nhật employee_records nếu có
    UPDATE public.employee_records
    SET 
        direct_manager_id = COALESCE(v_req.to_direct_manager_id, direct_manager_id),
        updated_at = NOW()
    WHERE user_id = v_req.user_id;

    -- 6. Cập nhật trạng thái request
    UPDATE public.personnel_transfer_requests
    SET 
        status = 'applied',
        approved_by = p_actor_id,
        approved_at = NOW()
    WHERE id = p_request_id;

    -- 7. Ghi nhận sự kiện vào personnel_events (Append-only)
    INSERT INTO public.personnel_events (
        user_id,
        organization_id,
        event_type,
        effective_date,
        actor_id,
        old_values,
        new_values,
        reason
    ) VALUES (
        v_req.user_id,
        v_target_profile.organization_id,
        CASE 
            WHEN v_req.request_type = 'promotion' THEN 'promoted'
            WHEN v_req.request_type = 'demotion' THEN 'demoted'
            ELSE 'transferred'
        END,
        v_req.effective_date,
        p_actor_id,
        v_old_values,
        v_new_values,
        v_req.reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'user_id', v_req.user_id,
        'status', 'applied'
    );
END;
$$;

-- ========================================================
-- 13. STORED PROCEDURE: reveal_employee_private_field
-- Giải mã / Tra cứu thông tin cá nhân kèm bắt buộc lý do & ghi Audit Log
-- ========================================================
CREATE OR REPLACE FUNCTION public.reveal_employee_private_field(
    p_target_user_id UUID,
    p_field TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT;
    v_private RECORD;
    v_field_value TEXT;
BEGIN
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

    -- Cho phép chính chủ xem không cần audit khắt khe
    IF v_actor_id = p_target_user_id THEN
        SELECT * INTO v_private FROM public.employee_private WHERE user_id = p_target_user_id;
        IF p_field = 'id_card_number' THEN v_field_value := v_private.id_card_number;
        ELSIF p_field = 'tax_id' THEN v_field_value := v_private.tax_id;
        ELSIF p_field = 'bank_account_number' THEN v_field_value := v_private.bank_account_number;
        END IF;
        RETURN jsonb_build_object('success', true, 'value', v_field_value);
    END IF;

    -- Nếu là người khác: Chỉ admin, director, hr_admin
    IF v_actor_role NOT IN ('admin', 'director', 'hr_admin') THEN
        RAISE EXCEPTION 'forbidden: Bạn không có quyền tra cứu thông tin bảo mật nhân sự!';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'invalid_argument: Bắt buộc cung cấp lý do khi xem thông tin cá nhân nhân sự!';
    END IF;

    SELECT * INTO v_private FROM public.employee_private WHERE user_id = p_target_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ bảo mật nhân sự!';
    END IF;

    IF p_field = 'id_card_number' THEN v_field_value := v_private.id_card_number;
    ELSIF p_field = 'tax_id' THEN v_field_value := v_private.tax_id;
    ELSIF p_field = 'bank_account_number' THEN v_field_value := v_private.bank_account_number;
    ELSE
        RAISE EXCEPTION 'Trường dữ liệu không hợp lệ: %', p_field;
    END IF;

    -- Ghi audit log
    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        v_actor_id,
        'reveal_employee_private',
        'employee_private',
        p_target_user_id,
        jsonb_build_object('field', p_field, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'value', v_field_value);
END;
$$;

-- ========================================================
-- 14. BẢO VỆ RLS LEVEL POLICIES
-- ========================================================
ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_notes ENABLE ROW LEVEL SECURITY;

-- Policy employee_private: Chỉ chính chủ, hoặc HR, Admin, Director
DROP POLICY IF EXISTS p_employee_private_select ON public.employee_private;
CREATE POLICY p_employee_private_select ON public.employee_private
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'director', 'hr_admin')
    )
);

-- Policy coaching_notes: Mentor, người tạo, hoặc HR/Admin, chỉ hiện cho nhân viên khi shared_with_employee = true
DROP POLICY IF EXISTS p_coaching_notes_select ON public.coaching_notes;
CREATE POLICY p_coaching_notes_select ON public.coaching_notes
FOR SELECT TO authenticated
USING (
    mentor_id = auth.uid() OR
    (user_id = auth.uid() AND shared_with_employee = true) OR
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'director', 'hr_admin')
    )
);
