# GIAI ĐOẠN 3 – KHẢO SÁT & KẾ HOẠCH TRIỂN KHAI (PHASE 3 SURVEY & PLAN)
**Mục tiêu:** Hợp đồng, Hoa hồng nhiều tầng (Snapshot), Vòng đời hợp đồng (`contract_revisions`), Sổ cái hoa hồng & Clawback (`commission_entries`), Aging công nợ khách hàng & Đối soát sao kê.
**Branch:** `feat/phase-3-contracts-commissions-debt`
**Thời gian thực hiện:** 2026-11-09

---

## 1. KHẢO SÁT HIỆN TRẠNG CODEBASE
1. **Modal Hợp đồng & RPC cơ bản:**
   - Đã có modal `CreateContractModal.tsx` và `contractRepository.createContractWithCustomer`: hỗ trợ chọn khách cũ/mới, 11 nguồn lead chuẩn, atomic creation, consent, masking.
2. **Thiếu sót cần hoàn thiện theo MASTER_PROMPT 3.4 - 3.7:**
   - *Hoa hồng nhiều tầng đúng chuỗi trực thuộc:* Chưa có bảng lưu chi tiết hoa hồng phân tầng (Sàn, Sale, Trưởng nhóm, Trưởng phòng, Giám đốc, Co-sale, Giới thiệu) và snapshot chính sách tại thời điểm ký.
   - *Vòng đời hợp đồng & Maker-Checker đổi căn / hủy hợp đồng:* Chưa có bảng `contract_revisions` để theo dõi yêu cầu đổi căn, chuyển nhượng, hủy/hoàn cọc và cưỡng chế Maker-Checker không được tự duyệt.
   - *Sổ cái hoa hồng & Bút toán âm (Clawback):* Chưa có bảng `commission_entries` theo dõi từng đợt giải ngân hoa hồng và bút toán thu hồi (clawback) khi hủy hợp đồng.
   - *Aging công nợ khách hàng:* Chưa có bảng lịch thu tiền đầy đủ `contract_installments` và hàm tính tuổi nợ (chưa đến hạn, 1-30 ngày, 31-60 ngày, >60 ngày).
   - *Đối soát sao kê ngân hàng:* Chưa có bảng `bank_statements` và logic tự động khớp thanh toán chống ghi nhận trùng lặp.

---

## 2. THIẾT KẾ MÔ HÌNH DỮ LIỆU (Migration 020)
1. **`contract_installments`:**
   - `id`, `contract_id`, `installment_number`, `due_date`, `amount`, `paid_amount`, `status` (`pending`, `paid`, `overdue`), `paid_date`, `receipt_code`.
2. **`commission_policies` & `commission_entries`:**
   - `commission_policies`: Quản lý phiên bản chính sách theo dự án và thang bậc KPI.
   - `commission_entries`: `contract_id`, `recipient_id`, `recipient_name`, `recipient_role`, `rate_percent`, `amount`, `status` (`pending_eligibility`, `eligible`, `collected_from_developer`, `paid`, `clawback`), `condition_threshold_percent`, `clawback_source_id`.
3. **`contract_revisions`:**
   - `id`, `contract_id`, `revision_type` (`unit_change`, `transfer`, `cancellation`, `penalty`), `old_data` (jsonb), `new_data` (jsonb), `reason`, `requested_by`, `status` (`pending`, `approved`, `rejected`), `approved_by`, `approved_at`.
4. **`bank_statements`:**
   - `id`, `bank_ref_code` (unique), `trans_date`, `amount`, `description`, `matched_contract_id`, `matched_installment_id`, `status` (`unmatched`, `matched`, `disputed`).

---

## 3. LỘ TRÌNH TRIỂN KHAI
1. **Bước 1:** Viết Migration `supabase/migrations/020_contracts_multitier_commissions_and_debt_aging.sql` và rollback tương ứng.
2. **Bước 2:** Cập nhật `src/domain/types.ts` với các interface tương ứng.
3. **Bước 3:** Bổ sung phương thức trong `contractRepository.ts`:
   - Tính toán và lưu snapshot hoa hồng đa tầng theo chuỗi quản lý và co-sale.
   - Tạo và duyệt revision hợp đồng (`requestContractRevision`, `approveContractRevision`) với Maker-Checker.
   - Sổ cái hoa hồng `getCommissionLedger`, `processClawback`.
   - Tính aging công nợ `getDebtAgingReport`.
   - Đối soát sao kê ngân hàng `reconcileBankStatement`.
4. **Bước 4:** Viết test suite chuyên sâu `src/test/contract_multitier_commissions_and_debt.test.ts`.
5. **Bước 5:** Xác minh `npm test` và `npm run build`, viết báo cáo hoàn thành.
