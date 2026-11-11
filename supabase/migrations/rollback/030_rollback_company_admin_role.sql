-- ========================================================
-- ROLLBACK MIGRATION 030: REMOVE COMPANY_ADMIN ROLE
-- ========================================================

DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN (
      'admin', 
      'ceo', 
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

DROP INDEX IF EXISTS public.idx_organizations_admin;
DROP INDEX IF EXISTS public.idx_organizations_ceo;

ALTER TABLE public.organizations DROP COLUMN IF EXISTS admin_id;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS ceo_id;
