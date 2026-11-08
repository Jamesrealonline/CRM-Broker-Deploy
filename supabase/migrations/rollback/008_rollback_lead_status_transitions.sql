-- ========================================================
-- REAL ESTATE CRM - ROLLBACK MIGRATION 008
-- Rollback Giai đoạn P0.1: Lead status transitions & atomic RPC
-- ========================================================

-- 1. Xóa trigger và trigger function chống cập nhật trực tiếp status
DROP TRIGGER IF EXISTS trg_prevent_direct_status_update ON leads;
DROP FUNCTION IF EXISTS trg_check_direct_lead_status_update();

-- 2. Xóa RPC change_lead_status
DROP FUNCTION IF EXISTS change_lead_status(UUID, VARCHAR, JSONB);

-- 3. Xóa các unique partial index
DROP INDEX IF EXISTS uq_contract_code;
DROP INDEX IF EXISTS uq_transaction_code;
DROP INDEX IF EXISTS uq_active_unit_transaction;

-- 4. Xóa bảng lead_status_transitions và RLS policies của nó
DROP TABLE IF EXISTS lead_status_transitions CASCADE;
