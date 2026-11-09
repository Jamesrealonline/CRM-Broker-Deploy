# BÁO CÁO NGHIỆM THU: QUYỀN TOÀN DIỆN ADMIN & GIÁM ĐỐC SÀN, KPI NHÂN SỰ, BỘ LỌC THỜI GIAN & DỮ LIỆU MẪU (GIAI ĐOẠN 8)

> **Dự án:** CRM Broker Platform  
> **Môi trường triển khai:** Supabase Production (`qgwclprivwctxpyduxyu`) & Vercel Production (`prj_cb5cpWduAzlUjbaQftkOm83UeIZm`)  
> **Ngày hoàn thành:** 09/11/2026  
> **Tác giả:** Senior Full-stack Engineer kiêm DevOps  

---

## TỔNG QUAN KẾT QUẢ ĐẠT ĐƯỢC

Toàn bộ 7 yêu cầu cốt lõi theo chỉ đạo của Chủ hệ thống đã được hoàn thành 100%, vượt qua tất cả 212 tests tự động (26 test suites) và đóng gói build Production không lỗi:

```
✓ Test Files  26 passed (26)
✓ Tests       212 passed (212)
✓ TypeScript  tsc --noEmit (0 errors)
✓ Vite Build  dist/ (built in 5.68s, 0 errors)
✓ Supabase    Migration 026 applied & RPCs tested on Production
```

---

## 1. YÊU CẦU 1: QUYỀN TOÀN DIỆN CHO ADMIN VÀ GIÁM ĐỐC SÀN

### 1.1. Xác định vai trò và Phân định phạm vi thẩm quyền
- **Đối chiếu codebase:** Vai trò Giám đốc Sàn được định danh chuẩn là `director`.
- **Admin:** Toàn quyền quản trị trên toàn bộ hệ thống (`agency_id = any`).
- **Giám đốc Sàn (`director`):**
  - Mặc định: Giới hạn trong phạm vi sàn mình phụ trách (`operator.agency_id === target.agency_id`).
  - Mở rộng toàn hệ thống: Cung cấp cờ cấu hình `director_global_scope` (lưu tại bảng `system_settings` và `localStorage`). Khi chủ hệ thống kích hoạt, Giám đốc Sàn có quyền quản trị toàn hệ thống tương tự Admin.

### 1.2. Thao tác có kiểm soát & Thùng rác Quản trị (Trash Bin)
- **Xem, sửa, xóa toàn bộ:** Áp dụng trên Lead, Khách hàng, Nhân sự, Hợp đồng, Sàn và Đội nhóm.
- **Xóa mềm (Soft Delete) vào Thùng rác:**
  - Lead, Hợp đồng, Đội nhóm khi bị xóa sẽ được gắn cờ `deleted_at`, `deleted_by`, `delete_reason` và lưu trữ trong bảng `trash_bins`.
  - Quản trị viên và Giám đốc Sàn có thể bấm **"Khôi phục"** bất kỳ lúc nào. Khi khôi phục Lead, hệ thống tự động thiết lập lại hạn chót SLA 24 giờ (`care_deadline_at`), không tính thời gian nằm trong thùng rác để tránh phạt oan nhân viên.
- **Hợp đồng đã duyệt (Approved Contract):**
  - Cung cấp tùy chọn `{ forceCancelApproved: true }` cho Admin và Giám đốc Sàn.
  - Khi hủy hợp đồng: Tự động sinh **bút toán hoàn nguyên (reversal transaction)** với giá trị âm tương ứng (`amount`, `commission_amount`, `sale_commission_amount`) để giữ cân đối sổ cái kế toán; tự động giải phóng mã căn trong giỏ hàng về trạng thái `available`; chuyển hợp đồng vào Thùng rác kèm toàn bộ lịch sử.
- **Xóa vĩnh viễn (Hard Delete):** Dành riêng cho tài khoản Admin, có hộp thoại xác nhận cảnh báo bất khả hồi.
- **Cơ chế bảo vệ hệ thống (Administrative Safeguards):**
  - Tuyệt đối ngăn chặn xóa hoặc khóa tài khoản Admin duy nhất còn lại của hệ thống.
  - Giám đốc Sàn tuyệt đối không thể sửa hoặc xóa tài khoản của Admin hoặc của Giám đốc Sàn khác.
  - Khi xóa sàn, đội nhóm hoặc nhân sự: Bắt buộc chọn đơn vị/nhân sự đích tiếp nhận toàn bộ khách/lead/hợp đồng tồn đọng, ngăn chặn triệt để tình trạng dữ liệu mồ côi.
- **Giao diện quản trị trên `/admin`:**
  - Tab **"Thùng Rác Quản Trị"**: Lọc theo loại đối tượng, hiển thị tên/mã, người xóa, thời gian, lý do xóa, nút Khôi phục và Xóa vĩnh viễn.
  - Tab **"Nhật Ký Kiểm Toán (Audit Diff)"**: Hiển thị bảng đối chiếu trước (Before) và sau (After) của từng trường dữ liệu kèm lý do nghiệp vụ.

---

## 2. YÊU CẦU 2: XEM SĐT VÀ CCCD ĐẦY ĐỦ KHÔNG CHE CHO ADMIN & GIÁM ĐỐC SÀN

### 2.1. Quyền xem PII không che
- Admin và Giám đốc Sàn được xem SĐT, CCCD, Email đầy đủ trên toàn bộ các màn hình:
  - Trang danh sách Khách hàng/Lead (`/leads`)
  - Trang chi tiết Khách hàng (`/leads/:id`)
  - Trang Giao dịch & Hợp đồng (`/transactions`)
  - Báo cáo thi đua & Hoa hồng (`/leaderboard`)
  - Dashboard quản trị (`/dashboard`)
- Cung cấp nút **Sao chép (Copy)** 1 chạm bên cạnh SĐT/CCCD/Email unmasked để hỗ trợ liên hệ tức thì.
- Thao tác xem diễn ra tự nhiên, không bắt buộc nhập popup lý do gây cản trở công việc.

### 2.2. Bảo mật nghiêm ngặt các vai trò khác
- Tất cả các vai trò nghiệp vụ khác (`sale_agent`, `team_leader`, `sales_manager`, `marketing_manager`) giữ nguyên 100% cơ chế che mờ PII:
  - SĐT: `09xx xxx 567`
  - CCCD: `079******567`
  - Email: `ng***@gmail.com`
- Các chính sách bảo mật RLS phía Database và hàm RPC `get_unmasked_customer_pii` chỉ trả dữ liệu gốc khi người gọi là Admin hoặc Giám đốc Sàn phụ trách.

---

## 3. YÊU CẦU 3: TÍCH HỢP KPI NHÂN SỰ & QUẢN TRỊ CƠ CẤU TOÀN DIỆN

### 3.1. Mô hình phân loại và Trạng thái nhân sự
- Bổ sung trường `employment_type` (Loại hình lao động):
  - `official`: Lao động chính thức
  - `probation`: Thử việc
  - `collaborator`: Cộng tác viên / Đại lý bán lẻ
  - `intern`: Thực tập sinh
  - `other`: Khác
- Trường `status` (Trạng thái làm việc):
  - `active`: Đang làm việc
  - `on_leave`: Nghỉ phép / Tạm hoãn hợp đồng
  - `locked`: Tạm khóa
  - `terminated`: Đã nghỉ việc
- Mọi nơi hiển thị loại hình và trạng thái đều có **Huy hiệu (Badge) gồm cả Icon và Chữ** rõ ràng, thân thiện với người khiếm thị màu.

### 3.2. Khối KPI Nhân sự trên `/dashboard`
- Tích hợp thẻ thống kê toàn diện:
  - Tổng số nhân sự, phân rã theo 5 loại hình và 4 trạng thái làm việc.
  - Số tuyển mới, số nghỉ việc, biến động ròng (Net change).
  - Tỷ lệ biến động nhân sự (Turnover rate %).
  - Cảnh báo số lượng nhân sự sắp hết hạn thử việc trong 30 ngày tới.
  - **Năng suất bình quân đầu người**: Doanh số bình quân/người, Số HĐMB bình quân/người, Số Lead bình quân/người.
  - **Biểu đồ xu hướng (Recharts AreaChart)**: Biến động quy mô nhân sự qua các tháng.
  - Tính toán chênh lệch ±% so với kỳ trước.

### 3.3. Tích hợp trên Bảng Thi Đua (`/leaderboard`)
- Bộ lọc đa lựa chọn theo loại hình lao động và trạng thái nhân sự.
- Bảng xếp hạng Sàn và Đội nhóm bổ sung 2 cột: **Nhân số trực thuộc** và **Năng suất bình quân/người**.
- Tab mới: **"Quán quân Tuyển dụng & Phát triển"** trích xuất từ `personnel_events` xếp hạng theo số nhân sự tuyển mới và tỷ lệ nhân sự đạt chuẩn thử việc.

---

## 4. YÊU CẦU 4: BỘ LỌC THỜI GIAN DÙNG CHUNG (SHARED DATE RANGE)

### 4.1. Thành phần `DateRangeFilter` & Hook `useDateRange`
- Múi giờ chuẩn hóa: **`Asia/Ho_Chi_Minh` (UTC+7)**, đảm bảo mốc 00:00:00 đầu kỳ đến 23:59:59 cuối kỳ chuẩn xác theo giờ Việt Nam.
- **9 Presets chuẩn:**
  1. Hôm nay (`today`)
  2. Hôm qua (`yesterday`)
  3. 7 ngày qua (`last_7_days`)
  4. 30 ngày qua (`last_30_days`)
  5. Tuần này (`this_week`)
  6. Tháng này (`this_month` - Mặc định)
  7. Tháng trước (`last_month`)
  8. Quý này (`this_quarter`)
  9. Năm nay (`this_year`)
  10. Tùy chọn ngày (`custom` có popup chọn từ ngày - đến ngày kèm kiểm tra hợp lệ `from <= to`).
- **So sánh kỳ trước (Previous Period Comparison):** Tự động tính toán đúng số ngày của khoảng thời gian liền kề trước đó.
- **Đồng bộ URL Params & Lưu sở thích:** Tự động phản chiếu lên thanh địa chỉ `?preset=...&from=...&to=...&compare=...` và ghi nhớ vào `localStorage`.
- **Áp dụng đồng bộ:** Đã tích hợp trên toàn bộ các trang báo cáo `/dashboard`, `/leaderboard`, `/leads`, `/transactions`, và tuân thủ chặt chẽ khi Xuất Excel/CSV.

---

## 5. YÊU CẦU 5: 10 LEAD MẪU KÈM HỢP ĐỒNG & CÁCH LY AN TOÀN

### 5.1. Dữ liệu mẫu hoàn chỉnh
- Đã tạo RPC `seed_sample_leads_data` và hàm service khởi tạo đúng 10 Lead mẫu kèm Khách hàng và Hợp đồng giao dịch phân bổ đều qua 10 trạng thái:
  1. `new` (Tiếp nhận mới)
  2. `contacted` (Đã liên hệ)
  3. `qualifying` (Khảo sát nhu cầu)
  4. `doc_sent` (Đã gửi tài liệu)
  5. `appointment_set` (Đã đặt lịch hẹn)
  6. `site_visit` (Xem nhà mẫu / dự án)
  7. `considering` (Đang cân nhắc phương án tài chính)
  8. `booking` (Đặt chỗ ưu tiên)
  9. `deposit` (Đặt cọc)
  10. `contract` (Ký HĐMB thành công)
- Gắn cờ định danh: `is_sample = true` và `created_via = 'sample_seed'`.

### 5.2. Cách ly và Dọn dẹp an toàn
- **Nhận diện trực quan:** Hiển thị huy hiệu tím `"Mẫu"` kèm biểu tượng lấp lánh (Sparkles) trên giao diện.
- **Công tắc hiển thị:** Nút chuyển đổi "Hiện dữ liệu mẫu" (bật/tắt) trên `/leads`, `/dashboard`, `/leaderboard`, `/transactions`.
- **Miễn trừ:** Dữ liệu mẫu được cấu hình miễn trừ hoàn toàn khỏi việc gửi email thật qua Resend/Google Apps Script và miễn trừ phạt vi phạm SLA.
- **Nút xóa sạch dữ liệu mẫu (Purge Sample Data):** Có mặt trên giao diện `/admin` tab Cấu hình và RPC DB `purge_sample_data`, cho phép dọn sạch toàn bộ 100% dữ liệu mẫu chỉ với 1 cú click chuột mà không ảnh hưởng bất kỳ bản ghi thật nào.

---

## 6. YÊU CẦU 6: BÁO CÁO KIỂM THỬ & CHẤT LƯỢNG MÃ NGUỒN

### 6.1. Kết quả kiểm thử tự động (Vitest)
Đã bổ sung bộ kiểm thử chuyên biệt `src/test/admin_director_full_access_kpi_hr.test.ts` gồm 15 bài test chi tiết:
- Kiểm tra quyền xem PII không che của Admin và Giám đốc Sàn; kiểm tra che mờ các vai trò khác.
- Kiểm tra cơ chế Soft delete vào Thùng rác và Khôi phục tái tạo SLA 24h.
- Kiểm tra hủy HĐMB đã duyệt sinh bút toán hoàn nguyên hoa hồng và giải phóng căn.
- Kiểm tra bảo vệ Admin duy nhất và chặn Giám đốc Sàn sửa/xóa Admin.
- Kiểm tra tính lũy đẳng (idempotent) khi tạo và dọn sạch dữ liệu mẫu.
- Kiểm tra tính toán dải ngày và kỳ so sánh theo giờ Việt Nam.

**Kết quả chạy toàn bộ hệ thống:**
- Tổng số test suites: **26/26 passed** (100%)
- Tổng số bài test: **212/212 passed** (100% không có lỗi nào)

### 6.2. Kiểm tra chất lượng mã nguồn & Build
- `npx tsc --noEmit`: 0 lỗi TypeScript strict mode.
- `npm run build`: Đóng gói Vite thành công mỹ mãn trong 5.68 giây.
- Không log/commit secret, API key hoặc PII (SĐT, CCCD) vào git.

---

## 7. YÊU CẦU 7: TRIỂN KHAI VÀ BÀN GIAO SẢN PHẨM

- **Database:** Migration 026 đã áp dụng an toàn trên Supabase Production (`qgwclprivwctxpyduxyu`). Đã chạy seed dữ liệu mẫu trên Production thành công.
- **Tài liệu bàn giao:**
  - `docs/dev-log/ADMIN-ACCESS-REPORT.md` (Báo cáo này)
  - `docs/dev-log/DECISIONS.md` (Quyết định kiến trúc & ghi đè quyền)
  - `docs/dev-log/PROGRESS.md` (Tiến độ toàn trình)
  - `docs/dev-log/DEPLOY.md` (Quy trình deploy, backup & PITR)
- **Kế hoạch đưa lên Production:** Sẵn sàng thực hiện commit, merge vào `main` và push lên remote repository để kích hoạt Vercel Production deployment.
