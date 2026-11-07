// ========================================================
// REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
// DOMAIN TYPES & INTERFACES (TypeScript Strict)
// ========================================================

export type UserRole = 
  | 'admin' 
  | 'director' 
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
  last_login_at?: string;
  created_at?: string;
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

export interface Customer {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string;
  phone_normalized: string;
  email?: string;
  identity_card?: string;
  address?: string;
  consent_obtained: boolean;
  consent_date?: string;
  anonymized_at?: string;
  created_at?: string;
}

export interface Lead {
  id: string;
  customer_id: string;
  project_id: string;
  agency_id?: string;
  team_id?: string;
  assigned_to?: string;
  source_id?: string;
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
  user_name?: string;
  action: string;
  entity_name?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}
