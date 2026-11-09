# GIAI ĐOẠN 7 – KHẢO SÁT & KẾ HOẠCH TRIỂN KHAI (PHASE 7 SURVEY & PLAN)
**Mục tiêu:** Quản trị dữ liệu: Sửa / Xóa có kiểm soát (Admin & Giám đốc Sàn), Thùng rác (Trash Bin), Khóa lạc quan (Optimistic Locking), Chống leo thang quyền, Audit Diff Before/After.
**Branch:** `feat/phase-7-controlled-data-management`
**Thời gian thực hiện:** 2026-11-09

---

## 1. KHẢO SÁT HIỆN TRẠNG
1. **Phân quyền và Phạm vi (Scope Enforcement):**
   - Admin: toàn hệ thống.
   - Director (Giám đốc Sàn): chỉ trong sàn của mình (`agency_id`).
   - Sales Manager (Trưởng phòng): chỉ trong phòng của mình (`department_id`).
   - Chặn tuyệt đối: Giám đốc Sàn không được sửa/xóa Admin hoặc tài khoản cấp trên/cùng cấp, không được tự tăng quyền, không xóa Admin cuối cùng.
2. **Khóa lạc quan (Optimistic Locking):**
   - Bổ sung cột `version INT DEFAULT 1` trên các bảng dữ liệu chính (`leads`, `customers`, `transactions`, `teams`, `agencies`).
   - Khi cập nhật: nếu `version` gửi lên khác `version` hiện tại trong DB/kho lưu trữ -> Quăng lỗi xung đột dữ liệu ("Bản ghi đã được người khác cập nhật").
3. **Xóa mềm & Thùng rác (Trash Bin):**
   - Xóa mềm: đánh dấu `deleted_at`, `deleted_by`, `delete_reason`.
   - Bảng `trash_bins`: lưu trữ bản ghi đã xóa tạm, metadata tác động, hỗ trợ khôi phục hoàn tác một chạm hoặc khôi phục hàng loạt.
   - Chặn xóa: Lead có hợp đồng hiệu lực không thể bị xóa mềm. Hợp đồng đã duyệt/có tiền thu không xóa mềm, chỉ hủy/clawback. Vô hiệu hóa sàn/giải thể nhóm khi còn nhân sự/lead đang mở phải chuyển giao toàn bộ trước.
4. **Nhật ký thay đổi (Audit Diff Before/After):**
   - Lưu diff chi tiết trước - sau cho từng trường cập nhật, tự động che mờ PII thô.

---

## 2. THIẾT KẾ MÔ HÌNH DỮ LIỆU (Migration 024)
1. **Bổ sung cột trên các bảng chính:**
   - `leads`: `version INT DEFAULT 1`, `deleted_at TIMESTAMPTZ`, `deleted_by UUID`, `delete_reason TEXT`.
   - `transactions`: `version INT DEFAULT 1`, `deleted_at TIMESTAMPTZ`, `deleted_by UUID`, `delete_reason TEXT`.
   - `teams`: `version INT DEFAULT 1`, `deleted_at TIMESTAMPTZ`, `deleted_by UUID`, `delete_reason TEXT`.
   - `agencies`: `is_active BOOLEAN DEFAULT true`, `disabled_at TIMESTAMPTZ`, `disabled_by UUID`.
2. **Bảng `trash_bins`:**
   - `id UUID PRIMARY KEY`, `entity_type TEXT`, `entity_id TEXT`, `agency_id UUID`, `payload JSONB`, `deleted_by UUID`, `deleted_at TIMESTAMPTZ`, `delete_reason TEXT`, `restored_at TIMESTAMPTZ`, `restored_by UUID`.

---

## 3. LỘ TRÌNH TRIỂN KHAI
1. **Database:** Viết Migration `024_controlled_data_management_and_trash.sql` và rollback.
2. **Domain Service / Repository:**
   - `src/domain/services/controlledDataService.ts`:
     - `updateLeadControlled`: kiểm tra scope, version lạc quan, audit diff.
     - `softDeleteLead`: kiểm tra không có hợp đồng active, đưa vào Trash Bin, gỡ khỏi view thường.
     - `restoreLeadFromTrash`: khôi phục trạng thái, tính lại SLA hợp lý.
     - `dissolveTeamControlled`: kiểm tra & chuyển nhân sự/lead sang nhóm khác trước khi giải thể.
     - `deactivateAgencyControlled`: kiểm tra không còn nhân sự active/lead mở trước khi vô hiệu hóa.
     - `updateContractControlled`: nháp thì sửa trực tiếp, đã duyệt thì bắt buộc qua điều chỉnh amendment.
     - `getTrashBinItems` & `restoreFromTrash`: phân quyền theo sàn / admin.
3. **Kiểm thử:** Viết `src/test/controlled_data_management.test.ts`.
4. **Xác minh & Báo cáo:** Chạy `npm test` + `npm run build`, viết `docs/dev-log/phase-7-REPORT.md`, cập nhật `PROGRESS.md`.
