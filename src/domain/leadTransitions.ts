// ========================================================
// REAL ESTATE CRM - SALES & MARKETING INTELLIGENCE PLATFORM
// LEAD STATUS TRANSITION MATRIX (MATCHING MIGRATION 008)
// ========================================================

import { LeadStatus, UserRole } from './types';

export interface LeadTransitionRule {
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  requiresFinancial: boolean;
  allowedRoles: UserRole[];
  description: string;
}

export const ALL_OPERATIONAL_ROLES: UserRole[] = [
  'admin',
  'director',
  'sales_manager',
  'team_leader',
  'sale_agent',
];

export const MANAGEMENT_ROLES: UserRole[] = [
  'admin',
  'director',
  'sales_manager',
  'team_leader',
];

export const EXECUTIVE_ROLES: UserRole[] = [
  'admin',
  'director',
];

export const LEAD_STATUS_TRANSITIONS: LeadTransitionRule[] = [
  // Từ 'new'
  { fromStatus: 'new', toStatus: 'unreachable', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Không nghe máy khi tiếp cận lần đầu' },
  { fromStatus: 'new', toStatus: 'contacted', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đã liên hệ thành công' },
  { fromStatus: 'new', toStatus: 'qualifying', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Xác định nhu cầu khách hàng' },
  { fromStatus: 'new', toStatus: 'booking', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách hàng đặt cọc/booking giữ chỗ ngay khi tiếp nhận' },
  { fromStatus: 'new', toStatus: 'deposit', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Vào cọc trực tiếp' },
  { fromStatus: 'new', toStatus: 'invalid', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Số điện thoại sai hoặc không đúng đối tượng' },
  { fromStatus: 'new', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách từ chối dứt khoát' },

  // Từ 'unreachable'
  { fromStatus: 'unreachable', toStatus: 'contacted', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Gọi lại thành công' },
  { fromStatus: 'unreachable', toStatus: 'qualifying', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khai thác nhu cầu sau khi gọi lại' },
  { fromStatus: 'unreachable', toStatus: 'invalid', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Thuê bao không tồn tại / Sai số' },
  { fromStatus: 'unreachable', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Không thể liên lạc sau nhiều lần' },

  // Từ 'contacted'
  { fromStatus: 'contacted', toStatus: 'qualifying', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Tiến hành xác định nhu cầu & ngân sách' },
  { fromStatus: 'contacted', toStatus: 'doc_sent', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Gửi tài liệu / brochure dự án qua Zalo/Email' },
  { fromStatus: 'contacted', toStatus: 'appointment_set', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Thiết lập cuộc hẹn tư vấn hoặc xem nhà mẫu' },
  { fromStatus: 'contacted', toStatus: 'invalid', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách xác nhận không có nhu cầu' },
  { fromStatus: 'contacted', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách huỷ tìm hiểu' },

  // Từ 'qualifying'
  { fromStatus: 'qualifying', toStatus: 'doc_sent', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Gửi bảng tính dòng tiền và mặt bằng căn hộ' },
  { fromStatus: 'qualifying', toStatus: 'appointment_set', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Hẹn gặp tư vấn trực tiếp' },
  { fromStatus: 'qualifying', toStatus: 'consulted', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đã gặp gỡ trao đổi phương án đầu tư' },
  { fromStatus: 'qualifying', toStatus: 'site_visit', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đưa khách tham quan thực tế công trường' },
  { fromStatus: 'qualifying', toStatus: 'considering', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách đang cân nhắc lựa chọn giỏ hàng' },
  { fromStatus: 'qualifying', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách chưa đủ khả năng tài chính' },

  // Từ 'doc_sent'
  { fromStatus: 'doc_sent', toStatus: 'appointment_set', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách đồng ý gặp sau khi xem tài liệu' },
  { fromStatus: 'doc_sent', toStatus: 'consulted', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đã trao đổi chi tiết bảng giá' },
  { fromStatus: 'doc_sent', toStatus: 'site_visit', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đưa khách đi xem dự án' },
  { fromStatus: 'doc_sent', toStatus: 'considering', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đang so sánh với dự án khác' },
  { fromStatus: 'doc_sent', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách từ chối sau khi xem báo giá' },

  // Từ 'appointment_set'
  { fromStatus: 'appointment_set', toStatus: 'consulted', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Hoàn thành cuộc hẹn tư vấn' },
  { fromStatus: 'appointment_set', toStatus: 'site_visit', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đón khách tham quan sa bàn & nhà mẫu' },
  { fromStatus: 'appointment_set', toStatus: 'considering', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách về bàn bạc gia đình sau cuộc hẹn' },
  { fromStatus: 'appointment_set', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách huỷ hẹn và không nghe máy' },

  // Từ 'consulted'
  { fromStatus: 'consulted', toStatus: 'site_visit', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Đi thực tế trải nghiệm tiện ích' },
  { fromStatus: 'consulted', toStatus: 'considering', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách xin thời gian cân nhắc đòn bẩy ngân hàng' },
  { fromStatus: 'consulted', toStatus: 'booking', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách ưng ý và Booking giữ chỗ ưu tiên' },
  { fromStatus: 'consulted', toStatus: 'deposit', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Chốt cọc trực tiếp tại buổi tư vấn' },
  { fromStatus: 'consulted', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Không thống nhất được phương án tài chính' },

  // Từ 'site_visit'
  { fromStatus: 'site_visit', toStatus: 'considering', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Cân nhắc vị trí căn sau chuyến đi' },
  { fromStatus: 'site_visit', toStatus: 'booking', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Booking giữ chỗ ngay tại nhà mẫu' },
  { fromStatus: 'site_visit', toStatus: 'deposit', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Ráp căn và vào cọc nóng tại thực địa' },
  { fromStatus: 'site_visit', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách không thích vị trí thực tế' },

  // Từ 'considering'
  { fromStatus: 'considering', toStatus: 'booking', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Quyết định chuyển tiền Booking giữ chỗ' },
  { fromStatus: 'considering', toStatus: 'deposit', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Quyết định chốt cọc căn hộ' },
  { fromStatus: 'considering', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Khách quyết định mua dự án đối thủ' },

  // Từ 'booking'
  { fromStatus: 'booking', toStatus: 'deposit', requiresFinancial: true, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Chuyển từ Booking sang Đặt cọc chính thức' },
  { fromStatus: 'booking', toStatus: 'lost', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Hoàn tiền Booking / Không chọn được căn ưng ý' },

  // Từ 'deposit'
  { fromStatus: 'deposit', toStatus: 'contract', requiresFinancial: true, allowedRoles: MANAGEMENT_ROLES, description: 'Tiến hành Ký HĐMB chính thức với CĐT' },
  { fromStatus: 'deposit', toStatus: 'lost', requiresFinancial: false, allowedRoles: ['admin', 'director', 'sales_manager'], description: 'Khách bỏ cọc / Bồi hoàn cọc theo thỏa thuận' },

  // Từ 'contract'
  { fromStatus: 'contract', toStatus: 'after_sales', requiresFinancial: false, allowedRoles: ALL_OPERATIONAL_ROLES, description: 'Chăm sóc sau bán & bàn giao nhà' },
  { fromStatus: 'contract', toStatus: 'lost', requiresFinancial: false, allowedRoles: EXECUTIVE_ROLES, description: 'Hủy HĐMB / Chuyển nhượng ngoại lệ' },

  // Từ 'after_sales'
  { fromStatus: 'after_sales', toStatus: 'lost', requiresFinancial: false, allowedRoles: EXECUTIVE_ROLES, description: 'Đóng hồ sơ khách hàng' },

  // Mở lại Lead đã đóng (Re-open)
  { fromStatus: 'invalid', toStatus: 'qualifying', requiresFinancial: false, allowedRoles: MANAGEMENT_ROLES, description: 'Kích hoạt lại lead sai số' },
  { fromStatus: 'lost', toStatus: 'qualifying', requiresFinancial: false, allowedRoles: MANAGEMENT_ROLES, description: 'Khách liên hệ lại sau khi đóng' },
];

export const STOP_CLOCK_STATUSES: LeadStatus[] = [
  'appointment_set',
  'consulted',
  'site_visit',
  'considering',
  'booking',
  'deposit',
  'contract',
  'after_sales',
  'lost',
  'invalid',
];

export function findTransitionRule(from: LeadStatus, to: LeadStatus): LeadTransitionRule | undefined {
  return LEAD_STATUS_TRANSITIONS.find(t => t.fromStatus === from && t.toStatus === to);
}
