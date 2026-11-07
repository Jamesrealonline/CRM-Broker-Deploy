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
  UserProfile 
} from '@/domain/types';
import { normalizePhone } from '@/lib/utils';
import { INITIAL_PROJECTS, INITIAL_AGENCIES, INITIAL_TEAMS } from '../mockData';

const STORAGE_KEY_LEADS = 'crm_leads';
const STORAGE_KEY_CUSTOMERS = 'crm_customers';
const STORAGE_KEY_TRANSACTIONS = 'crm_transactions';
const STORAGE_KEY_ACTIVITIES = 'crm_activities';
const STORAGE_KEY_STATUS_HISTORY = 'crm_status_history';
const STORAGE_KEY_ASSIGNMENTS = 'crm_assignments';

export interface LeadFilters {
  search?: string;
  projectId?: string;
  agencyId?: string;
  teamId?: string;
  assignedTo?: string;
  status?: LeadStatus;
  page?: number;
  pageSize?: number;
}

export class LeadRepository {
  // 1. LẤY DANH SÁCH LEADS (ÁP DỤNG RLS PHÂN QUYỀN VAI TRÒ)
  async getLeads(filters: LeadFilters, currentUser: UserProfile): Promise<{ leads: Lead[]; total: number }> {
    if (isLiveSupabaseConfigured) {
      let query = supabase.from('leads').select(`
        *,
        customer:customers(full_name, phone, email),
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
        customer_email: item.customer?.email,
        project_name: item.project?.name,
        assigned_name: item.assigned_user?.full_name,
        agency_name: item.agency?.name,
        team_name: item.team?.name,
        source_name: item.source?.name,
      }));

      return { leads: mapped, total: count || 0 };
    }

    // Local Storage Mock fallback
    this.ensureInitialized();
    let allLeads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');

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

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      allLeads = allLeads.filter(l => 
        (l.customer_name && l.customer_name.toLowerCase().includes(q)) ||
        (l.customer_phone && l.customer_phone.includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
      );
    }

    const total = allLeads.length;
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paged = allLeads.slice(start, start + pageSize);

    return { leads: paged, total };
  }

  // 2. LẤY CHI TIẾT LEAD THEO ID
  async getLeadById(id: string): Promise<Lead | null> {
    if (isLiveSupabaseConfigured) {
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
        customer_email: data.customer?.email,
        project_name: data.project?.name,
        assigned_name: data.assigned_user?.full_name,
        agency_name: data.agency?.name,
        team_name: data.team?.name,
      } as Lead;
    }

    this.ensureInitialized();
    const allLeads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    return allLeads.find(l => l.id === id) || null;
  }

  // 3. KIỂM TRA TRÙNG SỐ ĐIỆN THOẠI
  async checkDuplicatePhone(phone: string, currentLeadId?: string): Promise<{ isDuplicate: boolean; existingLead?: Lead }> {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return { isDuplicate: false };

    if (isLiveSupabaseConfigured) {
      const { data } = await supabase
        .from('customers')
        .select('id, full_name, phone, leads(id, project_id, status, assigned_to)')
        .eq('phone_normalized', cleanPhone)
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
            } as any,
          };
        }
      }
      return { isDuplicate: false };
    }

    this.ensureInitialized();
    const allLeads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const match = allLeads.find(l => 
      normalizePhone(l.customer_phone || '') === cleanPhone &&
      (!currentLeadId || l.id !== currentLeadId)
    );

    return { isDuplicate: Boolean(match), existingLead: match };
  }

  // 4. TẠO LEAD MỚI
  async createLead(payload: {
    fullName: string;
    phone: string;
    email?: string;
    projectId: string;
    sourceCode?: string;
    budgetMin?: number;
    budgetMax?: number;
    purpose?: 'residence' | 'investment' | 'both' | 'undecided';
    notes?: string;
    currentUser: UserProfile;
  }): Promise<{ success: boolean; lead?: Lead; error?: string }> {
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

      // 2. Tạo Lead
      const { data: lead, error: lErr } = await supabase
        .from('leads')
        .insert({
          customer_id: customer.id,
          project_id: payload.projectId,
          agency_id: payload.currentUser.agency_id,
          team_id: payload.currentUser.team_id,
          assigned_to: payload.currentUser.role === 'sale_agent' ? payload.currentUser.id : null,
          status: 'new',
          budget_min: payload.budgetMin,
          budget_max: payload.budgetMax,
          purpose: payload.purpose || 'investment',
          notes: payload.notes,
        })
        .select()
        .single();

      if (lErr) return { success: false, error: lErr.message };

      return { success: true, lead };
    }

    // Local Storage Mock
    this.ensureInitialized();
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const newLeadId = crypto.randomUUID();
    const newCustomerId = crypto.randomUUID();

    const newLead: Lead = {
      id: newLeadId,
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
      assigned_to: payload.currentUser.role === 'sale_agent' ? payload.currentUser.id : undefined,
      assigned_name: payload.currentUser.role === 'sale_agent' ? payload.currentUser.full_name : 'Chưa phân bổ',
      status: 'new',
      lead_score: 60,
      budget_min: payload.budgetMin || 2000000000,
      budget_max: payload.budgetMax || 3500000000,
      purpose: payload.purpose || 'investment',
      notes: payload.notes || 'Tiếp nhận từ form nhập liệu',
      created_at: new Date().toISOString(),
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

    return { success: true, lead: newLead };
  }

  // 4.1 CẬP NHẬT THÔNG TIN LEAD (Ghi chú, Chân dung, Điểm số, Hành động tiếp theo)
  async updateLead(leadId: string, updates: Partial<Lead>): Promise<{ success: boolean; lead?: Lead; error?: string }> {
    if (isLiveSupabaseConfigured) {
      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.lead_score !== undefined) payload.lead_score = updates.lead_score;
      if (updates.purpose !== undefined) payload.purpose = updates.purpose;
      if (updates.preferred_property_type !== undefined) payload.preferred_property_type = updates.preferred_property_type;
      if (updates.budget_min !== undefined) payload.budget_min = updates.budget_min;
      if (updates.budget_max !== undefined) payload.budget_max = updates.budget_max;
      if (updates.next_follow_up !== undefined) payload.next_follow_up = updates.next_follow_up;
      if (updates.last_action_at !== undefined) payload.last_action_at = updates.last_action_at;

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
      ...updates,
      updated_at: new Date().toISOString(),
      last_action_at: updates.last_action_at || new Date().toISOString(),
    };

    leads[idx] = updatedLead;
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    return { success: true, lead: updatedLead };
  }

  // 5. CẬP NHẬT TRẠNG THÁI CUSTOMER JOURNEY KÈM GIAO DỊCH BẮT BUỘC (RPC RULE)
  async updateLeadStageWithTransaction(payload: {
    leadId: string;
    newStatus: LeadStatus;
    currentUser: UserProfile;
    txCode?: string;
    txAmount?: number;
    txDate?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    // Kiểm tra quy tắc nghiệp vụ: Booking, Cọc, HĐMB bắt buộc có thông tin giao dịch
    if (payload.newStatus === 'booking') {
      if (!payload.txCode || !payload.txCode.trim()) {
        return { success: false, error: 'Mã Booking là bắt buộc khi chuyển sang trạng thái Booking giữ chỗ!' };
      }
    } else if (payload.newStatus === 'deposit') {
      if (!payload.txAmount || payload.txAmount <= 0) {
        return { success: false, error: 'Số tiền đặt cọc hợp lệ (> 0) là bắt buộc khi chuyển sang trạng thái Đặt cọc!' };
      }
    } else if (payload.newStatus === 'contract') {
      if (!payload.txCode || !payload.txCode.trim()) {
        return { success: false, error: 'Mã hợp đồng (HĐMB) là bắt buộc khi chuyển sang trạng thái Ký HĐMB!' };
      }
    }

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('update_lead_stage_with_transaction', {
        p_lead_id: payload.leadId,
        p_new_status: payload.newStatus,
        p_tx_code: payload.txCode || null,
        p_tx_amount: payload.txAmount || null,
        p_tx_date: payload.txDate || null,
        p_notes: payload.notes || null,
      });

      if (error) return { success: false, error: error.message };
      if (!data.success) return { success: false, error: data.message };
      return { success: true };
    }

    // Local Storage Mock logic
    this.ensureInitialized();
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const leadIdx = leads.findIndex(l => l.id === payload.leadId);
    if (leadIdx === -1) return { success: false, error: 'Không tìm thấy Lead.' };

    const oldStatus = leads[leadIdx].status;
    leads[leadIdx].status = payload.newStatus;
    if (payload.notes) leads[leadIdx].notes = payload.notes;
    leads[leadIdx].updated_at = new Date().toISOString();
    leads[leadIdx].last_action_at = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    // Lưu Transaction nếu là Booking/Cọc/HĐMB
    if (['booking', 'deposit', 'contract'].includes(payload.newStatus)) {
      const txs: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
      const newTx: Transaction = {
        id: crypto.randomUUID(),
        lead_id: payload.leadId,
        type: payload.newStatus as any,
        code: payload.txCode || `TX-${Date.now()}`,
        amount: payload.txAmount || (payload.newStatus === 'booking' ? 50000000 : 100000000),
        transaction_date: payload.txDate || new Date().toISOString(),
        contract_code: payload.newStatus === 'contract' ? payload.txCode : undefined,
        status: 'confirmed',
        notes: payload.notes,
        created_by: payload.currentUser.id,
        created_at: new Date().toISOString(),
      };
      txs.push(newTx);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(txs));
    }

    // Ghi nhận lead_status_history
    const history: LeadStatusHistory[] = JSON.parse(localStorage.getItem(STORAGE_KEY_STATUS_HISTORY) || '[]');
    history.unshift({
      id: crypto.randomUUID(),
      lead_id: payload.leadId,
      changed_by: payload.currentUser.id,
      changer_name: payload.currentUser.full_name,
      old_status: oldStatus,
      new_status: payload.newStatus,
      notes: payload.notes || 'Chuyển trạng thái trên Customer Journey Kanban',
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_STATUS_HISTORY, JSON.stringify(history));

    // Thêm activity
    await this.addActivity(payload.leadId, {
      userId: payload.currentUser.id,
      userName: payload.currentUser.full_name,
      type: 'system',
      title: `Chuyển trạng thái sang "${payload.newStatus}"`,
      content: payload.notes || 'Cập nhật qua bảng Kanban Journey.',
    });

    return { success: true };
  }

  // 6. PHÂN BỔ ROUND ROBIN (RPC)
  async assignRoundRobin(leadId: string, projectId: string, teamId?: string): Promise<{ success: boolean; saleName?: string; error?: string }> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.rpc('assign_lead_round_robin', {
        p_lead_id: leadId,
        p_project_id: projectId,
        p_team_id: teamId || null,
      });

      if (error) return { success: false, error: error.message };
      if (!data.success) return { success: false, error: data.message };
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

    lead.assigned_to = selected.id;
    lead.assigned_name = selected.name;
    lead.updated_at = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    // Thêm log phân bổ
    const assignments = JSON.parse(localStorage.getItem(STORAGE_KEY_ASSIGNMENTS) || '[]');
    assignments.unshift({
      id: crypto.randomUUID(),
      lead_id: leadId,
      assigned_to: selected.id,
      assigned_name: selected.name,
      method: 'round_robin',
      assigned_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(assignments));

    return { success: true, saleName: selected.name };
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
    if (isLiveSupabaseConfigured) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
      });
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
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(all));
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
        const lead: Lead = {
          id: leadId,
          customer_id: custId,
          customer_name: `Khách hàng ${['Nguyễn Văn', 'Trần Thị', 'Lê Hoàng', 'Phạm Đức', 'Võ Minh'][i % 5]} ${String.fromCharCode(65 + (i % 26))}`,
          customer_phone: `098${String(i).padStart(7, '0')}`,
          customer_email: `khachhang${i}@gmail.com`,
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
}

export const leadRepository = new LeadRepository();
