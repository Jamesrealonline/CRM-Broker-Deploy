-- ========================================================
-- ROLLBACK MIGRATION 017: ATOMIC CONTRACT CREATION WITH CUSTOMER & SOURCES
-- ========================================================

-- 1. Xóa hàm RPC
DROP FUNCTION IF EXISTS public.create_contract_with_customer(JSONB, UUID);

-- 2. Xóa index unique chống trùng SĐT
DROP INDEX IF EXISTS public.uq_customers_org_phone_normalized;

-- 3. Xóa các cột đã thêm
ALTER TABLE public.leads
DROP COLUMN IF EXISTS source_detail,
DROP COLUMN IF EXISTS created_via;

ALTER TABLE public.lead_sources
DROP COLUMN IF EXISTS sort_order,
DROP COLUMN IF EXISTS requires_detail;
