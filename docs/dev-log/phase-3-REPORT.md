# BÁO CÁO HOÀN THÀNH GIAI ĐOẠN 3 (PHASE 3 REPORT)
**Mục tiêu:** Hợp đồng, Hoa hồng nhiều tầng (Snapshot), Vòng đời hợp đồng (`contract_revisions`), Sổ cái hoa hồng & Bút toán âm Clawback (`commission_entries`), Aging công nợ khách hàng & Đối soát sao kê ngân hàng.
**Thời gian hoàn thành:** 2026-11-09
**Branch:** `feat/phase-3-contracts-commissions-debt`

---

## 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Database (Migration additive 020 & Rollback 020)
- `supabase/migrations/020_contracts_multitier_commissions_and_debt_aging.sql`:
  - `contract_installments`: Lịch thanh toán tiến độ đầy đủ, `amount > 0`, `paid_amount`, trạng thái `pending`, `partially_paid`, `paid`, `overdue`.
  - `commission_entries`: Sổ cái hoa hồng đa tầng (Sàn, Sale, Team Leader, Sales Manager, Director, Co-sale), `rate_percent`, `amount`, `status`, `condition_threshold_percent`, `clawback_source_id`, `pit_tax_percent`, `pit_tax_amount`, `net_payable_amount`.
  - `contract_revisions`: Quản lý yêu cầu điều chỉnh hợp đồng (`unit_change`, `transfer`, `cancellation`, `penalty`), Maker-Checker không cho phép người tạo tự duyệt.
  - `bank_statements`: Quản lý sao kê ngân hàng đối soát, `bank_ref_code` duy nhất chống trùng lặp, liên kết tự động với hợp đồng và đợt thanh toán.
  - Stored Procedure `approve_contract_revision`: Cưỡng chế Maker-Checker (`requested_by <> approver_id`), tự động sinh bút toán Clawback âm khi hủy hợp đồng và cập nhật mã căn khi đổi căn.
- `supabase/migrations/rollback/020_rollback_contracts_multitier_commissions_and_debt_aging.sql`: Script rollback an toàn additive.

### B. Domain & Repositories (`contractRepository.ts`)
- **3.4 Hoa hồng nhiều tầng snapshot & Co-sale:**
  - `calculateMultiTierCommissions`: Tính toán chính xác hoa hồng Sàn, Sale, Trưởng nhóm (0.2%), Trưởng phòng (0.1%), Giám đốc (0.1%).
  - Tách hoa hồng Đồng Sale (Co-sale): tổng chia phần sale khớp 100% phần hoa hồng sale.
  - Cưỡng chế trần hoa hồng Sale (tối đa 2.0% theo chính sách chuẩn dự án, chỉ Quản lý sàn / Giám đốc / Admin mới được override kèm lý do phê duyệt và audit log).
- **3.5 Lịch thanh toán các đợt (Installments):**
  - `createContractInstallments`: Sinh 6 đợt thanh toán theo mốc xây dựng (10%, 20%, 20%, 20%, 25%, 5%), tổng các đợt luôn khớp chính xác 100% giá trị hợp đồng.
  - Đợt 1 tích hợp checkbox "đã thanh toán" kèm mã phiếu thu và ngày thu.
- **3.6 Sổ cái hoa hồng & Khấu trừ thuế TNCN:**
  - `createCommissionEntries`: Sinh các dòng bút toán hoa hồng cho từng vai trò theo chuỗi trực thuộc.
  - Khấu trừ thuế TNCN 10%, tính toán số tiền thực nhận (`net_payable_amount`).
- **3.7 Vòng đời hợp đồng & Maker-Checker:**
  - `requestContractRevision`: Tạo yêu cầu đổi căn, chuyển nhượng, hủy/hoàn cọc (yêu cầu lý do >= 10 ký tự).
  - `approveContractRevision`: Maker-Checker chặn người tạo tự duyệt (`maker_checker_violation`), chỉ Quản lý mới có quyền duyệt (`forbidden`). Duyệt hủy hợp đồng tự động sinh bút toán Clawback âm để bù trừ kỳ sau.
- **3.8 Aging công nợ & Đối soát sao kê:**
  - `getDebtAgingReport`: Phân loại tuổi nợ chính xác 4 nhóm: Chưa đến hạn, 1-30 ngày, 31-60 ngày, >60 ngày quá hạn.
  - `reconcileBankStatement`: Chặn mã giao dịch ngân hàng trùng lặp (`duplicate_statement`), tự động khớp sao kê với phiếu thu/hợp đồng và đánh dấu đợt thanh toán thành công.

---

## 2. KẾT QUẢ KIỂM THỬ & BUILD
- **Unit Tests Mới:** Test suite `src/test/contract_multitier_commissions_and_debt.test.ts` (9/9 tests mới).
- **Tổng số test toàn hệ thống:** `152/152 tests passed` (19/19 test files).
- **TypeScript & Vite Build:** `npm run build` thành công 100%, 0 lỗi type/linting.

---

## 3. CHECKLIST MASTER PROMPT - GIAI ĐOẠN 3
- [x] Tạo hợp đồng với khách mới/cũ ra đủ customer, lead, contract, installment, commission snapshot.
- [x] Hoa hồng nhiều tầng (Sàn, Sale, Trưởng nhóm, Trưởng phòng, Giám đốc, Co-sale) khớp 100% tỷ lệ.
- [x] Khóa trần hoa hồng Sale theo chính sách dự án (chỉ manager+ override có lý do).
- [x] Lịch thanh toán 6 đợt chuẩn hóa tổng bằng giá trị giao dịch.
- [x] Sổ cái hoa hồng `commission_entries`, khấu trừ thuế TNCN 10%.
- [x] Maker-Checker cho `contract_revisions`, chặn người tạo tự duyệt.
- [x] Hủy hợp đồng tự động kích hoạt bút toán Clawback âm.
- [x] Báo cáo Aging công nợ 4 nhóm tuổi nợ.
- [x] Đối soát sao kê ngân hàng tự khớp và chống trùng giao dịch.
