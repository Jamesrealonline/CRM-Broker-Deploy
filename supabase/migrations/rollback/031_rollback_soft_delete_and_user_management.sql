-- ========================================================
-- ROLLBACK 031: SOFT DELETE & USER MANAGEMENT EXTENSIONS
-- ========================================================

DROP INDEX IF EXISTS public.idx_profiles_deleted_at;

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS delete_reason,
DROP COLUMN IF EXISTS deleted_by,
DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (
    status IN ('active', 'inactive', 'locked')
);
