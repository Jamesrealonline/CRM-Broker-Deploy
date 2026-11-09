-- ========================================================
-- MIGRATION 023: MARKETING CAMPAIGNS & PRIVACY REQUESTS
-- ========================================================

-- 1. BẢNG CHIẾN DỊCH MARKETING (campaigns)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    budget NUMERIC(15, 2) DEFAULT 0 CHECK (budget >= 0),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    utm_source TEXT,
    utm_campaign TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_channel ON public.campaigns(channel);

-- 2. BẢNG CHI PHÍ THEO NGÀY (campaign_daily_costs)
CREATE TABLE IF NOT EXISTS public.campaign_daily_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    cost_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_campaign_cost_date UNIQUE (campaign_id, cost_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_costs_campaign ON public.campaign_daily_costs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_daily_costs_date ON public.campaign_daily_costs(cost_date);

-- 3. BẢNG YÊU CẦU QUYỀN RIÊNG TƯ (privacy_requests)
CREATE TABLE IF NOT EXISTS public.privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    request_type TEXT NOT NULL CHECK (request_type IN ('export', 'anonymize')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
    reason TEXT,
    requested_by UUID NOT NULL REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_customer ON public.privacy_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_privacy_status ON public.privacy_requests(status);

-- 4. BẬT RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_daily_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES
CREATE POLICY p_campaigns_select ON public.campaigns
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_daily_costs_select ON public.campaign_daily_costs
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_privacy_requests_select ON public.privacy_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'compliance_officer'))
    );
