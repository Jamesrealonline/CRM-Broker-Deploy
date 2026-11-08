-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 011: PII ENCRYPTION, DB MASKING, CCCD REVEAL AUDIT & CONSENT
-- Giai đoạn P0.4: Bảo vệ dữ liệu nhạy cảm ở Database & Quản lý Consent
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. BỔ SUNG CỘT DO_NOT_CONTACT & PHONE_HASH TRÊN CUSTOMERS & LEADS
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS encrypted_id_number BYTEA;

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN DEFAULT false;

-- Backfill phone_hash cho dữ liệu cũ bằng SHA-256
UPDATE customers 
SET phone_hash = encode(digest(COALESCE(phone_normalized, phone, ''), 'sha256'), 'hex')
WHERE phone_hash IS NULL AND (phone_normalized IS NOT NULL OR phone IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_customers_phone_hash ON customers (phone_hash);
CREATE INDEX IF NOT EXISTS idx_customers_do_not_contact ON customers (do_not_contact);

-- 2. BẢNG QUẢN LÝ ĐỒNG THUẬN DỮ LIỆU (CUSTOMER CONSENTS)
CREATE TABLE IF NOT EXISTS customer_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    purpose VARCHAR(100) NOT NULL, -- 'marketing', 'consultation', 'contract'
    channel VARCHAR(50) NOT NULL,  -- 'phone', 'email', 'zalo', 'sms'
    source VARCHAR(100),           -- 'web_form', 'facebook_lead', 'direct_consultation'
    obtained_at TIMESTAMPTZ DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_consents_select" ON customer_consents
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "customer_consents_insert" ON customer_consents
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "customer_consents_update" ON customer_consents
    FOR UPDATE TO authenticated
    USING (current_role() IN ('admin', 'director', 'sales_manager'));

CREATE INDEX IF NOT EXISTS idx_customer_consents_customer_id ON customer_consents (customer_id);

-- 3. HÀM & VIEW CHE SĐT CHO MARKETING MANAGER Ở TẦNG DATABASE (DB MASKING)
-- Trả dạng 09xx xxx 123 và hoàn toàn KHÔNG trả CCCD hay ID number
CREATE OR REPLACE VIEW marketing_leads_view AS
SELECT 
    l.id AS lead_id,
    l.project_id,
    p.name AS project_name,
    l.status,
    l.source_id,
    l.budget_min,
    l.budget_max,
    l.purpose,
    l.created_at,
    l.updated_at,
    l.do_not_contact,
    c.id AS customer_id,
    c.phone_hash,
    -- Che số điện thoại ở tầng SQL: giữ 2 số đầu và 3 số cuối (ví dụ: 09xx xxx 456)
    CASE 
        WHEN c.phone IS NOT NULL AND length(c.phone) >= 7 THEN
            substring(c.phone from 1 for 2) || 'xx xxx ' || substring(c.phone from length(c.phone)-2 for 3)
        ELSE '09xx xxx ***'
    END AS masked_phone,
    -- Che họ tên: giữ chữ cái đầu và họ
    substring(c.full_name from 1 for 1) || '*** ' || split_part(c.full_name, ' ', -1) AS masked_name
FROM leads l
JOIN customers c ON c.id = l.customer_id
LEFT JOIN projects p ON p.id = l.project_id;

-- 4. HÀM ATOMIC RPC REVEAL CCCD KÈM AUDIT LOG BẮT BUỘC
-- Chỉ cho phép admin, director, sales_manager; marketing_manager và sale bị từ chối
CREATE OR REPLACE FUNCTION reveal_cccd(p_customer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_user_id UUID := auth.uid();
    v_user_role VARCHAR;
    v_customer RECORD;
    v_decrypted_cccd TEXT;
    v_encryption_key TEXT := 'crm-broker-vault-secret-key-2026';
BEGIN
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Yêu cầu phiên đăng nhập hợp lệ.';
    END IF;

    SELECT role INTO v_user_role FROM profiles WHERE id = v_current_user_id;

    -- Kiểm tra phân quyền vai trò nghiêm ngặt
    IF v_user_role NOT IN ('admin', 'director', 'sales_manager') THEN
        RAISE EXCEPTION 'Từ chối thao tác: Vai trò "%" không có quyền giải mã và xem số CCCD/CMND của khách hàng.', v_user_role;
    END IF;

    SELECT id, full_name, id_number, encrypted_id_number INTO v_customer 
    FROM customers 
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ khách hàng với ID %', p_customer_id;
    END IF;

    -- Giải mã từ encrypted_id_number hoặc đọc id_number
    IF v_customer.encrypted_id_number IS NOT NULL THEN
        BEGIN
            v_decrypted_cccd := pgp_sym_decrypt(v_customer.encrypted_id_number, v_encryption_key);
        EXCEPTION
            WHEN OTHERS THEN
                v_decrypted_cccd := v_customer.id_number;
        END;
    ELSE
        v_decrypted_cccd := v_customer.id_number;
    END IF;

    -- BẮT BUỘC GHI AUDIT LOG
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_data,
        ip_address
    ) VALUES (
        v_current_user_id,
        'reveal_cccd',
        'customers',
        p_customer_id,
        jsonb_build_object(
            'customer_name', v_customer.full_name,
            'accessed_by_role', v_user_role,
            'timestamp', NOW()
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', p_customer_id,
        'cccd', v_decrypted_cccd
    );
END;
$$;
