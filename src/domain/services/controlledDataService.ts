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
    if (!['admin', 'director'].includes(operator.role)) {
      throw new Error('Chỉ Admin hoặc Giám đốc Sàn mới có quyền quản trị sửa/xóa dữ liệu.');
    }

    // Impersonation check: Chặn mọi thao tác nhạy cảm khi đang mượn quyền
    if ((operator as any).is_impersonating || (operator as any).is_read_only) {
      throw new Error('Từ chối thao tác: Không được phép sửa/xóa dữ liệu trong chế độ Giả lập góc nhìn (Impersonation).');
    }

    // Giám đốc Sàn chỉ được thao tác trong sàn của mình
    if (operator.role === 'director') {
      if (targetAgencyId && targetAgencyId !== operator.agency_id) {
        throw new Error('Giám đốc Sàn chỉ có quyền thao tác trên dữ liệu thuộc sàn của mình.');
      }

      // Không được thao tác trên tài khoản Admin hoặc Director khác
      if (targetUser) {
        if (targetUser.role === 'admin' || targetUser.role === 'director') {
          throw new Error('Giám đốc Sàn không được phép sửa/xóa tài khoản của Admin hoặc Giám đốc Sàn khác.');
        }
      }
    }

    // Chống xóa hoặc khóa Admin cuối cùng của hệ thống
    if (targetUser && targetUser.role === 'admin') {
      const profiles: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]');
      const activeAdmins = profiles.filter(p => p.role === 'admin' && p.status === 'active');
      if (activeAdmins.length <= 1 && targetUser.id === activeAdmins[0]?.id) {
        throw new Error('Không thể khóa hoặc xóa Quản trị viên (Admin) duy nhất còn lại của hệ thống.');
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
    const itemIndex = trash.findIndex(t => t.id === trashId && !t.restored_at);
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
    operator: UserProfile
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

    // Nếu hợp đồng đã duyệt/hiệu lực: KHÔNG cho sửa trực tiếp các trường tiền tệ
    const isApprovedOrActive = contract.status === 'confirmed' || contract.approval_status === 'approved';
    const moneyFields = ['deal_value', 'commission_amount', 'sale_commission_rate', 'sale_commission_amount'];
    
    if (isApprovedOrActive) {
      const attemptingMoneyChange = moneyFields.some(f => (updates as any)[f] !== undefined && (updates as any)[f] !== (contract as any)[f]);
      if (attemptingMoneyChange) {
        throw new Error('Hợp đồng đã được duyệt không được phép sửa trực tiếp số tiền/hoa hồng. Phải tạo yêu cầu điều chỉnh (Contract Revision) để Admin phê duyệt và tự động sinh bút toán bù trừ.');
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

  softDeleteContract(contractId: string, reason: string, operator: UserProfile): TrashBinItem {
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

    // Chỉ cho phép xóa mềm Hợp đồng nháp (draft)
    if (contract.status === 'confirmed' || contract.approval_status === 'approved') {
      throw new Error('Chỉ có thể xóa mềm Hợp đồng ở trạng thái Nháp. Hợp đồng đã duyệt/hiệu lực chỉ được hủy theo vòng đời tài chính (Hoàn cọc / Thu hồi hoa hồng).');
    }

    contracts[idx] = {
      ...contract,
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
      entity_type: 'draft_contract',
      entity_id: contractId,
      agency_id: contract.agency_id,
      entity_name: contract.contract_code || contractId,
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
}

export const controlledDataService = new ControlledDataService();
