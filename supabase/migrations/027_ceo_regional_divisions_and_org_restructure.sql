-- ========================================================
-- MIGRATION 027: CEO, REGIONAL DIRECTORS, 3 DIVISIONS & ORG RESTRUCTURE
-- Phân cấp: Tổng Giám Đốc (ceo) -> Giám Đốc Vùng (regional_director) -> Giám Đốc Sàn (director) -> Trưởng Phòng (sales_manager) -> Trưởng Nhóm (team_leader) -> Chuyên Viên (sale_agent)
-- Khối Marketing & Khối HR trực thuộc Tổng Giám Đốc
-- ========================================================

-- 1. CẬP NHẬT RÀNG BUỘC VAI TRÒ (USER ROLES ADDITIVE)
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
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

-- 2. TẠO BẢNG VÙNG KINH DOANH (REGIONS)
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  regional_director_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regions_director ON regions(regional_director_id);
CREATE INDEX IF NOT EXISTS idx_regions_status ON regions(status);

-- 3. TẠO BẢNG KHỐI CHỨC NĂNG (DIVISIONS: SALES, MARKETING, HR)
CREATE TABLE IF NOT EXISTS divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL CHECK (code IN ('SALES', 'MARKETING', 'HR')),
  name VARCHAR(255) NOT NULL,
  head_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ceo_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TẠO BẢNG CẤU HÌNH DOANH NGHIỆP & NGƯỠNG DUYỆT (COMPANY_SETTINGS)
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceo_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  acting_ceo_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  acting_ceo_until TIMESTAMPTZ,
  approval_threshold_l1 NUMERIC(18,0) DEFAULT 5000000000,   -- > 5 tỷ VNĐ: GĐ Sàn duyệt
  approval_threshold_l2 NUMERIC(18,0) DEFAULT 15000000000,  -- > 15 tỷ VNĐ: GĐ Vùng duyệt
  approval_threshold_l3 NUMERIC(18,0) DEFAULT 30000000000,  -- > 30 tỷ VNĐ: CEO duyệt
  director_global_scope BOOLEAN DEFAULT false,
  sla_severe_breach_threshold INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. BẢNG PHÂN CẤP CHỨC DANH DOANH NGHIỆP (ORG_POSITION_LEVELS)
CREATE TABLE IF NOT EXISTS org_position_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(100) NOT NULL,
  track VARCHAR(50) NOT NULL CHECK (track IN ('executive', 'sales', 'marketing', 'hr')),
  level INTEGER NOT NULL,
  description TEXT
);

-- 6. BỔ SUNG CỘT CHO BẢNG SÀN GIAO DỊCH (AGENCIES)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agencies' AND column_name = 'region_id') THEN
    ALTER TABLE agencies ADD COLUMN region_id UUID REFERENCES regions(id) ON DELETE SET NULL;
    CREATE INDEX idx_agencies_region ON agencies(region_id);
  END IF;
END $$;

-- 7. BỔ SUNG CỘT CHO BẢNG ĐƠN VỊ MARKETING (MARKETING_UNITS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_units' AND column_name = 'division_id') THEN
    ALTER TABLE marketing_units ADD COLUMN division_id UUID REFERENCES divisions(id) ON DELETE SET NULL;
    CREATE INDEX idx_mkt_units_division ON marketing_units(division_id);
  END IF;
END $$;

-- 8. BỔ SUNG CỘT SNAPSHOT & MAKER-CHECKER CHO GIAO DỊCH/HỢP ĐỒNG (TRANSACTIONS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'agency_director_id') THEN
    ALTER TABLE transactions ADD COLUMN agency_director_id UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'region_id') THEN
    ALTER TABLE transactions ADD COLUMN region_id UUID REFERENCES regions(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'regional_director_id') THEN
    ALTER TABLE transactions ADD COLUMN regional_director_id UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'ceo_id') THEN
    ALTER TABLE transactions ADD COLUMN ceo_id UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'regional_commission_amount') THEN
    ALTER TABLE transactions ADD COLUMN regional_commission_amount NUMERIC(18,0) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'regional_commission_rate') THEN
    ALTER TABLE transactions ADD COLUMN regional_commission_rate NUMERIC(5,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'requires_l1_approval') THEN
    ALTER TABLE transactions ADD COLUMN requires_l1_approval BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'requires_l2_approval') THEN
    ALTER TABLE transactions ADD COLUMN requires_l2_approval BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'requires_l3_approval') THEN
    ALTER TABLE transactions ADD COLUMN requires_l3_approval BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'l1_approved_by') THEN
    ALTER TABLE transactions ADD COLUMN l1_approved_by UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'l2_approved_by') THEN
    ALTER TABLE transactions ADD COLUMN l2_approved_by UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'l3_approved_by') THEN
    ALTER TABLE transactions ADD COLUMN l3_approved_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- 9. BACKFILL DỮ LIỆU AN TOÀN
-- A. Vùng mặc định 'Chưa phân vùng'
INSERT INTO regions (id, code, name, status, description)
VALUES ('33333333-0000-1111-1111-111111111111', 'REG-DEFAULT', 'Vùng Chưa Phân Vùng', 'active', 'Vùng mặc định dành cho các sàn chưa gán vùng kinh doanh')
ON CONFLICT (code) DO NOTHING;

-- B. Gán mọi sàn chưa có vùng vào Vùng mặc định
UPDATE agencies 
SET region_id = '33333333-0000-1111-1111-111111111111'
WHERE region_id IS NULL;

-- C. 3 Khối chức năng chuẩn
INSERT INTO divisions (code, name)
VALUES 
  ('SALES', 'Khối Kinh Doanh'),
  ('MARKETING', 'Khối Marketing'),
  ('HR', 'Khối Nhân Sự')
ON CONFLICT (code) DO NOTHING;

-- D. Cấu hình Doanh nghiệp mặc định
INSERT INTO company_settings (approval_threshold_l1, approval_threshold_l2, approval_threshold_l3)
SELECT 5000000000, 15000000000, 30000000000
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- E. Bảng chức danh chuẩn hóa
INSERT INTO org_position_levels (code, title, track, level, description)
VALUES
  ('POS_CEO', 'Tổng Giám Đốc', 'executive', 1, 'Lãnh đạo cao nhất toàn công ty'),
  ('POS_REG_DIR', 'Giám Đốc Vùng', 'sales', 2, 'Quản lý toàn bộ sàn trong vùng kinh doanh'),
  ('POS_AGY_DIR', 'Giám Đốc Sàn', 'sales', 3, 'Điều hành sàn giao dịch'),
  ('POS_DEPT_HEAD', 'Trưởng Phòng Kinh Doanh', 'sales', 4, 'Quản lý phòng kinh doanh'),
  ('POS_TEAM_LEADER', 'Trưởng Nhóm', 'sales', 5, 'Quản lý đội nhóm tư vấn'),
  ('POS_SALE', 'Chuyên Viên Tư Vấn', 'sales', 6, 'Môi giới / Chuyên viên tư vấn'),
  ('POS_MKT_HEAD', 'Giám Đốc/Trưởng Marketing', 'marketing', 2, 'Lãnh đạo khối Marketing'),
  ('POS_MKT_SPEC', 'Chuyên Viên Marketing', 'marketing', 6, 'Thực thi chiến dịch marketing'),
  ('POS_HR_HEAD', 'Giám Đốc/Trưởng HR', 'hr', 2, 'Lãnh đạo khối Nhân sự'),
  ('POS_HR_SPEC', 'Chuyên Viên HR', 'hr', 6, 'Vận hành nhân sự và tuyển dụng')
ON CONFLICT (code) DO NOTHING;

-- 10. SINGLE SOURCE OF TRUTH: VIEW V_SALE_CHAIN MỞ RỘNG
CREATE OR REPLACE VIEW v_sale_chain AS
SELECT 
  p.id AS sale_id,
  p.full_name AS sale_name,
  p.role AS sale_role,
  p.status AS sale_status,
  t.id AS team_id,
  t.name AS team_name,
  t.leader_id AS leader_id,
  ldr.full_name AS leader_name,
  d.id AS department_id,
  d.name AS department_name,
  d.head_id AS head_id,
  hd.full_name AS head_name,
  a.id AS agency_id,
  a.name AS agency_name,
  a.director_id AS agency_director_id,
  dir.full_name AS agency_director_name,
  r.id AS region_id,
  r.name AS region_name,
  r.regional_director_id AS regional_director_id,
  rdir.full_name AS regional_director_name,
  cs.ceo_id AS ceo_id,
  ceo.full_name AS ceo_name,
  mu.id AS marketing_unit_id,
  mu.name AS marketing_unit_name,
  mu.manager_id AS marketing_manager_id
FROM profiles p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN profiles ldr ON t.leader_id = ldr.id
LEFT JOIN departments d ON t.department_id = d.id OR p.department_id = d.id
LEFT JOIN profiles hd ON d.head_id = hd.id
LEFT JOIN agencies a ON p.agency_id = a.id OR t.agency_id = a.id
LEFT JOIN profiles dir ON a.director_id = dir.id
LEFT JOIN regions r ON a.region_id = r.id
LEFT JOIN profiles rdir ON r.regional_director_id = rdir.id
LEFT JOIN company_settings cs ON true
LEFT JOIN profiles ceo ON cs.ceo_id = ceo.id
LEFT JOIN marketing_units mu ON p.marketing_unit_id = mu.id;

-- 11. VIEW TỔ CHỨC CÂY DOANH NGHIỆP: V_ORG_TREE
CREATE OR REPLACE VIEW v_org_tree AS
WITH RECURSIVE org_nodes AS (
  -- Gốc cây: Tổng Giám Đốc (CEO)
  SELECT 
    cs.ceo_id AS node_id,
    p.full_name AS node_name,
    'ceo' AS node_type,
    NULL::UUID AS parent_id,
    'executive' AS track,
    1 AS depth,
    ARRAY[cs.ceo_id::text] AS path
  FROM company_settings cs
  JOIN profiles p ON cs.ceo_id = p.id
  WHERE cs.ceo_id IS NOT NULL

  UNION ALL

  -- Nhánh 1: Khối Marketing & HR trực tiếp dưới CEO
  SELECT 
    d.id AS node_id,
    d.name AS node_name,
    'division' AS node_type,
    n.node_id AS parent_id,
    LOWER(d.code) AS track,
    2 AS depth,
    n.path || d.id::text
  FROM divisions d
  JOIN org_nodes n ON n.node_type = 'ceo'

  UNION ALL

  -- Nhánh 2: Các Vùng kinh doanh thuộc Khối Kinh Doanh
  SELECT 
    r.id AS node_id,
    r.name AS node_name,
    'region' AS node_type,
    div.id AS parent_id,
    'sales' AS track,
    3 AS depth,
    n.path || r.id::text
  FROM regions r
  JOIN divisions div ON div.code = 'SALES'
  JOIN org_nodes n ON n.node_id = div.id

  UNION ALL

  -- Các Sàn thuộc Vùng
  SELECT 
    a.id AS node_id,
    a.name AS node_name,
    'agency' AS node_type,
    r.id AS parent_id,
    'sales' AS track,
    4 AS depth,
    n.path || a.id::text
  FROM agencies a
  JOIN regions r ON a.region_id = r.id
  JOIN org_nodes n ON n.node_id = r.id
)
SELECT * FROM org_nodes;
