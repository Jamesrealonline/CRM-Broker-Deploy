-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- ROLLBACK MIGRATION 019: SLA ANTI-CHEAT, UNIT HOLDS & JOB MONITORING
-- ========================================================

DROP FUNCTION IF EXISTS public.release_expired_unit_holds();
DROP FUNCTION IF EXISTS public.claim_pool_lead(UUID, UUID);

DROP TABLE IF EXISTS public.dead_letter_queue CASCADE;
DROP TABLE IF EXISTS public.job_runs CASCADE;
DROP TABLE IF EXISTS public.unit_waitlist CASCADE;
DROP TABLE IF EXISTS public.unit_holds CASCADE;

ALTER TABLE public.leads
DROP COLUMN IF EXISTS loss_reason_code,
DROP COLUMN IF EXISTS loss_reason_detail,
DROP COLUMN IF EXISTS nurture_reminder_date,
DROP COLUMN IF EXISTS sla_reset_count,
DROP COLUMN IF EXISTS sla_flags;

DROP TABLE IF EXISTS public.lead_loss_reasons CASCADE;
DROP TABLE IF EXISTS public.lead_appointments CASCADE;
