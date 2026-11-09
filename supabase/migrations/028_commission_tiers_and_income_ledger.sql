-- ========================================================
-- MIGRATION 028: 5-TIER COMMISSION ALLOCATION & INCOME LEDGER
-- Phân bổ hoa hồng theo từng hợp đồng cho 5 tầng:
-- 1. Sale (sale_agent)
-- 2. Nhóm (team / team_leader)
-- 3. Giám đốc Sàn (director / agency_director)
-- 4. Giám đốc Vùng (regional_director)
-- 5. Tổng Giám Đốc (ceo)
-- Lợi nhuận Công ty giữ lại = Hoa hồng Sàn - Tổng các tầng
-- Thuế TNCN tạm tính (withholding tax), Sổ cái và Ma trận phân quyền truy cập
-- ========================================================

-- 1. MỞ RỘNG BẢNG TRANSACTIONS (ADDITIVE COLUMNS CHO 5 TẦNG & CÔNG TY GIỮ LẠI)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(6,3) DEFAULT 3.5;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS team_commission_amount NUMERIC(18,0) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS team_commission_rate NUMERIC(6,3) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS director_commission_amount NUMERIC(18,0) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS director_commission_rate NUMERIC(6,3) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS regional_commission_amount NUMERIC(18,0) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS regional_commission_rate NUMERIC(6,3) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ceo_commission_amount NUMERIC(18,0) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ceo_commission_rate NUMERIC(6,3) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS company_retained_amount NUMERIC(18,0) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS company_retained_rate NUMERIC(6,3) DEFAULT 0;

-- 2. BẢNG BÚT TOÁN HOA HỒNG (COMMISSION_ENTRIES) ĐA TẦNG
CREATE TABLE IF NOT EXISTS commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_name VARCHAR(255),
  recipient_role VARCHAR(50) NOT NULL,
  tier VARCHAR(50) NOT NULL CHECK (tier IN (
    'sale', 
    'team', 
    'agency_director', 
    'regional_director', 
    'ceo', 
    'department_head', 
    'ops_fund', 
    'co_sale', 
    'referrer'
  )),
  rate_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  percent NUMERIC(6,3),
  amount NUMERIC(18,0) NOT NULL DEFAULT 0,
  base_amount NUMERIC(18,0) NOT NULL DEFAULT 0,
  base_mode VARCHAR(50) DEFAULT 'contract_value' CHECK (base_mode IN ('contract_value', 'company_commission')),
  status VARCHAR(50) NOT NULL DEFAULT 'expected' CHECK (status IN (
    'expected', 
    'eligible', 
    'collected_from_developer', 
    'received', 
    'paid', 
    'clawback', 
    'unassigned'
  )),
  condition_threshold_percent NUMERIC(5,2) DEFAULT 10.0,
  clawback_source_id UUID REFERENCES commission_entries(id) ON DELETE SET NULL,
  policy_version VARCHAR(50) DEFAULT '2026.v1',
  policy_version_id VARCHAR(50),
  pit_tax_percent NUMERIC(5,2) DEFAULT 0,
  pit_tax_amount NUMERIC(18,0) DEFAULT 0,
  net_payable_amount NUMERIC(18,0) DEFAULT 0,
  eligible_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  request_id VARCHAR(100),
  is_sample BOOLEAN DEFAULT false,
  notes TEXT,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chỉ mục tối ưu truy vấn đối soát & báo cáo thu nhập
CREATE INDEX IF NOT EXISTS idx_commission_entries_recipient ON commission_entries(recipient_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_commission_entries_contract ON commission_entries(contract_id, tier);
CREATE INDEX IF NOT EXISTS idx_commission_entries_status ON commission_entries(status, paid_at);
CREATE INDEX IF NOT EXISTS idx_commission_entries_agency_region ON commission_entries(agency_id, region_id);

-- 3. BẢNG GHI NHẬN LỊCH SỬ CHẠY TÍNH TOÁN HOA HỒNG (COMMISSION_RUNS)
CREATE TABLE IF NOT EXISTS commission_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triggered_by_name VARCHAR(255),
  run_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_commission_runs_contract ON commission_runs(contract_id, run_at);

-- 4. BẢNG CẤU HÌNH CHÍNH SÁCH HOA HỒNG DỰ ÁN (PROJECT_COMMISSION_POLICIES)
CREATE TABLE IF NOT EXISTS project_commission_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL DEFAULT '2026.v1',
  agency_commission_rate NUMERIC(6,3) NOT NULL DEFAULT 3.5,
  base_mode VARCHAR(50) NOT NULL DEFAULT 'contract_value' CHECK (base_mode IN ('contract_value', 'company_commission')),
  team_split_mode VARCHAR(50) NOT NULL DEFAULT 'leader_only' CHECK (team_split_mode IN ('leader_only', 'equal', 'by_ratio')),
  withholding_rate NUMERIC(5,2) DEFAULT 0,
  tier_rates JSONB NOT NULL DEFAULT '{
    "sale": 1.5,
    "team": 0.3,
    "agency_director": 0.2,
    "regional_director": 0.1,
    "ceo": 0.05
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ROW LEVEL SECURITY (RLS) CHO SỔ CÁI HOA HỒNG (COMMISSION_ENTRIES)
ALTER TABLE commission_entries ENABLE ROW LEVEL SECURITY;

-- Xóa chính sách cũ nếu có
DROP POLICY IF EXISTS rls_commission_entries_select ON commission_entries;
DROP POLICY IF EXISTS rls_commission_entries_admin_all ON commission_entries;

-- Policy SELECT: Phân quyền theo ma trận
CREATE POLICY rls_commission_entries_select ON commission_entries
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Admin và CEO xem toàn bộ sổ cái
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
    OR
    -- 2. Tự xem bút toán của chính mình
    recipient_id = auth.uid()
    OR
    -- 3. Giám đốc Vùng: xem các sàn thuộc vùng của mình
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'regional_director' 
        AND p.region_id = commission_entries.region_id
    )
    OR
    -- 4. Giám đốc Sàn: xem các bút toán trong sàn của mình
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'director' 
        AND p.agency_id = commission_entries.agency_id
    )
  );

-- Policy Quản trị: Admin/CEO có toàn quyền thêm/sửa/xóa có kiểm soát
CREATE POLICY rls_commission_entries_admin_all ON commission_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'ceo')
    )
  );

-- 6. RPC: GÁN NGƯỜI NHẬN CHO TẦNG KHUYẾT (ASSIGN_COMMISSION_RECIPIENT)
CREATE OR REPLACE FUNCTION assign_commission_recipient(
  p_entry_id UUID,
  p_new_recipient_id UUID,
  p_reason TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role VARCHAR(50);
  v_new_name VARCHAR(255);
  v_entry RECORD;
BEGIN
  -- Kiểm tra độ dài lý do >= 10 ký tự
  IF length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'invalid_reason: Lý do gán người nhận phải có ít nhất 10 ký tự!';
  END IF;

  -- Kiểm tra quyền người thao tác
  SELECT role INTO v_actor_role FROM profiles WHERE id = p_actor_id;
  IF v_actor_role NOT IN ('admin', 'ceo', 'director', 'regional_director') THEN
    RAISE EXCEPTION 'forbidden: Bạn không có thẩm quyền gán người nhận hoa hồng.';
  END IF;

  -- Lấy tên nhân sự mới
  SELECT full_name INTO v_new_name FROM profiles WHERE id = p_new_recipient_id;
  IF v_new_name IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found: Không tìm thấy nhân sự được chỉ định.';
  END IF;

  -- Cập nhật bút toán
  SELECT * INTO v_entry FROM commission_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_not_found: Không tìm thấy bút toán hoa hồng.';
  END IF;

  UPDATE commission_entries
  SET 
    recipient_id = p_new_recipient_id,
    recipient_name = v_new_name,
    status = CASE WHEN status = 'unassigned' THEN 'eligible' ELSE status END,
    notes = coalesce(notes || ' | ', '') || 'Gán người nhận bởi ' || p_actor_id || ': ' || p_reason,
    updated_at = now()
  WHERE id = p_entry_id;

  -- Ghi Audit Log
  INSERT INTO audit_logs (
    id,
    actor_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_actor_id,
    p_actor_id,
    'commission_recipient_assigned',
    'commission_entries',
    p_entry_id::text,
    jsonb_build_object('recipient_id', v_entry.recipient_id, 'recipient_name', v_entry.recipient_name, 'status', v_entry.status),
    jsonb_build_object('recipient_id', p_new_recipient_id, 'recipient_name', v_new_name, 'reason', p_reason),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'recipient_id', p_new_recipient_id,
    'recipient_name', v_new_name
  );
END;
$$;
