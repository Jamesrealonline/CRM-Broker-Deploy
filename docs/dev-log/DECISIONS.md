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

---

## 6. QUYỀN TOÀN DIỆN CHO ADMIN & GIÁM ĐỐC SÀN, KPI NHÂN SỰ, BỘ LỌC THỜI GIAN & DỮ LIỆU MẪU (GIAI ĐOẠN 8)
- **Quyết định 6.1: Quyền xem PII đầy đủ cho Admin và Giám đốc Sàn (Ghi đè cho phép rõ ràng)**
  - *Phương án chọn:* Admin và Giám đốc Sàn (`director`) được xem SĐT, CCCD, Email đầy đủ, không che mờ, không giới hạn số lần xem, không bắt buộc nhập lý do mỗi lần xem. Cung cấp nút sao chép (Copy) 1 chạm thuận tiện.
  - *Bảo mật các vai trò khác:* Mọi vai trò khác (`sale_agent`, `team_leader`, `sales_manager`, `marketing_manager`) vẫn giữ nguyên quy tắc che mờ PII (`maskPhone`, `maskIdCard`, `maskEmail`) và phân quyền RLS nghiêm ngặt như cũ.
- **Quyết định 6.2: Xác định vai trò Giám đốc Sàn (director) và cờ director_global_scope**
  - *Đối chiếu Codebase:* Vai trò Giám đốc Sàn trong hệ thống là `director` (trực thuộc `agency_id`).
  - *Phạm vi:* Admin = Toàn hệ thống. Giám đốc Sàn = Toàn bộ dữ liệu thuộc sàn của mình.
  - *Mở rộng toàn cầu:* Thêm cấu hình `director_global_scope` (bảng `system_settings` và `localStorage`), mặc định `false`. Khi bật `true`, Giám đốc Sàn có quyền quản trị toàn hệ thống (nhưng vẫn tuyệt đối bị chặn sửa/xóa tài khoản của Admin hoặc Giám đốc Sàn khác).
- **Quyết định 6.3: Hủy có kiểm soát hợp đồng đã duyệt và bút toán đảo hoa hồng**
  - *Phương án chọn:* Cho phép Admin và Giám đốc Sàn hủy/ẩn hợp đồng đã duyệt với cờ `{ forceCancelApproved: true }`.
  - *Đảm bảo kế toán:* Tự động tạo bút toán hoàn nguyên (reversal entry) có giá trị âm tương ứng, giải phóng mã căn trong giỏ hàng về trạng thái `available`, và chuyển hợp đồng vào Thùng rác (`TrashBinItem`) để có thể khôi phục khi cần.
- **Quyết định 6.4: Quản trị và cách ly Dữ liệu Mẫu (Sample Data Management)**
  - *Phương án chọn:* Toàn bộ dữ liệu mẫu (10 lead phân bổ đều qua 10 trạng thái từ New đến HĐMB) được gắn cờ `is_sample = true` và `created_via = 'sample_seed'`.
  - *Cách ly vận hành:* Dữ liệu mẫu được gắn nhãn "Mẫu", có nút bật/tắt hiển thị "Hiện dữ liệu mẫu" trên tất cả các màn hình, và được miễn trừ hoàn toàn khỏi việc gửi email thông báo thật và phạt SLA.
  - *Dọn dẹp sạch sẽ:* Cung cấp chức năng `purge_sample_data` ở cả RPC DB và UI Admin để dọn sạch toàn bộ dữ liệu mẫu một cách an toàn mà không làm mất bất kỳ dữ liệu thực nào.
- **Quyết định 6.5: Chuẩn hóa Bộ lọc thời gian dùng chung (DateRangeFilter & useDateRange)**
  - *Phương án chọn:* Thống nhất bộ lọc thời gian theo múi giờ Việt Nam `Asia/Ho_Chi_Minh` (UTC+7), hỗ trợ 9 preset nhanh + tùy chọn ngày (Custom Range), có tính toán kỳ đối chiếu liền trước (Previous Period Comparison), tự động đồng bộ URL Params và ghi nhớ tùy chọn người dùng qua `localStorage`.

---

## 7. ĐIỀU CHỈNH CƠ CẤU TỔ CHỨC: TỔNG GIÁM ĐỐC, GIÁM ĐỐC VÙNG & 3 KHỐI ĐIỀU HÀNH (GIAI ĐOẠN 9 - FEAT/ORG-CEO-REGIONAL-DIVISIONS)
- **Quyết định 7.1: Ánh xạ và bổ sung vai trò additive**
  - *Giữ nguyên mã vai trò:* `director` = Giám đốc Sàn (bảo toàn toàn bộ quyền hạn và RLS đã thiết lập ở các giai đoạn trước). Thay thế triệt để các nhãn hiển thị cũ "Ban Giám đốc" thành "Giám đốc Sàn".
  - *Thêm vai trò mới:*
    • `ceo`: Tổng Giám Đốc (Lãnh đạo tối cao của toàn bộ hệ sinh thái doanh nghiệp).
    • `regional_director`: Giám đốc Vùng (Lãnh đạo phụ trách khu vực/vùng kinh doanh, quản lý các Giám đốc Sàn).
  - *Chuẩn hóa chức danh:* `sales_manager` = Trưởng phòng Kinh doanh; `team_leader` = Trưởng nhóm; `sale_agent` = Chuyên viên tư vấn; `marketing_manager` = Giám đốc/Trưởng Marketing (trực thuộc CEO); `hr_admin` = Giám đốc/Trưởng HR (trực thuộc CEO); `admin` = Quản trị kỹ thuật (toàn quyền hệ thống, không thuộc chuỗi quản lý bán hàng).
- **Quyết định 7.2: Mô hình cơ cấu tổ chức 3 Khối (Divisions) và Vùng kinh doanh (Regions)**
  - *Cơ cấu 3 khối độc lập dưới CEO:*
    • Khối Kinh Doanh (SALES): Gồm các Vùng kinh doanh (`regions`) → Sàn giao dịch (`agencies`) → Phòng ban (`departments`) → Đội nhóm (`teams`) → Chuyên viên (`sale_agent`).
    • Khối Marketing (MARKETING): Gồm các Đơn vị Marketing (`marketing_units`), trực thuộc CEO thay vì phụ thuộc giám đốc sàn; quản lý đa kênh và chia sẻ nguồn lead cross-vùng.
    • Khối Nhân Sự (HR): Gồm bộ máy tuyển dụng, đào tạo, hồ sơ 360°, hợp đồng lao động, trực thuộc CEO.
  - *Bảng mới:* `regions`, `divisions`, `company_settings`, `org_position_levels`. Bổ sung cột `agencies.region_id` (trỏ về Vùng).
- **Quyết định 7.3: Mở rộng thẩm quyền xem PII cho CEO và Giám đốc Vùng**
  - *Nguyên tắc:* Cấp trên không được có ít quyền hơn cấp dưới trong phạm vi quản lý bao trùm.
  - *Phạm vi:* CEO xem PII đầy đủ toàn công ty. Giám đốc Vùng xem PII đầy đủ toàn bộ các sàn trong vùng của mình. Giữ nguyên che PII đối với Trưởng phòng, Trưởng nhóm, Sale; Khối Marketing và HR không được xem PII khách hàng.
- **Quyết định 7.4: Quy trình Maker-Checker đa tầng theo ngưỡng giá trị hợp đồng**
  - *Phương án:*
    • Cấp 1 (Trưởng nhóm + Trưởng phòng): Duyệt hợp đồng tiêu chuẩn.
    • Cấp 2 (Vượt ngưỡng 1 - Mặc định > 5 tỷ VNĐ): Giám đốc Sàn duyệt.
    • Cấp 3 (Vượt ngưỡng 2 - Mặc định > 15 tỷ VNĐ): Giám đốc Vùng duyệt.
    • Cấp 4 (Vượt ngưỡng 3 - Mặc định > 30 tỷ VNĐ): Tổng Giám Đốc duyệt.
  - *Bảo mật thẩm quyền:* Chặn tự phê duyệt chính mình (Maker ≠ Checker). Người duyệt bắt buộc nằm trong chuỗi trực thuộc hoặc Admin.
- **Quyết định 7.5: Quy trình điều chuyển nhân sự đa cấp & Bảo vệ vị trí**
  - *Thẩm quyền:* Cùng phòng do Trưởng phòng duyệt; khác phòng cùng sàn do Giám đốc Sàn duyệt; khác sàn cùng vùng do Giám đốc Vùng duyệt; khác vùng do Tổng Giám Đốc duyệt. Bổ nhiệm Giám đốc Sàn do Giám đốc Vùng đề xuất, CEO duyệt. Bổ nhiệm Giám đốc Vùng do CEO quyết định.
  - *Bảo vệ cấu trúc:* Không được bỏ trống vị trí quản lý khi còn cấp dưới chưa gán; bắt buộc chọn người kế nhiệm hoặc người phụ trách tạm thời (acting) có thời hạn.
- **Quyết định 7.6: Backfill an toàn & Xử lý trạng thái chuyển tiếp**
  - *Phương án:* Tự động sinh Vùng mặc định "Chưa phân vùng" (`REG-DEFAULT`) chứa mọi sàn hiện có; không tự ý gán CEO hay Giám đốc Vùng cho bất kỳ tài khoản cũ nào. Trong giai đoạn chuyển tiếp, Admin tạm thời đóng vai trò Acting CEO kèm cảnh báo hệ thống (Action Required Banner).

- **Quyết định 7.7: Maker-Checker Đa Tầng Theo Ngưỡng Giá Trị Hợp Đồng**
  - *Bối cảnh:* Các thương vụ lớn cần sự thẩm định của cấp lãnh đạo tương ứng để kiểm soát rủi ro tài chính và dòng tiền hoa hồng.
  - *Phương án:*
    - $\le$ 5 tỷ VNĐ: Trưởng phòng kinh doanh (`sales_manager`) hoặc Giám đốc Sàn (`director`) duyệt.
    - \> 5 tỷ VNĐ: Cần Giám đốc Sàn (`director`) hoặc cao hơn duyệt (`requires_l1_approval = true`).
    - \> 15 tỷ VNĐ: Cần Giám đốc Vùng (`regional_director`) hoặc cao hơn duyệt (`requires_l2_approval = true`).
    - \> 30 tỷ VNĐ: Bắt buộc Tổng Giám Đốc (`ceo`) hoặc Admin duyệt (`requires_l3_approval = true`).
    - Chặn hoàn toàn tự phê duyệt (Self-approval blocked).

- **Quyết định 7.8: Phân Cấp Thẩm Quyền Điều Chuyển Nhân Sự**
  - *Bối cảnh:* Ngăn chặn xáo trộn nhân sự tự ý giữa các đơn vị kinh doanh.
  - *Phương án:*
    - Cùng phòng / cùng nhóm: Trưởng phòng (`sales_manager`) duyệt.
    - Khác phòng, cùng sàn: Giám đốc Sàn (`director`) duyệt.
    - Khác sàn, cùng vùng: Giám đốc Vùng (`regional_director`) duyệt.
    - Khác vùng kinh doanh / toàn công ty: Tổng Giám Đốc (`ceo`) hoặc Admin duyệt.

- **Quyết định 7.10: Bộ Lọc Phân Cấp 4 Cấp (Giám Đốc Vùng -> Giám Đốc Sàn -> Đội Nhóm -> Nhân Viên Sale) & Cưỡng Chế Quyền View Theo Nhánh**
  - *Bối cảnh:* Hệ thống mở rộng quy mô cần hỗ trợ lọc đa tầng theo chuỗi chỉ huy trên các trang quản trị: Khách Hàng (Leads), Hợp Đồng (Transactions), Nhân Sự (HR), và Tổng Quan (Dashboard). Đồng thời cưỡng chế quyền xem dữ liệu theo đúng cây phân cấp nhánh được gán:
    `ceo` $\rightarrow$ `giám đốc vùng` (`regional_director`) $\rightarrow$ `giám đốc sàn` (`director`) $\rightarrow$ `trưởng nhóm` (`team_leader`) $\rightarrow$ `nhân viên sale` (`sale_agent`).
    Khối Marketing (`marketing_manager`) và Khối HR (`hr_admin`) trực thuộc trực tiếp Tổng Giám Đốc (`ceo`), được xem toàn bộ tất cả các Giám Đốc Vùng và dữ liệu toàn hệ thống như `ceo`.
  - *Phương án:*
    - Cập nhật `branchHierarchyService`: `isGlobalViewer` mở rộng cho `ceo`, `admin`, `hr_admin`, `marketing_manager`.
    - Cưỡng chế `canAccessUser` và `filterLeads`, `filterTransactions`, `filterProfiles`, `filterAgencies`, `filterTeams`, `filterSales`:
      - Giám đốc Vùng chỉ thấy dữ liệu và nhân sự thuộc các sàn trong vùng được gán, không thấy CEO, Admin, HR, Marketing, hay GĐ Vùng khác.
      - Giám đốc Sàn chỉ thấy dữ liệu trong sàn mình.
      - Trưởng nhóm chỉ thấy nhân sự và dữ liệu trong nhóm mình.
      - Chuyên viên Sale chỉ xem được bản thân và dữ liệu được phân bổ.
    - Bộ lọc giao diện Cascading Filters 4 cấp trên 4 màn hình chính:
      - Khi chọn Vùng (Giám đốc Vùng), dropdown Sàn tự động thu gọn theo vùng đó.
      - Khi chọn Sàn, dropdown Đội nhóm tự động thu gọn theo sàn đó.
      - Khi chọn Đội nhóm, dropdown Nhân viên Sale tự động thu gọn theo nhóm đó.
    - Repositories (`leadRepository`, `contractRepository`, `hrRepository`, `dashboardRepository`) đều tích hợp tham số `regionId` và cưỡng chế subtree scoping.
