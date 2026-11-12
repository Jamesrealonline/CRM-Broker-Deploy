// ========================================================
// REAL ESTATE CRM - CONTROLLED DATA MANAGEMENT SERVICE (PHASE 7)
// Sửa / Xóa có kiểm soát (Admin & Giám đốc Sàn),
// Thùng rác (Trash Bin), Khóa lạc quan (Optimistic Locking),
// Chống leo thang quyền & Audit Diff Before/After
// ========================================================

import { 
  UserProfile, 
  Lead, 
  Transaction, 
  Team, 
  Agency, 
  TrashBinItem, 
  TrashEntityType, 
  FieldDiff, 
  ControlledAuditEntry 
} from '@/domain/types';
import { maskPhone, maskEmail } from '@/lib/utils';

const STORAGE_KEY_LEADS = 'crm_leads';
const STORAGE_KEY_CONTRACTS = 'crm_contracts';
const STORAGE_KEY_TEAMS = 'crm_teams';
const STORAGE_KEY_AGENCIES = 'crm_agencies';
const STORAGE_KEY_PROFILES = 'crm_profiles';
const STORAGE_KEY_TRASH = 'crm_trash_bins';
const STORAGE_KEY_CONTROLLED_AUDIT = 'crm_controlled_audit_logs';

export class ControlledDataService {
  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEY_TRASH)) {
      localStorage.setItem(STORAGE_KEY_TRASH, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_CONTROLLED_AUDIT)) {
      localStorage.setItem(STORAGE_KEY_CONTROLLED_AUDIT, JSON.stringify([]));
    }
  }

  // ========================================================
  // 1. KIỂM SOÁT PHẠM VI & CHỐNG LEO THANG QUYỀN
  // ========================================================
  assertScopeAndPermission(
    operator: UserProfile, 
    targetAgencyId?: string, 
    targetUser?: UserProfile
  ): void {
    if (!['admin', 'ceo', 'regional_director', 'director'].includes(operator.role)) {
      throw new Error('Chỉ Admin, Tổng Giám Đốc, Giám Đốc Vùng hoặc Giám đốc Sàn mới có quyền quản trị sửa/xóa dữ liệu.');
    }

    // Impersonation check: Chặn mọi thao tác nhạy cảm khi đang mượn quyền
    if ((operator as any).is_impersonating || (operator as any).is_read_only) {
      throw new Error('Từ chối thao tác: Không được phép sửa/xóa dữ liệu trong chế độ Giả lập góc nhìn (Impersonation).');
    }

    // Giám đốc Vùng: chỉ thao tác trong vùng của mình, không đụng CEO/Admin
    if (operator.role === 'regional_director') {
      if (targetUser) {
        if (targetUser.role === 'admin' || targetUser.role === 'ceo') {
          throw new Error('Giám đốc Vùng không được phép sửa/xóa tài khoản của Admin hoặc Tổng Giám Đốc.');
        }
      }
      if (targetAgencyId && operator.region_id) {
        const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
        const targetAgency = agencies.find(a => a.id === targetAgencyId);
        if (targetAgency && targetAgency.region_id && targetAgency.region_id !== operator.region_id) {
          throw new Error('Giám đốc Vùng chỉ có quyền thao tác trên dữ liệu thuộc vùng của mình.');
        }
      }
    }

    // Giám đốc Sàn chỉ được thao tác trong sàn của mình (trừ khi bật directorGlobalScope)
    const directorGlobalScope = typeof localStorage !== 'undefined' && localStorage.getItem('crm_director_global_scope') === 'true';

    if (operator.role === 'director' && !directorGlobalScope) {
      if (targetAgencyId && targetAgencyId !== operator.agency_id) {
        throw new Error('Giám đốc Sàn chỉ có quyền thao tác trên dữ liệu thuộc sàn của mình.');
      }

      // Không được thao tác trên tài khoản Admin, CEO, Giám đốc Vùng hoặc Director khác
      if (targetUser) {
        if (['admin', 'ceo', 'regional_director', 'director'].includes(targetUser.role)) {
          throw new Error('Giám đốc Sàn không được phép sửa/xóa tài khoản của Admin hoặc Giám đốc Sàn khác.');
        }
      }
    }

    // Chống xóa hoặc khóa Admin hoặc CEO duy nhất còn lại của hệ thống
    if (targetUser && targetUser.role === 'admin') {
      const profiles: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]');
      const activeAdmins = profiles.filter(p => p.role === 'admin' && p.status === 'active');
      if (activeAdmins.length <= 1 && targetUser.id === activeAdmins[0]?.id) {
        throw new Error('Không thể khóa hoặc xóa Quản trị viên (Admin) duy nhất còn lại của hệ thống.');
      }
    }

    if (targetUser && targetUser.role === 'ceo') {
      const profiles: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]');
      const activeCeos = profiles.filter(p => p.role === 'ceo' && p.status === 'active');
      if (activeCeos.length <= 1 && targetUser.id === activeCeos[0]?.id) {
        throw new Error('Không thể khóa hoặc xóa Tổng Giám Đốc (CEO) duy nhất còn lại của doanh nghiệp.');
      }
    }
  }

  // ========================================================
  // 2. KHÓA LẠC QUAN & AUDIT DIFF
  // ========================================================
  private verifyOptimisticLock(entityVersion: number | undefined, clientVersion: number): void {
    const currentVersion = entityVersion || 1;
    if (clientVersion !== currentVersion) {
      throw new Error(`Xung đột cập nhật dữ liệu (Optimistic Lock): Dữ liệu này đã được sửa đổi bởi người khác (phiên bản hiện tại: ${currentVersion}, phiên bản gửi lên: ${clientVersion}). Vui lòng tải lại để hợp nhất.`);
    }
  }

  private computeFieldDiffs(oldObj: Record<string, any>, newObj: Record<string, any>): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    for (const key of Object.keys(newObj)) {
      if (oldObj[key] !== newObj[key] && !['updated_at', 'version'].includes(key)) {
        let oldVal = oldObj[key];
        let newVal = newObj[key];
        let isMasked = false;

        // Mask PII trong audit log
        if (key.includes('phone')) {
          oldVal = oldVal ? maskPhone(oldVal) : oldVal;
          newVal = newVal ? maskPhone(newVal) : newVal;
          isMasked = true;
        } else if (key.includes('email')) {
          oldVal = oldVal ? maskEmail(oldVal) : oldVal;
          newVal = newVal ? maskEmail(newVal) : newVal;
          isMasked = true;
        }

        diffs.push({
          field: key,
          old_value: oldVal,
          new_value: newVal,
          is_pii_masked: isMasked
        });
      }
    }
    return diffs;
  }

  private recordAuditEntry(entry: Omit<ControlledAuditEntry, 'id' | 'created_at'>): void {
    this.ensureInitialized();
    const logs: ControlledAuditEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTROLLED_AUDIT) || '[]');
    logs.push({
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ...entry,
      created_at: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY_CONTROLLED_AUDIT, JSON.stringify(logs));
  }

  // ========================================================
  // 3. QUẢN TRỊ LEAD CÓ KIỂM SOÁT
  // ========================================================
  updateLeadControlled(
    leadId: string, 
    updates: Partial<Lead>, 
    clientVersion: number, 
    reason: string, 
    operator: UserProfile
  ): Lead {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do chỉnh sửa có kiểm soát là bắt buộc (tối thiểu 5 ký tự).');
    }

    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const leadIndex = leads.findIndex(l => l.id === leadId);
    if (leadIndex === -1) {
      throw new Error(`Không tìm thấy lead với ID: ${leadId}`);
    }

    const lead = leads[leadIndex];
    this.assertScopeAndPermission(operator, lead.agency_id);
    this.verifyOptimisticLock(lead.version, clientVersion);

    // Ghi nhận diff trước khi sửa
    const diffs = this.computeFieldDiffs(lead, updates);

    const updatedLead: Lead = {
      ...lead,
      ...updates,
      version: (lead.version || 1) + 1,
      updated_at: new Date().toISOString()
    };

    leads[leadIndex] = updatedLead;
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    this.recordAuditEntry({
      entity_type: 'lead',
      entity_id: leadId,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'update',
      reason,
      diffs
    });

    return updatedLead;
  }

  softDeleteLead(leadId: string, reason: string, operator: UserProfile): TrashBinItem {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Cần cung cấp lý do xóa lead hợp lệ (tối thiểu 5 ký tự).');
    }

    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const leadIndex = leads.findIndex(l => l.id === leadId && !l.deleted_at);
    if (leadIndex === -1) {
      throw new Error(`Không tìm thấy lead hoạt động với ID: ${leadId}`);
    }

    const lead = leads[leadIndex];
    this.assertScopeAndPermission(operator, lead.agency_id);

    // CHẶN XÓA NẾU ĐÃ PHÁT SINH HỢP ĐỒNG HIỆU LỰC
    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
    const activeContract = contracts.find(c => c.lead_id === leadId && c.status === 'confirmed');
    if (activeContract) {
      throw new Error('Không thể xóa lead đã phát sinh Hợp đồng giao dịch có hiệu lực. Vui lòng xử lý hủy hợp đồng theo quy trình tài chính trước.');
    }

    // 1. Đánh dấu xóa mềm trên lead
    leads[leadIndex] = {
      ...lead,
      deleted_at: new Date().toISOString(),
      deleted_by: operator.id,
      delete_reason: reason,
      version: (lead.version || 1) + 1
    };
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    // 2. Thêm vào thùng rác
    this.ensureInitialized();
    const trash: TrashBinItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRASH) || '[]');
    const trashItem: TrashBinItem = {
      id: `trash-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      entity_type: 'lead',
      entity_id: leadId,
      agency_id: lead.agency_id,
      entity_name: lead.customer_name || lead.notes || leadId,
      payload: lead,
      delete_reason: reason,
      deleted_by: operator.id,
      deleted_by_name: operator.full_name,
      deleted_at: new Date().toISOString()
    };
    trash.push(trashItem);
    localStorage.setItem(STORAGE_KEY_TRASH, JSON.stringify(trash));

    this.recordAuditEntry({
      entity_type: 'lead',
      entity_id: leadId,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'soft_delete',
      reason,
      diffs: [{ field: 'deleted_at', old_value: null, new_value: trashItem.deleted_at }]
    });

    return trashItem;
  }

  restoreLeadFromTrash(trashId: string, operator: UserProfile): Lead {
    this.ensureInitialized();
    const trash: TrashBinItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRASH) || '[]');
    const itemIndex = trash.findIndex(t => (t.id === trashId || t.entity_id === trashId) && !t.restored_at);
    if (itemIndex === -1) {
      throw new Error(`Không tìm thấy mục trong thùng rác: ${trashId}`);
    }

    const trashItem = trash[itemIndex];
    this.assertScopeAndPermission(operator, trashItem.agency_id);

    // Cập nhật thùng rác
    trash[itemIndex].restored_at = new Date().toISOString();
    trash[itemIndex].restored_by = operator.id;
    localStorage.setItem(STORAGE_KEY_TRASH, JSON.stringify(trash));

    // Khôi phục trong bảng leads và tính lại SLA 24h hợp lý
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const leadIndex = leads.findIndex(l => l.id === trashItem.entity_id);
    if (leadIndex === -1) {
      throw new Error('Dữ liệu gốc của lead không còn tồn tại để khôi phục.');
    }

    const restoredLead: Lead = {
      ...leads[leadIndex],
      deleted_at: undefined,
      deleted_by: undefined,
      delete_reason: undefined,
      // Tái tạo SLA chăm sóc 24h từ thời điểm khôi phục, tránh phạt oan nhân viên
      care_deadline_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      version: (leads[leadIndex].version || 1) + 1,
      updated_at: new Date().toISOString()
    };

    leads[leadIndex] = restoredLead;
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    this.recordAuditEntry({
      entity_type: 'lead',
      entity_id: trashItem.entity_id,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'restore',
      reason: 'Khôi phục từ Thùng rác',
      diffs: [{ field: 'deleted_at', old_value: trashItem.deleted_at, new_value: null }]
    });

    return restoredLead;
  }

  // ========================================================
  // 4. QUẢN TRỊ HỢP ĐỒNG CÓ KIỂM SOÁT
  // ========================================================
  updateContractControlled(
    contractId: string, 
    updates: Partial<Transaction>, 
    clientVersion: number, 
    reason: string, 
    operator: UserProfile,
    options?: { allowAdjustment?: boolean }
  ): Transaction {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do chỉnh sửa hợp đồng là bắt buộc.');
    }

    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
    const idx = contracts.findIndex(c => c.id === contractId);
    if (idx === -1) {
      throw new Error(`Không tìm thấy hợp đồng: ${contractId}`);
    }

    const contract = contracts[idx];
    this.assertScopeAndPermission(operator, contract.agency_id);
    this.verifyOptimisticLock(contract.version, clientVersion);

    // Nếu hợp đồng đã duyệt/hiệu lực: KHÔNG cho sửa trực tiếp các trường tiền tệ trừ khi cho phép bút toán điều chỉnh
    const isApprovedOrActive = contract.status === 'confirmed' || contract.approval_status === 'approved';
    const moneyFields = ['deal_value', 'commission_amount', 'sale_commission_rate', 'sale_commission_amount'];
    
    if (isApprovedOrActive) {
      const attemptingMoneyChange = moneyFields.some(f => (updates as any)[f] !== undefined && (updates as any)[f] !== (contract as any)[f]);
      if (attemptingMoneyChange && !options?.allowAdjustment) {
        throw new Error('Hợp đồng đã được duyệt không được phép sửa trực tiếp số tiền/hoa hồng. Phải tạo yêu cầu điều chỉnh (Contract Revision) để Admin phê duyệt và tự động sinh bút toán bù trừ.');
      }

      if (attemptingMoneyChange && options?.allowAdjustment) {
        // Tự động sinh bút toán bù trừ hoa hồng
        const oldComm = contract.commission_amount || 0;
        const newComm = updates.commission_amount !== undefined ? updates.commission_amount : oldComm;
        const commDiff = newComm - oldComm;
        if (commDiff !== 0) {
          const adjTx: Transaction = {
            id: `tx-adj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            lead_id: contract.lead_id,
            type: contract.type,
            code: `ADJ-${contract.code || contract.contract_code || contract.id}`,
            amount: updates.deal_value ? (updates.deal_value - (contract.deal_value || 0)) : 0,
            transaction_date: new Date().toISOString(),
            status: 'confirmed',
            contract_code: contract.contract_code,
            deal_value: updates.deal_value ? (updates.deal_value - (contract.deal_value || 0)) : 0,
            commission_amount: commDiff,
            sale_commission_amount: (updates.sale_commission_amount || 0) - (contract.sale_commission_amount || 0),
            notes: `Bút toán bù trừ điều chỉnh hợp đồng [${contract.contract_code}]: ${reason}`,
            created_by: operator.id,
            created_at: new Date().toISOString()
          };
          contracts.push(adjTx);
        }
      }
    }

    const diffs = this.computeFieldDiffs(contract, updates);

    const updatedContract: Transaction = {
      ...contract,
      ...updates,
      version: (contract.version || 1) + 1,
      updated_at: new Date().toISOString()
    };

    contracts[idx] = updatedContract;
    localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(contracts));

    this.recordAuditEntry({
      entity_type: 'contract',
      entity_id: contractId,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'update',
      reason,
      diffs
    });

    return updatedContract;
  }

  softDeleteContract(
    contractId: string, 
    reason: string, 
    operator: UserProfile,
    options?: { forceCancelApproved?: boolean }
  ): TrashBinItem {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do xóa hợp đồng là bắt buộc.');
    }

    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
    const idx = contracts.findIndex(c => c.id === contractId && !c.deleted_at);
    if (idx === -1) {
      throw new Error(`Không tìm thấy hợp đồng: ${contractId}`);
    }

    const contract = contracts[idx];
    this.assertScopeAndPermission(operator, contract.agency_id);

    const isApproved = contract.status === 'confirmed' || contract.approval_status === 'approved';
    if (isApproved && !options?.forceCancelApproved) {
      throw new Error('Chỉ có thể xóa mềm Hợp đồng ở trạng thái Nháp. Hợp đồng đã duyệt/hiệu lực chỉ được hủy theo vòng đời tài chính (Hoàn cọc / Thu hồi hoa hồng).');
    }

    // Nếu hợp đồng đã duyệt và forceCancelApproved = true: Hủy + ẩn, sinh bút toán đảo hoa hồng, giải phóng căn
    if (isApproved && options?.forceCancelApproved) {
      const reversal: Transaction = {
        id: `tx-rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        lead_id: contract.lead_id,
        type: contract.type,
        code: `REV-${contract.code || contract.contract_code || contract.id}`,
        amount: -(contract.amount || 0),
        transaction_date: new Date().toISOString(),
        status: 'refunded',
        contract_code: contract.contract_code,
        deal_value: -(contract.deal_value || 0),
        commission_amount: -(contract.commission_amount || 0),
        sale_commission_amount: -(contract.sale_commission_amount || 0),
        is_reversal: true,
        reversal_of_id: contract.id,
        reversal_reason: `Hủy hợp đồng có kiểm soát: ${reason}`,
        created_by: operator.id,
        created_at: new Date().toISOString()
      };
      contracts.push(reversal);

      // Giải phóng căn trong giỏ hàng (nếu có unit_code)
      if (contract.unit_code) {
        const units = JSON.parse(localStorage.getItem('crm_project_units') || '[]');
        const uIdx = units.findIndex((u: any) => u.unit_code === contract.unit_code);
        if (uIdx !== -1) {
          units[uIdx].status = 'available';
          delete units[uIdx].customer_name;
          delete units[uIdx].sale_name;
          localStorage.setItem('crm_project_units', JSON.stringify(units));
        }
      }
    }

    contracts[idx] = {
      ...contract,
      status: 'cancelled',
      deleted_at: new Date().toISOString(),
      deleted_by: operator.id,
      delete_reason: reason,
      version: (contract.version || 1) + 1
    };
    localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(contracts));

    this.ensureInitialized();
    const trash: TrashBinItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRASH) || '[]');
    const trashItem: TrashBinItem = {
      id: `trash-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      entity_type: isApproved ? 'contract' : 'draft_contract',
      entity_id: contractId,
      agency_id: contract.agency_id,
      entity_name: contract.contract_code || contract.code || contractId,
      payload: contract,
      delete_reason: reason,
      deleted_by: operator.id,
      deleted_by_name: operator.full_name,
      deleted_at: new Date().toISOString()
    };
    trash.push(trashItem);
    localStorage.setItem(STORAGE_KEY_TRASH, JSON.stringify(trash));

    this.recordAuditEntry({
      entity_type: 'contract',
      entity_id: contractId,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'soft_delete',
      reason,
      diffs: [{ field: 'deleted_at', old_value: null, new_value: trashItem.deleted_at }]
    });

    return trashItem;
  }

  restoreContractFromTrash(trashId: string, operator: UserProfile): Transaction {
    this.ensureInitialized();
    const trash: TrashBinItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRASH) || '[]');
    const itemIndex = trash.findIndex(t => (t.id === trashId || t.entity_id === trashId) && !t.restored_at);
    if (itemIndex === -1) {
      throw new Error(`Không tìm thấy hợp đồng trong thùng rác: ${trashId}`);
    }

    const trashItem = trash[itemIndex];
    this.assertScopeAndPermission(operator, trashItem.agency_id);

    trash[itemIndex].restored_at = new Date().toISOString();
    trash[itemIndex].restored_by = operator.id;
    localStorage.setItem(STORAGE_KEY_TRASH, JSON.stringify(trash));

    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
    const idx = contracts.findIndex(c => c.id === trashItem.entity_id);
    if (idx === -1) {
      throw new Error('Dữ liệu gốc của hợp đồng không còn tồn tại để khôi phục.');
    }

    const restoredContract: Transaction = {
      ...contracts[idx],
      status: 'confirmed',
      deleted_at: undefined,
      deleted_by: undefined,
      delete_reason: undefined,
      version: (contracts[idx].version || 1) + 1,
      updated_at: new Date().toISOString()
    };

    contracts[idx] = restoredContract;
    localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(contracts));

    this.recordAuditEntry({
      entity_type: 'contract',
      entity_id: trashItem.entity_id,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'restore',
      reason: 'Khôi phục hợp đồng từ Thùng rác',
      diffs: [{ field: 'deleted_at', old_value: trashItem.deleted_at, new_value: null }]
    });

    return restoredContract;
  }

  // ========================================================
  // 5. GIẢI THỂ ĐỘI NHÓM (TEAM DISSOLUTION)
  // ========================================================
  dissolveTeamControlled(
    teamId: string, 
    targetTeamId: string, 
    reason: string, 
    operator: UserProfile
  ): void {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do giải thể đội nhóm là bắt buộc.');
    }
    if (teamId === targetTeamId) {
      throw new Error('Đội nhóm tiếp nhận không thể trùng với đội nhóm giải thể.');
    }

    const teams: Team[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAMS) || '[]');
    const teamIndex = teams.findIndex(t => t.id === teamId && !t.deleted_at);
    if (teamIndex === -1) {
      throw new Error(`Không tìm thấy đội nhóm: ${teamId}`);
    }

    const team = teams[teamIndex];
    this.assertScopeAndPermission(operator, team.agency_id);

    const targetTeam = teams.find(t => t.id === targetTeamId && !t.deleted_at);
    if (!targetTeam) {
      throw new Error('Đội nhóm đích tiếp nhận không tồn tại hoặc đã bị xóa.');
    }

    // 1. Chuyển toàn bộ thành viên trong nhóm sang targetTeamId
    const profiles: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]');
    let membersReassigned = 0;
    for (let i = 0; i < profiles.length; i++) {
      if (profiles[i].team_id === teamId) {
        profiles[i].team_id = targetTeamId;
        membersReassigned++;
      }
    }
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));

    // 2. Chuyển toàn bộ leads mở sang targetTeamId
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    let leadsReassigned = 0;
    for (let i = 0; i < leads.length; i++) {
      if (leads[i].team_id === teamId && !leads[i].deleted_at) {
        leads[i].team_id = targetTeamId;
        leadsReassigned++;
      }
    }
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    // 3. Đánh dấu xóa mềm nhóm
    teams[teamIndex] = {
      ...team,
      deleted_at: new Date().toISOString(),
      deleted_by: operator.id,
      delete_reason: `${reason} (Đã chuyển giao ${membersReassigned} nhân sự và ${leadsReassigned} leads sang nhóm ${targetTeam.name})`,
      version: (team.version || 1) + 1
    };
    localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(teams));

    this.recordAuditEntry({
      entity_type: 'team',
      entity_id: teamId,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'dissolve',
      reason,
      diffs: [
        { field: 'deleted_at', old_value: null, new_value: teams[teamIndex].deleted_at },
        { field: 'target_team_id', old_value: null, new_value: targetTeamId }
      ]
    });
  }

  // ========================================================
  // 6. TRUY VẤN THÙNG RÁC & NHẬT KÝ KIỂM TOÁN
  // ========================================================
  getTrashBin(operator: UserProfile, entityType?: TrashEntityType): TrashBinItem[] {
    this.ensureInitialized();
    const trash: TrashBinItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRASH) || '[]');
    
    // Giám đốc Sàn chỉ thấy mục thuộc sàn mình; Admin thấy tất cả
    let filtered = trash.filter(t => !t.restored_at);
    if (operator.role === 'director') {
      filtered = filtered.filter(t => t.agency_id === operator.agency_id);
    } else if (operator.role !== 'admin') {
      return []; // Các vai trò khác không có quyền
    }

    if (entityType) {
      filtered = filtered.filter(t => t.entity_type === entityType);
    }

    return filtered;
  }

  getControlledAuditLogs(operator: UserProfile, entityId?: string): ControlledAuditEntry[] {
    this.ensureInitialized();
    const logs: ControlledAuditEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTROLLED_AUDIT) || '[]');
    if (!['admin', 'director'].includes(operator.role)) {
      return [];
    }

    if (entityId) {
      return logs.filter(l => l.entity_id === entityId);
    }
    return logs;
  }

  // ========================================================
  // 7. XÓA SÀN & NHÂN SỰ CÓ BẮT BUỘC CHUYỂN GIAO
  // ========================================================
  deleteAgencyControlled(
    agencyId: string,
    targetAgencyId: string,
    reason: string,
    operator: UserProfile
  ): void {
    if (operator.role !== 'admin') {
      throw new Error('Chỉ Admin hệ thống mới có quyền giải thể hoặc xóa sàn phân phối.');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do xóa sàn là bắt buộc.');
    }
    if (agencyId === targetAgencyId) {
      throw new Error('Sàn tiếp nhận không thể trùng với sàn giải thể.');
    }

    const agencies: Agency[] = JSON.parse(localStorage.getItem(STORAGE_KEY_AGENCIES) || '[]');
    const aIdx = agencies.findIndex(a => a.id === agencyId && a.status !== 'suspended');
    if (aIdx === -1) {
      throw new Error(`Không tìm thấy sàn hoạt động: ${agencyId}`);
    }

    const targetAgency = agencies.find(a => a.id === targetAgencyId && a.status !== 'suspended');
    if (!targetAgency) {
      throw new Error('Sàn tiếp nhận không tồn tại hoặc đã ngừng hoạt động.');
    }

    // 1. Chuyển toàn bộ đội nhóm sang targetAgencyId
    const teams: Team[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAMS) || '[]');
    let teamsReassigned = 0;
    for (let i = 0; i < teams.length; i++) {
      if (teams[i].agency_id === agencyId && !teams[i].deleted_at) {
        teams[i].agency_id = targetAgencyId;
        teamsReassigned++;
      }
    }
    localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(teams));

    // 2. Chuyển toàn bộ nhân sự sang targetAgencyId
    const profiles: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]');
    let profilesReassigned = 0;
    for (let i = 0; i < profiles.length; i++) {
      if (profiles[i].agency_id === agencyId) {
        profiles[i].agency_id = targetAgencyId;
        profilesReassigned++;
      }
    }
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));

    // 3. Chuyển toàn bộ leads mở sang targetAgencyId
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    let leadsReassigned = 0;
    for (let i = 0; i < leads.length; i++) {
      if (leads[i].agency_id === agencyId && !leads[i].deleted_at) {
        leads[i].agency_id = targetAgencyId;
        leadsReassigned++;
      }
    }
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    agencies[aIdx] = {
      ...agencies[aIdx],
      status: 'suspended'
    };
    localStorage.setItem(STORAGE_KEY_AGENCIES, JSON.stringify(agencies));

    this.recordAuditEntry({
      entity_type: 'agency' as any,
      entity_id: agencyId,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'dissolve' as any,
      reason: `${reason} (Đã chuyển giao ${teamsReassigned} nhóm, ${profilesReassigned} nhân sự và ${leadsReassigned} leads sang sàn ${targetAgency.name})`,
      diffs: [
        { field: 'status', old_value: 'active', new_value: 'suspended' },
        { field: 'target_agency_id', old_value: null, new_value: targetAgencyId }
      ]
    });
  }

  deleteEmployeeControlled(
    employeeId: string,
    targetEmployeeId: string,
    reason: string,
    operator: UserProfile
  ): void {
    if (!reason || reason.trim().length < 5) {
      throw new Error('Lý do cho thôi việc / xóa nhân sự là bắt buộc.');
    }
    if (employeeId === targetEmployeeId) {
      throw new Error('Nhân sự tiếp nhận không thể trùng với nhân sự bị cho thôi việc.');
    }

    const profiles: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]');
    const empIdx = profiles.findIndex(p => p.id === employeeId);
    if (empIdx === -1) {
      throw new Error(`Không tìm thấy nhân sự: ${employeeId}`);
    }

    const employee = profiles[empIdx];
    this.assertScopeAndPermission(operator, employee.agency_id, employee);

    const targetEmp = profiles.find(p => p.id === targetEmployeeId && p.status === 'active');
    if (!targetEmp) {
      throw new Error('Nhân sự đích tiếp nhận không tồn tại hoặc đã bị khóa/nghỉ việc.');
    }

    // 1. Chuyển toàn bộ leads đang mở sang targetEmployeeId
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    let leadsReassigned = 0;
    for (let i = 0; i < leads.length; i++) {
      if (leads[i].assigned_to === employeeId && !leads[i].deleted_at && !['contract', 'lost'].includes(leads[i].status)) {
        leads[i].assigned_to = targetEmployeeId;
        leads[i].assigned_name = targetEmp.full_name;
        leadsReassigned++;
      }
    }
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));

    profiles[empIdx] = {
      ...employee,
      status: 'terminated' as any,
      accepts_leads: false
    };
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));

    this.recordAuditEntry({
      entity_type: 'employee' as any,
      entity_id: employeeId,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'terminate' as any,
      reason: `${reason} (Đã bàn giao ${leadsReassigned} leads cho ${targetEmp.full_name})`,
      diffs: [
        { field: 'status', old_value: employee.status, new_value: 'terminated' },
        { field: 'target_employee_id', old_value: null, new_value: targetEmployeeId }
      ]
    });
  }

  // ========================================================
  // 8. XÓA VĨNH VIỄN KHỎI THÙNG RÁC (HARD DELETE - ADMIN ONLY)
  // ========================================================
  hardDeleteTrashItem(trashId: string, operator: UserProfile): void {
    if (operator.role !== 'admin') {
      throw new Error('Chỉ Admin hệ thống mới có quyền xóa vĩnh viễn (Hard Delete) khỏi Thùng rác.');
    }
    this.ensureInitialized();
    const trash: TrashBinItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRASH) || '[]');
    const itemIndex = trash.findIndex(t => t.id === trashId || t.entity_id === trashId);
    if (itemIndex === -1) {
      throw new Error(`Không tìm thấy mục trong thùng rác: ${trashId}`);
    }

    const item = trash[itemIndex];
    trash.splice(itemIndex, 1);
    localStorage.setItem(STORAGE_KEY_TRASH, JSON.stringify(trash));

    if (item.entity_type === 'lead') {
      const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
      const filtered = leads.filter(l => l.id !== item.entity_id);
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(filtered));
    } else if (item.entity_type === 'contract' || item.entity_type === 'draft_contract') {
      const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
      const filtered = contracts.filter(c => c.id !== item.entity_id);
      localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(filtered));
    } else if (item.entity_type === 'employee') {
      const profiles: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]');
      const filtered = profiles.filter(p => p.id !== item.entity_id);
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(filtered));
    }

    this.recordAuditEntry({
      entity_type: item.entity_type as any,
      entity_id: item.entity_id,
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'hard_delete' as any,
      reason: `Xóa vĩnh viễn khỏi Thùng rác: ${item.delete_reason || ''}`,
      diffs: [{ field: 'hard_deleted', old_value: false, new_value: true }]
    });
  }

  // ========================================================
  // 9. THAO TÁC HÀNG LOẠT VÀ HOÀN TÁC (BATCH OPERATIONS)
  // ========================================================
  executeBatchSoftDelete(
    entityType: 'lead' | 'contract',
    entityIds: string[],
    reason: string,
    operator: UserProfile
  ): { batch_id: string; affected_count: number } {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    let count = 0;
    for (const id of entityIds) {
      if (entityType === 'lead') {
        const item = this.softDeleteLead(id, `${reason} [Batch: ${batchId}]`, operator);
        (item as any).batch_id = batchId;
      }
      count++;
    }
    return { batch_id: batchId, affected_count: count };
  }

  revertBatch(batchId: string, operator: UserProfile): { restored_count: number } {
    this.ensureInitialized();
    const trash: TrashBinItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRASH) || '[]');
    const batchItems = trash.filter(t => (t as any).batch_id === batchId && !t.restored_at);
    let count = 0;
    for (const item of batchItems) {
      if (item.entity_type === 'lead') {
        this.restoreLeadFromTrash(item.id, operator);
        count++;
      }
    }
    return { restored_count: count };
  }

  // ========================================================
  // 10. QUẢN LÝ DỮ LIỆU MẪU (SAMPLE DATA PURGE & SEED)
  // ========================================================
  purgeSampleData(operator: UserProfile): { deleted_leads: number; deleted_customers: number; deleted_contracts: number } {
    if (operator.role !== 'admin') {
      throw new Error('Chỉ Admin mới có quyền dọn dẹp dữ liệu mẫu.');
    }
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const remainingLeads = leads.filter(l => !l.is_sample && l.created_via !== 'sample_seed');
    const deletedLeads = leads.length - remainingLeads.length;
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(remainingLeads));

    const customers: any[] = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    const remainingCustomers = customers.filter(c => !c.is_sample);
    const deletedCustomers = customers.length - remainingCustomers.length;
    localStorage.setItem('crm_customers', JSON.stringify(remainingCustomers));

    const contracts: Transaction[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]');
    const remainingContracts = contracts.filter(c => !c.is_sample);
    const deletedContracts = contracts.length - remainingContracts.length;
    localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(remainingContracts));

    this.recordAuditEntry({
      entity_type: 'lead' as any,
      entity_id: 'sample_data_purge',
      operator_id: operator.id,
      operator_name: operator.full_name,
      operator_role: operator.role,
      action: 'purge' as any,
      reason: 'Xóa toàn bộ dữ liệu mẫu',
      diffs: [{ field: 'sample_data_purged', old_value: true, new_value: false }]
    });

    return {
      deleted_leads: deletedLeads,
      deleted_customers: deletedCustomers,
      deleted_contracts: deletedContracts
    };
  }

  seedSampleLeads(operator: UserProfile): { created_count: number } {
    if (operator.role !== 'admin') {
      throw new Error('Chỉ Admin mới có quyền khởi tạo dữ liệu mẫu.');
    }
    const leads: Lead[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADS) || '[]');
    const existingSample = leads.filter(l => l.is_sample || l.created_via === 'sample_seed');
    if (existingSample.length >= 10) {
      return { created_count: existingSample.length };
    }

    const sampleLeadTemplates: Array<Partial<Lead>> = [
      { id: 'sample-lead-01', customer_name: 'Phạm Nhật Minh', customer_phone: '0901234001', customer_email: 'minh.pn@sample.vn', budget_min: 3000000000, budget_max: 5000000000, status: 'new', lead_score: 85, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-02', customer_name: 'Nguyễn Thị Hương', customer_phone: '0901234002', customer_email: 'huong.nt@sample.vn', budget_min: 5000000000, budget_max: 8000000000, status: 'contacted', lead_score: 90, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-03', customer_name: 'Trần Đình Khang', customer_phone: '0901234003', customer_email: 'khang.td@sample.vn', budget_min: 2500000000, budget_max: 4000000000, status: 'qualifying', lead_score: 75, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-04', customer_name: 'Lê Hoàng Nam', customer_phone: '0901234004', customer_email: 'nam.lh@sample.vn', budget_min: 6000000000, budget_max: 10000000000, status: 'doc_sent', lead_score: 88, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-05', customer_name: 'Vũ Bích Ngọc', customer_phone: '0901234005', customer_email: 'ngoc.vb@sample.vn', budget_min: 4000000000, budget_max: 6500000000, status: 'appointment_set', lead_score: 92, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-06', customer_name: 'Đỗ Mạnh Tuấn', customer_phone: '0901234006', customer_email: 'tuan.dm@sample.vn', budget_min: 3500000000, budget_max: 5500000000, status: 'site_visit', lead_score: 95, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-07', customer_name: 'Bùi Thanh Mai', customer_phone: '0901234007', customer_email: 'mai.bt@sample.vn', budget_min: 7000000000, budget_max: 12000000000, status: 'considering', lead_score: 80, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-08', customer_name: 'Hoàng Kim Oanh', customer_phone: '0901234008', customer_email: 'oanh.hk@sample.vn', budget_min: 4500000000, budget_max: 7000000000, status: 'booking', lead_score: 96, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-09', customer_name: 'Ngô Hải Long', customer_phone: '0901234009', customer_email: 'long.nh@sample.vn', budget_min: 8000000000, budget_max: 15000000000, status: 'deposit', lead_score: 98, is_sample: true, created_via: 'sample_seed' },
      { id: 'sample-lead-10', customer_name: 'Đặng Thảo Vy', customer_phone: '0901234010', customer_email: 'vy.dt@sample.vn', budget_min: 5000000000, budget_max: 9000000000, status: 'contract', lead_score: 100, is_sample: true, created_via: 'sample_seed' },
    ];

    let added = 0;
    for (const item of sampleLeadTemplates) {
      if (!leads.some(l => l.id === item.id)) {
        leads.push({
          ...item,
          customer_id: `cust-${item.id}`,
          project_id: 'project-default',
          created_at: new Date().toISOString(),
          purpose: 'investment'
        } as Lead);
        added++;
      }
    }
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    return { created_count: added };
  }

  isDirectorGlobalScopeEnabled(): boolean {
    return typeof window !== 'undefined' && localStorage.getItem('crm_director_global_scope') === 'true';
  }

  setDirectorGlobalScope(enabled: boolean): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_director_global_scope', enabled ? 'true' : 'false');
    }
  }

}

export const controlledDataService = new ControlledDataService();
