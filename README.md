# REAL ESTATE CRM – SALES & MARKETING INTELLIGENCE PLATFORM
*(Hệ Thống Quản Trị Bất Động Sản Doanh Nghiệp, Phân Bổ Lead & Hoa Hồng 5 Tầng)*

[![Production Deployment](https://img.shields.io/badge/Vercel-Production%20Live-brightgreen?logo=vercel)](https://crm-broker-platform.vercel.app)
[![Tests Passing](https://img.shields.io/badge/Vitest-318%2F318%20Passing-success?logo=vitest)](https://github.com/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-5.5%20Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-Supabase%20RLS-3ECF8E?logo=supabase)](https://supabase.com/)

Hệ thống quản trị quan hệ khách hàng, phân bổ lead tự động, quản lý kịch bản bán hàng bằng AI và tính toán phân bổ hoa hồng 5 tầng (SaaS Enterprise) chuẩn hóa cho thị trường Bất Động Sản Việt Nam.

Được xây dựng trên nền tảng: **React 18, TypeScript strict, Vite, Tailwind CSS, TanStack Query, Zustand, dnd-kit, Recharts, Supabase (PostgreSQL 15+, Auth, Row Level Security, Edge Functions)** và triển khai tự động qua **GitHub Actions & Vercel**.

---

## 📑 Mục lục
1. [Hệ thống Tính năng Nổi bật](#1-hệ-thống-tính-năng-nổi-bật)
   - [Phân bổ hoa hồng 5 tầng & Sổ cái Thu nhập](#-phân-bổ-hoa-hồng-5-tầng--sổ-cái-thu-nhập-transactions)
   - [Quản lý Cơ cấu Tổ chức & Phân cấp Doanh nghiệp](#-cơ-cấu-tổ-chức-9-cấp-bậc--phân-quyền-chặt-chẽ)
   - [Quản trị Lead & Phân bổ Round Robin](#-quản-lý-lead--phân-bổ-round-robin-nguyên-tử)
   - [Hành trình Khách hàng 15 Trạng thái & Sales Script AI](#-hành-trình-khách-hàng-kanban--kịch-bản-ai-15-bước)
   - [Báo cáo & Bảng Thi đua Đa cấp](#-dashboard-báo-cáo--bảng-thi-đua-đa-cấp)
2. [Ma trận Phân quyền & Phạm vi Dữ liệu (Scope Matrix)](#2-ma-trận-phân-quyền--phạm-vi-dữ-liệu-scope-matrix)
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

### 🏛️ Mô hình SaaS Multi-Tenant & Cách ly Dữ liệu Theo Nhánh CEO
- **CEO đóng vai trò như Khách hàng Doanh nghiệp (Tenant / Client)**:
  - Mỗi Tổng Giám Đốc (CEO) chỉ xem và quản lý dữ liệu thuộc nhánh của họ: **Dự án của họ**, **Giám Đốc Vùng của họ**, **Hợp đồng của họ**, **Nhân sự của họ**, **Sàn/Team của họ**, và **Sổ cái hoa hồng của họ**.
  - **Cách ly tuyệt đối giữa các CEO**: CEO của doanh nghiệp này không thể xem chéo bất kỳ dự án, nhân sự, hợp đồng, hoa hồng hay doanh số nào của CEO doanh nghiệp khác.
  - Khi CEO tạo dự án mới hoặc tuyển dụng nhân sự mới, dữ liệu tự động được định danh theo `organization_id` của CEO đó.
  - **Tự động khởi tạo Mã Doanh Nghiệp (Enterprise Code)**: Khi khởi tạo Doanh nghiệp (CEO) mới, hệ thống tự động chuẩn hóa tên tiếng Việt, loại bỏ stopwords (`Công ty`, `Cổ phần`, `TNHH`, `BĐS`...) và sinh mã định danh duy nhất dạng `ORG-{ACRONYM}` (ví dụ: `ORG-DOVMT`, `ORG-DX`) kèm cơ chế chống xung đột mã.
  - Truy cập trực tiếp qua ID vào dự án hay hồ sơ 360 của đối tác khác sẽ bị từ chối truy cập ngay lập tức.
- **Mô hình chuỗi lãnh đạo dọc trong từng Tenant**:
  $$\text{Admin (Global)} \longrightarrow \text{CEO (Tenant)} \longrightarrow \text{Giám Đốc Vùng} \longrightarrow \text{Giám Đốc Sàn} \longrightarrow \text{Trưởng Phòng} \longrightarrow \text{Trưởng Nhóm} \longrightarrow \text{Chuyên Viên Sale}$$
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

## 2. Ma trận Phân quyền & Phạm vi Dữ liệu (Scope Matrix)

| Vai trò (`Role`) | Phạm vi Lead / Khách hàng | Phạm vi Hợp đồng / Doanh số | Quyền xem Sổ cái Hoa hồng | Quyền xuất dữ liệu CSV |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Toàn bộ hệ thống | Toàn bộ hệ thống | Toàn bộ 5 tầng | Cho phép (Trừ khi Impersonate) |
| **CEO** (Tổng Giám Đốc) | Toàn bộ nhánh các Vùng trực thuộc | Toàn bộ các Vùng trực thuộc | Toàn bộ nhánh trực thuộc | Cho phép (Trừ khi Impersonate) |
| **Regional Director** (GĐ Vùng) | Toàn bộ các Sàn trong Vùng | Các hợp đồng trong Vùng | Các bút toán trong Vùng | Cho phép (Trừ khi Impersonate) |
| **Director** (Giám Đốc Sàn) | Toàn bộ các Nhóm trong Sàn | Các hợp đồng của Sàn | Các bút toán của Sàn | Cho phép |
| **Sales Manager** (Trưởng Phòng) | Các Nhóm thuộc Phòng | Hợp đồng thuộc Phòng | Bút toán trong Phòng | Cho phép |
| **Team Leader** (Trưởng Nhóm) | Các Sale trong Đội nhóm | Hợp đồng của Đội nhóm | Bút toán của Nhóm & Cá nhân | Cho phép |
| **Sale Agent** (Chuyên Viên) | **Chỉ Lead được phân công** | Hợp đồng do mình thực hiện | **Chỉ xem hoa hồng của chính mình** | Bị từ chối |
| **Marketing Manager** | Xem để đo lường nguồn (Masking PII) | Thống kê chiến dịch | **BỊ CHẶN HOÀN TOÀN** | Cho phép theo chiến dịch |
| **HR Admin** | Quản lý thông tin định danh | Thống kê KPI nhân sự | **BỊ CHẶN HOÀN TOÀN** | Quản trị nhân sự |

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
# Chạy toàn bộ 281 bài kiểm thử tự động (Unit & Integration tests)
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
| **Quản Trị Viên (Admin)** | `admin@diaocvang.vn` | Xem toàn bộ hệ thống, cấu hình hệ thống, kiểm tra Audit Logs |
| **Tổng Giám Đốc (CEO)** | `giamdoc@diaocvang.vn` | Quản lý toàn bộ các vùng kinh doanh trực thuộc |
| **Giám Đốc Vùng** | `gd.vung@diaocvang.vn` | Quản trị các sàn giao dịch trong vùng kinh doanh |
| **Giám Đốc Sàn** | `gdsan@diaocvang.vn` | Quản lý sàn giao dịch, duyệt hợp đồng cấp sàn |
| **Trưởng Nhóm (Leader)** | `truongnhom@diaocvang.vn` | Quản lý giỏ hàng đội nhóm, xem thu nhập nhóm |
| **Chuyên Viên Tư Vấn (Sale)** | `sale@diaocvang.vn` | Tiếp nhận Lead, kéo thả Kanban, xem sổ cái hoa hồng cá nhân |
| **Marketing Manager** | `marketing@diaocvang.vn` | Quản trị nguồn chiến dịch Lead (Không xem hoa hồng cá nhân) |
| **Quản Trị Nhân Sự (HR)** | `hr@diaocvang.vn` | Tạo vùng, sàn, nhóm, tài khoản sale, khóa nhân sự nghỉ việc |

---

© 2026 Real Estate CRM Platform • Kiến trúc chuẩn Enterprise cho ngành Bất Động Sản Việt Nam.
