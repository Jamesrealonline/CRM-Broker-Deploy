-- ========================================================
-- ROLLBACK 022: STRICT SALE CHAIN & HIERARCHY
-- ========================================================

DROP FUNCTION IF EXISTS public.validate_sale_chain(UUID);
DROP VIEW IF EXISTS public.v_sale_chain;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS acting_until;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_acting;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS marketing_unit_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS department_id;

ALTER TABLE public.teams DROP COLUMN IF EXISTS leader_id;
ALTER TABLE public.teams DROP COLUMN IF EXISTS department_id;

DROP TABLE IF EXISTS public.marketing_units CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
