-- ========================================================
-- ROLLBACK 027: ROLLBACK CEO, REGIONAL DIRECTORS & DIVISIONS
-- ========================================================

DROP VIEW IF EXISTS v_org_tree;
DROP VIEW IF EXISTS v_sale_chain;

ALTER TABLE IF EXISTS transactions
  DROP COLUMN IF EXISTS l3_approved_by,
  DROP COLUMN IF EXISTS l2_approved_by,
  DROP COLUMN IF EXISTS l1_approved_by,
  DROP COLUMN IF EXISTS requires_l3_approval,
  DROP COLUMN IF EXISTS requires_l2_approval,
  DROP COLUMN IF EXISTS requires_l1_approval,
  DROP COLUMN IF EXISTS ceo_commission_rate,
  DROP COLUMN IF EXISTS ceo_commission_amount,
  DROP COLUMN IF EXISTS regional_commission_rate,
  DROP COLUMN IF EXISTS regional_commission_amount,
  DROP COLUMN IF EXISTS ceo_id,
  DROP COLUMN IF EXISTS regional_director_id,
  DROP COLUMN IF EXISTS region_id,
  DROP COLUMN IF EXISTS agency_director_id;

ALTER TABLE IF EXISTS marketing_units
  DROP COLUMN IF EXISTS division_id;

ALTER TABLE IF EXISTS agencies
  DROP COLUMN IF EXISTS region_id;

DROP TABLE IF EXISTS org_position_levels;
DROP TABLE IF EXISTS company_settings;
DROP TABLE IF EXISTS divisions;
DROP TABLE IF EXISTS regions;

-- Khôi phục check constraint của profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN (
    'admin', 
    'director', 
    'sales_manager', 
    'team_leader', 
    'sale_agent', 
    'marketing_manager', 
    'hr_admin'
  ));
