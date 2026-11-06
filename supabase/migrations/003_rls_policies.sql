-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 003: ROW LEVEL SECURITY (RLS) POLICIES
-- Bật RLS cho tất cả các bảng, không để bảng nào mở!
-- ========================================================

-- 1. BẬT RLS TOÀN BỘ CÁC BẢNG
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 2. POLICIES CHO PROFILES
CREATE POLICY "profiles_select_all_authenticated" ON profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR current_role() IN ('admin', 'director'));

CREATE POLICY "profiles_admin_all" ON profiles
    FOR ALL TO authenticated
    USING (current_role() = 'admin');

-- 3. POLICIES CHO ORGANIZATIONS & AGENCIES & PROJECTS
CREATE POLICY "org_select_authenticated" ON organizations
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "agencies_select_authenticated" ON agencies
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "agencies_admin_modify" ON agencies
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director'));

CREATE POLICY "projects_select_authenticated" ON projects
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "projects_admin_modify" ON projects
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director', 'marketing_manager'));

CREATE POLICY "agency_projects_select" ON agency_projects
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "agency_projects_admin" ON agency_projects
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director', 'sales_manager'));

-- 4. POLICIES CHO TEAMS & USER_PROJECTS
CREATE POLICY "teams_select_authenticated" ON teams
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "teams_admin_modify" ON teams
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director', 'sales_manager'));

CREATE POLICY "user_projects_select" ON user_projects
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "user_projects_admin" ON user_projects
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director', 'sales_manager', 'team_leader'));

-- 5. POLICIES QUAN TRỌNG: LEADS (THEO 6 VAI TRÒ)
-- Sale Agent: Chỉ xem Lead được giao cho mình
-- Team Leader: Lead của Team mình
-- Sales Manager: Lead thuộc Sàn mình phụ trách
-- Marketing Manager: Xem Lead để đo lường nguồn/chiến dịch
-- Director / Admin: Toàn bộ
CREATE POLICY "leads_select_by_role" ON leads
    FOR SELECT TO authenticated
    USING (
        current_role() IN ('admin', 'director')
        OR (current_role() = 'marketing_manager')
        OR (current_role() = 'sales_manager' AND agency_id = current_agency())
        OR (current_role() = 'team_leader' AND team_id = current_team())
        OR (current_role() = 'sale_agent' AND assigned_to = auth.uid())
    );

CREATE POLICY "leads_insert_policy" ON leads
    FOR INSERT TO authenticated
    WITH CHECK (
        current_role() IN ('admin', 'director', 'marketing_manager', 'sales_manager', 'team_leader')
        OR (current_role() = 'sale_agent' AND assigned_to = auth.uid())
    );

CREATE POLICY "leads_update_policy" ON leads
    FOR UPDATE TO authenticated
    USING (
        current_role() IN ('admin', 'director')
        OR (current_role() = 'sales_manager' AND agency_id = current_agency())
        OR (current_role() = 'team_leader' AND team_id = current_team())
        OR (current_role() = 'sale_agent' AND assigned_to = auth.uid())
    );

CREATE POLICY "leads_delete_policy" ON leads
    FOR DELETE TO authenticated
    USING (current_role() IN ('admin', 'director'));

-- 6. POLICIES CHO CUSTOMERS
CREATE POLICY "customers_select_by_role" ON customers
    FOR SELECT TO authenticated
    USING (
        current_role() IN ('admin', 'director')
        OR EXISTS (
            SELECT 1 FROM leads l 
            WHERE l.customer_id = customers.id 
              AND (
                (current_role() = 'sale_agent' AND l.assigned_to = auth.uid())
                OR (current_role() = 'team_leader' AND l.team_id = current_team())
                OR (current_role() = 'sales_manager' AND l.agency_id = current_agency())
                OR (current_role() = 'marketing_manager')
              )
        )
    );

CREATE POLICY "customers_insert_all" ON customers
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "customers_update_allowed" ON customers
    FOR UPDATE TO authenticated
    USING (current_role() IN ('admin', 'director', 'sales_manager', 'team_leader', 'sale_agent'));

-- 7. POLICIES CHO LEAD_ACTIVITIES, TASKS, APPOINTMENTS
CREATE POLICY "activities_select" ON lead_activities
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM leads l WHERE l.id = lead_activities.lead_id
        )
    );

CREATE POLICY "activities_insert" ON lead_activities
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR current_role() IN ('admin', 'director'));

CREATE POLICY "appointments_all" ON appointments
    FOR ALL TO authenticated
    USING (
        user_id = auth.uid() 
        OR current_role() IN ('admin', 'director', 'sales_manager', 'team_leader')
    );

CREATE POLICY "tasks_all" ON tasks
    FOR ALL TO authenticated
    USING (
        user_id = auth.uid() 
        OR current_role() IN ('admin', 'director', 'sales_manager', 'team_leader')
    );

-- 8. POLICIES CHO TRANSACTIONS & DEALS
CREATE POLICY "transactions_select" ON transactions
    FOR SELECT TO authenticated
    USING (
        current_role() IN ('admin', 'director', 'sales_manager')
        OR EXISTS (
            SELECT 1 FROM leads l 
            WHERE l.id = transactions.lead_id 
              AND (l.assigned_to = auth.uid() OR l.team_id = current_team())
        )
    );

CREATE POLICY "transactions_insert_update" ON transactions
    FOR ALL TO authenticated
    USING (
        current_role() IN ('admin', 'director', 'sales_manager', 'team_leader', 'sale_agent')
    );

-- 9. POLICIES CHO TRI THỨC VÀ SCRIPTS
CREATE POLICY "knowledge_select_all" ON project_knowledge
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "knowledge_modify" ON project_knowledge
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director', 'marketing_manager', 'sales_manager'));

CREATE POLICY "faq_select_all" ON project_faq
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "faq_modify" ON project_faq
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director', 'marketing_manager'));

CREATE POLICY "scripts_select_all" ON sales_scripts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "scripts_modify" ON sales_scripts
    FOR ALL TO authenticated
    USING (current_role() IN ('admin', 'director', 'marketing_manager', 'sales_manager'));

CREATE POLICY "ai_scripts_own" ON ai_scripts
    FOR ALL TO authenticated
    USING (user_id = auth.uid() OR current_role() IN ('admin', 'director'));

-- 10. SYSTEM SETTINGS & AUDIT LOGS
CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "audit_logs_select" ON audit_logs
    FOR SELECT TO authenticated
    USING (current_role() IN ('admin', 'director'));

CREATE POLICY "settings_select" ON system_settings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "settings_admin" ON system_settings
    FOR ALL TO authenticated
    USING (current_role() = 'admin');

CREATE POLICY "role_permissions_select" ON role_permissions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "role_permissions_admin" ON role_permissions
    FOR ALL TO authenticated
    USING (current_role() = 'admin');
