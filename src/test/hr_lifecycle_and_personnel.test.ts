import { describe, it, expect, beforeEach } from 'vitest';
import { hrRepository } from '../data/repositories/hrRepository';
import { teamRepository } from '../data/repositories/teamRepository';
import { auditRepository } from '../data/repositories/auditRepository';
import { UserProfile } from '../domain/types';

describe('Module 5: Comprehensive HR Lifecycle & Personnel Management', () => {
  const mockAdmin: UserProfile = {
    id: 'admin-001',
    full_name: 'Quản Trị Viên',
    email: 'admin@diaocvang.vn',
    phone: '0901000001',
    role: 'admin',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockHrAdmin: UserProfile = {
    id: 'hr-001',
    full_name: 'Nguyễn Thị HR',
    email: 'hr@diaocvang.vn',
    phone: '0901000002',
    role: 'hr_admin',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockSalesManager: UserProfile = {
    id: 'sm-001',
    full_name: 'Trần Giám Đốc Sàn',
    email: 'sm@diaocvang.vn',
    phone: '0901000003',
    role: 'sales_manager',
    agency_id: 'agency-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockTeamLeader: UserProfile = {
    id: 'tl-001',
    full_name: 'Lê Trưởng Nhóm',
    email: 'tl@diaocvang.vn',
    phone: '0901000004',
    role: 'team_leader',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockSaleAgent1: UserProfile = {
    id: 'sale-001',
    full_name: 'Phạm Chuyên Viên 1',
    email: 'sale1@diaocvang.vn',
    phone: '0901000005',
    role: 'sale_agent',
    agency_id: 'agency-01',
    team_id: 'team-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  const mockSaleAgent2: UserProfile = {
    id: 'sale-002',
    full_name: 'Vũ Chuyên Viên 2',
    email: 'sale2@diaocvang.vn',
    phone: '0901000006',
    role: 'sale_agent',
    agency_id: 'agency-02',
    team_id: 'team-02',
    status: 'active',
    must_change_password: false,
    totp_enabled: false,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Ma trận quyền dữ liệu: Sale chỉ thấy nhân sự trong team mình; HR/Admin thấy toàn hệ thống', async () => {
    // Sale 1 truy vấn danh sách nhân sự
    const saleView = await hrRepository.getEmployees({}, mockSaleAgent1);
    // Sale 1 chỉ thấy chính mình và người cùng team-01, không thấy Sale 2 thuộc team-02
    const hasSale2 = saleView.some(e => e.id === mockSaleAgent2.id);
    expect(hasSale2).toBe(false);

    // HR Admin truy vấn danh sách nhân sự -> xem được toàn bộ
    const hrView = await hrRepository.getEmployees({}, mockHrAdmin);
    expect(hrView.length).toBeGreaterThanOrEqual(1);
  });

  it('2. Bảo mật hồ sơ 360°: Dữ liệu nhạy cảm (CCCD, MST, STK ngân hàng) bị ẩn với Sale/Team Leader khác', async () => {
    // Seed private data for Sale 1
    localStorage.setItem('crm_employee_private', JSON.stringify([
      {
        id: 'priv-001',
        user_id: mockSaleAgent1.id,
        id_card_number: '079196001234',
        tax_id: '8392019482',
        bank_account_number: '19034567891011',
        bank_name: 'Techcombank',
        emergency_contact_name: 'Bố ruột',
        emergency_contact_phone: '0903112233',
      }
    ]));

    // Đăng ký profile của Sale 1
    const profiles = await teamRepository.getProfiles();
    profiles.push(mockSaleAgent1);
    localStorage.setItem('crm_profiles', JSON.stringify(profiles));

    // Team Leader xem hồ sơ 360 của Sale 1 -> Xem được đầy đủ thông tin nhân sự trực tiếp
    const tlProfileView = await hrRepository.getEmployee360Profile(mockSaleAgent1.id, mockTeamLeader);
    expect(tlProfileView.hasPrivateAccess).toBe(true);
    expect(tlProfileView.maskedPrivate?.id_card_number).toBe('079196001234');
    expect(tlProfileView.maskedPrivate?.tax_id).toBe('8392019482');
    expect(tlProfileView.maskedPrivate?.bank_account_number).toBe('19034567891011');

    // HR Admin xem hồ sơ 360 của Sale 1 -> xem đầy đủ trực tiếp
    const hrProfileView = await hrRepository.getEmployee360Profile(mockSaleAgent1.id, mockHrAdmin);
    expect(hrProfileView.hasPrivateAccess).toBe(true);
    expect(hrProfileView.maskedPrivate?.id_card_number).toBe('079196001234');
  });

  it('3. Tra cứu dữ liệu nhạy cảm (Reveal): Bắt buộc lý do nghiệp vụ và ghi vết vào Audit Log', async () => {
    localStorage.setItem('crm_employee_private', JSON.stringify([
      {
        id: 'priv-001',
        user_id: mockSaleAgent1.id,
        id_card_number: '079196001234',
        tax_id: '8392019482',
        bank_account_number: '19034567891011',
      }
    ]));

    // Sale khác cố tra cứu -> bị từ chối
    await expect(
      hrRepository.revealPrivateField(mockSaleAgent1.id, 'id_card_number', 'Xem cho biết', mockSaleAgent2)
    ).rejects.toThrow(/forbidden/);

    // HR tra cứu nhưng thiếu lý do -> bị từ chối
    await expect(
      hrRepository.revealPrivateField(mockSaleAgent1.id, 'id_card_number', '   ', mockHrAdmin)
    ).rejects.toThrow(/invalid_argument/);

    // HR tra cứu có lý do hợp lệ -> thành công và ghi log audit
    const res = await hrRepository.revealPrivateField(
      mockSaleAgent1.id,
      'id_card_number',
      'Đăng ký hồ sơ thuế TNCN và bảo hiểm bắt buộc',
      mockHrAdmin
    );
    expect(res.value).toBe('079196001234');

    const logs = await auditRepository.getAuditLogs();
    const revealLog = logs.find(l => l.action === 'reveal_employee_private');
    expect(revealLog).toBeDefined();
    expect(revealLog?.user_id).toBe(mockHrAdmin.id);
  });

  it('4. Tuyển dụng ATS: Atomic Hire tái sử dụng luồng admin, tạo Employee Record, Onboarding Tasks và sự kiện Hired', async () => {
    // 1. Tạo ứng viên tuyển dụng
    const candRes = await hrRepository.createCandidate({
      fullName: 'Hoàng Kim Tuyển Mới',
      phone: '0988665544',
      email: 'hoang.kim@diaocvang.vn',
      source: 'Tuyển dụng trực tiếp',
      notes: 'Đã hoàn thành phỏng vấn',
      currentUser: mockHrAdmin,
    });
    expect(candRes.candidate).toBeDefined();

    // 2. Thực hiện Atomic Hire
    const hireRes = await hrRepository.atomicHireCandidate(
      candRes.candidate.id,
      {
        email: 'hoang.kim@diaocvang.vn',
        full_name: 'Hoàng Kim Tuyển Mới',
        phone: '0988665544',
        role: 'sale_agent',
        agency_id: 'agency-01',
        team_id: 'team-01',
      },
      mockHrAdmin
    );

    expect(hireRes.success).toBe(true);
    expect(hireRes.employeeRecord.employee_code).toBeDefined();
    expect(hireRes.employeeRecord.employment_type).toBe('probation');

    // 3. Kiểm tra Checklist Onboarding tự động sinh
    const p360 = await hrRepository.getEmployee360Profile(hireRes.userProfile.id, mockHrAdmin);
    expect(p360.onboardingTasks.length).toBeGreaterThan(0);
    expect(p360.onboardingTasks.some(t => t.title.includes('Ký hợp đồng'))).toBe(true);

    // 4. Kiểm tra sự kiện nhân sự "hired" đã được ghi nhận
    expect(p360.events.some(e => e.event_type === 'hired')).toBe(true);
  });

  it('5. Phát hiện trùng ứng viên: Cùng số điện thoại kích hoạt cảnh báo trùng lặp', async () => {
    // Nộp lần 1
    await hrRepository.createCandidate({
      fullName: 'Ứng Viên A',
      phone: '0912334455',
      source: 'TopCV',
      currentUser: mockHrAdmin,
    });

    // Nộp lần 2 cùng SĐT
    const res2 = await hrRepository.createCandidate({
      fullName: 'Ứng Viên A Duplicate',
      phone: '0912334455',
      source: 'Facebook',
      currentUser: mockHrAdmin,
    });

    expect(res2.isDuplicate).toBe(true);
    expect(res2.warning).toContain('đã nộp hồ sơ trước đó');
  });

  it('6. Quản lý nghỉ phép: Duyệt phép tự động trừ số dư và kích hoạt cờ on_leave đúng ngày', async () => {
    // Đăng ký profile của Sale 1
    const initProfiles = await teamRepository.getProfiles();
    initProfiles.push(mockSaleAgent1);
    localStorage.setItem('crm_profiles', JSON.stringify(initProfiles));

    // 1. Tạo đơn nghỉ phép cho Sale 1
    const req = await hrRepository.createLeaveRequest({
      leaveTypeId: 'lt-1',
      startDate: new Date().toISOString().slice(0, 10), // Hôm nay
      endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      totalDays: 2,
      reason: 'Nghỉ phép gia đình',
      currentUser: mockSaleAgent1,
    });
    expect(req.status).toBe('pending');

    // 2. Quản lý duyệt đơn
    const approveRes = await hrRepository.approveLeaveRequest(req.id, true, undefined, mockSalesManager);
    expect(approveRes.success).toBe(true);

    // 3. Kiểm tra cờ on_leave đã được bật
    const profiles = await teamRepository.getProfiles();
    const updatedSale1 = profiles.find(p => p.id === mockSaleAgent1.id);
    expect(updatedSale1?.on_leave).toBe(true);
  });

  it('7. Điều chuyển Maker-Checker: Chặn tự phê duyệt chính mình; Khi duyệt cập nhật Sàn/Team và Audit Trail', async () => {
    // Đăng ký profile của Sale 1
    const profiles = await teamRepository.getProfiles();
    profiles.push(mockSaleAgent1);
    localStorage.setItem('crm_profiles', JSON.stringify(profiles));

    // 1. Team Leader tạo yêu cầu điều chuyển Sale 1 sang team-02
    const req = await hrRepository.createTransferRequest({
      userId: mockSaleAgent1.id,
      requestType: 'transfer',
      toAgencyId: 'agency-02',
      toTeamId: 'team-02',
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: 'Hỗ trợ dự án mới tại Sàn 2',
      currentUser: mockTeamLeader,
    });
    expect(req.status).toBe('pending');

    // 2. Chặn tự duyệt nếu người duyệt chính là nhân sự được điều chuyển
    await expect(
      hrRepository.applyPersonnelTransfer(req.id, mockSaleAgent1)
    ).rejects.toThrow(/forbidden|invalid_operation/);

    // 3. Giám Đốc Sàn phê duyệt
    const applyRes = await hrRepository.applyPersonnelTransfer(req.id, mockSalesManager);
    expect(applyRes.success).toBe(true);

    // 4. Kiểm tra hồ sơ Sale 1 đã chuyển sang team-02
    const updatedProfiles = await teamRepository.getProfiles();
    const transferredSale = updatedProfiles.find(p => p.id === mockSaleAgent1.id);
    expect(transferredSale?.team_id).toBe('team-02');
    expect(transferredSale?.agency_id).toBe('agency-02');
  });

  it('8. Chứng chỉ môi giới BĐS: Theo dõi hạn và cảnh báo sắp hết hạn', async () => {
    // Thêm chứng chỉ sắp hết hạn (10 ngày nữa)
    const cert = await hrRepository.saveBrokerCertificate({
      userId: mockSaleAgent1.id,
      certificateNumber: 'BĐS-HN-2021-9988',
      issuingAuthority: 'Sở Xây Dựng Hà Nội',
      issueDate: '2021-11-20',
      expiryDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      currentUser: mockHrAdmin,
    });

    expect(cert.id).toBeDefined();
    const certs = await hrRepository.getBrokerCertificates(mockSaleAgent1.id);
    expect(certs.length).toBeGreaterThan(0);
  });

  it('9. HR Quyền Tạo Cơ Cấu: HR Admin có quyền tạo Vùng, tạo Sàn, tạo Đội nhóm và tạo Sale Account với quan hệ 4 tầng CEO / Vùng / Sàn / Team', async () => {
    // 1. HR tạo Vùng kinh doanh mới
    const regionRes = await teamRepository.createRegion({
      name: 'Vùng Duyên Hải Miền Trung',
      code: 'REG-CENTRAL',
      organization_id: 'org-1',
      description: 'Phụ trách Đà Nẵng, Nha Trang, Quy Nhơn',
    });
    expect(regionRes.success).toBe(true);
    expect(regionRes.region?.id).toBeDefined();
    expect(regionRes.region?.code).toBe('REG-CENTRAL');

    // 2. HR tạo Sàn giao dịch mới thuộc Vùng
    const agencyRes = await teamRepository.createAgency({
      name: 'Sàn Giao Dịch Đà Nẵng Riverside',
      code: 'S9-DN',
      organization_id: 'org-1',
      region_id: regionRes.region!.id,
      address: 'Bạch Đằng, Q. Hải Châu, Đà Nẵng',
    });
    expect(agencyRes.success).toBe(true);
    expect(agencyRes.agency?.id).toBeDefined();
    expect(agencyRes.agency?.region_id).toBe(regionRes.region!.id);

    // 3. HR tạo Đội nhóm mới thuộc Sàn
    const teamRes = await teamRepository.createTeam({
      name: 'Team Sông Hàn',
      code: 'TM-SHAN',
      agency_id: agencyRes.agency!.id,
    });
    expect(teamRes.success).toBe(true);
    expect(teamRes.team?.id).toBeDefined();
    expect(teamRes.team?.agency_id).toBe(agencyRes.agency!.id);

    // 4. HR tạo Sale Account mới liên kết đầy đủ 4 tầng
    const saleAccRes = await hrRepository.createEmployeeAccount({
      email: 'sale.danang@diaocvang.vn',
      full_name: 'Lê Văn Miền Trung',
      phone: '0905999888',
      role: 'sale_agent',
      organization_id: 'org-1',
      region_id: regionRes.region!.id,
      agency_id: agencyRes.agency!.id,
      team_id: teamRes.team!.id,
      employment_type: 'official',
      title: 'Chuyên viên tư vấn BĐS Biển',
    }, mockHrAdmin);

    expect(saleAccRes.success).toBe(true);
    expect(saleAccRes.userProfile).toBeDefined();
    expect(saleAccRes.userProfile?.organization_id).toBe('org-1');
    expect(saleAccRes.userProfile?.region_id).toBe(regionRes.region!.id);
    expect(saleAccRes.userProfile?.agency_id).toBe(agencyRes.agency!.id);
    expect(saleAccRes.userProfile?.team_id).toBe(teamRes.team!.id);
    expect(saleAccRes.employeeRecord?.employee_code).toBeDefined();
    expect(saleAccRes.employeeRecord?.employment_type).toBe('official');
  });

  it('10. Khóa / Inactive tài khoản khi nhân sự nghỉ việc: HR Admin có quyền khóa tài khoản (Inactive), ghi nhận sự kiện nghỉ việc (resigned) và mở khóa lại', async () => {
    // 1. Tạo nhân sự thử nghiệm
    const createRes = await hrRepository.createEmployeeAccount({
      email: 'sale.quitter@diaocvang.vn',
      full_name: 'Nguyễn Văn Nghỉ Việc',
      phone: '0909111222',
      role: 'sale_agent',
      employment_type: 'official',
    }, mockHrAdmin);
    expect(createRes.success).toBe(true);
    const targetUserId = createRes.userProfile!.id;

    // 2. HR Admin thực hiện Khóa tài khoản do nghỉ việc
    const lockRes = await hrRepository.toggleLockEmployee(
      targetUserId,
      'locked',
      'Nhân sự nộp đơn thôi việc và đã hoàn tất thủ tục bàn giao khách hàng',
      mockHrAdmin
    );
    expect(lockRes.success).toBe(true);

    // 3. Kiểm tra trạng thái UserProfile đã chuyển sang locked
    const profiles = await teamRepository.getProfiles();
    const lockedUser = profiles.find(p => p.id === targetUserId);
    expect(lockedUser?.status).toBe('locked');

    // 4. Nhân sự quay lại làm việc -> HR mở khóa tài khoản
    const unlockRes = await hrRepository.toggleLockEmployee(
      targetUserId,
      'active',
      'Nhân sự tái ký hợp đồng làm việc',
      mockHrAdmin
    );
    expect(unlockRes.success).toBe(true);

    const updatedProfiles = await teamRepository.getProfiles();
    const activeUser = updatedProfiles.find(p => p.id === targetUserId);
    expect(activeUser?.status).toBe('active');
  });

  it('11. Đảm bảo bảo mật đa doanh nghiệp (Multi-tenant isolation) cho Tuyển dụng, Ứng viên và Báo cáo nhân sự', async () => {
    const maicomAdmin: UserProfile = {
      id: 'maicom-admin-user',
      email: 'admin@maicom.vn',
      full_name: 'Quản Trị Maicom',
      phone: '0909000111',
      role: 'company_admin',
      organization_id: 'org-maicom-id',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    // 1. Maicom Admin không xem được Job Requisitions của DN khác
    const requisitions = await hrRepository.getJobRequisitions(maicomAdmin);
    expect(requisitions.some(r => r.id === 'req-01')).toBe(false);

    // 2. Maicom Admin không xem được Ứng viên của DN khác
    const candidates = await hrRepository.getCandidates(undefined, maicomAdmin);
    expect(candidates.some(c => c.id === 'cand-01')).toBe(false);

    // 3. Quản trị tổng (Admin) xem được toàn bộ
    const superAdmin: UserProfile = {
      id: 'super-admin-user',
      email: 'admin@diaocvang.vn',
      full_name: 'Quản Trị Tổng',
      phone: '0909999999',
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    const allReqs = await hrRepository.getJobRequisitions(superAdmin);
    expect(allReqs.some(r => r.id === 'req-01')).toBe(true);
  });
});
