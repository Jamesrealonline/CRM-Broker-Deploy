import { describe, it, expect, beforeEach } from 'vitest';
import { teamRepository, generateOrganizationCode } from '@/data/repositories/teamRepository';
import { Organization } from '@/domain/types';

describe('Tự Động Khởi Tạo Mã Doanh Nghiệp (Auto Enterprise Code Generation)', () => {
  const mockExistingOrgs: Organization[] = [
    {
      id: 'org-glg',
      name: 'Tập đoàn Địa Ốc Vàng',
      code: 'GLG',
    },
    {
      id: 'org-dovmt',
      name: 'Công ty Cổ phần BĐS Địa Ốc Vàng Miền Trung',
      code: 'ORG-DOVMT',
    },
  ];

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      localStorage.setItem('crm_organizations', JSON.stringify(mockExistingOrgs));
    }
  });

  describe('1. Hàm sinh mã generateOrganizationCode', () => {
    it('1.1. Tự động sinh mã từ tên công ty tiếng Việt có dấu và loại bỏ stopwords', () => {
      // Bỏ: Công ty, Cổ phần, BĐS -> Còn lại: Địa Ốc Vàng Miền Nam -> Initials: D, O, V, M, N -> ORG-DOVMN
      const code = generateOrganizationCode('Công ty Cổ phần BĐS Địa Ốc Vàng Miền Nam', mockExistingOrgs);
      expect(code).toBe('ORG-DOVMN');
    });

    it('1.2. Xử lý tên công ty TNHH Bất Động Sản Đất Xanh', () => {
      // Bỏ: Cong ty, TNHH, Bat Dong San -> Còn: Dat Xanh -> Initials: D, X -> ORG-DX
      const code = generateOrganizationCode('Công ty TNHH Bất Động Sản Đất Xanh', mockExistingOrgs);
      expect(code).toBe('ORG-DX');
    });

    it('1.3. Xử lý tên công ty có từ đơn hoặc ngắn gọn', () => {
      const code = generateOrganizationCode('Vinhomes', mockExistingOrgs);
      expect(code).toBe('ORG-VINHOM');
    });

    it('1.4. Tự động sinh mã tuần tự khi tên để trống', () => {
      // 2 orgs sẵn có -> next seq = ORG-003
      const code = generateOrganizationCode('', mockExistingOrgs);
      expect(code).toBe('ORG-003');
    });

    it('1.5. Chống xung đột mã (Collision Prevention): tự động thêm hậu tố -01, -02', () => {
      // ORG-DOVMT đã có trong mockExistingOrgs
      const code = generateOrganizationCode('Công ty Cổ phần BĐS Địa Ốc Vàng Miền Trung', mockExistingOrgs);
      expect(code).toBe('ORG-DOVMT-01');

      // Nếu cả ORG-DOVMT-01 cũng đã có
      const orgsWithCollisions = [
        ...mockExistingOrgs,
        { id: 'org-dovmt-01', name: 'Chi nhánh 1', code: 'ORG-DOVMT-01' },
      ];
      const code2 = generateOrganizationCode('Công ty Cổ phần BĐS Địa Ốc Vàng Miền Trung', orgsWithCollisions);
      expect(code2).toBe('ORG-DOVMT-02');
    });
  });

  describe('2. Khởi tạo Doanh Nghiệp qua teamRepository.createOrganization', () => {
    it('2.1. Không truyền code -> hệ thống tự động sinh mã hợp lệ và lưu trữ', async () => {
      const result = await teamRepository.createOrganization({
        name: 'Công ty Cổ phần Địa Ốc Phú Quốc',
        // Không truyền `code`
      });

      expect(result.success).toBe(true);
      expect(result.organization).toBeDefined();
      expect(result.organization?.code).toBe('ORG-DOPQ');
      expect(result.organization?.name).toBe('Công ty Cổ phần Địa Ốc Phú Quốc');

      // Kiểm tra dữ liệu được lưu vào storage
      const orgs = await teamRepository.getOrganizations();
      const created = orgs.find(o => o.code === 'ORG-DOPQ');
      expect(created).toBeDefined();
    });

    it('2.2. Truyền code rỗng -> hệ thống tự động sinh mã thay vì lỗi', async () => {
      const result = await teamRepository.createOrganization({
        name: 'Tập đoàn Đầu tư Hải Phát',
        code: '   ', // whitespace
      });

      expect(result.success).toBe(true);
      expect(result.organization?.code).toBe('ORG-DTHP');
    });

    it('2.3. Cho phép truyền code tùy chỉnh và chuẩn hóa viết hoa', async () => {
      const result = await teamRepository.createOrganization({
        name: 'Công ty Cổ phần Novaland Group',
        code: 'nvl-corp',
      });

      expect(result.success).toBe(true);
      expect(result.organization?.code).toBe('NVL-CORP');
    });

    it('2.4. Từ chối nếu code tùy chỉnh của người dùng bị trùng lặp', async () => {
      const result = await teamRepository.createOrganization({
        name: 'Công ty Trùng Lặp',
        code: 'GLG', // Đã tồn tại
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Mã doanh nghiệp 'GLG' đã tồn tại");
    });
  });
});
