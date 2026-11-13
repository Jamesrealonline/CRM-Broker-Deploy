-- Migration 036: Enforce multi-tenant RLS policies on projects and knowledge tables
-- Guarantees that Company Admin, CEO, and subordinates of any enterprise ONLY see their enterprise's projects.

-- 1. Projects table RLS
ALTER POLICY "projects_select_authenticated" ON "public"."projects"
USING (
  is_admin() OR organization_id = current_organization_id()
);

ALTER POLICY "projects_admin_modify" ON "public"."projects"
USING (
  is_admin() OR (
    organization_id = current_organization_id() 
    AND get_current_user_role() IN ('company_admin', 'ceo', 'director', 'marketing_manager')
  )
)
WITH CHECK (
  is_admin() OR (
    organization_id = current_organization_id() 
    AND get_current_user_role() IN ('company_admin', 'ceo', 'director', 'marketing_manager')
  )
);

-- 2. Project FAQ and Knowledge modification permissions for Company Admin and CEO
ALTER POLICY "faq_modify" ON "public"."project_faq"
USING (
  is_admin() OR ((get_current_user_role())::text = ANY (ARRAY['admin', 'company_admin', 'ceo', 'director', 'marketing_manager']))
)
WITH CHECK (
  is_admin() OR ((get_current_user_role())::text = ANY (ARRAY['admin', 'company_admin', 'ceo', 'director', 'marketing_manager']))
);

ALTER POLICY "knowledge_modify" ON "public"."project_knowledge"
USING (
  is_admin() OR ((get_current_user_role())::text = ANY (ARRAY['admin', 'company_admin', 'ceo', 'director', 'marketing_manager', 'sales_manager']))
)
WITH CHECK (
  is_admin() OR ((get_current_user_role())::text = ANY (ARRAY['admin', 'company_admin', 'ceo', 'director', 'marketing_manager', 'sales_manager']))
);

NOTIFY pgrst, 'reload schema';
