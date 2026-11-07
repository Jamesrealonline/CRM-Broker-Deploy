-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 006: COMMISSION POLICIES, TIERS, ROLE RATES & SNAPSHOTS
-- ========================================================

-- 1. Bảng chính sách hoa hồng dự án
CREATE TABLE IF NOT EXISTS public.project_commission_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    company_commission_rate NUMERIC NOT NULL DEFAULT 3.5, -- % CĐT chi trả
    recognition_milestone VARCHAR NOT NULL DEFAULT 'first_installment', -- 'deposit' | 'contract' | 'first_installment'
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bậc hoa hồng lũy tiến
CREATE TABLE IF NOT EXISTS public.commission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES public.project_commission_policies(id) ON DELETE CASCADE,
    tier_type VARCHAR NOT NULL DEFAULT 'contract_count', -- 'contract_count' hoặc 'deal_value'
    min_threshold NUMERIC NOT NULL,
    max_threshold NUMERIC, -- NULL nghĩa là vượt mốc
    bonus_rate NUMERIC NOT NULL, -- % cộng thêm
    target_role VARCHAR DEFAULT 'all', -- 'all', 'sale_agent', 'team_leader'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Phân bổ tỷ lệ hoa hồng Sale theo cấp bậc/vai trò
CREATE TABLE IF NOT EXISTS public.role_commission_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES public.project_commission_policies(id) ON DELETE CASCADE,
    role VARCHAR NOT NULL, -- 'sale_agent', 'team_leader', 'sales_manager', 'director'
    default_rate NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bổ sung trường snapshot chính sách và tồn kho sản phẩm vào transactions & projects
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES public.project_commission_policies(id),
ADD COLUMN IF NOT EXISTS commission_status VARCHAR DEFAULT 'pending', -- 'pending' | 'eligible' | 'paid'
ADD COLUMN IF NOT EXISTS recognized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS progressive_bonus_applied NUMERIC DEFAULT 0;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS total_units INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS recognition_milestone VARCHAR DEFAULT 'first_installment';
