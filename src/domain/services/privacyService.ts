// ========================================================
// REAL ESTATE CRM - PRIVACY & DATA PROTECTION SERVICE (PHASE 6)
// Tuân thủ Nghị định 13/2023/NĐ-CP & GDPR:
// Xuất gói dữ liệu khách hàng (Data Portability),
// Ẩn danh hóa an toàn (Anonymization) bảo toàn sổ cái hợp đồng & hoa hồng,
// Quản lý sự đồng thuận (Consent Management)
// ========================================================

import { 
  Customer, 
  CustomerConsent, 
  PrivacyRequest, 
  PrivacyExportPackage, 
  UserProfile, 
  Lead, 
  Transaction,
  InteractionTimelineItem
} from '@/domain/types';

const STORAGE_KEY_CUSTOMERS = 'crm_customers';
const STORAGE_KEY_LEADS = 'crm_leads';
const STORAGE_KEY_CONTRACTS = 'crm_contracts';
const STORAGE_KEY_CONSENTS = 'crm_customer_consents';
const STORAGE_KEY_PRIVACY_REQUESTS = 'crm_privacy_requests';
const STORAGE_KEY_TIMELINE = 'crm_interaction_timeline';

export class PrivacyService {
  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEY_PRIVACY_REQUESTS)) {
      localStorage.setItem(STORAGE_KEY_PRIVACY_REQUESTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CONSENTS)) {
      localStorage.setItem(STORAGE_KEY_CONSENTS, JSON.stringify([]));
    }
  }

  // ========================================================
  // 1. XUẤT TOÀN BỘ DỮ LIỆU CÁ NHÂN (DATA PORTABILITY - NĐ 13)
  // ========================================================
  async requestDataExport(customerId: string, currentUser: UserProfile): Promise<PrivacyExportPackage> {
    if (!['admin', 'director', 'sales_manager', 'compliance_officer'].includes(currentUser.role)) {
      throw new Error('Chỉ Quản lý, Giám đốc hoặc Admin mới có quyền xuất hồ sơ dữ liệu cá nhân theo NĐ 13.');
    }

    const customers: Customer[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOMERS) || '[]');
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      throw new Error(`Không tìm thấy khách hàng với ID: ${customerId}`);
    }

    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const customerLeads = leads.filter(l => l.customer_id === customerId);

    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
    const customerLeadIds = new Set(customerLeads.map(l => l.id));
    const customerContracts = contracts.filter(c => (c.customer_id === customerId) || (c.lead_id && customerLeadIds.has(c.lead_id)));

    const timeline: InteractionTimelineItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMELINE) || '[]');
    const customerInteractions = timeline.filter(t => t.customer_id === customerId || customerLeadIds.has(t.lead_id));

    // Ghi nhận yêu cầu xuất dữ liệu vào sổ lưu trữ
    this.ensureInitialized();
    const requests: PrivacyRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PRIVACY_REQUESTS) || '[]');
    const newRequest: PrivacyRequest = {
      id: `priv-exp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      customer_id: customerId,
      request_type: 'export',
      status: 'completed',
      reason: 'Yêu cầu trích xuất dữ liệu cá nhân Nghị định 13/2023/NĐ-CP',
      requested_by: currentUser.id,
      approved_by: currentUser.id,
      approved_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    requests.push(newRequest);
    localStorage.setItem(STORAGE_KEY_PRIVACY_REQUESTS, JSON.stringify(requests));

    return {
      exportedAt: new Date().toISOString(),
      legalBasis: 'Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân',
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        identity_card: customer.identity_card,
        address: customer.address,
        created_at: customer.created_at
      },
      leads: customerLeads.map(l => ({
        id: l.id,
        status: l.status,
        budget_min: l.budget_min,
        budget_max: l.budget_max,
        source: l.source_id,
        created_at: l.created_at
      })),
      contracts: customerContracts.map(c => ({
        id: c.id,
        contract_code: c.contract_code,
        status: c.status,
        deal_value: c.deal_value,
        sign_date: c.sign_date || c.contract_date
      })),
      interactions: customerInteractions.map(i => ({
        id: i.id,
        type: i.type || i.channel,
        notes: i.content,
        created_at: i.created_at
      }))
    };
  }

  // ========================================================
  // 2. ẨN DANH HÓA DỮ LIỆU AN TOÀN (SAFE ANONYMIZATION)
  // ========================================================
  async requestAnonymization(
    customerId: string, 
    reason: string, 
    currentUser: UserProfile
  ): Promise<{ success: boolean; customerId: string; anonymizedAt: string }> {
    if (!['admin', 'director'].includes(currentUser.role)) {
      throw new Error('Chỉ Admin hoặc Giám đốc mới có thẩm quyền thực thi ẩn danh hóa dữ liệu khách hàng.');
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('Cần cung cấp lý do hợp lệ khi yêu cầu xóa/ẩn danh hóa dữ liệu.');
    }

    const customers: Customer[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOMERS) || '[]');
    const customerIndex = customers.findIndex(c => c.id === customerId);
    if (customerIndex === -1) {
      throw new Error(`Không tìm thấy khách hàng với ID: ${customerId}`);
    }

    const anonymizedAt = new Date().toISOString();
    const shortId = customerId.substring(0, 6);

    // 1. Cập nhật bảng Customers với thông tin đã ẩn danh (không xóa bản ghi)
    customers[customerIndex] = {
      ...customers[customerIndex],
      full_name: `Khách hàng ẩn danh #${shortId}`,
      phone: '0000000000',
      phone_normalized: '0000000000',
      email: `anonymized_${shortId}@privacy.local`,
      identity_card: undefined,
      encrypted_id_number: undefined,
      address: undefined,
      anonymized_at: anonymizedAt,
      do_not_contact: true,
      consent_obtained: false
    };
    localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));

    // 2. Ẩn danh hóa thông tin liên quan trong crm_leads
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    let leadsUpdated = false;
    for (let i = 0; i < leads.length; i++) {
      if (leads[i].customer_id === customerId) {
        leads[i].customer_name = `Khách hàng ẩn danh #${shortId}`;
        leads[i].customer_phone = '0000000000';
        leads[i].customer_email = `anonymized_${shortId}@privacy.local`;
        leadsUpdated = true;
      }
    }
    if (leadsUpdated) {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    }

    // 3. QUAN TRỌNG: Không xóa crm_contracts, chỉ cập nhật tên đại diện nếu cần
    // Hợp đồng, đợt thanh toán và hoa hồng được giữ nguyên vẹn để phục vụ thanh tra tài chính
    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
    let contractsUpdated = false;
    for (let i = 0; i < contracts.length; i++) {
      if (contracts[i].customer_id === customerId) {
        contracts[i].customer_name = `Khách hàng ẩn danh #${shortId}`;
        contractsUpdated = true;
      }
    }
    if (contractsUpdated) {
      localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(contracts));
    }

    // 4. Ghi nhận log yêu cầu quyền riêng tư
    this.ensureInitialized();
    const requests: PrivacyRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PRIVACY_REQUESTS) || '[]');
    const newRequest: PrivacyRequest = {
      id: `priv-anon-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      customer_id: customerId,
      request_type: 'anonymize',
      status: 'completed',
      reason,
      requested_by: currentUser.id,
      approved_by: currentUser.id,
      approved_at: anonymizedAt,
      completed_at: anonymizedAt,
      created_at: anonymizedAt
    };
    requests.push(newRequest);
    localStorage.setItem(STORAGE_KEY_PRIVACY_REQUESTS, JSON.stringify(requests));

    return {
      success: true,
      customerId,
      anonymizedAt
    };
  }

  // ========================================================
  // 3. QUẢN LÝ SỰ ĐỒNG THUẬN (CONSENT MANAGEMENT)
  // ========================================================
  updateConsent(
    customerId: string, 
    purpose: 'marketing' | 'consultation' | 'contract', 
    channel: 'phone' | 'email' | 'zalo' | 'sms',
    isRevoked: boolean,
    revokedReason?: string
  ): CustomerConsent {
    this.ensureInitialized();
    const consents: CustomerConsent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONSENTS) || '[]');

    const newConsent: CustomerConsent = {
      id: `consent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      customer_id: customerId,
      purpose,
      channel,
      obtained_at: new Date().toISOString(),
      is_revoked: isRevoked,
      revoked_at: isRevoked ? new Date().toISOString() : undefined,
      revoked_reason: revokedReason,
      created_at: new Date().toISOString()
    };

    consents.push(newConsent);
    localStorage.setItem(STORAGE_KEY_CONSENTS, JSON.stringify(consents));

    // Cập nhật trạng thái do_not_contact trên khách hàng nếu bị rút lại
    const customers: Customer[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOMERS) || '[]');
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx >= 0) {
      if (isRevoked && purpose === 'marketing') {
        customers[idx].do_not_contact = true;
      } else if (!isRevoked) {
        customers[idx].consent_obtained = true;
        customers[idx].consent_date = new Date().toISOString();
      }
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
    }

    return newConsent;
  }

  getPrivacyRequests(customerId?: string): PrivacyRequest[] {
    this.ensureInitialized();
    const requests: PrivacyRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PRIVACY_REQUESTS) || '[]');
    if (customerId) {
      return requests.filter(r => r.customer_id === customerId);
    }
    return requests;
  }
}

export const privacyService = new PrivacyService();
