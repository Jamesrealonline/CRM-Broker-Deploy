-- ========================================================
-- ROLLBACK SCRIPT FOR MIGRATION 015
-- ========================================================

DROP TRIGGER IF EXISTS trg_enforce_org_agencies ON agencies;
DROP TRIGGER IF EXISTS trg_enforce_org_projects ON projects;
DROP TRIGGER IF EXISTS trg_enforce_org_customers ON customers;
DROP TRIGGER IF EXISTS trg_enforce_org_leads ON leads;
DROP FUNCTION IF EXISTS enforce_tenant_organization();
DROP FUNCTION IF EXISTS current_organization_id();

DROP POLICY IF EXISTS "transactions_tenant_isolation" ON transactions;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_select_by_role" ON leads;
DROP POLICY IF EXISTS "customers_tenant_isolation" ON customers;
DROP POLICY IF EXISTS "agencies_select_authenticated" ON agencies;
DROP POLICY IF EXISTS "projects_select_authenticated" ON projects;

CREATE POLICY "agencies_select_authenticated" ON agencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_select_authenticated" ON projects FOR SELECT TO authenticated USING (true);
