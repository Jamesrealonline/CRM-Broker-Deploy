-- ========================================================
-- MIGRATION 022: STRICT SALE CHAIN & HIERARCHY (PHASE 5.0A)
-- ========================================================

-- 1. BẢNG PHÒNG KINH DOANH (departments)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    head_id UUID REFERENCES public.profiles(id),
    director_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_agency ON public.departments(agency_id);
CREATE INDEX IF NOT EXISTS idx_dept_head ON public.departments(head_id);

-- 2. BẢNG ĐƠN VỊ MARKETING (marketing_units)
CREATE TABLE IF NOT EXISTS public.marketing_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    manager_id UUID REFERENCES public.profiles(id),
    director_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mu_manager ON public.marketing_units(manager_id);

-- 3. BỔ SUNG CỘT CHO teams & profiles
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES public.profiles(id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_unit_id UUID REFERENCES public.marketing_units(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_acting BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS acting_until TIMESTAMPTZ;

-- 4. VIEW CHUỖI BÁO CÁO DUY NHẤT (v_sale_chain)
CREATE OR REPLACE VIEW public.v_sale_chain AS
SELECT 
    p.id AS sale_id,
    p.full_name AS sale_name,
    p.team_id,
    t.leader_id,
    COALESCE(p.department_id, t.department_id) AS department_id,
    d.head_id,
    COALESCE(d.director_id, mu.director_id) AS director_id,
    p.marketing_unit_id,
    mu.manager_id AS marketing_manager_id
FROM public.profiles p
LEFT JOIN public.teams t ON p.team_id = t.id
LEFT JOIN public.departments d ON COALESCE(p.department_id, t.department_id) = d.id
LEFT JOIN public.marketing_units mu ON p.marketing_unit_id = mu.id
WHERE p.role = 'sale_agent';

-- 5. BẬT RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_dept_select ON public.departments
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY p_mu_select ON public.marketing_units
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6. RPC KIỂM TRA CHUỖI QUẢN LÝ (validate_sale_chain)
CREATE OR REPLACE FUNCTION public.validate_sale_chain(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_chain RECORD;
    v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    SELECT * INTO v_chain FROM public.v_sale_chain WHERE sale_id = p_sale_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'not_found', 'missing_links', jsonb_build_array('not_found'));
    END IF;

    IF v_chain.team_id IS NULL THEN
        v_missing := array_append(v_missing, 'missing_team');
    END IF;

    IF v_chain.leader_id IS NULL THEN
        v_missing := array_append(v_missing, 'team_without_leader');
    END IF;

    IF v_chain.department_id IS NULL OR v_chain.head_id IS NULL THEN
        v_missing := array_append(v_missing, 'department_without_head');
    END IF;

    IF v_chain.marketing_unit_id IS NULL THEN
        v_missing := array_append(v_missing, 'missing_marketing_unit');
    END IF;

    IF array_length(v_missing, 1) > 0 THEN
        RETURN jsonb_build_object('valid', false, 'missing_links', to_jsonb(v_missing));
    END IF;

    RETURN jsonb_build_object('valid', true, 'missing_links', jsonb_build_array());
END;
$$;
