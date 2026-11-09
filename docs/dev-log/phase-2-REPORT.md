# BÁO CÁO HOÀN THÀNH GIAI ĐOẠN 2 (PHASE 2 REPORT)
**Mục tiêu:** Cưỡng chế SLA chống gian lận, Vận hành Lead Pool, Quản lý giữ căn (`unit_holds`), Danh sách chờ (`waitlist`) và Giám sát tiến trình nền (`job_runs` / Dead-letter queue).
**Thời gian hoàn thành:** 2026-11-09
**Branch:** `feat/phase-2-sla-lead-ops`

---

## 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Database (Migration additive 019 & Rollback 019)
- `supabase/migrations/019_sla_anti_cheat_holds_and_job_runs.sql`:
  - `lead_appointments`: Quản lý lịch hẹn, giới hạn tối đa 7 ngày tới, tối đa 2 hẹn mở/lead, cờ `no_result_overdue`.
  - `lead_loss_reasons`: 7 lý do chuẩn hóa khi đóng Lead (`price_too_high`, `location_not_fit`, `legal_concern`, `financial_issue`, `bought_elsewhere`, `not_interested`, `other`).
  - Mở rộng bảng `leads`: `loss_reason_code`, `loss_reason_detail`, `nurture_reminder_date`, `sla_reset_count`, `sla_flags`.
  - `unit_holds`: Giữ căn 24h/48h, partial unique index `(project_id, lower(trim(unit_code))) WHERE status = 'active'` chống giữ trùng căn.
  - `unit_waitlist`: Xếp hàng nhận căn tự động khi căn hết hạn giữ theo thứ tự ưu tiên FIFO.
  - `job_runs`: Theo dõi toàn bộ lịch sử chạy của cron và background worker.
  - `dead_letter_queue`: Lưu trữ thư và sự kiện outbox thất bại nhiều lần để retry hoặc xử lý sự cố.
  - Stored Procedures: `claim_pool_lead` (kiểm tra hạn mức 5/ngày và trần 20 lead mở), `release_expired_unit_holds` (giải phóng căn và thông báo người chờ).
- `supabase/migrations/rollback/019_rollback_sla_anti_cheat_holds_and_job_runs.sql`: Script hoàn tác an toàn additive.

### B. Domain Services & Repositories
- `src/domain/services/autoTransferService.ts`:
  - `scheduleAppointment`: Chặn hẹn > 7 ngày tương lai, chặn > 2 hẹn mở, tạm dừng đồng hồ SLA.
  - `completeAppointment`: Cưỡng chế tối thiểu 10 ký tự tóm tắt kết quả, gỡ cờ vi phạm.
  - `checkOverdueAppointments`: Quá hạn 4h không kết quả -> gắn cờ `no_result_overdue`, cưỡng chế mở lại đồng hồ đếm ngược SLA ngay cả khi ở trạng thái `appointment_set`.
  - `recordInteraction`: Bắt buộc >= 20 ký tự, chống spam nội dung trùng lặp liên tiếp, giới hạn tối đa 3 lần reset SLA liên tiếp (lần thứ 4 gắn cờ `suspicious_sla_reset` và giữ nguyên hạn chót).
  - `claimPoolLead`: Cưỡng chế tối đa 5 lead/ngày, tối đa 20 lead mở đồng thời, ghi lịch sử `pool_claimed`.
  - Leo thang phân cấp: Cảnh báo 20h gửi Sale + Trưởng nhóm (Team Leader).
  - `recordJobRun`, `getJobRuns`, `enqueueDeadLetter`, `getDeadLetterMessages`: Giám sát tác vụ nền.
- `src/data/repositories/holdRepository.ts`:
  - Quản lý giữ căn: Chặn giữ trùng căn cùng dự án (`duplicate_unit_hold`), giới hạn tối đa 3 căn đồng thời trên một Sale (`limit_exceeded`).
  - Gia hạn giữ căn: Chỉ Quản lý sàn hoặc Trưởng nhóm mới có quyền (`forbidden`).
  - Danh sách chờ (Waitlist): FIFO xếp hàng, giải phóng căn tự động kích hoạt chuyển trạng thái sang `notified`.
- `src/data/repositories/leadRepository.ts`:
  - `updateLeadStageWithTransaction`: Bắt buộc cung cấp `lossReasonCode` khi đóng Lead sang `lost` hoặc `invalid`. Reset `sla_reset_count = 0` khi chuyển trạng thái thành công.

---

## 2. KẾT QUẢ KIỂM THỬ & BUILD
- **Unit & Integration Tests:** Đã viết test suite chuyên biệt `src/test/sla_anticheat_holds_and_pool.test.ts` (15/15 tests mới).
- **Tổng số test toàn hệ thống:** `143/143 tests passed` (18/18 test files).
- **TypeScript & Vite Build:** `npm run build` thành công 100%, 0 lỗi type/linting.

---

## 3. CHECKLIST MASTER PROMPT - GIAI ĐOẠN 2
- [x] Ràng buộc lịch hẹn tối đa 7 ngày, tối đa 2 hẹn mở/lead.
- [x] Quá hạn 4 giờ không kết quả tự động gắn cờ `no_result_overdue` và kích hoạt lại SLA.
- [x] Ràng buộc tương tác >= 20 ký tự, chặn trùng lặp, tối đa 3 lần reset SLA.
- [x] Cơ chế Lead Pool kiểm soát concurrency, hạn mức 5 lead/ngày, trần 20 lead mở.
- [x] Phân hệ Giữ Căn (`unit_holds`) chống giữ trùng, giới hạn 3 căn/sale, giải phóng tự động kèm waitlist FIFO.
- [x] Bảng `lead_loss_reasons` chuẩn hóa, bắt buộc khi đóng lost/invalid.
- [x] Bảng `job_runs` & Dead-Letter Queue giám sát background worker.
- [x] Báo cáo cảnh báo leo thang: 20h tới Sale + Team Leader, thu hồi lần 2 tới Sales Manager.
