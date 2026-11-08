-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 009: SERVER-SIDE 24H SLA SCANNER & TRANSACTIONAL OUTBOX
-- Giai đoạn P0.2: Quét SLA phía server với FOR UPDATE SKIP LOCKED & pg_cron
-- ========================================================

-- 1. TẠO BẢNG NOTIFICATION OUTBOX (TRANSACTIONAL OUTBOX PATTERN)
-- Đảm bảo ghi nhận sự kiện thông báo cùng transaction với điều chuyển lead
CREATE TABLE IF NOT EXISTS outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255),
    recipient_name VARCHAR(255),
    channel VARCHAR(20) DEFAULT 'both',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
    retry_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Bật RLS cho outbox
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox_admin_all" ON outbox
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director'));

CREATE INDEX IF NOT EXISTS idx_outbox_pending 
ON outbox (status, created_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_outbox_lead_id 
ON outbox (lead_id);

-- 2. HÀM ATOMIC RPC SERVER-SIDE: scan_and_transfer_overdue_leads
-- Sử dụng SELECT ... FOR UPDATE SKIP LOCKED để chống trùng lặp khi chạy song song
CREATE OR REPLACE FUNCTION scan_and_transfer_overdue_leads(
    p_is_dry_run BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh';
    v_config RECORD;
    v_max_transfers INT := 3;
    v_deadline_hours INT := 24;
    v_pre_warn_hours INT := 20;
    v_scanned_count INT := 0;
    v_transferred_count INT := 0;
    v_warned_count INT := 0;
    v_pool_reclaimed_count INT := 0;
    v_lead RECORD;
    v_next_sale RECORD;
    v_new_deadline TIMESTAMPTZ;
    v_new_transfer_count INT;
    v_prev_sales UUID[];
    v_details JSONB := '[]'::jsonb;
    v_is_overdue BOOLEAN;
    v_is_warning BOOLEAN;
    v_lead_cursor REFCURSOR;
BEGIN
    -- 1. Đọc cấu hình từ system_settings nếu có
    SELECT 
        COALESCE((value->>'max_transfer_count')::int, 3) AS max_transfer_count,
        COALESCE((value->>'deadline_hours')::int, 24) AS deadline_hours,
        COALESCE((value->>'pre_warning_hours')::int, 20) AS pre_warning_hours
    INTO v_config
    FROM system_settings
    WHERE key = 'lead_auto_transfer_config';

    IF FOUND THEN
        v_max_transfers := v_config.max_transfer_count;
        v_deadline_hours := v_config.deadline_hours;
        v_pre_warn_hours := v_config.pre_warning_hours;
    END IF;

    -- 2. Con trỏ quét các Lead cần kiểm tra (DÙNG FOR UPDATE SKIP LOCKED ĐỂ CHỐNG WORKER TRÙNG NHAU)
    -- Lọc bỏ các trạng thái dừng đồng hồ và các lead đã đóng / miễn chuyển
    FOR v_lead IN 
        SELECT l.*, c.full_name AS customer_name, c.phone AS customer_phone, p.name AS project_name
        FROM leads l
        LEFT JOIN customers c ON c.id = l.customer_id
        LEFT JOIN projects p ON p.id = l.project_id
        WHERE l.assigned_to IS NOT NULL
          AND l.is_exempt_auto_transfer = false
          AND l.status NOT IN (
              'lost', 'invalid', 'unreachable',
              'appointment_set', 'consulted', 'site_visit', 
              'considering', 'booking', 'deposit', 'contract', 'after_sales'
          )
          AND (l.extended_until IS NULL OR l.extended_until <= v_now)
          AND (l.next_follow_up IS NULL OR l.next_follow_up <= v_now)
        FOR UPDATE OF l SKIP LOCKED
    LOOP
        v_scanned_count := v_scanned_count + 1;

        -- Xác định hạn chót chăm sóc (care_deadline_at)
        IF v_lead.care_deadline_at IS NULL THEN
            CONTINUE;
        END IF;

        v_is_overdue := v_lead.care_deadline_at <= v_now;
        v_is_warning := (v_lead.care_deadline_at <= v_now + INTERVAL '4 hours') AND NOT v_is_overdue;

        -- TH1: LEAD QUÁ HẠN 24H -> ĐIỀU CHUYỂN HOẶC VỀ POOL
        IF v_is_overdue THEN
            v_new_transfer_count := COALESCE(v_lead.auto_transfer_count, 0) + 1;
            
            -- Danh sách sale đã từng giữ lead
            v_prev_sales := COALESCE(v_lead.previous_assigned_sales, ARRAY[]::uuid[]);
            IF NOT (v_lead.assigned_to = ANY(v_prev_sales)) THEN
                v_prev_sales := array_append(v_prev_sales, v_lead.assigned_to);
            END IF;

            -- Tìm Sale hợp lệ tiếp theo: cùng team/agency, active, không on_leave, nhận lead, chưa từng giữ lead
            SELECT prof.* INTO v_next_sale
            FROM profiles prof
            WHERE prof.status = 'active'
              AND prof.on_leave = false
              AND prof.accepts_leads = true
              AND prof.role IN ('sale_agent', 'team_leader')
              AND prof.id != v_lead.assigned_to
              AND NOT (prof.id = ANY(v_prev_sales))
              AND (
                  (v_lead.team_id IS NOT NULL AND prof.team_id = v_lead.team_id)
                  OR (v_lead.agency_id IS NOT NULL AND prof.agency_id = v_lead.agency_id)
                  OR true
              )
            ORDER BY (prof.team_id = v_lead.team_id) DESC, random()
            LIMIT 1;

            -- Nếu vượt quá 3 lần chuyển HOẶC không còn sale nào hợp lệ -> Về Kho lead chung (Pool)
            IF v_next_sale.id IS NULL OR v_new_transfer_count > v_max_transfers THEN
                v_pool_reclaimed_count := v_pool_reclaimed_count + 1;
                
                v_details := v_details || jsonb_build_object(
                    'lead_id', v_lead.id,
                    'customer_name', v_lead.customer_name,
                    'action', 'pool_reclaimed',
                    'transfer_count', v_new_transfer_count,
                    'reason', 'Vượt quá số lần chuyển tối đa hoặc hết sale hợp lệ'
                );

                IF NOT p_is_dry_run THEN
                    -- Cập nhật Lead về kho chung
                    UPDATE leads
                    SET assigned_to = NULL,
                        auto_transfer_count = v_new_transfer_count,
                        previous_assigned_sales = v_prev_sales,
                        care_deadline_at = NULL,
                        notes = COALESCE(notes, '') || E'\n[Hệ thống] Thu hồi về Kho lead chung do quá 3 lần quá hạn.',
                        updated_at = v_now
                    WHERE id = v_lead.id;

                    -- Ghi log điều chuyển vào lead_assignment_history
                    INSERT INTO lead_assignment_history (
                        id, lead_id, from_sale_id, from_sale_name, to_sale_id, to_sale_name,
                        reason, transfer_count, notes, created_by, created_at
                    ) VALUES (
                        uuid_generate_v4(), v_lead.id, v_lead.assigned_to, 'Chuyên viên cũ', NULL, 'Kho lead chung',
                        'pool_reclaim', v_new_transfer_count, 'Tự động đưa về Kho chung do quá hạn 24h', 'Hệ thống Cron', v_now
                    );

                    -- Ghi thông báo cảnh báo quản lý vào outbox
                    INSERT INTO outbox (
                        id, event_type, lead_id, recipient_email, recipient_name, payload
                    ) VALUES (
                        uuid_generate_v4(), 'pool_alert', v_lead.id, 'manager@crm-broker.vn', 'Trưởng Phòng Kinh Doanh',
                        jsonb_build_object(
                            'ten_khach_hang', v_lead.customer_name,
                            'du_an', v_lead.project_name,
                            'transfer_count', v_new_transfer_count
                        )
                    );
                END IF;

            ELSE
                -- ĐIỀU CHUYỂN CHO SALE TIẾP THEO (ROUND-ROBIN)
                v_transferred_count := v_transferred_count + 1;
                v_new_deadline := v_now + INTERVAL '24 hours';

                v_details := v_details || jsonb_build_object(
                    'lead_id', v_lead.id,
                    'customer_name', v_lead.customer_name,
                    'action', 'transferred',
                    'to_sale_id', v_next_sale.id,
                    'to_sale_name', v_next_sale.full_name,
                    'transfer_count', v_new_transfer_count
                );

                IF NOT p_is_dry_run THEN
                    -- Cập nhật Lead
                    UPDATE leads
                    SET assigned_to = v_next_sale.id,
                        team_id = COALESCE(v_next_sale.team_id, team_id),
                        agency_id = COALESCE(v_next_sale.agency_id, agency_id),
                        auto_transfer_count = v_new_transfer_count,
                        previous_assigned_sales = v_prev_sales,
                        last_care_updated_at = v_now,
                        care_deadline_at = v_new_deadline,
                        notes = COALESCE(notes, '') || E'\n[Hệ thống] Tự động điều chuyển sang ' || v_next_sale.full_name || ' do quá hạn 24h.',
                        updated_at = v_now
                    WHERE id = v_lead.id;

                    -- Ghi log điều chuyển
                    INSERT INTO lead_assignment_history (
                        id, lead_id, from_sale_id, from_sale_name, to_sale_id, to_sale_name,
                        reason, transfer_count, notes, created_by, created_at
                    ) VALUES (
                        uuid_generate_v4(), v_lead.id, v_lead.assigned_to, 'Chuyên viên cũ', v_next_sale.id, v_next_sale.full_name,
                        'auto_overdue', v_new_transfer_count, 'Tự động điều chuyển quá hạn 24 giờ liên tục', 'Hệ thống Cron', v_now
                    );

                    -- Ghi outbox gửi cho Sale mới
                    INSERT INTO outbox (
                        id, event_type, lead_id, recipient_id, recipient_email, recipient_name, payload
                    ) VALUES (
                        uuid_generate_v4(), 'auto_transferred_new', v_lead.id, v_next_sale.id, v_next_sale.email, v_next_sale.full_name,
                        jsonb_build_object(
                            'ten_sale', v_next_sale.full_name,
                            'ten_khach_hang', v_lead.customer_name,
                            'so_dien_thoai', v_lead.customer_phone,
                            'du_an', v_lead.project_name,
                            'han_cham_soc', v_new_deadline
                        )
                    );

                    -- Ghi outbox gửi cho Sale cũ bị thu hồi
                    INSERT INTO outbox (
                        id, event_type, lead_id, recipient_id, recipient_name, payload
                    ) VALUES (
                        uuid_generate_v4(), 'auto_transferred_old', v_lead.id, v_lead.assigned_to, 'Chuyên viên cũ',
                        jsonb_build_object(
                            'ten_khach_hang', v_lead.customer_name,
                            'du_an', v_lead.project_name
                        )
                    );
                END IF;
            END IF;

        -- TH2: SẮP QUÁ HẠN (MỐC 20H - CÒN DƯỚI 4H) -> GỬI CẢNH BÁO
        ELSIF v_is_warning THEN
            v_warned_count := v_warned_count + 1;

            v_details := v_details || jsonb_build_object(
                'lead_id', v_lead.id,
                'customer_name', v_lead.customer_name,
                'action', 'warned',
                'care_deadline_at', v_lead.care_deadline_at
            );

            IF NOT p_is_dry_run THEN
                -- Ghi nhận sự kiện cảnh báo vào outbox (kèm idempotency chống gửi trùng trong 4h)
                INSERT INTO outbox (
                    id, event_type, lead_id, recipient_id, payload
                ) VALUES (
                    uuid_generate_v4(), 'overdue_warning', v_lead.id, v_lead.assigned_to,
                    jsonb_build_object(
                        'ten_khach_hang', v_lead.customer_name,
                        'du_an', v_lead.project_name,
                        'han_cham_soc', v_lead.care_deadline_at
                    )
                );
            END IF;
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'dry_run', p_is_dry_run,
        'scanned_count', v_scanned_count,
        'transferred_count', v_transferred_count,
        'warned_count', v_warned_count,
        'pool_reclaimed_count', v_pool_reclaimed_count,
        'details', v_details
    );
END;
$$;

-- 3. ĐĂNG KÝ LỊCH CRON JOB PG_CRON (MỖI 5 PHÚT)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Gỡ job cũ nếu có
        PERFORM cron.unschedule('crm_lead_auto_transfer_cron');
        -- Đặt lịch chạy mỗi 5 phút
        PERFORM cron.schedule(
            'crm_lead_auto_transfer_cron',
            '*/5 * * * *',
            'SELECT scan_and_transfer_overdue_leads(false);'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ghi chú nếu pg_cron chưa được bật ở schema public, không làm gián đoạn migration
        RAISE NOTICE 'pg_cron không khả dụng hoặc chưa được cấp quyền: %', SQLERRM;
END $$;
