# REAL ESTATE CRM – SALES & MARKETING INTELLIGENCE PLATFORM

Hệ thống quản trị quan hệ khách hàng và trợ lý bán hàng bất động sản thông minh (SaaS Enterprise) dành cho thị trường Việt Nam.

Được xây dựng trên nền tảng **React 18, TypeScript, Tailwind CSS, TanStack Query, Zustand, dnd-kit, Supabase (PostgreSQL, Auth, RLS, Edge Functions)** và triển khai tự động qua **GitHub Actions & Vercel**.

---

## 📑 Mục lục
1. [Tính năng nổi bật](#tính-năng-nổi-bật)
2. [Kiến trúc hệ thống & Phân lớp mã nguồn](#kiến-trúc-hệ-thống--phân-lớp-mã-nguồn)
3. [6 Vai trò người dùng & Phân quyền RLS](#6-vai-trò-người-dùng--phân-quyền-rls)
4. [Hướng dẫn cài đặt và chạy trên máy (Local)](#hướng-dẫn-cài-đặt-và-chạy-trên-máy-local)
5. [Cấu hình Supabase & Đưa dữ liệu vào Database](#cấu-hình-supabase--đưa-dữ-liệu-vào-database)
6. [Triển khai lên Vercel & CI/CD GitHub Actions](#triển-khai-lên-vercel--cicd-github-actions)
7. [Bảo mật & Tuân thủ Nghị định 13/2023/NĐ-CP](#bảo-mật--tuân-thủ-nghị-định-132023nđ-cp)
8. [Sao lưu (Backup) & Khôi phục (Restore) Cơ sở dữ liệu](#sao-lưu-backup--khôi-phục-restore-cơ-sở-dữ-liệu)
9. [Dự toán chi phí vận hành hạ tầng](#dự-toán-chi-phí-vận-hành-hạ-tầng)
10. [Xử lý sự cố thường gặp (Troubleshooting)](#xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Tính năng nổi bật

### 🏢 Quản lý Lead & Phân bổ thông minh
- **Phát hiện trùng số điện thoại**: Tự động chuẩn hóa (`+84`, `0...`) và đối soát số điện thoại ngay khi nhập liệu để ngăn chặn trùng Lead.
- **Phân bổ Round Robin (Atomic RPC)**: Thuật toán phân bổ tự động bằng stored procedure PostgreSQL chạy trong Transaction lock (`FOR UPDATE`), ngăn chặn hai Sale cùng lúc nhận trùng một Lead. Tự động kiểm tra Sale đang hoạt động (`active`), đúng dự án phân công (`user_projects`) và chưa vượt quá trần Lead (`max_leads_per_sale`).
- **Phân bổ thủ công & Lịch sử điều chuyển**: Ghi nhận toàn bộ biến động giỏ hàng vào bảng `lead_assignments`.

### 🧭 Customer Journey Kanban (15 Giai đoạn)
- Kéo thả thẻ khách hàng mượt mà bằng thư viện `@dnd-kit`.
- **Ràng buộc giao dịch bắt buộc**: Khi chuyển trạng thái sang **Booking giữ chỗ**, **Đặt cọc**, hoặc **Ký HĐMB**, hệ thống bắt buộc người dùng nhập dữ liệu đối soát tài chính thực tế (mã Booking, số tiền cọc, ngày nộp cọc, mã hợp đồng HĐMB). Việc kéo thả không tự động sinh giao dịch tài chính nếu thiếu thông tin xác nhận.
- Tự động ghi vết dòng thời gian vào `lead_status_history` bằng Trigger cơ sở dữ liệu.

### 🧠 Dự án & Tri thức AI (Tối ưu hóa Database)
- **Tóm tắt dự án dạng văn bản (<= 3.000 ký tự)**: Không upload file đính kèm để tiết kiệm dung lượng database. Khi lưu tóm tắt, hệ thống tự động nhận diện và trích xuất các dòng dạng `Nhãn: nội dung` (Vị trí:, Giá:, Pháp lý:, Tiến độ:, Chính sách:, Điểm nhấn:) để điền vào các trường cơ sở dữ liệu.
- **AI Bổ sung thông tin tự động (`project-enrich`)**: Gọi AI từ Edge Function tìm kiếm từ các nguồn chính thống (website chủ đầu tư, báo chí chính thống). Hiện bảng nháp đối chiếu: trường trống mặc định được chọn, trường đã có dữ liệu không bị ghi đè nếu không tick chọn. Dữ liệu AI được gắn cờ `unverified = true` (chưa xác minh) cho tới khi người quản lý duyệt.

### 💬 Sales Script & AI Intelligence
- **Sales Script 15 trạng thái**: Kịch bản bán hàng tiêu chuẩn cho từng dự án. Script Tự động (`is_auto`) tự làm mới khi tóm tắt dự án thay đổi; script Tùy chỉnh (`is_edited`) giữ nguyên nội dung do chuyên viên biên soạn.
- **AI Trợ lý bán hàng (`ai-lead-insight`, `ai-script`)**: Tóm tắt chân dung khách hàng, nhận diện nhu cầu tiềm ẩn, nhận diện phản đối, giải thích điểm số Lead và tạo kịch bản cá nhân hóa dựa trên đặc điểm dự án thật. Che mờ số điện thoại và email trước khi gửi tới API AI.

### 📊 Dashboard Báo Cáo Thời Gian Thực
- Mọi con số (Tổng Lead, Tỷ lệ liên hệ, Số Booking/Cọc/HĐMB, Doanh số giao dịch phát sinh, Doanh thu hoa hồng dự kiến) được tính toán trực tiếp từ dữ liệu thật, không sinh số ngẫu nhiên.
- Bộ lọc đa năng theo: Thời gian, Dự án, Sàn phân phối, Team, Sale.
- Biểu đồ phễu chuyển đổi 15 bước, phân bổ Lead theo nguồn Marketing và theo dự án.

---

## 2. Kiến trúc hệ thống & Phân lớp mã nguồn

Mã nguồn được cấu trúc theo tiêu chuẩn **Repository Pattern** và module hóa sạch sẽ:

```
crm-broker/
├── src/
│   ├── app/                      # Bộ điều hướng Router, Layouts, Guards, Zustand Store
│   │   ├── router.tsx
│   │   ├── AppLayout.tsx         # Sidebar Desktop + ☰ Drawer Mobile + Role Switcher
│   │   ├── guards.tsx            # AuthGuard, RoleGuard, PasswordChangeGuard
│   │   └── useAuthStore.ts       # Quản lý phiên, tự đăng xuất sau 30 phút không hoạt động
│   ├── domain/                   # Định nghĩa nghiệp vụ độc lập UI
│   │   ├── types.ts              # TypeScript Strict interfaces
│   │   └── constants.ts          # 15 trạng thái Customer Journey, 6 vai trò, nguồn Lead
│   ├── data/
│   │   ├── mockData.ts           # Dữ liệu khởi tạo in-memory nhất quán với seed.sql
│   │   └── repositories/         # NƠI DUY NHẤT GỌI SUPABASE (Repository Pattern)
│   │       ├── authRepository.ts
│   │       ├── leadRepository.ts
│   │       ├── projectRepository.ts
│   │       ├── dashboardRepository.ts
│   │       ├── teamRepository.ts
│   │       ├── aiRepository.ts   # Triển khai AIService Interface
│   │       └── auditRepository.ts
│   ├── features/                 # Các màn hình chức năng độc lập
│   │   ├── auth/                 # Đăng nhập, đổi mật khẩu bắt buộc
│   │   ├── dashboard/            # Báo cáo KPI, biểu đồ doanh số thật
│   │   ├── leads/                # Danh sách Lead, Chi tiết Lead & AI Assistant
│   │   ├── journey/              # Kanban 15 trạng thái kéo thả kèm form giao dịch
│   │   ├── distribution/         # Phân bổ Lead Pool, Round Robin RPC
│   │   ├── projects/             # Danh sách dự án, Tri thức AI & Tóm tắt văn bản
│   │   ├── scripts/              # Quản lý Sales Scripts theo dự án & trạng thái
│   │   ├── notifications/        # Cảnh báo follow-up đến hạn kèm lọc dự án
│   │   └── admin/                # Quản trị Người dùng, Phân quyền Role, Audit Logs
│   ├── components/ui/            # UI Primitives: Button, Card, Input, Modal, Badge...
│   └── lib/                      # Supabase client, Tiện ích chuẩn hóa SĐT, format tiền tệ
├── supabase/
│   ├── migrations/               # PostgreSQL Migrations đánh số thứ tự
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_functions_triggers_rpc.sql
│   │   └── 003_rls_policies.sql
│   ├── functions/                # Deno Edge Functions
│   │   ├── ai-script/
│   │   ├── ai-lead-insight/
│   │   ├── project-enrich/
│   │   ├── lead-webhook/
│   │   └── create-user/
│   └── seed.sql                  # Dữ liệu demo chuẩn mực, đầy đủ giao dịch đồng bộ
├── .github/workflows/ci.yml      # CI Pipeline tự động test & build
├── vercel.json                   # Security Headers (CSP, X-Frame-Options) & Rewrites
├── .env.example
└── README.md
```

---

## 3. 6 Vai trò người dùng & Phân quyền RLS

Bảo mật được thực thi tại **tầng cơ sở dữ liệu** thông qua PostgreSQL Row Level Security (RLS) với các hàm tiện ích `current_role()`, `current_agency()`, `current_team()`:

| Vai trò | Phạm vi xem Lead | Quyền phân bổ Lead | Quyền xuất dữ liệu CSV | Quyền sửa Tri thức & Script |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Toàn bộ hệ thống | Có | Có | Có |
| **Director** (Ban Giám Đốc) | Toàn bộ hệ thống | Có | Có | Có |
| **Marketing Manager** | Xem để đo lường nguồn (Ẩn SĐT/Email nếu chưa cấp phép) | Không | Có | Có |
| **Sales Manager** (GĐ Sàn) | Chỉ Lead thuộc Sàn mình quản lý | Có | Có | Có |
| **Team Leader** (Trưởng nhóm) | Chỉ Lead thuộc Team mình | Có | Có | Không |
| **Sale Agent** (Chuyên viên) | **Chỉ Lead được giao cho mình** | Không | Không | Không |

> 🔒 **Cơ chế Chuyển đổi góc nhìn (Role Impersonate)**: Chỉ Quản trị viên (Admin) mới có quyền chuyển đổi giao diện sang các vai trò khác để kiểm tra trải nghiệm người dùng. Mỗi lần chuyển đổi đều được ghi vết vào bảng `audit_logs`.

---

## 4. Hướng dẫn cài đặt và chạy trên máy (Local)

### Yêu cầu môi trường
- Node.js version 18 trở lên (khuyến nghị Node 20 hoặc 22)
- Trình quản lý gói `npm` (hoặc `pnpm`)

### Các bước khởi chạy:
```bash
# 1. Di chuyển vào thư mục dự án
cd /path/to/CRM-Broker

# 2. Cài đặt các gói thư viện
npm install

# 3. Tạo file biến môi trường từ mẫu
cp .env.example .env

# 4. Chạy kiểm thử tự động (Unit Tests)
npm test

# 5. Khởi động máy chủ phát triển
npm run dev
```

Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000`.

### Tài khoản Demo kiểm thử nhanh:
Hệ thống tích hợp sẵn bộ tài khoản đại diện cho 6 vai trò với mật khẩu mặc định: `password123`:
- **Admin**: `admin@diaocvang.vn`
- **Director (Tổng GĐ)**: `giamdoc@diaocvang.vn`
- **Marketing Manager**: `marketing@diaocvang.vn`
- **Sales Manager (GĐ Sàn)**: `gdsan@diaocvang.vn`
- **Team Leader (Trưởng nhóm)**: `truongnhom@diaocvang.vn`
- **Sale Agent (Tư vấn viên)**: `sale@diaocvang.vn`

---

## 5. Cấu hình Supabase & Đưa dữ liệu vào Database

### Bước 1: Khởi tạo Project trên Supabase
1. Đăng nhập [https://supabase.com](https://supabase.com) và tạo một Project mới (chọn Region `Singapore` để có độ trễ thấp nhất về Việt Nam).
2. Lấy `URL` và `anon key` tại mục **Project Settings > API**.

### Bước 2: Chạy Migrations SQL
Mở mục **SQL Editor** trên Supabase Dashboard và thực thi tuần tự các file:
1. `supabase/migrations/001_initial_schema.sql` (Tạo bảng, khóa ngoại, chỉ mục)
2. `supabase/migrations/002_functions_triggers_rpc.sql` (Hàm RLS helper, Trigger giao dịch, Round Robin RPC)
3. `supabase/migrations/003_rls_policies.sql` (Bật RLS toàn bộ các bảng)
4. `supabase/seed.sql` (Đưa 1 công ty, 3 sàn, 5 dự án, 6 team, 30 sale, 300 khách hàng và giao dịch tương ứng vào hệ thống)

### Bước 3: Triển khai Edge Functions & Cấu hình Secrets
Cài đặt Supabase CLI và liên kết dự án:
```bash
# Đăng nhập Supabase CLI
npx supabase login

# Liên kết với Project
npx supabase link --project-ref your-project-ref

# Thiết lập các biến bí mật trên máy chủ (Không bao giờ đưa vào frontend)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npx supabase secrets set AI_API_KEY=your-gemini-or-openai-api-key
npx supabase secrets set LEAD_WEBHOOK_SECRET=your-webhook-secret

# Triển khai các Edge Functions
npx supabase functions deploy ai-script
npx supabase functions deploy ai-lead-insight
npx supabase functions deploy project-enrich
npx supabase functions deploy lead-webhook
npx supabase functions deploy create-user
```

---

## 6. Triển khai lên Vercel & CI/CD GitHub Actions

### 1. Đẩy mã nguồn lên GitHub:
```bash
git add .
git commit -m "feat: complete Real Estate CRM production platform"
git branch -M main
git remote add origin https://github.com/your-org/crm-broker.git
git push -u origin main

# Tạo nhánh develop cho môi trường Staging
git checkout -b develop
git push -u origin develop
```

### 2. Thiết lập trên Vercel:
1. Đăng nhập [https://vercel.com](https://vercel.com), chọn **Add New > Project**, liên kết với repository GitHub `crm-broker`.
2. Khai báo 2 biến môi trường trên Vercel:
   - `VITE_SUPABASE_URL`: URL của Supabase Project.
   - `VITE_SUPABASE_ANON_KEY`: Khóa anon công khai của Supabase.
3. Vercel sẽ tự động đọc file `vercel.json` để kích hoạt các tiêu đề bảo mật (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) và rewrite mọi đường dẫn về `index.html`.

### 3. Quy trình CI/CD:
File `.github/workflows/ci.yml` sẽ tự động kích hoạt kiểm tra kiểu dữ liệu TypeScript (`npm run lint`), chạy 14 bài unit test (`npm test`) và build bản phát hành (`npm run build`) mỗi khi có commit hoặc Pull Request vào nhánh `main` và `develop`.

---

## 7. Bảo mật & Tuân thủ Nghị định 13/2023/NĐ-CP

Hệ thống được thiết kế tuân thủ nghiêm ngặt **Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân (PDPD)**:
1. **Ghi nhận sự đồng ý (Consent)**: Bảng `customers` có trường `consent_obtained` và `consent_date` lưu lại thời điểm khách hàng đồng ý cho phép xử lý dữ liệu.
2. **Quyền được lãng quên / Rút lại dữ liệu**: Cung cấp cơ chế ẩn danh hóa (`anonymized_at`) và che mờ dữ liệu cá nhân (Masking SĐT và Email: `098****123`, `le***@gmail.com`) khi gửi dữ liệu sang các dịch vụ AI bên ngoài hoặc khi phân quyền cho bộ phận Marketing.
3. **Chống tấn công Brute-force**: Tự động khóa tạm tài khoản 5 phút sau 5 lần đăng nhập sai mật khẩu (bảng `login_attempts`). Thông báo lỗi chung, không tiết lộ sự tồn tại của email.
4. **Tự động đăng xuất**: Phiên làm việc tự động kết thúc sau 30 phút không có thao tác chuột hoặc bàn phím.
5. **Đổi mật khẩu lần đầu**: Tài khoản mới được cấp mật khẩu tạm và bắt buộc đổi mật khẩu (tối thiểu 8 ký tự, có cả chữ và số) ở lần đăng nhập đầu tiên.

> ⚠️ *Lưu ý pháp lý: Doanh nghiệp cần tham vấn luật sư chuyên về bảo vệ dữ liệu để hoàn thiện Biểu mẫu Thỏa thuận Đồng ý thu thập dữ liệu (Terms of Service / Privacy Policy) phù hợp với thực tế hoạt động kinh doanh.*

---

## 8. Sao lưu (Backup) & Khôi phục (Restore) Cơ sở dữ liệu

### Sao lưu tự động
Trên Supabase gói Pro, hệ thống tự động sao lưu hàng ngày (Daily Backups) với tính năng khôi phục Point-in-time Recovery (PITR).

### Sao lưu thủ công bằng Supabase CLI / pg_dump:
```bash
# 1. Sao lưu toàn bộ schema và dữ liệu
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  --clean --if-exists --quote-all-identifiers \
  -F c -f crm_backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Khôi phục dữ liệu từ file backup
pg_restore -d "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  --clean --if-exists crm_backup_20261106_190000.dump
```

---

## 9. Dự toán chi phí vận hành hạ tầng

| Dịch vụ | Gói khuyến nghị | Chi phí dự kiến hàng tháng | Mục đích |
| :--- | :--- | :--- | :--- |
| **Vercel** | Pro Plan | ~20 USD/thành viên/tháng | Hosting Frontend, CDN toàn cầu, SLA 99.99%, Preview deployments |
| **Supabase** | Pro Plan | ~25 USD/tháng | Database PostgreSQL 8GB, 100k Monthly Active Users, Sao lưu tự động, Edge Functions |
| **Google Gemini API** | Pay-as-you-go | ~5 - 15 USD/tháng (theo lượng dùng) | Xử lý AI Script, Phân tích Lead Insight và Project Enrichment |
| **Tên miền (Domain)** | Thường niên | ~10 - 15 USD/năm | Tên miền chính thức của doanh nghiệp (ví dụ: `crm.diaocvang.vn`) |
| **Tổng ước tính** | - | **~50 - 65 USD/tháng** (~1.2 - 1.6 triệu VNĐ) | Vận hành ổn định cho quy mô từ 30 - 200 nhân sự |

*Lưu ý: Gói Vercel Hobby và Supabase Free chỉ phù hợp cho mục đích chạy thử nghiệm phi thương mại. Khi đưa vào vận hành thực tế cho doanh nghiệp, bắt buộc nâng cấp lên gói Pro để tránh việc tạm ngưng dịch vụ do giới hạn tài nguyên.*

---

## 10. Xử lý sự cố thường gặp (Troubleshooting)

### 1. Kéo thẻ Lead vào cột Booking / Cọc / HĐMB nhưng không chuyển trạng thái?
- **Nguyên nhân**: Đây là cơ chế bảo vệ nghiệp vụ của hệ thống. Bạn bắt buộc phải hoàn tất form nhập thông tin giao dịch tài chính (Mã Booking, Số tiền cọc > 0, hoặc Mã hợp đồng HĐMB).
- **Cách khắc phục**: Nhập đầy đủ mã giao dịch và số tiền trong hộp thoại xác nhận hiện ra.

### 2. Bấm "Round Robin" báo lỗi không tìm thấy Sale phù hợp?
- **Nguyên nhân**: Toàn bộ Sale thuộc dự án đó đã đạt đến ngưỡng `max_leads_per_sale` (mặc định 30-50 Lead) hoặc chưa có Sale nào được gán quyền phụ trách dự án trong bảng `user_projects`.
- **Cách khắc phục**: Vào **Trung tâm Quản trị > Cấu hình Hệ thống** để nới lỏng giới hạn Lead mỗi Sale, hoặc gán thêm Sale vào dự án.

### 3. Khách hàng mới không lưu được do báo trùng số điện thoại?
- **Nguyên nhân**: Số điện thoại đã tồn tại trên hệ thống cho một khách hàng khác (hệ thống tự động phát hiện cả đầu số `098...` và `+8498...`).
- **Cách khắc phục**: Kiểm tra hồ sơ khách hàng cũ trong danh sách hoặc sử dụng tính năng tìm kiếm. Một khách hàng có thể liên kết với nhiều Lead theo các dự án khác nhau.

---

© 2026 Real Estate CRM Platform • Phát triển cho ngành Bất Động Sản Việt Nam.
