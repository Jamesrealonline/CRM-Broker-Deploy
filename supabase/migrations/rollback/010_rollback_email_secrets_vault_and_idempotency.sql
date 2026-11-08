-- ========================================================
-- REAL ESTATE CRM - ROLLBACK MIGRATION 010
-- Rollback Giai đoạn P0.3: Secrets protection, email idempotency & audit
-- ========================================================

-- 1. Xóa hàm get_masked_email_config
DROP FUNCTION IF EXISTS get_masked_email_config();

-- 2. Xóa index trên notification_logs nếu có
DROP INDEX IF EXISTS uq_notification_logs_idempotency_key;

-- 3. Xóa bảng email_idempotency
DROP TABLE IF EXISTS email_idempotency CASCADE;
