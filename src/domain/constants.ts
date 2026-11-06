// ========================================================
// REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
// DOMAIN CONSTANTS & BUSINESS RULES
// ========================================================

import { LeadStatus, UserRole } from './types';

export const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Quản Trị Viên (Admin)', description: 'Toàn quyền quản trị hệ thống, phân quyền, cấu hình' },
  { value: 'director', label: 'Ban Giám Đốc (Director)', description: 'Xem toàn bộ báo cáo, KPI doanh số và điều phối toàn hệ thống' },
  { value: 'marketing_manager', label: 'Marketing Manager', description: 'Quản lý chiến dịch, nguồn lead, chi phí & tỷ lệ chuyển đổi' },
  { value: 'sales_manager', label: 'Giám Đốc Sàn (Sales Manager)', description: 'Quản lý toàn bộ Team và doanh số thuộc Sàn phân phối' },
  { value: 'team_leader', label: 'Trưởng Nhóm (Team Leader)', description: 'Quản lý giỏ Lead và hỗ trợ chốt deal của Team' },
  { value: 'sale_agent', label: 'Chuyên Viên Tư Vấn (Sale Agent)', description: 'Chăm sóc khách hàng, tư vấn dự án và thực hiện giao dịch' },
];

export const JOURNEY_STAGES: {
  id: LeadStatus;
  label: string;
  category: 'approach' | 'nurture' | 'closing' | 'after_sales' | 'closed';
  color: string;
  bgColor: string;
  borderColor: string;
  requiresTransaction?: boolean;
}[] = [
  { id: 'new', label: 'Mới tiếp nhận', category: 'approach', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'unreachable', label: 'Không nghe máy', category: 'approach', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { id: 'invalid', label: 'Sai số / Không nhu cầu', category: 'closed', color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-300' },
  { id: 'contacted', label: 'Đã liên hệ', category: 'approach', color: 'text-sky-700', bgColor: 'bg-sky-50', borderColor: 'border-sky-200' },
  { id: 'qualifying', label: 'Xác định nhu cầu', category: 'nurture', color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  { id: 'doc_sent', label: 'Gửi tài liệu', category: 'nurture', color: 'text-cyan-700', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  { id: 'appointment_set', label: 'Đặt hẹn', category: 'nurture', color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  { id: 'consulted', label: 'Đã gặp tư vấn', category: 'nurture', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'site_visit', label: 'Đi xem dự án', category: 'nurture', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  { id: 'considering', label: 'Đang cân nhắc', category: 'nurture', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  { id: 'booking', label: 'Booking giữ chỗ', category: 'closing', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', requiresTransaction: true },
  { id: 'deposit', label: 'Đặt cọc', category: 'closing', color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-300', requiresTransaction: true },
  { id: 'contract', label: 'Ký HĐMB', category: 'closing', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', requiresTransaction: true },
  { id: 'after_sales', label: 'Chăm sóc sau bán', category: 'after_sales', color: 'text-pink-700', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
  { id: 'lost', label: 'Thất bại / Đóng', category: 'closed', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
];

export const LEAD_SOURCES_DEFAULT = [
  { code: 'website_form', name: 'Website Form' },
  { code: 'facebook_ads', name: 'Facebook Ads' },
  { code: 'google_search', name: 'Google Search' },
  { code: 'zalo_oa', name: 'Zalo OA' },
  { code: 'referral', name: 'Giới thiệu' },
  { code: 'hotline', name: 'Hotline trực tiếp' },
];

export const STAGE_CONFIG_MAP = new Map(JOURNEY_STAGES.map(s => [s.id, s]));
