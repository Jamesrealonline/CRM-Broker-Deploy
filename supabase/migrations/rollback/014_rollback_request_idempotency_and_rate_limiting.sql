-- ========================================================
-- ROLLBACK SCRIPT FOR MIGRATION 014
-- ========================================================

DROP FUNCTION IF EXISTS complete_idempotent_request(TEXT, TEXT, INT, JSONB);
DROP FUNCTION IF EXISTS check_or_start_idempotency(TEXT, TEXT, TEXT, UUID);
DROP TABLE IF EXISTS request_idempotency CASCADE;
