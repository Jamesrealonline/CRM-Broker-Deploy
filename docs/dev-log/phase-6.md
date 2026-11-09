# GIAI ĐOẠN 6 – KHẢO SÁT & KẾ HOẠCH TRIỂN KHAI (PHASE 6 SURVEY & PLAN)
**Mục tiêu:** Marketing (Chiến dịch, ROI, CPL, CAC), Vận hành & CI/CD, Trung tâm quyền riêng tư (Privacy Center, Export & Ẩn danh hóa), Thiết kế Multi-tenant & PWA/i18n.
**Branch:** `feat/phase-6-marketing-privacy-operations-pwa`
**Thời gian thực hiện:** 2026-11-09

---

## 1. KHẢO SÁT HIỆN TRẠNG
1. **Marketing:** Đã có `lead_sources` và trường `source_id/source_detail`. Cần bổ sung bảng `campaigns` (kênh, ngân sách, chi phí theo ngày) và service tính CPL, CAC, ROI theo nguồn/chiến dịch.
2. **Vận hành & CI/CD:** Cần file cấu hình CI `.github/workflows/ci.yml` và module `featureFlags.ts` bật/tắt tính năng theo môi trường.
3. **Trung tâm quyền riêng tư (Privacy Center):** Cần service `privacyService.ts` cho phép xuất toàn bộ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP, ẩn danh hóa thông tin cá nhân khách hàng (anonymize) mà không phá vỡ tính toàn vẹn của hợp đồng và giao dịch tài chính.
4. **Thiết kế Multi-tenant:** Soạn thảo tài liệu thiết kế kiến trúc toàn diện `docs/design/multi-tenant.md` (chỉ thiết kế theo yêu cầu, không đổi schema runtime).
5. **PWA & i18n:** Cấu hình Web App Manifest, offline care log queue với mã hóa an toàn và từ điển song ngữ vi/en `src/lib/i18n.ts`.

---

## 2. THIẾT KẾ MÔ HÌNH DỮ LIỆU (Migration 023)
1. **`campaigns` & `campaign_daily_costs`:**
   - `campaigns`: `id`, `name`, `channel`, `budget`, `start_date`, `end_date`, `status`, `utm_code`, `created_by`.
   - `campaign_daily_costs`: `id`, `campaign_id`, `date`, `cost_amount`, `notes`.
2. **`privacy_requests` (Yêu cầu xuất dữ liệu / ẩn danh):**
   - `id`, `customer_id`, `request_type` (`export`, `anonymize`), `status` (`pending`, `approved`, `completed`, `rejected`), `requested_by`, `approved_by`, `approved_at`, `notes`.

---

## 3. LỘ TRÌNH TRIỂN KHAI
1. **Database:** Viết Migration `023_marketing_campaigns_and_privacy.sql` và rollback.
2. **Types:** Bổ sung các interface trong `src/domain/types.ts`.
3. **Service & Libs:**
   - Tạo `src/domain/services/marketingService.ts` (quản lý chiến dịch, tính CPL, CAC, ROI).
   - Tạo `src/domain/services/privacyService.ts` (export dữ liệu khách, ẩn danh an toàn, quản lý consent).
   - Tạo `src/lib/featureFlags.ts` (quản lý cờ tính năng).
   - Tạo `src/lib/i18n.ts` (từ điển đa ngôn ngữ).
   - Tạo `docs/design/multi-tenant.md` (tài liệu kiến trúc Multi-tenant).
   - Tạo `.github/workflows/ci.yml` (CI pipeline).
4. **Kiểm thử:** Viết `src/test/marketing_privacy_and_pwa.test.ts`.
5. **Xác minh & Báo cáo:** Chạy `npm test` + `npm run build`, viết `docs/dev-log/phase-6-REPORT.md`, cập nhật `PROGRESS.md`.
