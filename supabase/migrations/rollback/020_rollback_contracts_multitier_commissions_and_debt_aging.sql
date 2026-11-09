-- ========================================================
-- ROLLBACK 020: CONTRACTS, MULTI-TIER COMMISSIONS, CONTRACT REVISIONS & DEBT AGING
-- ========================================================

DROP FUNCTION IF EXISTS public.approve_contract_revision(UUID, UUID, TEXT, TEXT);

DROP TABLE IF EXISTS public.bank_statements CASCADE;
DROP TABLE IF EXISTS public.contract_revisions CASCADE;
DROP TABLE IF EXISTS public.commission_entries CASCADE;
DROP TABLE IF EXISTS public.contract_installments CASCADE;
