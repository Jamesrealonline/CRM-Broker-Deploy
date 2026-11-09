-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 019: SLA ANTI-CHEAT, UNIT HOLDS & JOB MONITORING
-- Giai đoạn 2: Chống lách SLA bằng hẹn ảo/tương tác rác,
-- Quản lý Giữ Căn (Unit Holds), Danh sách chờ (Waitlist),
-- Lead Pool có hạn mức và Giám sát Job nền (job_runs, dead-letter)
-- ========================================================

-- 1. BẢNG LỊCH HẸN KHÁCH HÀNG: lead_appointments
CREATE TABLE IF NOT EXISTS public.lead_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    appointment_type VARCHAR(50) NOT NULL DEFAULT 'consulting',
    appointment_date TIMESTAMPTZ NOT NULL,
    location TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'missed', 'cancelled')),
    result_summary TEXT,
    flags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG LÝ DO ĐÓNG LEAD THẤT BẠI: lead_loss_reasons
CREATE TABLE IF NOT EXISTS public.lead_loss_reasons (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0
);

INSERT INTO public.lead_loss_reasons (code, name, is_active, sort_order)
VALUES
    ('gia_cao', 'Giá vượt quá ngân sách khách hàng', true, 1),
    ('vi_tri', 'Vị trí dự án không phù hợp nhu cầu', true, 2),
    ('phap_ly', 'Lo ngại về tiến độ pháp lý dự án', true, 3),
    ('tai_chinh', 'Không vay được ngân hàng / Không đủ vốn tự có', true, 4),
    ('mua_noi_khac', 'Khách đã mua dự án bất động sản khác', true, 5),
    ('khong_nhu_cau', 'Khách không còn nhu cầu mua BĐS', true, 6),
    ('khac', 'Lý do khác (Bắt buộc ghi chú chi tiết)', true, 7)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- 3. BỔ SUNG CỘT CHO BẢNG LEADS (CHỐNG LÁCH SLA & NUÔI LẠI)
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS loss_reason_code VARCHAR(50) REFERENCES public.lead_loss_reasons(code),
ADD COLUMN IF NOT EXISTS loss_reason_detail TEXT,
ADD COLUMN IF NOT EXISTS nurture_reminder_date DATE,
ADD COLUMN IF NOT EXISTS sla_reset_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS sla_flags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 4. BẢNG GIỮ CĂN CÓ THỜI HẠN: unit_holds
CREATE TABLE IF NOT EXISTS public.unit_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    unit_code VARCHAR(100) NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    sale_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    hold_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hold_expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted', 'cancelled')),
    extension_count INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chống giữ trùng một căn đang có hold hiệu lực
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_unit_hold 
ON public.unit_holds (project_id, lower(trim(unit_code))) 
WHERE status = 'active';

-- 5. BẢNG DANH SÁCH CHỜ CĂN: unit_waitlist
CREATE TABLE IF NOT EXISTS public.unit_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    unit_code VARCHAR(100) NOT NULL,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    priority_order INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'expired', 'converted')),
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BẢNG THEO DÕI JOB NỀN: job_runs
CREATE TABLE IF NOT EXISTS public.job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
    rows_affected INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BẢNG HÀNG ĐỢI THƯ CHẾT (DEAD-LETTER QUEUE)
CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table VARCHAR(50) NOT NULL DEFAULT 'outbox',
    original_id UUID,
    payload JSONB NOT NULL,
    error_reason TEXT NOT NULL,
    retry_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved', 'discarded')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 8. STORED PROCEDURE: claim_pool_lead (CONCURRENCY LOCKING)
-- Nhận lead từ Kho chung có kiểm soát cạnh tranh và hạn mức
-- ========================================================
CREATE OR REPLACE FUNCTION public.claim_pool_lead(
    p_lead_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_lead RECORD;
    v_user RECORD;
    v_daily_claimed INT;
    v_current_open_leads INT;
    v_max_daily INT := 5;     -- Tối đa nhận 5 lead/ngày
    v_max_open INT := 20;     -- Trần 20 lead mở đang giữ
    v_new_deadline TIMESTAMPTZ;
BEGIN
    -- 1. Kiểm tra quyền và hồ sơ của Sale
    SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Người dùng không tồn tại!';
    END IF;

    IF v_user.status <> 'active' THEN
        RAISE EXCEPTION 'Tài khoản không ở trạng thái hoạt động!';
    END IF;

    -- 2. Kiểm tra hạn mức nhận lead trong ngày của Sale
    SELECT COUNT(*) INTO v_daily_claimed
    FROM public.lead_assignment_history
    WHERE assigned_to = p_user_id
      AND reason = 'pool_claimed'
      AND assigned_at >= CURRENT_DATE;

    IF v_daily_claimed >= v_max_daily THEN
        RAISE EXCEPTION 'limit_exceeded: Bạn đã nhận đủ % lead tối đa từ Kho chung hôm nay!', v_max_daily;
    END IF;

    -- 3. Kiểm tra trần số lead mở đang chăm sóc
    SELECT COUNT(*) INTO v_current_open_leads
    FROM public.leads
    WHERE assigned_to = p_user_id
      AND status NOT IN ('lost', 'invalid', 'contract', 'after_sales');

    IF v_current_open_leads >= v_max_open THEN
        RAISE EXCEPTION 'limit_exceeded: Bạn đang nắm giữ % lead mở, vui lòng hoàn thành chăm sóc trước khi nhận thêm!', v_max_open;
    END IF;

    -- 4. Khóa hàng lead chống nhận trùng đồng thời (FOR UPDATE SKIP LOCKED)
    SELECT * INTO v_lead
    FROM public.leads
    WHERE id = p_lead_id
      AND (assigned_to IS NULL OR assigned_name = 'Kho lead chung')
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'lead_already_claimed: Lead này vừa được tiếp nhận bởi chuyên viên khác hoặc không ở Kho chung!';
    END IF;

    -- 5. Tính hạn SLA 24 giờ mới
    v_new_deadline := NOW() + INTERVAL '24 hours';

    -- 6. Gán Lead cho Sale
    UPDATE public.leads
    SET 
        assigned_to = p_user_id,
        assigned_name = v_user.full_name,
        team_id = COALESCE(v_user.team_id, team_id),
        agency_id = COALESCE(v_user.agency_id, agency_id),
        care_deadline_at = v_new_deadline,
        last_care_updated_at = NOW(),
        auto_transfer_count = 0,
        status = 'new',
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- 7. Ghi nhận lịch sử điều chuyển
    INSERT INTO public.lead_assignment_history (
        lead_id,
        assigned_to,
        previous_assigned_to,
        assigned_name,
        reason,
        assigned_at
    ) VALUES (
        p_lead_id,
        p_user_id,
        NULL,
        v_user.full_name,
        'pool_claimed',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', p_lead_id,
        'assigned_to', p_user_id,
        'deadline', v_new_deadline
    );
END;
$$;

-- ========================================================
-- 9. STORED PROCEDURE: release_expired_unit_holds
-- Giải phóng căn hết hạn và kích hoạt danh sách chờ Waitlist
-- ========================================================
CREATE OR REPLACE FUNCTION public.release_expired_unit_holds()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_hold RECORD;
    v_released_count INT := 0;
    v_next_waitlist RECORD;
BEGIN
    FOR v_hold IN 
        SELECT * FROM public.unit_holds
        WHERE status = 'active' AND hold_expires_at <= NOW()
        FOR UPDATE
    LOOP
        -- 1. Đổi trạng thái sang hết hạn
        UPDATE public.unit_holds
        SET status = 'expired', updated_at = NOW()
        WHERE id = v_hold.id;

        v_released_count := v_released_count + 1;

        -- 2. Kiểm tra xem có người đang chờ trong waitlist không
        SELECT * INTO v_next_waitlist
        FROM public.unit_waitlist
        WHERE project_id = v_hold.project_id
          AND lower(trim(unit_code)) = lower(trim(v_hold.unit_code))
          AND status = 'waiting'
        ORDER BY priority_order ASC, created_at ASC
        LIMIT 1;

        IF FOUND THEN
            -- Cập nhật trạng thái waitlist sang notified
            UPDATE public.unit_waitlist
            SET status = 'notified', notified_at = NOW()
            WHERE id = v_next_waitlist.id;

            -- Đẩy thông báo vào outbox cho Sale đang chờ
            INSERT INTO public.outbox (
                event_type,
                lead_id,
                recipient_id,
                payload
            ) VALUES (
                'waitlist_unit_available',
                v_next_waitlist.lead_id,
                v_next_waitlist.sale_id,
                jsonb_build_object(
                    'unit_code', v_hold.unit_code,
                    'project_id', v_hold.project_id,
                    'message', 'Căn bạn đang chờ vừa được giải phóng! Bạn có 12 giờ để kích hoạt giữ căn.'
                )
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'released_count', v_released_count
    );
END;
$$;
