import { describe, it, expect, beforeEach } from 'vitest';
import { autoTransferService } from '@/domain/services/autoTransferService';
import { holdRepository } from '@/data/repositories/holdRepository';
import { contractRepository } from '@/data/repositories/contractRepository';
import { salesWorkflowService } from '@/domain/services/salesWorkflowService';
import { hrRepository } from '@/data/repositories/hrRepository';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { privacyService } from '@/domain/services/privacyService';
import { knowledgeAndScriptService } from '@/domain/services/knowledgeAndScriptService';
import { UserProfile, Customer, Lead, Project, UnitHold } from '@/domain/types';

describe('Phase 9: Comprehensive System Regression & End-to-End Integration', () => {
  const admin: UserProfile = {
    id: 'user-admin-root',
    email: 'admin@diaocbroker.vn',
    full_name: 'Tổng Quản Trị',
    phone: '0901000000',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const director: UserProfile = {
    id: 'user-dir-01',
    email: 'director@diaocbroker.vn',
    full_name: 'Giám Đốc Sàn Thủ Đức',
    phone: '0902000000',
    role: 'director',
    agency_id: 'agency-td',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const manager: UserProfile = {
    id: 'user-sm-01',
    email: 'manager@diaocbroker.vn',
    full_name: 'Trưởng Phòng Kinh Doanh 1',
    phone: '0903000000',
    role: 'sales_manager',
    agency_id: 'agency-td',
    department_id: 'dept-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const leader: UserProfile = {
    id: 'user-tl-01',
    email: 'leader@diaocbroker.vn',
    full_name: 'Trưởng Nhóm Diamond',
    phone: '0904000000',
    role: 'team_leader',
    agency_id: 'agency-td',
    team_id: 'team-diamond',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const sale: UserProfile = {
    id: 'user-sale-01',
    email: 'sale@diaocbroker.vn',
    full_name: 'Chuyên Viên Tư Vấn Nam',
    phone: '0905000000',
    role: 'sale_agent',
    agency_id: 'agency-td',
    team_id: 'team-diamond',
    marketing_unit_id: 'mkt-unit-01',
    status: 'active',
    must_change_password: false,
    totp_enabled: true
  };

  const demoProject: Project = {
    id: 'proj-regression-01',
    organization_id: 'org-01',
    name: 'Vinhomes Grand Park Oasis',
    code: 'VHGP-OASIS',
    developer: 'Vinhomes',
    location: 'TP. Thủ Đức, TP. Hồ Chí Minh',
    property_type: 'Căn hộ cao cấp',
    status: 'opening',
    commission_rate: 3.5,
    sale_commission_rate: 1.5
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('crm_profiles', JSON.stringify([admin, director, manager, leader, sale]));
    localStorage.setItem('crm_projects', JSON.stringify([demoProject]));
  });

  // ========================================================
  // 1. END-TO-END FLOW: TỪ TIẾP NHẬN LEAD ĐẾN HỢP ĐỒNG & HOA HỒNG
  // ========================================================
  it('luồng khép kín: Lead mới -> Tương tác SLA -> Giữ căn -> HĐMB -> Hoa hồng đa tầng', async () => {
    // 1. Tạo khách hàng và lead mới qua atomic contract creation API
    const atomicResult = await contractRepository.createContractWithCustomer({
      customerName: 'Nguyễn Thái Bình',
      customerPhone: '0988776655',
      customerEmail: 'thaibinh@vinamail.vn',
      sourceId: 'facebook_ads',
      sourceDetail: 'camp_tet_2026',
      projectId: demoProject.id,
      unitCode: 'A1-25.08',
      dealValue: 5000000000,
      contractCode: 'HDMB-VHGP-2508',
      depositDate: '2026-11-09',
      contractDate: '2026-11-15',
      firstInstallmentAmount: 500000000,
      firstInstallmentDate: '2026-11-20',
      firstInstallmentPaid: true,
      currentUser: sale,
      notes: 'Hợp đồng giao dịch thành công cho khách VIP'
    });

    expect(atomicResult.success).toBe(true);
    expect(atomicResult.customer_id).toBeDefined();
    expect(atomicResult.lead_id).toBeDefined();
    expect(atomicResult.transaction_id).toBeDefined();

    // 2. Chăm sóc và ghi nhận tương tác hợp lệ (>= 20 ký tự)
    const interactionResult = await autoTransferService.recordInteraction({
      leadId: atomicResult.lead_id,
      content: 'Đã liên hệ tư vấn chi tiết chính sách ân hạn lãi suất 24 tháng',
      currentUser: sale
    });
    expect(interactionResult.success).toBe(true);

    // 3. Giữ căn (Hold unit) và kiểm tra tính duy nhất
    const hold = await holdRepository.createUnitHold({
      projectId: demoProject.id,
      unitCode: 'B2-10.05',
      customerName: 'Nguyễn Thái Bình',
      notes: 'Khách cân nhắc căn thứ 2',
      currentUser: sale
    });
    expect(hold.unit_code).toBe('B2-10.05');
    expect(hold.status).toBe('active');

    // Chặn trùng căn đang giữ
    await expect(
      holdRepository.createUnitHold({
        projectId: demoProject.id,
        unitCode: 'B2-10.05',
        customerName: 'Khách Khác',
        notes: 'Cố giữ trùng căn',
        currentUser: admin
      })
    ).rejects.toThrow('đang được giữ chỗ');

    // 4. Tính toán hoa hồng nhiều tầng snapshot
    const commissionDistribution = contractRepository.calculateMultiTierCommissions({
      dealValue: 5000000000,
      agencyRate: 3.5,
      saleRate: 1.5
    });

    // Sàn: 3.5% = 175 triệu
    expect(commissionDistribution.agencyAmount).toBe(175000000);
    // Sale: 1.5% = 75 triệu
    expect(commissionDistribution.saleAmount).toBe(75000000);
    // Trưởng nhóm: 0.2% = 10 triệu
    expect(commissionDistribution.teamLeaderAmount).toBe(10000000);
    // Trưởng phòng: 0.1% = 5 triệu
    expect(commissionDistribution.salesManagerAmount).toBe(5000000);
    // Giám đốc: 0.1% = 5 triệu
    expect(commissionDistribution.directorAmount).toBe(5000000);

    // Sổ cái hoa hồng khấu trừ thuế TNCN 10%
    const entries = contractRepository.createCommissionEntries({
      contractId: atomicResult.transaction_id,
      snapshot: commissionDistribution,
      primarySaleId: sale.id,
      primarySaleName: sale.full_name
    });

    const saleEntry = entries.find(e => e.recipient_id === sale.id)!;
    expect(saleEntry.amount).toBe(75000000);
    expect(saleEntry.pit_tax_amount).toBe(7500000); // 10%
    expect(saleEntry.net_payable_amount).toBe(67500000); // 90%
  });

  // ========================================================
  // 2. TÍCH HỢP QUẢN TRỊ DỮ LIỆU & QUYỀN RIÊNG TƯ NĐ 13
  // ========================================================
  it('tích hợp Quản trị dữ liệu: Khóa lạc quan, Thùng rác và Xuất hồ sơ NĐ 13', async () => {
    // 1. Khách hàng mẫu
    const customer: Customer = {
      id: 'cust-reg-01',
      organization_id: 'org-01',
      full_name: 'Vũ Thị Minh Ngọc',
      phone: '0977665544',
      phone_normalized: '0977665544',
      identity_card: '079190001234',
      consent_obtained: true
    };
    localStorage.setItem('crm_customers', JSON.stringify([customer]));

    // Lead mẫu
    const lead: Partial<Lead> = {
      id: 'lead-reg-01',
      customer_id: customer.id,
      agency_id: 'agency-td',
      status: 'contacted',
      version: 1
    };
    localStorage.setItem('crm_leads', JSON.stringify([lead]));

    // 2. Cập nhật có kiểm soát qua Giám đốc Sàn
    const updatedLead = controlledDataService.updateLeadControlled(
      'lead-reg-01',
      { status: 'site_visit' },
      1,
      'Khách đã xác nhận tham gia sự kiện xem sa bàn',
      director
    );
    expect(updatedLead.status).toBe('site_visit');
    expect(updatedLead.version).toBe(2);

    // 3. Xóa mềm vào Thùng rác và khôi phục
    const trash = controlledDataService.softDeleteLead('lead-reg-01', 'Khách đổi kế hoạch tài chính', director);
    expect(trash.id).toBeDefined();

    const restored = controlledDataService.restoreLeadFromTrash(trash.id, director);
    expect(restored.deleted_at).toBeUndefined();
    expect(restored.care_deadline_at).toBeDefined();

    // 4. Quyền riêng tư NĐ 13: Xuất hồ sơ dữ liệu cá nhân
    const exportData = await privacyService.requestDataExport(customer.id, director);
    expect(exportData.customer.full_name).toBe(customer.full_name);
    expect(exportData.customer.identity_card).toBe(customer.identity_card);
    expect(exportData.legalBasis).toContain('Nghị định 13/2023/NĐ-CP');
  });

  // ========================================================
  // 3. CƠ CẤU NHÂN SỰ CHẶT CHẼ & BỘ LỌC TUÂN THỦ KỊCH BẢN
  // ========================================================
  it('tích hợp Cơ cấu nhân sự chặt chẽ & Bộ lọc tuân thủ kịch bản bán hàng', async () => {
    // 1. Kiểm tra chuỗi quản lý của Sale
    localStorage.setItem('crm_teams', JSON.stringify([
      { id: 'team-diamond', name: 'Diamond', leader_id: leader.id, department_id: 'dept-01' }
    ]));
    localStorage.setItem('crm_departments', JSON.stringify([
      { id: 'dept-01', name: 'Phòng KD 1', head_id: manager.id, director_id: director.id }
    ]));
    localStorage.setItem('crm_marketing_units', JSON.stringify([
      { id: 'mkt-unit-01', name: 'Đơn Vị MKT Đông', manager_id: manager.id, director_id: director.id }
    ]));

    const chainValidation = await hrRepository.validateSaleChain(sale.id);
    expect(chainValidation.valid).toBe(true);

    // 2. Kịch bản tư vấn: Lọc từ cấm và thay thế biến an toàn
    const badText = 'Dự án này cam kết lợi nhuận 15% mỗi năm.';
    const lintResult = knowledgeAndScriptService.lintCompliance(badText);
    expect(lintResult.isCompliant).toBe(false);

    // Kịch bản chuẩn tiếp cận
    const script = knowledgeAndScriptService.getScriptsByContext('approach')[0];
    const rendered = knowledgeAndScriptService.renderScript(script, {
      ten_khach: 'Anh Hoàng',
      ten_du_an: 'Vinhomes Grand Park Oasis',
      ten_sale: 'Nam'
    });

    expect(rendered.opening).toContain('Anh Hoàng');
    expect(rendered.opening).toContain('Vinhomes Grand Park Oasis');
    expect(rendered.opening).not.toMatch(/\{\{.*\}\}/);
  });
});
