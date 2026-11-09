-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 008: LEAD STATUS TRANSITIONS & ATOMIC CHANGE STATUS RPC
-- Giai đoạn P0.1: Cưỡng chế ma trận trạng thái & ràng buộc tài chính ở DB
-- ========================================================

-- 1. TẠO BẢNG MA TRẬN CHUYỂN TRẠNG THÁI (lead_status_transitions)
CREATE TABLE IF NOT EXISTS lead_status_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    requires_financial BOOLEAN DEFAULT false,
    allowed_roles JSONB DEFAULT '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_lead_status_transition UNIQUE (from_status, to_status)
);

-- Bật RLS cho lead_status_transitions
ALTER TABLE lead_status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_status_transitions_select" ON lead_status_transitions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "lead_status_transitions_admin_all" ON lead_status_transitions
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director'));

-- Seed dữ liệu ma trận chuyển đổi hợp lệ
INSERT INTO lead_status_transitions (from_status, to_status, requires_financial, allowed_roles, description)
VALUES
    -- Từ 'new'
    ('new', 'unreachable', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Không nghe máy khi tiếp cận lần đầu'),
    ('new', 'contacted', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đã liên hệ thành công'),
    ('new', 'qualifying', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Xác định nhu cầu khách hàng'),
    ('new', 'booking', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách hàng đặt cọc/booking giữ chỗ ngay khi tiếp nhận'),
    ('new', 'deposit', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Vào cọc trực tiếp'),
    ('new', 'invalid', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Số điện thoại sai hoặc không đúng đối tượng'),
    ('new', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách từ chối dứt khoát / Không có nhu cầu'),

    -- Từ 'unreachable'
    ('unreachable', 'contacted', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Gọi lại thành công'),
    ('unreachable', 'qualifying', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khai thác nhu cầu sau khi gọi lại'),
    ('unreachable', 'invalid', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Thuê bao không tồn tại / Sai số'),
    ('unreachable', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Không thể liên lạc sau nhiều lần'),

    -- Từ 'contacted'
    ('contacted', 'qualifying', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Tiến hành xác định nhu cầu & ngân sách'),
    ('contacted', 'doc_sent', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Gửi tài liệu / brochure dự án qua Zalo/Email'),
    ('contacted', 'appointment_set', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Thiết lập cuộc hẹn tư vấn hoặc xem nhà mẫu'),
    ('contacted', 'invalid', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách xác nhận không có nhu cầu'),
    ('contacted', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách huỷ tìm hiểu'),

    -- Từ 'qualifying'
    ('qualifying', 'doc_sent', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Gửi bảng tính dòng tiền và mặt bằng căn hộ'),
    ('qualifying', 'appointment_set', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Hẹn gặp tư vấn trực tiếp'),
    ('qualifying', 'consulted', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đã gặp gỡ trao đổi phương án đầu tư'),
    ('qualifying', 'site_visit', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đưa khách tham quan thực tế công trường'),
    ('qualifying', 'considering', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách đang cân nhắc lựa chọn giỏ hàng'),
    ('qualifying', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách chưa đủ khả năng tài chính'),

    -- Từ 'doc_sent'
    ('doc_sent', 'appointment_set', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách đồng ý gặp sau khi xem tài liệu'),
    ('doc_sent', 'consulted', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đã trao đổi chi tiết bảng giá'),
    ('doc_sent', 'site_visit', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đưa khách đi xem dự án'),
    ('doc_sent', 'considering', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đang so sánh với dự án khác'),
    ('doc_sent', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách từ chối sau khi xem báo giá'),

    -- Từ 'appointment_set'
    ('appointment_set', 'consulted', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Hoàn thành cuộc hẹn tư vấn'),
    ('appointment_set', 'site_visit', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đón khách tham quan sa bàn & nhà mẫu'),
    ('appointment_set', 'considering', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách về bàn bạc gia đình sau cuộc hẹn'),
    ('appointment_set', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách huỷ hẹn và không nghe máy'),

    -- Từ 'consulted'
    ('consulted', 'site_visit', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Đi thực tế trải nghiệm tiện ích'),
    ('consulted', 'considering', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách xin thời gian cân nhắc đòn bẩy ngân hàng'),
    ('consulted', 'booking', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách ưng ý và Booking giữ chỗ ưu tiên'),
    ('consulted', 'deposit', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Chốt cọc trực tiếp tại buổi tư vấn'),
    ('consulted', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Không thống nhất được phương án tài chính'),

    -- Từ 'site_visit'
    ('site_visit', 'considering', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Cân nhắc vị trí căn sau chuyến đi'),
    ('site_visit', 'booking', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Booking giữ chỗ ngay tại nhà mẫu'),
    ('site_visit', 'deposit', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Ráp căn và vào cọc nóng tại thực địa'),
    ('site_visit', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách không thích vị trí thực tế'),

    -- Từ 'considering'
    ('considering', 'booking', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Quyết định chuyển tiền Booking giữ chỗ'),
    ('considering', 'deposit', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Quyết định chốt cọc căn hộ'),
    ('considering', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Khách quyết định mua dự án đối thủ'),

    -- Từ 'booking' (ĐÃ CÓ GIAO DỊCH BOOKING)
    ('booking', 'deposit', true, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Chuyển từ Booking sang Đặt cọc chính thức'),
    ('booking', 'lost', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Hoàn tiền Booking / Không chọn được căn ưng ý'),

    -- Từ 'deposit' (ĐÃ ĐẶT CỌC)
    ('deposit', 'contract', true, '["admin", "director", "sales_manager", "team_leader"]'::jsonb, 'Tiến hành Ký HĐMB chính thức với Chủ đầu tư'),
    ('deposit', 'lost', false, '["admin", "director", "sales_manager"]'::jsonb, 'Khách bỏ cọc / Bồi hoàn cọc theo thỏa thuận'),

    -- Từ 'contract' (ĐÃ KÝ HĐMB)
    ('contract', 'after_sales', false, '["admin", "director", "sales_manager", "team_leader", "sale_agent"]'::jsonb, 'Chuyển sang giai đoạn chăm sóc sau bán & hỗ trợ bàn giao nhà'),
    ('contract', 'lost', false, '["admin", "director"]'::jsonb, 'Hủy HĐMB / Chuyển nhượng ngoại lệ'),

    -- Từ 'after_sales'
    ('after_sales', 'lost', false, '["admin", "director"]'::jsonb, 'Đóng hồ sơ khách hàng'),

    -- Mở lại Lead đã đóng (Re-open) - Chỉ dành cho Quản lý & Admin
    ('invalid', 'qualifying', false, '["admin", "director", "sales_manager", "team_leader"]'::jsonb, 'Kích hoạt lại lead sai số/không liên lạc được'),
    ('lost', 'qualifying', false, '["admin", "director", "sales_manager", "team_leader"]'::jsonb, 'Khách hàng liên hệ lại sau khi đã đóng hồ sơ')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- 2. TẠO CÁC INDEX CHỐNG BÁN TRÙNG & TRÙNG MÃ GIAO DỊCH
-- Unique partial index: Không cho phép 2 giao dịch Booking/Cọc/HĐMB cùng hiệu lực trên 1 căn hộ của cùng dự án
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_unit_transaction 
ON transactions (project_id, LOWER(TRIM(unit_code))) 
WHERE status IN ('confirmed', 'pending') 
  AND type IN ('booking', 'deposit', 'contract')
  AND unit_code IS NOT NULL 
  AND TRIM(unit_code) != '';

-- Unique index trên mã phiếu thu / mã giao dịch
CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_code 
ON transactions (code) 
WHERE code IS NOT NULL AND TRIM(code) != '';

-- Unique partial index trên mã số hợp đồng mua bán (HĐMB)
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_code 
ON transactions (contract_code) 
WHERE contract_code IS NOT NULL AND TRIM(contract_code) != '';

-- 3. HÀM ATOMIC RPC SECURITY DEFINER: change_lead_status
-- Cưỡng chế ma trận, kiểm tra tài chính, chống bán trùng căn, cập nhật SLA và audit logs trong 1 Transaction
CREATE OR REPLACE FUNCTION change_lead_status(
    p_lead_id UUID,
    p_to_status VARCHAR,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_user_id UUID := auth.uid();
    v_user_role VARCHAR;
    v_lead RECORD;
    v_transition RECORD;
    v_amount NUMERIC;
    v_receipt_code VARCHAR;
    v_unit_code VARCHAR;
    v_contract_code VARCHAR;
    v_deal_value NUMERIC;
    v_unit_conflict BOOLEAN := false;
    v_new_tx_id UUID;
    v_new_deadline TIMESTAMPTZ;
    v_is_stop_clock BOOLEAN := false;
BEGIN
    -- 1. Xác định người dùng & vai trò
    IF v_current_user_id IS NULL THEN
        -- Cho phép truyền user_id qua payload nếu gọi trong bối cảnh service_role/internal test
        IF p_payload ? 'user_id' THEN
            v_current_user_id := (p_payload->>'user_id')::uuid;
            SELECT role INTO v_user_role FROM profiles WHERE id = v_current_user_id;
        END IF;

        IF v_user_role IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Thao tác yêu cầu phiên đăng nhập hợp lệ.';
        END IF;
    ELSE
        SELECT role INTO v_user_role FROM profiles WHERE id = v_current_user_id;
        IF v_user_role IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Không tìm thấy hồ sơ người dùng.';
        END IF;
    END IF;

    -- 2. Khóa dòng Lead bằng FOR UPDATE để chống Race Condition
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy Lead với ID %', p_lead_id;
    END IF;

    -- Nếu trạng thái đích trùng trạng thái hiện tại, trả về thành công không cần đổi
    IF v_lead.status = p_to_status THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Trạng thái không thay đổi', 
            'lead_id', p_lead_id, 
            'status', p_to_status
        );
    END IF;

    -- 3. Kiểm tra ma trận chuyển đổi hợp lệ
    SELECT * INTO v_transition 
    FROM lead_status_transitions 
    WHERE from_status = v_lead.status AND to_status = p_to_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quy trình không hợp lệ: Không được phép chuyển từ trạng thái "%" sang "%"', v_lead.status, p_to_status;
    END IF;

    -- Kiểm tra quyền theo vai trò (allowed_roles)
    IF v_user_role != 'admin' AND NOT (v_transition.allowed_roles ? v_user_role) THEN
        RAISE EXCEPTION 'Từ chối thao tác: Vai trò "%" không có quyền chuyển Lead từ "%" sang "%"', v_user_role, v_lead.status, p_to_status;
    END IF;

    -- Kiểm tra phạm vi phân quyền sở hữu nếu là sale_agent
    IF v_user_role = 'sale_agent' AND v_lead.assigned_to != v_current_user_id THEN
        RAISE EXCEPTION 'Từ chối thao tác: Chuyên viên tư vấn chỉ được cập nhật trạng thái Lead được giao cho chính mình.';
    END IF;

    -- 4. Cưỡng chế ràng buộc tài chính bắt buộc (Financial Milestones)
    IF v_transition.requires_financial OR p_to_status IN ('booking', 'deposit', 'contract') THEN
        v_amount := COALESCE((p_payload->>'amount')::numeric, (p_payload->>'deal_value')::numeric, 0);
        v_deal_value := COALESCE((p_payload->>'deal_value')::numeric, (p_payload->>'amount')::numeric, v_amount);
        v_receipt_code := TRIM(COALESCE(p_payload->>'receipt_code', p_payload->>'code', p_payload->>'tx_code', ''));
        v_unit_code := TRIM(COALESCE(p_payload->>'unit_code', ''));
        v_contract_code := TRIM(COALESCE(p_payload->>'contract_code', ''));

        -- Kiểm tra mã phiếu thu / mã Booking
        IF p_to_status = 'booking' AND v_receipt_code = '' THEN
            RAISE EXCEPTION 'Mã Booking là bắt buộc khi chuyển sang trạng thái Booking giữ chỗ!';
        END IF;

        -- Kiểm tra số tiền cho giao dịch tài chính (deposit & contract bắt buộc > 0)
        IF p_to_status IN ('deposit', 'contract') AND v_amount <= 0 THEN
            RAISE EXCEPTION 'Số tiền đặt cọc hợp lệ (> 0) là bắt buộc khi chuyển sang trạng thái Đặt cọc / Hợp đồng!';
        END IF;

        -- Kiểm tra mã hợp đồng HĐMB khi ký hợp đồng
        IF p_to_status = 'contract' AND v_contract_code = '' THEN
            RAISE EXCEPTION 'Mã hợp đồng (HĐMB) là bắt buộc khi chuyển sang trạng thái Ký HĐMB!';
        END IF;

        -- Kiểm tra mã căn hộ / sản phẩm
        IF v_unit_code = '' THEN
            RAISE EXCEPTION 'Mã căn hộ / sản phẩm không được để trống khi thực hiện giao dịch tài chính!';
        END IF;

        -- Kiểm tra xung đột căn (Chống bán trùng / cọc trùng căn trong cùng dự án)
        IF v_lead.project_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.project_id = v_lead.project_id 
                  AND LOWER(TRIM(t.unit_code)) = LOWER(v_unit_code)
                  AND t.status IN ('confirmed', 'pending')
                  AND t.type IN ('booking', 'deposit', 'contract')
                  AND t.lead_id != p_lead_id
            ) INTO v_unit_conflict;

            IF v_unit_conflict THEN
                RAISE EXCEPTION 'Xung đột giỏ hàng: Căn "%" đã có hợp đồng/giao dịch hiệu lực từ trước trong dự án!', v_unit_code;
            END IF;
        END IF;

        -- Tạo bản ghi transaction trong cùng Transaction Database
        INSERT INTO transactions (
            id,
            lead_id,
            project_id,
            type,
            code,
            contract_code,
            unit_code,
            amount,
            deal_value,
            commission_amount,
            sale_commission_rate,
            sale_commission_amount,
            deposit_date,
            contract_date,
            first_installment_amount,
            first_installment_date,
            first_installment_paid,
            status,
            notes,
            created_by,
            created_at
        ) VALUES (
            uuid_generate_v4(),
            p_lead_id,
            v_lead.project_id,
            p_to_status::varchar,
            COALESCE(NULLIF(v_receipt_code, ''), 'TX-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 6)),
            NULLIF(v_contract_code, ''),
            v_unit_code,
            v_amount,
            v_deal_value,
            COALESCE((p_payload->>'commission_amount')::numeric, round(v_deal_value * 0.035)),
            COALESCE((p_payload->>'sale_commission_rate')::numeric, 1.5),
            COALESCE((p_payload->>'sale_commission_amount')::numeric, round(v_deal_value * 0.015)),
            COALESCE((p_payload->>'deposit_date')::timestamptz, NOW()),
            COALESCE((p_payload->>'contract_date')::timestamptz, NOW()),
            COALESCE((p_payload->>'first_installment_amount')::numeric, round(v_deal_value * 0.1)),
            COALESCE((p_payload->>'first_installment_date')::timestamptz, NOW() + INTERVAL '15 days'),
            COALESCE((p_payload->>'first_installment_paid')::boolean, false),
            'confirmed',
            COALESCE(p_payload->>'notes', 'Giao dịch khởi tạo qua RPC change_lead_status'),
            v_current_user_id,
            NOW()
        ) RETURNING id INTO v_new_tx_id;
    END IF;

    -- 5. Tính toán đồng hồ SLA 24h
    v_is_stop_clock := p_to_status IN ('appointment_set', 'consulted', 'site_visit', 'considering', 'booking', 'deposit', 'contract', 'after_sales', 'lost', 'invalid');
    IF v_is_stop_clock THEN
        v_new_deadline := NULL;
    ELSE
        v_new_deadline := NOW() + INTERVAL '24 hours';
    END IF;

    -- Đặt cờ session để trigger kiểm tra không chặn câu lệnh UPDATE nội bộ này
    PERFORM set_config('crm.in_rpc_status_change', 'true', true);

    -- 6. Cập nhật bảng LEADS
    UPDATE leads
    SET status = p_to_status,
        last_care_updated_at = NOW(),
        care_deadline_at = v_new_deadline,
        notes = COALESCE(p_payload->>'notes', notes),
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- 7. Ghi AUDIT LOGS
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        ip_address
    ) VALUES (
        v_current_user_id,
        'change_lead_status',
        'leads',
        p_lead_id,
        jsonb_build_object('old_status', v_lead.status, 'assigned_to', v_lead.assigned_to),
        jsonb_build_object('new_status', p_to_status, 'transaction_id', v_new_tx_id, 'payload', p_payload),
        COALESCE(p_payload->>'ip_address', '127.0.0.1')
    );

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', p_lead_id,
        'old_status', v_lead.status,
        'new_status', p_to_status,
        'transaction_id', v_new_tx_id,
        'care_deadline_at', v_new_deadline
    );
END;
$$;

-- 4. TRIGGER CHỐNG CẬP NHẬT TRỰC TIẾP CỘT STATUS QUA CLIENT SDK
CREATE OR REPLACE FUNCTION trg_check_direct_lead_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Nếu trạng thái thay đổi
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Kiểm tra xem có đang thực thi qua RPC change_lead_status hay không
        IF current_setting('crm.in_rpc_status_change', true) IS DISTINCT FROM 'true' THEN
            -- Cho phép superuser / admin bảo trì nếu cần, chặn toàn bộ authenticated roles thông thường
            IF current_user NOT IN ('postgres', 'supabase_admin') AND COALESCE(current_role(), '') != 'admin' THEN
                RAISE EXCEPTION 'Bảo mật nghiêm ngặt: Không được phép UPDATE trực tiếp cột status của bảng leads. Thao tác bắt buộc phải thông qua RPC change_lead_status().';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn trigger trước khi UPDATE trên leads
DROP TRIGGER IF EXISTS trg_prevent_direct_status_update ON leads;
CREATE TRIGGER trg_prevent_direct_status_update
    BEFORE UPDATE OF status ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trg_check_direct_lead_status_update();
