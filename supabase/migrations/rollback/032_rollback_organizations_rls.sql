-- ========================================================
-- ROLLBACK 032: DROP ORGANIZATIONS WRITE POLICIES
-- ========================================================

DROP POLICY IF EXISTS organizations_admin_all ON public.organizations;
DROP POLICY IF EXISTS organizations_tenant_update ON public.organizations;
