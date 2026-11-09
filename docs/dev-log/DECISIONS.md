# ARCHITECTURAL & BUSINESS DECISIONS LOG (DECISIONS.md)
> Tài liệu ghi vết các quyết định kỹ thuật, nghiệp vụ, pháp lý và cấu hình của CRM Broker Platform theo MASTER_PROMPT.md.

---

## 1. PHÂN QUYỀN VÀ BẢO MẬT (GIAI ĐOẠN 1)
- **Quyết định 1.1: Vai trò HR Admin (hr_admin)**
  - *Phương án chọn:* Bổ sung vai trò `hr_admin` kiểu additive vào CHECK constraint của bảng `profiles(role)` và enum `UserRole`.
  - *Mặc định:* Không tự động gán cho tài khoản có sẵn.
  - *Phạm vi:* Quản trị hồ sơ nhân sự, tuyển dụng, hợp đồng lao động, chứng chỉ, nghỉ phép, đào tạo. Không xem chi tiết hoa hồng/doanh số giao dịch tài chính cá nhân của Sale.
- **Quyết định 1.2: Che mờ PII tầng Database**
  - *Phương án chọn:* View và RPC trả SĐT dạng `09xx xxx 123` cho `marketing_manager` và người không có quyền sở hữu lead; CCCD được mã hóa (pgcrypto/Vault).
  - *Mở khóa dữ liệu:* Hàm `reveal_employee_private_field` và `reveal_cccd` bắt buộc lý do nghiệp vụ và tự động ghi vết `audit_logs`.
- **Quyết định 1.3: Bảo vệ Secret và Kênh Email**
  - *Phương án chọn:* Toàn bộ email credentials, webhook URLs và Resend API keys được lưu trữ bảo vệ trong biến môi trường / Vault. Client chỉ nhận cấu hình che mờ.
  - *Khuyến nghị:* Quản trị viên thực hiện xoay (rotate) các key từng lưu ở database cũ.

---

## 2. VẬN HÀNH LEAD & SLA 24H (GIAI ĐOẠN 2)
- **Quyết định 2.1: Giờ tính SLA (Wall-Clock vs Business Hours)**
  - *Phương án chọn:* Cung cấp cấu hình chỉnh được `sla_calculation_mode`: mặc định tính theo giờ làm việc (08:00 - 18:00, trừ Chủ nhật) nhưng hỗ trợ chuyển sang 24h liên tục.
  - *Chống gian lận:* Hẹn ảo dừng đồng hồ chỉ hợp lệ tối đa 7 ngày tới, tối đa 2 hẹn mở/lead. Quá hạn hẹn 4 giờ không ghi kết quả sẽ tự động mở lại đồng hồ và gắn cờ cảnh báo.
  - *Tương tác hợp lệ:* Tối thiểu 20 ký tự, chặn trùng lặp liên tiếp, tối đa 3 lần reset đồng hồ mà không đổi trạng thái lead.
- **Quyết định 2.2: Leo thang theo chuỗi quản trị**
  - *Phương án chọn:* Mốc 20h cảnh báo Sale và Trưởng nhóm; Thu hồi lần 2 hoặc về Pool cảnh báo Giám đốc Sàn; Báo cáo tổng hợp bất thường hằng ngày gửi Ban Giám Đốc.
- **Quyết định 2.3: Giữ căn (Unit Holds) & Danh sách chờ (Waitlist)**
  - *Thời hạn giữ căn:* Mặc định 24 giờ đối với dự án mở bán, 48 giờ đối với dự án thông thường. Hết hạn cron tự động giải phóng căn và thông báo khách tiếp theo trong Waitlist.

---

## 3. HỢP ĐỒNG, HOA HỒNG & TÀI CHÍNH (GIAI ĐOẠN 3)
- **Quyết định 3.1: First-Touch Attribution**
  - *Phương án chọn:* Khách/Lead đã có nguồn ban đầu thì giữ nguyên (read-only), không bị ghi đè khi phát sinh hợp đồng mới.
- **Quyết định 3.2: Hoa hồng nhiều tầng theo Chuỗi trực thuộc tại thời điểm ký**
  - *Phương án chọn:* Tỷ lệ hoa hồng Sàn, Sale, Trưởng nhóm, Trưởng phòng, Giám đốc được lưu snapshot bất biến trên từng hợp đồng theo `v_sale_chain` tại thời điểm ký HĐMB. Khi nhân sự điều chuyển sau này, hợp đồng cũ vẫn giữ nguyên snapshot người nhận hoa hồng lúc ký.
- **Quyết định 3.3: Thuế TNCN và Khấu trừ hoa hồng**
  - *Phương án chọn:* Đưa tỷ lệ khấu trừ thuế TNCN thành cấu hình kế toán (mặc định 10% vãng lai cho CTV/đại lý, biểu lũy tiến theo bảng lương cho nhân viên chính thức) để bộ phận Kế toán / Thuế tự điều chỉnh theo quy định thực tế.

---

## 4. CHUỖI CẤP BẬC VÀ QUẢN TRỊ SÀN (GIAI ĐOẠN 5 & 5.0A)
- **Quyết định 4.1: Cấu trúc trực thuộc bắt buộc (Không tồn tại sale mồ côi)**
  - *Phương án chọn:* Mọi chuyên viên (`sale_agent`) bắt buộc thuộc một Trưởng nhóm (`team_leader`), nhóm thuộc một Trưởng phòng/Phòng kinh doanh (`department`), phòng thuộc một Giám đốc/Sàn (`agency/director`), đồng thời thuộc một Đơn vị Marketing (`marketing_unit`).
  - *Backfill an toàn:* Sale hiện có chưa đủ chuỗi được gắn vào nhóm/đơn vị "Chưa phân bổ", sau 14 ngày nếu chưa hoàn thiện sẽ tự động tạm dừng nhận lead mới và thông báo quản lý.
- **Quyết định 4.2: Phân loại lao động và Rủi ro pháp chế**
  - *Phương án chọn:* Cung cấp 3 loại hình: `official` (chính thức), `probation` (thử việc), `collaborator` (CTV/đại lý). CTV không áp dụng phép năm và không áp dụng kỷ luật sa thải theo BLLĐ (chỉ chấm dứt hợp đồng dịch vụ BĐS) để tránh rủi ro "quan hệ lao động che giấu".

---

## 5. QUẢN TRỊ DỮ LIỆU & THÙNG RÁC (GIAI ĐOẠN 7)
- **Quyết định 5.1: Xóa mềm và Khôi phục (Soft-delete & Trash)**
  - *Phương án chọn:* Tuyệt đối không xóa cứng dữ liệu giao dịch/nhân sự/khách hàng. Mọi thao tác xóa là gắn cờ `deleted_at`, `deleted_by`, `delete_reason`.
  - *Khóa lạc quan (Optimistic Locking):* Sử dụng cột `version` để chống ghi đè đồng thời giữa 2 quản trị viên.
  - *Bảo mật thẩm quyền:* Giám đốc Sàn chỉ được thao tác trong sàn của mình; không được xóa/sửa dữ liệu của Admin hoặc người cấp cao hơn.
