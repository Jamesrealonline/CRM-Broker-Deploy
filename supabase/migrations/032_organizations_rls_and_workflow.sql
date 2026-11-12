-- ========================================================
-- MIGRATION 032: ORGANIZATIONS RLS & WORKFLOW POLICIES
-- Cho phép Quản Trị Tổng (Admin) INSERT/UPDATE/DELETE trên bảng organizations
-- Cho phép Quản Trị Doanh Nghiệp (company_admin) và Tổng Giám Đốc (ceo) cập nhật thông tin DN của mình
-- ========================================================

DO $$ 
BEGIN
    -- 1. Bổ sung policy ALL cho Quản Trị Tổng
    CREATE POLICY organizations_admin_all ON public.organizations
        FOR ALL
        TO authenticated
        USING (
            public.is_admin() 
            OR public.get_current_user_role() = 'admin'
            OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        WITH CHECK (
            public.is_admin() 
            OR public.get_current_user_role() = 'admin'
            OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$ 
BEGIN
    -- 2. Bổ sung policy UPDATE cho Quản Trị DN / CEO của chính tổ chức đó
    CREATE POLICY organizations_tenant_update ON public.organizations
        FOR UPDATE
        TO authenticated
        USING (
            id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
            AND (public.get_current_user_role() IN ('company_admin', 'ceo')
                 OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
        )
        WITH CHECK (
            id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
            AND (public.get_current_user_role() IN ('company_admin', 'ceo')
                 OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
        );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
