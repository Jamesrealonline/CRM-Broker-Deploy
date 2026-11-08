-- ========================================================
-- ROLLBACK SCRIPT FOR MIGRATION 012
-- ========================================================

DROP FUNCTION IF EXISTS verify_2fa_login(UUID, TEXT);
DROP TRIGGER IF EXISTS trg_audit_impersonation_check ON audit_logs;
DROP FUNCTION IF EXISTS record_impersonation_in_audit();

DROP TABLE IF EXISTS impersonation_sessions CASCADE;

ALTER TABLE profiles
DROP COLUMN IF EXISTS two_factor_required,
DROP COLUMN IF EXISTS encrypted_totp_secret,
DROP COLUMN IF EXISTS backup_codes,
DROP COLUMN IF EXISTS two_factor_verified_at,
DROP COLUMN IF EXISTS session_expires_at;

ALTER TABLE audit_logs
DROP COLUMN IF EXISTS actor_id,
DROP COLUMN IF EXISTS effective_role;
