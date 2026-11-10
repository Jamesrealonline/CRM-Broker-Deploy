# CRM BROKER PLATFORM – MASTER PROGRESS LOG (PROGRESS.md)
> Bảng theo dõi tiến độ tổng thể các giai đoạn nâng cấp CRM Broker Platform theo MASTER_PROMPT.md.

Cập nhật lần cuối: 2026-11-09T09:23:00+07:00

---

## TỔNG QUAN TIẾN ĐỘ THEO GIAI ĐOẠN

| Giai đoạn | Nội dung | Trạng thái | Commit Hash |
| :--- | :--- | :---: | :---: |
| **Giai đoạn 1** | Nền tảng an toàn: bảo mật, toàn vẹn dữ liệu, AI/Edge | **Xong** | `35d33c3` |
| **Giai đoạn 2** | SLA chống gian lận, Lead Pool, giữ căn, giám sát job nền | **Xong** | `0359e43` |
| **Giai đoạn 3** | Hợp đồng (khách mới + nguồn lead), hoa hồng, vòng đời, công nợ | **Xong** | `d1f4164` |
| **Giai đoạn 4** | Quy trình bán hàng: lịch hẹn, công cụ tư vấn, nhập lead, quản lý khách | **Xong** | `e3679c2` |
| **Giai đoạn 5** | Quản trị sàn: cây cấp bậc, thi đua nhân sự, điều chuyển, nhân sự 360° | **Xong** | `8d17b06` |
| **Giai đoạn 6** | Marketing, vận hành/CI-CD, quyền riêng tư, thiết kế multi-tenant, PWA | **Xong** | `a094112` |
| **Giai đoạn 7** | Quản trị dữ liệu: Admin & Giám đốc Sàn sửa/xóa có kiểm soát, Thùng rác | **Xong** | `54354f1` |
| **Giai đoạn 8** | Kho tri thức dự án, thư viện script đa ngữ cảnh, AI script, playbooks | **Xong** | `98bc324` |
| **Giai đoạn 9** | Hoàn thiện UX, tích hợp chéo, hồi quy toàn hệ thống | **Xong** | `8b46da7` |
| **Giai đoạn 10** | Quyền toàn diện Admin & Giám đốc Sàn, KPI Nhân sự, Bộ lọc thời gian, Dữ liệu mẫu | **Xong** | `feat/admin-full-access-kpi-hr` |
| **Giai đoạn 13** | Tính & Phân Bổ Hoa Hồng 5 Tầng Theo Hợp Đồng & Sổ Cái Thu Nhập | **Xong** | `feat/commission-tiers-income` |
| **Giai đoạn 14** | Cô Lập Đa Khách Hàng (SaaS Multi-Tenant) Dành Cho CEO & Nhánh Trực Thuộc | **Xong** | `main` |

---

## CHI TIẾT TỪNG HẠNG MỤC

### Giai đoạn 1 – Nền tảng an toàn (HOÀN THÀNH)
- [x] **1.1** Cưỡng chế chuyển trạng thái & ràng buộc tài chính ở DB (RPC `change_lead_status`, unique partial index chống bán trùng căn). `commit 5a15e8b`
- [x] **1.2** SLA 24h chạy phía server (`pg_cron`, `SELECT FOR UPDATE SKIP LOCKED`, outbox pattern). `commit e3bcf7a`
- [x] **1.3** Bảo vệ secret và kênh gửi email (Supabase Vault, JWT, CRLF/XSS sanitize, idempotency). `commit 3c2d948`
- [x] **1.4** Bảo vệ dữ liệu nhạy cảm (Tầng DB PII masking, CCCD encryption/reveal RPC, consent). `commit 110ea1a`
- [x] **1.5** Quản lý phiên, 2FA bắt buộc và Impersonation an toàn (Read-only mode, actor audit). `commit 26fd9d4`
- [x] **1.6** Audit logs append-only với SHA-256 hash chain, Maker-Checker cho HĐMB & hoa hồng. `commit b8ef132`
- [x] **1.7** Chuẩn hóa dữ liệu, index RLS và API Rate Limiting (Sliding Window, Idempotency). `commit a85a251`
- [x] **1.8** Comprehensive RLS & Multi-tenant data isolation. `commit 35d33c3`

---

### Giai đoạn 2 – SLA chống gian lận & Vận hành Lead (HOÀN THÀNH)
- [x] **2.1** Chống lách SLA bằng "hẹn ảo" & tương tác rác (giới hạn thời gian hẹn, tối đa 2 hẹn mở, phạt quá hạn hẹn 4h, tương tác tối thiểu 20 ký tự).
- [x] **2.2** Đồng hồ tính theo giờ làm việc / 24h, cảnh báo mốc 20h và leo thang theo chuỗi quản trị (Sale -> Trưởng nhóm -> Giám đốc).
- [x] **2.3** Lead Pool hạn mức nhận theo ngày/sale, khóa `FOR UPDATE SKIP LOCKED`, lý do đóng lead thất bại (`lead_loss_reasons`) và cơ chế nuôi lại.
- [x] **2.4** Giữ căn có thời hạn (`unit_holds`), khóa căn tự động, danh sách chờ (`waitlist`) và tự động giải phóng khi hết hạn.
- [x] **2.5** Giám sát job nền (`job_runs`), Outbox retry với Dead-letter Queue, theo dõi tác vụ nền.

---

### Giai đoạn 3 – Hợp đồng, Hoa hồng & Tài chính (HOÀN THÀNH)
- [x] **3.1 - 3.3** Form hợp đồng với Khách hàng mới + 11 nguồn lead chuẩn + First-touch attribution + Atomic RPC `create_contract_with_customer` + Bảo hộ SĐT. `commit ffc5b5a`
- [x] **3.4** Hoa hồng nhiều tầng đúng chuỗi trực thuộc tại thời điểm ký (Sàn, Sale, Trưởng nhóm, Trưởng phòng, Giám đốc, Co-sale, Giới thiệu).
- [x] **3.5** Vòng đời hợp đồng: `contract_revisions`, hủy, đổi căn, chuyển nhượng, hoàn cọc, clawback.
- [x] **3.6** Sổ cái hoa hồng `commission_entries`, mốc giải ngân theo tiến độ thu tiền, chính sách phiên bản và khấu trừ thuế TNCN.
- [x] **3.7** Aging công nợ khách hàng (chưa đến hạn, 1-30, 31-60, >60 ngày) và đối soát sao kê ngân hàng chống ghi nhận trùng.

---

### Giai đoạn 4 – Quy trình bán hàng (HOÀN THÀNH)
- [x] **4.1** Quản lý lịch hẹn `appointments`, xem thực địa, nhắc hẹn tự động, check-in QR/GPS dự án (geofence 500m).
- [x] **4.2** Công cụ tư vấn: Máy tính vay/chiết khấu/ân hạn và Báo giá snapshot không lộ hoa hồng.
- [x] **4.3** Nhập lead tự động qua Webhook (Lead Ads, Landing page) & Nhập Excel/CSV theo lô (`batch_id`) có hoàn tác.
- [x] **4.4** Hợp nhất khách hàng trùng lặp (Merge/Unmerge), custom fields và sửa hàng loạt có xem trước.

---

### Giai đoạn 5 – Quản trị sàn & Nhân sự đầy đủ vòng đời (HOÀN THÀNH)
- [x] **5.1 - 5.5** Cơ cấu nhân sự 360°, ATS tuyển dụng, hợp đồng lao động, chứng chỉ môi giới, phân bổ chỉ tiêu KPI.
- [x] **5.0A** Cây cấp bậc chặt chẽ (`departments`, `marketing_units`, `v_sale_chain`), cấm sale mồ côi, cơ chế kế nhiệm/acting tạm thời và báo cáo sức khỏe cơ cấu (`getStructuralHealthReport`).

---

### Giai đoạn 6 – Marketing, Vận hành, CI/CD, Quyền riêng tư & Multi-tenant (HOÀN THÀNH)
- [x] **6.1** Quản lý chiến dịch tiếp thị đa kênh (`campaigns`, `campaign_daily_costs`) và tự động tính toán CPL, CAC, ROI, Contact Rate, Deposit Rate. Bảo vệ PII số điện thoại & email cho Marketing.
- [x] **6.2** Trung tâm Quyền riêng tư theo Nghị định 13/2023/NĐ-CP & GDPR: Xuất trọn gói dữ liệu cá nhân (`requestDataExport`), ẩn danh hóa an toàn (`requestAnonymization`) bảo toàn toàn vẹn hợp đồng & sổ cái hoa hồng, quản lý sự đồng thuận (`updateConsent`).
- [x] **6.3** Thiết kế kiến trúc Multi-tenant toàn diện (`docs/design/multi-tenant.md`): Phân tích RLS, JWT claims, chia sẻ vs cô lập dữ liệu, kế hoạch di trú không gián đoạn.
- [x] **6.4** Pipeline CI/CD `.github/workflows/ci.yml`, quản trị cờ tính năng `featureFlags.ts` và từ điển đa ngôn ngữ song ngữ `i18n.ts`.
- [x] **4.5** Hộp thư đa kênh (Timeline tương tác hợp nhất: Gọi, Zalo, SMS, Email).

---

### Giai đoạn 5 – Quản trị Sàn & Nhân sự đầy đủ (HOÀN THÀNH)
- [x] **5.1 - 5.6** Mô hình nhân sự 360°, `employee_records`, `employee_private`, `personnel_events`, `broker_certificates`, `leave_requests`, ATS Tuyển dụng, Atomic Hire. `commit 35da8c3`
- [x] **5.0A** Cưỡng chế Chuỗi cấp bậc bắt buộc (`departments`, `v_sale_chain`, `marketing_units`, không tồn tại sale mồ côi), ngăn chặn vòng lặp, kế nhiệm khi quản lý vắng mặt.

---

### Giai đoạn 6 – Marketing, Vận hành, Quyền riêng tư, PWA (HOÀN THÀNH)
- [x] **6.1** Quản lý chiến dịch Marketing (`campaigns`, `campaign_daily_costs`), tự động tính toán CPL, CAC, ROI theo nguồn/chiến dịch. Bảo vệ PII Marketing. `commit a094112`
- [x] **6.2** CI/CD pipeline `.github/workflows/ci.yml`, quản trị cờ tính năng `featureFlags.ts`, từ điển song ngữ `i18n.ts`.
- [x] **6.3** Trung tâm quyền riêng tư (Privacy Center NĐ 13/2023/NĐ-CP): xuất trọn gói dữ liệu cá nhân (`requestDataExport`), ẩn danh hóa an toàn (`requestAnonymization`) bảo toàn toàn vẹn sổ cái hợp đồng & hoa hồng.
- [x] **6.4** Tài liệu thiết kế kiến trúc Multi-tenant toàn diện (`docs/design/multi-tenant.md`).

---

### Giai đoạn 7 – Quản trị dữ liệu: Sửa / Xóa có kiểm soát (Admin & Giám đốc Sàn) (HOÀN THÀNH)
- [x] **7.1 - 7.6** Sửa/xóa mềm Lead, Hợp đồng, Sàn, Team qua RPC với khóa lạc quan `version`, chặn sửa tiền trực tiếp trên HĐ đã duyệt, chặn xóa lead có HĐ hiệu lực, phân quyền theo Sàn và chống leo thang quyền.
- [x] **7.7 - 7.8** Trung tâm Thùng rác (`trash_bins`) khôi phục kèm tái tạo SLA 24h, Nhật ký thay đổi Audit diff chi tiết trước/sau với PII masking.

---

### Giai đoạn 8 – Kho tri thức dự án & Script bán hàng đa ngữ cảnh (HOÀN THÀNH)
- [x] **8.1** Kho tri thức dự án `project_knowledge_items` có kiểm duyệt (`verifyKnowledgeItem`). Quy tắc tin cậy bắt buộc hiển thị nhãn "cần xác nhận với Chủ đầu tư" nếu thông tin giá/pháp lý/tiến độ chưa xác minh hoặc hết hạn.
- [x] **8.2** Thư viện script đa ngữ cảnh `script_templates` (seed đầy đủ 9 nhóm ngữ cảnh chuẩn BĐS). Thay thế biến an toàn `renderScript` sạch sẽ không sót biến.
- [x] **8.3** Bộ lọc tuân thủ quảng cáo BĐS `lintCompliance`: Chặn cam kết lợi nhuận, cam kết tăng giá, bao pháp lý sai sự thật.
- [x] **8.4** Ghi nhận nhật ký sử dụng `script_usages` và đo lường tỷ lệ chuyển đổi hiệu quả của từng script (`getScriptEffectiveness`).
- [x] **8.5** Kịch bản chăm sóc (Care Playbooks) tự động tạo `care_tasks`, tôn trọng cờ `do_not_contact` và tự động chuyển giao task khi lead được điều chuyển sang sale mới.

---

### Giai đoạn 9 – Hoàn thiện UX & Kiểm thử hồi quy toàn diện (HOÀN THÀNH)
- [x] **9.1** Tối ưu Mobile UX, gọi/Zalo 1 chạm, Kanban 7 giai đoạn thu gọn.
- [x] **9.2** Chạy toàn bộ 197/197 tests pass 100% trên 25 test files, build verification không lỗi TypeScript, quét bảo mật không lộ secret/PII, xuất bản Báo cáo nghiệm thu tổng thể `docs/dev-log/FINAL_REPORT.md`.

---

### Giai đoạn 10 – Quyền toàn diện cho Admin & Giám đốc Sàn, Tích hợp KPI Nhân sự, Bộ lọc thời gian chuẩn hóa & Quản trị Dữ liệu mẫu (HOÀN THÀNH)
- [x] **10.1** Quyền toàn diện cho Admin (toàn hệ thống) và Giám đốc Sàn (`director` theo `agency_id`, hỗ trợ cờ `director_global_scope`). Xem/sửa/xóa mọi đối tượng, phân trang, lọc, tìm kiếm. Xóa mềm vào Thùng rác (khôi phục được); Xóa cứng vĩnh viễn (Admin only); Hủy HĐMB đã duyệt tự sinh bút toán đảo hoa hồng và giải phóng căn; Chặn xóa hoặc khóa Admin duy nhất; Giám đốc Sàn không được phép sửa/xóa Admin hoặc Giám đốc Sàn khác; Thùng rác & Audit Diff view trực quan trên `/admin`.
- [x] **10.2** Quyền xem PII không che (SĐT, CCCD, Email) cho Admin và Giám đốc Sàn kèm nút Copy 1 chạm và kiểm toán không gián đoạn; Mọi vai trò khác giữ nguyên che mờ PII an toàn.
- [x] **10.3** Tích hợp KPI nhân sự: `employment_type` (chính thức, thử việc, CTV, thực tập, khác) và `status` (đang làm việc, nghỉ phép, tạm khóa, đã nghỉ việc) kèm huy hiệu nhận diện; Khối KPI nhân sự trên `/dashboard` (tổng nhân sự, cơ cấu, tuyển mới, nghỉ việc, tỷ lệ biến động, thử việc sắp hết hạn, năng suất bình quân doanh số/HĐ/lead trên mỗi nhân sự, biểu đồ xu hướng Recharts); Bộ lọc loại hình và xếp hạng năng suất bình quân trên `/leaderboard` cùng tab Quán quân Tuyển dụng.
- [x] **10.4** Bộ lọc thời gian dùng chung (`DateRangeFilter` & `useDateRange` hook) chuẩn hóa múi giờ `Asia/Ho_Chi_Minh` (UTC+7), hỗ trợ 9 presets + tùy chọn ngày, so sánh kỳ trước (±%), đồng bộ URL params và lưu sở thích `localStorage`.
- [x] **10.5** Quản trị Dữ liệu mẫu: Khởi tạo 10 lead mẫu gắn nhãn `is_sample = true`, phân bổ qua 10 trạng thái; Nút bật/tắt hiển thị dữ liệu mẫu trên UI; Chức năng `purge_sample_data` dọn sạch dữ liệu mẫu an toàn; Miễn trừ dữ liệu mẫu khỏi email thật và phạt SLA.
- [x] **10.6** Kiểm thử hồi quy toàn diện: Đạt 212/212 tests pass 100% trên 26 test files, `tsc --noEmit` & `npm run build` thành công 100%. Đã áp dụng migration 026 và chạy seed thành công trên Supabase Production.

---

---

### Giai đoạn 12 – Bộ Lọc Phân Cấp 4 Cấp (Vùng -> Sàn -> Nhóm -> Sale) & Cưỡng Chế Quyền View Theo Nhánh (HOÀN THÀNH)
- [x] **12.1** Cưỡng chế phân quyền cây phân cấp nhánh (Branch Subtree Scoping) trong `branchHierarchyService`:
  - `ceo`: Toàn quyền xem và quản lý toàn công ty.
  - `regional_director`: Cưỡng chế theo `user.region_id`, chỉ xem các sàn, đội nhóm, sale, lead và hợp đồng trong vùng của mình. Không xem được Admin, CEO, HR, Marketing, hay GĐ Vùng khác.
  - `director` / `sales_manager`: Cưỡng chế theo `user.agency_id`.
  - `team_leader`: Cưỡng chế theo `user.team_id`.
  - `sale_agent`: Chỉ xem được chính bản thân mình và lead/hợp đồng được phân bổ.
  - `marketing_manager` và `hr_admin`: Trực thuộc trực tiếp CEO, được xem toàn bộ tất cả các Giám Đốc Vùng và dữ liệu toàn hệ thống như CEO (`isGlobalViewer = true`).
- [x] **12.2** Tích hợp Bộ lọc Cascading 4 Cấp (Vùng / Giám Đốc Vùng $\rightarrow$ Sàn / Giám Đốc Sàn $\rightarrow$ Đội Nhóm $\rightarrow$ Nhân Viên Sale) trên 4 màn hình cốt lõi:
  - Khách Hàng (`LeadsPage.tsx`): Lọc cascading 4 cấp kết hợp tìm kiếm, dự án, trạng thái và khoảng thời gian.
  - Giao Dịch & Hợp Đồng (`TransactionsPage.tsx`): Lọc cascading 4 cấp kết hợp dự án, loại giao dịch, tiến độ đợt 1 và tìm kiếm.
  - Quản Trị Nhân Sự (`HRManagementPage.tsx`): Lọc cascading 4 cấp kết hợp vai trò, trạng thái làm việc và tìm kiếm.
  - Tổng Quan (`DashboardPage.tsx`): Lọc cascading 4 cấp tính toán KPI real-time theo đúng nhánh quản lý.
- [x] **12.3** Cập nhật Repositories:
  - `leadRepository.ts`: Bổ sung `regionId`, cưỡng chế subtree scoping bằng `branchHierarchyService.filterLeads`.
  - `contractRepository.ts`: Bổ sung `regionId` vào `ContractFilters`, áp dụng lọc theo vùng cả trên live Supabase và offline fallback.
  - `hrRepository.ts`: Bổ sung `regionId`, `saleId` vào `EmployeeFilters`.
- [x] **12.4** Kiểm thử tự động & Build:
  - Viết bộ kiểm thử chuyên sâu mới tại `src/test/ceo_regional_divisions_org.test.ts` (Section 6).
  - Đạt 253/253 tests pass 100% trên toàn bộ 28 test files.
  - `npx tsc --noEmit` đạt 0 lỗi.
  - `npm run build` thành công xuất sắc.

---

### Giai đoạn 13 – Tính & Phân Bổ Hoa Hồng 5 Tầng Theo Hợp Đồng & Sổ Cái Thu Nhập (HOÀN THÀNH)
- [x] **13.1** Mô hình phân bổ hoa hồng 5 tầng (`domain/types.ts` & `services/commissionService.ts`):
  - 5 tầng cốt lõi: Chuyên viên Sale (`sale_agent`), Nhóm / Trưởng nhóm (`team` / `team_leader`), Giám đốc Sàn (`director` / `agency_director`), Giám đốc Vùng (`regional_director`), Tổng Giám Đốc (`ceo`).
  - Tầng mở rộng: Trưởng phòng (`department_head`), Quỹ vận hành (`ops_fund`), Đồng phụ trách (`co_sale`), Người giới thiệu (`referrer`).
  - Quỹ phân bổ: Hoa hồng Sàn = GTGD × % phí dự án. Lợi nhuận Công ty giữ lại = Hoa hồng Sàn − Tổng các tầng chia.
  - Thuật toán làm tròn **Largest Remainder Method (Hamilton/Hare-Niemeyer)**: VND nguyên (`numeric(18,0)`), không float, phần lẻ phân bổ chính xác và phần dôi dư còn lại về trọn vẹn "Công ty giữ lại".
  - Kiểm chứng số học ví dụ chuẩn: GTGD 3.650.000.000 đ; Sàn 3,5% = 127.750.000 đ; Sale 1,5% = 54.750.000 đ; Nhóm 0,3% = 10.950.000 đ; GĐ Sàn 0,2% = 7.300.000 đ; GĐ Vùng 0,1% = 3.650.000 đ; CEO 0,05% = 1.825.000 đ; Tổng chia = 78.475.000 đ (2,15%); Công ty giữ lại = 49.275.000 đ (1,35%).
  - Hỗ trợ linh hoạt: `base_mode` (`contract_value` | `company_commission`), `team_split_mode` (`leader_only` | `equal` | `by_ratio`), thuế TNCN tạm tính `withholding_rate` (gross / net).
- [x] **13.2** Cập nhật `contractRepository.ts`:
  - Mở rộng payload tạo hợp đồng tiếp nhận tỷ lệ 5 tầng, tính toán snapshot `MultiTierCommissionSnapshot`, tự động sinh các dòng bút toán `CommissionEntry` và ghi nhận phiên tính `CommissionRun`.
  - Bổ sung các phương thức: `getCommissionEntries`, `assignCommissionRecipient` (kiểm tra lý do >= 10 ký tự, thẩm quyền, ghi audit), `updateCommissionEntryStatus` (ngăn sửa khoản đã chi trừ clawback, ghi audit), `getCommissionPreview`, `getIncomeSummary`, `exportIncomeCsv` (kiểm tra impersonation, loại bỏ PII thô, ghi audit log).
  - Tích hợp dữ liệu seed hoa hồng mẫu gắn nhãn `is_sample = true`.
- [x] **13.3** Giao diện Người Dùng (`TransactionsPage.tsx`, `IncomeLedgerTab.tsx`, `ContractCommissionDetailModal.tsx`):
  - Tab switcher trực quan tại `/transactions`: Danh Sách Hợp Đồng vs Thu Nhập & Sổ Cái Hoa Hồng 5 Tầng.
  - Modal Khởi tạo hợp đồng mới: Bảng tính trước hoa hồng 5 tầng thời gian thực (Live Preview), cảnh báo vượt quỹ sàn (`isExceedsPool`) và cảnh báo tầng khuyết (`unassigned`).
  - Bảng danh sách hợp đồng: Bổ sung các cột "Hoa Hồng Sàn", "Tổng Chia 5 Tầng", "Công Ty Giữ Lại" (chỉ hiển thị cho cấp quản lý), nút xem sổ cái chi tiết.
  - Tab "Thu Nhập & Sổ Cái":
    - Bộ lọc đa tiêu chí: Lọc theo người dùng (phân quyền theo chuỗi chỉ huy), tầng hoa hồng, trạng thái giải ngân, dự án, mốc ngày đối soát (`sign_date`, `eligible_at`, `paid_at`), và bộ lọc thời gian dùng chung `DateRangeFilter`.
    - 7 Thẻ KPI tổng hợp: Tổng Gross, Thuế TNCN tạm tính, Thực nhận Net, Đã chi trả (Paid), Đủ điều kiện (Eligible), Dự kiến (Expected), Đã thu hồi (Clawback).
    - Biểu đồ Recharts: Diễn biến thu nhập theo thời gian (BarChart) và Cơ cấu hoa hồng theo tầng (PieChart).
    - Bảng kê sổ cái chi tiết từng bút toán kèm các thao tác xem HĐMB, gán người nhận, cập nhật trạng thái.
    - Nút "Xuất CSV Báo Cáo Thu Nhập" bảo mật (chặn khi đang đóng vai, ghi audit trail).
  - Modal "Sổ cái phân bổ hoa hồng 5 tầng" theo hợp đồng: Cho phép quản trị viên gán người nhận cho tầng khuyết hoặc đổi trạng thái giải ngân.
- [x] **13.4** Cơ sở dữ liệu Supabase Migration & Rollback:
  - Tạo migration `028_commission_tiers_and_income_ledger.sql`: Thêm cột cho 5 tầng trên `transactions`, tạo bảng `commission_entries`, `commission_runs`, `project_commission_policies`, thiết lập RLS phân quyền theo ma trận, RPC `assign_commission_recipient`.
  - Tạo rollback script `028_rollback_commission_tiers_and_income_ledger.sql`.
- [x] **13.5** Kiểm thử tự động & Verification:
  - Bộ test mới `src/test/commission_tiers_and_income.test.ts` gồm 19 tests kiểm thử toàn diện: số học ví dụ chuẩn 3.65 tỷ, thuật toán số dư lớn nhất, base_mode, team_split_mode, thuế TNCN, pool exceed, tầng khuyết, ma trận RLS theo vai trò, impersonation block, getIncomeSummary, clawback.
  - Đạt **281/281 tests pass 100% trên 30 test files**.
  - `npx tsc --noEmit` đạt 0 lỗi.
  - `npm run build` thành công xuất sắc.

---

### Giai đoạn 14 – Cô Lập Đa Khách Hàng (SaaS Multi-Tenant) Dành Cho CEO & Nhánh Trực Thuộc (HOÀN THÀNH)
- [x] **14.1** Định danh & Ranh giới Tenant cho Tổng Giám Đốc (CEO):
  - Xem mỗi CEO như một khách hàng thuê bao / tenant độc lập trong hệ thống CRM Broker Platform SaaS.
  - `Admin` giữ vai trò Super Administrator toàn cục (`isGlobalViewer = true`), có quyền giám sát toàn bộ các tenant CEO.
  - CEO chỉ được phép truy cập và xem dữ liệu thuộc tổ chức / nhánh trực thuộc của mình (`organization_id` hoặc chuỗi cây chỉ huy dưới CEO).
- [x] **14.2** Cô lập nghiêm ngặt 5 phân hệ cốt lõi:
  - **Dự án (`projects` & `projectKnowledge`)**: CEO chỉ xem danh sách và chi tiết các dự án do tổ chức mình khai thác (`project.organization_id === user.organization_id`). Khi tạo mới dự án, hệ thống tự động gán tenant stamp `organization_id`. Chặn đọc trái phép URL trực tiếp với mã báo lỗi rõ ràng.
  - **Giám đốc Vùng & Vùng kinh doanh (`regions`)**: CEO chỉ xem danh sách các Vùng và Giám đốc Vùng trực thuộc công ty mình.
  - **Nhân sự (`profiles` & `hrManagement`)**: CEO A không thể xem danh sách nhân sự, Giám đốc Vùng, Giám đốc Sàn, Trưởng phòng, Trưởng nhóm hay Sale của CEO B; API Employee 360 ném lỗi `Access denied` nếu xem nhân sự của đối thủ.
  - **Hợp đồng & Giao dịch (`transactions`)**: CEO chỉ xem hợp đồng có `ceo_id` khớp với tài khoản của mình hoặc thuộc tổ chức của mình.
  - **Sổ cái Thu nhập & Hoa hồng 5 Tầng (`commission_entries`)**: Cập nhật `canUserViewCommissionEntry` chặn tuyệt đối CEO xem bút toán của CEO khác (`tier === 'ceo' && recipient_id !== currentUser.id`) hoặc bút toán thuộc tổ chức khác.
- [x] **14.3** Đồng bộ bộ lọc và bảng thi đua:
  - Tất cả bộ lọc Dashboard, Leads, Transactions, Leaderboard, HR được thu hẹp về phạm vi tenant của CEO: danh sách CEO trong dropdown chỉ còn chính họ, không để lộ danh tính các CEO khác.
  - Bảng thi đua hiệu suất 6 tab (CEO, Vùng, Sàn, Giám đốc Sàn, Đội nhóm, Chuyên viên): CEO chỉ thấy thứ hạng của chính mình và các cấp dưới trong tổ chức của mình.
- [x] **14.4** Kiểm thử tự động & Verification:
  - Tạo mới bộ kiểm thử chuyên biệt `src/test/ceo_saas_tenant_isolation.test.ts` gồm 28 test cases kiểm chứng đa tầng: Project, Region, Profile, Transaction, Commission Ledger, Leaderboard, Organization isolation.
  - Toàn bộ **31/31 test files pass, 309/309 tests pass (100%)**.
  - `npx tsc --noEmit` đạt 0 lỗi, production build Vite thành công.



