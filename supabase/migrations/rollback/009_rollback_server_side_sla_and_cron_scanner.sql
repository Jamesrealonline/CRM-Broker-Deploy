-- ========================================================
-- REAL ESTATE CRM - ROLLBACK MIGRATION 009
-- Rollback Giai đoạn P0.2: Server-side SLA Scanner & Transactional Outbox
-- ========================================================

-- 1. Hủy Cron job pg_cron nếu tồn tại
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('crm_lead_auto_transfer_cron');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 2. Xóa RPC scan_and_transfer_overdue_leads
DROP FUNCTION IF EXISTS scan_and_transfer_overdue_leads(BOOLEAN);

-- 3. Xóa bảng outbox và indexes
DROP TABLE IF EXISTS outbox CASCADE;
