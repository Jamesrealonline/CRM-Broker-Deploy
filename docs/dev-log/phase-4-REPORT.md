# BÁO CÁO HOÀN THÀNH GIAI ĐOẠN 4 (PHASE 4 REPORT)
**Mục tiêu:** Quy trình bán hàng: Lịch hẹn & Check-in GPS/QR geofence, Máy tính vay ngân hàng & Báo giá Snapshot không hoa hồng, Webhook nhận lead chống giả mạo, Nhập CSV theo lô hoàn tác, Hợp nhất khách hàng trùng (Merge/Unmerge) & Hộp thư đa kênh.
**Thời gian hoàn thành:** 2026-11-09
**Branch:** `feat/phase-4-sales-workflow-tools`

---

## 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Database (Migration additive 021 & Rollback 021)
- `supabase/migrations/021_sales_workflow_tools_and_customer_management.sql`:
  - `quotations`: Quản lý báo giá độc lập, có mã định danh `BG-YYYY-XXXX`, thời hạn hiệu lực, snapshot giá và phương án thanh toán, **không chứa bất kỳ trường hoa hồng nào**.
  - `import_batches`: Ghi nhận nhật ký nhập dữ liệu theo lô, hỗ trợ truy vết và hoàn tác nguyên lô.
  - `customer_merges`: Quản lý lịch sử hợp nhất khách hàng, lưu snapshot để hoàn tác (`reverted`).
  - `interaction_timeline`: Bảng lưu vết tương tác đa kênh (Cuộc gọi, Zalo, SMS, Email).
- `supabase/migrations/rollback/021_rollback_sales_workflow_tools_and_customer_management.sql`: Script rollback an toàn additive.

### B. Domain Services (`salesWorkflowService.ts`)
- **4.1 Lịch hẹn & Check-in GPS/QR Code:**
  - `checkInAppointment`: So khớp mã QR dự án và tính toán khoảng cách Haversine GPS.
  - Ngoài bán kính 500m geofence tự động gắn cờ `outside_geofence`.
- **4.2 Công cụ tư vấn (Máy tính vay & Báo giá):**
  - `calculateMortgageSchedule`: Tính toán chính xác lịch trả nợ vay theo tháng, hỗ trợ ân hạn nợ gốc và 2 giai đoạn lãi suất (ưu đãi và thả nổi). Tổng tiền gốc trả khớp 100% số tiền vay.
  - `createQuotation`: Tạo báo giá snapshot độc lập, tính giá sau chiết khấu, **bảo vệ bí mật hoa hồng** trước khách hàng.
- **4.3 Nhập lead tự động qua Webhook & CSV theo lô:**
  - `processLeadWebhook`: Xác thực chữ ký số (HMAC verification) chống giả mạo request, chuẩn hóa SĐT E.164, tự động phát hiện và chặn tạo lead trùng lặp trong cùng dự án (`isDuplicatePrevented`).
  - `importLeadsBatch`: Đọc dữ liệu, kiểm tra định dạng SĐT, gắn `import_batch_id`.
  - `revertImportBatch`: Hoàn tác toàn bộ các lead của một lô nhập chỉ trong 1 thao tác.
- **4.4 Quản lý dữ liệu khách hàng (Customer Merge & Unmerge):**
  - `mergeCustomers`: Chuyển quyền sở hữu toàn bộ leads, transactions của khách trùng sang khách chính, lưu audit snapshot. Chỉ Quản lý sàn hoặc Admin mới có quyền thực hiện (`forbidden`).
  - `unmergeCustomer`: Hoàn tác hợp nhất, trả lại các leads về cho khách hàng cũ từ snapshot.

---

## 2. KẾT QUẢ KIỂM THỬ & BUILD
- **Unit Tests Mới:** Test suite `src/test/sales_workflow_tools.test.ts` (8/8 tests mới).
- **Tổng số test toàn hệ thống:** `160/160 tests passed` (20/20 test files).
- **TypeScript & Vite Build:** `npm run build` thành công 100%, 0 lỗi type/linting.

---

## 3. CHECKLIST MASTER PROMPT - GIAI ĐOẠN 4
- [x] Lịch hẹn tích hợp check-in QR và GPS geofence (ngoài bán kính gắn cờ).
- [x] Máy tính vay tính đúng ca mẫu có ân hạn gốc và 2 giai đoạn lãi suất.
- [x] Phiếu báo giá snapshot độc lập không hiển thị hoa hồng.
- [x] Webhook sai chữ ký bị từ chối; lead trùng không tạo bản ghi thứ 2.
- [x] Nhập CSV theo lô và hoàn tác theo `batch_id`.
- [x] Hợp nhất khách hàng giữ đủ lịch sử và hỗ trợ hoàn tác.
- [x] Khung thiết kế dòng thời gian đa kênh `interaction_timeline`.
