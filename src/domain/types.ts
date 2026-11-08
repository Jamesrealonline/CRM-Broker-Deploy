// ========================================================
// REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
// DOMAIN TYPES & INTERFACES (TypeScript Strict)
// ========================================================

export type UserRole = 
  | 'admin' 
  | 'director' 
  | 'hr_admin'
  | 'marketing_manager' 
  | 'sales_manager' 
  | 'team_leader' 
  | 'sale_agent';

export type UserStatus = 'active' | 'inactive' | 'locked';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
  role: UserRole;
  organization_id?: string;
  agency_id?: string;
  team_id?: string;
  status: UserStatus;
  must_change_password: boolean;
  totp_enabled: boolean;
  two_factor_required?: boolean;
  encrypted_totp_secret?: string;
  backup_codes?: string[];
  two_factor_verified_at?: string;
  session_expires_at?: string;
  last_login_at?: string;
  created_at?: string;
  accepts_leads?: boolean;
  on_leave?: boolean;
  email_notifications_enabled?: boolean;
}

export type LeadStatus = 
  | 'new'              // Mới tiếp nhận
  | 'unreachable'      // Không nghe máy
  | 'invalid'          // Sai số / Không nhu cầu
  | 'contacted'        // Đã liên hệ
  | 'qualifying'       // Xác định nhu cầu
  | 'doc_sent'         // Gửi tài liệu
  | 'appointment_set'  // Đặt hẹn
  | 'consulted'        // Đã gặp tư vấn
  | 'site_visit'       // Đi xem dự án
  | 'considering'      // Đang cân nhắc
  | 'booking'          // Booking giữ chỗ
  | 'deposit'          // Đặt cọc
  | 'contract'         // Ký HĐMB
  | 'after_sales'      // Chăm sóc sau bán
  | 'lost';            // Thất bại / Đóng

export type ActivityType = 
  | 'call' 
  | 'meeting' 
  | 'site_visit' 
  | 'zalo_message' 
  | 'email' 
  | 'note' 
  | 'system';

export type TransactionType = 'booking' | 'deposit' | 'contract';
export type TransactionStatus = 'pending' | 'confirmed' | 'refunded' | 'cancelled';

export interface Organization {
  id: string;
  name: string;
  code: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Agency {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive' | 'suspended';
  director_id?: string;
  director_name?: string;
}

export interface Team {
  id: string;
  agency_id: string;
  name: string;
  code: string;
  leader_id?: string;
  leader_name?: string;
  member_count?: number;
}

export type RecognitionMilestone = 'deposit' | 'contract' | 'first_installment';

export interface CommissionTier {
  id: string;
  policy_id: string;
  tier_type: 'contract_count' | 'deal_value';
  min_threshold: number;
  max_threshold?: number | null;
  bonus_rate: number;
  target_role: string;
  is_active: boolean;
}

export interface RoleCommissionRate {
  id: string;
  policy_id: string;
  role: UserRole;
  default_rate: number;
}

export interface ProjectCommissionPolicy {
  id: string;
  project_id: string;
  company_commission_rate: number;
  recognition_milestone: RecognitionMilestone;
  valid_from: string;
  valid_to?: string | null;
  is_active: boolean;
  notes?: string;
  tiers: CommissionTier[];
  role_rates: RoleCommissionRate[];
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  developer: string;
  location: string;
  property_type: string;
  expected_price_range?: string;
  scale?: string;
  status: 'upcoming' | 'opening' | 'sold_out' | 'closed';
  commission_rate?: number;
  progressive_commission?: string;
  sale_commission_rate?: number;
  total_units?: number;
  recognition_milestone?: RecognitionMilestone;
  current_policy?: ProjectCommissionPolicy;
  policy_history?: ProjectCommissionPolicy[];
  total_revenue?: number;
  total_contracts?: number;
  sold_units_count?: number;
  created_at?: string;
}

export type UnitStatus = 'available' | 'booking' | 'deposit' | 'sold' | 'locked';

export interface ProjectUnit {
  id: string;
  project_id: string;
  project_name?: string;
  unit_code: string;           // Mã căn / Mã sản phẩm (Ví dụ: OG-S7.02-15.08, L1-08)
  property_type: string;       // Loại hình (Căn hộ 1PN, 2PN, 3PN, Penthouse, Shophouse, Nhà phố, Biệt thự...)
  block_tower?: string;        // Tòa / Phân khu (Ví dụ: Tòa S7.02, Phân khu Origami, Zone 1)
  floor?: number;              // Tầng (Ví dụ: 15)
  area_sqm?: number;           // Diện tích tim tường / thông thủy (m²)
  price: number;               // Giá bán niêm yết (VNĐ)
  direction?: string;          // Hướng ban công / cửa chính (Đông Nam, Tây Bắc...)
  status: UnitStatus;          // Trạng thái: Còn trống, Giữ chỗ, Đã cọc, Đã bán, Khóa bảng hàng
  customer_name?: string;      // Khách hàng đang giữ chỗ / cọc / mua
  sale_name?: string;          // Chuyên viên đang phụ trách giữ chỗ / cọc
  notes?: string;              // Ghi chú sản phẩm (View hồ bơi, chính sách ưu đãi riêng...)
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string;
  phone_normalized: string;
  phone_hash?: string;
  email?: string;
  identity_card?: string;
  encrypted_id_number?: string;
  address?: string;
  consent_obtained: boolean;
  consent_date?: string;
  do_not_contact?: boolean;
  anonymized_at?: string;
  created_at?: string;
}

export interface CustomerConsent {
  id: string;
  customer_id: string;
  purpose: 'marketing' | 'consultation' | 'contract';
  channel: 'phone' | 'email' | 'zalo' | 'sms';
  source?: string;
  obtained_at: string;
  is_revoked: boolean;
  revoked_at?: string;
  revoked_reason?: string;
  created_at?: string;
}

export interface LeadSource {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order?: number;
  requires_detail?: boolean;
  created_at?: string;
}

export interface Lead {
  id: string;
  organization_id?: string;
  customer_id: string;
  project_id: string;
  agency_id?: string;
  team_id?: string;
  assigned_to?: string;
  source_id?: string;
  source_detail?: string;
  created_via?: 'manual' | 'contract_form' | 'facebook' | 'landing_page' | 'api' | string;
  campaign_id?: string;
  status: LeadStatus;
  lead_score: number;
  budget_min?: number;
  budget_max?: number;
  purpose: 'residence' | 'investment' | 'both' | 'undecided';
  preferred_property_type?: string;
  notes?: string;
  lost_reason?: string;
  last_action_at?: string;
  next_follow_up?: string;
  created_at: string;
  updated_at?: string;

  // Module 7: Care Deadline 24h & Auto-transfer
  care_deadline_at?: string;
  last_care_updated_at?: string;
  auto_transfer_count?: number;
  previous_assigned_sales?: string[];
  is_exempt_auto_transfer?: boolean;
  do_not_contact?: boolean;
  customer_phone_hash?: string;
  extended_until?: string;
  extension_reason?: string;

  // Joined fields for display
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  project_name?: string;
  assigned_name?: string;
  agency_name?: string;
  team_name?: string;
  source_name?: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string;
  user_name?: string;
  type: ActivityType;
  title: string;
  content?: string;
  result?: string;
  created_at: string;
}

export interface LeadStatusHistory {
  id: string;
  lead_id: string;
  changed_by?: string;
  changer_name?: string;
  old_status?: LeadStatus;
  new_status: LeadStatus;
  notes?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  deal_id?: string;
  lead_id: string;
  type: TransactionType;
  code: string;
  amount: number;
  transaction_date: string;
  payment_method?: string;
  status: TransactionStatus;
  contract_code?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;

  // Chi tiết hợp đồng, sản phẩm & hoa hồng (Module Tài chính & Hợp đồng)
  unit_code?: string;
  deal_value?: number;
  commission_amount?: number;
  sale_commission_rate?: number;
  sale_commission_amount?: number;
  deposit_date?: string;
  contract_date?: string;
  first_installment_amount?: number;
  first_installment_date?: string;
  first_installment_paid?: boolean;
  policy_id?: string;
  commission_status?: 'pending' | 'eligible' | 'paid';
  recognized_at?: string;
  progressive_bonus_applied?: number;

  // Maker-Checker & Reversal Transaction (P1.2)
  approved_by?: string;
  approved_at?: string;
  approval_status?: 'draft' | 'pending_approval' | 'approved' | 'confirmed' | 'rejected';
  is_reversal?: boolean;
  reversal_of_id?: string;
  reversal_reason?: string;

  // Joined fields for display
  customer_name?: string;
  customer_phone?: string;
  project_id?: string;
  project_name?: string;
  agency_id?: string;
  agency_name?: string;
  team_id?: string;
  team_name?: string;
  sale_id?: string;
  sale_name?: string;
}

export interface SoldProduct {
  id: string;
  project_id: string;
  project_name?: string;
  unit_code: string;
  property_type: string;
  deal_value: number;
  contract_code: string;
  sold_date: string;
  sale_id: string;
  sale_name: string;
  team_name?: string;
  agency_name?: string;
  customer_name: string;
  customer_phone?: string;
  commission_amount: number;
  sale_commission_amount: number;
  first_installment_paid: boolean;
}

export interface AgencyPerformanceDetail {
  agency_id: string;
  agency_name: string;
  agency_code: string;
  director_name?: string;
  total_members: number;
  members: Array<{
    id: string;
    full_name: string;
    email: string;
    phone: string;
    role: UserRole;
    team_name?: string;
    status: string;
    personal_revenue?: number;
    contracts_count?: number;
    personal_commission?: number;
  }>;
  lead_status_counts: Record<LeadStatus, number>;
  total_leads: number;
  total_revenue: number;
  total_contracts: number;
  total_commission: number;
}

export interface LeaderboardItem {
  id: string;
  name: string;
  type: 'agency' | 'sales_manager' | 'team' | 'sale_agent';
  subtitle?: string;
  avatar?: string;
  revenue: number;           // Tổng doanh số (VND)
  contracts_count: number;   // Tổng số HĐMB
  commission: number;        // Tổng hoa hồng (VND)
  rank?: number;
  target_progress?: number;  // % hoàn thành KPI thi đua
  growth_rate?: number;      // % tăng trưởng so với kỳ trước (+15%, -4%)
}

export interface ProjectKnowledge {
  id: string;
  project_id: string;
  location?: string;
  location_source?: string;
  location_unverified?: boolean;
  
  property_type?: string;
  property_type_source?: string;
  property_type_unverified?: boolean;
  
  price_range?: string;
  price_range_source?: string;
  price_range_unverified?: boolean;
  
  legal?: string;
  legal_source?: string;
  legal_unverified?: boolean;
  
  progress?: string;
  progress_source?: string;
  progress_unverified?: boolean;
  
  policy?: string;
  policy_source?: string;
  policy_unverified?: boolean;
  
  highlights?: string;
  highlights_source?: string;
  highlights_unverified?: boolean;
  
  comparison?: string;
  comparison_source?: string;
  comparison_unverified?: boolean;
  
  products?: string;
  products_source?: string;
  products_unverified?: boolean;
  
  summary_text?: string;
  updated_at?: string;
}

export interface ProjectFaq {
  id: string;
  project_id: string;
  question: string;
  answer: string;
  is_verified: boolean;
  source_url?: string;
  created_at?: string;
}

export interface SalesScript {
  id: string;
  project_id: string;
  status: LeadStatus;
  title: string;
  content: string;
  version: number;
  is_auto: boolean;
  is_edited: boolean;
  updated_at?: string;
}

export interface CustomerPersona {
  id: string;
  project_id?: string;
  name: string;
  traits?: string;
  pain_points?: string;
  buying_triggers?: string;
  objection_handling?: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  actor_id?: string;
  user_name?: string;
  effective_role?: string;
  action: string;
  table_name?: string;
  record_id?: string;
  new_data?: Record<string, unknown>;
  entity_name?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  prev_hash?: string;
  current_hash?: string;
  created_at: string;
}

export interface ImpersonationSession {
  id: string;
  actor_id: string;
  actor_name?: string;
  effective_role: UserRole;
  effective_user_id?: string;
  effective_user_name?: string;
  is_read_only: boolean;
  started_at: string;
  expires_at: string;
  ended_at?: string;
  reason?: string;
  created_at?: string;
}

// Module 6 & 7: Lead Assignment History, Notifications & Auto-transfer
export type AssignmentReason = 
  | 'new_assign'
  | 'manual_transfer'
  | 'auto_overdue'
  | 'bulk_assign'
  | 'round_robin'
  | 'pool_reclaim';

export interface LeadAssignmentHistory {
  id: string;
  lead_id: string;
  from_sale_id?: string;
  from_sale_name?: string;
  to_sale_id?: string;
  to_sale_name?: string;
  reason: AssignmentReason;
  transfer_count: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export type NotificationEventType =
  | 'new_assign'
  | 'lead_transferred'
  | 'lead_revoked'
  | 'bulk_assign'
  | 'overdue_warning'
  | 'auto_transferred_new'
  | 'auto_transferred_old'
  | 'pool_alert';

export interface NotificationLog {
  id: string;
  lead_id?: string;
  recipient_id?: string;
  recipient_email: string;
  recipient_name?: string;
  event_type: NotificationEventType;
  channel: 'email' | 'in_app' | 'both';
  title: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  error_message?: string;
  idempotency_key?: string;
  sent_at?: string;
  created_at: string;
}

export interface AutoTransferConfig {
  enabled: boolean;
  deadline_hours: number;       // Mặc định 24 giờ liên tục
  pre_warning_hours: number;    // Mặc định cảnh báo ở mốc 20 giờ (trước 4 giờ)
  max_transfer_count: number;   // Mặc định 3 lần
  stop_clock_statuses: LeadStatus[];
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  priority_same_team: boolean;
  cc_manager: boolean;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  enable_new_assign: boolean;
  enable_transfer: boolean;
  enable_revoke: boolean;
  enable_overdue_warning: boolean;
  cc_manager: boolean;
  dispatch_mode?: 'client_direct' | 'google_apps_script' | 'resend_api' | 'server_smtp'; // Chế độ: trực tiếp 1-click từ máy hoặc chạy ngầm server
  provider?: 'gmail_smtp' | 'resend' | 'google_apps_script' | 'custom_smtp';
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;           // Mật khẩu ứng dụng 16 ký tự Gmail App Password
  smtp_from_name?: string;
  smtp_from_email?: string;
  resend_api_key?: string;      // API Key Resend (nếu dùng)
  google_apps_script_url?: string; // Webhook URL từ script.google.com (miễn phí, không cần App Password)
  custom_webhook_url?: string;     // Webhook mở rộng gửi sự kiện đến Zalo, Telegram, Make, Zapier
}

export interface AutoTransferScanResult {
  scannedCount: number;
  transferredCount: number;
  warnedCount: number;
  poolReclaimedCount: number;
  exemptSkippedCount: number;
  stopClockSkippedCount: number;
  details: Array<{
    leadId: string;
    customerName: string;
    action: 'transferred' | 'warned' | 'pool_reclaimed' | 'exempt_skipped' | 'stop_clock_skipped';
    fromSale?: string;
    toSale?: string;
    deadline?: string;
    remainingHours?: number;
    reason?: string;
  }>;
}

// ========================================================
// HR LIFECYCLE MANAGEMENT TYPES (MODULE 5)
// ========================================================

export type EmploymentType = 'official' | 'probation' | 'collaborator';
export type EmployeeStatus = 'candidate' | 'onboarding' | 'probation' | 'official' | 'on_leave' | 'terminated';

export interface EmployeeRecord {
  id: string;
  user_id: string;
  organization_id?: string;
  employee_code: string;
  employment_type: EmploymentType;
  title: string;
  level: number;
  direct_manager_id?: string;
  direct_manager_name?: string;
  join_date: string;
  probation_end_date?: string;
  termination_date?: string;
  recruited_by?: string;
  recruitment_source?: string;
  status: EmployeeStatus;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeePrivate {
  id: string;
  user_id: string;
  date_of_birth?: string;
  id_card_number?: string;
  id_card_issue_date?: string;
  id_card_issue_place?: string;
  permanent_address?: string;
  current_address?: string;
  tax_id?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  created_at?: string;
  updated_at?: string;
}

export type PersonnelEventType = 
  | 'hired' 
  | 'activated' 
  | 'probation_passed' 
  | 'contract_signed' 
  | 'contract_renewed' 
  | 'contract_ended' 
  | 'promoted' 
  | 'demoted' 
  | 'transferred' 
  | 'leave_started' 
  | 'leave_ended' 
  | 'locked' 
  | 'unlocked' 
  | 'warned' 
  | 'terminated' 
  | 'rehired';

export interface PersonnelEvent {
  id: string;
  user_id: string;
  organization_id?: string;
  event_type: PersonnelEventType;
  effective_date: string;
  actor_id?: string;
  actor_name?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export type TransferRequestType = 'transfer' | 'promotion' | 'demotion' | 'title_change';
export type TransferRequestStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'cancelled';

export interface PersonnelTransferRequest {
  id: string;
  user_id: string;
  user_name?: string;
  request_type: TransferRequestType;
  from_agency_id?: string;
  from_agency_name?: string;
  to_agency_id?: string;
  to_agency_name?: string;
  from_team_id?: string;
  from_team_name?: string;
  to_team_id?: string;
  to_team_name?: string;
  from_role?: string;
  to_role?: string;
  from_direct_manager_id?: string;
  to_direct_manager_id?: string;
  effective_date: string;
  reason: string;
  status: TransferRequestStatus;
  requested_by: string;
  requested_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface EmploymentContract {
  id: string;
  user_id: string;
  contract_number: string;
  contract_type: 'probation' | 'labor' | 'collaborator' | 'service';
  start_date: string;
  end_date?: string;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  file_url?: string;
  created_at?: string;
}

export interface BrokerCertificate {
  id: string;
  user_id: string;
  certificate_number: string;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'revoked';
  document_url?: string;
  created_at?: string;
}

export interface EmployeeDocument {
  id: string;
  user_id: string;
  document_type: 'id_card' | 'degree' | 'broker_cert' | 'resume' | 'health_cert' | 'other';
  file_name: string;
  file_path: string;
  expiry_date?: string;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at?: string;
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  default_days_per_year: number;
  is_paid: boolean;
  requires_approval: boolean;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  leave_type_id: string;
  leave_type_name?: string;
  total_entitlement: number;
  used_days: number;
  remaining_days: number;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  user_name?: string;
  leave_type_id: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  substitute_user_id?: string;
  substitute_user_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface JobRequisition {
  id: string;
  title: string;
  agency_id?: string;
  agency_name?: string;
  team_id?: string;
  team_name?: string;
  target_count: number;
  hired_count: number;
  status: 'draft' | 'open' | 'filled' | 'cancelled';
  created_by: string;
  created_at: string;
}

export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

export interface Candidate {
  id: string;
  requisition_id?: string;
  full_name: string;
  phone: string;
  phone_normalized: string;
  phone_hash: string;
  email?: string;
  source: string;
  referrer_id?: string;
  referrer_name?: string;
  stage: CandidateStage;
  is_rehire: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface PerformanceTarget {
  id: string;
  period: string; // '2026-11', '2026-Q4'
  agency_id?: string;
  team_id?: string;
  user_id?: string;
  revenue_target: number;
  contracts_target: number;
  leads_target: number;
  recruits_target: number;
  created_by: string;
  created_at: string;
}

export interface CoachingNote {
  id: string;
  user_id: string;
  mentor_id: string;
  mentor_name?: string;
  note_date: string;
  content: string;
  action_items?: string;
  is_private: boolean;
  shared_with_employee: boolean;
  created_at: string;
}

export interface PerformanceReview {
  id: string;
  user_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  period: string;
  score: number;
  summary: string;
  employee_acknowledged: boolean;
  employee_comments?: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface DisciplinaryRecord {
  id: string;
  user_id: string;
  record_type: 'reminder' | 'warning' | 'reprimand' | 'dismissal' | 'award';
  title: string;
  reason: string;
  basis?: string;
  issued_by: string;
  issued_by_name?: string;
  status: 'active' | 'appealed' | 'cancelled';
  created_at: string;
}

export interface OnboardingTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  is_mandatory: boolean;
  due_date?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}
