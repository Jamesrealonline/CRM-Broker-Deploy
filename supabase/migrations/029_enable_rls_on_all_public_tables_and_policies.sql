-- ========================================================
-- REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
-- MIGRATION 029: ENABLE ROW-LEVEL SECURITY (RLS) ON ALL PUBLIC TABLES
-- Fix Supabase Security Advisor Linter: rls_disabled_in_public & rls_enabled_no_policy
-- ========================================================

-- 1. BẬT RLS (ROW LEVEL SECURITY) TRÊN 20 BẢNG PUBLIC CHƯA ĐƯỢC KÍCH HOẠT
ALTER TABLE public.role_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_commission_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- 2. THIẾT LẬP RLS POLICIES CHO 20 BẢNG VỪA KÍCH HOẠT

-- 2.1 BẢNG CHÍNH SÁCH HOA HỒNG (COMMISSION)
DROP POLICY IF EXISTS "role_commission_rates_select" ON public.role_commission_rates;
CREATE POLICY "role_commission_rates_select" ON public.role_commission_rates
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_commission_rates_admin" ON public.role_commission_rates;
CREATE POLICY "role_commission_rates_admin" ON public.role_commission_rates
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "commission_tiers_select" ON public.commission_tiers;
CREATE POLICY "commission_tiers_select" ON public.commission_tiers
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "commission_tiers_admin" ON public.commission_tiers;
CREATE POLICY "commission_tiers_admin" ON public.commission_tiers
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "project_commission_policies_select" ON public.project_commission_policies;
CREATE POLICY "project_commission_policies_select" ON public.project_commission_policies
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "project_commission_policies_admin" ON public.project_commission_policies;
CREATE POLICY "project_commission_policies_admin" ON public.project_commission_policies
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo'));

-- 2.2 BẢNG VẬN HÀNH LEAD & GIỎ HÀNG
DROP POLICY IF EXISTS "lead_loss_reasons_select" ON public.lead_loss_reasons;
CREATE POLICY "lead_loss_reasons_select" ON public.lead_loss_reasons
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lead_loss_reasons_admin" ON public.lead_loss_reasons;
CREATE POLICY "lead_loss_reasons_admin" ON public.lead_loss_reasons
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "lead_appointments_select" ON public.lead_appointments;
CREATE POLICY "lead_appointments_select" ON public.lead_appointments
    FOR SELECT TO authenticated 
    USING (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

DROP POLICY IF EXISTS "lead_appointments_insert" ON public.lead_appointments;
CREATE POLICY "lead_appointments_insert" ON public.lead_appointments
    FOR INSERT TO authenticated 
    WITH CHECK (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

DROP POLICY IF EXISTS "lead_appointments_update" ON public.lead_appointments;
CREATE POLICY "lead_appointments_update" ON public.lead_appointments
    FOR UPDATE TO authenticated 
    USING (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'))
    WITH CHECK (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

DROP POLICY IF EXISTS "lead_appointments_delete" ON public.lead_appointments;
CREATE POLICY "lead_appointments_delete" ON public.lead_appointments
    FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "lead_assignment_history_select" ON public.lead_assignment_history;
CREATE POLICY "lead_assignment_history_select" ON public.lead_assignment_history
    FOR SELECT TO authenticated 
    USING (is_admin() OR to_sale_id = auth.uid() OR from_sale_id = auth.uid() OR assigned_to = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

DROP POLICY IF EXISTS "lead_assignment_history_insert" ON public.lead_assignment_history;
CREATE POLICY "lead_assignment_history_insert" ON public.lead_assignment_history
    FOR INSERT TO authenticated 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

DROP POLICY IF EXISTS "unit_holds_select" ON public.unit_holds;
CREATE POLICY "unit_holds_select" ON public.unit_holds
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "unit_holds_manage" ON public.unit_holds;
CREATE POLICY "unit_holds_manage" ON public.unit_holds
    FOR ALL TO authenticated 
    USING (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader', 'sale_agent')) 
    WITH CHECK (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader', 'sale_agent'));

DROP POLICY IF EXISTS "unit_waitlist_select" ON public.unit_waitlist;
CREATE POLICY "unit_waitlist_select" ON public.unit_waitlist
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "unit_waitlist_manage" ON public.unit_waitlist;
CREATE POLICY "unit_waitlist_manage" ON public.unit_waitlist
    FOR ALL TO authenticated 
    USING (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader', 'sale_agent')) 
    WITH CHECK (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader', 'sale_agent'));

-- 2.3 BẢNG QUẢN LÝ NHÂN SỰ & TUYỂN DỤNG (HR)
DROP POLICY IF EXISTS "leave_types_select" ON public.leave_types;
CREATE POLICY "leave_types_select" ON public.leave_types
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "leave_types_admin" ON public.leave_types;
CREATE POLICY "leave_types_admin" ON public.leave_types
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() = 'hr_admin') 
    WITH CHECK (is_admin() OR get_current_user_role() = 'hr_admin');

DROP POLICY IF EXISTS "leave_balances_select" ON public.leave_balances;
CREATE POLICY "leave_balances_select" ON public.leave_balances
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "leave_balances_manage" ON public.leave_balances;
CREATE POLICY "leave_balances_manage" ON public.leave_balances
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin'));

DROP POLICY IF EXISTS "job_requisitions_select" ON public.job_requisitions;
CREATE POLICY "job_requisitions_select" ON public.job_requisitions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "job_requisitions_manage" ON public.job_requisitions;
CREATE POLICY "job_requisitions_manage" ON public.job_requisitions
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "candidates_select" ON public.candidates;
CREATE POLICY "candidates_select" ON public.candidates
    FOR SELECT TO authenticated 
    USING (is_admin() OR referrer_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "candidates_manage" ON public.candidates;
CREATE POLICY "candidates_manage" ON public.candidates
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "candidate_interviews_select" ON public.candidate_interviews;
CREATE POLICY "candidate_interviews_select" ON public.candidate_interviews
    FOR SELECT TO authenticated 
    USING (is_admin() OR interviewer_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "candidate_interviews_manage" ON public.candidate_interviews;
CREATE POLICY "candidate_interviews_manage" ON public.candidate_interviews
    FOR ALL TO authenticated 
    USING (is_admin() OR interviewer_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin')) 
    WITH CHECK (is_admin() OR interviewer_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "onboarding_tasks_select" ON public.onboarding_tasks;
CREATE POLICY "onboarding_tasks_select" ON public.onboarding_tasks
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR assigned_mentor_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "onboarding_tasks_manage" ON public.onboarding_tasks;
CREATE POLICY "onboarding_tasks_manage" ON public.onboarding_tasks
    FOR ALL TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR assigned_mentor_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin')) 
    WITH CHECK (is_admin() OR user_id = auth.uid() OR assigned_mentor_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "performance_targets_select" ON public.performance_targets;
CREATE POLICY "performance_targets_select" ON public.performance_targets
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR created_by = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader', 'hr_admin'));

DROP POLICY IF EXISTS "performance_targets_manage" ON public.performance_targets;
CREATE POLICY "performance_targets_manage" ON public.performance_targets
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'hr_admin'));

DROP POLICY IF EXISTS "performance_reviews_select" ON public.performance_reviews;
CREATE POLICY "performance_reviews_select" ON public.performance_reviews
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR reviewer_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "performance_reviews_manage" ON public.performance_reviews;
CREATE POLICY "performance_reviews_manage" ON public.performance_reviews
    FOR ALL TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR reviewer_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin')) 
    WITH CHECK (is_admin() OR user_id = auth.uid() OR reviewer_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "disciplinary_records_select" ON public.disciplinary_records;
CREATE POLICY "disciplinary_records_select" ON public.disciplinary_records
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR issued_by = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'hr_admin'));

DROP POLICY IF EXISTS "disciplinary_records_manage" ON public.disciplinary_records;
CREATE POLICY "disciplinary_records_manage" ON public.disciplinary_records
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin'));

-- 2.4 BẢNG LOG VẬN HÀNH & HỆ THỐNG
DROP POLICY IF EXISTS "notification_logs_select" ON public.notification_logs;
CREATE POLICY "notification_logs_select" ON public.notification_logs
    FOR SELECT TO authenticated 
    USING (is_admin() OR recipient_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "notification_logs_insert" ON public.notification_logs;
CREATE POLICY "notification_logs_insert" ON public.notification_logs
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notification_logs_admin" ON public.notification_logs;
CREATE POLICY "notification_logs_admin" ON public.notification_logs
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "job_runs_select" ON public.job_runs;
CREATE POLICY "job_runs_select" ON public.job_runs
    FOR SELECT TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "job_runs_admin" ON public.job_runs;
CREATE POLICY "job_runs_admin" ON public.job_runs
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "dead_letter_queue_select" ON public.dead_letter_queue;
CREATE POLICY "dead_letter_queue_select" ON public.dead_letter_queue
    FOR SELECT TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "dead_letter_queue_admin" ON public.dead_letter_queue;
CREATE POLICY "dead_letter_queue_admin" ON public.dead_letter_queue
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());


-- 3. BỔ SUNG POLICIES CHO 15 BẢNG ĐÃ BẬT RLS NHƯNG CHƯA CÓ POLICIES

-- 3.1 ai_usage_logs
DROP POLICY IF EXISTS "ai_usage_logs_select" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_select" ON public.ai_usage_logs
    FOR SELECT TO authenticated USING (is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "ai_usage_logs_insert" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_insert" ON public.ai_usage_logs
    FOR INSERT TO authenticated WITH CHECK (is_admin() OR user_id = auth.uid());

-- 3.2 broker_certificates
DROP POLICY IF EXISTS "broker_certificates_select" ON public.broker_certificates;
CREATE POLICY "broker_certificates_select" ON public.broker_certificates
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "broker_certificates_manage" ON public.broker_certificates;
CREATE POLICY "broker_certificates_manage" ON public.broker_certificates
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin'));

-- 3.3 customer_personas
DROP POLICY IF EXISTS "customer_personas_select" ON public.customer_personas;
CREATE POLICY "customer_personas_select" ON public.customer_personas
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "customer_personas_manage" ON public.customer_personas;
CREATE POLICY "customer_personas_manage" ON public.customer_personas
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'marketing_manager')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'marketing_manager'));

-- 3.4 deals
DROP POLICY IF EXISTS "deals_select" ON public.deals;
CREATE POLICY "deals_select" ON public.deals
    FOR SELECT TO authenticated 
    USING (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

DROP POLICY IF EXISTS "deals_manage" ON public.deals;
CREATE POLICY "deals_manage" ON public.deals
    FOR ALL TO authenticated 
    USING (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader')) 
    WITH CHECK (is_admin() OR sale_id = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

-- 3.5 employee_documents
DROP POLICY IF EXISTS "employee_documents_select" ON public.employee_documents;
CREATE POLICY "employee_documents_select" ON public.employee_documents
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "employee_documents_manage" ON public.employee_documents;
CREATE POLICY "employee_documents_manage" ON public.employee_documents
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin'));

-- 3.6 employee_records
DROP POLICY IF EXISTS "employee_records_select" ON public.employee_records;
CREATE POLICY "employee_records_select" ON public.employee_records
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "employee_records_manage" ON public.employee_records;
CREATE POLICY "employee_records_manage" ON public.employee_records
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin'));

-- 3.7 employment_contracts
DROP POLICY IF EXISTS "employment_contracts_select" ON public.employment_contracts;
CREATE POLICY "employment_contracts_select" ON public.employment_contracts
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "employment_contracts_manage" ON public.employment_contracts;
CREATE POLICY "employment_contracts_manage" ON public.employment_contracts
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin'));

-- 3.8 lead_assignments
DROP POLICY IF EXISTS "lead_assignments_select" ON public.lead_assignments;
CREATE POLICY "lead_assignments_select" ON public.lead_assignments
    FOR SELECT TO authenticated 
    USING (is_admin() OR new_assignee = auth.uid() OR previous_assignee = auth.uid() OR assigned_by = auth.uid() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

DROP POLICY IF EXISTS "lead_assignments_manage" ON public.lead_assignments;
CREATE POLICY "lead_assignments_manage" ON public.lead_assignments
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'regional_director', 'sales_manager', 'team_leader'));

-- 3.9 lead_status_history
DROP POLICY IF EXISTS "lead_status_history_select" ON public.lead_status_history;
CREATE POLICY "lead_status_history_select" ON public.lead_status_history
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lead_status_history_insert" ON public.lead_status_history;
CREATE POLICY "lead_status_history_insert" ON public.lead_status_history
    FOR INSERT TO authenticated WITH CHECK (true);

-- 3.10 leave_requests
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR substitute_user_id = auth.uid() OR approved_by = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "leave_requests_manage" ON public.leave_requests;
CREATE POLICY "leave_requests_manage" ON public.leave_requests
    FOR ALL TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo')) 
    WITH CHECK (is_admin() OR user_id = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

-- 3.11 login_attempts
DROP POLICY IF EXISTS "login_attempts_select" ON public.login_attempts;
CREATE POLICY "login_attempts_select" ON public.login_attempts
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "login_attempts_insert" ON public.login_attempts;
CREATE POLICY "login_attempts_insert" ON public.login_attempts
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "login_attempts_update" ON public.login_attempts;
CREATE POLICY "login_attempts_update" ON public.login_attempts
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 3.12 personnel_events
DROP POLICY IF EXISTS "personnel_events_select" ON public.personnel_events;
CREATE POLICY "personnel_events_select" ON public.personnel_events
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR actor_id = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "personnel_events_manage" ON public.personnel_events;
CREATE POLICY "personnel_events_manage" ON public.personnel_events
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'hr_admin'));

-- 3.13 personnel_transfer_requests
DROP POLICY IF EXISTS "personnel_transfer_requests_select" ON public.personnel_transfer_requests;
CREATE POLICY "personnel_transfer_requests_select" ON public.personnel_transfer_requests
    FOR SELECT TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR requested_by = auth.uid() OR approved_by = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

DROP POLICY IF EXISTS "personnel_transfer_requests_manage" ON public.personnel_transfer_requests;
CREATE POLICY "personnel_transfer_requests_manage" ON public.personnel_transfer_requests
    FOR ALL TO authenticated 
    USING (is_admin() OR user_id = auth.uid() OR requested_by = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo')) 
    WITH CHECK (is_admin() OR user_id = auth.uid() OR requested_by = auth.uid() OR get_current_user_role() IN ('admin', 'hr_admin', 'director', 'ceo'));

-- 3.14 project_sources
DROP POLICY IF EXISTS "project_sources_select" ON public.project_sources;
CREATE POLICY "project_sources_select" ON public.project_sources
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "project_sources_manage" ON public.project_sources;
CREATE POLICY "project_sources_manage" ON public.project_sources
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'marketing_manager')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'marketing_manager'));

-- 3.15 team_members
DROP POLICY IF EXISTS "team_members_select" ON public.team_members;
CREATE POLICY "team_members_select" ON public.team_members
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team_members_manage" ON public.team_members;
CREATE POLICY "team_members_manage" ON public.team_members
    FOR ALL TO authenticated 
    USING (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'sales_manager', 'team_leader', 'hr_admin')) 
    WITH CHECK (is_admin() OR get_current_user_role() IN ('admin', 'director', 'ceo', 'sales_manager', 'team_leader', 'hr_admin'));
