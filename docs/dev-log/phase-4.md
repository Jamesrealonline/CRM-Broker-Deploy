# GIAI ĐOẠN 4 – KHẢO SÁT & KẾ HOẠCH TRIỂN KHAI (PHASE 4 SURVEY & PLAN)
**Mục tiêu:** Quy trình bán hàng: Lịch hẹn & check-in GPS/QR, Công cụ tính vay & Báo giá Snapshot không hoa hồng, Webhook & Nhập CSV theo lô hoàn tác, Merge khách hàng, Hộp thư đa kênh.
**Branch:** `feat/phase-4-sales-workflow-tools`
**Thời gian thực hiện:** 2026-11-09

---

## 1. KHẢO SÁT HIỆN TRẠNG CODEBASE
1. **Lịch hẹn (`lead_appointments`):**
   - Đã có bảng và logic cơ bản ở GĐ2 (`scheduleAppointment`, `checkOverdueAppointments`, `completeAppointment`).
   - Cần bổ sung: loại hẹn (`sample_house`, `site_visit`, `consulting`), trạng thái (`attended`, `no_show`, `rescheduled`), check-in tại dự án bằng QR và GPS geofence (khoảng cách Haversine so với dự án, gắn cờ `outside_geofence`).
2. **Công cụ tài chính & Báo giá Snapshot:**
   - Chưa có module tính vay chiết khấu / ân hạn nợ gốc chuẩn.
   - Chưa có bảng/logic `quotations` (Phiếu báo giá snapshot gửi khách, không chứa hoa hồng, có mã báo giá và hạn hiệu lực).
3. **Nhập lead tự động:**
   - Chưa có webhook nhận lead xác thực chữ ký HMAC-SHA256 chống giả mạo.
   - Chưa có cơ chế nhập CSV theo lô (`import_batches`) kèm tính năng hoàn tác toàn bộ lô (`revertImportBatch`).
4. **Quản lý dữ liệu khách hàng:**
   - Chưa có hàm hợp nhất khách hàng trùng (`mergeCustomers`) giữ toàn bộ lịch sử và cho phép hoàn tác (`unmergeCustomer`).
5. **Hộp thư đa kênh & Ghi âm:**
   - Cần dựng khung `interaction_timeline` và cấu hình pháp lý ghi âm (tắt mặc định, ghi `DECISIONS.md`).

---

## 2. THIẾT KẾ MÔ HÌNH DỮ LIỆU (Migration 021)
1. **`quotations` (Báo giá snapshot không hoa hồng):**
   - `id`, `code` (`BG-YYYY-XXXX`), `lead_id`, `project_id`, `unit_code`, `deal_value`, `discount_amount`, `final_price`, `payment_plan_summary` (jsonb), `valid_until`, `created_by`, `status` (`draft`, `sent`, `accepted`, `expired`), `created_at`.
2. **`import_batches` (Nhập dữ liệu theo lô):**
   - `id`, `file_name`, `total_rows`, `success_rows`, `error_rows`, `status` (`imported`, `reverted`), `created_by`, `created_at`, `reverted_at`.
3. **`customer_merges` (Truy vết hợp nhất khách hàng):**
   - `id`, `primary_customer_id`, `merged_customer_id`, `merged_by`, `merged_at`, `status` (`active`, `reverted`), `reverted_at`, `audit_snapshot` (jsonb).
4. **`interaction_timeline` (Dòng thời gian đa kênh):**
   - `id`, `lead_id`, `channel` (`call`, `zalo`, `sms`, `email`), `direction` (`inbound`, `outbound`), `content`, `metadata` (jsonb), `created_by`, `created_at`.

---

## 3. LỘ TRÌNH TRIỂN KHAI
1. **Database:** Viết Migration `021_sales_workflow_tools_and_customer_management.sql` và rollback tương ứng.
2. **Types:** Bổ sung các interface trong `src/domain/types.ts`.
3. **Service:** Tạo `src/domain/services/salesWorkflowService.ts`:
   - Tính toán lịch trả nợ vay ngân hàng (`calculateMortgageSchedule`).
   - Check-in dự án bằng GPS/QR (`checkInAppointment`).
   - Tạo và xuất Báo giá snapshot (`createQuotation`).
   - Xử lý Webhook có chữ ký bảo mật (`processLeadWebhook`).
   - Nhập CSV theo lô và hoàn tác (`importLeadsBatch`, `revertImportBatch`).
   - Hợp nhất và hoàn tác hợp nhất khách hàng (`mergeCustomers`, `unmergeCustomer`).
4. **Kiểm thử:** Viết `src/test/sales_workflow_tools.test.ts`.
5. **Xác minh & Báo cáo:** Chạy `npm test` + `npm run build`, viết `docs/dev-log/phase-4-REPORT.md`, cập nhật `PROGRESS.md`.
