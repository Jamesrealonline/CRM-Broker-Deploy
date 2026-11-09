-- ========================================================
-- ROLLBACK 026: ADMIN & DIRECTOR FULL ACCESS, UNMASKED PII,
-- EMPLOYMENT TYPES & 10 SAMPLE LEADS SEED
-- ========================================================

-- 1. Xóa toàn bộ dữ liệu mẫu trước khi rollback
DELETE FROM public.transactions WHERE is_sample = true;
DELETE FROM public.leads WHERE is_sample = true;
DELETE FROM public.customers WHERE is_sample = true;
DELETE FROM public.profiles WHERE is_sample = true;

-- 2. Hủy các RPC đã tạo
DROP FUNCTION IF EXISTS public.seed_sample_leads_data();
DROP FUNCTION IF EXISTS public.purge_sample_data();
DROP FUNCTION IF EXISTS public.get_unmasked_customer_pii(UUID);

-- 3. Xóa cấu hình director_global_scope
DELETE FROM public.system_settings WHERE key = 'director_global_scope';

-- 4. Gỡ bỏ index và cột
DROP INDEX IF EXISTS idx_leads_is_sample;
DROP INDEX IF EXISTS idx_customers_is_sample;
DROP INDEX IF EXISTS idx_transactions_is_sample;

ALTER TABLE public.transactions DROP COLUMN IF EXISTS is_sample;
ALTER TABLE public.leads DROP COLUMN IF EXISTS is_sample;
ALTER TABLE public.customers DROP COLUMN IF EXISTS is_sample;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_sample;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS employment_type;
