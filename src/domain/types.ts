// ========================================================
// REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
// DOMAIN TYPES & INTERFACES (TypeScript Strict)
// ========================================================

export type UserRole = 
  | 'admin' 
  | 'ceo'
  | 'regional_director'
  | 'director' 
  | 'hr_admin'
  | 'marketing_manager' 
  | 'sales_manager' 
  | 'team_leader' 
  | 'sale_agent';

export type UserStatus = 'active' | 'inactive' | 'locked' | 'on_leave' | 'terminated';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
  role: UserRole;
  employment_type?: EmploymentType;
  position_code?: string;
  is_sample?: boolean;
  organization_id?: string;
  region_id?: string;
  agency_id?: string;
  team_id?: string;
  department_id?: string;
  marketing_unit_id?: string;
  is_acting?: boolean;
  acting_until?: string;
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
  reporting_to?: string;
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
  ceo_id?: string;
  ceo_name?: string;
  status?: 'active' | 'inactive';
  created_at?: string;
}

export interface Region {
  id: string;
  organization_id?: string;
  name: string;
  code: string;
  regional_director_id?: string;
  regional_director_name?: string;
  status: 'active' | 'inactive';
  description?: string;
  agency_count?: number;
  total_members?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Division {
  id: string;
  code: 'SALES' | 'MARKETING' | 'HR';
  name: string;
  head_id?: string;
  head_name?: string;
  ceo_id?: string;
  ceo_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompanySettings {
  id?: string;
  ceo_id?: string;
  ceo_name?: string;
  acting_ceo_id?: string;
  acting_ceo_until?: string;
  approval_threshold_l1: number;
  approval_threshold_l2: number;
  approval_threshold_l3: number;
  director_global_scope: boolean;
  sla_severe_breach_threshold: number;
  updated_at?: string;
}

export interface OrgPositionLevel {
  id: string;
  code: string;
  title: string;
  track: 'executive' | 'sales' | 'marketing' | 'hr';
  level: number;
  description?: string;
}

export interface Agency {
  id: string;
  organization_id: string;
  region_id?: string;
  region_name?: string;
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
  department_id?: string;
  name: string;
  code: string;
  leader_id?: string;
  leader_name?: string;
  member_count?: number;
  version?: number;
  is_sample?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  delete_reason?: string;

  // Snapshot theo chuỗi trực thuộc tại thời điểm ký (CEO, Regional Director, Agency Director, Sales Manager, Team Leader)
  organization_id?: string;
  agency_director_id?: string;
  agency_director_name?: string;
  sales_manager_id?: string;
  sales_manager_name?: string;
  team_leader_id?: string;
  team_leader_name?: string;
  region_id?: string;
  region_name?: string;
  regional_director_id?: string;
  regional_director_name?: string;
  ceo_id?: string;
  ceo_name?: string;
  regional_commission_amount?: number;
  regional_commission_rate?: number;
  ceo_commission_amount?: number;
  ceo_commission_rate?: number;

  // Maker-Checker đa tầng theo ngưỡng hợp đồng (L1: Sàn, L2: Vùng, L3: CEO)
  requires_l1_approval?: boolean;
  requires_l2_approval?: boolean;
  requires_l3_approval?: boolean;
  l1_approved_by?: string;
  l1_approved_at?: string;
  l2_approved_by?: string;
  l2_approved_at?: string;
  l3_approved_by?: string;
  l3_approved_at?: string;
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
  is_sample?: boolean;
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
  customer_id: string;
  project_id: string;
  agency_id?: string;
  team_id?: string;
  department_id?: string;
  marketing_unit_id?: string;
  is_acting?: boolean;
  acting_until?: string;
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

  // Giai đoạn 2, 4 & 7: Chống lách SLA, hẹn ảo, lý do đóng thất bại, nuôi lại, nhập theo lô & Quản trị sửa/xóa
  loss_reason_code?: string;
  loss_reason_detail?: string;
  nurture_reminder_date?: string;
  import_batch_id?: string;
  sla_reset_count?: number;
  sla_flags?: string[];
  version?: number;
  is_sample?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  delete_reason?: string;

  // Snapshot theo chuỗi trực thuộc tại thời điểm ký (CEO, Regional Director, Agency Director, Sales Manager, Team Leader)
  organization_id?: string;
  agency_director_id?: string;
  agency_director_name?: string;
  sales_manager_id?: string;
  sales_manager_name?: string;
  team_leader_id?: string;
  team_leader_name?: string;
  region_id?: string;
  region_name?: string;
  regional_director_id?: string;
  regional_director_name?: string;
  ceo_id?: string;
  ceo_name?: string;
  regional_commission_amount?: number;
  regional_commission_rate?: number;
  ceo_commission_amount?: number;
  ceo_commission_rate?: number;

  // Maker-Checker đa tầng theo ngưỡng hợp đồng (L1: Sàn, L2: Vùng, L3: CEO)
  requires_l1_approval?: boolean;
  requires_l2_approval?: boolean;
  requires_l3_approval?: boolean;
  l1_approved_by?: string;
  l1_approved_at?: string;
  l2_approved_by?: string;
  l2_approved_at?: string;
  l3_approved_by?: string;
  l3_approved_at?: string;

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
  updated_at?: string;

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

  // Maker-Checker & Reversal Transaction (P1.2 & Phase 7)
  approved_by?: string;
  approved_at?: string;
  approval_status?: 'draft' | 'pending_approval' | 'approved' | 'confirmed' | 'rejected';
  is_reversal?: boolean;
  reversal_of_id?: string;
  reversal_reason?: string;
  version?: number;
  is_sample?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  delete_reason?: string;

  // Snapshot theo chuỗi trực thuộc tại thời điểm ký (CEO, Regional Director, Agency Director, Sales Manager, Team Leader)
  organization_id?: string;
  agency_director_id?: string;
  agency_director_name?: string;
  sales_manager_id?: string;
  sales_manager_name?: string;
  team_leader_id?: string;
  team_leader_name?: string;
  region_id?: string;
  region_name?: string;
  regional_director_id?: string;
  regional_director_name?: string;
  ceo_id?: string;
  ceo_name?: string;
  regional_commission_amount?: number;
  regional_commission_rate?: number;
  ceo_commission_amount?: number;
  ceo_commission_rate?: number;

  // Maker-Checker đa tầng theo ngưỡng hợp đồng (L1: Sàn, L2: Vùng, L3: CEO)
  requires_l1_approval?: boolean;
  requires_l2_approval?: boolean;
  requires_l3_approval?: boolean;
  l1_approved_by?: string;
  l1_approved_at?: string;
  l2_approved_by?: string;
  l2_approved_at?: string;
  l3_approved_by?: string;
  l3_approved_at?: string;

  // Joined fields for display
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  sign_date?: string;
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
  type: 'ceo' | 'region' | 'agency' | 'sales_manager' | 'team' | 'sale_agent';
  subtitle?: string;
  avatar?: string;
  employment_type?: EmploymentType;
  employment_status?: string;
  member_count?: number;
  per_capita_revenue?: number;
  per_capita_contracts?: number;
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
  | 'pool_reclaim'
  | 'pool_claimed';

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

export type EmploymentType = 'official' | 'probation' | 'collaborator' | 'intern' | 'other';
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
  department_id?: string;
  marketing_unit_id?: string;
  is_acting?: boolean;
  acting_until?: string;
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

// ========================================================
// PHASE 2: SLA ANTI-CHEAT, UNIT HOLDS & JOB RUNS
// ========================================================

export interface LeadAppointment {
  id: string;
  lead_id: string;
  sale_id: string;
  appointment_type?: 'consulting' | 'site_visit' | 'online_call' | 'sign_contract';
  appointment_date?: string;
  scheduled_at: string;
  location?: string;
  purpose?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'missed' | 'cancelled' | 'no_result_overdue';
  result_summary?: string;
  completed_at?: string;
  flags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface LeadLossReason {
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface UnitHold {
  id: string;
  project_id: string;
  project_name?: string;
  unit_code: string;
  lead_id?: string;
  customer_name?: string;
  sale_id: string;
  sale_name?: string;
  hold_start_at: string;
  hold_expires_at: string;
  status: 'active' | 'expired' | 'converted' | 'cancelled';
  extension_count: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UnitWaitlist {
  id: string;
  project_id: string;
  unit_code: string;
  lead_id: string;
  customer_name?: string;
  sale_id: string;
  sale_name?: string;
  priority_order: number;
  status: 'waiting' | 'notified' | 'expired' | 'converted';
  notified_at?: string;
  created_at?: string;
}

export interface JobRun {
  id: string;
  job_name: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'success' | 'failed' | 'timeout';
  rows_affected?: number;
  error_message?: string;
  error_detail?: string;
  server_host?: string;
  created_at?: string;
}

export interface DeadLetterMessage {
  id: string;
  source_table: string;
  original_id?: string;
  record_id?: string;
  payload: any;
  error_reason?: string;
  error_type?: string;
  error_message?: string;
  retry_count: number;
  status: 'unresolved' | 'resolved' | 'discarded' | 'dead';
  created_at: string;
}

// ========================================================
// PHASE 3: CONTRACT INSTALLMENTS, MULTI-TIER COMMISSIONS & DEBT AGING
// ========================================================

export interface ContractInstallment {
  id: string;
  contract_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
  paid_date?: string;
  receipt_code?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MultiTierCommissionSnapshot {
  agencyRate: number;
  agencyAmount: number;
  saleRate: number;
  saleAmount: number;
  teamLeaderRate: number;
  teamLeaderAmount: number;
  salesManagerRate: number;
  salesManagerAmount: number;
  directorRate: number;
  directorAmount: number;
  coSaleRate?: number;
  coSaleAmount?: number;
  coSaleUserId?: string;
  coSaleUserName?: string;
  policyVersion: string;
  createdAt: string;
}

export interface CommissionEntry {
  id: string;
  contract_id: string;
  recipient_id: string;
  recipient_name?: string;
  recipient_role: string;
  rate_percent: number;
  amount: number;
  status: 'pending_eligibility' | 'eligible' | 'collected_from_developer' | 'paid' | 'clawback';
  condition_threshold_percent?: number;
  clawback_source_id?: string;
  policy_version?: string;
  pit_tax_percent?: number;
  pit_tax_amount?: number;
  net_payable_amount?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface ContractRevision {
  id: string;
  contract_id: string;
  revision_type: 'unit_change' | 'transfer' | 'cancellation' | 'penalty';
  old_data: Record<string, any>;
  new_data: Record<string, any>;
  reason: string;
  requested_by: string;
  requested_by_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface BankStatement {
  id: string;
  bank_ref_code: string;
  trans_date: string;
  amount: number;
  description: string;
  matched_contract_id?: string;
  matched_installment_id?: string;
  status: 'unmatched' | 'matched' | 'disputed';
  reconciled_by?: string;
  reconciled_at?: string;
  created_at: string;
}

export interface DebtAgingBucket {
  notYetDue: number; // Chưa đến hạn
  overdue1To30: number; // 1-30 ngày
  overdue31To60: number; // 31-60 ngày
  overdueOver60: number; // >60 ngày
  totalReceivable: number;
}

export interface DebtAgingReport {
  contractId: string;
  contractCode?: string;
  customerName: string;
  customerPhone?: string;
  totalDealValue: number;
  paidAmount: number;
  remainingAmount: number;
  aging: DebtAgingBucket;
  installments: ContractInstallment[];
}

// ========================================================
// PHASE 4: SALES WORKFLOW TOOLS, QUOTATIONS & CUSTOMER MERGE
// ========================================================

export interface MortgageCalculationParams {
  loanAmount: number; // Số tiền vay (VND)
  loanTermMonths: number; // Thời hạn vay (tháng), ví dụ: 240, 300, 420
  preferentialRateYear: number; // Lãi suất ưu đãi (%/năm), ví dụ: 6.5
  preferentialMonths: number; // Thời gian ưu đãi (tháng), ví dụ: 12, 24, 36
  floatingRateYear: number; // Lãi suất sau ưu đãi (%/năm), ví dụ: 10.5
  gracePeriodMonths?: number; // Ân hạn nợ gốc (tháng)
}

export interface MortgageScheduleRow {
  month: number;
  beginningBalance: number;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  endingBalance: number;
  isGracePeriod: boolean;
  isPreferentialRate: boolean;
  interestRate: number;
}

export interface MortgageCalculationResult {
  monthlyPaymentFirstMonth: number;
  monthlyPaymentMax: number;
  totalInterestPaid: number;
  totalPrincipalAndInterest: number;
  schedule: MortgageScheduleRow[];
}

export interface Quotation {
  id: string;
  code: string; // BG-YYYY-XXXX
  lead_id?: string;
  project_id: string;
  project_name?: string;
  unit_code: string;
  deal_value: number;
  discount_amount: number;
  final_price: number;
  payment_plan_summary?: Record<string, any>;
  valid_until: string;
  created_by: string;
  created_by_name?: string;
  status: 'draft' | 'sent' | 'accepted' | 'expired';
  created_at: string;
  updated_at?: string;
}

export interface ImportBatch {
  id: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: 'imported' | 'reverted';
  created_by: string;
  created_at: string;
  reverted_at?: string;
}

export interface CustomerMergeRecord {
  id: string;
  primary_customer_id: string;
  merged_customer_id: string;
  merged_by: string;
  merged_at: string;
  status: 'active' | 'reverted';
  reverted_at?: string;
  audit_snapshot: Record<string, any>;
}

export interface InteractionTimelineItem {
  id: string;
  lead_id: string;
  customer_id?: string;
  type?: string;
  channel: 'call' | 'zalo' | 'sms' | 'email';
  direction: 'inbound' | 'outbound';
  content: string;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface AppointmentCheckInResult {
  success: boolean;
  isWithinGeofence: boolean;
  distanceMeters?: number;
  qrVerified?: boolean;
  flaggedOutside?: boolean;
  appointment: LeadAppointment;
}

// ========================================================
// PHASE 5.0A: STRICT SALE CHAIN & HIERARCHY
// ========================================================

export interface Department {
  id: string;
  agency_id: string;
  name: string;
  head_id?: string;
  head_name?: string;
  director_id?: string;
  director_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MarketingUnit {
  id: string;
  division_id?: string;
  division_name?: string;
  name: string;
  manager_id?: string;
  manager_name?: string;
  director_id?: string;
  director_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaleChain {
  sale_id: string;
  sale_name: string;
  sale_role?: UserRole;
  sale_status?: string;
  team_id?: string;
  team_name?: string;
  leader_id?: string;
  leader_name?: string;
  department_id?: string;
  department_name?: string;
  head_id?: string;
  head_name?: string;
  agency_id?: string;
  agency_name?: string;
  agency_director_id?: string;
  agency_director_name?: string;
  director_id?: string;
  director_name?: string;
  region_id?: string;
  region_name?: string;
  regional_director_id?: string;
  regional_director_name?: string;
  ceo_id?: string;
  ceo_name?: string;
  marketing_unit_id?: string;
  marketing_unit_name?: string;
  marketing_manager_id?: string;
}

export interface StructuralHealthReport {
  orphanSalesCount: number;
  teamsWithoutLeaderCount: number;
  departmentsWithoutHeadCount: number;
  marketingUnitsWithoutManagerCount: number;
  regionsWithoutDirectorCount?: number;
  agenciesWithoutRegionCount?: number;
  agenciesWithoutDirectorCount?: number;
  expiredActingCount: number;
  orphanSales: Array<{ id: string; name: string; missingLinks: string[] }>;
  teamsWithoutLeader: Array<{ id: string; name: string }>;
  departmentsWithoutHead: Array<{ id: string; name: string }>;
  regionsWithoutDirector?: Array<{ id: string; name: string }>;
  agenciesWithoutRegion?: Array<{ id: string; name: string }>;
  agenciesWithoutDirector?: Array<{ id: string; name: string }>;
  actingPositionsExpiring?: Array<{ id: string; name: string }>;
  hasIssues?: boolean;
}

// ========================================================
// PHASE 6: MARKETING, PRIVACY & OPERATIONS
// ========================================================

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  budget: number;
  start_date: string;
  end_date?: string;
  utm_source?: string;
  utm_campaign?: string;
  status: 'active' | 'paused' | 'completed';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignDailyCost {
  id: string;
  campaign_id: string;
  cost_date: string;
  amount: number;
  notes?: string;
  created_at?: string;
}

export interface MarketingMetrics {
  totalSpent: number;
  leadsCount: number;
  contactsCount: number;
  depositsCount: number;
  contractsCount: number;
  totalRevenue: number;
  cpl: number; // Cost Per Lead = totalSpent / leadsCount
  cac: number; // Customer Acquisition Cost = totalSpent / depositsCount
  contactRate: number; // % of leads contacted
  depositRate: number; // % of leads reaching deposit/contract
  roi: number; // ROI % = ((grossProfit - totalSpent) / totalSpent) * 100
}

export type PrivacyRequestType = 'export' | 'anonymize';
export type PrivacyRequestStatus = 'pending' | 'approved' | 'completed' | 'rejected';

export interface PrivacyRequest {
  id: string;
  customer_id: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  reason?: string;
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  completed_at?: string;
  created_at?: string;
}

export interface PrivacyExportPackage {
  exportedAt: string;
  legalBasis: string;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email?: string;
    identity_card?: string;
    address?: string;
    created_at?: string;
  };
  leads: Array<{
    id: string;
    status: string;
    budget_min?: number;
    budget_max?: number;
    source?: string;
    created_at?: string;
  }>;
  contracts: Array<{
    id: string;
    contract_code?: string;
    status: string;
    deal_value?: number;
    sign_date?: string;
  }>;
  interactions: Array<{
    id: string;
    type?: string;
    notes: string;
    created_at?: string;
  }>;
}

// ========================================================
// PHASE 7: CONTROLLED DATA MANAGEMENT & TRASH BIN
// ========================================================

export type TrashEntityType = 'lead' | 'contract' | 'draft_contract' | 'team' | 'agency' | 'employee';

export interface TrashBinItem {
  id: string;
  entity_type: TrashEntityType;
  entity_id: string;
  agency_id?: string;
  entity_name?: string;
  payload: Record<string, any>;
  delete_reason: string;
  deleted_by: string;
  deleted_by_name?: string;
  deleted_at: string;
  restored_at?: string;
  restored_by?: string;
  purge_due_at?: string;
}

export interface FieldDiff {
  field: string;
  old_value: any;
  new_value: any;
  is_pii_masked?: boolean;
}

export interface ControlledAuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  operator_id: string;
  operator_name?: string;
  operator_role: UserRole;
  action: 'update' | 'soft_delete' | 'restore' | 'dissolve' | 'deactivate';
  reason: string;
  diffs: FieldDiff[];
  created_at: string;
}

// ========================================================
// PHASE 8: PROJECT KNOWLEDGE & CONTEXT-AWARE SCRIPTS
// ========================================================

export type KnowledgeCategory = 
  | 'usp' 
  | 'location' 
  | 'product' 
  | 'price_policy' 
  | 'legal' 
  | 'construction_progress' 
  | 'developer' 
  | 'competitor_comparison' 
  | 'faq' 
  | 'objection_handling';

export interface ProjectKnowledgeItem {
  id: string;
  project_id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  source_url?: string;
  status: 'draft' | 'published' | 'archived';
  verified_by?: string;
  verified_at?: string;
  expires_at?: string;
  version: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type ScriptContextCode = 
  | 'approach' 
  | 'qualifying' 
  | 'introduction' 
  | 'appointment' 
  | 'objection' 
  | 'closing' 
  | 'post_contract' 
  | 're_engage' 
  | 'special';

export type ScriptChannel = 'call' | 'zalo' | 'sms' | 'email' | 'in_person';
export type ScriptTone = 'friendly' | 'professional' | 'concise';

export interface ScriptTemplate {
  id: string;
  project_id?: string;
  context_code: ScriptContextCode;
  journey_stage?: string;
  channel: ScriptChannel;
  persona?: string;
  tone: ScriptTone;
  title: string;
  objective: string;
  opening: string;
  questions?: string;
  main_content: string;
  objection_handling?: string;
  cta: string;
  compliance_notes?: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScriptUsage {
  id: string;
  script_id: string;
  lead_id: string;
  sale_id: string;
  channel: string;
  outcome?: 'responded' | 'appointment_set' | 'stage_advanced' | 'rejected' | 'no_answer';
  rating?: number;
  feedback?: string;
  created_at: string;
}

export interface CareTask {
  id: string;
  lead_id: string;
  sale_id: string;
  title: string;
  due_date: string;
  status: 'pending' | 'completed' | 'cancelled';
  script_id?: string;
  completed_at?: string;
  created_at: string;
}

export interface ComplianceLintResult {
  isCompliant: boolean;
  violations: Array<{
    term: string;
    reason: string;
    severity: 'error' | 'warning';
  }>;
}

// ========================================================
// DATE RANGE FILTER & SHARED REPORTING TYPES (PHASE 8 / YÊU CẦU 4)
// ========================================================

export type DateRangePreset = 
  | 'today' 
  | 'yesterday' 
  | 'last_7_days' 
  | 'last_30_days' 
  | 'this_week' 
  | 'this_month' 
  | 'last_month' 
  | 'this_quarter' 
  | 'this_year' 
  | 'custom';

export interface DateRangeValue {
  from: string; // YYYY-MM-DD (Asia/Ho_Chi_Minh 00:00:00)
  to: string;   // YYYY-MM-DD (Asia/Ho_Chi_Minh 23:59:59)
  preset?: DateRangePreset;
  compare?: boolean;
  previousFrom?: string;
  previousTo?: string;
}

// ========================================================
// HR KPI & UNIT PERFORMANCE TYPES (PHASE 8 / YÊU CẦU 3)
// ========================================================

export interface HRKpiSummary {
  totalStaff: number;
  officialCount: number;
  probationCount: number;
  collaboratorCount: number;
  internCount: number;
  otherCount: number;
  activeCount: number;
  onLeaveCount: number;
  lockedCount: number;
  terminatedCount: number;
  newHiresCount: number;
  terminationsCount: number;
  netChange: number;
  turnoverRate: number; // Tỷ lệ nghỉ việc (%)
  probationEndingSoonCount: number; // Sắp hết hạn thử việc
  perCapitaRevenue: number; // Doanh thu bình quân đầu người
  perCapitaContracts: number; // Hợp đồng bình quân đầu người
  perCapitaLeads: number; // Lead bình quân đầu người
  trendData?: Array<{
    date: string;
    total: number;
    official: number;
    probation: number;
    collaborator: number;
  }>;
  previousSummary?: {
    totalStaff: number;
    newHiresCount: number;
    terminationsCount: number;
    perCapitaRevenue: number;
    perCapitaContracts: number;
    perCapitaLeads: number;
  };
}

export interface UnitPerformanceRank {
  unitId: string;
  unitName: string;
  type: 'agency' | 'team';
  memberCount: number;
  totalRevenue: number;
  totalContracts: number;
  totalLeads: number;
  perCapitaRevenue: number;
  perCapitaContracts: number;
  perCapitaLeads: number;
}

export interface RecruitedEmployeeItem {
  id: string;
  employee_code?: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  title?: string;
  agency_name?: string;
  employment_type?: EmploymentType;
  status?: string;
  join_date?: string;
  hire_date?: string;
  probation_status?: 'passed' | 'evaluating' | 'failed';
  revenue_generated?: number;
  contracts_count?: number;
}

export interface RecruiterRank {
  recruiterId: string;
  recruiterName: string;
  recruiterRole: string;
  agencyId?: string;
  agencyName?: string;
  teamId?: string;
  totalRecruited: number;
  passedProbationCount: number;
  passedProbationRate: number; // %
  growth_rate?: number; // ±% so với kỳ trước
  recruits?: RecruitedEmployeeItem[];
  totalRevenueByRecruits?: number;
}

export interface AgencyHRRank {
  agencyId: string;
  agencyName: string;
  directorName?: string;
  rank?: number;
  totalHeadcount: number;
  totalStaff?: number; // Alias for UI
  officialCount: number;
  probationCount: number;
  collaboratorCount: number;
  newHiresCount: number;
  newHiredInPeriod?: number; // Alias for UI
  retentionRate: number; // %
  turnoverRate: number; // %
  totalRevenue?: number;
  perCapitaRevenue: number;
  revenuePerCapita?: number; // Alias for UI
  contractsCount: number;
}

