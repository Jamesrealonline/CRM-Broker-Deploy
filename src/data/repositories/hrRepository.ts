// ========================================================
// REAL ESTATE CRM - COMPREHENSIVE HR LIFECYCLE REPOSITORY
// Quản lý Vòng đời Nhân sự: Tuyển dụng (ATS) -> Nhận việc -> 
// Hồ sơ 360 & Bảo mật dữ liệu cá nhân -> Đào tạo -> Hiệu suất -> Phép -> 
// Điều chuyển / Thăng giáng (Maker-Checker) -> Kỷ luật -> Nghỉ việc
// ========================================================

import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { 
  UserProfile, 
  EmployeeRecord, 
  EmployeePrivate, 
  PersonnelEvent, 
  PersonnelTransferRequest, 
  EmploymentContract, 
  BrokerCertificate, 
  EmployeeDocument, 
  LeaveType, 
  LeaveBalance, 
  LeaveRequest, 
  JobRequisition, 
  Candidate, 
  PerformanceTarget, 
  CoachingNote, 
  PerformanceReview, 
  DisciplinaryRecord, 
  OnboardingTask,
  UserRole
} from '@/domain/types';
import { teamRepository, CreateUserInput } from './teamRepository';
import { auditRepository } from './auditRepository';
import { contractRepository } from './contractRepository';
import { normalizePhone } from '@/lib/utils';
import { maskPhone, maskName, computePhoneHash } from '@/lib/masking';
import { assertRateLimit } from '@/lib/rateLimiter';
import { authRepository } from './authRepository';

const STORAGE_KEY_EMPLOYEE_RECORDS = 'crm_employee_records';
const STORAGE_KEY_EMPLOYEE_PRIVATE = 'crm_employee_private';
const STORAGE_KEY_PERSONNEL_EVENTS = 'crm_personnel_events';
const STORAGE_KEY_TRANSFER_REQUESTS = 'crm_personnel_transfers';
const STORAGE_KEY_CONTRACTS = 'crm_employment_contracts';
const STORAGE_KEY_BROKER_CERTS = 'crm_broker_certificates';
const STORAGE_KEY_DOCUMENTS = 'crm_employee_documents';
const STORAGE_KEY_LEAVE_TYPES = 'crm_leave_types';
const STORAGE_KEY_LEAVE_BALANCES = 'crm_leave_balances';
const STORAGE_KEY_LEAVE_REQUESTS = 'crm_leave_requests';
const STORAGE_KEY_REQUISITIONS = 'crm_job_requisitions';
const STORAGE_KEY_CANDIDATES = 'crm_candidates';
const STORAGE_KEY_COACHING = 'crm_coaching_notes';
const STORAGE_KEY_TARGETS = 'crm_performance_targets';
const STORAGE_KEY_REVIEWS = 'crm_performance_reviews';
const STORAGE_KEY_DISCIPLINARY = 'crm_disciplinary_records';
const STORAGE_KEY_ONBOARDING = 'crm_onboarding_tasks';

export interface EmployeeFilters {
  agencyId?: string;
  teamId?: string;
  role?: string;
  status?: string;
  employmentType?: string;
  search?: string;
}

export class HRRepository {
  private ensureInitialized() {
    const profiles = teamRepository.getProfiles(); // triggers initial profiles if needed

    if (!localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS)) {
      const records: EmployeeRecord[] = [
        {
          id: 'rec-001',
          user_id: 'aaaaaaaa-1111-1111-1111-111111111111',
          employee_code: 'EMP-ADM-001',
          employment_type: 'official',
          title: 'Quản Trị Viên Hệ Thống',
          level: 5,
          join_date: '2023-01-01',
          status: 'official',
        },
        {
          id: 'rec-002',
          user_id: 'aaaaaaaa-2222-1111-1111-111111111111',
          employee_code: 'EMP-DIR-001',
          employment_type: 'official',
          title: 'Tổng Giám Đốc',
          level: 5,
          join_date: '2023-01-01',
          status: 'official',
        },
        {
          id: 'rec-003',
          user_id: 'aaaaaaaa-3333-1111-1111-111111111111',
          employee_code: 'EMP-MKT-001',
          employment_type: 'official',
          title: 'Marketing Manager',
          level: 4,
          direct_manager_id: 'aaaaaaaa-2222-1111-1111-111111111111',
          join_date: '2023-03-15',
          status: 'official',
        },
        {
          id: 'rec-004',
          user_id: 'aaaaaaaa-4444-1111-1111-111111111111',
          employee_code: 'EMP-SM-001',
          employment_type: 'official',
          title: 'Giám Đốc Sàn Q1',
          level: 4,
          direct_manager_id: 'aaaaaaaa-2222-1111-1111-111111111111',
          join_date: '2023-04-01',
          status: 'official',
        },
        {
          id: 'rec-005',
          user_id: 'aaaaaaaa-5555-1111-1111-111111111111',
          employee_code: 'EMP-TL-001',
          employment_type: 'official',
          title: 'Trưởng Nhóm Kinh Doanh Eagle',
          level: 3,
          direct_manager_id: 'aaaaaaaa-4444-1111-1111-111111111111',
          join_date: '2023-06-01',
          status: 'official',
        },
        {
          id: 'rec-006',
          user_id: 'aaaaaaaa-6666-1111-1111-111111111111',
          employee_code: 'EMP-SA-001',
          employment_type: 'official',
          title: 'Chuyên Viên Tư Vấn Cao Cấp',
          level: 2,
          direct_manager_id: 'aaaaaaaa-5555-1111-1111-111111111111',
          join_date: '2024-01-10',
          probation_end_date: '2024-03-10',
          status: 'official',
        },
      ];
      localStorage.setItem(STORAGE_KEY_EMPLOYEE_RECORDS, JSON.stringify(records));
    }

    if (!localStorage.getItem(STORAGE_KEY_EMPLOYEE_PRIVATE)) {
      const priv: EmployeePrivate[] = [
        {
          id: 'priv-006',
          user_id: 'aaaaaaaa-6666-1111-1111-111111111111',
          date_of_birth: '1996-05-18',
          id_card_number: '079196001234',
          id_card_issue_date: '2021-08-15',
          id_card_issue_place: 'Cục Cảnh sát QLHC về TTXH',
          permanent_address: '128 Điện Biên Phủ, Phường Đa Kao, Quận 1, TP.HCM',
          current_address: '25 Nguyễn Hữu Cảnh, P.22, Bình Thạnh, TP.HCM',
          tax_id: '8392019482',
          bank_account_number: '19034567891011',
          bank_name: 'Techcombank',
          bank_branch: 'Chi nhánh Sài Gòn',
          emergency_contact_name: 'Phạm Văn Nam (Bố)',
          emergency_contact_phone: '0903112233',
          emergency_contact_relationship: 'Bố ruột',
        }
      ];
      localStorage.setItem(STORAGE_KEY_EMPLOYEE_PRIVATE, JSON.stringify(priv));
    }

    if (!localStorage.getItem(STORAGE_KEY_BROKER_CERTS)) {
      const certs: BrokerCertificate[] = [
        {
          id: 'cert-001',
          user_id: 'aaaaaaaa-6666-1111-1111-111111111111',
          certificate_number: 'BĐS-HCM-2024-8899',
          issuing_authority: 'Sở Xây Dựng TP. Hồ Chí Minh',
          issue_date: '2024-02-15',
          expiry_date: '2029-02-15', // 5 years
          status: 'active',
        },
        {
          id: 'cert-002',
          user_id: 'aaaaaaaa-5555-1111-1111-111111111111',
          certificate_number: 'BĐS-HCM-2021-3321',
          issuing_authority: 'Sở Xây Dựng TP. Hồ Chí Minh',
          issue_date: '2021-11-20',
          expiry_date: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10), // Hết hạn trong 25 ngày (Cảnh báo gấp)
          status: 'expiring_soon',
        }
      ];
      localStorage.setItem(STORAGE_KEY_BROKER_CERTS, JSON.stringify(certs));
    }

    if (!localStorage.getItem(STORAGE_KEY_LEAVE_TYPES)) {
      const types: LeaveType[] = [
        { id: 'lt-1', code: 'annual', name: 'Nghỉ phép năm', default_days_per_year: 12, is_paid: true, requires_approval: true },
        { id: 'lt-2', code: 'sick', name: 'Nghỉ ốm hưởng BHXH', default_days_per_year: 0, is_paid: false, requires_approval: true },
        { id: 'lt-3', code: 'unpaid', name: 'Nghỉ không hưởng lương', default_days_per_year: 0, is_paid: false, requires_approval: true },
        { id: 'lt-4', code: 'bereavement', name: 'Nghỉ hiếu hỉ', default_days_per_year: 3, is_paid: true, requires_approval: true },
      ];
      localStorage.setItem(STORAGE_KEY_LEAVE_TYPES, JSON.stringify(types));
    }

    if (!localStorage.getItem(STORAGE_KEY_LEAVE_BALANCES)) {
      const balances: LeaveBalance[] = [
        {
          id: 'lb-006',
          user_id: 'aaaaaaaa-6666-1111-1111-111111111111',
          year: new Date().getFullYear(),
          leave_type_id: 'lt-1',
          leave_type_name: 'Nghỉ phép năm',
          total_entitlement: 12,
          used_days: 2,
          remaining_days: 10,
        }
      ];
      localStorage.setItem(STORAGE_KEY_LEAVE_BALANCES, JSON.stringify(balances));
    }

    if (!localStorage.getItem(STORAGE_KEY_REQUISITIONS)) {
      const reqs: JobRequisition[] = [
        {
          id: 'req-01',
          title: 'Tuyển dụng 5 Chuyên Viên Kinh Doanh Dự Án Vinhomes',
          agency_id: '22222222-1111-1111-1111-111111111111',
          agency_name: 'Sàn Giao Dịch Trung Tâm Q1',
          team_id: '44444444-1111-1111-1111-111111111111',
          team_name: 'Team Eagle Q1',
          target_count: 5,
          hired_count: 2,
          status: 'open',
          created_by: 'aaaaaaaa-4444-1111-1111-111111111111',
          created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        }
      ];
      localStorage.setItem(STORAGE_KEY_REQUISITIONS, JSON.stringify(reqs));
    }

    if (!localStorage.getItem(STORAGE_KEY_CANDIDATES)) {
      const cands: Candidate[] = [
        {
          id: 'cand-01',
          requisition_id: 'req-01',
          full_name: 'Nguyễn Văn Đạt',
          phone: '0988776655',
          phone_normalized: '0988776655',
          phone_hash: computePhoneHash('0988776655'),
          email: 'dat.nguyen@gmail.com',
          source: 'Tuyển dụng trực tiếp',
          stage: 'interview',
          is_rehire: false,
          notes: 'Kinh nghiệm 2 năm bán căn hộ cao cấp',
          created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        {
          id: 'cand-02',
          requisition_id: 'req-01',
          full_name: 'Hoàng Kim Ngân',
          phone: '0933221100',
          phone_normalized: '0933221100',
          phone_hash: computePhoneHash('0933221100'),
          email: 'ngan.hoang@gmail.com',
          source: 'Nội bộ giới thiệu',
          referrer_id: 'aaaaaaaa-6666-1111-1111-111111111111',
          referrer_name: 'Phạm Mai Anh',
          stage: 'offer',
          is_rehire: false,
          notes: 'Đã hoàn tất phỏng vấn Giám đốc sàn, chuẩn bị nhận việc',
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        }
      ];
      localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(cands));
    }

    if (!localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS)) {
      const events: PersonnelEvent[] = [
        {
          id: 'ev-01',
          user_id: 'aaaaaaaa-6666-1111-1111-111111111111',
          event_type: 'hired',
          effective_date: '2024-01-10',
          actor_id: 'aaaaaaaa-1111-1111-1111-111111111111',
          actor_name: 'Quản Trị Viên Hệ Thống',
          reason: 'Tuyển dụng nhân sự đợt 1/2024',
          created_at: '2024-01-10T08:30:00Z',
        },
        {
          id: 'ev-02',
          user_id: 'aaaaaaaa-6666-1111-1111-111111111111',
          event_type: 'probation_passed',
          effective_date: '2024-03-10',
          actor_id: 'aaaaaaaa-4444-1111-1111-111111111111',
          actor_name: 'Nguyễn Hoàng Long',
          reason: 'Hoàn thành chỉ tiêu thử việc đạt 150% doanh số',
          created_at: '2024-03-10T10:00:00Z',
        }
      ];
      localStorage.setItem(STORAGE_KEY_PERSONNEL_EVENTS, JSON.stringify(events));
    }
  }

  // 1. LẤY DANH SÁCH NHÂN SỰ KÈM PHÂN QUYỀN
  async getEmployees(filters: EmployeeFilters = {}, currentUser: UserProfile): Promise<Array<UserProfile & { record?: EmployeeRecord }>> {
    assertRateLimit(currentUser.id, 'hr/get_employees', 60);

    const allProfiles = await teamRepository.getProfiles();
    this.ensureInitialized();
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');

    // Phân quyền dữ liệu theo vai trò
    let permittedProfiles = allProfiles;
    const role = currentUser.role;

    if (role === 'sale_agent') {
      // Sale chỉ xem được chính mình và các đồng đội trong cùng team
      permittedProfiles = allProfiles.filter(p => p.id === currentUser.id || (currentUser.team_id && p.team_id === currentUser.team_id));
    } else if (role === 'team_leader') {
      // Team leader xem được thành viên trong team của mình
      permittedProfiles = allProfiles.filter(p => p.id === currentUser.id || p.team_id === currentUser.team_id);
    } else if (role === 'sales_manager') {
      // Sales manager xem được toàn bộ nhân sự trong sàn mình phụ trách
      permittedProfiles = allProfiles.filter(p => p.id === currentUser.id || p.agency_id === currentUser.agency_id);
    } else if (role === 'marketing_manager') {
      // Marketing manager xem danh sách cơ bản để phối hợp chiến dịch
      permittedProfiles = allProfiles;
    }
    // admin, director, hr_admin: Toàn quyền xem tất cả

    // Lọc theo bộ lọc giao diện
    let filtered = permittedProfiles;
    if (filters.agencyId && filters.agencyId !== 'all') {
      filtered = filtered.filter(p => p.agency_id === filters.agencyId);
    }
    if (filters.teamId && filters.teamId !== 'all') {
      filtered = filtered.filter(p => p.team_id === filters.teamId);
    }
    if (filters.role && filters.role !== 'all') {
      filtered = filtered.filter(p => p.role === filters.role);
    }
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(p => p.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.includes(q)
      );
    }

    return filtered.map(p => {
      const rec = records.find(r => r.user_id === p.id);
      return {
        ...p,
        record: rec,
      };
    });
  }

  // 2. HỒ SƠ 360 ĐỘ NHÂN SỰ (9 TABS PHÂN QUYỀN)
  async getEmployee360Profile(userId: string, currentUser: UserProfile): Promise<{
    profile: UserProfile;
    record?: EmployeeRecord;
    hasPrivateAccess: boolean;
    maskedPrivate?: Partial<EmployeePrivate>;
    contracts: EmploymentContract[];
    certificates: BrokerCertificate[];
    documents: EmployeeDocument[];
    leaveBalances: LeaveBalance[];
    leaveRequests: LeaveRequest[];
    targets: PerformanceTarget[];
    coachingNotes: CoachingNote[];
    reviews: PerformanceReview[];
    disciplinaryRecords: DisciplinaryRecord[];
    events: PersonnelEvent[];
    onboardingTasks: OnboardingTask[];
  }> {
    this.ensureInitialized();
    const profiles = await teamRepository.getProfiles();
    const target = profiles.find(p => p.id === userId);
    if (!target) throw new Error('Không tìm thấy nhân sự!');

    const isSelf = currentUser.id === userId;
    const isHrOrAdmin = ['admin', 'director', 'hr_admin'].includes(currentUser.role);
    const isDirectManager = currentUser.role === 'team_leader' && currentUser.team_id === target.team_id;

    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const rec = records.find(r => r.user_id === userId);

    const certs: BrokerCertificate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_BROKER_CERTS) || '[]').filter((c: any) => c.user_id === userId);
    const contracts: EmploymentContract[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CONTRACTS) || '[]').filter((c: any) => c.user_id === userId);
    const documents: EmployeeDocument[] = JSON.parse(localStorage.getItem(STORAGE_KEY_DOCUMENTS) || '[]').filter((d: any) => d.user_id === userId);
    const leaveBalances: LeaveBalance[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_BALANCES) || '[]').filter((b: any) => b.user_id === userId);
    const leaveRequests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_REQUESTS) || '[]').filter((r: any) => r.user_id === userId);
    const targets: PerformanceTarget[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGETS) || '[]').filter((t: any) => t.user_id === userId);
    
    // Coaching notes: bảo mật nội bộ
    const allNotes: CoachingNote[] = JSON.parse(localStorage.getItem(STORAGE_KEY_COACHING) || '[]').filter((n: any) => n.user_id === userId);
    const coachingNotes = allNotes.filter(n => {
      if (isHrOrAdmin || n.mentor_id === currentUser.id) return true;
      if (isSelf && n.shared_with_employee) return true;
      return false;
    });

    const reviews: PerformanceReview[] = JSON.parse(localStorage.getItem(STORAGE_KEY_REVIEWS) || '[]').filter((r: any) => r.user_id === userId);
    const disciplinaryRecords: DisciplinaryRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_DISCIPLINARY) || '[]').filter((d: any) => d.user_id === userId);
    const events: PersonnelEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS) || '[]').filter((e: any) => e.user_id === userId);
    const onboardingTasks: OnboardingTask[] = JSON.parse(localStorage.getItem(STORAGE_KEY_ONBOARDING) || '[]').filter((o: any) => o.user_id === userId);

    // Dữ liệu nhạy cảm
    const privList: EmployeePrivate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_PRIVATE) || '[]');
    const priv = privList.find(p => p.user_id === userId);
    const hasPrivateAccess = isSelf || isHrOrAdmin;

    let maskedPrivate: Partial<EmployeePrivate> | undefined;
    if (priv) {
      if (hasPrivateAccess) {
        maskedPrivate = {
          ...priv,
          id_card_number: priv.id_card_number ? priv.id_card_number.slice(0, 4) + '******' + priv.id_card_number.slice(-3) : undefined,
          tax_id: priv.tax_id ? priv.tax_id.slice(0, 3) + '****' + priv.tax_id.slice(-3) : undefined,
          bank_account_number: priv.bank_account_number ? '******' + priv.bank_account_number.slice(-4) : undefined,
        };
      } else {
        maskedPrivate = {
          emergency_contact_name: priv.emergency_contact_name ? maskName(priv.emergency_contact_name) : undefined,
          emergency_contact_phone: priv.emergency_contact_phone ? maskPhone(priv.emergency_contact_phone) : undefined,
        };
      }
    }

    return {
      profile: target,
      record: rec,
      hasPrivateAccess,
      maskedPrivate,
      contracts,
      certificates: certs,
      documents,
      leaveBalances,
      leaveRequests,
      targets,
      coachingNotes,
      reviews,
      disciplinaryRecords,
      events,
      onboardingTasks,
    };
  }

  // 3. TRA CỨU DỮ LIỆU NHẠY CẢM (REVEAL KÈM LÝ DO & AUDIT LOG)
  async revealPrivateField(
    targetUserId: string, 
    field: 'id_card_number' | 'tax_id' | 'bank_account_number', 
    reason: string, 
    currentUser: UserProfile
  ): Promise<{ value: string }> {
    assertRateLimit(currentUser.id, 'hr/reveal_private', 15);

    const isSelf = currentUser.id === targetUserId;
    const isHrOrAdmin = ['admin', 'director', 'hr_admin'].includes(currentUser.role);

    if (!isSelf && !isHrOrAdmin) {
      throw new Error('forbidden: Bạn không có quyền tra cứu thông tin bảo mật nhân sự này!');
    }

    if (!isSelf && (!reason || reason.trim().length < 5)) {
      throw new Error('invalid_argument: Bắt buộc cung cấp lý do rõ ràng khi mở thông tin nhạy cảm!');
    }

    this.ensureInitialized();
    const privList: EmployeePrivate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_PRIVATE) || '[]');
    const priv = privList.find(p => p.user_id === targetUserId);
    if (!priv) throw new Error('Không tìm thấy thông tin bảo mật của nhân sự!');

    const val = priv[field] || 'Chưa cập nhật';

    // Ghi audit log nếu không phải chính chủ
    if (!isSelf) {
      await auditRepository.logAction(
        currentUser.id,
        currentUser.full_name,
        'reveal_employee_private',
        { field, reason, target_user_id: targetUserId },
        { table_name: 'employee_private', record_id: targetUserId }
      );
    }

    return { value: val };
  }

  // 4. ĐIỀU CHUYỂN & KẾ NHIỆM (MAKER-CHECKER WORKFLOW)
  async createTransferRequest(payload: {
    userId: string;
    requestType: 'transfer' | 'promotion' | 'demotion' | 'title_change';
    toAgencyId?: string;
    toTeamId?: string;
    toRole?: string;
    toDirectManagerId?: string;
    effectiveDate: string;
    reason: string;
    currentUser: UserProfile;
  }): Promise<PersonnelTransferRequest> {
    assertRateLimit(payload.currentUser.id, 'hr/create_transfer_request', 10);
    this.ensureInitialized();

    const isAuthorized = ['admin', 'director', 'sales_manager', 'team_leader', 'hr_admin'].includes(payload.currentUser.role);
    if (!isAuthorized) {
      throw new Error('forbidden: Bạn không có thẩm quyền tạo đề xuất điều chuyển nhân sự!');
    }

    // Chặn tự tạo yêu cầu thăng chức/điều chuyển cho chính mình mà không qua cấp trên
    if (payload.userId === payload.currentUser.id && payload.currentUser.role !== 'admin') {
      throw new Error('invalid_operation: Bạn không thể tự tạo yêu cầu điều chuyển cho chính mình!');
    }

    const profiles = await teamRepository.getProfiles();
    const target = profiles.find(p => p.id === payload.userId);
    if (!target) throw new Error('Nhân sự không tồn tại!');

    const agencies = await teamRepository.getAgencies();
    const teams = await teamRepository.getTeams();

    const fromAgency = agencies.find(a => a.id === target.agency_id);
    const toAgency = payload.toAgencyId ? agencies.find(a => a.id === payload.toAgencyId) : fromAgency;
    const fromTeam = teams.find(t => t.id === target.team_id);
    const toTeam = payload.toTeamId ? teams.find(t => t.id === payload.toTeamId) : fromTeam;

    const newReq: PersonnelTransferRequest = {
      id: crypto.randomUUID(),
      user_id: payload.userId,
      user_name: target.full_name,
      request_type: payload.requestType,
      from_agency_id: target.agency_id,
      from_agency_name: fromAgency?.name,
      to_agency_id: payload.toAgencyId || target.agency_id,
      to_agency_name: toAgency?.name,
      from_team_id: target.team_id,
      from_team_name: fromTeam?.name,
      to_team_id: payload.toTeamId,
      to_team_name: toTeam?.name,
      from_role: target.role,
      to_role: payload.toRole || target.role,
      effective_date: payload.effectiveDate,
      reason: payload.reason,
      status: 'pending',
      requested_by: payload.currentUser.id,
      requested_by_name: payload.currentUser.full_name,
      created_at: new Date().toISOString(),
    };

    const requests: PersonnelTransferRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSFER_REQUESTS) || '[]');
    requests.unshift(newReq);
    localStorage.setItem(STORAGE_KEY_TRANSFER_REQUESTS, JSON.stringify(requests));

    return newReq;
  }

  async getTransferRequests(currentUser: UserProfile): Promise<PersonnelTransferRequest[]> {
    this.ensureInitialized();
    const requests: PersonnelTransferRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSFER_REQUESTS) || '[]');
    return requests;
  }

  async applyPersonnelTransfer(requestId: string, currentUser: UserProfile): Promise<{ success: boolean }> {
    assertRateLimit(currentUser.id, 'hr/apply_transfer', 10);
    this.ensureInitialized();

    const isApprover = ['admin', 'director', 'sales_manager', 'hr_admin'].includes(currentUser.role);
    if (!isApprover) {
      throw new Error('forbidden: Bạn không có quyền phê duyệt điều chuyển nhân sự!');
    }

    const requests: PersonnelTransferRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSFER_REQUESTS) || '[]');
    const req = requests.find(r => r.id === requestId);
    if (!req) throw new Error('Không tìm thấy yêu cầu điều chuyển!');
    if (req.status !== 'pending') throw new Error(`Yêu cầu đã được xử lý (trạng thái: ${req.status})!`);

    // Chặn tự duyệt cho chính mình
    if (req.user_id === currentUser.id) {
      throw new Error('invalid_operation: Bạn không thể tự phê duyệt yêu cầu điều chuyển của chính mình!');
    }

    // 1. Cập nhật hồ sơ Profile
    const profiles = await teamRepository.getProfiles();
    const target = profiles.find(p => p.id === req.user_id);
    if (!target) throw new Error('Nhân sự không tồn tại!');

    const oldValues = {
      agency_id: target.agency_id,
      team_id: target.team_id,
      role: target.role,
    };

    target.agency_id = req.to_agency_id || target.agency_id;
    target.team_id = req.to_team_id;
    if (req.to_role) target.role = req.to_role as UserRole;
    localStorage.setItem('crm_profiles', JSON.stringify(profiles));

    // 2. Cập nhật Employee Records
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const rec = records.find(r => r.user_id === req.user_id);
    if (rec && req.to_direct_manager_id) {
      rec.direct_manager_id = req.to_direct_manager_id;
      localStorage.setItem(STORAGE_KEY_EMPLOYEE_RECORDS, JSON.stringify(records));
    }

    // 3. Cập nhật Request status
    req.status = 'applied';
    req.approved_by = currentUser.id;
    req.approved_by_name = currentUser.full_name;
    req.approved_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_TRANSFER_REQUESTS, JSON.stringify(requests));

    // 4. Ghi nhận Personnel Event (Append-only)
    const events: PersonnelEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS) || '[]');
    const eventType = req.request_type === 'promotion' ? 'promoted' : req.request_type === 'demotion' ? 'demoted' : 'transferred';
    events.unshift({
      id: crypto.randomUUID(),
      user_id: req.user_id,
      event_type: eventType,
      effective_date: req.effective_date,
      actor_id: currentUser.id,
      actor_name: currentUser.full_name,
      old_values: oldValues,
      new_values: {
        agency_id: target.agency_id,
        team_id: target.team_id,
        role: target.role,
      },
      reason: req.reason,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_PERSONNEL_EVENTS, JSON.stringify(events));

    // 5. Ghi Audit log
    await auditRepository.logAction(
      currentUser.id,
      currentUser.full_name,
      `personnel_${eventType}`,
      { requestId, reason: req.reason, target_user_id: req.user_id },
      { table_name: 'profiles', record_id: req.user_id }
    );

    return { success: true };
  }

  // 5. QUẢN LÝ NGHỈ PHÉP (LEAVE REQUESTS & SYNC ON_LEAVE)
  async getLeaveRequests(currentUser: UserProfile, userId?: string): Promise<LeaveRequest[]> {
    this.ensureInitialized();
    const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_REQUESTS) || '[]');
    if (userId) return requests.filter(r => r.user_id === userId);

    if (currentUser.role === 'sale_agent') {
      return requests.filter(r => r.user_id === currentUser.id);
    }
    return requests;
  }

  async createLeaveRequest(payload: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
    substituteUserId?: string;
    currentUser: UserProfile;
  }): Promise<LeaveRequest> {
    assertRateLimit(payload.currentUser.id, 'hr/create_leave_request', 10);
    this.ensureInitialized();

    const types: LeaveType[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_TYPES) || '[]');
    const lType = types.find(t => t.id === payload.leaveTypeId);

    const newReq: LeaveRequest = {
      id: crypto.randomUUID(),
      user_id: payload.currentUser.id,
      user_name: payload.currentUser.full_name,
      leave_type_id: payload.leaveTypeId,
      leave_type_name: lType?.name || 'Nghỉ phép',
      start_date: payload.startDate,
      end_date: payload.endDate,
      total_days: payload.totalDays,
      reason: payload.reason,
      substitute_user_id: payload.substituteUserId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_REQUESTS) || '[]');
    requests.unshift(newReq);
    localStorage.setItem(STORAGE_KEY_LEAVE_REQUESTS, JSON.stringify(requests));
    return newReq;
  }

  async approveLeaveRequest(requestId: string, approved: boolean, rejectionReason?: string, currentUser?: UserProfile): Promise<{ success: boolean }> {
    this.ensureInitialized();
    const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_REQUESTS) || '[]');
    const req = requests.find(r => r.id === requestId);
    if (!req) throw new Error('Không tìm thấy đơn nghỉ phép!');

    req.status = approved ? 'approved' : 'rejected';
    req.approved_by = currentUser?.id;
    req.approved_by_name = currentUser?.full_name;
    req.approved_at = new Date().toISOString();
    if (!approved) req.rejection_reason = rejectionReason;

    localStorage.setItem(STORAGE_KEY_LEAVE_REQUESTS, JSON.stringify(requests));

    // Nếu duyệt: Trừ ngày phép trong leave_balances và bật cờ on_leave nếu hôm nay trong kỳ nghỉ
    if (approved) {
      const balances: LeaveBalance[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_BALANCES) || '[]');
      const bal = balances.find(b => b.user_id === req.user_id && b.leave_type_id === req.leave_type_id);
      if (bal) {
        bal.used_days += req.total_days;
        bal.remaining_days = Math.max(0, bal.total_entitlement - bal.used_days);
        localStorage.setItem(STORAGE_KEY_LEAVE_BALANCES, JSON.stringify(balances));
      }

      // Kiểm tra ngày hôm nay
      const today = new Date().toISOString().slice(0, 10);
      if (today >= req.start_date && today <= req.end_date) {
        const profiles = await teamRepository.getProfiles();
        const p = profiles.find(item => item.id === req.user_id);
        if (p) {
          p.on_leave = true;
          localStorage.setItem('crm_profiles', JSON.stringify(profiles));
        }
      }
    }

    return { success: true };
  }

  // 6. CHỨNG CHỈ MÔI GIỚI BẤT ĐỘNG SẢN & CẢNH BÁO HẾT HẠN
  async getBrokerCertificates(userId?: string): Promise<BrokerCertificate[]> {
    this.ensureInitialized();
    const certs: BrokerCertificate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_BROKER_CERTS) || '[]');
    if (userId) return certs.filter(c => c.user_id === userId);
    return certs;
  }

  async saveBrokerCertificate(payload: {
    userId: string;
    certificateNumber: string;
    issuingAuthority: string;
    issueDate: string;
    expiryDate: string;
    documentUrl?: string;
    currentUser: UserProfile;
  }): Promise<BrokerCertificate> {
    assertRateLimit(payload.currentUser.id, 'hr/save_cert', 10);
    this.ensureInitialized();

    const certs: BrokerCertificate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_BROKER_CERTS) || '[]');
    const newCert: BrokerCertificate = {
      id: crypto.randomUUID(),
      user_id: payload.userId,
      certificate_number: payload.certificateNumber,
      issuing_authority: payload.issuingAuthority,
      issue_date: payload.issueDate,
      expiry_date: payload.expiryDate,
      status: 'active',
      document_url: payload.documentUrl,
      created_at: new Date().toISOString(),
    };

    certs.unshift(newCert);
    localStorage.setItem(STORAGE_KEY_BROKER_CERTS, JSON.stringify(certs));
    return newCert;
  }

  // 7. TUYỂN DỤNG ATS & CHUYỂN ỨNG VIÊN THÀNH NHÂN SỰ (ATOMIC HIRE REUSING ADMIN FLOW)
  async getJobRequisitions(): Promise<JobRequisition[]> {
    this.ensureInitialized();
    return JSON.parse(localStorage.getItem(STORAGE_KEY_REQUISITIONS) || '[]');
  }

  async getCandidates(requisitionId?: string): Promise<Candidate[]> {
    this.ensureInitialized();
    const cands: Candidate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CANDIDATES) || '[]');
    if (requisitionId && requisitionId !== 'all') {
      return cands.filter(c => c.requisition_id === requisitionId);
    }
    return cands;
  }

  async createCandidate(payload: {
    requisitionId?: string;
    fullName: string;
    phone: string;
    email?: string;
    source: string;
    referrerId?: string;
    notes?: string;
    currentUser: UserProfile;
  }): Promise<{ candidate: Candidate; isDuplicate: boolean; warning?: string }> {
    assertRateLimit(payload.currentUser.id, 'hr/create_candidate', 20);
    this.ensureInitialized();

    const cleanPhone = normalizePhone(payload.phone);
    const pHash = computePhoneHash(cleanPhone);
    const cands: Candidate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CANDIDATES) || '[]');

    // Phát hiện ứng viên trùng lặp
    const dup = cands.find(c => c.phone_hash === pHash);
    let warning: string | undefined;
    if (dup) {
      warning = `Ứng viên này đã nộp hồ sơ trước đó (${dup.full_name} - Trạng thái: ${dup.stage})`;
    }

    // Kiểm tra xem ứng viên từng làm việc tại hệ thống chưa (Rehire)
    const profiles = await teamRepository.getProfiles();
    const formerEmployee = profiles.find(p => normalizePhone(p.phone) === cleanPhone);

    const newCandidate: Candidate = {
      id: crypto.randomUUID(),
      requisition_id: payload.requisitionId,
      full_name: payload.fullName,
      phone: payload.phone,
      phone_normalized: cleanPhone,
      phone_hash: pHash,
      email: payload.email,
      source: payload.source,
      referrer_id: payload.referrerId,
      stage: 'applied',
      is_rehire: Boolean(formerEmployee),
      notes: payload.notes,
      created_at: new Date().toISOString(),
    };

    cands.unshift(newCandidate);
    localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(cands));

    return { candidate: newCandidate, isDuplicate: Boolean(dup), warning };
  }

  async updateCandidateStage(candidateId: string, stage: Candidate['stage'], currentUser: UserProfile): Promise<Candidate> {
    this.ensureInitialized();
    const cands: Candidate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CANDIDATES) || '[]');
    const cand = cands.find(c => c.id === candidateId);
    if (!cand) throw new Error('Không tìm thấy ứng viên!');

    cand.stage = stage;
    cand.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(cands));
    return cand;
  }

  // ATOMIC HIRE: TÁI SỬ DỤNG HOÀN TOÀN LUỒNG ADMIN VÀ TẠO ONBOARDING TASKS
  async atomicHireCandidate(
    candidateId: string, 
    accountInput: CreateUserInput, 
    currentUser: UserProfile
  ): Promise<{ success: boolean; userProfile: UserProfile; employeeRecord: EmployeeRecord }> {
    assertRateLimit(currentUser.id, 'hr/hire_candidate', 10);
    this.ensureInitialized();

    const isHrOrAdmin = ['admin', 'director', 'hr_admin'].includes(currentUser.role);
    if (!isHrOrAdmin) {
      throw new Error('forbidden: Chỉ HR Admin hoặc Ban Giám Đốc mới có quyền kích hoạt tuyển dụng nhân sự!');
    }

    const cands: Candidate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_CANDIDATES) || '[]');
    const cand = cands.find(c => c.id === candidateId);
    if (!cand) throw new Error('Không tìm thấy thông tin ứng viên!');

    // 1. TÁI SỬ DỤNG LUỒNG TẠO USER CỦA /admin (teamRepository.createUser)
    const createRes = await teamRepository.createUser({
      ...accountInput,
      full_name: cand.full_name,
      phone: cand.phone,
      email: accountInput.email || cand.email || `sale.${Date.now().toString().slice(-4)}@diaocvang.vn`,
      role: accountInput.role || 'sale_agent',
      agency_id: accountInput.agency_id,
      team_id: accountInput.team_id,
      must_change_password: true,
    });

    if (!createRes.success || !createRes.profile) {
      throw new Error(createRes.error || 'Lỗi tạo tài khoản nhân sự từ hệ thống quản trị!');
    }

    const newProfile = createRes.profile;

    // 2. Tạo Employee Record (1-1 với Profile)
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const newRecord: EmployeeRecord = {
      id: crypto.randomUUID(),
      user_id: newProfile.id,
      employee_code: `EMP-${Date.now().toString().slice(-5)}`,
      employment_type: 'probation',
      title: 'Chuyên viên tư vấn (Thử việc)',
      level: 1,
      direct_manager_id: currentUser.id,
      join_date: new Date().toISOString().slice(0, 10),
      probation_end_date: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10), // 60 ngày
      recruited_by: cand.referrer_id || currentUser.id,
      recruitment_source: cand.source,
      status: 'probation',
      created_at: new Date().toISOString(),
    };
    records.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY_EMPLOYEE_RECORDS, JSON.stringify(records));

    // 3. Cập nhật trạng thái ứng viên
    cand.stage = 'hired';
    cand.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(cands));

    // 4. Ghi nhận sự kiện nhân sự HIRED (Append-only)
    const events: PersonnelEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS) || '[]');
    events.unshift({
      id: crypto.randomUUID(),
      user_id: newProfile.id,
      event_type: 'hired',
      effective_date: newRecord.join_date,
      actor_id: currentUser.id,
      actor_name: currentUser.full_name,
      reason: `Tuyển dụng từ ứng viên ${cand.full_name}`,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_PERSONNEL_EVENTS, JSON.stringify(events));

    // 5. Tạo Checklist Onboarding chuẩn
    const onboarding: OnboardingTask[] = JSON.parse(localStorage.getItem(STORAGE_KEY_ONBOARDING) || '[]');
    const tasks: OnboardingTask[] = [
      { id: crypto.randomUUID(), user_id: newProfile.id, title: 'Ký hợp đồng thử việc & Thỏa thuận bảo mật (NDA)', is_mandatory: true, due_date: newRecord.join_date, is_completed: false, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), user_id: newProfile.id, title: 'Bổ sung CCCD, Sơ yếu lý lịch & Chứng chỉ môi giới', is_mandatory: true, due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), is_completed: false, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), user_id: newProfile.id, title: 'Đổi mật khẩu tài khoản CRM & Kích hoạt 2FA', is_mandatory: true, due_date: newRecord.join_date, is_completed: false, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), user_id: newProfile.id, title: 'Hoàn thành bài kiểm tra Kịch bản tư vấn dự án Vinhomes', is_mandatory: false, due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), is_completed: false, created_at: new Date().toISOString() },
    ];
    onboarding.unshift(...tasks);
    localStorage.setItem(STORAGE_KEY_ONBOARDING, JSON.stringify(onboarding));

    return {
      success: true,
      userProfile: newProfile,
      employeeRecord: newRecord,
    };
  }

  // 8. COACHING NOTES 1-1
  async getCoachingNotes(userId: string, currentUser: UserProfile): Promise<CoachingNote[]> {
    this.ensureInitialized();
    const allNotes: CoachingNote[] = JSON.parse(localStorage.getItem(STORAGE_KEY_COACHING) || '[]');
    const isHrOrAdmin = ['admin', 'director', 'hr_admin'].includes(currentUser.role);
    const isSelf = currentUser.id === userId;

    return allNotes.filter(n => {
      if (n.user_id !== userId) return false;
      if (isHrOrAdmin || n.mentor_id === currentUser.id) return true;
      if (isSelf && n.shared_with_employee) return true;
      return false;
    });
  }

  async saveCoachingNote(payload: {
    userId: string;
    content: string;
    actionItems?: string;
    sharedWithEmployee: boolean;
    currentUser: UserProfile;
  }): Promise<CoachingNote> {
    assertRateLimit(payload.currentUser.id, 'hr/coaching_note', 20);
    this.ensureInitialized();

    const notes: CoachingNote[] = JSON.parse(localStorage.getItem(STORAGE_KEY_COACHING) || '[]');
    const newNote: CoachingNote = {
      id: crypto.randomUUID(),
      user_id: payload.userId,
      mentor_id: payload.currentUser.id,
      mentor_name: payload.currentUser.full_name,
      note_date: new Date().toISOString().slice(0, 10),
      content: payload.content,
      action_items: payload.actionItems,
      is_private: true,
      shared_with_employee: payload.sharedWithEmployee,
      created_at: new Date().toISOString(),
    };

    notes.unshift(newNote);
    localStorage.setItem(STORAGE_KEY_COACHING, JSON.stringify(notes));
    return newNote;
  }

  // 9. BÁO CÁO NHÂN SỰ & CHỈ SỐ HEADCOUNT
  async getHRMetrics(period?: string, currentUser?: UserProfile): Promise<{
    headcount: number;
    officialCount: number;
    probationCount: number;
    collaboratorCount: number;
    expiringCertsCount: number;
    openRequisitionsCount: number;
    pendingTransfersCount: number;
    pendingLeavesCount: number;
  }> {
    this.ensureInitialized();
    const profiles = await teamRepository.getProfiles();
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const certs: BrokerCertificate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_BROKER_CERTS) || '[]');
    const reqs: JobRequisition[] = JSON.parse(localStorage.getItem(STORAGE_KEY_REQUISITIONS) || '[]');
    const transfers: PersonnelTransferRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSFER_REQUESTS) || '[]');
    const leaves: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_REQUESTS) || '[]');

    return {
      headcount: profiles.length,
      officialCount: records.filter(r => r.employment_type === 'official').length,
      probationCount: records.filter(r => r.employment_type === 'probation').length,
      collaboratorCount: records.filter(r => r.employment_type === 'collaborator').length,
      expiringCertsCount: certs.filter(c => c.status === 'expiring_soon' || c.status === 'expired').length,
      openRequisitionsCount: reqs.filter(r => r.status === 'open').length,
      pendingTransfersCount: transfers.filter(t => t.status === 'pending').length,
      pendingLeavesCount: leaves.filter(l => l.status === 'pending').length,
    };
  }
}

export const hrRepository = new HRRepository();
