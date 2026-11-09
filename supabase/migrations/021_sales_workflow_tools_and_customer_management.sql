-- ========================================================
-- MIGRATION 021: SALES WORKFLOW TOOLS, QUOTATIONS & CUSTOMER MANAGEMENT
-- ========================================================

-- 1. BẢNG PHIẾU BÁO GIÁ SNAPSHOT (KHÔNG CHỨA HOA HỒNG)
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    unit_code TEXT NOT NULL,
    deal_value NUMERIC(15, 2) NOT NULL CHECK (deal_value > 0),
    discount_amount NUMERIC(15, 2) DEFAULT 0 CHECK (discount_amount >= 0),
    final_price NUMERIC(15, 2) NOT NULL CHECK (final_price > 0),
    payment_plan_summary JSONB DEFAULT '{}'::jsonb,
    valid_until TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotations_lead ON public.quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_code ON public.quotations(code);
CREATE INDEX IF NOT EXISTS idx_quotations_project ON public.quotations(project_id);

-- 2. BẢNG THEO DÕI NHẬP DỮ LIỆU THEO LÔ (import_batches)
CREATE TABLE IF NOT EXISTS public.import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    total_rows INT NOT NULL CHECK (total_rows >= 0),
    success_rows INT NOT NULL DEFAULT 0 CHECK (success_rows >= 0),
    error_rows INT NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
    status TEXT NOT NULL DEFAULT 'imported' CHECK (status IN ('imported', 'reverted')),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    reverted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_batches_status ON public.import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_created_by ON public.import_batches(created_by);

-- 3. BẢNG TRUY VẾT HỢP NHẤT KHÁCH HÀNG (customer_merges)
CREATE TABLE IF NOT EXISTS public.customer_merges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_customer_id UUID NOT NULL REFERENCES public.customers(id),
    merged_customer_id UUID NOT NULL REFERENCES public.customers(id),
    merged_by UUID NOT NULL REFERENCES public.profiles(id),
    merged_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reverted')),
    reverted_at TIMESTAMPTZ,
    audit_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_merges_primary ON public.customer_merges(primary_customer_id);
CREATE INDEX IF NOT EXISTS idx_merges_merged ON public.customer_merges(merged_customer_id);

-- 4. BẢNG DÒNG THỜI GIAN ĐA KÊNH (interaction_timeline)
CREATE TABLE IF NOT EXISTS public.interaction_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('call', 'zalo', 'sms', 'email')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_lead ON public.interaction_timeline(lead_id);
CREATE INDEX IF NOT EXISTS idx_timeline_channel ON public.interaction_timeline(channel);

-- 5. BẬT RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_timeline ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES
CREATE POLICY p_quotations_select ON public.quotations
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_import_batches_select ON public.import_batches
    FOR SELECT USING (
        auth.uid() = created_by OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'sales_manager'))
    );

CREATE POLICY p_customer_merges_select ON public.customer_merges
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'sales_manager'))
    );

CREATE POLICY p_timeline_select ON public.interaction_timeline
    FOR SELECT USING (auth.uid() IS NOT NULL);
