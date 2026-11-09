-- ========================================================
-- ROLLBACK SCRIPT FOR MIGRATION 013
-- ========================================================

DROP FUNCTION IF EXISTS create_reversal_transaction(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS approve_contract_transaction(UUID, UUID);

DROP TRIGGER IF EXISTS trg_prevent_confirmed_tx_modification ON transactions;
DROP FUNCTION IF EXISTS prevent_confirmed_tx_modification();

DROP TRIGGER IF EXISTS trg_generate_audit_log_hash ON audit_logs;
DROP FUNCTION IF EXISTS generate_audit_log_hash();

DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON audit_logs;
DROP FUNCTION IF EXISTS prevent_audit_log_modification();

ALTER TABLE audit_logs
DROP COLUMN IF EXISTS prev_hash,
DROP COLUMN IF EXISTS current_hash;

ALTER TABLE transactions
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS approved_by,
DROP COLUMN IF EXISTS approved_at,
DROP COLUMN IF EXISTS approval_status,
DROP COLUMN IF EXISTS is_reversal,
DROP COLUMN IF EXISTS reversal_of_id,
DROP COLUMN IF EXISTS reversal_reason;
