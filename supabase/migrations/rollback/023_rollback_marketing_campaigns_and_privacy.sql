-- ========================================================
-- ROLLBACK MIGRATION 023: MARKETING CAMPAIGNS & PRIVACY REQUESTS
-- ========================================================

DROP TABLE IF EXISTS public.privacy_requests CASCADE;
DROP TABLE IF EXISTS public.campaign_daily_costs CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
