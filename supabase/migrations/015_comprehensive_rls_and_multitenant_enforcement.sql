-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 015: COMPREHENSIVE RLS & MULTI-TENANT ISOLATION
-- Giai đoạn P1.4: RLS toàn diện và Cưỡng chế cô lập dữ liệu Đa đối tác (Multi-tenant)
-- ========================================================

-- 1. HÀM LẤY ORGANIZATION_ID TỰ ĐỘNG TỪ JWT APP_METADATA HOẶC PROFILES
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
DECLARE
    v_org_id TEXT;
    v_profile_org UUID;
BEGIN
    -- 1. Đọc từ JWT app_metadata
    BEGIN
        v_org_id := (auth.jwt() -> 'app_metadata' ->> 'organization_id');
        IF v_org_id IS NOT NULL AND v_org_id != '' THEN
            RETURN v_org_id::UUID;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            v_org_id := NULL;
    END;

    -- 2. Fallback đọc từ profiles của user đang xác thực
    IF auth.uid() IS NOT NULL THEN
        SELECT organization_id INTO v_profile_org 
        FROM profiles 
        WHERE id = auth.uid();
        RETURN v_profile_org;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. TRIGGER TỰ ĐỘNG CƯỠNG CHẾ GÁN ORGANIZATION_ID TRÊN TẤT CẢ CÁC BẢNG (CHỐNG INJECTION TỪ CLIENT)
CREATE OR REPLACE FUNCTION enforce_tenant_organization()
RETURNS TRIGGER AS $$
DECLARE
    v_user_org_id UUID;
BEGIN
    v_user_org_id := current_organization_id();
    IF v_user_org_id IS NOT NULL THEN
        -- Ghi đè tuyệt đối giá trị client gửi lên bằng organization_id đã xác thực
        NEW.organization_id := v_user_org_id;
    ELSIF NEW.organization_id IS NULL THEN
        -- Mặc định tenant nếu chưa có
        NEW.organization_id := '11111111-1111-1111-1111-111111111111'::UUID;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn trigger cho leads, customers, projects, agencies, transactions
DROP TRIGGER IF EXISTS trg_enforce_org_leads ON leads;
CREATE TRIGGER trg_enforce_org_leads
    BEFORE INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION enforce_tenant_organization();

DROP TRIGGER IF EXISTS trg_enforce_org_customers ON customers;
CREATE TRIGGER trg_enforce_org_customers
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION enforce_tenant_organization();

DROP TRIGGER IF EXISTS trg_enforce_org_projects ON projects;
CREATE TRIGGER trg_enforce_org_projects
    BEFORE INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION enforce_tenant_organization();

DROP TRIGGER IF EXISTS trg_enforce_org_agencies ON agencies;
CREATE TRIGGER trg_enforce_org_agencies
    BEFORE INSERT ON agencies
    FOR EACH ROW
    EXECUTE FUNCTION enforce_tenant_organization();

-- 3. CẬP NHẬT RLS POLICIES CÔ LẬP TENANT TRÊN 100% CÁC BẢNG
-- Bảng projects: chỉ xem được dự án của tổ chức mình
DROP POLICY IF EXISTS "projects_select_authenticated" ON projects;
CREATE POLICY "projects_select_authenticated" ON projects
    FOR SELECT TO authenticated
    USING (
        organization_id = current_organization_id() 
        OR current_organization_id() IS NULL
    );

-- Bảng agencies: chỉ xem được sàn thuộc tổ chức mình
DROP POLICY IF EXISTS "agencies_select_authenticated" ON agencies;
CREATE POLICY "agencies_select_authenticated" ON agencies
    FOR SELECT TO authenticated
    USING (
        organization_id = current_organization_id() 
        OR current_organization_id() IS NULL
    );

-- Bảng customers: cô lập tuyệt đối theo tenant
DROP POLICY IF EXISTS "customers_tenant_isolation" ON customers;
CREATE POLICY "customers_tenant_isolation" ON customers
    FOR ALL TO authenticated
    USING (
        organization_id = current_organization_id() 
        OR current_organization_id() IS NULL
    )
    WITH CHECK (
        organization_id = current_organization_id() 
        OR current_organization_id() IS NULL
    );

-- Bảng leads: kết hợp phân quyền vai trò VÀ cô lập tenant chặt chẽ
DROP POLICY IF EXISTS "leads_select_by_role" ON leads;
CREATE POLICY "leads_select_by_role" ON leads
    FOR SELECT TO authenticated
    USING (
        (organization_id = current_organization_id() OR current_organization_id() IS NULL)
        AND (
            current_role() IN ('admin', 'director')
            OR (current_role() = 'marketing_manager')
            OR (current_role() = 'sales_manager' AND agency_id = current_agency())
            OR (current_role() = 'team_leader' AND team_id = current_team())
            OR (current_role() = 'sale_agent' AND assigned_to = auth.uid())
        )
    );

DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
CREATE POLICY "leads_insert_policy" ON leads
    FOR INSERT TO authenticated
    WITH CHECK (
        (organization_id = current_organization_id() OR current_organization_id() IS NULL)
        AND (
            current_role() IN ('admin', 'director', 'marketing_manager', 'sales_manager', 'team_leader')
            OR (current_role() = 'sale_agent' AND assigned_to = auth.uid())
        )
    );

-- Bảng transactions: cô lập tenant
DROP POLICY IF EXISTS "transactions_tenant_isolation" ON transactions;
CREATE POLICY "transactions_tenant_isolation" ON transactions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM leads 
            WHERE leads.id = transactions.lead_id 
              AND (leads.organization_id = current_organization_id() OR current_organization_id() IS NULL)
        )
    );
