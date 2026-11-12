-- ========================================================
-- ROLLBACK 033: DROP REGIONS AND CRUD POLICIES
-- ========================================================

DROP POLICY IF EXISTS agencies_tenant_modify ON public.agencies;
DROP POLICY IF EXISTS teams_tenant_modify ON public.teams;
DROP TABLE IF EXISTS public.regions CASCADE;
