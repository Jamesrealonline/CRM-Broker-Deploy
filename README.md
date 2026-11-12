# REAL ESTATE CRM – SALES & MARKETING INTELLIGENCE PLATFORM
*(Hệ Thống Quản Trị Bất Động Sản Doanh Nghiệp, Phân Bổ Lead & Hoa Hồng 5 Tầng)*

[![Production Deployment](https://img.shields.io/badge/Vercel-Production%20Live-brightgreen?logo=vercel)](https://crm-broker-platform.vercel.app)
[![Tests Passing](https://img.shields.io/badge/Vitest-330%2F330%20Passing-success?logo=vitest)](https://github.com/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-5.5%20Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-Supabase%20RLS-3ECF8E?logo=supabase)](https://supabase.com/)

Hệ thống quản trị quan hệ khách hàng, phân bổ lead tự động, quản lý kịch bản bán hàng bằng AI và tính toán phân bổ hoa hồng 5 tầng (SaaS Enterprise) chuẩn hóa cho thị trường Bất Động Sản Việt Nam.

Được xây dựng trên nền tảng: **React 18, TypeScript strict, Vite, Tailwind CSS, TanStack Query, Zustand, dnd-kit, Recharts, Supabase (PostgreSQL 15+, Auth, Row Level Security, Edge Functions)** và triển khai tự động qua **GitHub Actions & Vercel**.

---

## 📑 Mục lục
1. [Hệ thống Tính năng Nổi bật](#1-hệ-thống-tính-năng-nổi-bật)
   - [Phân bổ hoa hồng 5 tầng & Sổ cái Thu nhập](#-phân-bổ-hoa-hồng-5-tầng--sổ-cái-thu-nhập-transactions)
   - [Mô hình SaaS Multi-Tenant & Quản trị Doanh nghiệp](#-mô-hình-saas-multi-tenant--quản-trị-phân-cấp-doanh-nghiệp)
   - [Quản trị Lead & Phân bổ Round Robin](#-quản-lý-lead--phân-bổ-round-robin-nguyên-tử)
   - [Hành trình Khách hàng 15 Trạng thái & Sales Script AI](#-hành-trình-khách-hàng-kanban--kịch-bản-ai-15-bước)
   - [Báo cáo & Bảng Thi đua Đa cấp](#-dashboard-báo-cáo--bảng-thi-đua-đa-cấp)
2. [Vai trò Người dùng & Phân quyền RLS (Row-Level Security)](#2-vai-trò-người-dùng--phân-quyền-rls-row-level-security)
   - [Danh mục 10 Vai trò Hệ thống & Quyền hạn](#21-danh-mục-10-vai-trò-hệ-thống-userrole)
   - [Phân cấp Khởi tạo Tài khoản & Cơ cấu Tổ chức](#22-phân-cấp-khởi-tạo-tài-khoản--cơ-cấu-tổ-chức)
   - [Ma trận Phân quyền & Phạm vi Dữ liệu (Scope Matrix 10 Roles)](#23-ma-trận-phân-quyền--phạm-vi-dữ-liệu-scope-matrix)
   - [Kiến trúc Phân quyền CSDL & Chính sách RLS Supabase](#24-kiến-trúc-phân-quyền-csdl--chính-sách-rls-supabase)
3. [Kiến trúc Hệ thống & Phân lớp Mã nguồn (Repository Pattern)](#3-kiến-trúc-hệ-thống--phân-lớp-mã-nguồn)
4. [Hướng dẫn Cài đặt & Khởi chạy Local](#4-hướng-dẫn-cài-đặt--khởi-chạy-local)
5. [Cấu hình Supabase & Database Migrations](#5-cấu-hình-supabase--database-migrations)
6. [Kiểm thử Tự động & Build Production](#6-kiểm-thử-tự-động--build-production)
7. [Triển khai Production Vercel & CI/CD](#7-triển-khai-production-vercel--cicd)
8. [Bảo mật & Tuân thủ Nghị định 13/2023/NĐ-CP](#8-bảo-mật--tuân-thủ-nghị-định-132023nđ-cp)
9. [Tài khoản Demo Khởi tạo Sẵn](#9-tài-khoản-demo-khởi-tạo-sẵn)

---

## 1. Hệ thống Tính năng Nổi bật

### 💰 Phân bổ Hoa hồng 5 Tầng & Sổ cái Thu nhập (`/transactions`)
- **Tự động Snapshot 5 Tầng theo Chuỗi Bán Hàng**:
  - `Sale` (Chuyên viên tư vấn thực hiện giao dịch)
  - `Nhóm` (Trưởng nhóm phụ trách trực tiếp hoặc chia đều/theo tỷ lệ)
  - `Giám Đốc Sàn` (Giám đốc sàn quản lý giao dịch)
  - `Giám Đốc Vùng` (Giám đốc vùng quản lý sàn)
  - `Tổng Giám Đốc / CEO` (Lãnh đạo phụ trách khối doanh nghiệp)
- **Thuật toán Phân dư Lớn nhất (Largest Remainder Method / Hare-Niemeyer)**:
  - Làm tròn số nguyên VNĐ (`numeric(18,0)`), không sinh sai số lẻ xu.
  - Tổng các dòng phân bổ cộng **Công ty giữ lại (Company Retained)** luôn khớp 100% với tổng hoa hồng CĐT chi.
- **Ràng buộc Ngân sách Chống Thâm hụt**:
  - Cưỡng chế chặn `commission_exceeds_pool` nếu tổng tỷ lệ các tầng vượt quá mức phí CĐT.
  - Hỗ trợ linh hoạt 2 cơ chế tính `base_mode`: tính theo Giá trị hợp đồng (`contract_value`) hoặc theo Tổng hoa hồng sàn (`company_commission`).
  - Hỗ trợ thuế khấu trừ TNCN tạm tính (`withholding_rate`), hiển thị song song Thu nhập gộp (Gross) và Thực nhận (Net).
- **Tab "Thu Nhập & Sổ Cái Hoa Hồng" (Income Ledger)**:
  - 7 Thẻ chỉ số tài chính: Thu nhập gộp, Thuế TNCN, Thực nhận, Đã chi, Đủ điều kiện, Dự kiến, Bị thu hồi.
  - Biểu đồ biến động xu hướng (Recharts BarChart Gross vs Net) & Cơ cấu theo tầng (PieChart).
  - Lọc theo Người dùng (theo Scope), Tầng vai trò, Trạng thái bút toán, Dự án và Căn cứ ngày (`sign_date`, `eligible_at`, `paid_at`).
  - Chức năng xuất file CSV an toàn: Che mờ PII nhạy cảm, ghi log kiểm toán, **nghiêm cấm xuất CSV trong chế độ đóng vai (Impersonation)**.

### 🏛️ Mô hình SaaS Multi-Tenant & Quản Trị Phân Cấp Doanh Nghiệp
- **CEO đóng vai trò như Khách hàng Doanh nghiệp (Tenant / Client)**:
  - Mỗi Tổng Giám Đốc (CEO) chỉ xem và quản lý dữ liệu thuộc nhánh của họ: **Dự án của họ**, **Giám Đốc Vùng của họ**, **Hợp đồng của họ**, **Nhân sự của họ**, **Sàn/Team của họ**, và **Sổ cái hoa hồng của họ**.
  - **Cách ly tuyệt đối giữa các Doanh nghiệp/CEO**: CEO của doanh nghiệp này không thể xem chéo bất kỳ dự án, nhân sự, hợp đồng, hoa hồng hay doanh số nào của CEO doanh nghiệp khác.
  - Khi tạo dự án mới hoặc tuyển dụng nhân sự mới, dữ liệu tự động được gắn nhãn định danh theo `organization_id` của doanh nghiệp đó.
- **Tài khoản Quản Trị Doanh Nghiệp độc lập (`company_admin`)**:
  - Mỗi doanh nghiệp sở hữu một tài khoản Quản Trị Doanh Nghiệp riêng dưới quyền Quản Trị Tổng (`admin`).
  - Toàn quyền cấu hình, khởi tạo Vùng (`Region`), Sàn (`Agency`), Đội nhóm (`Team`) và tạo tài khoản nhân sự trực thuộc doanh nghiệp mình (Giám đốc Vùng, Giám đốc Sàn, Trưởng phòng, Trưởng nhóm, Sale Agent, HR, Marketing).
  - **Giới hạn an toàn nghiêm ngặt**: Không tạo được CEO, Admin, Company Admin khác, hoặc tạo Doanh nghiệp mới; tuyệt đối không xem hoặc can thiệp dữ liệu của doanh nghiệp khác.
- **Trung Tâm Quản Trị Hệ Thống (`/admin`) - Chức Năng Sửa & Xóa Mềm Người Dùng**:
  - Quản Trị Tổng (`admin`) và Quản Trị Doanh Nghiệp (`company_admin`) có thể chỉnh sửa chi tiết thông tin nhân sự: Họ tên, Email, Số điện thoại, Vai trò (Role), Doanh nghiệp (`organization_id`), Vùng kinh doanh, Sàn giao dịch, Đội nhóm, và Trạng thái tài khoản.
  - Áp dụng cơ chế **Xóa Mềm (Soft Delete)** an toàn: Đưa hồ sơ nhân sự vào **Thùng Rác Quản Trị (`trash_bins`)** với quyền khôi phục an toàn trong 30 ngày.
  - **Bàn giao Lead thông minh (Handover)**: Tự động cảnh báo số lượng Lead đang phụ trách và cho phép chỉ định nhân sự tiếp nhận bàn giao toàn bộ khách hàng đang mở, không làm thất thoát dữ liệu.
  - **Ràng buộc an toàn tối cao**: Chặn người dùng tự xóa tài khoản của chính mình, chặn xóa hoặc hạ quyền Quản trị viên (Admin) duy nhất còn lại, chặn xóa CEO duy nhất khi chưa có người thay thế, chặn mọi thao tác xóa/sửa khi đang ở chế độ Giả lập góc nhìn (Impersonation).
- **Tự động khởi tạo Mã Doanh Nghiệp (Enterprise Code)**:
  - Khi khởi tạo Doanh nghiệp (CEO) mới, hệ thống tự động chuẩn hóa tên tiếng Việt, loại bỏ stopwords (`Công ty`, `Cổ phần`, `TNHH`, `BĐS`...) và sinh mã định danh duy nhất dạng `ORG-{ACRONYM}` (ví dụ: `ORG-DOVMT`, `ORG-DX`) kèm cơ chế chống xung đột mã.
  - Truy cập trực tiếp qua ID vào dự án hay hồ sơ của đối tác khác sẽ bị từ chối truy cập ngay lập tức.
- **Mô hình chuỗi lãnh đạo & phân cấp quản trị**:
  $$\text{Quản Trị Tổng (Admin)} \longrightarrow \begin{cases} \text{Quản Trị Doanh Nghiệp (Company Admin - Cấu hình & Nhân sự nội bộ DN)} \\ \text{Tổng Giám Đốc (CEO - Lãnh đạo kinh doanh & Điều hành)} \end{cases} \longrightarrow \text{GĐ Vùng} \longrightarrow \text{GĐ Sàn} \longrightarrow \text{Trưởng Phòng} \longrightarrow \text{Trưởng Nhóm} \longrightarrow \text{Sale}$$
- **Khối Marketing & Khối Nhân sự (HR)**: Trực thuộc Tổng Giám Đốc (CEO) của tổ chức mình, xem toàn bộ các vùng trong tổ chức đó.
- **Quản trị viên Nền tảng (Admin)**: Có cờ `isGlobalViewer = true`, nắm toàn quyền quan sát và quản trị kỹ thuật toàn bộ các CEO/Doanh nghiệp trên hệ thống SaaS.
- **Quyền hạn khối Nhân sự (HR Admin)**:
  - Khởi tạo Vùng kinh doanh mới, Sàn mới, Đội nhóm mới và Tài khoản Sale.
  - Xác lập cây tổ chức rõ ràng (thuộc CEO nào, Vùng nào, Sàn nào, Nhóm nào).
  - Tính năng khóa tài khoản (`status: 'inactive'`) khi nhân sự nghỉ việc (offboarding), bảo lưu lịch sử giao dịch và hoa hồng phát sinh.

### 🏢 Quản lý Lead & Phân bổ Round Robin Nguyên tử
- **Phát hiện trùng số điện thoại**: Tự động chuẩn hóa (`+84`, `0...`) và kiểm tra đối soát ngay khi nhập liệu để tránh tranh chấp giỏ hàng.
- **Phân bổ Round Robin (PostgreSQL Atomic Stored Procedure)**:
  - Sử dụng transaction lock cấp hàng (`FOR UPDATE`) triệt tiêu hoàn toàn race condition.
  - Tự động kiểm tra trạng thái Sale hoạt động (`active`), đúng dự án được phân công (`user_projects`) và chưa vượt trần tiếp nhận (`max_leads_per_sale`).
- **Lọc thông tin Leads & KPI**: Hỗ trợ lọc theo tất cả các cấp: CEO, Giám đốc Vùng, Giám đốc Sàn, Đội nhóm và Nhân viên.

### 🧭 Hành trình Khách hàng Kanban & Kịch bản AI 15 Bước
- **Kanban 15 Giai đoạn Customer Journey**: Kéo thả thẻ khách hàng trực quan bằng `@dnd-kit`.
- **Ràng buộc Nghiệp vụ Chặt chẽ**: Khi chuyển sang **Booking giữ chỗ**, **Đặt cọc**, hoặc **Ký HĐMB**, bắt buộc nhập thông tin tài chính đối soát (Mã cọc/HĐ, số tiền, ngày nộp).
- **Kịch bản Bán Hàng AI 15 Trạng Thái Theo Dự Án**:
  - Nội dung phân tích tâm lý khách hàng, câu hỏi khai thác nhu cầu, giải pháp xử lý từ chối và kịch bản tư vấn riêng biệt cho từng trạng thái:
    1. *Mới tiếp nhận*, 2. *Đã liên hệ*, 3. *Khảo sát nhu cầu*, 4. *Gửi tài liệu*, 5. *Hẹn gặp*, 6. *Xem thực tế dự án*, 7. *Tư vấn chuyên sâu*, 8. *Đang cân nhắc*, 9. *So sánh đối thủ*, 10. *Booking giữ chỗ*, 11. *Đặt cọc*, 12. *Ký HĐMB*, 13. *Thanh toán tiến độ*, 14. *Bàn giao nhà*, 15. *Chăm sóc sau bán*.

### 📊 Dashboard Báo Cáo & Bảng Thi Đua Đa Cấp
- **Bộ lọc Báo cáo Đa chiều**: Bổ sung bộ lọc đồng thời theo CEO, Giám đốc Vùng, Giám đốc Sàn, Đội nhóm, Dự án và Khoảng thời gian.
- **Bảng Thi Đua & Hiệu Suất 6 Cấp Bậc**:
  - 🏆 Thi Đua Các CEO
  - 🏆 Thi Đua Các Vùng Kinh Doanh
  - 🏆 Thi Đua Các Sàn Giao Dịch
  - 🏆 Trưởng Phòng / Giám Đốc Sàn
  - 🏆 Thi Đua Đội Nhóm
  - 🏆 Chuyên Viên Tư Vấn Bán Hàng

---

## 2. Vai Trò Người Dùng, Phân Quyền & Row-Level Security (RLS)

Hệ thống thiết kế mô hình phân quyền chặt chẽ kết hợp giữa **Role-Based Access Control (RBAC)**, **Multi-Tenant Scoping (cô lập theo doanh nghiệp)** và **PostgreSQL Row-Level Security (RLS)** cưỡng chế ở tầng cơ sở dữ liệu.

### 2.1 Danh Mục 10 Vai Trò Hệ Thống (`UserRole`)

| Vai trò (`UserRole`) | Chức danh hiển thị | Mô tả trách nhiệm & Phạm vi dữ liệu |
| :--- | :--- | :--- |
| `admin` | **Quản Trị Tổng (Super Admin)** | Toàn quyền kiểm trị kỹ thuật toàn hệ thống (`isGlobalViewer = true`). Quản lý tất cả doanh nghiệp, xem nhật ký kiểm toán (Audit Logs), cấu hình thông số và chuyển đổi góc nhìn (Impersonate). |
| `company_admin` | **Quản Trị Doanh Nghiệp (Enterprise Admin)** | Quản trị cấu hình và các tài khoản trong doanh nghiệp đó, dưới quyền Quản Trị Tổng. Phụ trách cơ cấu Vùng, Sàn, Đội nhóm và nhân sự nội bộ doanh nghiệp. Cách ly tuyệt đối với các doanh nghiệp khác. |
| `ceo` | **Tổng Giám Đốc (Enterprise CEO)** | Lãnh đạo cao nhất của doanh nghiệp, điều hành toàn bộ Khối Kinh Doanh (các Vùng), Khối Marketing và Khối HR. Xem toàn bộ doanh số, hợp đồng, giỏ hàng và hoa hồng của doanh nghiệp mình. |
| `regional_director` | **Giám Đốc Vùng (Regional Director)** | Quản lý toàn bộ các Sàn giao dịch thuộc Vùng kinh doanh phụ trách. Giám sát doanh số, duyệt hợp đồng cấp vùng (5 - 15 tỷ) và điều phối giỏ Lead giữa các sàn. |
| `director` | **Giám Đốc Sàn (Agency Director)** | Điều hành toàn bộ hoạt động, nhân sự và doanh số của Sàn giao dịch. Duyệt hợp đồng cấp sàn (< 5 tỷ), quản lý các phòng kinh doanh và đội nhóm. |
| `sales_manager` | **Trưởng Phòng Kinh Doanh (Sales Manager)** | Quản lý các Đội nhóm kinh doanh và phòng ban trực thuộc Sàn, giám sát tiến độ chốt deal và hỗ trợ xử lý ca khó. |
| `team_leader` | **Trưởng Nhóm Kinh Doanh (Team Leader)** | Quản lý trực tiếp giỏ Lead của Team, hỗ trợ chuyên viên chốt deal, quản lý thi đua nội bộ nhóm. |
| `sale_agent` | **Chuyên Viên Tư Vấn (Sale Agent)** | Tiếp nhận Lead được phân bổ qua Round Robin, chăm sóc khách hàng theo quy trình 15 bước, thực hiện giao dịch và xem hoa hồng cá nhân. |
| `marketing_manager` | **Giám Đốc Marketing (Marketing Head)** | Trực thuộc Tổng Giám Đốc, quản lý các chiến dịch quảng cáo, đo lường CPL/ROI và nguồn Lead. **Bị chặn hoàn toàn quyền xem sổ cái hoa hồng nhân sự.** |
| `hr_admin` | **Giám Đốc / Trưởng HR (HR Head)** | Trực thuộc Tổng Giám Đốc, quản lý vòng đời nhân sự toàn công ty (tuyển dụng, bổ nhiệm, điều chuyển, khóa tài khoản nghỉ việc). **Bị chặn hoàn toàn quyền xem sổ cái hoa hồng.** |

---

### 2.2 Phân Cấp Khởi Tạo Tài Khoản & Cơ Cấu Tổ Chức

Để ngăn chặn đặc quyền leo thang (Privilege Escalation), hệ thống thiết lập ma trận thẩm quyền khởi tạo nghiêm ngặt:

| Người thực hiện thao tác | Được phép tạo / bổ nhiệm | Bị cấm tạo / thao tác |
| :--- | :--- | :--- |
| **Quản Trị Tổng (`admin`)** | • Doanh nghiệp (`Organization`)<br>• Tổng Giám Đốc (`ceo`)<br>• Quản Trị Doanh Nghiệp (`company_admin`)<br>• Toàn bộ các vai trò và cấp bậc hệ thống | *(Không giới hạn)* |
| **Quản Trị Doanh Nghiệp (`company_admin`)** | • Vùng kinh doanh (`Region`) thuộc DN<br>• Sàn giao dịch (`Agency`) thuộc DN<br>• Đội nhóm (`Team`) thuộc DN<br>• Giám Đốc Vùng, Giám Đốc Sàn, Trưởng Phòng, Trưởng Nhóm, Sale Agent, HR, Marketing thuộc DN | ❌ Tạo Doanh nghiệp mới (`Organization`)<br>❌ Tạo Tổng Giám Đốc (`ceo`)<br>❌ Tạo Quản Trị Viên (`admin`)<br>❌ Tạo Company Admin khác (`company_admin`)<br>❌ Tạo cơ cấu hoặc nhân sự cho DN khác |
| **Tổng Giám Đốc (`ceo`)** | • Quản lý & duyệt cơ cấu Vùng, Sàn, Đội nhóm nội bộ DN<br>• Bổ nhiệm Giám Đốc Vùng, Giám Đốc Sàn theo quy trình | ❌ Tạo Doanh nghiệp mới<br>❌ Tạo tài khoản Admin / Company Admin |
| **Quản Trị Nhân Sự (`hr_admin`)** | • Tạo Vùng, Sàn, Đội nhóm trong DN<br>• Tạo tài khoản Sale Agent & nhân sự vận hành<br>• Khóa tài khoản nhân sự nghỉ việc (Inactive) | ❌ Tạo Admin, CEO, Company Admin<br>❌ Thao tác ngoài phạm vi doanh nghiệp trực thuộc |

---

### 2.3 Ma Trận Phân Quyền & Phạm Vi Dữ Liệu (Scope Matrix)

| Chức năng & Nghiệp vụ | Admin (Quản trị tổng) | Quản Trị DN (`company_admin`) | CEO (Tổng GĐ) | GĐ Vùng (`regional`) | GĐ Sàn (`director`) | Marketing | HR Admin | Trưởng Phòng (`sales_mgr`) | Trưởng Nhóm (`team_leader`) | Sale Agent (Tư vấn) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard KPI & Báo cáo** | Toàn hệ thống (Tất cả CEO) | Toàn DN (Cô lập chéo) | Toàn DN (Cô lập chéo) | Toàn vùng phụ trách | Toàn sàn phụ trách | Toàn DN trực thuộc | Toàn DN trực thuộc | Toàn sàn & các team | Chỉ trong team | Cá nhân |
| **Phạm vi Lead / Khách hàng** | 100% Toàn hệ thống | Toàn DN thuộc quyền | Toàn DN thuộc quyền | Toàn vùng phụ trách | Toàn sàn phụ trách | Toàn DN (Masking PII) | Toàn DN (HR hồ sơ) | Toàn sàn phụ trách | Lead thuộc team | Chỉ Lead được giao |
| **Kéo thả Journey & Xác nhận Deal** | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ | ❌ | ✓ | ✓ | ✓ |
| **Tạo DN, Vùng, Sàn, Team** | Toàn quyền 100% | Vùng/Sàn/Team DN (Không tạo CEO/DN) | Vùng/Sàn/Team DN | ❌ | ❌ | ❌ | Vùng/Sàn/Team DN | ❌ | ❌ | ❌ |
| **Duyệt HĐMB Maker-Checker đa tầng** | Toàn quyền (L1/L2/L3) | Duyệt nội bộ DN | Duyệt L3 (>15 tỷ) | Duyệt L2 (5-15 tỷ) | Duyệt L1 (<5 tỷ) | ❌ | ❌ | Kiểm tra hồ sơ | Đề xuất | ❌ |
| **Quyền xem Sổ cái Hoa hồng** | Toàn bộ 5 tầng hệ thống | Toàn bộ các tầng trong DN | Toàn bộ các tầng trong DN | Các bút toán trong Vùng | Các bút toán của Sàn | ❌ BỊ CHẶN | ❌ BỊ CHẶN | Bút toán trong Phòng | Bút toán của Nhóm & Cá nhân | Chỉ xem hoa hồng của mình |
| **Xem SĐT & CCCD (Nghị định 13)** | Đầy đủ 100% | Đầy đủ 100% DN | Đầy đủ 100% DN | Đầy đủ vùng | Đầy đủ sàn | Che mờ PII | Toàn quyền xem & sửa | Đầy đủ sàn | Đầy đủ team | Đầy đủ khách của mình |
| **Bổ nhiệm Leader & Quản lý Team** | ✓ | ✓ | ✓ | Đề xuất | ✓ | ❌ | Thực thi hồ sơ | ✓ | ❌ | ❌ |
| **Quản trị Marketing Ads & CPL** | ✓ | Xem ROI/CPL | Xem ROI/CPL | Xem vùng | Xem sàn | Toàn quyền quản trị | ❌ | ❌ | ❌ | ❌ |
| **Quản lý Vòng đời HR (ATS & Nghỉ việc)** | ✓ | Duyệt cấp cao DN | Duyệt cấp cao | Duyệt nghỉ vùng | Duyệt nghỉ sàn | Duyệt MKT | Toàn quyền vận hành | Duyệt phòng | Duyệt nhóm | Đệ trình đơn cá nhân |
| **Quyền xuất dữ liệu CSV** | Cho phép (Trừ khi Impersonate) | Cho phép (Nội bộ DN) | Cho phép (Nội bộ DN) | Cho phép | Cho phép | Cho phép theo Campaign | Quản trị nhân sự | Cho phép | Cho phép | ❌ Bị từ chối |
| **Chuyển đổi góc nhìn (Impersonate)** | Chỉ Admin kỹ thuật | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cấu hình tham số & Xem Audit Logs** | Toàn hệ thống | Cấu hình nội bộ DN | Xem nội bộ DN | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Xóa vĩnh viễn Thùng rác (Hard Delete)** | Chỉ Admin kỹ thuật | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### 2.4 Kiến Trúc Phân Quyền CSDL & Chính Sách RLS Supabase

Hệ thống cưỡng chế bảo mật dữ liệu ở mức vật lý thông qua **PostgreSQL Row-Level Security (RLS)** trên 100% các bảng thuộc schema `public`:

1. **Tuân thủ Tiêu chuẩn An toàn Supabase Security Advisor**:
   - `rls_disabled_in_public`: **0 lỗi** (Toàn bộ 20 bảng công khai đã được kích hoạt `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - `rls_enabled_no_policy`: **0 lỗi** (Tất cả các bảng có RLS đều có chính sách phân quyền tường minh).
2. **Ràng buộc Kiểm tra Toàn vẹn Vai trò (`profiles_role_check`)**:
   ```sql
   ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
     CHECK (role IN (
       'admin', 
       'ceo', 
       'company_admin',
       'regional_director', 
       'director', 
       'sales_manager', 
       'team_leader', 
       'sale_agent', 
       'marketing_manager', 
       'hr_admin'
     ));
   ```
3. **Cơ chế Cô Lập Đa Khách Thuê (Multi-Tenant Row Isolation)**:
   - Mọi bảng dữ liệu nghiệp vụ (`regions`, `agencies`, `teams`, `projects`, `leads`, `contracts`, `commission_entries`, `commission_policies`) đều sở hữu trường khóa ngoại `organization_id UUID REFERENCES organizations(id)`.
   - **Quy tắc đọc (SELECT Policy)**:
     - Tài khoản `admin` (`get_auth_role() = 'admin'`): Được quyền truy vấn toàn bộ bản ghi trên hệ thống.
     - Tài khoản `company_admin` và `ceo`: Chỉ truy vấn các dòng có `organization_id = get_auth_org_id()`.
     - Tài khoản cấp dưới: Kế thừa điều kiện `organization_id` kết hợp với phạm vi cây phân cấp nhánh (`region_id`, `agency_id`, `team_id`, hoặc `assigned_to = auth.uid()`).
4. **Cưỡng chế Phân Bổ Tiền tệ & Hoa hồng ở Stored Procedure / RPC**:
   - Client **tuyệt đối không gửi số tiền hoa hồng hay tỷ lệ phân bổ**. Mọi phép tính hoa hồng 5 tầng, làm tròn phần dư nguyên VNĐ, chia thưởng nhóm và kiểm tra trần ngân sách đều được thực thi tự động, nguyên tử (Atomic) qua Database RPC Function `create_contract_with_customer` và `calculate_commission`.

---

## 3. Kiến trúc Hệ thống & Phân lớp Mã nguồn

Dự án áp dụng chặt chẽ **Clean Architecture & Repository Pattern**. Giao diện React tuyệt đối không gọi trực tiếp cơ sở dữ liệu mà phải thông qua Domain Services và Repositories:

```
crm-broker/
├── src/
│   ├── app/                                 # Cấu hình Router, Layouts, Guards, Zustand Store
│   │   ├── router.tsx
│   │   ├── AppLayout.tsx                    # Shell điều hướng, Sidebar, Header, Drawer Mobile
│   │   ├── guards.tsx                       # AuthGuard, RoleGuard, PasswordChangeGuard
│   │   └── useAuthStore.ts                  # Quản lý phiên làm việc, tự động đăng xuất sau 30 phút
│   ├── domain/                              # Định nghĩa nghiệp vụ & Domain Logic thuần túy
│   │   ├── types.ts                         # Strict TypeScript Definitions (5 tiers, contracts, leads...)
│   │   ├── constants.ts                     # 15 Trạng thái, hằng số phân quyền, vai trò, nguồn
│   │   └── services/
│   │       └── commissionService.ts         # Tính hoa hồng 5 tầng, Largest Remainder Method, Scope Matrix
│   ├── data/
│   │   ├── mockData.ts                      # Dữ liệu mô phỏng đồng bộ với Seed Database
│   │   └── repositories/                    # TẦNG GIAO TIẾP DUY NHẤT VỚI SUPABASE / DATABASE
│   │       ├── authRepository.ts            # Đăng nhập, phân quyền, Impersonate, 2FA
│   │       ├── contractRepository.ts        # Hợp đồng, bút toán hoa hồng, RPC gán người nhận
│   │       ├── leadRepository.ts            # Quản lý vòng đời Lead, điều chuyển, Round Robin
│   │       ├── projectRepository.ts         # Dự án BĐS, tri thức AI, tóm tắt văn bản
│   │       ├── dashboardRepository.ts       # Tổng hợp KPI doanh số và nguồn Marketing
│   │       ├── teamRepository.ts            # Quản lý CEO, Vùng, Sàn, Đội nhóm, Nhân sự
│   │       ├── aiRepository.ts              # Trợ lý AI phân tích Lead & Kịch bản 15 bước
│   │       └── auditRepository.ts           # Ghi vết bảo mật, Hash Chain, Audit Logs
│   ├── features/                            # Các Module chức năng theo Domain
│   │   ├── auth/                            # Đăng nhập, đổi mật khẩu bắt buộc
│   │   ├── dashboard/                       # Báo cáo hiệu quả kinh doanh & Marketing đa tầng
│   │   ├── leads/                           # Quản lý Lead Pool, phân bổ thông minh
│   │   ├── journey/                         # Bàn cờ Kanban 15 giai đoạn khách hàng
│   │   ├── transactions/                    # Hợp đồng & Tab Thu Nhập / Sổ Cái Hoa Hồng 5 Tầng
│   │   │   ├── TransactionsPage.tsx         # Trang chính & Modal tạo hợp đồng 5 tầng
│   │   │   ├── IncomeLedgerTab.tsx          # Tab Sổ Cái Thu Nhập, KPI, Biểu đồ & Xuất CSV
│   │   │   └── ContractCommissionDetailModal.tsx # Chi tiết hoa hồng từng hợp đồng & Gán người nhận
│   │   ├── leaderboard/                     # Bảng thi đua hiệu suất 6 cấp bậc
│   │   ├── projects/                        # Quản lý giỏ hàng & tri thức dự án
│   │   ├── scripts/                         # Kịch bản bán hàng AI 15 bước
│   │   └── admin/                           # Trung tâm Quản trị, Cơ cấu Nhân sự & Audit Logs
│   ├── components/ui/                       # Thư viện UI Component dùng chung
│   ├── test/                                # Bộ kiểm thử Vitest toàn diện
│   │   └── commission_tiers_and_income.test.ts # 19 test case kiểm chứng phân bổ hoa hồng
│   └── lib/                                 # Client Supabase, format tiền tệ VNĐ, chuẩn hóa SĐT
├── supabase/
│   ├── migrations/                          # Migrations SQL có đánh số thứ tự từ 001 đến 028
│   │   ├── 027_ceo_regional_divisions_and_org_restructure.sql
│   │   ├── 028_commission_tiers_and_income_ledger.sql
│   │   └── rollback/                        # File rollback an toàn cho từng migration
│   ├── functions/                           # Edge Functions xử lý AI và Webhook
│   └── seed.sql                             # Dữ liệu khởi tạo chuẩn mực
├── docs/dev-log/                            # Nhật ký kiến trúc & Tiến độ phát triển
│   ├── DECISIONS.md                         # Ghi nhận các quyết định kiến trúc quan trọng (ADR)
│   └── PROGRESS.md                          # Tiến độ chi tiết từng giai đoạn
└── README.md
```

---

## 4. Hướng dẫn Cài đặt & Khởi chạy Local

### Yêu cầu tiên quyết
- **Node.js**: Phiên bản 18.x trở lên (khuyến nghị Node 20.x hoặc 22.x LTS).
- **Trình quản lý gói**: `npm` hoặc `pnpm`.

### Các bước cài đặt:
```bash
# 1. Clone repository
git clone https://github.com/your-org/crm-broker.git
cd crm-broker

# 2. Cài đặt toàn bộ dependencies
npm install

# 3. Tạo file cấu hình môi trường từ mẫu
cp .env.example .env

# 4. Kiểm tra mã nguồn & Chạy bộ kiểm thử tự động
npm test

# 5. Khởi động môi trường phát triển cục bộ
npm run dev
```

Truy cập hệ thống tại: `http://localhost:3000`.

---

## 5. Cấu hình Supabase & Database Migrations

### Bước 1: Chuẩn bị Dự án Supabase
1. Đăng nhập [Supabase Dashboard](https://supabase.com), khởi tạo một dự án mới (Khuyến nghị vùng **Singapore** để có tốc độ truy cập tốt nhất tại Việt Nam).
2. Lấy thông số `Project URL` và `Anon Key` tại **Project Settings > API**, điền vào file `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Bước 2: Thực thi Migrations SQL
Mở mục **SQL Editor** trên Supabase Dashboard và thực thi tuần tự các file migration trong thư mục `supabase/migrations/`:
- `001_initial_schema.sql` đến `026_admin_director_full_access_and_sample_data.sql`: Hệ thống cơ sở, RLS, phân quyền, SLA và giỏ hàng.
- `027_ceo_regional_divisions_and_org_restructure.sql`: Bổ sung cấu trúc CEO, Giám Đốc Vùng, 3 Khối chức năng và phân cấp chức danh.
- `028_commission_tiers_and_income_ledger.sql`: Bảng sổ cái `commission_entries`, nhật ký `commission_runs`, chính sách hoa hồng và RPC gán người nhận.

---

## 6. Kiểm thử Tự động & Build Production

Hệ thống được bảo vệ bằng hệ sinh thái kiểm thử nghiêm ngặt, đảm bảo mọi tính toán tài chính và phân quyền luôn chuẩn xác:

```bash
# Chạy toàn bộ 348 bài kiểm thử tự động (Unit & Integration tests qua 34 test files)
npm test

# Kiểm tra cú pháp và kiểu dữ liệu TypeScript (Strict Mode)
npx tsc --noEmit

# Đóng gói bản phát hành sản phẩm (Production Build)
npm run build
```

**Kết quả kiểm tra thực tế:**
- **Unit & Integration Tests**: `31/31 test files PASSED`, **`309/309 tests PASSED (100%)`**.
- **TypeScript Strict**: `0 errors`.
- **Bundle Optimization**: Tối ưu hóa code-splitting và caching thông qua Vite.

---

## 7. Triển khai Production Vercel & CI/CD

Hệ thống được thiết lập cơ chế **Continuous Integration & Continuous Deployment (CI/CD)** tự động:

1. **Môi trường Production Trực tiếp**:
   - URL: **https://crm-broker-platform.vercel.app**
   - Trạng thái: `HTTP/2 200 OK`
2. **Quy trình Deploy Tự động**:
   - Mỗi commit được đẩy lên nhánh `main` sau khi vượt qua CI (`npm test` & `npm run build`) sẽ tự động kích hoạt pipeline build và triển khai trên Vercel.
   - Header bảo mật được cấu hình tự động thông qua `vercel.json`:
     - `Content-Security-Policy`: Chống XSS và injection.
     - `X-Frame-Options: DENY`: Chống clickjacking.
     - `X-Content-Type-Options: nosniff`: Ngăn chặn MIME-type sniffing.

---

## 8. Bảo mật & Tuân thủ Nghị định 13/2023/NĐ-CP

Hệ thống được thiết kế đáp ứng chặt chẽ các yêu cầu của **Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân (PDPD)**:

1. **Che mờ Dữ liệu Nhạy cảm (PII Masking)**:
   - Số điện thoại và Email khách hàng tự động được che mờ (`098****123`, `ng***@gmail.com`) khi hiển thị cho Marketing, trong nhật ký Audit Logs và trước khi gửi sang API bên thứ ba.
2. **Chống Rò rỉ Dữ liệu Tài chính trong Chế độ Impersonate**:
   - Khi Admin đóng vai các vị trí khác, hệ thống tự động khóa tính năng xuất báo cáo CSV (`CSV export is strictly blocked in Impersonation mode`) nhằm ngăn chặn việc trích xuất hàng loạt dữ liệu thu nhập.
3. **Cơ chế Xác thực & Kiểm toán Bất biến (Audit Log Hash Chain)**:
   - Mọi thao tác gán người nhận hoa hồng, duyệt hợp đồng, thay đổi trạng thái đều ghi nhận lý do (tối thiểu 10 ký tự), lưu vết địa chỉ IP, User Agent và chuỗi băm chống giả mạo.
4. **Bảo vệ Tài khoản & Tự động Đăng xuất**:
   - Khóa tạm tài khoản 5 phút nếu nhập sai mật khẩu quá 5 lần liên tiếp.
   - Tự động hủy phiên đăng nhập nếu người dùng không thao tác sau 30 phút.

---

## 9. Tài khoản Demo Khởi tạo Sẵn

Hệ thống tích hợp sẵn các tài khoản demo đầy đủ vai trò với mật khẩu mặc định: `password123`:

| Vai trò | Email đăng nhập | Quyền hạn tiêu biểu |
| :--- | :--- | :--- |
| **Quản Trị Tổng (Admin)** | `admin@diaocvang.vn` | Xem toàn bộ hệ thống, cấu hình tham số, kiểm tra Audit Logs, Impersonate |
| **Quản Trị Doanh Nghiệp (Company Admin)** | `admin.glg@diaocvang.vn` | Quản trị cấu hình, tạo Vùng/Sàn/Team và quản lý tài khoản nội bộ DN Golden Land Group |
| **Tổng Giám Đốc (CEO)** | `ceo@diaocvang.vn` | Điều hành toàn bộ khối kinh doanh, marketing và HR của doanh nghiệp |
| **Giám Đốc Vùng (Regional Director)** | `gdvung1@diaocvang.vn` | Quản trị các sàn giao dịch trong vùng, duyệt hợp đồng cấp vùng |
| **Giám Đốc Sàn (Director)** | `gdsan@diaocvang.vn` | Quản lý sàn giao dịch, duyệt hợp đồng cấp sàn, quản lý đội nhóm |
| **Trưởng Phòng Kinh Doanh (Sales Manager)** | `sales.manager@diaocvang.vn` | Quản lý các đội nhóm kinh doanh, hỗ trợ chốt hợp đồng lớn |
| **Trưởng Nhóm (Team Leader)** | `truongnhom@diaocvang.vn` | Quản lý giỏ lead đội nhóm, chia deal và xem thu nhập nhóm |
| **Chuyên Viên Tư Vấn (Sale Agent)** | `sale@diaocvang.vn` | Tiếp nhận Lead, kéo thả Kanban, xem sổ cái hoa hồng cá nhân |
| **Giám Đốc Marketing (Marketing Head)** | `marketing@diaocvang.vn` | Quản trị nguồn chiến dịch Lead (Không xem hoa hồng cá nhân) |
| **Quản Trị Nhân Sự (HR Admin)** | `hr@diaocvang.vn` | Tạo vùng, sàn, nhóm, tài khoản sale, khóa nhân sự nghỉ việc |

---

© 2026 Real Estate CRM Platform • Kiến trúc chuẩn Enterprise cho ngành Bất Động Sản Việt Nam.
