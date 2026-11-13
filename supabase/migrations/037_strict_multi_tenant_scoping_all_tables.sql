-- Migration 037: Strict Multi-Tenant Scoping for All Tables
-- Enforces database-level isolation so that Company Admin, CEO, Regional Director,
-- and all subordinates of an organization can ONLY read data belonging to their organization.
-- Tables covered: profiles, organizations, regions, agencies, teams, project_knowledge, project_faq, sales_scripts, contracts, leads.

CREATE OR REPLACE FUNCTION public.get_current_user_region()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT region_id FROM profiles WHERE id = auth.uid();
$$;

-- 1. Profiles policy: authenticated users only see members of their own enterprise (plus own profile and admins see all)
ALTER POLICY "profiles_select_all_authenticated" ON "public"."profiles"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR organization_id = current_organization_id()
  OR id = auth.uid()
);

-- 2. Organizations policy: non-admin users only see their own organization
ALTER POLICY "org_select_authenticated" ON "public"."organizations"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR id = current_organization_id()
);

-- 3. Regions policy: non-admin users only see regions of their own organization
ALTER POLICY "regions_select_authenticated" ON "public"."regions"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR organization_id = current_organization_id()
);

-- 4. Agencies policy: non-admin users only see agencies of their own organization
ALTER POLICY "agencies_select_authenticated" ON "public"."agencies"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR organization_id = current_organization_id()
);

-- 5. Teams policy: non-admin users only see teams belonging to agencies of their own organization
ALTER POLICY "teams_select_authenticated" ON "public"."teams"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR agency_id IN (SELECT id FROM agencies WHERE organization_id = current_organization_id())
);

-- 6. Project Knowledge: non-admin users only see knowledge for projects in their organization
ALTER POLICY "knowledge_select_all" ON "public"."project_knowledge"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR project_id IN (SELECT id FROM projects WHERE organization_id = current_organization_id())
);

-- 7. Project FAQs: non-admin users only see FAQs for projects in their organization
ALTER POLICY "faq_select_all" ON "public"."project_faq"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR project_id IN (SELECT id FROM projects WHERE organization_id = current_organization_id())
);

-- 8. Sales Scripts: non-admin users only see sales scripts for projects in their organization
ALTER POLICY "scripts_select_all" ON "public"."sales_scripts"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR project_id IN (SELECT id FROM projects WHERE organization_id = current_organization_id())
);

-- 9. Contracts: non-admin users only see contracts for projects in their organization
ALTER POLICY "p_contracts_select" ON "public"."contracts"
USING (
  is_admin() 
  OR get_current_user_role() = 'admin' 
  OR project_id IN (SELECT id FROM projects WHERE organization_id = current_organization_id())
);

-- 10. Leads: scoped strictly by tenant organization and role hierarchy
ALTER POLICY "leads_select_by_role" ON "public"."leads"
USING (
  (is_admin() OR get_current_user_role() = 'admin' OR organization_id = current_organization_id())
  AND (
    get_current_user_role() IN ('admin', 'company_admin', 'ceo', 'director', 'marketing_manager', 'hr_admin')
    OR (get_current_user_role() = 'regional_director' AND agency_id IN (SELECT id FROM agencies WHERE region_id = get_current_user_region()))
    OR (get_current_user_role() = 'sales_manager' AND agency_id = get_current_user_agency())
    OR (get_current_user_role() = 'team_leader' AND team_id = get_current_user_team())
    OR (get_current_user_role() = 'sale_agent' AND assigned_to = auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
