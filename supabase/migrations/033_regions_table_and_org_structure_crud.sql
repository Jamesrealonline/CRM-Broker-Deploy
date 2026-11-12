-- ========================================================
-- MIGRATION 033: REGIONS TABLE & MULTI-TENANT CRUD POLICIES
-- Bổ sung bảng regions và các chính sách phân quyền Thêm/Sửa/Xóa cho Doanh Nghiệp, Vùng, Sàn, Team
-- ========================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'regions') THEN
    CREATE TABLE public.regions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      regional_director_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_regions_director ON public.regions(regional_director_id);
    CREATE INDEX IF NOT EXISTS idx_regions_status ON public.regions(status);
    CREATE INDEX IF NOT EXISTS idx_regions_org ON public.regions(organization_id);

    ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

    CREATE POLICY regions_select_authenticated ON public.regions
      FOR SELECT TO authenticated
      USING (true);

    CREATE POLICY regions_all_admin ON public.regions
      FOR ALL TO authenticated
      USING (
        public.is_admin() 
        OR public.get_current_user_role() = 'admin'
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        OR (
          organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
          AND (public.get_current_user_role() IN ('company_admin', 'ceo') 
               OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
        )
      )
      WITH CHECK (
        public.is_admin() 
        OR public.get_current_user_role() = 'admin'
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        OR (
          organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
          AND (public.get_current_user_role() IN ('company_admin', 'ceo') 
               OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  -- Cập nhật policy cho agencies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agencies' AND policyname = 'agencies_tenant_modify'
  ) THEN
    CREATE POLICY agencies_tenant_modify ON public.agencies
      FOR ALL TO authenticated
      USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (public.get_current_user_role() IN ('company_admin', 'ceo') 
             OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
      )
      WITH CHECK (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (public.get_current_user_role() IN ('company_admin', 'ceo') 
             OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
      );
  END IF;

  -- Cập nhật policy cho teams
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'teams_tenant_modify'
  ) THEN
    CREATE POLICY teams_tenant_modify ON public.teams
      FOR ALL TO authenticated
      USING (
        agency_id IN (
          SELECT id FROM public.agencies 
          WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
        AND (public.get_current_user_role() IN ('company_admin', 'ceo') 
             OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
      )
      WITH CHECK (
        agency_id IN (
          SELECT id FROM public.agencies 
          WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
        AND (public.get_current_user_role() IN ('company_admin', 'ceo') 
             OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
      );
  END IF;
END $$;
