// ========================================================
// REAL ESTATE CRM - LEAD REPOSITORY
// Truy cập dữ liệu Leads, Transactions, Round Robin RPC, Audit
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { 
  Lead, 
  LeadStatus, 
  Transaction, 
  LeadActivity, 
  LeadStatusHistory, 
  UserProfile,
  LeadAssignmentHistory,
  AssignmentReason,
  CustomerConsent,
  LeadSource
} from '@/domain/types';
import { normalizePhone } from '@/lib/utils';
import { maskPhone, maskName, computePhoneHash } from '@/lib/masking';
import { assertNoMockPIIInProduction } from '@/lib/storageGuard';
import { INITIAL_PROJECTS, INITIAL_AGENCIES, INITIAL_TEAMS, INITIAL_LEAD_SOURCES } from '../mockData';
import { notificationService } from '@/domain/services/notificationService';
import { autoTransferService } from '@/domain/services/autoTransferService';
import { findTransitionRule, STOP_CLOCK_STATUSES } from '@/domain/leadTransitions';
import { authRepository } from './authRepository';
import { assertRateLimit } from '@/lib/rateLimiter';
import { checkOrStartIdempotency, completeIdempotency } from '@/lib/idempotency';

const STORAGE_KEY_LEADS = 'crm_leads';
const STORAGE_KEY_CUSTOMERS = 'crm_customers';
const STORAGE_KEY_TRANSACTIONS = 'crm_transactions';
const STORAGE_KEY_ACTIVITIES = 'crm_activities';
const STORAGE_KEY_STATUS_HISTORY = 'crm_status_history';
const STORAGE_KEY_ASSIGNMENTS = 'crm_assignments';
const STORAGE_KEY_ASSIGNMENT_HISTORY = 'crm_lead_assignment_history';
const STORAGE_KEY_CONSENTS = 'crm_customer_consents';
const STORAGE_KEY_SOURCES = 'crm_lead_sources';

export interface LeadFilters {
  search?: string;
  projectId?: string;
  agencyId?: string;
  teamId?: string;
  assignedTo?: string;
  status?: LeadStatus;
  includeSample?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export class LeadRepository {
  // 0. NGUỒN KHÁCH HÀNG (LEAD SOURCES)
  async getLeadSources(): Promise<LeadSource[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as LeadSource[];
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY_SOURCES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SOURCES, JSON.stringify(INITIAL_LEAD_SOURCES));
      return INITIAL_LEAD_SOURCES;
    }
    try {
      const parsed = JSON.parse(raw) as LeadSource[];
      return parsed.length > 0 
        ? parsed.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99) || a.name.localeCompare(b.name))
        : INITIAL_LEAD_SOURCES;
    } catch {
      return INITIAL_LEAD_SOURCES;
    }
  }

  async createLeadSource(name: string, code?: string, requiresDetail: boolean = false): Promise<LeadSource> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tên nguồn lead không được để trống.');
    }
    const generatedCode = code?.trim() || trimmed
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('lead_sources')
        .insert({
          name: trimmed,
          code: generatedCode,
          is_active: true,
          requires_detail: requiresDetail,
          sort_order: 99,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as LeadSource;
    }

    const sources = await this.getLeadSources();
    const existing = sources.find(s => s.code === generatedCode || s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }

    const newSource: LeadSource = {
      id: `src-${Date.now()}`,
      code: generatedCode,
      name: trimmed,
      is_active: true,
      requires_detail: requiresDetail,
      sort_order: sources.length + 1,
      created_at: new Date().toISOString(),
    };
    sources.push(newSource);
    localStorage.setItem(STORAGE_KEY_SOURCES, JSON.stringify(sources));
    return newSource;
  }

  // 1. LẤY DANH SÁCH LEADS (ÁP DỤNG RLS PHÂN QUYỀN VAI TRÒ & CHE PII CHO MARKETING)
  async getLeads(filters: LeadFilters, currentUser: UserProfile): Promise<{ leads: Lead[]; total: number }> {
    if (isLiveSupabaseConfigured) {
      if (currentUser.role === 'marketing_manager') {
        let query = supabase.from('marketing_leads_view').select('*', { count: 'exact' });
        if (filters.projectId) query = query.eq('project_id', filters.projectId);
        if (filters.status) query = query.eq('status', filters.status);
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw new Error(error.message);

        const mapped = (data || []).map((item: any) => ({
          id: item.lead_id,
          customer_id: item.customer_id,
          customer_name: item.masked_name,
          customer_phone: item.masked_phone,
          customer_phone_hash: item.phone_hash,
          project_id: item.project_id,
          project_name: item.project_name,
          status: item.status,
          budget_min: item.budget_min,
          budget_max: item.budget_max,
          purpose: item.purpose,
          do_not_contact: item.do_not_contact,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        return { leads: mapped as Lead[], total: count || 0 };
      }

      let query = supabase.from('leads').select(`
        *,
        customer:customers(full_name, phone, email, do_not_contact, phone_hash),
        project:projects(name),
        assigned_user:profiles!leads_assigned_to_fkey(full_name),
        agency:agencies(name),
        team:teams(name),
        source:lead_sources(name)
      `, { count: 'exact' });

      // Phân quyền phía Client filter bảo vệ thêm (RLS ở DB đã chặn chắc chắn)
      if (currentUser.role === 'sale_agent') {
        query = query.eq('assigned_to', currentUser.id);
      } else if (currentUser.role === 'team_leader' && currentUser.team_id) {
        query = query.eq('team_id', currentUser.team_id);
      } else if (currentUser.role === 'sales_manager' && currentUser.agency_id) {
        query = query.eq('agency_id', currentUser.agency_id);
      }

      if (filters.projectId) query = query.eq('project_id', filters.projectId);
      if (filters.agencyId) query = query.eq('agency_id', filters.agencyId);
      if (filters.teamId) query = query.eq('team_id', filters.teamId);
      if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.includeSample === false) query = query.eq('is_sample', false);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);

      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw new Error(error.message);

      const mapped = (data || []).map((item: any) => ({
        ...item,
        customer_name: item.customer?.full_name,
        customer_phone: item.customer?.phone,
        customer_phone_hash: item.customer?.phone_hash,
        customer_email: item.customer?.email,
        do_not_contact: item.customer?.do_not_contact || item.do_not_contact,
        project_name: item.project?.name,
        assigned_name: item.assigned_user?.full_name,
        agency_name: item.agency?.name,
        team_name: item.team?.name,
        source_name: item.source?.name,
      }));

      return { leads: mapped, total: count || 0 };
    }

    // Local Storage Mock fallback
    assertNoMockPIIInProduction('lấy danh sách leads');
    this.ensureInitialized();
    let allLeads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');

    // 0. CÔ LẬP ĐA ĐỐI TÁC (MULTI-TENANT ISOLATION)
    if (currentUser.organization_id) {
      allLeads = allLeads.filter(l => !l.organization_id || l.organization_id === currentUser.organization_id);
    }

    // Áp dụng quyền theo vai trò
    if (currentUser.role === 'sale_agent') {
      allLeads = allLeads.filter(l => l.assigned_to === currentUser.id);
    } else if (currentUser.role === 'team_leader' && currentUser.team_id) {
      allLeads = allLeads.filter(l => l.team_id === currentUser.team_id);
    } else if (currentUser.role === 'sales_manager' && currentUser.agency_id) {
      allLeads = allLeads.filter(l => l.agency_id === currentUser.agency_id);
    }

    // Lọc theo bộ lọc người dùng
    if (filters.projectId) allLeads = allLeads.filter(l => l.project_id === filters.projectId);
    if (filters.agencyId) allLeads = allLeads.filter(l => l.agency_id === filters.agencyId);
    if (filters.teamId) allLeads = allLeads.filter(l => l.team_id === filters.teamId);
    if (filters.assignedTo) allLeads = allLeads.filter(l => l.assigned_to === filters.assignedTo);
    if (filters.status) allLeads = allLeads.filter(l => l.status === filters.status);
    if (filters.includeSample === false) allLeads = allLeads.filter(l => !l.is_sample);
    if (filters.dateFrom) allLeads = allLeads.filter(l => l.created_at.slice(0, 10) >= filters.dateFrom!);
    if (filters.dateTo) allLeads = allLeads.filter(l => l.created_at.slice(0, 10) <= filters.dateTo!);

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      allLeads = allLeads.filter(l => 
        (l.customer_name && l.customer_name.toLowerCase().includes(q)) ||
        (l.customer_phone && l.customer_phone.includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
      );
    }

    // Che thông tin PII nếu vai trò là marketing_manager
    if (currentUser.role === 'marketing_manager') {
      allLeads = allLeads.map(l => ({
        ...l,
        customer_phone: maskPhone(l.customer_phone),
        customer_name: maskName(l.customer_name),
        customer_email: undefined,
      }));
    }

    const total = allLeads.length;
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paged = allLeads.slice(start, start + pageSize);

    return { leads: paged, total };
  }

  // 2. LẤY CHI TIẾT LEAD THEO ID
  async getLeadById(id: string, currentUser?: UserProfile): Promise<Lead | null> {
    if (isLiveSupabaseConfigured) {
      if (currentUser?.role === 'marketing_manager') {
        const { data, error } = await supabase
          .from('marketing_leads_view')
          .select('*')
          .eq('lead_id', id)
          .maybeSingle();
        if (error || !data) return null;
        return {
          id: data.lead_id,
          customer_id: data.customer_id,
          customer_name: data.masked_name,
          customer_phone: data.masked_phone,
          customer_phone_hash: data.phone_hash,
          project_id: data.project_id,
          project_name: data.project_name,
          status: data.status,
          budget_min: data.budget_min,
          budget_max: data.budget_max,
          purpose: data.purpose,
          do_not_contact: data.do_not_contact,
          created_at: data.created_at,
          updated_at: data.updated_at,
        } as Lead;
      }

      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          customer:customers(*),
          project:projects(*),
          assigned_user:profiles!leads_assigned_to_fkey(full_name, phone, email),
          agency:agencies(name),
          team:teams(name)
        `)
        .eq('id', id)
        .single();
      if (error || !data) return null;
      return {
        ...data,
        customer_name: data.customer?.full_name,
        customer_phone: data.customer?.phone,
        customer_phone_hash: data.customer?.phone_hash,
        customer_email: data.customer?.email,
        do_not_contact: data.customer?.do_not_contact || data.do_not_contact,
        project_name: data.project?.name,
        assigned_name: data.assigned_user?.full_name,
        agency_name: data.agency?.name,
        team_name: data.team?.name,
      } as Lead;
    }

    assertNoMockPIIInProduction('lấy chi tiết lead');
    this.ensureInitialized();
    const allLeads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const lead = allLeads.find(l => l.id === id) || null;
    if (lead && currentUser?.role === 'marketing_manager') {
      return {
        ...lead,
        customer_phone: maskPhone(lead.customer_phone),
        customer_name: maskName(lead.customer_name),
        customer_email: undefined,
      };
    }
    return lead;
  }

  // 3. KIỂM TRA TRÙNG SỐ ĐIỆN THOẠI (DEDUPE BẰNG PHONE_HASH)
  async checkDuplicatePhone(phone: string, currentLeadId?: string): Promise<{ isDuplicate: boolean; existingLead?: Lead }> {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return { isDuplicate: false };
    const phoneHash = computePhoneHash(cleanPhone);

    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('customers')
        .select('id, full_name, phone, phone_hash, leads(id, project_id, status, assigned_to)')
        .or(`phone_hash.eq.${phoneHash},phone_normalized.eq.${cleanPhone}`)
        .maybeSingle();

      if (data && data.leads && data.leads.length > 0) {
        const lead = data.leads[0];
        if (!currentLeadId || lead.id !== currentLeadId) {
          return {
            isDuplicate: true,
            existingLead: {
              ...lead,
              customer_name: data.full_name,
              customer_phone: data.phone,
              customer_phone_hash: data.phone_hash,
            } as any,
          };
        }
      }
      return { isDuplicate: false };
    }

    assertNoMockPIIInProduction('kiểm tra trùng SĐT');
    this.ensureInitialized();
    const allLeads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const existing = allLeads.find(l => {
      if (currentLeadId && l.id === currentLeadId) return false;
      const normalizedExisting = normalizePhone(l.customer_phone || '');
      return normalizedExisting === cleanPhone || (l.customer_phone_hash && l.customer_phone_hash === phoneHash);
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingLead: existing,
      };
    }

    return { isDuplicate: false };
  }

  // 3.1. KIỂM TRA BẢO HỘ LEAD THEO VAI TRÒ VÀ QUYỀN SỞ HỮU
  async checkCustomerPhoneProtection(
    phone: string, 
    currentUser?: UserProfile,
    projectId?: string
  ): Promise<{ 
    isDuplicate: boolean; 
    canUse: boolean; 
    isProtected: boolean; 
    message?: string; 
    existingLead?: Lead;
    existingCustomer?: { id: string; name: string; phone: string; email?: string; idCard?: string; address?: string };
  }> {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      return { isDuplicate: false, canUse: true, isProtected: false };
    }

    const dup = await this.checkDuplicatePhone(cleanPhone);
    if (!dup.isDuplicate || !dup.existingLead) {
      return { isDuplicate: false, canUse: true, isProtected: false };
    }

    const lead = dup.existingLead;
    const isAssignedToCurrentUser = currentUser && lead.assigned_to === currentUser.id;
    const isPrivilegedRole = currentUser && ['admin', 'director', 'sales_manager'].includes(currentUser.role);
    const isSameTeam = currentUser && currentUser.role === 'team_leader' && lead.team_id === currentUser.team_id;

    const canUse = Boolean(isAssignedToCurrentUser || isPrivilegedRole || isSameTeam || !lead.assigned_to);

    if (canUse) {
      return {
        isDuplicate: true,
        canUse: true,
        isProtected: false,
        existingLead: lead,
        existingCustomer: {
          id: lead.customer_id,
          name: lead.customer_name || 'Khách hàng',
          phone: lead.customer_phone || cleanPhone,
          email: lead.customer_email,
        },
      };
    }

    // Nếu không có quyền: Không lộ PII chi tiết, kích hoạt quy tắc bảo hộ Lead
    return {
      isDuplicate: true,
      canUse: false,
      isProtected: true,
      message: 'Khách hàng đang được chăm sóc bởi chuyên viên khác. Vui lòng liên hệ Quản lý sàn.',
      existingLead: {
        id: lead.id,
        project_id: lead.project_id,
        customer_name: maskName(lead.customer_name),
        customer_phone: maskPhone(lead.customer_phone),
      } as any,
      existingCustomer: {
        id: lead.customer_id,
        name: maskName(lead.customer_name),
        phone: maskPhone(lead.customer_phone),
      },
    };
  }

  // 4. GIẢI MÃ VÀ XEM CCCD (RPC REVEAL_CCCD KÈM AUDIT LOG BẮT BUỘC)
  async revealCCCD(customerId: string, currentUser: UserProfile): Promise<{ cccd: string }> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('reveal_cccd', { p_customer_id: customerId });
      if (error) throw new Error(error.message);
      return { cccd: data.cccd };
    }

    assertNoMockPIIInProduction('giải mã CCCD');
    // Phân quyền vai trò nghiêm ngặt
    if (!['admin', 'director', 'sales_manager'].includes(currentUser.role)) {
      throw new Error(`Từ chối thao tác: Vai trò "${currentUser.role}" không có quyền giải mã và xem số CCCD/CMND của khách hàng.`);
    }

    // Ghi audit log
    const auditLogs = JSON.parse(localStorage.getItem('crm_audit_logs') || '[]');
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      user_id: currentUser.id,
      action: 'reveal_cccd',
      table_name: 'customers',
      record_id: customerId,
      new_data: {
        customer_name: 'Khách hàng',
        accessed_by_role: currentUser.role,
        user_name: currentUser.full_name,
        timestamp: new Date().toISOString(),
      },
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('crm_audit_logs', JSON.stringify(auditLogs.slice(0, 1000)));

    return { cccd: '079201019988' };
  }

  // 5. QUẢN LÝ ĐỒNG THUẬN (CONSENT) & DO_NOT_CONTACT
  async recordConsent(consent: Omit<CustomerConsent, 'id' | 'created_at'>): Promise<CustomerConsent> {
    const newConsent: CustomerConsent = {
      ...consent,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `consent-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('customer_consents')
        .insert(newConsent)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    assertNoMockPIIInProduction('lưu consent khách hàng');
    const consents: CustomerConsent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONSENTS) || '[]');
    consents.push(newConsent);
    localStorage.setItem(STORAGE_KEY_CONSENTS, JSON.stringify(consents));
    return newConsent;
  }

  async revokeConsent(consentId: string, reason: string, currentUser: UserProfile): Promise<void> {
    if (isLiveSupabaseConfigured) {
      const { data: consentRecord, error: fetchErr } = await supabase
        .from('customer_consents')
        .select('customer_id')
        .eq('id', consentId)
        .single();
      if (fetchErr || !consentRecord) throw new Error('Không tìm thấy bản ghi đồng thuận.');

      const { error } = await supabase
        .from('customer_consents')
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_reason: reason,
        })
        .eq('id', consentId);
      if (error) throw new Error(error.message);

      await this.updateDoNotContact(consentRecord.customer_id, true, currentUser);
      return;
    }

    assertNoMockPIIInProduction('thu hồi consent');
    const consents: CustomerConsent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONSENTS) || '[]');
    const index = consents.findIndex(c => c.id === consentId);
    if (index === -1) throw new Error('Không tìm thấy bản ghi đồng thuận.');

    consents[index].is_revoked = true;
    consents[index].revoked_at = new Date().toISOString();
    consents[index].revoked_reason = reason;
    localStorage.setItem(STORAGE_KEY_CONSENTS, JSON.stringify(consents));

    await this.updateDoNotContact(consents[index].customer_id, true, currentUser);
  }

  async getConsentsByCustomer(customerId: string): Promise<CustomerConsent[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('customer_consents')
        .select('*')
        .eq('customer_id', customerId)
        .order('obtained_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }

    assertNoMockPIIInProduction('truy vấn consent');
    const consents: CustomerConsent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONSENTS) || '[]');
    return consents.filter(c => c.customer_id === customerId);
  }

  async updateDoNotContact(customerId: string, doNotContact: boolean, currentUser: UserProfile): Promise<void> {
    if (isLiveSupabaseConfigured) {
      await supabase.from('customers').update({ do_not_contact: doNotContact }).eq('id', customerId);
      await supabase.from('leads').update({ do_not_contact: doNotContact }).eq('customer_id', customerId);
      return;
    }

    assertNoMockPIIInProduction('cập nhật do_not_contact');
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    let updated = false;
    for (const l of leads) {
      if (l.customer_id === customerId) {
        l.do_not_contact = doNotContact;
        updated = true;
      }
    }
    if (updated) {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    }
  }

  // 4. TẠO LEAD MỚI (ÁP DỤNG RATE LIMIT & IDEMPOTENCY)
  async createLead(payload: {
    fullName: string;
    phone: string;
    email?: string;
    projectId: string;
    sourceCode?: string;
    sourceId?: string;
    sourceName?: string;
    budgetMin?: number;
    budgetMax?: number;
    purpose?: 'residence' | 'investment' | 'both' | 'undecided';
    notes?: string;
    currentUser: UserProfile;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; lead?: Lead; error?: string }> {
    // 1. CƯỠNG CHẾ RATE LIMIT (30 req / phút trên endpoint leads/create)
    assertRateLimit(payload.currentUser.id || 'anonymous', 'leads/create', 30);

    // 2. KIỂM TRA IDEMPOTENCY KEY (Chống tạo trùng lặp request khi bấm nhiều lần)
    if (payload.idempotencyKey) {
      const check = await checkOrStartIdempotency(
        payload.idempotencyKey,
        'leads/create',
        { phone: payload.phone, projectId: payload.projectId, fullName: payload.fullName },
        payload.currentUser.id
      );
      if (check.isCached) {
        return check.response;
      }
    }

    const cleanPhone = normalizePhone(payload.phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      return { success: false, error: 'Số điện thoại không hợp lệ.' };
    }

    // Kiểm tra trùng
    const dup = await this.checkDuplicatePhone(cleanPhone);
    if (dup.isDuplicate) {
      return {
        success: false,
        error: `Số điện thoại này đã tồn tại trên hệ thống cho khách hàng "${dup.existingLead?.customer_name}".`,
      };
    }

    const project = INITIAL_PROJECTS.find(p => p.id === payload.projectId);
    const projectName = project ? project.name : 'Dự án';

    if (isLiveSupabaseConfigured) {
      // 1. Tạo Customer
      const { data: customer, error: cErr } = await supabase
        .from('customers')
        .insert({
          organization_id: payload.currentUser.organization_id || '11111111-1111-1111-1111-111111111111',
          full_name: payload.fullName,
          phone: payload.phone,
          phone_normalized: cleanPhone,
          email: payload.email,
          consent_obtained: true,
        })
        .select()
        .single();

      if (cErr) return { success: false, error: cErr.message };

      const isSale = payload.currentUser.role === 'sale_agent';
      const assignedToId = isSale ? payload.currentUser.id : null;
      const initialDeadline = assignedToId ? autoTransferService.computeCareDeadline(new Date().toISOString(), 24) : null;
      const initialPreviousSales = assignedToId ? [assignedToId] : [];

      // 2. Tạo Lead
      const { data: lead, error: lErr } = await supabase
        .from('leads')
        .insert({
          customer_id: customer.id,
          project_id: payload.projectId,
          agency_id: payload.currentUser.agency_id,
          team_id: payload.currentUser.team_id,
          assigned_to: assignedToId,
          source_id: payload.sourceId || null,
          status: 'new',
          budget_min: payload.budgetMin,
          budget_max: payload.budgetMax,
          purpose: payload.purpose || 'investment',
          notes: payload.notes,
          care_deadline_at: initialDeadline,
          last_care_updated_at: new Date().toISOString(),
          auto_transfer_count: 0,
          previous_assigned_sales: initialPreviousSales,
        })
        .select()
        .single();

      if (lErr) return { success: false, error: lErr.message };

      if (assignedToId && payload.currentUser.email) {
        const isInvest = payload.purpose === 'investment';
        const mucDich = isInvest ? 'Đầu tư sinh lời (ưu tiên dòng tiền & tiềm năng tăng giá)' : 'Mua để ở / an cư';
        const budgetMinNum = payload.budgetMin || 2000000000;
        const budgetMaxNum = payload.budgetMax || 3500000000;
        const nganSach = `${(budgetMinNum / 1e9).toFixed(1)} - ${(budgetMaxNum / 1e9).toFixed(1)} tỷ`;
        const aiScript = `Dạ em chào Anh/Chị ${payload.fullName}! Em là chuyên viên tư vấn dự án ${projectName}. Em được biết Anh/Chị đang tìm hiểu sản phẩm phù hợp nhu cầu ${isInvest ? 'đầu tư' : 'an cư'} với tầm tài chính ${nganSach}. Em vừa cập nhật giỏ hàng các căn đẹp nhất phân khu mới có chiết khấu tốt, em xin phép gửi thông tin chi tiết qua Zalo để Anh/Chị tham khảo nhé ạ!`;

        notificationService.sendNotification({
          leadId: lead.id,
          recipientId: assignedToId,
          recipientEmail: payload.currentUser.email,
          recipientName: payload.currentUser.full_name,
          eventType: 'new_assign',
          channel: 'both',
          variables: {
            ten_sale: payload.currentUser.full_name,
            ten_khach_hang: payload.fullName,
            so_dien_thoai: payload.phone,
            du_an: projectName,
            muc_dich: mucDich,
            ngan_sach: nganSach,
            loai_bds: 'Căn hộ cao cấp / Nhà phố',
            ghi_chu: payload.notes || 'Khách quan tâm dự án, cần tư vấn bảng giá chi tiết',
            buoc_kich_ban: 'Bước 1: Tiếp cận ban đầu & Khai thác nhu cầu cốt lõi',
            ai_script: aiScript,
            han_cham_soc: initialDeadline || 'Trong vòng 24 giờ',
            lead_id: lead.id,
          },
        }).catch(err => console.error('Error dispatching notification:', err));
      }

      const res = { success: true, lead };
      if (payload.idempotencyKey) {
        await completeIdempotency(payload.idempotencyKey, 'leads/create', res);
      }
      return res;
    }

    // Local Storage Mock
    this.ensureInitialized();
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const newLeadId = crypto.randomUUID();
    const newCustomerId = crypto.randomUUID();
    const isSale = payload.currentUser.role === 'sale_agent';
    const assignedToId = isSale ? payload.currentUser.id : undefined;
    const initialDeadline = assignedToId ? autoTransferService.computeCareDeadline(new Date().toISOString(), 24) : undefined;
    const initialPreviousSales = assignedToId ? [assignedToId] : [];

    const sources = await this.getLeadSources();
    const matchedSource = payload.sourceId
      ? sources.find(s => s.id === payload.sourceId)
      : (payload.sourceCode ? sources.find(s => s.code === payload.sourceCode) : undefined);

    const resolvedSourceName = payload.sourceName || matchedSource?.name || 'Hotline';
    const resolvedSourceId = payload.sourceId || matchedSource?.id || 'src-hotline';

    const newLead: Lead = {
      id: newLeadId,
      organization_id: payload.currentUser.organization_id || '11111111-1111-1111-1111-111111111111',
      customer_id: newCustomerId,
      customer_name: payload.fullName,
      customer_phone: payload.phone,
      customer_email: payload.email,
      project_id: payload.projectId,
      project_name: projectName,
      agency_id: payload.currentUser.agency_id || INITIAL_AGENCIES[0].id,
      agency_name: INITIAL_AGENCIES[0].name,
      team_id: payload.currentUser.team_id,
      team_name: INITIAL_TEAMS[0].name,
      assigned_to: assignedToId,
      assigned_name: isSale ? payload.currentUser.full_name : 'Chưa phân bổ',
      source_id: resolvedSourceId,
      source_name: resolvedSourceName,
      status: 'new',
      lead_score: 60,
      budget_min: payload.budgetMin || 2000000000,
      budget_max: payload.budgetMax || 3500000000,
      purpose: payload.purpose || 'investment',
      notes: payload.notes || 'Tiếp nhận từ form nhập liệu',
      created_at: new Date().toISOString(),
      care_deadline_at: initialDeadline,
      last_care_updated_at: new Date().toISOString(),
      auto_transfer_count: 0,
      previous_assigned_sales: initialPreviousSales,
    };

    leads.unshift(newLead);
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    // Thêm activity
    await this.addActivity(newLeadId, {
      userId: payload.currentUser.id,
      userName: payload.currentUser.full_name,
      type: 'note',
      title: 'Tạo Lead mới trong hệ thống',
      content: `Lead được khởi tạo cho dự án ${projectName}. Ghi chú: ${payload.notes || 'Không'}`,
    });

    if (assignedToId && payload.currentUser.email) {
      const isInvest = payload.purpose === 'investment';
      const mucDich = isInvest ? 'Đầu tư sinh lời (ưu tiên dòng tiền & tiềm năng tăng giá)' : 'Mua để ở / an cư';
      const budgetMinNum = payload.budgetMin || 2000000000;
      const budgetMaxNum = payload.budgetMax || 3500000000;
      const nganSach = `${(budgetMinNum / 1e9).toFixed(1)} - ${(budgetMaxNum / 1e9).toFixed(1)} tỷ`;
      const aiScript = `Dạ em chào Anh/Chị ${payload.fullName}! Em là chuyên viên tư vấn dự án ${projectName}. Em được biết Anh/Chị đang tìm hiểu sản phẩm phù hợp nhu cầu ${isInvest ? 'đầu tư' : 'an cư'} với tầm tài chính ${nganSach}. Em vừa cập nhật giỏ hàng các căn đẹp nhất phân khu mới có chiết khấu tốt, em xin phép gửi thông tin chi tiết qua Zalo để Anh/Chị tham khảo nhé ạ!`;

      notificationService.sendNotification({
        leadId: newLeadId,
        recipientId: assignedToId,
        recipientEmail: payload.currentUser.email,
        recipientName: payload.currentUser.full_name,
        eventType: 'new_assign',
        channel: 'both',
        variables: {
          ten_sale: payload.currentUser.full_name,
          ten_khach_hang: payload.fullName,
          so_dien_thoai: payload.phone,
          du_an: projectName,
          muc_dich: mucDich,
          ngan_sach: nganSach,
          loai_bds: 'Căn hộ cao cấp / Nhà phố',
          ghi_chu: payload.notes || 'Khách quan tâm dự án, cần tư vấn bảng giá chi tiết',
          buoc_kich_ban: 'Bước 1: Tiếp cận ban đầu & Khai thác nhu cầu cốt lõi',
          ai_script: aiScript,
          han_cham_soc: initialDeadline || 'Trong vòng 24 giờ',
          lead_id: newLeadId,
        },
      }).catch(err => console.error('Error dispatching notification:', err));
    }

    const res = { success: true, lead: newLead };
    if (payload.idempotencyKey) {
      await completeIdempotency(payload.idempotencyKey, 'leads/create', res);
    }
    return res;
  }

  // 4.1 CẬP NHẬT THÔNG TIN LEAD (Ghi chú, Chân dung, Điểm số, Hành động tiếp theo)
  async updateLead(leadId: string, updates: Partial<Lead>): Promise<{ success: boolean; lead?: Lead; error?: string }> {
    // Không cho phép cập nhật trực tiếp cột status - bắt buộc thông qua RPC change_lead_status
    const { status: _ignoredStatus, ...sanitizedUpdates } = updates;

    const isCareUpdate = sanitizedUpdates.notes !== undefined || 
                         sanitizedUpdates.lead_score !== undefined || 
                         sanitizedUpdates.purpose !== undefined || 
                         sanitizedUpdates.preferred_property_type !== undefined ||
                         sanitizedUpdates.next_follow_up !== undefined;

    const nowIso = new Date().toISOString();
    const newDeadline = isCareUpdate ? autoTransferService.computeCareDeadline(nowIso, 24) : undefined;

    if (isLiveSupabaseConfigured) {
      const payload: any = {
        updated_at: nowIso,
      };
      if (sanitizedUpdates.notes !== undefined) payload.notes = sanitizedUpdates.notes;
      if (sanitizedUpdates.lead_score !== undefined) payload.lead_score = sanitizedUpdates.lead_score;
      if (sanitizedUpdates.purpose !== undefined) payload.purpose = sanitizedUpdates.purpose;
      if (sanitizedUpdates.preferred_property_type !== undefined) payload.preferred_property_type = sanitizedUpdates.preferred_property_type;
      if (sanitizedUpdates.budget_min !== undefined) payload.budget_min = sanitizedUpdates.budget_min;
      if (sanitizedUpdates.budget_max !== undefined) payload.budget_max = sanitizedUpdates.budget_max;
      if (sanitizedUpdates.next_follow_up !== undefined) payload.next_follow_up = sanitizedUpdates.next_follow_up;
      if (sanitizedUpdates.last_action_at !== undefined) payload.last_action_at = sanitizedUpdates.last_action_at;

      if (isCareUpdate) {
        payload.last_care_updated_at = nowIso;
        if (newDeadline) payload.care_deadline_at = newDeadline;
      }

      const { data, error } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', leadId)
        .select(`
          *,
          customer:customers(full_name, phone, email),
          project:projects(name)
        `)
        .single();

      if (error) return { success: false, error: error.message };
      return {
        success: true,
        lead: {
          ...data,
          customer_name: data.customer?.full_name,
          customer_phone: data.customer?.phone,
          customer_email: data.customer?.email,
          project_name: data.project?.name,
        } as Lead,
      };
    }

    this.ensureInitialized();
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const idx = leads.findIndex(l => l.id === leadId);
    if (idx === -1) return { success: false, error: 'Không tìm thấy Lead.' };

    const updatedLead: Lead = {
      ...leads[idx],
      ...sanitizedUpdates,
      updated_at: nowIso,
      last_action_at: sanitizedUpdates.last_action_at || nowIso,
      ...(isCareUpdate ? { last_care_updated_at: nowIso, care_deadline_at: newDeadline } : {}),
    };

    leads[idx] = updatedLead;
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    return { success: true, lead: updatedLead };
  }

  // 5. CẬP NHẬT TRẠNG THÁI CUSTOMER JOURNEY KÈM GIAO DỊCH BẮT BUỘC (RPC change_lead_status)
  async updateLeadStageWithTransaction(payload: {
    leadId: string;
    newStatus: LeadStatus;
    currentUser: UserProfile;
    txCode?: string;
    txAmount?: number;
    txDate?: string;
    notes?: string;
    unitCode?: string;
    dealValue?: number;
    contractCode?: string;
    lossReasonCode?: string;
    lossReasonDetail?: string;
    nurtureReminderDate?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; error?: string }> {
    // CHẶN KHI ĐANG Ở CHẾ ĐỘ GIẢ LẬP GÓC NHÌN (CHẾ ĐỘ CHỈ ĐỌC)
    if (authRepository.isImpersonating()) {
      authRepository.assertNotImpersonating('đổi trạng thái lead');
    }

    // 1. CƯỠNG CHẾ RATE LIMIT (60 req / phút trên endpoint đổi trạng thái lead)
    assertRateLimit(payload.currentUser.id || 'anonymous', 'leads/change-status', 60);

    // 2. KIỂM TRA IDEMPOTENCY KEY
    if (payload.idempotencyKey) {
      const check = await checkOrStartIdempotency(
        payload.idempotencyKey,
        'leads/change-status',
        { leadId: payload.leadId, newStatus: payload.newStatus, amount: payload.txAmount, unitCode: payload.unitCode },
        payload.currentUser.id
      );
      if (check.isCached) {
        return check.response;
      }
    }

    const nowIso = new Date().toISOString();

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('change_lead_status', {
        p_lead_id: payload.leadId,
        p_to_status: payload.newStatus,
        p_payload: {
          amount: payload.txAmount,
          deal_value: payload.dealValue || payload.txAmount,
          code: payload.txCode,
          receipt_code: payload.txCode,
          contract_code: payload.contractCode || (payload.newStatus === 'contract' ? payload.txCode : undefined),
          unit_code: payload.unitCode,
          notes: payload.notes,
          user_id: payload.currentUser.id,
        },
      });

      if (error) return { success: false, error: error.message };
      if (data && !data.success) return { success: false, error: data.message || 'Cập nhật trạng thái thất bại.' };

      if (payload.idempotencyKey) {
        await completeIdempotency(payload.idempotencyKey, 'leads/change-status', { success: true });
      }
      return { success: true };
    }

    // Local Storage Mock logic (Mô phỏng 100% quy tắc kiểm tra của RPC DB)
    this.ensureInitialized();
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const leadIdx = leads.findIndex(l => l.id === payload.leadId);
    if (leadIdx === -1) return { success: false, error: 'Không tìm thấy Lead.' };

    const lead = leads[leadIdx];
    const oldStatus = lead.status;

    // 1. Trạng thái không thay đổi -> Thành công
    if (oldStatus === payload.newStatus) {
      if (payload.idempotencyKey) {
        await completeIdempotency(payload.idempotencyKey, 'leads/change-status', { success: true });
      }
      return { success: true };
    }

    // 1.5 Kiểm tra bắt buộc lý do mất khách / không hợp lệ khi đóng Lead
    if (['lost', 'invalid'].includes(payload.newStatus)) {
      if (payload.lossReasonCode === '' || (payload.lossReasonCode === undefined && payload.currentUser.role !== 'admin')) {
        return {
          success: false,
          error: 'Bắt buộc chọn lý do mất khách / không hợp lệ khi đóng Lead!',
        };
      }
    }

    // 2. Kiểm tra ràng buộc tài chính bắt buộc trước (Financial Milestones Validation)
    const isFinancialStage = ['booking', 'deposit', 'contract'].includes(payload.newStatus);
    const resolvedUnitCode = payload.unitCode !== undefined 
      ? payload.unitCode.trim() 
      : (payload.txCode ? 'A-01.01' : '');

    if (isFinancialStage) {
      if (payload.newStatus === 'booking') {
        if (!payload.txCode || !payload.txCode.trim()) {
          return { success: false, error: 'Mã Booking là bắt buộc khi chuyển sang trạng thái Booking giữ chỗ!' };
        }
      }

      if (payload.newStatus === 'deposit') {
        if (payload.txAmount === undefined || payload.txAmount <= 0) {
          return { success: false, error: 'Số tiền đặt cọc hợp lệ (> 0) là bắt buộc khi chuyển sang trạng thái Đặt cọc!' };
        }
      }

      if (payload.newStatus === 'contract') {
        if (!payload.txCode || !payload.txCode.trim()) {
          return { success: false, error: 'Mã hợp đồng (HĐMB) là bắt buộc khi chuyển sang trạng thái Ký HĐMB!' };
        }
        if (payload.txAmount !== undefined && payload.txAmount <= 0) {
          return { success: false, error: 'Số tiền đặt cọc hợp lệ (> 0) là bắt buộc khi chuyển sang trạng thái Đặt cọc / Hợp đồng!' };
        }
      }

      if (payload.unitCode !== undefined && payload.unitCode.trim() === '') {
        return { success: false, error: 'Mã căn hộ / sản phẩm không được để trống khi thực hiện giao dịch tài chính!' };
      }
    }

    // 3. Kiểm tra quyền sở hữu với sale_agent
    if (payload.currentUser.role === 'sale_agent' && lead.assigned_to && lead.assigned_to !== payload.currentUser.id) {
      return {
        success: false,
        error: 'Từ chối thao tác: Chuyên viên tư vấn chỉ được cập nhật trạng thái Lead được giao cho chính mình.',
      };
    }

    // 4. Kiểm tra ma trận chuyển trạng thái (State Transition Matrix)
    const rule = findTransitionRule(oldStatus, payload.newStatus);
    if (!rule) {
      return {
        success: false,
        error: `Quy trình không hợp lệ: Không được phép chuyển từ trạng thái "${oldStatus}" sang "${payload.newStatus}"`,
      };
    }

    // 5. Kiểm tra quyền hạn theo vai trò (Role-based Transition Access)
    if (payload.currentUser.role !== 'admin' && !rule.allowedRoles.includes(payload.currentUser.role)) {
      return {
        success: false,
        error: `Từ chối thao tác: Vai trò "${payload.currentUser.role}" không có quyền chuyển Lead từ "${oldStatus}" sang "${payload.newStatus}"`,
      };
    }

    // 6. Kiểm tra chống bán trùng một căn (Unique Unit Constraint in Same Project)
    if (isFinancialStage && resolvedUnitCode && lead.project_id) {
      const txs: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      const conflict = txs.find(t =>
        t.project_id === lead.project_id &&
        t.unit_code &&
        t.unit_code.toLowerCase().trim() === resolvedUnitCode.toLowerCase().trim() &&
        ['confirmed', 'pending'].includes(t.status) &&
        ['booking', 'deposit', 'contract'].includes(t.type) &&
        t.lead_id !== payload.leadId
      );

      if (conflict) {
        return {
          success: false,
          error: `Xung đột giỏ hàng: Căn "${resolvedUnitCode}" đã có hợp đồng/giao dịch hiệu lực từ trước trong dự án!`,
        };
      }
    }

    // 6. Tính toán SLA 24h (Dừng đồng hồ nếu sang stop-clock status)
    const isStopClock = STOP_CLOCK_STATUSES.includes(payload.newStatus);
    const newDeadline = isStopClock ? undefined : autoTransferService.computeCareDeadline(nowIso, 24);

    // 7. CẬP NHẬT LEAD TRONG STORAGE
    leads[leadIdx].status = payload.newStatus;
    if (payload.notes) leads[leadIdx].notes = payload.notes;
    leads[leadIdx].updated_at = nowIso;
    leads[leadIdx].last_action_at = nowIso;
    leads[leadIdx].last_care_updated_at = nowIso;
    leads[leadIdx].care_deadline_at = newDeadline;
    leads[leadIdx].sla_reset_count = 0; // Chuyển giai đoạn hợp lệ -> reset bộ đếm reset SLA
    if (payload.lossReasonCode) leads[leadIdx].loss_reason_code = payload.lossReasonCode;
    if (payload.lossReasonDetail) leads[leadIdx].loss_reason_detail = payload.lossReasonDetail;
    if (payload.nurtureReminderDate) leads[leadIdx].nurture_reminder_date = payload.nurtureReminderDate;

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    // 8. Lưu Transaction nếu là Booking/Cọc/HĐMB
    if (isFinancialStage) {
      const txs: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      const newTx: Transaction = {
        id: crypto.randomUUID(),
        lead_id: payload.leadId,
        project_id: lead.project_id,
        type: payload.newStatus as any,
        code: payload.txCode || `TX-${Date.now()}`,
        unit_code: resolvedUnitCode,
        amount: payload.txAmount || (payload.newStatus === 'booking' ? 50000000 : 100000000),
        transaction_date: payload.txDate || nowIso,
        contract_code: payload.newStatus === 'contract' ? (payload.contractCode || payload.txCode) : undefined,
        status: 'confirmed',
        notes: payload.notes,
        created_by: payload.currentUser.id,
        created_at: nowIso,
      };
      txs.push(newTx);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(txs));
    }

    // 9. Ghi nhận lead_status_history
    const history: LeadStatusHistory[] = JSON.parse(localStorage.getItem(STORAGE_KEY_STATUS_HISTORY) || '[]');
    history.unshift({
      id: crypto.randomUUID(),
      lead_id: payload.leadId,
      changed_by: payload.currentUser.id,
      changer_name: payload.currentUser.full_name,
      old_status: oldStatus,
      new_status: payload.newStatus,
      notes: payload.notes || 'Chuyển trạng thái qua RPC change_lead_status',
      created_at: nowIso,
    });
    localStorage.setItem(STORAGE_KEY_STATUS_HISTORY, JSON.stringify(history));

    // 10. Thêm activity
    await this.addActivity(payload.leadId, {
      userId: payload.currentUser.id,
      userName: payload.currentUser.full_name,
      type: 'system',
      title: `Chuyển trạng thái sang "${payload.newStatus}"`,
      content: payload.notes || 'Cập nhật qua RPC change_lead_status.',
    });

    if (payload.idempotencyKey) {
      await completeIdempotency(payload.idempotencyKey, 'leads/change-status', { success: true });
    }
    return { success: true };
  }

  // 6. PHÂN BỔ ROUND ROBIN (RPC)
  async assignRoundRobin(leadId: string, projectId: string, teamId?: string): Promise<{ success: boolean; saleName?: string; error?: string }> {
    const nowIso = new Date().toISOString();
    const newDeadline = autoTransferService.computeCareDeadline(nowIso, 24);

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('assign_lead_round_robin', {
        p_lead_id: leadId,
        p_project_id: projectId,
        p_team_id: teamId || null,
      });

      if (error) return { success: false, error: error.message };
      if (!data.success) return { success: false, error: data.message };

      // Cập nhật deadline & lịch sử
      await supabase
        .from('leads')
        .update({
          care_deadline_at: newDeadline,
          last_care_updated_at: nowIso,
        })
        .eq('id', leadId);

      return { success: true, saleName: data.sale_name };
    }

    // Local Storage Round Robin Mock
    this.ensureInitialized();
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return { success: false, error: 'Không tìm thấy Lead chỉ định.' };

    const saleCandidates = [
      { id: 'aaaaaaaa-6666-1111-1111-111111111111', name: 'Phạm Mai Anh', teamId: INITIAL_TEAMS[0].id },
      { id: 's2', name: 'Nguyễn Văn Nam', teamId: INITIAL_TEAMS[0].id },
      { id: 's3', name: 'Trần Thị Thu Thảo', teamId: INITIAL_TEAMS[1].id },
    ];

    const eligible = teamId ? saleCandidates.filter(s => s.teamId === teamId) : saleCandidates;
    const selected = eligible[Math.floor(Math.random() * eligible.length)] || saleCandidates[0];

    const oldAssigneeId = lead.assigned_to;
    const oldAssigneeName = lead.assigned_name;

    lead.assigned_to = selected.id;
    lead.assigned_name = selected.name;
    lead.updated_at = nowIso;
    lead.last_care_updated_at = nowIso;
    lead.care_deadline_at = newDeadline;

    if (!Array.isArray(lead.previous_assigned_sales)) {
      lead.previous_assigned_sales = [];
    }
    if (oldAssigneeId && !lead.previous_assigned_sales.includes(oldAssigneeId)) {
      lead.previous_assigned_sales.push(oldAssigneeId);
    }

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    // Thêm log phân bổ
    const assignments = JSON.parse(localStorage.getItem(STORAGE_KEY_ASSIGNMENTS) || '[]');
    assignments.unshift({
      id: crypto.randomUUID(),
      lead_id: leadId,
      assigned_to: selected.id,
      assigned_name: selected.name,
      method: 'round_robin',
      assigned_at: nowIso,
    });
    localStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(assignments));

    // Ghi nhận lead_assignment_history
    const history: LeadAssignmentHistory[] = JSON.parse(localStorage.getItem(STORAGE_KEY_ASSIGNMENT_HISTORY) || '[]');
    history.unshift({
      id: crypto.randomUUID(),
      lead_id: leadId,
      from_sale_id: oldAssigneeId,
      from_sale_name: oldAssigneeName,
      to_sale_id: selected.id,
      to_sale_name: selected.name,
      reason: 'round_robin',
      transfer_count: lead.auto_transfer_count || 0,
      created_by: 'Hệ thống Round Robin',
      created_at: nowIso,
    });
    localStorage.setItem(STORAGE_KEY_ASSIGNMENT_HISTORY, JSON.stringify(history));

    return { success: true, saleName: selected.name };
  }

  // 6.1 PHÂN BỔ HÀNG LOẠT (BULK ASSIGN) KÈM GỘP EMAIL DIGEST
  async assignBulkLeads(
    leadIds: string[],
    targetSale: UserProfile,
    currentUser: UserProfile,
    reason: string = 'Phân bổ hàng loạt từ người quản lý'
  ): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    if (!leadIds || leadIds.length === 0) {
      return { success: false, updatedCount: 0, error: 'Chưa chọn Lead nào để phân bổ.' };
    }

    const nowIso = new Date().toISOString();
    const newDeadline = autoTransferService.computeCareDeadline(nowIso, 24);
    const affectedLeads: Lead[] = [];

    if (isLiveSupabaseConfigured) {
      for (const id of leadIds) {
        const leadObj = await this.getLeadById(id);
        if (leadObj) {
          const prevSales: string[] = Array.isArray(leadObj.previous_assigned_sales) ? [...leadObj.previous_assigned_sales] : [];
          if (leadObj.assigned_to && !prevSales.includes(leadObj.assigned_to)) {
            prevSales.push(leadObj.assigned_to);
          }

          await supabase.from('leads').update({
            assigned_to: targetSale.id,
            team_id: targetSale.team_id || leadObj.team_id,
            agency_id: targetSale.agency_id || leadObj.agency_id,
            care_deadline_at: newDeadline,
            last_care_updated_at: nowIso,
            previous_assigned_sales: prevSales,
            updated_at: nowIso,
          }).eq('id', id);

          await supabase.from('lead_assignment_history').insert({
            lead_id: id,
            from_sale_id: leadObj.assigned_to,
            to_sale_id: targetSale.id,
            reason: 'bulk_assign',
            transfer_count: leadObj.auto_transfer_count || 0,
            notes: reason,
            created_by: currentUser.full_name,
          });

          affectedLeads.push({
            ...leadObj,
            assigned_to: targetSale.id,
            assigned_name: targetSale.full_name,
            care_deadline_at: newDeadline,
          });
        }
      }
    } else {
      this.ensureInitialized();
      const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
      const history: LeadAssignmentHistory[] = JSON.parse(localStorage.getItem(STORAGE_KEY_ASSIGNMENT_HISTORY) || '[]');

      for (const id of leadIds) {
        const lead = leads.find(l => l.id === id);
        if (lead) {
          const oldAssigneeId = lead.assigned_to;
          const oldAssigneeName = lead.assigned_name;

          if (!Array.isArray(lead.previous_assigned_sales)) lead.previous_assigned_sales = [];
          if (oldAssigneeId && !lead.previous_assigned_sales.includes(oldAssigneeId)) {
            lead.previous_assigned_sales.push(oldAssigneeId);
          }

          lead.assigned_to = targetSale.id;
          lead.assigned_name = targetSale.full_name;
          lead.team_id = targetSale.team_id || lead.team_id;
          lead.agency_id = targetSale.agency_id || lead.agency_id;
          lead.care_deadline_at = newDeadline;
          lead.last_care_updated_at = nowIso;
          lead.updated_at = nowIso;

          history.unshift({
            id: crypto.randomUUID(),
            lead_id: id,
            from_sale_id: oldAssigneeId,
            from_sale_name: oldAssigneeName,
            to_sale_id: targetSale.id,
            to_sale_name: targetSale.full_name,
            reason: 'bulk_assign',
            transfer_count: lead.auto_transfer_count || 0,
            notes: reason,
            created_by: currentUser.full_name,
            created_at: nowIso,
          });

          affectedLeads.push(lead);
        }
      }

      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
      localStorage.setItem(STORAGE_KEY_ASSIGNMENT_HISTORY, JSON.stringify(history));
    }

    // Gửi email thông báo tự động cho Sale nhận
    if (targetSale.email && affectedLeads.length > 0) {
      if (affectedLeads.length === 1) {
        // Phân bổ đúng 1 Lead: Gửi email chi tiết Chân dung khách hàng + Bước kịch bản + Gợi ý AI tư vấn
        const singleLead = affectedLeads[0];
        const persona = notificationService.buildLeadPersonaAndScript(singleLead);

        notificationService.sendNotification({
          leadId: singleLead.id,
          recipientId: targetSale.id,
          recipientEmail: targetSale.email,
          recipientName: targetSale.full_name,
          eventType: 'lead_transferred',
          channel: 'both',
          variables: {
            ten_sale: targetSale.full_name,
            ten_khach_hang: singleLead.customer_name || 'Khách hàng',
            so_dien_thoai: singleLead.customer_phone || '',
            du_an: singleLead.project_name || 'Dự án',
            muc_dich: persona.mucDich,
            ngan_sach: persona.nganSach,
            loai_bds: persona.loaiBds,
            ghi_chu: persona.ghiChu,
            buoc_kich_ban: persona.buocKichBan,
            ai_script: persona.aiScript,
            thoi_gian: new Date().toLocaleString('vi-VN'),
            han_cham_soc: new Date(newDeadline).toLocaleString('vi-VN'),
            lead_id: singleLead.id,
          },
        }).catch(err => console.error('Error sending single lead assign notification:', err));
      } else {
        // Phân bổ từ 2 Lead trở lên: Gộp thành 1 email Digest tổng hợp bảng danh sách
        notificationService.sendBulkAssignDigest(
          targetSale,
          affectedLeads,
          currentUser.full_name
        ).catch(err => console.error('Error sending bulk assign digest:', err));
      }
    }

    return { success: true, updatedCount: affectedLeads.length };
  }

  // 6.2 ĐIỀU CHUYỂN SALE THỦ CÔNG (MANUAL REASSIGN)
  async manualReassignLead(
    leadId: string,
    newSale: UserProfile,
    reason: string,
    currentUser: UserProfile
  ): Promise<{ success: boolean; error?: string }> {
    const lead = await this.getLeadById(leadId);
    if (!lead) return { success: false, error: 'Không tìm thấy Lead.' };

    const result = await autoTransferService.transferLead(
      lead,
      newSale,
      'manual_transfer',
      currentUser.full_name,
      reason
    );

    return { success: result.success, error: result.error };
  }

  // 6.3 THU HỒI LEAD VỀ KHO CHUNG (RECLAIM TO POOL)
  async reclaimLeadToPool(
    leadId: string,
    reason: string,
    currentUser: UserProfile
  ): Promise<{ success: boolean; error?: string }> {
    const lead = await this.getLeadById(leadId);
    if (!lead) return { success: false, error: 'Không tìm thấy Lead.' };

    const result = await autoTransferService.transferLead(
      lead,
      null,
      'pool_reclaim',
      currentUser.full_name,
      reason
    );

    return { success: result.success, error: result.error };
  }

  // 6.4 GIA HẠN THỜI GIAN CHĂM SÓC LEAD
  async extendCareDeadline(
    leadId: string,
    hours: number,
    reason: string,
    currentUser: UserProfile
  ): Promise<boolean> {
    return autoTransferService.extendDeadline(leadId, hours, reason, currentUser.full_name);
  }

  // 6.5 CẤU HÌNH MIỄN CHUYỂN TỰ ĐỘNG
  async setLeadExempt(
    leadId: string,
    isExempt: boolean,
    reason: string,
    currentUser: UserProfile
  ): Promise<boolean> {
    return autoTransferService.setExemptStatus(leadId, isExempt, reason, currentUser.full_name);
  }

  // 6.6 LẤY LỊCH SỬ ĐIỀU CHUYỂN CỦA LEAD
  async getAssignmentHistory(leadId: string): Promise<LeadAssignmentHistory[]> {
    return autoTransferService.getLeadAssignmentHistory(leadId);
  }

  // 7. HOẠT ĐỘNG VÀ TIMELINE
  async getLeadActivities(leadId: string): Promise<LeadActivity[]> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('lead_activities')
        .select('*, user:profiles(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      return (data || []).map((a: any) => ({
        ...a,
        user_name: a.user?.full_name,
      }));
    }

    const all: LeadActivity[] = JSON.parse(localStorage.getItem(STORAGE_KEY_ACTIVITIES) || '[]');
    return all.filter(a => a.lead_id === leadId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async addActivity(leadId: string, payload: { userId: string; userName?: string; type: any; title: string; content?: string }): Promise<void> {
    const nowIso = new Date().toISOString();
    const newDeadline = autoTransferService.computeCareDeadline(nowIso, 24);

    if (isLiveSupabaseConfigured) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
      });

      // Cập nhật reset đồng hồ 24h trên lead
      await supabase.from('leads').update({
        last_care_updated_at: nowIso,
        care_deadline_at: newDeadline,
      }).eq('id', leadId);

      return;
    }

    const all: LeadActivity[] = JSON.parse(localStorage.getItem(STORAGE_KEY_ACTIVITIES) || '[]');
    all.unshift({
      id: crypto.randomUUID(),
      lead_id: leadId,
      user_id: payload.userId,
      user_name: payload.userName,
      type: payload.type,
      title: payload.title,
      content: payload.content,
      created_at: nowIso,
    });
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(all));

    // Reset đồng hồ trên mock leads (chỉ reset deadline nếu không ở trạng thái dừng đồng hồ stop-clock)
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const leadIdx = leads.findIndex(l => l.id === leadId);
    if (leadIdx !== -1) {
      const isStopClock = STOP_CLOCK_STATUSES.includes(leads[leadIdx].status);
      leads[leadIdx].last_care_updated_at = nowIso;
      leads[leadIdx].care_deadline_at = isStopClock ? undefined : newDeadline;
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    }
  }

  async getLeadStatusHistory(leadId: string): Promise<LeadStatusHistory[]> {
    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('lead_status_history')
        .select('*, changer:profiles(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      return (data || []).map((h: any) => ({
        ...h,
        changer_name: h.changer?.full_name,
      }));
    }

    const all: LeadStatusHistory[] = JSON.parse(localStorage.getItem(STORAGE_KEY_STATUS_HISTORY) || '[]');
    return all.filter(h => h.lead_id === leadId);
  }

  // Khởi tạo bộ dữ liệu mock chuẩn nếu chưa có trong LocalStorage
  private ensureInitialized() {
    assertNoMockPIIInProduction('khởi tạo dữ liệu mock');
    if (!localStorage.getItem(STORAGE_KEY_LEADS)) {
      const mockLeads: Lead[] = [];
      const mockTxs: Transaction[] = [];
      const mockHistory: LeadStatusHistory[] = [];
      const statuses: LeadStatus[] = [
        'new', 'unreachable', 'invalid', 'contacted', 'qualifying', 
        'doc_sent', 'appointment_set', 'consulted', 'site_visit', 'considering', 
        'booking', 'deposit', 'contract', 'after_sales', 'lost'
      ];

      for (let i = 1; i <= 30; i++) {
        const leadId = `lead-${i}`;
        const custId = `cust-${i}`;
        const status = statuses[(i - 1) % 15];
        const proj = INITIAL_PROJECTS[i % INITIAL_PROJECTS.length];
        const rawPhone = `098${String(i).padStart(7, '0')}`;
        const src = INITIAL_LEAD_SOURCES[(i - 1) % INITIAL_LEAD_SOURCES.length];
        const lead: Lead = {
          id: leadId,
          customer_id: custId,
          customer_name: `Khách hàng ${['Nguyễn Văn', 'Trần Thị', 'Lê Hoàng', 'Phạm Đức', 'Võ Minh'][i % 5]} ${String.fromCharCode(65 + (i % 26))}`,
          customer_phone: rawPhone,
          customer_phone_hash: computePhoneHash(normalizePhone(rawPhone)),
          customer_email: `khachhang${i}@gmail.com`,
          do_not_contact: false,
          source_id: src.id,
          source_name: src.name,
          project_id: proj.id,
          project_name: proj.name,
          agency_id: INITIAL_AGENCIES[0].id,
          agency_name: INITIAL_AGENCIES[0].name,
          team_id: INITIAL_TEAMS[0].id,
          team_name: INITIAL_TEAMS[0].name,
          assigned_to: 'aaaaaaaa-6666-1111-1111-111111111111',
          assigned_name: 'Phạm Mai Anh (Chuyên Viên Tư Vấn)',
          status,
          lead_score: 50 + (i % 45),
          budget_min: 2000000000 + (i * 100000000),
          budget_max: 3500000000 + (i * 150000000),
          purpose: i % 2 === 0 ? 'investment' : 'residence',
          notes: 'Quan tâm chính sách thanh toán và tiềm năng tăng giá.',
          created_at: new Date(Date.now() - (30 - i) * 86400000).toISOString(),
          last_action_at: new Date().toISOString(),
          last_care_updated_at: new Date(Date.now() - (i % 24) * 3600000).toISOString(),
          care_deadline_at: new Date(Date.now() + (24 - (i % 28)) * 3600000).toISOString(),
          auto_transfer_count: i % 3,
          previous_assigned_sales: ['aaaaaaaa-6666-1111-1111-111111111111'],
        };

        if (status === 'booking') {
          mockTxs.push({
            id: `tx-bk-${i}`,
            lead_id: leadId,
            type: 'booking',
            code: `BK-VHGP-${String(i).padStart(4, '0')}`,
            amount: 50000000,
            transaction_date: new Date().toISOString(),
            status: 'confirmed',
            notes: 'Phiếu giữ chỗ ưu tiên STT đẹp',
          });
        } else if (status === 'deposit') {
          mockTxs.push({
            id: `tx-dp-${i}`,
            lead_id: leadId,
            type: 'deposit',
            code: `DC-VHGP-${String(i).padStart(4, '0')}`,
            amount: 100000000,
            transaction_date: new Date().toISOString(),
            status: 'confirmed',
            notes: 'Đặt cọc căn 2PN toà Origami',
          });
        } else if (status === 'contract') {
          mockTxs.push({
            id: `tx-ct-${i}`,
            lead_id: leadId,
            type: 'contract',
            code: `HD-VHGP-${String(i).padStart(4, '0')}`,
            contract_code: `HĐMB-2026-${String(i).padStart(4, '0')}`,
            amount: 3200000000,
            transaction_date: new Date().toISOString(),
            status: 'confirmed',
            notes: 'Ký Hợp đồng mua bán căn hộ',
          });
        }

        mockHistory.push({
          id: `hist-${i}`,
          lead_id: leadId,
          new_status: status,
          changer_name: 'Hệ thống tự động',
          created_at: lead.created_at,
          notes: 'Khởi tạo Lead theo kịch bản mẫu',
        });

        mockLeads.push(lead);
      }

      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(mockLeads));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(mockTxs));
      localStorage.setItem(STORAGE_KEY_STATUS_HISTORY, JSON.stringify(mockHistory));
    }
  }

  // ========================================================
  // XEM PII ĐẦY ĐỦ CHO ADMIN VÀ GIÁM ĐỐC SÀN (RPC DB)
  // ========================================================
  async getUnmaskedCustomerPII(
    customerId: string,
    currentUser: UserProfile
  ): Promise<{ phone: string; email?: string; identity_card?: string; address?: string } | null> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('get_unmasked_customer_pii', {
        p_customer_id: customerId
      });
      if (error || !data) return null;
      return data as { phone: string; email?: string; identity_card?: string; address?: string };
    }

    // Mock fallback
    const { canViewFullPII } = await import('@/lib/masking');
    if (!canViewFullPII(currentUser)) {
      throw new Error('Từ chối truy cập: Bạn không có quyền xem thông tin định danh đầy đủ.');
    }
    const customers = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOMERS) || '[]');
    const cust = customers.find((c: any) => c.id === customerId);
    if (!cust) return null;
    return {
      phone: cust.phone,
      email: cust.email,
      identity_card: cust.identity_card || cust.encrypted_id_number,
      address: cust.address
    };
  }

  // ========================================================
  // QUẢN LÝ DỮ LIỆU MẪU (PURGE & SEED SAMPLE DATA)
  // ========================================================
  async purgeSampleData(operator: UserProfile): Promise<{ success: boolean; message: string }> {
    if (operator.role !== 'admin') {
      throw new Error('Chỉ Quản trị viên (Admin) mới có quyền xóa dữ liệu mẫu.');
    }
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('purge_sample_data');
      if (error) throw new Error(error.message);
      return data as { success: boolean; message: string };
    }

    const { controlledDataService } = await import('@/domain/services/controlledDataService');
    const result = controlledDataService.purgeSampleData(operator);
    return {
      success: true,
      message: `Đã dọn dẹp ${result.deleted_leads} leads, ${result.deleted_customers} khách hàng và ${result.deleted_contracts} hợp đồng mẫu.`
    };
  }

  async seedSampleLeads(operator: UserProfile): Promise<{ success: boolean; message: string }> {
    if (operator.role !== 'admin') {
      throw new Error('Chỉ Quản trị viên (Admin) mới có quyền tạo dữ liệu mẫu.');
    }
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('seed_sample_leads_data');
      if (error) throw new Error(error.message);
      return data as { success: boolean; message: string };
    }

    const { controlledDataService } = await import('@/domain/services/controlledDataService');
    const result = controlledDataService.seedSampleLeads(operator);
    return {
      success: true,
      message: `Đã khởi tạo thành công ${result.created_count} lead mẫu.`
    };
  }
}

export const leadRepository = new LeadRepository();
