-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 016: EXPANDED LEAD SOURCES & PROGRESSIVE COMMISSION
-- Bổ sung nguồn khách hàng chuẩn & RLS cho phép thêm mới nguồn lead
-- ========================================================

-- 1. BỔ SUNG CÁC NGUỒN LEAD CHUẨN VÀO BẢNG LEAD_SOURCES
INSERT INTO lead_sources (code, name, is_active)
VALUES
    ('hotline', 'Hotline', true),
    ('facebook', 'Facebook', true),
    ('truc_nha_mau', 'Trực nhà mẫu', true),
    ('to_roi', 'Tờ rơi', true),
    ('email', 'Email', true),
    ('zalo', 'Zalo', true),
    ('tiktok', 'TikTok', true),
    ('truc_quan_cafe', 'Trực quán cafe', true),
    ('nguon_cua_sale', 'Nguồn của sale', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, is_active = true;

-- 2. CHO PHÉP NGƯỜI DÙNG THÊM MỚI NGUỒN LEAD QUA RLS
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_sources_select_all" ON lead_sources;
CREATE POLICY "lead_sources_select_all" ON lead_sources
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "lead_sources_insert_authenticated" ON lead_sources;
CREATE POLICY "lead_sources_insert_authenticated" ON lead_sources
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "lead_sources_update_authenticated" ON lead_sources;
CREATE POLICY "lead_sources_update_authenticated" ON lead_sources
    FOR UPDATE TO authenticated
    USING (current_role() IN ('admin', 'director', 'sales_manager', 'marketing_manager'));
