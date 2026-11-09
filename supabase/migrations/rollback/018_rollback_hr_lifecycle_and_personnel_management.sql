-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- ROLLBACK MIGRATION 018: HR LIFECYCLE & PERSONNEL MANAGEMENT
-- ========================================================

DROP FUNCTION IF EXISTS public.reveal_employee_private_field(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.apply_personnel_transfer(UUID, UUID);

DROP TABLE IF EXISTS public.onboarding_tasks CASCADE;
DROP TABLE IF EXISTS public.disciplinary_records CASCADE;
DROP TABLE IF EXISTS public.performance_reviews CASCADE;
DROP TABLE IF EXISTS public.coaching_notes CASCADE;
DROP TABLE IF EXISTS public.performance_targets CASCADE;
DROP TABLE IF EXISTS public.candidate_interviews CASCADE;
DROP TABLE IF EXISTS public.candidates CASCADE;
DROP TABLE IF EXISTS public.job_requisitions CASCADE;
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TABLE IF EXISTS public.leave_balances CASCADE;
DROP TABLE IF EXISTS public.leave_types CASCADE;
DROP TABLE IF EXISTS public.employee_documents CASCADE;
DROP TABLE IF EXISTS public.broker_certificates CASCADE;
DROP TABLE IF EXISTS public.employment_contracts CASCADE;
DROP TABLE IF EXISTS public.personnel_transfer_requests CASCADE;
DROP TABLE IF EXISTS public.personnel_events CASCADE;
DROP TABLE IF EXISTS public.employee_private CASCADE;
DROP TABLE IF EXISTS public.employee_records CASCADE;

-- Khôi phục check constraint của profiles(role)
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
        role IN (
            'admin', 
            'director', 
            'marketing_manager', 
            'sales_manager', 
            'team_leader', 
            'sale_agent'
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
