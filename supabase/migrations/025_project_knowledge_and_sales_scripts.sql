-- ========================================================
-- MIGRATION 025: PROJECT KNOWLEDGE BASE & SALES SCRIPTS (PHASE 8)
-- ========================================================

-- 1. BẢNG KHO TRI THỨC DỰ ÁN (project_knowledge_items)
CREATE TABLE IF NOT EXISTS public.project_knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'usp', 'location', 'product', 'price_policy', 
        'legal', 'construction_progress', 'developer', 
        'competitor_comparison', 'faq', 'objection_handling'
    )),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pki_project ON public.project_knowledge_items(project_id);
CREATE INDEX IF NOT EXISTS idx_pki_category ON public.project_knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_pki_status ON public.project_knowledge_items(status);

-- 2. BẢNG MẪU KỊCH BẢN BÁN HÀNG ĐA NGỮ CẢNH (script_templates)
CREATE TABLE IF NOT EXISTS public.script_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    context_code TEXT NOT NULL CHECK (context_code IN (
        'approach', 'qualifying', 'introduction', 'appointment', 
        'objection', 'closing', 'post_contract', 're_engage', 'special'
    )),
    journey_stage TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('call', 'zalo', 'sms', 'email', 'in_person')),
    persona TEXT,
    tone TEXT NOT NULL DEFAULT 'professional' CHECK (tone IN ('friendly', 'professional', 'concise')),
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    opening TEXT NOT NULL,
    questions TEXT,
    main_content TEXT NOT NULL,
    objection_handling TEXT,
    cta TEXT NOT NULL,
    compliance_notes TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    version INT NOT NULL DEFAULT 1,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_context ON public.script_templates(context_code);
CREATE INDEX IF NOT EXISTS idx_scripts_channel ON public.script_templates(channel);

-- 3. BẢNG GHI NHẬN SỬ DỤNG VÀ ĐÁNH GIÁ HIỆU QUẢ SCRIPT (script_usages)
CREATE TABLE IF NOT EXISTS public.script_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES public.script_templates(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.profiles(id),
    channel TEXT NOT NULL,
    outcome TEXT CHECK (outcome IN ('responded', 'appointment_set', 'stage_advanced', 'rejected', 'no_answer')),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_usages_script ON public.script_usages(script_id);
CREATE INDEX IF NOT EXISTS idx_script_usages_lead ON public.script_usages(lead_id);

-- 4. BẢNG NHẮC VIỆC CHĂM SÓC (care_tasks)
CREATE TABLE IF NOT EXISTS public.care_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    script_id UUID REFERENCES public.script_templates(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_tasks_sale ON public.care_tasks(sale_id, status);
CREATE INDEX IF NOT EXISTS idx_care_tasks_lead ON public.care_tasks(lead_id);

-- 5. BẬT RLS
ALTER TABLE public.project_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_pki_select ON public.project_knowledge_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_scripts_select ON public.script_templates
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_usages_select ON public.script_usages
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_care_tasks_select ON public.care_tasks
    FOR SELECT USING (auth.uid() IS NOT NULL);
