-- ========================================================
-- ROLLBACK 028: 5-TIER COMMISSION ALLOCATION & INCOME LEDGER
-- Hoàn tác phân bổ hoa hồng 5 tầng, sổ cái và RPC
-- ========================================================

-- 1. XÓA RPC VÀ CHÍNH SÁCH BẢO MẬT
DROP FUNCTION IF EXISTS assign_commission_recipient(UUID, UUID, TEXT, UUID);
DROP POLICY IF EXISTS rls_commission_entries_admin_all ON commission_entries;
DROP POLICY IF EXISTS rls_commission_entries_select ON commission_entries;

-- 2. XÓA BẢNG VÀ CHỈ MỤC MỚI TẠO
DROP TABLE IF EXISTS project_commission_policies CASCADE;
DROP TABLE IF EXISTS commission_runs CASCADE;
DROP TABLE IF EXISTS commission_entries CASCADE;

-- 3. XÓA CỘT BỔ SUNG TRÊN TRANSACTIONS
ALTER TABLE transactions DROP COLUMN IF EXISTS commission_rate;
ALTER TABLE transactions DROP COLUMN IF EXISTS team_commission_amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS team_commission_rate;
ALTER TABLE transactions DROP COLUMN IF EXISTS director_commission_amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS director_commission_rate;
ALTER TABLE transactions DROP COLUMN IF EXISTS regional_commission_amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS regional_commission_rate;
ALTER TABLE transactions DROP COLUMN IF EXISTS ceo_commission_amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS ceo_commission_rate;
ALTER TABLE transactions DROP COLUMN IF EXISTS company_retained_amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS company_retained_rate;
