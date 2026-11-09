-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 026: ADMIN & DIRECTOR FULL ACCESS, UNMASKED PII,
-- EMPLOYMENT TYPES & 10 SAMPLE LEADS SEED
-- ========================================================

-- 1. BỔ SUNG CỘT EMPLOYMENT_TYPE VÀ IS_SAMPLE
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'official',
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;

DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_employment_type_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_employment_type_check 
        CHECK (employment_type IN ('official', 'probation', 'collaborator', 'intern', 'other'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.employee_records DROP CONSTRAINT IF EXISTS employee_records_employment_type_check;
    ALTER TABLE public.employee_records ADD CONSTRAINT employee_records_employment_type_check 
        CHECK (employment_type IN ('official', 'probation', 'collaborator', 'intern', 'other'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_is_sample ON public.leads(is_sample);
CREATE INDEX IF NOT EXISTS idx_customers_is_sample ON public.customers(is_sample);
CREATE INDEX IF NOT EXISTS idx_transactions_is_sample ON public.transactions(is_sample);

-- 2. CẤU HÌNH DIRECTOR GLOBAL SCOPE TRONG SYSTEM_SETTINGS
INSERT INTO public.system_settings (id, key, value, description)
VALUES (
    gen_random_uuid(),
    'director_global_scope',
    '{"enabled": false}'::jsonb,
    'Cho phép Giám đốc Sàn (Director) thao tác toàn hệ thống như Admin'
)
ON CONFLICT (key) DO NOTHING;

-- 3. HÀM ATOMIC RPC TRA CỨU PII ĐẦY ĐỦ CHO ADMIN & GIÁM ĐỐC SÀN
-- Bỏ che mờ, không giới hạn lượt xem, không bắt nhập lý do, ghi audit log nền
CREATE OR REPLACE FUNCTION public.get_unmasked_customer_pii(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller RECORD;
    v_customer RECORD;
    v_decrypted_cccd TEXT;
    v_global_scope_enabled BOOLEAN := false;
    v_has_access BOOLEAN := false;
    v_encryption_key TEXT := 'crm-broker-vault-secret-key-2026';
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'unauthorized: Yêu cầu đăng nhập hợp lệ.';
    END IF;

    SELECT id, role, agency_id INTO v_caller 
    FROM public.profiles 
    WHERE id = v_caller_id;

    IF v_caller.role IS NULL THEN
        RAISE EXCEPTION 'unauthorized: Không tìm thấy hồ sơ người dùng.';
    END IF;

    -- Kiểm tra cờ director_global_scope
    SELECT COALESCE((value->>'enabled')::boolean, false) INTO v_global_scope_enabled
    FROM public.system_settings
    WHERE key = 'director_global_scope';

    -- Phân quyền: Admin có toàn quyền; Giám đốc Sàn có quyền trong sàn (hoặc toàn cục nếu cờ bật)
    IF v_caller.role = 'admin' THEN
        v_has_access := true;
    ELSIF v_caller.role = 'director' THEN
        IF v_global_scope_enabled THEN
            v_has_access := true;
        ELSE
            -- Kiểm tra khách hàng có lead nào thuộc agency của Director không
            SELECT EXISTS (
                SELECT 1 FROM public.leads l
                WHERE l.customer_id = p_customer_id 
                  AND l.agency_id = v_caller.agency_id
            ) INTO v_has_access;
        END IF;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'forbidden: Chỉ Quản trị viên (Admin) hoặc Giám đốc Sàn trong phạm vi mới có quyền xem thông tin PII đầy đủ.';
    END IF;

    SELECT id, full_name, phone, phone_normalized, COALESCE(id_number, identity_card) AS id_num, 
           encrypted_id_number, email, address
    INTO v_customer
    FROM public.customers
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found: Không tìm thấy khách hàng.';
    END IF;

    -- Giải mã CCCD nếu có
    IF v_customer.encrypted_id_number IS NOT NULL THEN
        BEGIN
            v_decrypted_cccd := pgp_sym_decrypt(v_customer.encrypted_id_number, v_encryption_key);
        EXCEPTION WHEN OTHERS THEN
            v_decrypted_cccd := v_customer.id_num;
        END;
    ELSE
        v_decrypted_cccd := v_customer.id_num;
    END IF;

    -- Ghi audit log nền nhẹ nhàng không chặn luồng
    INSERT INTO public.audit_logs (
        user_id,
        actor_id,
        action,
        entity_name,
        entity_id,
        details,
        ip_address
    ) VALUES (
        v_caller_id,
        v_caller_id,
        'unmasked_pii_view',
        'customers',
        p_customer_id,
        jsonb_build_object(
            'customer_name', v_customer.full_name,
            'caller_role', v_caller.role,
            'timestamp', NOW()
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', p_customer_id,
        'full_name', v_customer.full_name,
        'phone', COALESCE(v_customer.phone_normalized, v_customer.phone),
        'identity_card', v_decrypted_cccd,
        'email', v_customer.email,
        'address', v_customer.address
    );
END;
$$;

-- 4. HÀM ATOMIC RPC XÓA TOÀN BỘ DỮ LIỆU MẪU (PURGE SAMPLE DATA)
-- Chỉ xóa đúng các bản ghi có is_sample = true, tuyệt đối không ảnh hưởng dữ liệu thật
CREATE OR REPLACE FUNCTION public.purge_sample_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role VARCHAR;
    v_deleted_txs INT := 0;
    v_deleted_leads INT := 0;
    v_deleted_customers INT := 0;
    v_deleted_profiles INT := 0;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'forbidden: Chỉ Quản trị viên (Admin) mới có quyền thực hiện xóa dữ liệu mẫu.';
    END IF;

    -- 1. Xóa giao dịch mẫu
    DELETE FROM public.transactions WHERE is_sample = true;
    GET DIAGNOSTICS v_deleted_txs = ROW_COUNT;

    -- 2. Xóa leads mẫu
    DELETE FROM public.leads WHERE is_sample = true;
    GET DIAGNOSTICS v_deleted_leads = ROW_COUNT;

    -- 3. Xóa khách hàng mẫu
    DELETE FROM public.customers WHERE is_sample = true;
    GET DIAGNOSTICS v_deleted_customers = ROW_COUNT;

    -- 4. Xóa nhân sự mẫu nếu có
    DELETE FROM public.profiles WHERE is_sample = true;
    GET DIAGNOSTICS v_deleted_profiles = ROW_COUNT;

    -- Ghi audit log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        details
    ) VALUES (
        v_caller_id,
        'purge_sample_data',
        'system',
        jsonb_build_object(
            'deleted_transactions', v_deleted_txs,
            'deleted_leads', v_deleted_leads,
            'deleted_customers', v_deleted_customers,
            'deleted_profiles', v_deleted_profiles,
            'purged_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'deleted_transactions', v_deleted_txs,
        'deleted_leads', v_deleted_leads,
        'deleted_customers', v_deleted_customers,
        'deleted_profiles', v_deleted_profiles
    );
END;
$$;

-- 5. HÀM ATOMIC RPC SEED ĐÚNG 10 LEAD MẪU (IDEMPOTENT)
CREATE OR REPLACE FUNCTION public.seed_sample_leads_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_sample_count INT;
    v_project_id UUID;
    v_agency_id UUID;
    v_team_id UUID;
    v_sale_id UUID;
    v_org_id UUID;
    v_cust_id UUID;
    v_lead_id UUID;
    v_sample_source_fb UUID;
    v_sample_source_tiktok UUID;
    v_sample_source_zalo UUID;
    v_sample_source_intro UUID;
    v_sample_source_hotline UUID;
    v_sample_source_walkin UUID;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT COUNT(*) INTO v_existing_sample_count
    FROM public.leads 
    WHERE is_sample = true;

    IF v_existing_sample_count >= 10 THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Dữ liệu mẫu đã tồn tại đủ 10 leads, không tạo trùng lặp.',
            'lead_count', v_existing_sample_count
        );
    END IF;

    -- Lấy thông tin ngữ cảnh hệ thống
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
    SELECT id INTO v_project_id FROM public.projects LIMIT 1;
    SELECT id INTO v_agency_id FROM public.agencies LIMIT 1;
    SELECT id INTO v_team_id FROM public.teams LIMIT 1;
    SELECT id INTO v_sale_id FROM public.profiles WHERE role = 'sale_agent' LIMIT 1;

    -- Lấy các ID nguồn lead chuẩn
    SELECT id INTO v_sample_source_fb FROM public.lead_sources WHERE code = 'facebook_ads' LIMIT 1;
    SELECT id INTO v_sample_source_tiktok FROM public.lead_sources WHERE code = 'tiktok_ads' LIMIT 1;
    SELECT id INTO v_sample_source_zalo FROM public.lead_sources WHERE code = 'zalo' LIMIT 1;
    SELECT id INTO v_sample_source_intro FROM public.lead_sources WHERE code = 'gioi_thieu' LIMIT 1;
    SELECT id INTO v_sample_source_hotline FROM public.lead_sources WHERE code = 'hotline' LIMIT 1;
    SELECT id INTO v_sample_source_walkin FROM public.lead_sources WHERE code = 'walk_in' LIMIT 1;

    -- SEED 10 LEADS MẪU TRẢI ĐỀU CÁC GIAI ĐOẠN & NGUỒN KHÁCH
    -- Lead 1: Ký HĐMB (Kèm hợp đồng mẫu)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Trần Minh Đức (Mẫu)', '0900000001', '0900000001', 'duc.tran.sample@crm-broker.vn', '001090000001', '12 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM', true, true, v_now - INTERVAL '45 days');

    v_lead_id := gen_random_uuid();
    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (v_lead_id, v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_fb, 'contract', 100, 'investment', 'Khách hàng mẫu đã ký HĐMB căn A1-12.01', true, 'sample_seed', v_now - INTERVAL '45 days');

    INSERT INTO public.transactions (id, lead_id, project_id, type, code, contract_code, unit_code, amount, deal_value, commission_amount, sale_commission_rate, sale_commission_amount, status, approval_status, is_sample, created_at)
    VALUES (gen_random_uuid(), v_lead_id, v_project_id, 'contract', 'PT-SAMPLE-01', 'HDMB-SAMPLE-01', 'A1-12.01', 3500000000, 3500000000, 122500000, 1.5, 52500000, 'confirmed', 'approved', true, v_now - INTERVAL '40 days');

    -- Lead 2: Đặt cọc
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Lê Thị Thu Thảo (Mẫu)', '0900000002', '0900000002', 'thao.le.sample@crm-broker.vn', '001090000002', '88 Lê Lợi, P. Bến Thành, Q.1, TP.HCM', true, true, v_now - INTERVAL '30 days');

    v_lead_id := gen_random_uuid();
    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (v_lead_id, v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_tiktok, 'deposit', 90, 'residence', 'Khách hàng mẫu đã đặt cọc 100 triệu căn B2-05.08', true, 'sample_seed', v_now - INTERVAL '30 days');

    INSERT INTO public.transactions (id, lead_id, project_id, type, code, contract_code, unit_code, amount, deal_value, commission_amount, sale_commission_rate, sale_commission_amount, status, approval_status, is_sample, created_at)
    VALUES (gen_random_uuid(), v_lead_id, v_project_id, 'deposit', 'DC-SAMPLE-02', 'COC-SAMPLE-02', 'B2-05.08', 100000000, 4200000000, 147000000, 1.5, 63000000, 'confirmed', 'approved', true, v_now - INTERVAL '28 days');

    -- Lead 3: Booking giữ chỗ
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Nguyễn Hoàng Nam (Mẫu)', '0900000003', '0900000003', 'nam.nguyen.sample@crm-broker.vn', '001090000003', '246 Võ Văn Kiệt, Q.1, TP.HCM', true, true, v_now - INTERVAL '20 days');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_zalo, 'booking', 80, 'both', 'Booking giữ chỗ ưu tiên số thứ tự 15', true, 'sample_seed', v_now - INTERVAL '20 days');

    -- Lead 4: Đi xem dự án (Site Visit)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Phạm Quốc Bảo (Mẫu)', '0900000004', '0900000004', 'bao.pham.sample@crm-broker.vn', '001090000004', '15 Mai Chí Thọ, P. An Phú, TP. Thủ Đức', true, true, v_now - INTERVAL '15 days');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_intro, 'site_visit', 75, 'residence', 'Đã dẫn khách đi xem thực tế công trường và nhà mẫu', true, 'sample_seed', v_now - INTERVAL '15 days');

    -- Lead 5: Đã gặp tư vấn (Consulted)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Vũ Thị Ngọc Ánh (Mẫu)', '0900000005', '0900000005', 'anh.vu.sample@crm-broker.vn', '001090000005', '350 Điện Biên Phủ, Q. Bình Thạnh', true, true, v_now - INTERVAL '12 days');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_hotline, 'consulted', 70, 'investment', 'Đã tư vấn bảng tính dòng tiền và chính sách vay ngân hàng 70%', true, 'sample_seed', v_now - INTERVAL '12 days');

    -- Lead 6: Đặt hẹn (Appointment Set)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Đỗ Mạnh Hùng (Mẫu)', '0900000006', '0900000006', 'hung.do.sample@crm-broker.vn', '001090000006', '124 Xô Viết Nghệ Tĩnh, Q. Bình Thạnh', true, true, v_now - INTERVAL '8 days');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_walkin, 'appointment_set', 65, 'residence', 'Hẹn gặp tại quán cafe Starbuck Thảo Điền cuối tuần này', true, 'sample_seed', v_now - INTERVAL '8 days');

    -- Lead 7: Gửi tài liệu (Doc Sent)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Bùi Tuyết Mai (Mẫu)', '0900000007', '0900000007', 'mai.bui.sample@crm-broker.vn', '001090000007', '18 Hai Bà Trưng, Q.3, TP.HCM', true, true, v_now - INTERVAL '6 days');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_fb, 'doc_sent', 60, 'residence', 'Đã gửi qua Zalo brochure và chính sách thanh toán sớm chiết khấu 8%', true, 'sample_seed', v_now - INTERVAL '6 days');

    -- Lead 8: Đang cân nhắc (Considering)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Hoàng Gia Huy (Mẫu)', '0900000008', '0900000008', 'huy.hoang.sample@crm-broker.vn', '001090000008', '45 Phan Đăng Lưu, Q. Phú Nhuận', true, true, v_now - INTERVAL '4 days');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_tiktok, 'considering', 55, 'investment', 'Đang so sánh dự án với phân khu lân cận', true, 'sample_seed', v_now - INTERVAL '4 days');

    -- Lead 9: Đã liên hệ (Contacted)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Dương Khắc Tiệp (Mẫu)', '0900000009', '0900000009', 'tiep.duong.sample@crm-broker.vn', '001090000009', '99 Nguyễn Văn Cừ, Q.5, TP.HCM', true, true, v_now - INTERVAL '2 days');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_zalo, 'contacted', 50, 'both', 'Khách nghe máy thiện chí, quan tâm căn 2 phòng ngủ', true, 'sample_seed', v_now - INTERVAL '2 days');

    -- Lead 10: Mới tiếp nhận (New)
    v_cust_id := gen_random_uuid();
    INSERT INTO public.customers (id, organization_id, full_name, phone, phone_normalized, email, identity_card, address, consent_obtained, is_sample, created_at)
    VALUES (v_cust_id, v_org_id, 'Hồ Khánh Linh (Mẫu)', '0900000010', '0900000010', 'linh.ho.sample@crm-broker.vn', '001090000010', '77 Nguyễn Thái Học, Q.1, TP.HCM', true, true, v_now - INTERVAL '4 hours');

    INSERT INTO public.leads (id, organization_id, customer_id, project_id, agency_id, team_id, assigned_to, source_id, status, lead_score, purpose, notes, is_sample, created_via, created_at)
    VALUES (gen_random_uuid(), v_org_id, v_cust_id, v_project_id, v_agency_id, v_team_id, v_sale_id, v_sample_source_fb, 'new', 50, 'residence', 'Lead mẫu mới đăng ký từ Form Facebook Ads', true, 'sample_seed', v_now - INTERVAL '4 hours');

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã khởi tạo thành công đúng 10 lead mẫu kèm khách hàng và hợp đồng.',
        'lead_count', 10
    );
END;
$$;
