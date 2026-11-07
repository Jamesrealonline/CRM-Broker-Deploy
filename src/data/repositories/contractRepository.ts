// ========================================================
// REAL ESTATE CRM - CONTRACTS, COMMISSIONS & LEADERBOARDS
// Module Quản lý Hợp đồng giao dịch, Hiệu suất sàn & Thi đua
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { 
  Transaction, 
  SoldProduct, 
  AgencyPerformanceDetail, 
  LeaderboardItem,
  LeadStatus,
  UserRole
} from '@/domain/types';
import { INITIAL_TRANSACTIONS, INITIAL_AGENCIES, INITIAL_TEAMS, INITIAL_PROFILES } from '../mockData';
import { JOURNEY_STAGES } from '@/domain/constants';

const STORAGE_KEY_TRANSACTIONS = 'crm_transactions';

export interface ContractFilters {
  projectId?: string;
  agencyId?: string;
  teamId?: string;
  saleId?: string;
  type?: string;
  status?: string;
  search?: string;
}

export class ContractRepository {
  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEY_TRANSACTIONS)) {
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
    }
  }

  // 1. LẤY DANH SÁCH GIAO DỊCH & HỢP ĐỒNG CHI TIẾT
  async getTransactions(filters: ContractFilters = {}): Promise<Transaction[]> {
    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          lead:leads (
            id,
            project_id,
            agency_id,
            team_id,
            assigned_to,
            customer:customers (
              full_name,
              phone
            ),
            project:projects (
              id,
              name
            ),
            agency:agencies (
              id,
              name
            ),
            team:teams (
              id,
              name
            ),
            assigned_user:profiles!leads_assigned_to_fkey (
              id,
              full_name
            )
          ),
          creator:profiles!transactions_created_by_fkey (
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        let mapped: Transaction[] = (data as any[]).map(t => {
          const l = t.lead || {};
          const c = l.customer || {};
          const p = l.project || {};
          const a = l.agency || {};
          const tm = l.team || {};
          const u = t.creator || l.assigned_user || {};

          return {
            id: t.id,
            lead_id: t.lead_id,
            deal_id: t.deal_id,
            type: t.type,
            code: t.code,
            amount: Number(t.amount || 0),
            transaction_date: t.transaction_date,
            payment_method: t.payment_method,
            status: t.status,
            contract_code: t.contract_code,
            notes: t.notes,
            created_by: t.created_by,
            created_at: t.created_at,
            unit_code: t.unit_code,
            deal_value: Number(t.deal_value || t.amount || 0),
            commission_amount: Number(t.commission_amount || 0),
            sale_commission_rate: Number(t.sale_commission_rate || 1.5),
            sale_commission_amount: Number(t.sale_commission_amount || 0),
            deposit_date: t.deposit_date,
            contract_date: t.contract_date,
            first_installment_amount: Number(t.first_installment_amount || 0),
            first_installment_date: t.first_installment_date,
            first_installment_paid: Boolean(t.first_installment_paid),
            customer_name: c.full_name,
            customer_phone: c.phone,
            project_id: p.id || l.project_id,
            project_name: p.name,
            agency_id: a.id || l.agency_id,
            agency_name: a.name,
            team_id: tm.id || l.team_id,
            team_name: tm.name,
            sale_id: u.id || l.assigned_to,
            sale_name: u.full_name,
          };
        });

        // Áp dụng filters
        if (filters.projectId) mapped = mapped.filter(t => t.project_id === filters.projectId);
        if (filters.agencyId) mapped = mapped.filter(t => t.agency_id === filters.agencyId);
        if (filters.teamId) mapped = mapped.filter(t => t.team_id === filters.teamId);
        if (filters.saleId) mapped = mapped.filter(t => t.sale_id === filters.saleId);
        if (filters.type) mapped = mapped.filter(t => t.type === filters.type);
        if (filters.status) mapped = mapped.filter(t => t.status === filters.status);
        if (filters.search) {
          const q = filters.search.toLowerCase().trim();
          mapped = mapped.filter(t => 
            (t.code && t.code.toLowerCase().includes(q)) ||
            (t.contract_code && t.contract_code.toLowerCase().includes(q)) ||
            (t.unit_code && t.unit_code.toLowerCase().includes(q)) ||
            (t.customer_name && t.customer_name.toLowerCase().includes(q)) ||
            (t.sale_name && t.sale_name.toLowerCase().includes(q))
          );
        }

        return mapped;
      }
    }

    // Local / Offline fallback
    this.ensureInitialized();
    const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    let list: Transaction[] = raw ? JSON.parse(raw) : INITIAL_TRANSACTIONS;

    if (filters.projectId) list = list.filter(t => t.project_id === filters.projectId);
    if (filters.agencyId) list = list.filter(t => t.agency_id === filters.agencyId);
    if (filters.teamId) list = list.filter(t => t.team_id === filters.teamId);
    if (filters.saleId) list = list.filter(t => t.sale_id === filters.saleId || t.created_by === filters.saleId);
    if (filters.type) list = list.filter(t => t.type === filters.type);
    if (filters.status) list = list.filter(t => t.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(t => 
        (t.code && t.code.toLowerCase().includes(q)) ||
        (t.contract_code && t.contract_code.toLowerCase().includes(q)) ||
        (t.unit_code && t.unit_code.toLowerCase().includes(q)) ||
        (t.customer_name && t.customer_name.toLowerCase().includes(q)) ||
        (t.sale_name && t.sale_name.toLowerCase().includes(q))
      );
    }

    return list;
  }

  // 2. TẠO HỢP ĐỒNG GIAO DỊCH MỚI
  async createContractTransaction(payload: Partial<Transaction>): Promise<Transaction> {
    const dealVal = Number(payload.deal_value || payload.amount || 3000000000);
    const saleRate = Number(payload.sale_commission_rate || 1.8);
    const commAmt = payload.commission_amount ?? Math.round(dealVal * 0.035);
    const saleCommAmt = payload.sale_commission_amount ?? Math.round(dealVal * (saleRate / 100));

    const newTx: any = {
      id: crypto.randomUUID(),
      lead_id: payload.lead_id,
      deal_id: payload.deal_id,
      type: payload.type || 'contract',
      code: payload.code || `HD-${Date.now().toString().slice(-6)}`,
      amount: payload.amount || dealVal,
      transaction_date: payload.transaction_date || new Date().toISOString(),
      payment_method: payload.payment_method || 'bank_transfer',
      status: payload.status || 'confirmed',
      contract_code: payload.contract_code || `HĐMB-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      unit_code: payload.unit_code || 'CH-01',
      deal_value: dealVal,
      commission_amount: commAmt,
      sale_commission_rate: saleRate,
      sale_commission_amount: saleCommAmt,
      deposit_date: payload.deposit_date || new Date().toISOString(),
      contract_date: payload.contract_date || new Date().toISOString(),
      first_installment_amount: payload.first_installment_amount || Math.round(dealVal * 0.1),
      first_installment_date: payload.first_installment_date || new Date(Date.now() + 15 * 86400000).toISOString(),
      first_installment_paid: Boolean(payload.first_installment_paid),
      notes: payload.notes || '',
      created_by: payload.created_by,
      created_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured) {
      const { data, error } = await supabase.from('transactions').insert(newTx).select().single();
      if (!error && data) return data;
    }

    this.ensureInitialized();
    const list: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
    list.unshift(newTx);
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(list));
    return newTx;
  }

  // 3. CẬP NHẬT TIẾN ĐỘ HỢP ĐỒNG (CỌC -> KÝ HĐMB -> ĐÓNG TIỀN ĐỢT 1)
  async updateContractMilestone(txId: string, updates: {
    first_installment_paid?: boolean;
    first_installment_amount?: number;
    first_installment_date?: string;
    contract_code?: string;
    contract_date?: string;
    deposit_date?: string;
    deal_value?: number;
    status?: any;
    notes?: string;
  }): Promise<boolean> {
    if (isLiveSupabaseConfigured) {
      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', txId);
      if (!error) return true;
    }

    this.ensureInitialized();
    const list: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
    const idx = list.findIndex(t => t.id === txId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(list));
      return true;
    }
    return false;
  }

  // 4. DOANH SỐ VÀ HOA HỒNG CỦA SALE THEO TỪNG HỢP ĐỒNG
  async getSaleCommissions(saleId?: string, projectId?: string): Promise<{
    transactions: Transaction[];
    totalRevenue: number;
    totalCommission: number;
    totalContracts: number;
  }> {
    const all = await this.getTransactions({
      saleId,
      projectId,
      type: 'contract',
      status: 'confirmed',
    });

    const totalRevenue = all.reduce((sum, t) => sum + (t.deal_value || t.amount || 0), 0);
    const totalCommission = all.reduce((sum, t) => sum + (t.sale_commission_amount || 0), 0);

    return {
      transactions: all,
      totalRevenue,
      totalCommission,
      totalContracts: all.length,
    };
  }

  // 5. HIỆU SUẤT CỦA CÁC SÀN KHI BẤM VÀO TỪNG SÀN
  async getAgencyPerformanceDetail(agencyId: string, projectId?: string): Promise<AgencyPerformanceDetail> {
    // A. Lấy thông tin Sàn
    let agencyName = 'Sàn Giao Dịch';
    let agencyCode = 'SAN';
    let directorName = 'Đang cập nhật';

    if (isLiveSupabaseConfigured) {
      const { data: agData } = await supabase.from('agencies').select('*').eq('id', agencyId).maybeSingle();
      if (agData) {
        agencyName = agData.name;
        agencyCode = agData.code;
        if (agData.director_id) {
          const { data: dirData } = await supabase.from('profiles').select('full_name').eq('id', agData.director_id).maybeSingle();
          if (dirData) directorName = dirData.full_name;
        }
      }
    } else {
      const found = INITIAL_AGENCIES.find(a => a.id === agencyId);
      if (found) {
        agencyName = found.name;
        agencyCode = found.code;
        directorName = found.director_name || 'Đang cập nhật';
      }
    }

    // B. Lấy danh sách nhân sự của sàn
    let members: Array<{
      id: string;
      full_name: string;
      email: string;
      phone: string;
      role: UserRole;
      team_name?: string;
      status: string;
    }> = [];

    if (isLiveSupabaseConfigured) {
      const { data: profs } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          status,
          team:teams (
            name
          )
        `)
        .eq('agency_id', agencyId);

      if (profs) {
        members = profs.map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          role: p.role,
          team_name: p.team?.name,
          status: p.status || 'active',
        }));
      }
    } else {
      const rawProfs = localStorage.getItem('crm_profiles');
      const allP: any[] = rawProfs ? JSON.parse(rawProfs) : INITIAL_PROFILES;
      members = allP.filter(p => p.agency_id === agencyId).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        team_name: INITIAL_TEAMS.find(t => t.id === p.team_id)?.name,
        status: p.status || 'active',
      }));
    }

    // C. Lấy Leads của sàn & đếm theo tình trạng chăm sóc khách hàng
    const leadStatusCounts: Record<LeadStatus, number> = {
      new: 0,
      unreachable: 0,
      invalid: 0,
      contacted: 0,
      qualifying: 0,
      doc_sent: 0,
      appointment_set: 0,
      consulted: 0,
      site_visit: 0,
      considering: 0,
      booking: 0,
      deposit: 0,
      contract: 0,
      after_sales: 0,
      lost: 0,
    };

    let agencyLeads: any[] = [];
    if (isLiveSupabaseConfigured) {
      let q = supabase.from('leads').select('status, project_id').eq('agency_id', agencyId);
      if (projectId) q = q.eq('project_id', projectId);
      const { data: lData } = await q;
      agencyLeads = lData || [];
    } else {
      const rawLeads = localStorage.getItem('crm_leads');
      const allL: any[] = rawLeads ? JSON.parse(rawLeads) : [];
      agencyLeads = allL.filter(l => l.agency_id === agencyId && (!projectId || l.project_id === projectId));
    }

    agencyLeads.forEach(l => {
      if (leadStatusCounts[l.status as LeadStatus] !== undefined) {
        leadStatusCounts[l.status as LeadStatus]++;
      }
    });

    // D. Lấy hợp đồng & giao dịch của sàn
    const transactions = await this.getTransactions({
      agencyId,
      projectId,
      type: 'contract',
      status: 'confirmed',
    });

    const totalRevenue = transactions.reduce((sum, t) => sum + (t.deal_value || t.amount || 0), 0);
    const totalCommission = transactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0);

    return {
      agency_id: agencyId,
      agency_name: agencyName,
      agency_code: agencyCode,
      director_name: directorName,
      total_members: members.length,
      members,
      lead_status_counts: leadStatusCounts,
      total_leads: agencyLeads.length,
      total_revenue: totalRevenue,
      total_contracts: transactions.length,
      total_commission: totalCommission,
    };
  }

  // 6. TÍNH NĂNG THI ĐUA (LEADERBOARDS)
  // Xếp hạng giữa các Sàn, Trưởng phòng, Team, Sale với bộ lọc Dự án hoặc Toàn hệ thống
  async getLeaderboard(params: {
    type: 'agency' | 'sales_manager' | 'team' | 'sale_agent';
    projectId?: string;
  }): Promise<LeaderboardItem[]> {
    const contracts = await this.getTransactions({
      projectId: params.projectId,
      type: 'contract',
      status: 'confirmed',
    });

    const itemsMap: Record<string, {
      id: string;
      name: string;
      subtitle?: string;
      revenue: number;
      contracts_count: number;
      commission: number;
    }> = {};

    // Grouping theo type
    for (const c of contracts) {
      let key = '';
      let name = '';
      let subtitle = '';
      const rev = c.deal_value || c.amount || 0;
      const comm = c.commission_amount || 0;
      const saleComm = c.sale_commission_amount || 0;

      if (params.type === 'agency') {
        key = c.agency_id || 'unknown-agency';
        name = c.agency_name || 'Sàn Giao Dịch';
        subtitle = `Mã sàn: ${key.slice(0, 8)}`;
        if (!itemsMap[key]) {
          itemsMap[key] = { id: key, name, subtitle, revenue: 0, contracts_count: 0, commission: 0 };
        }
        itemsMap[key].revenue += rev;
        itemsMap[key].contracts_count += 1;
        itemsMap[key].commission += comm;
      } else if (params.type === 'sales_manager') {
        key = c.agency_id || 'unknown-sm';
        name = c.agency_name ? `GĐ Sàn: ${c.agency_name}` : 'Trưởng Phòng Kinh Doanh';
        subtitle = `Quản lý: ${c.agency_name || 'Chi nhánh'}`;
        if (!itemsMap[key]) {
          itemsMap[key] = { id: key, name, subtitle, revenue: 0, contracts_count: 0, commission: 0 };
        }
        itemsMap[key].revenue += rev;
        itemsMap[key].contracts_count += 1;
        itemsMap[key].commission += Math.round(comm * 0.15); // Hoa hồng quản lý 15%
      } else if (params.type === 'team') {
        key = c.team_id || 'unknown-team';
        name = c.team_name || 'Team Kinh Doanh';
        subtitle = `Trực thuộc: ${c.agency_name || 'Sàn'}`;
        if (!itemsMap[key]) {
          itemsMap[key] = { id: key, name, subtitle, revenue: 0, contracts_count: 0, commission: 0 };
        }
        itemsMap[key].revenue += rev;
        itemsMap[key].contracts_count += 1;
        itemsMap[key].commission += Math.round(comm * 0.35); // Hoa hồng team 35%
      } else {
        // sale_agent
        key = c.sale_id || c.created_by || 'unknown-sale';
        name = c.sale_name || 'Chuyên viên tư vấn';
        subtitle = `${c.team_name || 'Team'} - ${c.agency_name || 'Sàn'}`;
        if (!itemsMap[key]) {
          itemsMap[key] = { id: key, name, subtitle, revenue: 0, contracts_count: 0, commission: 0 };
        }
        itemsMap[key].revenue += rev;
        itemsMap[key].contracts_count += 1;
        itemsMap[key].commission += saleComm;
      }
    }

    // Nếu không có hợp đồng nào cho 1 sàn/team, vẫn lấy danh sách gốc để bảng thi đua đầy đủ
    if (params.type === 'agency') {
      const agencies = INITIAL_AGENCIES;
      agencies.forEach(a => {
        if (!itemsMap[a.id]) {
          itemsMap[a.id] = {
            id: a.id,
            name: a.name,
            subtitle: a.code,
            revenue: 0,
            contracts_count: 0,
            commission: 0,
          };
        }
      });
    }

    const result: LeaderboardItem[] = Object.values(itemsMap).map(item => ({
      id: item.id,
      name: item.name,
      type: params.type,
      subtitle: item.subtitle,
      revenue: item.revenue,
      contracts_count: item.contracts_count,
      commission: item.commission,
      // Target progress ước lượng theo mốc 10 tỷ
      target_progress: Math.min(100, Math.round((item.revenue / 10000000000) * 100)),
    }));

    // Sắp xếp giảm dần theo doanh số (Doanh số cao nhất lên Top 1)
    result.sort((a, b) => b.revenue - a.revenue);

    // Gán hạng rank
    return result.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }
}

export const contractRepository = new ContractRepository();
