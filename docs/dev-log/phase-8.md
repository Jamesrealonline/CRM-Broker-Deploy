# GIAI ĐOẠN 8 – KHẢO SÁT & KẾ HOẠCH TRIỂN KHAI (PHASE 8 SURVEY & PLAN)
**Mục tiêu:** Kho tri thức dự án có kiểm duyệt (`project_knowledge_items`), Thư viện script bán hàng 9 nhóm ngữ cảnh (`script_templates`), Bộ lọc tuân thủ quảng cáo BĐS (Compliance Linter), Theo dõi hiệu quả `script_usage` và Kịch bản chăm sóc (Care Playbooks).
**Branch:** `feat/phase-8-knowledge-and-playbooks`
**Thời gian thực hiện:** 2026-11-09

---

## 1. KHẢO SÁT HIỆN TRẠNG
1. **Kho tri thức:** Đã có `project_knowledge` dạng text đơn giản trong `projectRepository.ts`. Cần nâng cấp mô hình thành `project_knowledge_items` có phân loại danh mục, trạng thái `verified_by`/`verified_at`, hạn hiệu lực `expires_at`.
2. **Quy tắc tin cậy:** Các danh mục nhạy cảm (`price_policy`, `legal`, `construction_progress`) nếu chưa được xác minh thì bắt buộc hiển thị nhãn "cần xác nhận với chủ đầu tư", ngăn chặn nhân viên tư vấn cam kết sai sự thật.
3. **Thư viện script:** Nâng cấp từ 15 script theo status thành thư viện đa ngữ cảnh (9 nhóm ngữ cảnh chuẩn, bộ biến `{{ten_khach}}`, `{{ten_du_an}}`, `{{ten_sale}}`, v.v.).
4. **Bộ lọc tuân thủ (Compliance Linter):** Chặn các cụm từ cam kết vi phạm luật kinh doanh BĐS ("cam kết sinh lời", "chắc chắn tăng giá", "bao pháp lý 100%").
5. **Care Playbooks:** Tự động tạo nhắc việc chăm sóc, tôn trọng cờ `do_not_contact` và sự đồng thuận `consent`.

---

## 2. THIẾT KẾ MÔ HÌNH DỮ LIỆU (Migration 025)
1. `project_knowledge_items`:
   - `id UUID PRIMARY KEY`, `project_id UUID`, `category TEXT`, `title TEXT`, `content TEXT`, `source_url TEXT`, `status TEXT`, `verified_by UUID`, `verified_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `version INT DEFAULT 1`, `created_by UUID`.
2. `script_templates`:
   - `id UUID PRIMARY KEY`, `project_id UUID`, `context_code TEXT`, `journey_stage TEXT`, `channel TEXT`, `persona TEXT`, `tone TEXT`, `title TEXT`, `objective TEXT`, `opening TEXT`, `questions TEXT`, `main_content TEXT`, `objection_handling TEXT`, `cta TEXT`, `compliance_notes TEXT`, `status TEXT`, `version INT DEFAULT 1`.
3. `script_usages`:
   - `id UUID PRIMARY KEY`, `script_id UUID`, `lead_id UUID`, `sale_id UUID`, `channel TEXT`, `outcome TEXT`, `rating INT`, `created_at TIMESTAMPTZ`.
4. `care_tasks`:
   - `id UUID PRIMARY KEY`, `lead_id UUID`, `sale_id UUID`, `title TEXT`, `due_date TIMESTAMPTZ`, `status TEXT`, `script_id UUID`, `created_at TIMESTAMPTZ`.

---

## 3. LỘ TRÌNH TRIỂN KHAI
1. **Database:** Viết Migration `025_project_knowledge_and_sales_scripts.sql` và rollback.
2. **Domain Service:** `src/domain/services/knowledgeAndScriptService.ts`:
   - Quản trị tri thức dự án & kiểm duyệt (`verifyKnowledgeItem`).
   - Quản trị script đa ngữ cảnh & seed 9 nhóm ngữ cảnh chuẩn.
   - Thay thế biến template an toàn không sót `{{...}}`.
   - Compliance Linter kiểm tra từ cấm.
   - Ghi nhận `script_usage` và tính hiệu quả chuyển đổi.
   - Care Playbooks tôn trọng `do_not_contact` và bàn giao sale mới.
3. **Kiểm thử:** Viết `src/test/knowledge_and_scripts.test.ts`.
4. **Xác minh & Báo cáo:** Chạy `npm test` + `npm run build`, viết `docs/dev-log/phase-8-REPORT.md`, cập nhật `PROGRESS.md`.
