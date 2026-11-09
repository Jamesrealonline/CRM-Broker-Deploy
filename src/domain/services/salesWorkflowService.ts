// ========================================================
// REAL ESTATE CRM - SALES WORKFLOW SERVICE (PHASE 4)
// Công cụ bán hàng, Lịch hẹn GPS/QR, Tính vay, Báo giá Snapshot,
// Webhook chống giả mạo, Nhập CSV theo lô hoàn tác & Merge khách hàng
// ========================================================

import { 
  MortgageCalculationParams, 
  MortgageCalculationResult, 
  MortgageScheduleRow,
  Quotation,
  ImportBatch,
  CustomerMergeRecord,
  InteractionTimelineItem,
  AppointmentCheckInResult,
  LeadAppointment,
  Lead,
  UserProfile
} from '@/domain/types';
import { normalizePhone } from '@/lib/utils';
import { assertRateLimit } from '@/lib/rateLimiter';

const STORAGE_KEY_QUOTATIONS = 'crm_quotations';
const STORAGE_KEY_IMPORT_BATCHES = 'crm_import_batches';
const STORAGE_KEY_CUSTOMER_MERGES = 'crm_customer_merges';
const STORAGE_KEY_TIMELINE = 'crm_interaction_timeline';
const STORAGE_KEY_APPOINTMENTS = 'crm_lead_appointments';
const STORAGE_KEY_LEADS = 'crm_leads';

export class SalesWorkflowService {
  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEY_QUOTATIONS)) {
      localStorage.setItem(STORAGE_KEY_QUOTATIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_IMPORT_BATCHES)) {
      localStorage.setItem(STORAGE_KEY_IMPORT_BATCHES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CUSTOMER_MERGES)) {
      localStorage.setItem(STORAGE_KEY_CUSTOMER_MERGES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_TIMELINE)) {
      localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify([]));
    }
  }

  // ========================================================
  // 1. MÁY TÍNH VAY & LỊCH TRẢ NỢ (MORTGAGE CALCULATOR)
  // ========================================================
  calculateMortgageSchedule(params: MortgageCalculationParams): MortgageCalculationResult {
    const {
      loanAmount,
      loanTermMonths,
      preferentialRateYear,
      preferentialMonths,
      floatingRateYear,
      gracePeriodMonths = 0,
    } = params;

    if (loanAmount <= 0) throw new Error('invalid_loan_amount: Số tiền vay phải lớn hơn 0.');
    if (loanTermMonths <= 0) throw new Error('invalid_loan_term: Thời hạn vay phải lớn hơn 0.');
    if (gracePeriodMonths >= loanTermMonths) {
      throw new Error('invalid_grace_period: Thời gian ân hạn nợ gốc phải nhỏ hơn thời hạn vay.');
    }

    const principalRepaymentMonths = loanTermMonths - gracePeriodMonths;
    const monthlyPrincipalPayment = Math.round(loanAmount / principalRepaymentMonths);

    let currentBalance = loanAmount;
    let totalInterestPaid = 0;
    let monthlyPaymentMax = 0;
    const schedule: MortgageScheduleRow[] = [];

    for (let month = 1; month <= loanTermMonths; month++) {
      const isGrace = month <= gracePeriodMonths;
      const isPreferential = month <= preferentialMonths;
      const annualRate = isPreferential ? preferentialRateYear : floatingRateYear;
      const monthlyRate = annualRate / 100 / 12;

      const interestPayment = Math.round(currentBalance * monthlyRate);
      totalInterestPaid += interestPayment;

      let principalPayment = 0;
      if (!isGrace) {
        // Tháng cuối cùng thanh toán toàn bộ số dư còn lại để tránh lệch làm tròn
        if (month === loanTermMonths) {
          principalPayment = currentBalance;
        } else {
          principalPayment = Math.min(monthlyPrincipalPayment, currentBalance);
        }
      }

      const totalPayment = principalPayment + interestPayment;
      if (totalPayment > monthlyPaymentMax) {
        monthlyPaymentMax = totalPayment;
      }

      const endingBalance = Math.max(0, currentBalance - principalPayment);

      schedule.push({
        month,
        beginningBalance: currentBalance,
        principalPayment,
        interestPayment,
        totalPayment,
        endingBalance,
        isGracePeriod: isGrace,
        isPreferentialRate: isPreferential,
        interestRate: annualRate,
      });

      currentBalance = endingBalance;
    }

    return {
      monthlyPaymentFirstMonth: schedule[0]?.totalPayment || 0,
      monthlyPaymentMax,
      totalInterestPaid,
      totalPrincipalAndInterest: loanAmount + totalInterestPaid,
      schedule,
    };
  }

  // ========================================================
  // 2. PHIẾU BÁO GIÁ SNAPSHOT (KHÔNG LỘ HOA HỒNG)
  // ========================================================
  async createQuotation(payload: {
    projectId: string;
    projectName?: string;
    unitCode: string;
    dealValue: number;
    discountAmount?: number;
    validDays?: number;
    paymentPlanSummary?: Record<string, any>;
    leadId?: string;
    currentUser: UserProfile;
  }): Promise<Quotation> {
    this.ensureInitialized();

    const discount = payload.discountAmount || 0;
    if (payload.dealValue <= 0) throw new Error('invalid_value: Giá niêm yết phải lớn hơn 0.');
    if (discount < 0 || discount >= payload.dealValue) {
      throw new Error('invalid_discount: Mức chiết khấu không hợp lệ.');
    }

    const finalPrice = payload.dealValue - discount;
    const validDays = payload.validDays || 7;
    const now = Date.now();
    const validUntil = new Date(now + validDays * 86400000).toISOString();
    const quotationCode = `BG-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Tạo snapshot báo giá độc lập, TUYỆT ĐỐI KHÔNG chứa hoa hồng
    const quotation: Quotation = {
      id: crypto.randomUUID(),
      code: quotationCode,
      lead_id: payload.leadId,
      project_id: payload.projectId,
      project_name: payload.projectName,
      unit_code: payload.unitCode.trim().toUpperCase(),
      deal_value: payload.dealValue,
      discount_amount: discount,
      final_price: finalPrice,
      payment_plan_summary: payload.paymentPlanSummary || {
        dot_1: Math.round(finalPrice * 0.1),
        dot_2: Math.round(finalPrice * 0.2),
        dot_nhan_nha: Math.round(finalPrice * 0.25),
      },
      valid_until: validUntil,
      created_by: payload.currentUser.id,
      created_by_name: payload.currentUser.full_name,
      status: 'sent',
      created_at: new Date().toISOString(),
    };

    const quotations: Quotation[] = JSON.parse(localStorage.getItem(STORAGE_KEY_QUOTATIONS) || '[]');
    quotations.unshift(quotation);
    localStorage.setItem(STORAGE_KEY_QUOTATIONS, JSON.stringify(quotations));

    return quotation;
  }

  async getQuotations(leadId?: string): Promise<Quotation[]> {
    this.ensureInitialized();
    const quotations: Quotation[] = JSON.parse(localStorage.getItem(STORAGE_KEY_QUOTATIONS) || '[]');
    return leadId ? quotations.filter(q => q.lead_id === leadId) : quotations;
  }

  // ========================================================
  // 3. CHECK-IN LỊCH HẸN VỚI GPS GEOFENCE & QR DỰ ÁN
  // ========================================================
  async checkInAppointment(payload: {
    appointmentId: string;
    projectCoords?: { lat: number; lng: number };
    userCoords?: { lat: number; lng: number };
    qrCode?: string;
    expectedQrCode?: string;
    currentUser: UserProfile;
  }): Promise<AppointmentCheckInResult> {
    const rawAppts = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
    const appointments: LeadAppointment[] = rawAppts ? JSON.parse(rawAppts) : [];
    const appt = appointments.find(a => a.id === payload.appointmentId);
    if (!appt) throw new Error('appointment_not_found: Lịch hẹn không tồn tại.');

    let isWithinGeofence = true;
    let distanceMeters: number | undefined;
    let flaggedOutside = false;
    let qrVerified = false;

    // 1. Kiểm tra QR Code
    if (payload.qrCode && payload.expectedQrCode) {
      qrVerified = payload.qrCode.trim() === payload.expectedQrCode.trim();
    }

    // 2. Tính khoảng cách Haversine GPS
    if (payload.projectCoords && payload.userCoords) {
      distanceMeters = this.calculateHaversineDistance(
        payload.projectCoords.lat,
        payload.projectCoords.lng,
        payload.userCoords.lat,
        payload.userCoords.lng
      );

      // Bán kính chuẩn geofence: 500m
      if (distanceMeters > 500) {
        isWithinGeofence = false;
        flaggedOutside = true;
      }
    }

    // Cập nhật trạng thái lịch hẹn
    appt.status = 'confirmed';
    const flags = new Set(appt.flags || []);
    if (flaggedOutside) flags.add('outside_geofence');
    if (qrVerified) flags.add('qr_verified');
    appt.flags = Array.from(flags);
    appt.updated_at = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(appointments));

    return {
      success: true,
      isWithinGeofence,
      distanceMeters,
      qrVerified,
      flaggedOutside,
      appointment: appt,
    };
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Bán kính Trái Đất (mét)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  // ========================================================
  // 4. WEBHOOK NHẬN LEAD TỰ ĐỘNG CHỐNG GIẢ MẠO
  // ========================================================
  async processLeadWebhook(payload: {
    source: string;
    body: {
      customer_name: string;
      phone: string;
      email?: string;
      project_id: string;
      utm_source?: string;
      utm_campaign?: string;
      notes?: string;
    };
    signature?: string;
    secretKey: string;
  }): Promise<{ success: boolean; leadId?: string; isDuplicatePrevented?: boolean }> {
    // 1. Xác thực chữ ký số (Giả lập kiểm tra HMAC token / secret)
    const expectedSignature = `sig_${payload.secretKey}`;
    if (!payload.signature || payload.signature !== expectedSignature) {
      throw new Error('invalid_signature: Chữ ký số Webhook không hợp lệ!');
    }

    const cleanPhone = normalizePhone(payload.body.phone || '');
    if (cleanPhone.length < 9) {
      throw new Error('invalid_phone: Số điện thoại không hợp lệ.');
    }

    const rawLeads = localStorage.getItem(STORAGE_KEY_LEADS);
    const leads: Lead[] = rawLeads ? JSON.parse(rawLeads) : [];

    // 2. Chống tạo trùng lặp lead cho cùng một khách hàng trong cùng dự án
    const existingOpenLead = leads.find(l => 
      normalizePhone(l.customer_phone || '') === cleanPhone &&
      l.project_id === payload.body.project_id &&
      !['lost', 'invalid', 'contract'].includes(l.status)
    );

    if (existingOpenLead) {
      // Cập nhật thêm ghi chú/UTM thay vì nhân bản bản ghi
      existingOpenLead.notes = `${existingOpenLead.notes || ''}\n[Webhook ${payload.source}] Khách quan tâm lại qua chiến dịch ${payload.body.utm_campaign || ''}`.trim();
      existingOpenLead.last_care_updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
      return { success: true, leadId: existingOpenLead.id, isDuplicatePrevented: true };
    }

    // 3. Tạo lead mới và đưa vào Pool hoặc phân bổ
    const newLead: Lead = {
      id: crypto.randomUUID(),
      customer_id: crypto.randomUUID(),
      customer_name: payload.body.customer_name,
      customer_phone: payload.body.phone,
      customer_email: payload.body.email,
      project_id: payload.body.project_id,
      project_name: 'Dự án từ Webhook',
      status: 'new',
      assigned_name: 'Kho lead chung',
      source_name: payload.source,
      source_detail: `${payload.body.utm_source || payload.source} - ${payload.body.utm_campaign || ''}`.trim(),
      created_via: 'webhook',
      lead_score: 80,
      purpose: 'investment',
      notes: payload.body.notes || `Thu thập từ ${payload.source}`,
      created_at: new Date().toISOString(),
      last_care_updated_at: new Date().toISOString(),
    };

    leads.unshift(newLead);
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    return { success: true, leadId: newLead.id, isDuplicatePrevented: false };
  }

  // ========================================================
  // 5. NHẬP LEAD CSV THEO LÔ VÀ HOÀN TÁC (BATCH IMPORT & REVERT)
  // ========================================================
  async importLeadsBatch(payload: {
    fileName: string;
    projectId: string;
    rows: Array<{ name: string; phone: string; email?: string; notes?: string }>;
    currentUser: UserProfile;
  }): Promise<{ batch: ImportBatch; importedCount: number; errorCount: number }> {
    this.ensureInitialized();
    assertRateLimit(payload.currentUser.id, 'imports/batch', 10);

    const batchId = crypto.randomUUID();
    const rawLeads = localStorage.getItem(STORAGE_KEY_LEADS);
    const leads: Lead[] = rawLeads ? JSON.parse(rawLeads) : [];

    let importedCount = 0;
    let errorCount = 0;

    for (const row of payload.rows) {
      const cleanPhone = normalizePhone(row.phone || '');
      if (cleanPhone.length < 9 || !row.name?.trim()) {
        errorCount++;
        continue;
      }

      const newLead: Lead = {
        id: crypto.randomUUID(),
        customer_id: crypto.randomUUID(),
        customer_name: row.name.trim(),
        customer_phone: cleanPhone,
        customer_email: row.email,
        project_id: payload.projectId,
        project_name: 'Dự án theo lô CSV',
        status: 'new',
        assigned_name: 'Kho lead chung',
        source_name: 'Nhập Excel/CSV',
        created_via: 'batch_import',
        import_batch_id: batchId,
        lead_score: 75,
        purpose: 'residence',
        notes: row.notes || `Nhập từ file ${payload.fileName}`,
        created_at: new Date().toISOString(),
        last_care_updated_at: new Date().toISOString(),
      };

      leads.unshift(newLead);
      importedCount++;
    }

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    const batch: ImportBatch = {
      id: batchId,
      file_name: payload.fileName,
      total_rows: payload.rows.length,
      success_rows: importedCount,
      error_rows: errorCount,
      status: 'imported',
      created_by: payload.currentUser.id,
      created_at: new Date().toISOString(),
    };

    const batches: ImportBatch[] = JSON.parse(localStorage.getItem(STORAGE_KEY_IMPORT_BATCHES) || '[]');
    batches.unshift(batch);
    localStorage.setItem(STORAGE_KEY_IMPORT_BATCHES, JSON.stringify(batches));

    return { batch, importedCount, errorCount };
  }

  async revertImportBatch(batchId: string, currentUser: UserProfile): Promise<{ success: boolean; revertedCount: number }> {
    this.ensureInitialized();
    const batches: ImportBatch[] = JSON.parse(localStorage.getItem(STORAGE_KEY_IMPORT_BATCHES) || '[]');
    const batch = batches.find(b => b.id === batchId);
    if (!batch) throw new Error('batch_not_found: Không tìm thấy lô nhập dữ liệu.');
    if (batch.status === 'reverted') throw new Error('already_reverted: Lô nhập này đã được hoàn tác trước đó.');

    const rawLeads = localStorage.getItem(STORAGE_KEY_LEADS);
    let leads: Lead[] = rawLeads ? JSON.parse(rawLeads) : [];

    const initialCount = leads.length;
    // Xóa các lead được nhập từ batch này
    leads = leads.filter(l => (l as any).import_batch_id !== batchId);
    const revertedCount = initialCount - leads.length;

    batch.status = 'reverted';
    batch.reverted_at = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    localStorage.setItem(STORAGE_KEY_IMPORT_BATCHES, JSON.stringify(batches));

    return { success: true, revertedCount };
  }

  // ========================================================
  // 6. HỢP NHẤT KHÁCH HÀNG (CUSTOMER MERGE & UNMERGE)
  // ========================================================
  async mergeCustomers(payload: {
    primaryCustomerId: string;
    mergedCustomerId: string;
    currentUser: UserProfile;
  }): Promise<CustomerMergeRecord> {
    const isManager = ['admin', 'director', 'sales_manager'].includes(payload.currentUser.role);
    if (!isManager) {
      throw new Error('forbidden: Chỉ Quản lý sàn hoặc Admin mới có quyền hợp nhất khách hàng!');
    }
    if (payload.primaryCustomerId === payload.mergedCustomerId) {
      throw new Error('same_customer: Không thể hợp nhất một khách hàng với chính mình.');
    }

    this.ensureInitialized();
    const rawLeads = localStorage.getItem(STORAGE_KEY_LEADS);
    const leads: Lead[] = rawLeads ? JSON.parse(rawLeads) : [];

    // Lưu snapshot các lead bị chuyển để phục vụ hoàn tác
    const leadsToTransfer = leads.filter(l => l.customer_id === payload.mergedCustomerId);
    const auditSnapshot = {
      transferredLeadIds: leadsToTransfer.map(l => l.id),
      previousCustomerId: payload.mergedCustomerId,
    };

    // Chuyển quyền sở hữu khách hàng của các lead sang primaryCustomerId
    for (const lead of leads) {
      if (lead.customer_id === payload.mergedCustomerId) {
        lead.customer_id = payload.primaryCustomerId;
        lead.notes = `${lead.notes || ''}\n[Hợp nhất khách hàng] Chuyển từ ID ${payload.mergedCustomerId} sang ${payload.primaryCustomerId}`.trim();
        lead.updated_at = new Date().toISOString();
      }
    }

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    const mergeRecord: CustomerMergeRecord = {
      id: crypto.randomUUID(),
      primary_customer_id: payload.primaryCustomerId,
      merged_customer_id: payload.mergedCustomerId,
      merged_by: payload.currentUser.id,
      merged_at: new Date().toISOString(),
      status: 'active',
      audit_snapshot: auditSnapshot,
    };

    const merges: CustomerMergeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOMER_MERGES) || '[]');
    merges.unshift(mergeRecord);
    localStorage.setItem(STORAGE_KEY_CUSTOMER_MERGES, JSON.stringify(merges));

    return mergeRecord;
  }

  async unmergeCustomer(mergeId: string, currentUser: UserProfile): Promise<{ success: boolean }> {
    const isManager = ['admin', 'director', 'sales_manager'].includes(currentUser.role);
    if (!isManager) {
      throw new Error('forbidden: Chỉ Quản lý sàn hoặc Admin mới có quyền hoàn tác hợp nhất khách hàng!');
    }

    this.ensureInitialized();
    const merges: CustomerMergeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOMER_MERGES) || '[]');
    const merge = merges.find(m => m.id === mergeId);
    if (!merge) throw new Error('merge_not_found: Không tìm thấy bản ghi hợp nhất.');
    if (merge.status === 'reverted') throw new Error('already_reverted: Yêu cầu này đã được hoàn tác trước đó.');

    const rawLeads = localStorage.getItem(STORAGE_KEY_LEADS);
    const leads: Lead[] = rawLeads ? JSON.parse(rawLeads) : [];

    const transferredIds: string[] = merge.audit_snapshot?.transferredLeadIds || [];
    for (const lead of leads) {
      if (transferredIds.includes(lead.id)) {
        lead.customer_id = merge.merged_customer_id;
        lead.notes = `${lead.notes || ''}\n[Hoàn tác hợp nhất] Phục hồi về ID khách hàng cũ ${merge.merged_customer_id}`.trim();
        lead.updated_at = new Date().toISOString();
      }
    }

    merge.status = 'reverted';
    merge.reverted_at = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    localStorage.setItem(STORAGE_KEY_CUSTOMER_MERGES, JSON.stringify(merges));

    return { success: true };
  }
}

export const salesWorkflowService = new SalesWorkflowService();
