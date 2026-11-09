# BÁO CÁO NGHIỆM THU: TÁI CẤU TRÚC CƠ CẤU TỔ CHỨC & PHÂN QUYỀN ĐIỀU HÀNH
**Hệ thống Quản Trị Bất Động Sản & Bán Hàng CRM Broker Platform**  
*Mã tài liệu:* `DOC-ORG-RESTRUCTURE-202611`  
*Chi nhánh git:* `feat/org-ceo-regional-divisions`  
*Trạng thái kiểm thử:* **247/247 Tests Passed (100%)** | **TypeScript Strict: 0 Lỗi** | **Production Build: Sẵn Sàng**  

---

## 1. SƠ ĐỒ CƠ CẤU TỔ CHỨC MỚI (CÂY ĐIỀU HÀNH 3 KHỐI)

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                 TỔNG GIÁM ĐỐC (CEO)                    │
                               │   - Lãnh đạo điều hành tối cao toàn doanh nghiệp       │
                               │   - Phê duyệt deal khủng (>30 tỷ) & chuyển vùng        │
                               │   - Xem PII toàn hệ thống không giới hạn               │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
          ┌───────────────────────────────────────────────┼───────────────────────────────────────────────┐
          │                                               │                                               │
┌─────────▼───────────────────────────┐         ┌─────────▼───────────────────────────┐         ┌─────────▼───────────────────────────┐
│        KHỐI KINH DOANH              │         │         KHỐI MARKETING              │         │           KHỐI NHÂN SỰ              │
│  (Sales & Distribution Division)    │         │      (Marketing Division)           │         │     (Human Resources Division)      │
└─────────────────┬───────────────────┘         └─────────────────┬───────────────────┘         └─────────────────┬───────────────────┘
                  │                                               │                                               │
        ┌─────────▼─────────┐                           ┌─────────▼─────────┐                           ┌─────────▼─────────┐
        │  GIÁM ĐỐC VÙNG    │                           │  GĐ / TRƯỞNG MKT  │                           │  GĐ / TRƯỞNG HR   │
        │(regional_director)│                           │(marketing_manager)│                           │    (hr_admin)     │
        └─────────┬─────────┘                           └─────────┬─────────┘                           └─────────┬─────────┘
                  │                                               │                                               │
        ┌─────────▼─────────┐                           ┌─────────▼─────────┐                           ┌─────────▼─────────┐
        │   GIÁM ĐỐC SÀN    │                           │ Các Đơn Vị MKT    │                           │   Nhân Viên HR    │
        │    (director)     │                           │ (Marketing Units) │                           │ (HR Specialists)  │
        └─────────┬─────────┘                           └───────────────────┘                           └───────────────────┘
                  │
        ┌─────────▼─────────┐
        │   TRƯỞNG PHÒNG    │
        │  (sales_manager)  │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │   TRƯỞNG NHÓM     │
        │   (team_leader)   │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │  CHUYÊN VIÊN SALE │
        │   (sale_agent)    │
        └───────────────────┘

[LƯU Ý]: Vai trò "admin" (Quản trị viên Hệ thống) phụ trách kỹ thuật hạ tầng, phân quyền và bảo mật,
không nằm trong chuỗi kinh doanh và không can thiệp dòng tiền hoa hồng.
```

---

## 2. MA TRẬN PHÂN QUYỀN 9 VAI TRÒ (RBAC MATRIX)

| Vai trò | Mã kỹ thuật | Phạm vi dữ liệu | Xem PII Khách | Xem Định danh Nhân sự | Phê duyệt Hợp đồng | Phê duyệt Điều chuyển | Phạm vi Thi đua |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Tổng Giám Đốc** | `ceo` | Toàn bộ doanh nghiệp | Đầy đủ 100% | Đầy đủ 100% | Toàn bộ (>30 tỷ) | Toàn công ty & Khác vùng | Toàn hệ thống |
| **Giám Đốc Vùng** | `regional_director` | Các sàn trong Vùng (`region_id`) | Đầy đủ trong vùng | Đầy đủ trong vùng | Hợp đồng $\le$ 30 tỷ | Khác sàn cùng vùng | Toàn bộ Vùng |
| **Giám Đốc Sàn** | `director` | Toàn bộ Sàn (`agency_id`) | Đầy đủ trong sàn (*) | Đầy đủ trong sàn | Hợp đồng $\le$ 15 tỷ | Khác team cùng sàn | Toàn bộ Sàn |
| **Trưởng Phòng KD** | `sales_manager` | Phòng & Đội nhóm trực thuộc | Che mờ (NĐ 13) | Đầy đủ trong phòng | Hợp đồng $\le$ 5 tỷ | Nội bộ phòng/team | Các team quản lý |
| **Trưởng Nhóm** | `team_leader` | Đội nhóm phụ trách (`team_id`) | Che mờ (NĐ 13) | Đầy đủ trong team | Xác nhận hồ sơ | Đề xuất | Đội nhóm mình |
| **Chuyên Viên Sale** | `sale_agent` | Chỉ dữ liệu cá nhân phụ trách | Che mờ (NĐ 13) | Cá nhân | Không | Không | Cá nhân |
| **Giám Đốc Marketing**| `marketing_manager`| Toàn khối Marketing & Hiệu suất | Che mờ (NĐ 13) | Đầy đủ khối MKT | Không | Đơn vị MKT | Toàn hệ thống |
| **Giám Đốc HR** | `hr_admin` | Toàn khối HR & Hồ sơ toàn diện | Che mờ (NĐ 13) | Đầy đủ 100% | Không | Khối HR & Phối hợp | Toàn hệ thống |
| **Quản Trị Viên** | `admin` | Toàn quyền kỹ thuật hạ tầng | Đầy đủ 100% | Đầy đủ 100% | Mọi hạn mức | Mọi cấp bậc | Toàn hệ thống |

*(*) Ghi chú: Giám Đốc Sàn mặc định có phạm vi trên sàn mình, có cờ cấu hình `director_global_scope` để mở rộng ra toàn hệ thống nếu được Hội Đồng Quản Trị ủy quyền.*

---

## 3. DANH SÁCH THAY ĐỔI MÔ HÌNH DỮ LIỆU (DATABASE & REPOSITORIES)

### 3.1. Quyết định kiến trúc: Giữ nguyên mã vai trò `director` cho Giám Đốc Sàn
- **Lý do cốt tử:** Toàn bộ hệ sinh thái kiểm soát dữ liệu (RLS, Audit, Soft-delete, Khôi phục, Thùng rác, Bút toán đảo hoa hồng) ở các phiên làm việc trước đều đã gắn chặt chẽ với mã `director`.
- **Giải pháp an toàn:**
  - Giữ nguyên `director` = **Giám Đốc Sàn**.
  - Đổi nhãn giao diện từ "Ban Giám Đốc" thành **"Giám Đốc Sàn"**.
  - Bổ sung vai trò additive mới: `ceo` (Tổng Giám Đốc) và `regional_director` (Giám Đốc Vùng).
  - Khối Marketing (`marketing_manager`) và HR (`hr_admin`) được tái định vị trực thuộc trực tiếp `ceo`.

### 3.2. Migration Additive `027_ceo_regional_divisions_and_org_restructure.sql`
- **Bảng mới `regions`**: Quản lý vùng kinh doanh (`id`, `code`, `name`, `regional_director_id`, `status`).
- **Bảng mới `divisions`**: Quản lý khối chức năng (`id`, `code`: SALES/MARKETING/HR, `name`, `head_id`, `ceo_id`).
- **Bảng mới `company_settings`**: Quản lý tham số toàn công ty (`ceo_id`, `max_approval_level_sm`, `max_approval_level_director`, `max_approval_level_rd`).
- **Bảng mới `org_position_levels`**: Danh mục chức danh chuẩn 10 cấp theo 4 track (Management, Sales, Marketing, HR).
- **Mở rộng bảng `agencies`**: Thêm cột `region_id REFERENCES regions(id)` kèm backfill tự động vào Vùng mặc định `REG-DEFAULT` ("Chưa phân vùng").
- **Mở rộng bảng `marketing_units`**: Thêm cột `division_id REFERENCES divisions(id)` liên kết về Khối Marketing.
- **Mở rộng bảng `transactions`**:
  - Snapshot cấp bậc: `regional_director_id`, `agency_director_id`, `ceo_id`.
  - Cờ duyệt đa tầng: `requires_l1_approval`, `requires_l2_approval`, `requires_l3_approval`.
  - Hoa hồng nhiều tầng: `regional_commission_amount`, `ceo_commission_amount`.
- **View đệ quy `v_org_tree` & view mở rộng `v_sale_chain`**: Đầy đủ 6 tầng chuỗi chỉ huy kinh doanh.

---

## 4. QUY TRÌNH VẬN HÀNH CHI TIẾT

### 4.1. Quy trình phê duyệt hợp đồng 3 ngưỡng (Multi-Tier Maker-Checker)
1. **Hợp đồng $\le$ 5 tỷ VNĐ (Tiêu chuẩn):**
   - Trưởng phòng kinh doanh (`sales_manager`) hoặc Giám đốc Sàn (`director`) thẩm định và phê duyệt trực tiếp.
2. **Hợp đồng từ 5 tỷ đến 15 tỷ VNĐ (Ngưỡng L1):**
   - Bắt buộc Giám đốc Sàn (`director`) hoặc cấp cao hơn phê duyệt.
   - Trưởng phòng cố tình bấm duyệt sẽ bị hệ thống chặn với thông báo rõ ràng.
3. **Hợp đồng từ 15 tỷ đến 30 tỷ VNĐ (Ngưỡng L2):**
   - Bắt buộc Giám đốc Vùng (`regional_director`) hoặc cấp cao hơn phê duyệt.
   - Giám đốc Sàn bị giới hạn hạn mức.
4. **Hợp đồng trên 30 tỷ VNĐ (Ngưỡng L3 - Đại thương vụ):**
   - Bắt buộc Tổng Giám Đốc (`ceo`) hoặc Quản trị viên (`admin`) phê duyệt.
5. **Ràng buộc Maker-Checker bất biến:**
   - Người lập hợp đồng (maker) tuyệt đối không được tự phê duyệt cho chính mình (checker), bất kể đang giữ chức danh gì.

### 4.2. Quy trình điều chuyển nhân sự 4 cấp phân quyền
- **Cùng phòng / cùng nhóm:** Trưởng phòng (`sales_manager`) hoặc Giám đốc Sàn phê duyệt.
- **Khác phòng, cùng sàn:** Giám đốc Sàn (`director`) phê duyệt.
- **Khác sàn, cùng vùng:** Giám đốc Vùng (`regional_director`) phê duyệt.
- **Khác vùng kinh doanh / toàn công ty:** Bắt buộc Tổng Giám Đốc (`ceo`) hoặc Admin phê duyệt.
- **Append-only Audit Trail:** Mọi biến động đều được lưu vào bảng `personnel_events` bất biến, không thể ghi đè hay xóa bỏ.

### 4.3. Quy trình leo thang SLA 4 cấp độ
1. **Sau 20 giờ không liên hệ (SLA 24h):** Cảnh báo chuyên viên và trưởng nhóm (Team Leader).
2. **Lead bị thu hồi lần 2:** Cảnh báo Trưởng phòng kinh doanh (`sales_manager`).
3. **Báo cáo tổng hợp ngày:** Gửi Giám đốc Sàn (`director`) để điều chỉnh chỉ tiêu sàn.
4. **Báo cáo tổng hợp tuần & trường hợp nghiêm trọng:** Gửi Giám đốc Vùng (`regional_director`) và Tổng Giám Đốc (`ceo`).

---

## 5. HƯỚNG DẪN THIẾT LẬP BAN ĐẦU (ONBOARDING CHECKLIST)

1. **Bước 1 - Khởi tạo Vùng kinh doanh:**
   - Truy cập `/hr` -> Chuyển sang chế độ xem "Cây Phân Cấp Cơ Cấu Tổ Chức".
   - Kiểm tra **Hộp Việc Cần Xử Lý Cơ Cấu** (Action Required Banner) để xem các sàn chưa có vùng hoặc vùng khuyết giám đốc.
   - Bổ sung các vùng kinh doanh chính: *Miền Bắc (`REG-NORTH`), Miền Nam (`REG-SOUTH`), Miền Trung (`REG-CENTRAL`)*.
2. **Bước 2 - Bổ nhiệm Giám Đốc Vùng (`regional_director`):**
   - Chọn nhân sự quản lý cấp cao và gán vai trò `regional_director` kèm `region_id` tương ứng.
3. **Bước 3 - Phân bổ Sàn Giao Dịch vào Vùng:**
   - Cập nhật thông tin từng sàn, chuyển từ Vùng mặc định `REG-DEFAULT` sang đúng Vùng quản lý.
4. **Bước 4 - Bổ nhiệm Giám Đốc Sàn (`director`):**
   - Chọn nhân sự đứng đầu từng sàn để gán làm Giám Đốc Sàn.
5. **Bước 5 - Thiết lập Nhân Sự Khối Marketing & Khối HR:**
   - Gán `marketing_manager` (Giám Đốc Marketing) và `hr_admin` (Giám Đốc HR) trực thuộc trực tiếp CEO.

---

## 6. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & CAM KẾT KHÔNG LỖI LÙI (0 REGRESSION)

- **Tổng số file kiểm thử:** 28 / 28 test suites pass 100%.
- **Tổng số ca kiểm thử:** **247 / 247 tests passed (100%)**.
- **Test Suite Mới:** `src/test/ceo_regional_divisions_org.test.ts` (18/18 tests pass):
  - *Ma trận 9 vai trò và phạm vi xem subtree scoping*: 4/4 passed.
  - *Quản trị vùng kinh doanh và Báo cáo sức khỏe cấu trúc*: 3/3 passed.
  - *Quy trình duyệt hợp đồng 3 cấp hạn mức*: 5/5 passed.
  - *Quy trình điều chuyển nhân sự phân cấp*: 2/2 passed.
  - *Bảo vệ PII & Khóa cấp bậc*: 4/4 passed.
- **Biên dịch & Đóng gói:**
  - `npx tsc --noEmit`: **0 Lỗi TypeScript**.
  - `npm run build`: **Vite v6.4.5 built thành công 100% trong 3.43 giây**.
