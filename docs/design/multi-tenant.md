# THIẾT KẾ KIẾN TRÚC ĐA KHÁCH THUÊ (MULTI-TENANT ARCHITECTURE DESIGN)
**Dự án:** CRM Broker Platform  
**Phiên bản thiết kế:** 1.0 (Phase 6 Architecture Design)  
**Tác giả:** Senior Full-stack Engineer kiêm Database Architect  

---

## 1. MỤC TIÊU VÀ BỐI CẢNH
Hệ thống CRM Broker được xây dựng nhằm phục vụ nhiều công ty môi giới bất động sản (Agencies / Brokerages) độc lập trên cùng một nền tảng hạ tầng, hoặc cho phép các tổng đại lý quản lý nhiều sàn phân phối thành viên mà vẫn đảm bảo:
1. **Cô lập dữ liệu tuyệt đối (Data Isolation):** Không một sàn nào có thể đọc hoặc ghi đè khách hàng, leads, giỏ hàng nội bộ hay số liệu hoa hồng của sàn khác.
2. **Chi phí vận hành tối ưu (Cost Efficiency):** Chia sẻ hạ tầng tính toán (Compute) và cơ sở dữ liệu (PostgreSQL) thông qua một cụm cơ sở dữ liệu duy nhất thay vì tạo hàng trăm instance riêng lẻ.
3. **Tuân thủ pháp lý & Bảo mật (Compliance & Security):** Tuân thủ Nghị định 13/2023/NĐ-CP và bảo vệ bí mật kinh doanh giữa các sàn đối thủ cạnh tranh trên thị trường.

---

## 2. LỰA CHỌN MÔ HÌNH KIẾN TRÚC (ARCHITECTURAL MODEL SELECTION)

### So sánh 3 mô hình Multi-tenant:

| Tiêu chí | Mô hình 1: Database-per-Tenant | Mô hình 2: Schema-per-Tenant | Mô hình 3: Shared Database, Tenant ID Column (Khuyến nghị) |
| :--- | :--- | :--- | :--- |
| **Mức độ cô lập** | Cao nhất (Vật lý riêng) | Trung bình-Cao (Schema riêng) | Logic (Cưỡng chế qua Row-Level Security) |
| **Chi phí hạ tầng** | Rất cao (Nhiều DB instance) | Trung bình (Tăng metadata DB) | Tối ưu nhất (1 cụm Supabase/PostgreSQL) |
| **Độ phức tạp migration**| Cực kỳ phức tạp (Chạy N lần) | Phức tạp (Migration N schema) | Đơn giản, đồng nhất (1 lần chạy migration) |
| **Connection Pooling** | Dễ cạn kiệt connection pool | Dễ chạm trần max connections | Tận dụng Supabase Supavisor tối đa |
| **Sao lưu / Phục hồi** | Riêng từng tenant | Khó khăn khi khôi phục lẻ | Backup toàn bộ, restore theo tenant qua Logical Dump |

> [!IMPORTANT]
> **Quyết định kiến trúc:** Chọn **Mô hình 3 (Shared Database, Tenant ID Column kết hợp PostgreSQL Row-Level Security)**.  
> Cột `organization_id` (UUID) được bổ sung trên tất cả các bảng dữ liệu nghiệp vụ (`profiles`, `leads`, `customers`, `projects`, `transactions`, `contract_installments`, `commissions`, `campaigns`, `trash_bins`).

---

## 3. CƠ CHẾ BẢO MẬT VÀ PHÂN QUYỀN RLS (ROW-LEVEL SECURITY)

### 3.1. Nhận diện Tenant từ JWT Claim
Khi người dùng đăng nhập qua Supabase Auth, JWT chứa claim `app_metadata.organization_id`:
```json
{
  "sub": "user-uuid-123",
  "email": "sale@agency-a.vn",
  "app_metadata": {
    "role": "sale_agent",
    "organization_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

### 3.2. Hàm tiện ích Server-side
```sql
CREATE OR REPLACE FUNCTION auth.current_org_id() 
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### 3.3. Áp dụng chính sách RLS chuẩn mực
```sql
-- Ví dụ trên bảng leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_leads_tenant_isolation ON public.leads
    FOR ALL
    USING (
        organization_id = auth.current_org_id()
    )
    WITH CHECK (
        organization_id = auth.current_org_id()
    );
```

---

## 4. DỮ LIỆU CHIA SẺ VS DỮ LIỆU CÔ LẬP (SHARED VS ISOLATED DATA)

1. **Dữ liệu cô lập tuyệt đối (`organization_id` bắt buộc):**
   - Khách hàng (`customers`, `customer_consents`).
   - Khách tiềm năng & Lịch hẹn (`leads`, `lead_appointments`).
   - Hợp đồng, Đợt thanh toán, Sổ cái hoa hồng (`transactions`, `contract_installments`, `commissions`).
   - Cơ cấu nhân sự nội bộ (`departments`, `teams`, `profiles`, `personnel_events`).
   - Chiến dịch & Chi phí Marketing (`campaigns`, `campaign_daily_costs`).
   - Thùng rác & Lịch sử audit (`trash_bins`, `audit_logs`).

2. **Dữ liệu chia sẻ toàn hệ thống (`organization_id IS NULL`):**
   - Danh mục dự án thị trường dùng chung (thông tin dự án master, vị trí, chủ đầu tư).
   - Từ điển nguồn lead chuẩn (`lead_sources`).
   - Bảng lý do mất lead chuẩn (`lead_loss_reasons`).
   - Bảng cấu hình chuyển trạng thái chuẩn (`lead_status_transitions`).

---

## 5. KẾ HOẠCH DI TRÚ KHÔNG GIÁN ĐOẠN (ZERO-DOWNTIME MIGRATION PLAN)

1. **Bước 1 (Additive Schema):**
   - Tạo bảng `organizations (id, name, domain, status, plan, created_at)`.
   - Bổ sung cột `organization_id UUID REFERENCES organizations(id)` trên tất cả các bảng nghiệp vụ (cho phép `NULL` tạm thời).
2. **Bước 2 (Default Tenant Backfill):**
   - Tạo bản ghi Default Tenant `00000000-0000-0000-0000-000000000001` (e.g., "Sàn BĐS Trung Tâm").
   - Chạy script backfill: `UPDATE leads SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;` (lặp lại cho các bảng khác).
3. **Bước 3 (Constraint & Index):**
   - Đặt `NOT NULL` trên cột `organization_id`.
   - Tạo Composite Index: `CREATE INDEX idx_leads_org_status ON public.leads(organization_id, status);`.
4. **Bước 4 (RLS Activation):**
   - Kích hoạt RLS kèm `auth.current_org_id()`.
   - Cập nhật Supabase Auth Hook để tự động đính kèm `organization_id` vào JWT khi người dùng đăng nhập.

---

## 6. ĐÁNH GIÁ RỦI RO & BIỆN PHÁP DỰ PHÒNG (RISK & MITIGATION)

| Rủi ro tiềm ẩn | Mức độ | Biện pháp kiểm soát & Khắc phục |
| :--- | :--- | :--- |
| **Lọt dữ liệu do thiếu WHERE clause** | Nghiêm trọng | RLS ở tầng PostgreSQL chặn ngay lập tức mọi truy vấn thiếu tenant context. UI/Backend không thể vô tình query vượt quyền. |
| **Connection Pooling cạn kiệt** | Trung bình | Dùng chung 1 DB pool qua Supabase Supavisor; cấu hình transaction pooling tối ưu. |
| **Chậm câu lệnh (Performance Degradation)** | Thấp-Trung bình | Mọi Index quan trọng đều có `organization_id` là prefix đầu tiên trong composite index. |
| **Xung đột mã giao dịch / mã khách** | Thấp | Chuyển mọi Unique Constraint thành Composite Unique: `UNIQUE(organization_id, code)`. |
