-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 014: REQUEST IDEMPOTENCY & SERVER RATE LIMITING
-- Giai đoạn P1.3: Bảo vệ toàn diện Idempotency và Rate Limit cho API
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. BẢNG REQUEST_IDEMPOTENCY TOÀN DIỆN
CREATE TABLE IF NOT EXISTS request_idempotency (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint VARCHAR(100) NOT NULL,
    request_hash VARCHAR(64) NOT NULL, -- SHA-256 của request payload
    status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed
    response_code INT,
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    CONSTRAINT uq_idempotency_key_endpoint UNIQUE (idempotency_key, endpoint)
);

ALTER TABLE request_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request_idempotency_authenticated" ON request_idempotency
    FOR ALL TO authenticated
    USING (user_id = auth.uid() OR auth.uid() IS NULL)
    WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);

CREATE INDEX IF NOT EXISTS idx_request_idempotency_lookup 
ON request_idempotency (idempotency_key, endpoint, expires_at);

-- 2. HÀM ATOMIC RPC ĐỂ KIỂM TRA & GHI NHẬN IDEMPOTENCY TRƯỚC KHI THỰC HIỆN
CREATE OR REPLACE FUNCTION check_or_start_idempotency(
    p_idempotency_key TEXT,
    p_endpoint TEXT,
    p_request_hash TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record RECORD;
BEGIN
    -- Tìm bản ghi idempotency còn hạn
    SELECT * INTO v_record 
    FROM request_idempotency 
    WHERE idempotency_key = p_idempotency_key 
      AND endpoint = p_endpoint
      AND expires_at > NOW();

    IF FOUND THEN
        -- Nếu payload khác nhau -> phát hiện xung đột idempotency key
        IF v_record.request_hash != p_request_hash THEN
            RAISE EXCEPTION 'Idempotency Key conflict: Khóa "%" đã được sử dụng với nội dung yêu cầu khác.', p_idempotency_key;
        END IF;

        IF v_record.status = 'completed' THEN
            RETURN jsonb_build_object(
                'status', 'cached',
                'response_code', v_record.response_code,
                'response_body', v_record.response_body
            );
        ELSIF v_record.status = 'processing' THEN
            RAISE EXCEPTION 'Yêu cầu với khóa "%" đang được xử lý song song. Vui lòng chờ.', p_idempotency_key;
        END IF;
    END IF;

    -- Đăng ký khóa mới ở trạng thái 'processing'
    INSERT INTO request_idempotency (
        idempotency_key,
        endpoint,
        request_hash,
        user_id,
        status
    ) VALUES (
        p_idempotency_key,
        p_endpoint,
        p_request_hash,
        p_user_id,
        'processing'
    );

    RETURN jsonb_build_object('status', 'new');
END;
$$;

-- 3. HÀM HOÀN TẤT VÀ LƯU RESPONSE CHO IDEMPOTENCY KEY
CREATE OR REPLACE FUNCTION complete_idempotent_request(
    p_idempotency_key TEXT,
    p_endpoint TEXT,
    p_response_code INT,
    p_response_body JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE request_idempotency
    SET status = 'completed',
        response_code = p_response_code,
        response_body = p_response_body
    WHERE idempotency_key = p_idempotency_key
      AND endpoint = p_endpoint;
END;
$$;
