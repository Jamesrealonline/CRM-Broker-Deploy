-- ========================================================
-- ROLLBACK 034: HỦY CỘT region_id TRÊN PROFILES & RLS TENANT
-- ========================================================

DROP POLICY IF EXISTS profiles_tenant_company_admin ON public.profiles;
DROP INDEX IF EXISTS public.idx_profiles_region;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS region_id;

NOTIFY pgrst, 'reload schema';
