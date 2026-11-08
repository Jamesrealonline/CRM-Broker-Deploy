-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 010: SECRETS PROTECTION, EMAIL IDEMPOTENCY & AUDIT
-- Giai đoạn P0.3: Bảo vệ secret & unique idempotency cho kênh email
-- ========================================================

-- 1. BẢNG EMAIL IDEMPOTENCY VỚI UNIQUE CONSTRAINT
CREATE TABLE IF NOT EXISTS email_idempotency (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'sent',
    payload_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_email_idempotency_key UNIQUE (idempotency_key)
);

-- Bật RLS cho email_idempotency
ALTER TABLE email_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_idempotency_select_policy" ON email_idempotency
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "email_idempotency_insert_policy" ON email_idempotency
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Index tra cứu idempotency theo thời gian để dọn dẹp (retention)
CREATE INDEX IF NOT EXISTS idx_email_idempotency_created 
ON email_idempotency (created_at);

-- 2. UNIQUE PARTIAL INDEX TRÊN NOTIFICATION_LOGS (NẾU CÓ CỘT IDEMPOTENCY_KEY)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_logs' AND column_name = 'idempotency_key'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_logs_idempotency_key
        ON notification_logs (idempotency_key)
        WHERE idempotency_key IS NOT NULL AND TRIM(idempotency_key) != '';
    END IF;
END $$;

-- 3. HÀM CHE SECRET TRONG SYSTEM_SETTINGS CHO CLIENT (MASKING RPC)
-- Đảm bảo khi UI truy vấn cấu hình email, các key nhạy cảm luôn được che (••••)
CREATE OR REPLACE FUNCTION get_masked_email_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_val JSONB;
    v_smtp_pass TEXT;
    v_resend_key TEXT;
BEGIN
    SELECT value INTO v_val 
    FROM system_settings 
    WHERE key = 'email_notification_config';

    IF v_val IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    -- Che mật khẩu SMTP
    v_smtp_pass := v_val->>'smtp_pass';
    IF v_smtp_pass IS NOT NULL AND TRIM(v_smtp_pass) != '' THEN
        v_val := jsonb_set(v_val, '{smtp_pass}', '"••••••••••••••••"'::jsonb);
        v_val := jsonb_set(v_val, '{has_smtp_pass}', 'true'::jsonb);
    ELSE
        v_val := jsonb_set(v_val, '{has_smtp_pass}', 'false'::jsonb);
    END IF;

    -- Che Resend API key
    v_resend_key := v_val->>'resend_api_key';
    IF v_resend_key IS NOT NULL AND TRIM(v_resend_key) != '' THEN
        v_val := jsonb_set(v_val, '{resend_api_key}', '"re_••••••••••••••••"'::jsonb);
        v_val := jsonb_set(v_val, '{has_resend_key}', 'true'::jsonb);
    ELSE
        v_val := jsonb_set(v_val, '{has_resend_key}', 'false'::jsonb);
    END IF;

    RETURN v_val;
END;
$$;
