# CRM BROKER PLATFORM – SYSTEM ARCHITECTURE & FEATURE SPECIFICATION
> **Tài liệu tổng quan kiến trúc phần mềm, mô hình dữ liệu và đặc tả toàn bộ tính năng hệ thống**  
> *Được biên soạn chuẩn mực dành cho Claude / AI Agents / Developers tiếp nhận, đọc hiểu và phát triển tiếp.*

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

### 1.1. Giới thiệu
**CRM Broker** (*Real Estate Sales & Marketing Intelligence Platform*) là nền tảng SaaS Enterprise chuyên biệt dành cho thị trường Bất động sản Việt Nam. Hệ thống phục vụ việc quản lý khách hàng tiềm năng (Leads), vận hành quy trình bán hàng khép kín (Customer Journey), quản lý hợp đồng - dòng tiền - hoa hồng (Commission Splitting), và hỗ trợ môi giới bằng Trợ lý AI (Claude / Gemini).

### 1.2. Công nghệ cốt lõi (Tech Stack)
- **Frontend**: React 18, TypeScript (Strict Mode), Vite 6, Tailwind CSS, Lucide Icons, Recharts, @dnd-kit (kéo thả Kanban), Zustand (State Management), TanStack Query (Server State Cache).
- **Backend & Database**: 
  - **Supabase (PostgreSQL 15+)**: Auth, Row-Level Security (RLS), Triggers, Stored Procedures (Atomic RPC), Edge Functions (Deno/TypeScript).
  - **In-Memory / LocalStorage Fallback**: Toàn bộ hệ thống có thể chạy độc lập (Offline / Mock Demo) với dữ liệu khởi tạo chuẩn hóa nếu không có kết nối Supabase trực tiếp.
  - **Vercel Serverless Functions (`/api`)**: `/api/send-email` (gửi email trung gian đa kênh).
- **Kênh thông báo & Email tự động**:
  - **Google Apps Script Webhook**: Gửi email tự động 100% miễn phí 24/7 trực tiếp qua Gmail cá nhân/doanh nghiệp mà không cần mật khẩu ứng dụng SMTP.
  - **Resend API & Gmail SMTP**: Kênh dự phòng tích hợp sẵn.
- **Triển khai & CI/CD**: GitHub Actions, Vercel Production (`https://crm-broker-platform.vercel.app`).

---

## 2. KIẾN TRÚC THƯ MỤC & PHÂN LỚP MÃ NGUỒN (CODEBASE ARCHITECTURE)

Hệ thống tuân thủ nghiêm ngặt **Repository Pattern** và kiến trúc hướng miền (**Domain-Driven Design - DDD**):

```
CRM-Broker/
├── api/                                # Vercel Serverless Functions
│   └── send-email.ts                   # Endpoint nhận yêu cầu gửi email (Apps Script / Resend / SMTP)
├── src/
│   ├── app/                            # Tầng điều phối ứng dụng, Router, Layouts & Global State
│   │   ├── router.tsx                  # Khai báo React Router v6 với AuthGuard & RoleGuard
│   │   ├── AppLayout.tsx               # Khung giao diện (Sidebar Desktop + Drawer Mobile + Role Switcher)
│   │   ├── guards.tsx                  # Bảo vệ route: AuthGuard, RoleGuard, PasswordChangeGuard
│   │   └── useAuthStore.ts             # Quản lý phiên đăng nhập, TOTP 2FA, timeout 30 phút tự out
│   │
│   ├── domain/                         # Nghiệp vụ cốt lõi độc lập UI (Core Domain Logic)
│   │   ├── types.ts                    # Toàn bộ Interface & Type định nghĩa dữ liệu hệ thống
│   │   ├── constants.ts                # Hằng số: 15 trạng thái Lead, 6 vai trò, nguồn Marketing
│   │   └── services/                   # Các Domain Services chuyên sâu
│   │       ├── autoTransferService.ts  # Dịch vụ SLA 24h, quét quá hạn, Round-Robin, tính hạn Wall-clock
│   │       ├── notificationService.ts  # Dịch vụ thông báo, render Email HTML, gửi Webhook, chống trùng
│   │       ├── aiAdvisorService.ts     # Dịch vụ AI phân tích chân dung khách hàng, kịch bản mở lời
│   │       ├── contractFinancialService.ts # Dịch vụ tính toán dòng tiền đợt thanh toán & chia hoa hồng
│   │       └── journeyService.ts       # Dịch vụ quản lý chu trình chuyển đổi Customer Journey
│   │
│   ├── data/                           # Tầng dữ liệu (Data Access Layer - Repository Pattern)
│   │   ├── mockData.ts                 # Dữ liệu mẫu chuẩn đồng bộ với seed.sql
│   │   └── repositories/               # NƠI DUY NHẤT TRUY VẤN SUPABASE / LOCALSTORAGE
│   │       ├── authRepository.ts       # Xác thực, TOTP, phân quyền người dùng, impersonation
│   │       ├── leadRepository.ts       # Nghiệp vụ Lead: CRUD, trùng SĐT, phân bổ, lịch sử điều chuyển
│   │       ├── contractRepository.ts   # Hợp đồng, đợt thanh toán, phiếu thu, báo cáo hoa hồng
│   │       ├── teamRepository.ts       # Tổ chức, sàn F1/F2, phòng ban, danh sách nhân sự
│   │       ├── projectRepository.ts    # Dự án BĐS, giỏ hàng, bảng hàng, chính sách bán hàng
│   │       ├── dashboardRepository.ts  # Tổng hợp số liệu KPI thật từ database
│   │       ├── aiRepository.ts         # Gọi Edge Functions AI cho kịch bản và tóm tắt dự án
│   │       └── auditRepository.ts      # Nhật ký kiểm toán hệ thống (Audit Logs)
│   │
│   ├── features/                       # Các module màn hình chức năng (Feature Slices)
│   │   ├── auth/                       # Đăng nhập, đổi mật khẩu bắt buộc
│   │   ├── dashboard/                  # Dashboard KPI, phễu chuyển đổi, cảnh báo quá hạn
│   │   ├── leads/                      # Module HỢP NHẤT: Quản lý Lead + Phân bổ & Lead Pool SLA 24h
│   │   │   ├── LeadsPage.tsx           # Trang tab đôi: Danh sách Lead & Trung tâm phân bổ
│   │   │   └── LeadDetailPage.tsx      # Chi tiết Lead 360°, Chân dung AI, Timeline, Lịch sử chăm sóc
│   │   ├── distribution/               # Thành phần Phân bổ Lead Pool & Quét quá hạn (nhúng vào LeadsPage)
│   │   │   └── DistributionPage.tsx
│   │   ├── journey/                    # Customer Journey Kanban 15 bước kéo thả kèm ràng buộc tài chính
│   │   ├── transactions/               # Quản lý Hợp đồng, Đợt thanh toán, Phân bổ hoa hồng
│   │   ├── leaderboard/                # Bảng vàng thi đua Sale, Xếp hạng hiệu suất & Tỷ lệ thu hồi Lead
│   │   ├── projects/                   # Danh mục dự án, Tri thức AI & Tóm tắt văn bản thông minh
│   │   ├── scripts/                    # Thư viện Sales Scripts chuẩn hóa theo từng dự án & giai đoạn
│   │   ├── notifications/              # Trung tâm thông báo Follow-up, cảnh báo SLA
│   │   └── admin/                      # Trung tâm quản trị RBAC, cấu hình Webhook/Email, SLA settings
│   │
│   ├── components/ui/                  # UI Primitives: Button, Card, Modal, Input, Badge, Skeleton
│   └── lib/                            # Supabase client, Utility chuẩn hóa SĐT, format VND, regex
│
├── supabase/
│   ├── migrations/                     # File di trú cơ sở dữ liệu PostgreSQL
│   ├── functions/                      # Deno Edge Functions (ai-script, project-enrich, v.v.)
│   └── seed.sql                        # Dữ liệu khởi tạo chuẩn production
└── vercel.json                         # Cấu hình bảo mật, CSP headers và rewrite API
```

---

## 3. MÔ HÌNH DỮ LIỆU & QUAN HỆ BẢNG (DATABASE SCHEMA)

### 3.1. Các thực thể chính (Entities)
1. **`organizations` & `agencies` & `teams`**: Cấu trúc đa cấp: Tổng công ty -> Sàn phân phối (F1/F2) -> Phòng kinh doanh / Nhóm bán hàng.
2. **`profiles`**: Hồ sơ người dùng, phân vai trò (`role`), trạng thái (`active`, `locked`), cờ nghỉ phép (`on_leave`), nhận lead (`accepts_leads`), 2FA TOTP.
3. **`customers`**: Bảng dữ liệu khách hàng độc lập, lưu họ tên, SĐT (chuẩn hóa quốc tế), email, CCCD, địa chỉ.
4. **`leads`**: Khách hàng tiềm năng gắn với Dự án, Trạng thái (15 bước), Người phụ trách (`assigned_to`), Hạn chăm sóc (`care_deadline_at`), Thời điểm cập nhật cuối (`last_care_updated_at`), Đếm số lần chuyển tự động (`auto_transfer_count`), Mảng sale cũ (`previous_assigned_sales`), Điểm số (`lead_score`), Mục đích (`purpose`), Ngân sách (`budget_min`, `budget_max`), Loại BĐS (`preferred_property_type`).
5. **`lead_care_logs`**: Nhật ký chăm sóc: Loại tương tác (gọi điện, hẹn gặp, gửi tài liệu), nội dung, kết quả, cảm xúc khách hàng.
6. **`lead_assignment_history`**: Lưu toàn bộ lịch sử điều chuyển: Lead, Sale cũ, Sale mới, Lý do (`auto_overdue`, `manual_transfer`, `bulk_assign`, `round_robin`), Thời điểm, Người thực hiện.
7. **`contracts`**: Hợp đồng giao dịch (Booking / Cọc / HĐMB): Mã hợp đồng, giá trị BĐS, tổng hoa hồng, trạng thái duyệt.
8. **`contract_installments`**: Tiến độ đợt thanh toán: Số đợt, ngày đến hạn, số tiền, trạng thái thanh toán.
9. **`transactions`**: Phiếu thu/chi thực tế, đối soát dòng tiền nộp cọc hoặc thanh toán.
10. **`notification_logs`**: Nhật ký gửi thông báo / email: Idempotency key, người nhận, kênh, trạng thái gửi, số lần retry.
11. **`system_settings`**: Cấu hình toàn hệ thống (Email Webhook, SLA 24h, Giờ làm việc, Ngày lễ, Tình trạng dừng đồng hồ).

### 3.2. Bảo mật đa tầng (Row-Level Security - RLS)
- **Sale Agent**: Chỉ xem và thao tác trên Lead được giao cho chính mình (`assigned_to = auth.uid()`).
- **Team Leader**: Xem toàn bộ Lead và giao dịch thuộc Team của mình (`team_id = currentUser.team_id`).
- **Sales Manager (Giám đốc Sàn)**: Xem toàn bộ Lead, Báo cáo và Nhân sự thuộc Sàn (`agency_id = currentUser.agency_id`).
- **Platform Admin / Director**: Toàn quyền trên toàn hệ thống.

---

## 4. HỆ THỐNG 6 VAI TRÒ & PHÂN QUYỀN (RBAC)

1. **`admin` (Quản trị viên Hệ thống)**: Toàn quyền cấu hình, quản trị tài khoản, cài đặt Webhook/SLA, kích hoạt tính năng đóng giả vai trò (Impersonation).
2. **`director` (Ban Giám đốc)**: Xem báo cáo tài chính toàn diện, doanh thu hoa hồng, phê duyệt giao dịch lớn, xem thi đua toàn công ty.
3. **`sales_manager` (Giám đốc Sàn / Trưởng phòng KD)**: Phân bổ lead cho sàn, giám sát SLA 24h, thu hồi lead quá hạn, gia hạn hạn chăm sóc, xem hiệu suất sàn.
4. **`team_leader` (Trưởng nhóm Kinh doanh)**: Nhận cảnh báo lead quá hạn của nhóm, phân bổ nội bộ team, hỗ trợ sale chốt deal, duyệt kịch bản chăm sóc.
5. **`sale_agent` (Chuyên viên Tư vấn)**: Tiếp nhận lead, cập nhật nhật ký chăm sóc, nhận email bàn giao kèm AI Script, theo dõi hạn SLA 24h, tạo giao dịch cọc/HĐMB.
6. **`marketing_manager` (Trưởng phòng Marketing)**: Theo dõi chất lượng nguồn lead (CPL, ROI), bị che mờ số điện thoại để tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.

---

## 5. CHI TIẾT 10 MODULE TÍNH NĂNG CỐT LÕI

### Module 1: Dashboard KPI & Biểu đồ doanh số thời gian thực
- Tính toán 100% từ số liệu thật trong database.
- Hiển thị: Tổng Lead, Tỷ lệ liên hệ, Số lượng Booking/Cọc/HĐMB, Tổng giá trị giao dịch, Doanh thu hoa hồng dự kiến.
- Biểu đồ phễu chuyển đổi 15 bước từ Tiếp cận đến Sau bán.
- Cảnh báo trực quan số lượng Lead sắp quá hạn hoặc đang ở Kho lead chung cần xử lý.

### Module 2: Quản lý & Phân bổ Lead hợp nhất (`/leads`)
- **Gom 2 tab trên một giao diện**:
  - **Tab 1 - Danh Sách & Tiếp Nhận Lead**: Lọc đa năng theo dự án, trạng thái, người phụ trách, tìm kiếm tức thì theo tên/SĐT; Phát hiện trùng SĐT real-time khi thêm lead mới; Phân bổ hàng loạt (Bulk Assign).
  - **Tab 2 - Phân Bổ & Lead Pool (SLA 24h)**: Quản lý Kho Lead chung (chưa phân bổ hoặc bị thu hồi); Phân bổ xoay vòng Round-Robin; Bộ quét quá hạn tự động 24h (chạy thử Dry-run và quét thật).
- **Trang Chi Tiết Lead 360° (`/leads/:id`)**:
  - Thông tin khách hàng & Chân dung khách hàng (Customer Persona).
  - Khối Trợ lý AI gợi ý kịch bản mở lời và phân tích phản đối theo thời gian thực.
  - Đồng hồ đếm ngược SLA 24h đổi màu cảnh báo (Xanh -> Vàng -> Đỏ).
  - Dòng thời gian lịch sử chăm sóc (Timeline) và lịch sử điều chuyển qua các sale.
  - Chức năng dành cho Quản lý: Điều chuyển thủ công, Gia hạn SLA, Miễn chuyển tự động.

### Module 3: Customer Journey Kanban & Ràng buộc tài chính bắt buộc (`/journey`)
- 15 Trạng thái chia thành 7 giai đoạn lớn:
  1. *Tiếp cận*: Mới tiếp nhận, Không nghe máy, Sai số/Không nhu cầu.
  2. *Đang tìm hiểu*: Đã liên hệ, Xác định nhu cầu, Gửi tài liệu.
  3. *Tư vấn chuyên sâu*: Đặt hẹn, Đã gặp tư vấn, Đi xem thực địa (Site visit).
  4. *Đàm phán*: Đang cân nhắc.
  5. *Giữ chỗ & Cọc*: Booking giữ chỗ, Đặt cọc.
  6. *Giao dịch*: Ký HĐMB.
  7. *Sau bán*: Chăm sóc sau bán, Lead đóng/Thất bại.
- **Ràng buộc tài chính nghiêm ngặt**: Khi kéo thẻ sang *Booking*, *Đặt cọc* hoặc *Ký HĐMB*, hệ thống bắt buộc mở form nhập số tiền, mã phiếu thu, mã căn hộ. Nếu không nhập, trạng thái không đổi để chống gian lận doanh số ảo.

### Module 4: Giao dịch, Hợp đồng & Chia tỷ lệ Hoa hồng (`/transactions`)
- Quản lý hợp đồng bán lẻ BĐS và tiến độ thanh toán từng đợt.
- Tự động chia tỷ lệ hoa hồng (Commission Splitting):
  - Hoa hồng Sàn (Agency Commission): ví dụ 3.0% giá trị giao dịch.
  - Hoa hồng Trưởng nhóm (Leader Commission): ví dụ 0.3%.
  - Hoa hồng Chuyên viên trực tiếp (Sale Commission): ví dụ 1.2% - 1.5%.
  - Quỹ vận hành / Thưởng nóng.
- Quản lý phiếu thu tiền đợt và theo dõi công nợ khách hàng.

### Module 5: Bảng Thi Đua & Hiệu Suất (`/leaderboard`)
- Xếp hạng doanh số và hoa hồng của các chuyên viên tư vấn theo tuần/tháng/quý.
- Đo lường chỉ số chất lượng: Tỷ lệ chuyển đổi lead thành deal, Thời gian phản hồi lead trung bình.
- **Chỉ số kỷ luật SLA**: Đo lường tỷ lệ lead bị thu hồi do quá hạn chăm sóc 24h của từng cá nhân và từng team.

### Module 6: Hệ thống Gửi Email & Thông Báo Tự Động (Notification Engine)
- **Phương thức gửi tự động ngầm 100%**:
  - Không sử dụng modal 1-click thủ công.
  - Sử dụng **Google Apps Script Webhook** triển khai miễn phí 24/7 trực tiếp qua Gmail của doanh nghiệp.
  - Hỗ trợ Resend API và Gmail SMTP tiêu chuẩn.
- **Idempotency Key (Chống gửi trùng lặp)**: Ngăn chặn gửi trùng email cho cùng một sự kiện trong vòng 1 giờ.
- **Chuẩn hóa nội dung Email bàn giao Lead**:
  - **Tiêu đề**: `[CRM Broker] Bàn giao Lead khách hàng: {Tên khách hàng} - {Tên dự án}`
  - **Lời chào**: `Xin chào {Tên sale},`
  - Bảng thông tin khách hàng (Tên, SĐT, Dự án).
  - Khối Chân dung khách hàng (Mục đích, Ngân sách, Loại BĐS, Nhu cầu chi tiết).
  - Giai đoạn trong kịch bản bán hàng (Sales Script Stage).
  - Gợi ý kịch bản mở lời/tư vấn từ Trợ lý AI (AI Sales Script).
  - Hạn chót SLA 24h & Nút mở trực tiếp hồ sơ trên CRM.
  - *Không chứa thông tin điều chuyển từ sale nào để sale mới tiếp cận với tâm thế cơ hội mới.*
- **Phân bổ hàng loạt (Bulk Assign Digest)**: Tự động gom danh sách nhiều lead vào 1 email bảng HTML tổng hợp, không spam từng email riêng rẽ.

### Module 7: Tự Động Đảo Lead Quá Hạn 24 Giờ Liên Tục (SLA Auto-Transfer)
- **Đồng hồ 24 giờ liên tục (Wall-clock real time)**:
  - Bắt đầu tính từ thời điểm nhận lead hoặc thời điểm cập nhật chăm sóc gần nhất.
  - Khi sang sale mới, đồng hồ 24h được khởi động lại từ đầu.
- **Định nghĩa "Có chăm sóc"**: Sale phải thay đổi trạng thái HOẶC ghi nhận 1 tương tác hợp lệ (gọi điện, hẹn gặp, gửi tài liệu). Việc chỉ mở trang chi tiết xem lead KHÔNG được tính.
- **Thuật toán chọn Sale tiếp theo**:
  - Thuật toán Round-Robin trong cùng dự án/team.
  - Bỏ qua: Sale đang nghỉ phép (`on_leave = true`), sale bị khóa tài khoản, sale không nhận lead, và **sale đã từng giữ lead này trong quá khứ** (chống vòng lặp A -> B -> A).
- **Giới hạn số lần chuyển**: Tối đa 3 lần. Nếu qua 3 lần vẫn không có chăm sóc, tự động đưa lead về **Kho Lead Chung (Pool)** và gửi email cảnh báo cho Quản lý.
- **Trường hợp loại trừ dừng đồng hồ**: Lead ở trạng thái Hẹn gặp, Đang đàm phán, Booking, Đặt cọc, Ký HĐMB, hoặc có lịch hẹn tương lai do sale thiết lập.
- **Tùy chọn giờ làm việc**: Có thể cấu hình chỉ trừ giờ làm việc (8h - 18h) và bỏ qua Chủ nhật/Ngày lễ.
- **Cảnh báo trước hạn**: Gửi email cảnh báo cho sale ở mốc 20 giờ (còn 4 giờ trước khi bị chuyển).
- **Hỗ trợ Chạy thử (Dry-run)**: Quản lý có thể bấm "Chạy thử quét" để xem danh sách lead sẽ bị chuyển mà không thực thi thay đổi dữ liệu.

### Module 8: Dự án & Kho Tri Thức AI (`/projects`)
- Quản lý danh mục dự án, bảng giá, giỏ hàng, sơ đồ mặt bằng, pháp lý, chính sách ưu đãi.
- **Tối ưu hóa Database văn bản (<= 3.000 ký tự)**: Lưu tóm tắt cô đọng, tự động trích xuất cấu trúc `Nhãn: Nội dung` để AI đọc hiểu nhanh nhất với chi phí token tối thiểu.
- **AI Project Enrich**: Gọi AI trích xuất thông tin dự án từ nguồn chính thống, người dùng kiểm tra đối chiếu trước khi lưu.

### Module 9: Sales Scripts & Trợ Lý Bán Hàng AI (`/scripts`)
- Thư viện kịch bản cuộc gọi, kịch bản tư vấn phân theo từng dự án và 15 bước Customer Journey.
- Phân biệt: Kịch bản tự động cập nhật theo thông tin dự án (`is_auto`) và Kịch bản chuyên viên tự tối ưu (`is_edited`).
- Tích hợp AI tạo nhanh các đoạn xử lý từ chối (về giá, pháp lý, vị trí, lãi suất ngân hàng).

### Module 10: Trung Tâm Quản Trị Hệ Thống (`/admin`)
- Quản lý người dùng, phân quyền RBAC, kích hoạt/khóa tài khoản, reset mật khẩu, kích hoạt 2FA.
- Tính năng Impersonate (Đóng giả góc nhìn vai trò khác dành riêng cho Quản trị viên).
- Cấu hình Email Webhook (URL Google Apps Script, Resend Key, SMTP credentials).
- Cấu hình SLA 24h, danh sách trạng thái dừng đồng hồ, khung giờ làm việc và lịch nghỉ lễ.
- Audit Logs: Ghi vết toàn bộ hành vi quan trọng trên hệ thống.

---

## 6. HƯỚNG DẪN DÀNH CHO CLAUDE / AI DEVELOPER

Khi tiếp nhận codebase này để tiếp tục phát triển hoặc gỡ lỗi, hãy tuân theo các nguyên tắc cốt lõi:

1. **Tuân thủ Repository Pattern**:
   - Mọi thao tác truy vấn dữ liệu từ Supabase hoặc LocalStorage **BẮT BUỘC** phải đi qua các file trong `src/data/repositories/`. Không viết trực tiếp `supabase.from(...)` bên trong các UI components.
2. **Không phá vỡ luồng tự động ngầm**:
   - Không đưa trở lại các popup/modal 1-click thủ công khi phân bổ hay điều chuyển lead. Mọi thông báo phải diễn ra tự động qua `notificationService`.
3. **Phòng thủ dữ liệu (Defensive Programming)**:
   - Khi truy vấn bảng `leads`, luôn nhớ rằng `customer_name`, `customer_phone`, `project_name` là các quan hệ join từ `customers` và `projects`. Luôn dùng `leadRepository.getLeadById` hoặc viết query có select quan hệ để tránh lỗi `undefined`.
4. **Kiểm thử trước khi triển khai**:
   - Chạy `npm test` (sử dụng Vitest) để xác nhận 44/44 tests luôn pass.
   - Chạy `npm run build` (tsc & vite build) để đảm bảo không có lỗi TypeScript.
5. **Môi trường & Deploy**:
   - Dự án được deploy lên Vercel Production thông qua token Vercel CLI.
   - Mọi thay đổi code commit lên branch `main` của repository GitHub `Jamesrealonline/CRM-Broker-Deploy`.

---
*Tài liệu được cập nhật ngày 08/11/2026. Bản quyền thuộc về CRM Broker Platform.*
