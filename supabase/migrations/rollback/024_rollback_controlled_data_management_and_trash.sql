-- ========================================================
-- ROLLBACK MIGRATION 024: CONTROLLED DATA MANAGEMENT & TRASH BIN
-- ========================================================

DROP TABLE IF EXISTS public.trash_bins CASCADE;

ALTER TABLE public.teams
DROP COLUMN IF EXISTS version,
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS deleted_by,
DROP COLUMN IF EXISTS delete_reason;

ALTER TABLE public.transactions
DROP COLUMN IF EXISTS version,
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS deleted_by,
DROP COLUMN IF EXISTS delete_reason;

ALTER TABLE public.leads
DROP COLUMN IF EXISTS version,
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS deleted_by,
DROP COLUMN IF EXISTS delete_reason;
