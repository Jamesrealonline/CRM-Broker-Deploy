-- Migration 035: Fix RLS infinite recursion on profiles/organizations and reload PostgREST schema cache
-- Issue: Direct subqueries on `profiles` inside RLS policies caused Postgres error 42P17 (infinite recursion),
-- leading to 'new row violates row-level security policy for table "organizations"'.
-- Also triggers PostgREST schema reload so newly added columns (such as `region_id`) are immediately recognized.

-- 1. Profiles policy fix
ALTER POLICY "profiles_tenant_company_admin" ON "public"."profiles"
USING (
  get_current_user_role() IN ('company_admin', 'ceo')
  AND organization_id = current_organization_id()
)
WITH CHECK (
  get_current_user_role() IN ('company_admin', 'ceo')
  AND organization_id = current_organization_id()
);

-- 2. Organizations policy fix
ALTER POLICY "organizations_admin_all" ON "public"."organizations"
USING (
  is_admin() OR get_current_user_role() = 'admin'
)
WITH CHECK (
  is_admin() OR get_current_user_role() = 'admin'
);

ALTER POLICY "organizations_tenant_update" ON "public"."organizations"
USING (
  id = current_organization_id() AND get_current_user_role() IN ('company_admin', 'ceo')
)
WITH CHECK (
  id = current_organization_id() AND get_current_user_role() IN ('company_admin', 'ceo')
);

-- 3. Regions policy fix
ALTER POLICY "regions_all_admin" ON "public"."regions"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin'
  OR (organization_id = current_organization_id() AND get_current_user_role() IN ('company_admin', 'ceo'))
)
WITH CHECK (
  is_admin() 
  OR get_current_user_role() = 'admin'
  OR (organization_id = current_organization_id() AND get_current_user_role() IN ('company_admin', 'ceo'))
);

-- 4. Agencies policy fix
ALTER POLICY "agencies_tenant_modify" ON "public"."agencies"
USING (
  is_admin()
  OR get_current_user_role() = 'admin'
  OR (organization_id = current_organization_id() AND get_current_user_role() IN ('company_admin', 'ceo'))
)
WITH CHECK (
  is_admin()
  OR get_current_user_role() = 'admin'
  OR (organization_id = current_organization_id() AND get_current_user_role() IN ('company_admin', 'ceo'))
);

-- 5. Teams policy fix
ALTER POLICY "teams_tenant_modify" ON "public"."teams"
USING (
  is_admin()
  OR get_current_user_role() = 'admin'
  OR (
    agency_id IN (SELECT id FROM agencies WHERE organization_id = current_organization_id())
    AND get_current_user_role() IN ('company_admin', 'ceo')
  )
)
WITH CHECK (
  is_admin()
  OR get_current_user_role() = 'admin'
  OR (
    agency_id IN (SELECT id FROM agencies WHERE organization_id = current_organization_id())
    AND get_current_user_role() IN ('company_admin', 'ceo')
  )
);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
