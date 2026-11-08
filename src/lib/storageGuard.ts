// ========================================================
// STORAGE SECURITY GUARD - PREVENT MOCK PII IN PRODUCTION
// ========================================================

import { isLiveSupabaseConfigured } from './supabase';

/**
 * Kiểm tra cờ build production.
 * Ở môi trường Production thực tế, TUYỆT ĐỐI KHÔNG cho phép đọc/ghi dữ liệu PII
 * (Leads, Customers, CCCD, Số điện thoại) vào LocalStorage.
 */
export function assertNoMockPIIInProduction(operation: string = 'truy cập dữ liệu PII mock') {
  if (import.meta.env.PROD && !isLiveSupabaseConfigured) {
    throw new Error(
      `Bảo mật nghiêm ngặt: Chế độ Production không được phép sử dụng LocalStorage mock chứa PII khách hàng (${operation}). Vui lòng cấu hình kết nối Supabase chính thức.`
    );
  }
}
