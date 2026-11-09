# KHẢO SÁT & KẾ HOẠCH TRIỂN KHAI GIAI ĐOẠN 2
## SLA CHỐNG GIAN LẬN, LEAD POOL, GIỮ CĂN & GIÁM SÁT JOB NỀN

---

### 1. HIỆN TRẠNG
- **SLA 24h & Quét quá hạn:** Đã có `autoTransferService` và migration `009_server_side_sla_and_cron_scanner.sql` thực hiện Round-Robin, chuyển tối đa 3 lần rồi về Kho Lead Chung, có dry-run và outbox.
- **Thiếu sót cần khắc phục:**
  1. *Chưa có bộ chống "hẹn ảo" & tương tác rác:* Sale có thể tạo lịch hẹn quá xa (ví dụ 30 ngày sau) để né bị thu hồi lead, hoặc ghi chú tương tác 1-2 ký tự ("ok", ".") để reset thời gian. Hẹn quá giờ chưa có cơ chế phạt mở lại đồng hồ sau 4h.
  2. *Chưa có cơ chế leo thang chuỗi quản lý:* Cảnh báo mốc 20h mới chỉ gửi cho Sale, chưa gửi Trưởng nhóm; thu hồi lần 2 chưa báo Trưởng phòng; chưa có báo cáo bất thường cho Giám đốc.
  3. *Lead Pool chưa có kiểm soát cạnh tranh và hạn mức:* Thiếu hạn mức nhận lead/ngày và trần số lead mở đang giữ của Sale; chuyển thất bại (`lost`) chưa bắt buộc lý do chuẩn hóa (`lead_loss_reasons`).
  4. *Chưa có phân hệ Giữ Căn (`unit_holds`) & Danh sách chờ (`waitlist`):* Chưa có cơ chế khóa căn tạm thời, đếm ngược tự động giải phóng và thông báo waitlist.
  5. *Chưa có bảng `job_runs` & Dead-Letter Queue:* Chưa lưu vết lịch sử chạy cron và hàng chờ xử lý lỗi khi gửi thông báo/email thất bại nhiều lần.

---

### 2. PHƯƠNG ÁN TRIỂN KHAI

#### A. Database (Migration 019)
- Tạo bảng `lead_appointments`: `lead_id`, `sale_id`, `appointment_date`, `location`, `status`, `result_summary`, `flags`. Giới hạn hẹn tối đa 7 ngày tới, tối đa 2 hẹn mở/lead. Quá hạn 4 giờ không cập nhật kết quả -> gắn cờ `no_result_overdue` và mở lại SLA clock.
- Ràng buộc tương tác chăm sóc: Bắt buộc tối thiểu 20 ký tự, chặn trùng lặp nội dung liên tiếp, tối đa 3 lần reset đồng hồ mà không đổi trạng thái hoặc không có hẹn mới.
- Bảng `lead_loss_reasons`: 7 lý do chuẩn hóa (giá, vị trí, pháp lý, tài chính, mua nơi khác, không nhu cầu, khác). Trạng thái `lost`/`invalid` bắt buộc có lý do.
- Cột `nurture_reminder_date` trên `leads`: Chế độ "nuôi lại" dừng đồng hồ SLA đến ngày nhắc.
- Bảng `unit_holds` và `unit_waitlist`: Giữ căn 24-48h, partial unique index `(project_id, unit_code)` WHERE `status = 'active'`, tự động giải phóng căn và thông báo người chờ kế tiếp.
- Bảng `job_runs` & `dead_letter_queue`: Ghi nhận nhật ký chạy job của toàn bộ cron background.
- RPC atomic `claim_pool_lead`: Nhận lead từ Pool với `SELECT FOR UPDATE SKIP LOCKED`, cưỡng chế trần lead mở (tối đa 20) và hạn mức nhận/ngày (tối đa 5).
- RPC atomic `release_expired_unit_holds`: Giải phóng căn hết hạn và kích hoạt waitlist.

#### B. Domain & Repositories
- Cập nhật `autoTransferService.ts`: Tích hợp kiểm tra hẹn ảo, tương tác rác, leo thang chuỗi quản lý (20h gửi Sale + Trưởng nhóm; thu hồi lần 2 báo Trưởng phòng).
- Tạo `holdRepository.ts`: Quản lý giữ căn, gia hạn, chuyển thành cọc, danh sách chờ waitlist.
- Cập nhật `leadRepository.ts`: Bắt buộc lý do đóng lead, kiểm tra hạn mức nhận lead từ Pool, đăng ký nuôi lại lead.

#### C. Giao diện Người dùng
- Quản lý giữ căn trên thẻ căn hộ (đếm ngược thời gian giữ, nút Giữ căn / Gia hạn).
- Modal nhận lead từ Kho chung có hiển thị số lượng lead được nhận trong ngày.
- Popup đóng lead bắt buộc chọn lý do từ `lead_loss_reasons`.
- Tab "Sức khỏe hệ thống & Job nền" trong `/admin`: Theo dõi `job_runs`, Outbox retry và Dead-letter queue.

#### D. Kiểm thử (Vitest)
- Test suite `src/test/sla_anticheat_holds_and_pool.test.ts`:
  1. Hẹn quá hạn 4h tự động mở lại đồng hồ SLA và gắn cờ `no_result_overdue`.
  2. Vượt quá 2 hẹn mở hoặc hẹn quá 7 ngày bị từ chối dừng đồng hồ.
  3. Tương tác < 20 ký tự hoặc reset quá 3 lần bị gắn cờ nghi ngờ cho leader.
  4. Hai sale nhận cùng lead từ Pool chỉ 1 người thành công (`FOR UPDATE SKIP LOCKED`).
  5. Giữ căn trùng bị chặn; hết hạn giữ tự động giải phóng căn và đôn waitlist.
  6. Đóng lead thất bại không có lý do bị từ chối.
  7. Job nền ghi nhận đúng `job_runs` và outbox lỗi chuyển vào dead-letter.
