-- ========================================================
-- MIGRATION 030: ADD COMPANY_ADMIN ROLE & ENTERPRISE ISOLATION
-- Quản Trị Doanh Nghiệp (company_admin) quản trị cấu hình và tài khoản của doanh nghiệp đó
-- ========================================================

-- 1. CẬP NHẬT RÀNG BUỘC VAI TRÒ (USER ROLES ADDITIVE)
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN (
      'admin', 
      'ceo', 
      'company_admin',
      'regional_director', 
      'director', 
      'sales_manager', 
      'team_leader', 
      'sale_agent', 
      'marketing_manager', 
      'hr_admin'
    ));
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- 2. BỔ SUNG CỘT ADMIN_ID & CEO_ID CHO BẢNG ORGANIZATIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'ceo_id'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN ceo_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'admin_id'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_ceo ON public.organizations(ceo_id);
CREATE INDEX IF NOT EXISTS idx_organizations_admin ON public.organizations(admin_id);
