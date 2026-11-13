-- ========================================================
-- MIGRATION 034: BỔ SUNG CỘT region_id VÀO BẢNG PROFILES & RLS CHO COMPANY ADMIN
-- Khắc phục lỗi: Could not find the 'region_id' column of 'profiles' in the schema cache
-- Cho phép Quản Trị Doanh Nghiệp (company_admin) và CEO cập nhật nhân sự thuộc DN của mình
-- ========================================================

-- 1. Bổ sung cột region_id vào public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_region ON public.profiles(region_id);

-- 2. Bổ sung policy RLS cho company_admin & ceo trên public.profiles
DO $$ 
BEGIN
    CREATE POLICY profiles_tenant_company_admin ON public.profiles
        FOR ALL
        TO authenticated
        USING (
            (public.get_current_user_role() IN ('company_admin', 'ceo') 
             OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
            AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
        WITH CHECK (
            (public.get_current_user_role() IN ('company_admin', 'ceo') 
             OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('company_admin', 'ceo'))
            AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- 3. Làm mới PostgREST schema cache
NOTIFY pgrst, 'reload schema';
