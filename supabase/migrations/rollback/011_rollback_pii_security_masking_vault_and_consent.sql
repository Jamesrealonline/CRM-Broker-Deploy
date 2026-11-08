-- ========================================================
-- ROLLBACK SCRIPT FOR MIGRATION 011
-- ========================================================

DROP FUNCTION IF EXISTS reveal_cccd(UUID);
DROP VIEW IF EXISTS marketing_leads_view;
DROP TABLE IF EXISTS customer_consents CASCADE;

DROP INDEX IF EXISTS idx_customers_phone_hash;
DROP INDEX IF EXISTS idx_customers_do_not_contact;

ALTER TABLE customers DROP COLUMN IF EXISTS do_not_contact;
ALTER TABLE customers DROP COLUMN IF EXISTS phone_hash;
ALTER TABLE customers DROP COLUMN IF EXISTS encrypted_id_number;

ALTER TABLE leads DROP COLUMN IF EXISTS do_not_contact;
