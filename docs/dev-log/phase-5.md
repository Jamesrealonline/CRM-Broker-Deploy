# GIAI ĐOẠN 5.0A – KHẢO SÁT & KẾ HOẠCH TRIỂN KHAI (PHASE 5.0A SURVEY & PLAN)
**Mục tiêu:** Cưỡng chế Chuỗi cấp bậc bắt buộc (`departments`, `marketing_units`, `v_sale_chain`, không tồn tại sale mồ côi), Ngăn chặn vòng lặp & Quản lý kế nhiệm / Quyền tạm thời (Acting).
**Branch:** `feat/phase-5-0a-hierarchy-management-chain`
**Thời gian thực hiện:** 2026-11-09

---

## 1. KHẢO SÁT HIỆN TRẠNG CODEBASE
1. **Module HR & Cấu trúc đã có (GĐ 5.1 - 5.6):**
   - Đã có `018_hr_lifecycle_and_personnel_management.sql`, `hrRepository.ts`, `/hr` route.
   - Bảng `agencies`, `teams` và `profiles` đã có trường `team_id`, `agency_id`.
2. **Thiếu sót theo MASTER_PROMPT 5.0A:**
   - Chưa có bảng `departments` (Phòng kinh doanh do Trưởng phòng `sales_manager` phụ trách, trực thuộc `director`).
   - Chưa có bảng `marketing_units` (Đơn vị Marketing ma trận do `marketing_manager` phụ trách).
   - Chưa có view `v_sale_chain` thống nhất toàn bộ mắt xích quản lý.
   - Chưa có kiểm tra cưỡng chế chuỗi đầy đủ: Sale bắt buộc phải có Trưởng nhóm (Leader) -> Trưởng phòng (Head) -> Giám đốc (Director) và Đơn vị Marketing.
   - Chưa có ràng buộc chặn khóa/cho nghỉ quản lý khi chưa chỉ định người kế nhiệm hoặc người phụ trách tạm thời (`acting`).

---

## 2. THIẾT KẾ MÔ HÌNH DỮ LIỆU (Migration 022)
1. **`departments`:**
   - `id`, `agency_id`, `name`, `head_id` (Trưởng phòng / `sales_manager`), `director_id` (Giám đốc), `created_at`.
2. **`marketing_units`:**
   - `id`, `name`, `manager_id` (Trưởng đơn vị Marketing / `marketing_manager`), `director_id`, `created_at`.
3. **Cập nhật `teams` & `profiles`:**
   - `teams.department_id`, `teams.leader_id`.
   - `profiles.department_id`, `profiles.marketing_unit_id`, `profiles.is_acting`, `profiles.acting_until`.
4. **View `v_sale_chain`:**
   - Nguồn chân lý duy nhất ánh xạ `sale_id`, `sale_name`, `team_id`, `leader_id`, `department_id`, `head_id`, `director_id`, `marketing_unit_id`, `marketing_manager_id`.

---

## 3. LỘ TRÌNH TRIỂN KHAI
1. **Bước 1:** Viết Migration `supabase/migrations/022_strict_sale_chain_and_hierarchy.sql` và rollback.
2. **Bước 2:** Cập nhật TypeScript types trong `src/domain/types.ts`.
3. **Bước 3:** Cập nhật `hrRepository.ts`:
   - Hàm xác thực chuỗi quản lý `validateSaleChain(saleId)`.
   - Hàm chỉ định người kế nhiệm / Acting `assignSuccessorOrActing(...)`.
   - Báo cáo sức khỏe cấu trúc tổ chức `getStructuralHealthReport()`.
4. **Bước 4:** Viết test suite `src/test/sale_chain_and_hierarchy.test.ts`.
5. **Bước 5:** Xác minh `npm test` và `npm run build`, viết báo cáo `phase-5-REPORT.md`, cập nhật `PROGRESS.md`.
