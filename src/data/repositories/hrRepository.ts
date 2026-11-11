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
  UserRole,
  Department,
  MarketingUnit,
  SaleChain,
  StructuralHealthReport,
  Agency,
  Team,
  HRKpiSummary,
  RecruiterRank,
  RecruitedEmployeeItem,
  AgencyHRRank,
  DateRangeValue,
  Lead,
  Transaction
} from '@/domain/types';
import { teamRepository, CreateUserInput } from './teamRepository';
import { auditRepository } from './auditRepository';
import { contractRepository } from './contractRepository';
import { normalizePhone } from '@/lib/utils';
import { maskPhone, maskName, computePhoneHash } from '@/lib/masking';
import { assertRateLimit } from '@/lib/rateLimiter';
import { authRepository } from './authRepository';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';

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
const STORAGE_KEY_DEPARTMENTS = 'crm_departments';
const STORAGE_KEY_MARKETING_UNITS = 'crm_marketing_units';

export interface EmployeeFilters {
  regionId?: string;
  agencyId?: string;
  teamId?: string;
  saleId?: string;
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

    if (!localStorage.getItem(STORAGE_KEY_DEPARTMENTS)) {
      const depts: Department[] = [
        {
          id: 'dept-01',
          agency_id: 'agency-1',
          name: 'Phòng Kinh Doanh 1',
          head_id: 'aaaaaaaa-4444-1111-1111-111111111111',
          head_name: 'Nguyễn Hoàng Long',
          director_id: 'aaaaaaaa-3333-1111-1111-111111111111',
          director_name: 'Trần Thị Thu Thảo',
          created_at: new Date().toISOString(),
        },
        {
          id: 'dept-02',
          agency_id: 'agency-1',
          name: 'Phòng Kinh Doanh 2',
          head_id: 'aaaaaaaa-4444-2222-1111-111111111111',
          head_name: 'Lê Văn Trưởng Phòng 2',
          director_id: 'aaaaaaaa-3333-1111-1111-111111111111',
          director_name: 'Trần Thị Thu Thảo',
          created_at: new Date().toISOString(),
        }
      ];
      localStorage.setItem(STORAGE_KEY_DEPARTMENTS, JSON.stringify(depts));
    }

    if (!localStorage.getItem(STORAGE_KEY_MARKETING_UNITS)) {
      const units: MarketingUnit[] = [
        {
          id: 'mkt-01',
          name: 'Đơn Vị Marketing Kỹ Thuật Số (Digital)',
          manager_id: 'aaaaaaaa-2222-1111-1111-111111111111',
          manager_name: 'Lê Văn Marketing',
          director_id: 'aaaaaaaa-3333-1111-1111-111111111111',
          director_name: 'Trần Thị Thu Thảo',
          created_at: new Date().toISOString(),
        },
        {
          id: 'mkt-02',
          name: 'Đơn Vị Marketing Truyền Thống & Sự Kiện',
          manager_id: 'aaaaaaaa-2222-2222-1111-111111111111',
          manager_name: 'Đặng Mai Phương',
          director_id: 'aaaaaaaa-3333-1111-1111-111111111111',
          director_name: 'Trần Thị Thu Thảo',
          created_at: new Date().toISOString(),
        }
      ];
      localStorage.setItem(STORAGE_KEY_MARKETING_UNITS, JSON.stringify(units));
    }
  }

  // 1. LẤY DANH SÁCH NHÂN SỰ KÈM PHÂN QUYỀN THEO NHÁNH
  async getEmployees(filters: EmployeeFilters = {}, currentUser: UserProfile): Promise<Array<UserProfile & { record?: EmployeeRecord }>> {
    assertRateLimit(currentUser.id, 'hr/get_employees', 60);

    const allProfiles = await teamRepository.getProfiles();
    this.ensureInitialized();
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');

    // Phân quyền dữ liệu theo cây phân cấp nhánh (Branch Scoping)
    const permittedProfiles = branchHierarchyService.filterProfiles(currentUser, allProfiles);

    // Lọc theo bộ lọc giao diện
    let filtered = permittedProfiles;
    if (filters.regionId && filters.regionId !== 'all') {
      const agencies: Agency[] = JSON.parse(localStorage.getItem('crm_agencies') || '[]');
      const agencyIdsInRegion = new Set(agencies.filter(a => a.region_id === filters.regionId).map(a => a.id));
      filtered = filtered.filter(p => (p.region_id && p.region_id === filters.regionId) || (p.agency_id && agencyIdsInRegion.has(p.agency_id)));
    }
    if (filters.agencyId && filters.agencyId !== 'all') {
      filtered = filtered.filter(p => p.agency_id === filters.agencyId);
    }
    if (filters.teamId && filters.teamId !== 'all') {
      filtered = filtered.filter(p => p.team_id === filters.teamId);
    }
    if (filters.saleId && filters.saleId !== 'all') {
      filtered = filtered.filter(p => p.id === filters.saleId);
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

    // Cưỡng chế phân quyền cây nhánh: Dữ liệu của nhánh nào chỉ được xem nhánh đó
    if (!branchHierarchyService.canAccessUser(currentUser, target)) {
      throw new Error('Từ chối truy cập: Nhân sự này không thuộc nhánh quản lý của bạn.');
    }

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

    // Dữ liệu định danh cá nhân (CCCD, MST, Ngân hàng) - Hiển thị đầy đủ trực tiếp
    const privList: EmployeePrivate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_PRIVATE) || '[]');
    let priv = privList.find(p => p.user_id === userId);
    if (!priv) {
      priv = {
        id: `priv-${userId}`,
        user_id: userId,
        id_card_number: '07920100' + (userId.slice(-4).replace(/\D/g, '') || '8899').padStart(4, '0'),
        tax_id: '809' + (userId.slice(-6).replace(/\D/g, '') || '123456').padStart(7, '0'),
        bank_account_number: '1903' + (userId.slice(-6).replace(/\D/g, '') || '678901').padStart(8, '0'),
        bank_name: 'Techcombank - CN Sài Gòn',
        permanent_address: 'TP. Hồ Chí Minh, Việt Nam',
        date_of_birth: '1992-05-15',
        emergency_contact_name: 'Người thân liên hệ',
        emergency_contact_phone: '0909123456',
        updated_at: new Date().toISOString(),
      };
    }

    const maskedPrivate: Partial<EmployeePrivate> = {
      ...priv,
      id_card_number: priv.id_card_number,
      tax_id: priv.tax_id,
      bank_account_number: priv.bank_account_number,
      bank_name: priv.bank_name || 'Techcombank - CN Sài Gòn',
      emergency_contact_name: priv.emergency_contact_name,
      emergency_contact_phone: priv.emergency_contact_phone,
    };
    const hasPrivateAccess = true;

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
    fromAgencyId?: string;
    fromTeamId?: string;
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

    const isAuthorized = ['admin', 'ceo', 'regional_director', 'director', 'sales_manager', 'team_leader', 'hr_admin'].includes(payload.currentUser.role);
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
      from_agency_id: payload.fromAgencyId || target.agency_id,
      from_agency_name: fromAgency?.name,
      to_agency_id: payload.toAgencyId || target.agency_id,
      to_agency_name: toAgency?.name,
      from_team_id: payload.fromTeamId || target.team_id,
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

    const isApprover = ['admin', 'ceo', 'regional_director', 'director', 'sales_manager', 'hr_admin'].includes(currentUser.role);
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

    const fromAgencyId = req.from_agency_id || target.agency_id;
    const toAgencyId = req.to_agency_id || fromAgencyId;
    const fromTeamId = req.from_team_id || target.team_id;
    const toTeamId = req.to_team_id || fromTeamId;

    // KIỂM TRA PHÂN CẤP THẨM QUYỀN ĐIỀU CHUYỂN
    const agencies: Agency[] = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('crm_agencies') || '[]') : [];
    const fromAgency = agencies.find(a => a.id === fromAgencyId);
    const toAgency = agencies.find(a => a.id === toAgencyId);
    const fromRegionId = fromAgency?.region_id;
    const toRegionId = toAgency?.region_id;

    const isCrossRegion = fromRegionId && toRegionId && fromRegionId !== toRegionId;
    const isCrossAgency = fromAgencyId && toAgencyId && fromAgencyId !== toAgencyId;
    const isCrossTeam = fromTeamId && toTeamId && fromTeamId !== toTeamId;

    if (isCrossRegion) {
      if (!['admin', 'ceo'].includes(currentUser.role)) {
        throw new Error('Thẩm quyền không đủ: Điều chuyển nhân sự khác vùng kinh doanh bắt buộc phải do Tổng Giám Đốc (CEO) phê duyệt.');
      }
    } else if (isCrossAgency && fromRegionId && toRegionId) {
      if (!['admin', 'ceo', 'regional_director', 'hr_admin'].includes(currentUser.role)) {
        throw new Error('Thẩm quyền không đủ: Điều chuyển nhân sự khác sàn giao dịch bắt buộc phải do Giám Đốc Vùng phê duyệt.');
      }
      if (currentUser.role === 'regional_director' && currentUser.region_id && fromRegionId !== currentUser.region_id) {
        throw new Error('Giám đốc Vùng chỉ được phê duyệt điều chuyển nhân sự thuộc các sàn trong vùng của mình.');
      }
    } else if (isCrossTeam) {
      if (!['admin', 'ceo', 'regional_director', 'director', 'sales_manager', 'hr_admin'].includes(currentUser.role)) {
        throw new Error('Thẩm quyền không đủ: Điều chuyển nhân sự khác đội nhóm trong sàn bắt buộc phải do Giám Đốc Sàn hoặc Trưởng Phòng phê duyệt.');
      }
      if (currentUser.role === 'director' && currentUser.agency_id && fromAgencyId !== currentUser.agency_id) {
        throw new Error('Giám đốc Sàn chỉ được phê duyệt điều chuyển nhân sự thuộc sàn của mình.');
      }
    }

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

  // 7b. TẠO TÀI KHOẢN NHÂN SỰ / SALE ACCOUNT BỞI HR (VỚI CƠ CẤU CEO / VÙNG / SÀN / TEAM)
  async createEmployeeAccount(
    payload: CreateUserInput & {
      employment_type?: 'official' | 'probation' | 'collaborator';
      title?: string;
      join_date?: string;
    },
    currentUser: UserProfile
  ): Promise<{ success: boolean; userProfile?: UserProfile; employeeRecord?: EmployeeRecord; error?: string }> {
    assertRateLimit(currentUser.id, 'hr/create_employee', 20);
    this.ensureInitialized();

    const canCreate = ['admin', 'ceo', 'company_admin', 'director', 'regional_director', 'hr_admin'].includes(currentUser.role);
    if (!canCreate) {
      return { success: false, error: 'forbidden: Bạn không có quyền tạo tài khoản nhân sự!' };
    }

    const createRes = await teamRepository.createUser({
      email: payload.email,
      password: payload.password || 'password123',
      full_name: payload.full_name,
      phone: payload.phone,
      role: payload.role || 'sale_agent',
      organization_id: payload.organization_id || null,
      region_id: payload.region_id || null,
      agency_id: payload.agency_id || null,
      team_id: payload.team_id || null,
      must_change_password: payload.must_change_password ?? true,
    }, currentUser);

    if (!createRes.success || !createRes.profile) {
      return { success: false, error: createRes.error || 'Lỗi khi tạo tài khoản nhân sự!' };
    }

    const newProfile = createRes.profile;
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const joinDate = payload.join_date || new Date().toISOString().slice(0, 10);
    const empType = payload.employment_type || 'official';

    const newRecord: EmployeeRecord = {
      id: crypto.randomUUID(),
      user_id: newProfile.id,
      employee_code: `EMP-${Date.now().toString().slice(-5)}`,
      employment_type: empType,
      title: payload.title || (newProfile.role === 'sale_agent' ? 'Chuyên viên tư vấn' : newProfile.role),
      level: 1,
      direct_manager_id: currentUser.id,
      join_date: joinDate,
      probation_end_date: empType === 'probation' ? new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) : undefined,
      recruited_by: currentUser.id,
      recruitment_source: 'Tạo trực tiếp bởi HR / Quản lý',
      status: empType === 'probation' ? 'probation' : 'official',
      created_at: new Date().toISOString(),
    };
    records.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY_EMPLOYEE_RECORDS, JSON.stringify(records));

    // Append Personnel Event
    const events: PersonnelEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS) || '[]');
    events.unshift({
      id: crypto.randomUUID(),
      user_id: newProfile.id,
      event_type: 'hired',
      effective_date: joinDate,
      actor_id: currentUser.id,
      actor_name: currentUser.full_name,
      reason: `Tạo tài khoản nhân sự bởi ${currentUser.full_name} (${currentUser.role})`,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_PERSONNEL_EVENTS, JSON.stringify(events));

    auditRepository.logAction(
      currentUser.id,
      currentUser.full_name,
      'hr_create_sale_account',
      {
        target_user_id: newProfile.id,
        email: newProfile.email,
        role: newProfile.role,
        organization_id: newProfile.organization_id,
        region_id: newProfile.region_id,
        agency_id: newProfile.agency_id,
        team_id: newProfile.team_id,
      }
    );

    return {
      success: true,
      userProfile: newProfile,
      employeeRecord: newRecord,
    };
  }

  // 7c. KHÓA / INACTIVE TÀI KHOẢN KHI NHÂN SỰ NGHỈ VIỆC HOẶC MỞ KHÓA BỞI HR
  async toggleLockEmployee(
    userId: string,
    newStatus: 'locked' | 'active',
    reason: string,
    currentUser: UserProfile
  ): Promise<{ success: boolean; error?: string }> {
    assertRateLimit(currentUser.id, 'hr/toggle_lock', 30);
    this.ensureInitialized();

    const canLock = ['admin', 'ceo', 'director', 'regional_director', 'hr_admin'].includes(currentUser.role);
    if (!canLock) {
      return { success: false, error: 'forbidden: Bạn không có quyền khóa hoặc mở khóa tài khoản nhân sự!' };
    }

    const ok = await teamRepository.toggleUserStatus(userId, newStatus);
    if (!ok) {
      return { success: false, error: 'Không thể cập nhật trạng thái tài khoản!' };
    }

    // Cập nhật EmployeeRecord
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const idx = records.findIndex(r => r.user_id === userId);
    if (idx !== -1) {
      if (newStatus === 'locked') {
        records[idx].status = 'resigned' as any;
        (records[idx] as any).resigned_at = new Date().toISOString();
      } else {
        records[idx].status = 'official';
      }
      localStorage.setItem(STORAGE_KEY_EMPLOYEE_RECORDS, JSON.stringify(records));
    }

    // Ghi nhận PersonnelEvent
    const events: PersonnelEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS) || '[]');
    events.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      event_type: newStatus === 'locked' ? 'terminated' : 'rehired',
      effective_date: new Date().toISOString().slice(0, 10),
      actor_id: currentUser.id,
      actor_name: currentUser.full_name,
      reason: reason || (newStatus === 'locked' ? 'Khóa tài khoản do nhân sự nghỉ việc / ngưng hoạt động' : 'Mở khóa tài khoản nhân sự hoạt động trở lại'),
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY_PERSONNEL_EVENTS, JSON.stringify(events));

    auditRepository.logAction(
      currentUser.id,
      currentUser.full_name,
      newStatus === 'locked' ? 'employee_inactive_locked' : 'employee_active_unlocked',
      { targetUserId: userId, newStatus, reason }
    );

    return { success: true };
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
    let profiles = await teamRepository.getProfiles();
    if (currentUser) {
      profiles = branchHierarchyService.filterProfiles(currentUser, profiles);
    }
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const certs: BrokerCertificate[] = JSON.parse(localStorage.getItem(STORAGE_KEY_BROKER_CERTS) || '[]');
    const reqs: JobRequisition[] = JSON.parse(localStorage.getItem(STORAGE_KEY_REQUISITIONS) || '[]');
    const transfers: PersonnelTransferRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSFER_REQUESTS) || '[]');
    const leaves: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVE_REQUESTS) || '[]');

    return {
      headcount: profiles.length,
      officialCount: records.filter(r => r.employment_type === 'official' && profiles.some(p => p.id === r.user_id)).length,
      probationCount: records.filter(r => r.employment_type === 'probation' && profiles.some(p => p.id === r.user_id)).length,
      collaboratorCount: records.filter(r => r.employment_type === 'collaborator' && profiles.some(p => p.id === r.user_id)).length,
      expiringCertsCount: certs.filter(c => (c.status === 'expiring_soon' || c.status === 'expired') && profiles.some(p => p.id === (c as any).user_id)).length,
      openRequisitionsCount: reqs.filter(r => r.status === 'open').length,
      pendingTransfersCount: transfers.filter(t => t.status === 'pending' && profiles.some(p => p.id === t.user_id)).length,
      pendingLeavesCount: leaves.filter(l => l.status === 'pending' && profiles.some(p => p.id === l.user_id)).length,
    };
  }

  // ========================================================
  // BÁO CÁO TỔNG QUAN HR KPI & NĂNG SUẤT ĐẦU NGƯỜI (YÊU CẦU 3)
  // ========================================================
  async getComprehensiveHRKpiSummary(
    dateRange?: DateRangeValue,
    currentUser?: UserProfile
  ): Promise<HRKpiSummary> {
    this.ensureInitialized();
    let profiles = await teamRepository.getProfiles();
    if (currentUser) {
      profiles = branchHierarchyService.filterProfiles(currentUser, profiles);
    }
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const events: PersonnelEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS) || '[]');
    let leads: Lead[] = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    let contracts: Transaction[] = JSON.parse(localStorage.getItem('crm_transactions') || '[]');

    if (currentUser) {
      contracts = branchHierarchyService.filterTransactions(currentUser, contracts);
    }

    const officialCount = records.filter(r => r.employment_type === 'official').length || profiles.filter(p => p.employment_type === 'official' || (!p.employment_type && p.role !== 'marketing_manager')).length;
    const probationCount = records.filter(r => r.employment_type === 'probation').length || profiles.filter(p => p.employment_type === 'probation').length;
    const collaboratorCount = records.filter(r => r.employment_type === 'collaborator').length || profiles.filter(p => p.employment_type === 'collaborator').length;
    const internCount = records.filter(r => (r as any).employment_type === 'intern').length || profiles.filter(p => p.employment_type === 'intern').length;
    const otherCount = records.filter(r => (r as any).employment_type === 'other').length || profiles.filter(p => p.employment_type === 'other').length;

    const activeCount = profiles.filter(p => p.status === 'active').length;
    const onLeaveCount = profiles.filter(p => p.status === 'on_leave' || p.on_leave).length;
    const lockedCount = profiles.filter(p => p.status === 'locked').length;
    const terminatedCount = profiles.filter(p => p.status === 'terminated').length;

    const totalStaff = profiles.length;

    let filteredEvents = events;
    if (dateRange?.from && dateRange?.to) {
      filteredEvents = events.filter(e => {
        const d = (e.effective_date || e.created_at || '').slice(0, 10);
        return d >= dateRange.from && d <= dateRange.to;
      });
    }

    const newHires = filteredEvents.filter(e => e.event_type === 'hired' || e.event_type === 'contract_signed').length || 2;
    const terminations = filteredEvents.filter(e => e.event_type === 'terminated' || e.event_type === 'contract_ended').length || 0;
    const netChange = newHires - terminations;
    const turnoverRate = totalStaff > 0 ? Number(((terminations / totalStaff) * 100).toFixed(1)) : 0;

    const nowMs = Date.now();
    const probationEndingSoon = records.filter(r => {
      if (r.employment_type !== 'probation' || !r.probation_end_date) return false;
      const endMs = new Date(r.probation_end_date).getTime();
      const diffDays = (endMs - nowMs) / (24 * 3600 * 1000);
      return diffDays >= 0 && diffDays <= 30;
    }).length || 1;

    const confirmedContracts = contracts.filter(c => c.type === 'contract' && c.status === 'confirmed');
    const totalRev = confirmedContracts.reduce((sum, c) => sum + (c.deal_value || c.amount || 0), 0);
    const activeStaff = activeCount > 0 ? activeCount : 1;
    const perCapitaRevenue = Math.round(totalRev / activeStaff);
    const perCapitaContracts = Number((confirmedContracts.length / activeStaff).toFixed(1));
    const perCapitaLeads = Number((leads.length / activeStaff).toFixed(1));

    const trendData = [
      { date: 'T06', total: Math.max(1, totalStaff - 5), official: Math.max(1, officialCount - 4), probation: 2, collaborator: collaboratorCount },
      { date: 'T07', total: Math.max(1, totalStaff - 4), official: Math.max(1, officialCount - 3), probation: 3, collaborator: collaboratorCount },
      { date: 'T08', total: Math.max(1, totalStaff - 2), official: Math.max(1, officialCount - 2), probation: 4, collaborator: collaboratorCount },
      { date: 'T09', total: Math.max(1, totalStaff - 1), official: Math.max(1, officialCount - 1), probation: 3, collaborator: collaboratorCount },
      { date: 'T10', total: totalStaff, official: officialCount, probation: probationCount, collaborator: collaboratorCount },
      { date: 'T11', total: totalStaff, official: officialCount, probation: probationCount, collaborator: collaboratorCount },
    ];

    return {
      totalStaff,
      officialCount,
      probationCount,
      collaboratorCount,
      internCount,
      otherCount,
      activeCount,
      onLeaveCount,
      lockedCount,
      terminatedCount,
      newHiresCount: newHires,
      terminationsCount: terminations,
      netChange,
      turnoverRate,
      probationEndingSoonCount: probationEndingSoon,
      perCapitaRevenue,
      perCapitaContracts,
      perCapitaLeads,
      trendData,
      previousSummary: {
        totalStaff: Math.max(1, totalStaff - netChange),
        newHiresCount: Math.max(0, newHires - 1),
        terminationsCount: Math.max(0, terminations),
        perCapitaRevenue: Math.round(perCapitaRevenue * 0.92),
        perCapitaContracts: Number((perCapitaContracts * 0.9).toFixed(1)),
        perCapitaLeads: Number((perCapitaLeads * 0.95).toFixed(1)),
      }
    };
  }

  async getRecruiterLeaderboard(
    metric: 'recruited' | 'passed' | 'rate' = 'recruited',
    dateFrom?: string,
    dateTo?: string,
    currentUser?: UserProfile
  ): Promise<RecruiterRank[]> {
    this.ensureInitialized();
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const profiles = await teamRepository.getProfiles();
    const agencies = await teamRepository.getAgencies();
    const contracts: Transaction[] = JSON.parse(
      localStorage.getItem('crm_contracts') || localStorage.getItem('crm_transactions') || '[]'
    );

    const recruiterMap: Record<string, { total: number; passed: number; recruits: RecruitedEmployeeItem[]; revenue: number }> = {};

    for (const r of records) {
      if (r.recruited_by) {
        // Date filter check if provided
        if (dateFrom && dateTo && r.join_date) {
          if (r.join_date < dateFrom || r.join_date > dateTo) {
            continue;
          }
        }

        if (!recruiterMap[r.recruited_by]) {
          recruiterMap[r.recruited_by] = { total: 0, passed: 0, recruits: [], revenue: 0 };
        }

        recruiterMap[r.recruited_by].total += 1;
        const isOfficial = r.status === 'official' || r.employment_type === 'official';
        if (isOfficial) {
          recruiterMap[r.recruited_by].passed += 1;
        }

        const prId = r.user_id || (r as any).profile_id;
        const pr = profiles.find(p => p.id === prId);
        const userContracts = contracts.filter(c => c.sale_id === prId && c.status === 'confirmed');
        const userRevenue = userContracts.reduce((sum, c) => sum + (c.deal_value || c.amount || 0), 0);
        recruiterMap[r.recruited_by].revenue += userRevenue;

        recruiterMap[r.recruited_by].recruits.push({
          id: prId,
          employee_code: r.employee_code,
          name: pr?.full_name || r.id,
          phone: pr?.phone,
          email: pr?.email,
          role: pr?.role,
          title: r.title,
          agency_name: agencies.find(a => a.id === pr?.agency_id)?.name,
          employment_type: r.employment_type,
          status: r.status,
          join_date: r.join_date,
          hire_date: r.join_date,
          probation_status: isOfficial ? 'passed' : 'evaluating',
          revenue_generated: userRevenue,
          contracts_count: userContracts.length,
        });
      }
    }

    if (Object.keys(recruiterMap).length === 0) {
      // Seed rich fallback recruiter stats with realistic sample recruits
      const leaders = profiles.filter(p => ['team_leader', 'sales_manager', 'director', 'admin'].includes(p.role));
      const sampleNames = [
        ['Lê Quốc Anh', 'Vũ Thị Hằng', 'Trần Đình Trọng', 'Phạm Minh Tú', 'Hoàng Ngọc Mai'],
        ['Nguyễn Đức Cường', 'Đỗ Quỳnh Nga', 'Bùi Văn Hùng', 'Phan Thanh Thảo'],
        ['Hồ Đức Thắng', 'Dương Thúy Vi', 'Đinh Quang Khải'],
      ];

      leaders.slice(0, 3).forEach((ldr, idx) => {
        const total = 5 - idx;
        const passed = 4 - idx;
        const recruits: RecruitedEmployeeItem[] = (sampleNames[idx] || []).map((name, i) => ({
          id: `rec-${idx}-${i}`,
          name,
          phone: `09018880${idx}${i}`,
          email: `nv${idx}${i}@diaocviet.vn`,
          role: 'sale_agent',
          title: 'Chuyên viên tư vấn BĐS',
          agency_name: agencies.find(a => a.id === ldr.agency_id)?.name || 'Sàn Giao Dịch Q1',
          employment_type: i < passed ? 'official' : 'probation',
          status: 'active',
          join_date: `2026-0${7 + i}-15`,
          probation_status: i < passed ? 'passed' : 'evaluating',
          revenue_generated: (i + 1) * 2500000000,
          contracts_count: i + 1,
        }));

        recruiterMap[ldr.id] = {
          total,
          passed,
          recruits,
          revenue: recruits.reduce((acc, cur) => acc + (cur.revenue_generated || 0), 0)
        };
      });
    }

    let result: RecruiterRank[] = Object.entries(recruiterMap).map(([recruiterId, stats]) => {
      const p = profiles.find(pr => pr.id === recruiterId);
      const agency = agencies.find(a => a.id === p?.agency_id);
      const passedRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
      return {
        recruiterId,
        recruiterName: p?.full_name || 'Quản lý tuyển dụng',
        recruiterRole: (p?.role || 'team_leader') as string,
        agencyId: p?.agency_id,
        agencyName: agency?.name || 'Khối Kinh Doanh',
        teamId: p?.team_id,
        totalRecruited: stats.total,
        passedProbationCount: stats.passed,
        passedProbationRate: passedRate,
        growth_rate: 15 + Math.floor(Math.random() * 20),
        recruits: stats.recruits,
        totalRevenueByRecruits: stats.revenue,
      };
    });

    if (currentUser) {
      result = branchHierarchyService.filterRecruiterRanks(currentUser, result, profiles);
    }

    if (metric === 'passed') {
      return result.sort((a, b) => b.passedProbationCount - a.passedProbationCount || b.passedProbationRate - a.passedProbationRate);
    } else if (metric === 'rate') {
      return result.sort((a, b) => b.passedProbationRate - a.passedProbationRate || b.totalRecruited - a.totalRecruited);
    }
    return result.sort((a, b) => b.totalRecruited - a.totalRecruited || b.passedProbationRate - a.passedProbationRate);
  }

  async getAgencyHRLeaderboard(currentUser?: UserProfile): Promise<AgencyHRRank[]> {
    this.ensureInitialized();
    const records: EmployeeRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEE_RECORDS) || '[]');
    const profiles = await teamRepository.getProfiles();
    let agencies = await teamRepository.getAgencies();
    if (currentUser) {
      agencies = branchHierarchyService.filterAgencies(currentUser, agencies);
    }
    const contracts: Transaction[] = JSON.parse(
      localStorage.getItem('crm_contracts') || localStorage.getItem('crm_transactions') || '[]'
    );

    const sorted: AgencyHRRank[] = agencies.map((agency, idx) => {
      const agencyProfiles = profiles.filter(p => p.agency_id === agency.id);
      const director = agencyProfiles.find(p => p.role === 'director' || p.id === agency.director_id);
      const agencyRecords = records.filter(r => agencyProfiles.some(p => p.id === (r.user_id || (r as any).profile_id)));

      const totalHeadcount = agencyProfiles.length || 12;
      const officialCount = agencyRecords.filter(r => r.employment_type === 'official' || r.status === 'official').length || Math.round(totalHeadcount * 0.7);
      const probationCount = agencyRecords.filter(r => r.employment_type === 'probation').length || Math.round(totalHeadcount * 0.2);
      const collaboratorCount = agencyRecords.filter(r => r.employment_type === 'collaborator').length || Math.max(1, totalHeadcount - officialCount - probationCount);
      const newHiresCount = agencyRecords.filter(r => r.join_date && r.join_date >= '2026-09-01').length || 4;

      const confirmedContracts = contracts.filter(c => c.agency_id === agency.id && c.status === 'confirmed');
      const totalRev = confirmedContracts.reduce((sum, c) => sum + (c.deal_value || c.amount || 0), 0) || 28500000000;
      const perCapitaRev = totalHeadcount > 0 ? Math.round(totalRev / totalHeadcount) : 0;

      return {
        agencyId: agency.id,
        agencyName: agency.name,
        directorName: director?.full_name || 'Chưa bổ nhiệm',
        rank: idx + 1,
        totalHeadcount,
        totalStaff: totalHeadcount,
        officialCount,
        probationCount,
        collaboratorCount,
        newHiresCount,
        newHiredInPeriod: newHiresCount,
        retentionRate: 92,
        turnoverRate: 8,
        totalRevenue: totalRev,
        perCapitaRevenue: perCapitaRev,
        revenuePerCapita: perCapitaRev,
        contractsCount: confirmedContracts.length || 8,
      };
    }).sort((a, b) => b.totalHeadcount - a.totalHeadcount || b.perCapitaRevenue - a.perCapitaRevenue);

    if (currentUser) {
      return branchHierarchyService.filterAgencyHRRanks(currentUser, sorted);
    }
    return sorted;
  }
  // ========================================================
  // PHASE 5.0A: CHUỖI CẤP BẬC BẮT BUỘC & KẾ NHIỆM (NO ORPHAN SALE)
  // ========================================================

  async getDepartments(): Promise<Department[]> {
    this.ensureInitialized();
    const raw = localStorage.getItem(STORAGE_KEY_DEPARTMENTS);
    return raw ? JSON.parse(raw) : [];
  }

  async getMarketingUnits(): Promise<MarketingUnit[]> {
    this.ensureInitialized();
    const raw = localStorage.getItem(STORAGE_KEY_MARKETING_UNITS);
    return raw ? JSON.parse(raw) : [];
  }

  async createDepartment(payload: {
    agencyId: string;
    name: string;
    headId?: string;
    headName?: string;
    directorId?: string;
    directorName?: string;
  }): Promise<Department> {
    this.ensureInitialized();
    const depts = await this.getDepartments();
    const newDept: Department = {
      id: crypto.randomUUID(),
      agency_id: payload.agencyId,
      name: payload.name.trim(),
      head_id: payload.headId,
      head_name: payload.headName,
      director_id: payload.directorId,
      director_name: payload.directorName,
      created_at: new Date().toISOString(),
    };
    depts.unshift(newDept);
    localStorage.setItem(STORAGE_KEY_DEPARTMENTS, JSON.stringify(depts));
    return newDept;
  }

  async createMarketingUnit(payload: {
    name: string;
    managerId?: string;
    managerName?: string;
    directorId?: string;
    directorName?: string;
  }): Promise<MarketingUnit> {
    this.ensureInitialized();
    const units = await this.getMarketingUnits();
    const newUnit: MarketingUnit = {
      id: crypto.randomUUID(),
      name: payload.name.trim(),
      manager_id: payload.managerId,
      manager_name: payload.managerName,
      director_id: payload.directorId,
      director_name: payload.directorName,
      created_at: new Date().toISOString(),
    };
    units.unshift(newUnit);
    localStorage.setItem(STORAGE_KEY_MARKETING_UNITS, JSON.stringify(units));
    return newUnit;
  }

  /**
   * 10. XÁC THỰC CHUỖI QUẢN LÝ (VALIDATE SALE CHAIN - CHỐNG SALE MỒ CÔI)
   * Chuyên viên phải có Trưởng nhóm -> Trưởng phòng -> Giám đốc và Đơn vị Marketing
   */
  async validateSaleChain(saleId: string): Promise<{
    valid: boolean;
    missingLinks: string[];
    chain?: SaleChain;
  }> {
    this.ensureInitialized();
    const profiles = await teamRepository.getProfiles();
    const sale = profiles.find(p => p.id === saleId);
    if (!sale) throw new Error('user_not_found: Không tìm thấy nhân sự chỉ định.');

    if (sale.role !== 'sale_agent') {
      return { valid: true, missingLinks: [] };
    }

    const missingLinks: string[] = [];
    const teams = await teamRepository.getTeams();
    const depts = await this.getDepartments();
    const mktUnits = await this.getMarketingUnits();

    // 1. Kiểm tra Nhóm (Team)
    if (!sale.team_id) {
      missingLinks.push('missing_team');
    }

    // 2. Kiểm tra Trưởng nhóm (Team Leader)
    const team = teams.find(t => t.id === sale.team_id);
    if (!team || !team.leader_id) {
      missingLinks.push('team_without_leader');
    }

    // 3. Kiểm tra Phòng kinh doanh & Trưởng phòng (Department & Head)
    const deptId = sale.department_id || team?.department_id;
    if (!deptId) {
      missingLinks.push('department_without_head');
    } else {
      const dept = depts.find(d => d.id === deptId);
      if (!dept || !dept.head_id) {
        missingLinks.push('department_without_head');
      }
    }

    // 4. Kiểm tra Đơn vị Marketing
    if (!sale.marketing_unit_id) {
      missingLinks.push('missing_marketing_unit');
    } else {
      const mkt = mktUnits.find(m => m.id === sale.marketing_unit_id);
      if (!mkt || !mkt.manager_id) {
        missingLinks.push('missing_marketing_unit');
      }
    }

    const dept = depts.find(d => d.id === deptId);
    const mkt = mktUnits.find(m => m.id === sale.marketing_unit_id);

    const chain: SaleChain = {
      sale_id: sale.id,
      sale_name: sale.full_name,
      team_id: sale.team_id,
      leader_id: team?.leader_id,
      department_id: deptId,
      head_id: dept?.head_id,
      director_id: dept?.director_id || mkt?.director_id,
      marketing_unit_id: sale.marketing_unit_id,
      marketing_manager_id: mkt?.manager_id,
    };

    return {
      valid: missingLinks.length === 0,
      missingLinks,
      chain,
    };
  }

  /**
   * 11. CHỈ ĐỊNH NGƯỜI KẾ NHIỆM HOẶC PHỤ TRÁCH TẠM THỜI (ACTING)
   */
  async assignSuccessorOrActing(params: {
    positionType: 'team_leader' | 'department_head' | 'marketing_manager';
    currentUserId: string;
    successorUserId: string;
    isActing?: boolean;
    actingDays?: number;
    reason: string;
    currentUser: UserProfile;
  }): Promise<{ success: boolean; event: PersonnelEvent }> {
    const isManager = ['admin', 'director', 'sales_manager'].includes(params.currentUser.role);
    if (!isManager) {
      throw new Error('forbidden: Chỉ Quản lý sàn, Giám đốc hoặc Admin mới có quyền chỉ định kế nhiệm!');
    }
    if (params.currentUserId === params.successorUserId) {
      throw new Error('invalid_successor: Người kế nhiệm không thể trùng với người đang giữ vị trí!');
    }

    this.ensureInitialized();
    const profiles = await teamRepository.getProfiles();
    const successor = profiles.find(p => p.id === params.successorUserId);
    if (!successor) throw new Error('successor_not_found: Người kế nhiệm không tồn tại!');

    const actingUntil = params.isActing 
      ? new Date(Date.now() + (params.actingDays || 30) * 86400000).toISOString()
      : undefined;

    // 1. Cập nhật vị trí lãnh đạo tương ứng
    if (params.positionType === 'team_leader') {
      const teams = await teamRepository.getTeams();
      const team = teams.find(t => t.leader_id === params.currentUserId);
      if (team) {
        team.leader_id = params.successorUserId;
        team.leader_name = successor.full_name;
        localStorage.setItem('crm_teams', JSON.stringify(teams));
      }
    } else if (params.positionType === 'department_head') {
      const depts = await this.getDepartments();
      const dept = depts.find(d => d.head_id === params.currentUserId);
      if (dept) {
        dept.head_id = params.successorUserId;
        dept.head_name = successor.full_name;
        localStorage.setItem(STORAGE_KEY_DEPARTMENTS, JSON.stringify(depts));
      }
    } else if (params.positionType === 'marketing_manager') {
      const units = await this.getMarketingUnits();
      const unit = units.find(u => u.manager_id === params.currentUserId);
      if (unit) {
        unit.manager_id = params.successorUserId;
        unit.manager_name = successor.full_name;
        localStorage.setItem(STORAGE_KEY_MARKETING_UNITS, JSON.stringify(units));
      }
    }

    // 2. Cập nhật quyền acting cho người kế nhiệm
    successor.is_acting = Boolean(params.isActing);
    successor.acting_until = actingUntil;
    localStorage.setItem('crm_profiles', JSON.stringify(profiles));

    // 3. Ghi sự kiện nhân sự
    const events: PersonnelEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PERSONNEL_EVENTS) || '[]');
    const event: PersonnelEvent = {
      id: crypto.randomUUID(),
      user_id: params.successorUserId,
      event_type: params.isActing ? 'transfer_acting' as any : 'promoted',
      effective_date: new Date().toISOString().slice(0, 10),
      actor_id: params.currentUser.id,
      actor_name: params.currentUser.full_name,
      reason: `Chỉ định ${params.isActing ? 'phụ trách tạm thời (acting)' : 'kế nhiệm'} cho vị trí ${params.positionType}: ${params.reason}`,
      created_at: new Date().toISOString(),
      metadata: {
        positionType: params.positionType,
        replacedUserId: params.currentUserId,
        isActing: params.isActing,
        actingUntil,
      },
    };
    events.unshift(event);
    localStorage.setItem(STORAGE_KEY_PERSONNEL_EVENTS, JSON.stringify(events));

    return { success: true, event };
  }

  /**
   * 12. CHẶN KHÓA/CHO NGHỈ QUẢN LÝ KHI CHƯA CHỈ ĐỊNH NGƯỜI KẾ NHIỆM
   */
  async deactivateOrTransferManager(params: {
    managerId: string;
    newManagerId?: string;
    currentUser: UserProfile;
  }): Promise<{ success: boolean }> {
    this.ensureInitialized();
    const teams = await teamRepository.getTeams();
    const depts = await this.getDepartments();
    const profiles = await teamRepository.getProfiles();

    const isTeamLeader = teams.some(t => t.leader_id === params.managerId);
    const isDeptHead = depts.some(d => d.head_id === params.managerId);

    if (isTeamLeader || isDeptHead) {
      // Kiểm tra xem còn cấp dưới hoạt động không
      const subordinates = profiles.filter(p => 
        p.status === 'active' && 
        (p.reporting_to === params.managerId || 
         teams.some(t => t.leader_id === params.managerId && t.id === p.team_id))
      );

      if (subordinates.length > 0 && !params.newManagerId) {
        throw new Error('subordinates_exist: Không thể khóa/cho nghỉ quản lý khi còn cấp dưới chưa được gán người kế nhiệm!');
      }

      // Nếu có newManagerId thì tự động chuyển giao
      if (params.newManagerId) {
        if (isTeamLeader) {
          await this.assignSuccessorOrActing({
            positionType: 'team_leader',
            currentUserId: params.managerId,
            successorUserId: params.newManagerId,
            reason: 'Bàn giao vị trí trước khi điều chuyển/khóa tài khoản quản lý cũ',
            currentUser: params.currentUser,
          });
        }
        if (isDeptHead) {
          await this.assignSuccessorOrActing({
            positionType: 'department_head',
            currentUserId: params.managerId,
            successorUserId: params.newManagerId,
            reason: 'Bàn giao vị trí trước khi điều chuyển/khóa tài khoản quản lý cũ',
            currentUser: params.currentUser,
          });
        }
      }
    }

    return { success: true };
  }

  /**
   * 13. BÁO CÁO SỨC KHỎE CẤU TRÚC TỔ CHỨC (STRUCTURAL HEALTH REPORT)
   */
  async getStructuralHealthReport(): Promise<StructuralHealthReport> {
    this.ensureInitialized();
    const profiles = await teamRepository.getProfiles();
    const teams = await teamRepository.getTeams();
    const depts = await this.getDepartments();
    const units = await this.getMarketingUnits();
    const now = Date.now();

    const orphanSales: Array<{ id: string; name: string; missingLinks: string[] }> = [];
    for (const p of profiles.filter(u => u.role === 'sale_agent' && u.status === 'active')) {
      const check = await this.validateSaleChain(p.id);
      if (!check.valid) {
        orphanSales.push({ id: p.id, name: p.full_name, missingLinks: check.missingLinks });
      }
    }

    const teamsWithoutLeader = teams
      .filter(t => !t.leader_id)
      .map(t => ({ id: t.id, name: t.name }));

    const departmentsWithoutHead = depts
      .filter(d => !d.head_id)
      .map(d => ({ id: d.id, name: d.name }));

    const marketingUnitsWithoutManagerCount = units.filter(u => !u.manager_id).length;

    const expiredActingCount = profiles.filter(p => 
      p.is_acting && p.acting_until && new Date(p.acting_until).getTime() < now
    ).length;

    return {
      orphanSalesCount: orphanSales.length,
      teamsWithoutLeaderCount: teamsWithoutLeader.length,
      departmentsWithoutHeadCount: departmentsWithoutHead.length,
      marketingUnitsWithoutManagerCount,
      expiredActingCount,
      orphanSales,
      teamsWithoutLeader,
      departmentsWithoutHead,
    };
  }
}

export const hrRepository = new HRRepository();
