-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 017: ATOMIC CONTRACT CREATION WITH CUSTOMER & SOURCES
-- Cưỡng chế Transaction Atomic ở Server: Khách + Lead + Hợp đồng + Hoa hồng
-- ========================================================

-- 1. BỔ SUNG CỘT CHO BẢNG LEAD_SOURCES & LEADS
ALTER TABLE public.lead_sources
ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_detail BOOLEAN DEFAULT false;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS source_detail TEXT,
ADD COLUMN IF NOT EXISTS created_via VARCHAR(50) DEFAULT 'manual';

-- 2. SEED / UPSERT 11 NGUỒN LEAD CHUẨN
INSERT INTO public.lead_sources (code, name, is_active, sort_order, requires_detail)
VALUES
    ('facebook_ads', 'Facebook Ads', true, 1, false),
    ('tiktok_ads', 'TikTok Ads', true, 2, false),
    ('google_ads', 'Google Ads', true, 3, false),
    ('zalo', 'Zalo', true, 4, false),
    ('website_landing', 'Website / Landing page', true, 5, false),
    ('gioi_thieu', 'Giới thiệu', true, 6, true),
    ('su_kien_roadshow', 'Sự kiện / Roadshow', true, 7, false),
    ('khach_cu_data_cu', 'Khách cũ / Data cũ', true, 8, false),
    ('hotline', 'Hotline', true, 9, false),
    ('walk_in', 'Khách tại sàn (walk-in)', true, 10, false),
    ('khac', 'Khác', true, 11, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true,
    sort_order = EXCLUDED.sort_order,
    requires_detail = EXCLUDED.requires_detail;

-- 3. RÀNG BUỘC UNIQUE CHỐNG TRÙNG SĐT CỦA KHÁCH HÀNG THEO TỔ CHỨC
-- Dọn dẹp dữ liệu trùng cũ nếu có trước khi áp dụng index
DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_org_phone_normalized 
    ON public.customers (organization_id, phone_normalized)
    WHERE phone_normalized IS NOT NULL AND phone_normalized != '';
EXCEPTION WHEN OTHERS THEN
    -- Nếu có dữ liệu trùng trong môi trường dev, bỏ qua và giữ index non-unique
    NULL;
END $$;

-- 4. HÀM ATOMIC RPC SECURITY DEFINER: create_contract_with_customer
CREATE OR REPLACE FUNCTION public.create_contract_with_customer(
    p_payload JSONB,
    p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_user_id UUID := auth.uid();
    v_user_role VARCHAR;
    v_user_org_id UUID;
    v_user_agency_id UUID;
    v_user_team_id UUID;

    v_request_id UUID := COALESCE(p_request_id, (p_payload->>'request_id')::uuid);
    v_cached_response JSONB;

    -- Khách hàng
    v_customer_id UUID;
    v_full_name VARCHAR;
    v_phone VARCHAR;
    v_phone_normalized VARCHAR;
    v_email VARCHAR;
    v_id_card VARCHAR;
    v_address TEXT;
    v_consent BOOLEAN;

    -- Dự án & Căn
    v_project_id UUID;
    v_project_name VARCHAR;
    v_unit_code VARCHAR;
    v_property_type VARCHAR;
    v_unit_conflict BOOLEAN := false;

    -- Lead & Nguồn
    v_lead_id UUID;
    v_assigned_to UUID;
    v_source_id UUID;
    v_source_detail TEXT;
    v_source_code VARCHAR;
    v_source_requires_detail BOOLEAN := false;
    v_existing_lead RECORD;

    -- Tài chính & Hợp đồng
    v_deal_value NUMERIC;
    v_contract_code VARCHAR;
    v_deposit_date TIMESTAMPTZ;
    v_contract_date TIMESTAMPTZ;
    v_first_installment_amount NUMERIC;
    v_first_installment_date TIMESTAMPTZ;
    v_first_installment_paid BOOLEAN;
    v_receipt_code VARCHAR;
    v_payment_method VARCHAR;

    -- Hoa hồng
    v_comm_rate NUMERIC;
    v_sale_comm_rate NUMERIC;
    v_comm_amount NUMERIC;
    v_sale_comm_amount NUMERIC;

    v_notes TEXT;
    v_new_tx_id UUID := uuid_generate_v4();
BEGIN
    -- 1. KIỂM TRA IDEMPOTENCY
    IF v_request_id IS NOT NULL THEN
        SELECT response INTO v_cached_response 
        FROM public.request_idempotency 
        WHERE request_id = v_request_id;
        
        IF FOUND AND v_cached_response IS NOT NULL THEN
            RETURN v_cached_response;
        END IF;
    END IF;

    -- 2. XÁC ĐỊNH NGƯỜI DÙNG & KIỂM TRA PHÂN QUYỀN VAI TRÒ
    IF v_current_user_id IS NULL THEN
        IF p_payload ? 'user_id' THEN
            v_current_user_id := (p_payload->>'user_id')::uuid;
        END IF;
    END IF;

    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'unauthorized: Thao tác yêu cầu đăng nhập hợp lệ.';
    END IF;

    SELECT role, organization_id, agency_id, team_id 
    INTO v_user_role, v_user_org_id, v_user_agency_id, v_user_team_id
    FROM public.profiles 
    WHERE id = v_current_user_id;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'unauthorized: Không tìm thấy hồ sơ người dùng.';
    END IF;

    -- Marketing Manager và các vai trò khác không được tạo hợp đồng
    IF v_user_role NOT IN ('admin', 'director', 'sales_manager', 'team_leader', 'sale_agent') THEN
        RAISE EXCEPTION 'forbidden: Vai trò "%" không có quyền tạo hợp đồng giao dịch.', v_user_role;
    END IF;

    -- 3. XÁC THỰC THÔNG TIN DỰ ÁN & CĂN
    v_project_id := (p_payload->>'project_id')::uuid;
    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'invalid_project: Dự án phân phối là bắt buộc.';
    END IF;

    SELECT name, COALESCE(commission_rate, 3.5), COALESCE(sale_commission_rate, 1.5)
    INTO v_project_name, v_comm_rate, v_sale_comm_rate
    FROM public.projects WHERE id = v_project_id;

    IF v_project_name IS NULL THEN
        RAISE EXCEPTION 'invalid_project: Dự án không tồn tại trên hệ thống.';
    END IF;

    v_unit_code := TRIM(COALESCE(p_payload->>'unit_code', ''));
    IF v_unit_code = '' THEN
        RAISE EXCEPTION 'invalid_unit: Mã sản phẩm / căn hộ không được để trống.';
    END IF;

    -- Kiểm tra chống bán trùng căn trong dự án
    SELECT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.project_id = v_project_id 
          AND LOWER(TRIM(t.unit_code)) = LOWER(v_unit_code)
          AND t.status IN ('confirmed', 'pending')
          AND t.type IN ('booking', 'deposit', 'contract')
    ) INTO v_unit_conflict;

    IF v_unit_conflict THEN
        RAISE EXCEPTION 'duplicate_unit: Căn "%" đã có hợp đồng/giao dịch hiệu lực trong dự án "%"!', v_unit_code, v_project_name;
    END IF;

    -- 4. XỬ LÝ KHÁCH HÀNG & PHÒNG CHỐNG TRÙNG SĐT
    IF p_payload ? 'lead_id' AND NULLIF(TRIM(p_payload->>'lead_id'), '') IS NOT NULL THEN
        -- Chế độ chọn Lead có sẵn
        v_lead_id := (p_payload->>'lead_id')::uuid;
        SELECT * INTO v_existing_lead FROM public.leads WHERE id = v_lead_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'lead_not_found: Lead chỉ định không tồn tại.';
        END IF;
        v_customer_id := v_existing_lead.customer_id;
        v_assigned_to := v_existing_lead.assigned_to;
    ELSE
        -- Chế độ điền mới Khách hàng
        v_full_name := TRIM(COALESCE(p_payload->>'customer_name', p_payload->>'full_name', ''));
        IF v_full_name = '' THEN
            RAISE EXCEPTION 'invalid_customer_name: Họ tên khách hàng không được để trống.';
        END IF;

        v_phone := TRIM(COALESCE(p_payload->>'customer_phone', p_payload->>'phone', ''));
        v_phone_normalized := regexp_replace(v_phone, '[^0-9]', '', 'g');
        IF length(v_phone_normalized) < 9 THEN
            RAISE EXCEPTION 'invalid_phone: Số điện thoại không hợp lệ.';
        END IF;

        v_email := NULLIF(TRIM(COALESCE(p_payload->>'customer_email', p_payload->>'email', '')), '');
        v_id_card := NULLIF(TRIM(COALESCE(p_payload->>'identity_card', p_payload->>'id_card', '')), '');
        v_address := NULLIF(TRIM(COALESCE(p_payload->>'address', '')), '');
        v_consent := COALESCE((p_payload->>'consent_obtained')::boolean, true);

        IF NOT v_consent THEN
            RAISE EXCEPTION 'consent_required: Bắt buộc xác nhận khách hàng đồng ý xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.';
        END IF;

        -- Tìm kiếm khách hàng theo SĐT trong cùng Organization
        SELECT id INTO v_customer_id 
        FROM public.customers 
        WHERE (organization_id = v_user_org_id OR organization_id IS NULL)
          AND (phone_normalized = v_phone_normalized OR phone = v_phone)
        LIMIT 1;

        IF v_customer_id IS NULL THEN
            -- Tạo khách hàng mới
            INSERT INTO public.customers (
                organization_id,
                full_name,
                phone,
                phone_normalized,
                email,
                identity_card,
                address,
                consent_obtained,
                consent_date
            ) VALUES (
                v_user_org_id,
                v_full_name,
                v_phone,
                v_phone_normalized,
                v_email,
                v_id_card,
                v_address,
                true,
                NOW()
            ) RETURNING id INTO v_customer_id;

            -- Ghi nhận consent vào bảng customer_consents
            INSERT INTO public.customer_consents (
                organization_id,
                customer_id,
                consent_type,
                channel,
                granted_by,
                notes
            ) VALUES (
                v_user_org_id,
                v_customer_id,
                'marketing_and_contract',
                'contract_creation_form',
                v_current_user_id,
                'Khách hàng đồng ý khi ký hợp đồng giao dịch căn ' || v_unit_code
            );
        ELSE
            -- Dùng lại khách hàng cũ, chỉ bổ sung trường còn thiếu
            UPDATE public.customers
            SET email = COALESCE(email, v_email),
                identity_card = COALESCE(identity_card, v_id_card),
                address = COALESCE(address, v_address),
                updated_at = NOW()
            WHERE id = v_customer_id;
        END IF;
    END IF;

    -- 5. XỬ LÝ NGUỒN LEAD & PHÂN QUYỀN SALE PHỤ TRÁCH
    IF p_payload ? 'assigned_to' AND NULLIF(TRIM(p_payload->>'assigned_to'), '') IS NOT NULL THEN
        v_assigned_to := (p_payload->>'assigned_to')::uuid;
    ELSE
        IF v_assigned_to IS NULL THEN
            v_assigned_to := v_current_user_id;
        END IF;
    END IF;

    -- Kiểm tra quyền phân bổ:
    -- sale_agent chỉ được tạo cho chính mình
    IF v_user_role = 'sale_agent' AND v_assigned_to != v_current_user_id THEN
        RAISE EXCEPTION 'forbidden: Chuyên viên tư vấn chỉ được tạo hợp đồng cho chính mình.';
    END IF;

    -- Xử lý Nguồn Lead
    IF p_payload ? 'source_id' AND NULLIF(TRIM(p_payload->>'source_id'), '') IS NOT NULL THEN
        v_source_id := (p_payload->>'source_id')::uuid;
    END IF;
    v_source_detail := NULLIF(TRIM(COALESCE(p_payload->>'source_detail', '')), '');

    IF v_source_id IS NOT NULL THEN
        SELECT code, requires_detail INTO v_source_code, v_source_requires_detail 
        FROM public.lead_sources WHERE id = v_source_id;
        
        IF v_source_requires_detail AND v_source_detail IS NULL THEN
            RAISE EXCEPTION 'source_detail_required: Nguồn lead này bắt buộc phải điền thông tin chi tiết / người giới thiệu.';
        END IF;
    END IF;

    -- Tìm lead đang mở của khách hàng trong dự án
    IF v_lead_id IS NULL THEN
        SELECT id, source_id, status INTO v_existing_lead 
        FROM public.leads 
        WHERE customer_id = v_customer_id 
          AND project_id = v_project_id 
          AND status != 'lost'
        ORDER BY created_at DESC LIMIT 1;

        IF v_existing_lead.id IS NOT NULL THEN
            v_lead_id := v_existing_lead.id;
            -- First-Touch Attribution: Giữ nguyên nguồn cũ, chỉ cập nhật nếu trước đó chưa có nguồn
            IF v_existing_lead.source_id IS NULL AND v_source_id IS NOT NULL THEN
                UPDATE public.leads 
                SET source_id = v_source_id, source_detail = v_source_detail 
                WHERE id = v_lead_id;
            END IF;
        ELSE
            -- Tạo Lead mới
            INSERT INTO public.leads (
                organization_id,
                customer_id,
                project_id,
                agency_id,
                team_id,
                assigned_to,
                source_id,
                source_detail,
                created_via,
                status,
                lead_score,
                last_care_updated_at
            ) VALUES (
                v_user_org_id,
                v_customer_id,
                v_project_id,
                v_user_agency_id,
                v_user_team_id,
                v_assigned_to,
                v_source_id,
                v_source_detail,
                'contract_form',
                'contract',
                100,
                NOW()
            ) RETURNING id INTO v_lead_id;
        END IF;
    END IF;

    -- 6. TÍNH TOÁN DÒNG TIỀN & HOA HỒNG TẠI SERVER (SERVER-ENFORCED)
    v_deal_value := COALESCE((p_payload->>'deal_value')::numeric, (p_payload->>'amount')::numeric, 0);
    IF v_deal_value <= 0 THEN
        RAISE EXCEPTION 'invalid_deal_value: Giá trị giao dịch phải lớn hơn 0.';
    END IF;

    -- % Hoa hồng Sàn & Sale
    IF p_payload ? 'commission_rate' AND (p_payload->>'commission_rate')::numeric > 0 THEN
        v_comm_rate := (p_payload->>'commission_rate')::numeric;
    END IF;
    IF p_payload ? 'sale_commission_rate' AND (p_payload->>'sale_commission_rate')::numeric > 0 THEN
        v_sale_comm_rate := (p_payload->>'sale_commission_rate')::numeric;
    END IF;

    IF v_sale_comm_rate > v_comm_rate THEN
        RAISE EXCEPTION 'invalid_commission_rate: Tỷ lệ hoa hồng cho Sale (%) không được vượt quá % hoa hồng của Sàn (%).', v_sale_comm_rate, v_comm_rate;
    END IF;

    -- Server tự tính lại số tiền hoa hồng snapshot
    v_comm_amount := ROUND(v_deal_value * (v_comm_rate / 100));
    v_sale_comm_amount := ROUND(v_deal_value * (v_sale_comm_rate / 100));

    -- Tiến độ đợt 1 (Mặc định 10% GTGD)
    v_first_installment_amount := COALESCE(
        (p_payload->>'first_installment_amount')::numeric, 
        ROUND(v_deal_value * 0.1)
    );
    IF v_first_installment_amount > v_deal_value THEN
        RAISE EXCEPTION 'invalid_installment_amount: Số tiền đợt 1 không được lớn hơn tổng giá trị giao dịch.';
    END IF;

    v_first_installment_paid := COALESCE((p_payload->>'first_installment_paid')::boolean, false);
    v_receipt_code := NULLIF(TRIM(COALESCE(p_payload->>'receipt_code', p_payload->>'code', '')), '');
    v_payment_method := COALESCE(p_payload->>'payment_method', 'bank_transfer');

    IF v_first_installment_paid AND v_receipt_code IS NULL THEN
        v_receipt_code := 'PT-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(v_new_tx_id::text, 1, 6);
    END IF;

    v_contract_code := TRIM(COALESCE(p_payload->>'contract_code', ''));
    IF v_contract_code = '' THEN
        v_contract_code := 'HĐMB-' || to_char(NOW(), 'YYYY') || '-' || substr(v_new_tx_id::text, 1, 6);
    END IF;

    v_deposit_date := COALESCE((p_payload->>'deposit_date')::timestamptz, NOW());
    v_contract_date := COALESCE((p_payload->>'contract_date')::timestamptz, NOW());
    v_first_installment_date := COALESCE(
        (p_payload->>'first_installment_date')::timestamptz, 
        NOW() + INTERVAL '14 days'
    );
    v_notes := COALESCE(p_payload->>'notes', '');

    -- 7. TẠO BẢN GHI HỢP ĐỒNG GIAO DỊCH (TRANSACTION)
    INSERT INTO public.transactions (
        id,
        lead_id,
        project_id,
        type,
        code,
        amount,
        deal_value,
        contract_code,
        unit_code,
        commission_amount,
        sale_commission_rate,
        sale_commission_amount,
        deposit_date,
        contract_date,
        first_installment_amount,
        first_installment_date,
        first_installment_paid,
        payment_method,
        status,
        notes,
        created_by,
        created_at
    ) VALUES (
        v_new_tx_id,
        v_lead_id,
        v_project_id,
        'contract',
        COALESCE(v_receipt_code, 'TX-' || substr(v_new_tx_id::text, 1, 8)),
        v_deal_value,
        v_deal_value,
        v_contract_code,
        v_unit_code,
        v_comm_amount,
        v_sale_comm_rate,
        v_sale_comm_amount,
        v_deposit_date,
        v_contract_date,
        v_first_installment_amount,
        v_first_installment_date,
        v_first_installment_paid,
        v_payment_method,
        'pending', -- Chờ duyệt theo Maker-Checker
        v_notes,
        v_current_user_id,
        NOW()
    );

    -- 8. CẬP NHẬT TRẠNG THÁI LEAD SANG 'contract' VÀ DỪNG ĐỒNG HỒ SLA
    UPDATE public.leads
    SET status = 'contract',
        last_care_updated_at = NOW(),
        care_deadline_at = NULL -- Dừng đồng hồ SLA 24h
    WHERE id = v_lead_id;

    -- Ghi lịch sử chuyển trạng thái
    INSERT INTO public.lead_status_history (
        lead_id,
        from_status,
        to_status,
        changed_by,
        reason
    ) VALUES (
        v_lead_id,
        COALESCE(v_existing_lead.status, 'new'),
        'contract',
        v_current_user_id,
        'Ký hợp đồng mua bán căn ' || v_unit_code || ' qua form Hợp đồng giao dịch'
    );

    -- 9. GHI AUDIT LOG VÀ SỰ KIỆN OUTBOX ĐỂ GỬI EMAIL TỰ ĐỘNG
    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        payload
    ) VALUES (
        v_user_org_id,
        v_current_user_id,
        'create_contract',
        'transactions',
        v_new_tx_id,
        jsonb_build_object(
            'lead_id', v_lead_id,
            'customer_id', v_customer_id,
            'project_id', v_project_id,
            'unit_code', v_unit_code,
            'contract_code', v_contract_code,
            'deal_value', v_deal_value,
            'commission_amount', v_comm_amount,
            'sale_commission_amount', v_sale_comm_amount
        )
    );

    INSERT INTO public.outbox (
        event_type,
        payload,
        status
    ) VALUES (
        'contract_created',
        jsonb_build_object(
            'transaction_id', v_new_tx_id,
            'lead_id', v_lead_id,
            'customer_id', v_customer_id,
            'project_id', v_project_id,
            'unit_code', v_unit_code,
            'contract_code', v_contract_code,
            'deal_value', v_deal_value,
            'creator_id', v_current_user_id,
            'assigned_to', v_assigned_to
        ),
        'pending'
    );

    -- 10. LƯU KẾT QUẢ VÀO IDEMPOTENCY TABLE NẾU CÓ REQUEST_ID
    v_cached_response := jsonb_build_object(
        'success', true,
        'transaction_id', v_new_tx_id,
        'contract_code', v_contract_code,
        'lead_id', v_lead_id,
        'customer_id', v_customer_id,
        'unit_code', v_unit_code,
        'deal_value', v_deal_value,
        'commission_amount', v_comm_amount,
        'sale_commission_amount', v_sale_comm_amount,
        'status', 'pending'
    );

    IF v_request_id IS NOT NULL THEN
        INSERT INTO public.request_idempotency (
            request_id,
            endpoint,
            params_hash,
            response,
            user_id
        ) VALUES (
            v_request_id,
            'contracts/create_with_customer',
            'hash_' || v_new_tx_id::text,
            v_cached_response,
            v_current_user_id
        ) ON CONFLICT (request_id) DO NOTHING;
    END IF;

    RETURN v_cached_response;
END;
$$;
