-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 005: FINANCIALS, CONTRACTS & COMMISSIONS MODULE
-- Hỗ trợ thông tin hoa hồng dự án, tiến độ hợp đồng & thi đua
-- ========================================================

-- 1. Bổ sung trường chính sách hoa hồng cho bảng projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 3.5,
ADD COLUMN IF NOT EXISTS progressive_commission TEXT DEFAULT 'Đạt >= 5 căn: +0.3%, Đạt >= 10 căn: +0.6%',
ADD COLUMN IF NOT EXISTS sale_commission_rate NUMERIC DEFAULT 1.5;

-- 2. Bổ sung trường chi tiết hợp đồng & dòng tiền cho bảng transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS unit_code VARCHAR,
ADD COLUMN IF NOT EXISTS deal_value NUMERIC,
ADD COLUMN IF NOT EXISTS commission_amount NUMERIC,
ADD COLUMN IF NOT EXISTS sale_commission_rate NUMERIC DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS sale_commission_amount NUMERIC,
ADD COLUMN IF NOT EXISTS deposit_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contract_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS first_installment_amount NUMERIC,
ADD COLUMN IF NOT EXISTS first_installment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS first_installment_paid BOOLEAN DEFAULT FALSE;

-- 3. Tạo View tổng hợp hiệu suất dự án (Project Performance View)
CREATE OR REPLACE VIEW public.project_performance_summary AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.code AS project_code,
    p.commission_rate,
    p.progressive_commission,
    p.sale_commission_rate,
    COUNT(CASE WHEN t.type = 'contract' AND t.status = 'confirmed' THEN 1 END) AS total_contracts,
    COALESCE(SUM(CASE WHEN t.type = 'contract' AND t.status = 'confirmed' THEN COALESCE(t.deal_value, t.amount) ELSE 0 END), 0) AS total_revenue,
    COALESCE(SUM(CASE WHEN t.type = 'contract' AND t.status = 'confirmed' THEN COALESCE(t.commission_amount, 0) ELSE 0 END), 0) AS total_commission
FROM public.projects p
LEFT JOIN public.leads l ON l.project_id = p.id
LEFT JOIN public.transactions t ON t.lead_id = l.id
GROUP BY p.id, p.name, p.code, p.commission_rate, p.progressive_commission, p.sale_commission_rate;
