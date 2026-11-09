// ========================================================
// REAL ESTATE CRM - INTERNATIONALIZATION DICTIONARY (PHASE 6)
// Từ điển đa ngôn ngữ (Tiếng Việt mặc định & Tiếng Anh chuẩn tài chính BĐS)
// ========================================================

export type SupportedLocale = 'vi' | 'en';

export const DICTIONARY = {
  vi: {
    common: {
      appName: 'CRM Broker Platform',
      save: 'Lưu',
      cancel: 'Hủy',
      delete: 'Xóa',
      edit: 'Chỉnh sửa',
      actions: 'Thao tác',
      status: 'Trạng thái',
      search: 'Tìm kiếm',
      filter: 'Bộ lọc',
      loading: 'Đang tải...',
      success: 'Thành công',
      error: 'Đã xảy ra lỗi'
    },
    roles: {
      admin: 'Quản trị viên Hệ thống',
      ceo: 'Tổng Giám Đốc',
      regional_director: 'Giám Đốc Vùng',
      director: 'Giám đốc Sàn',
      sales_manager: 'Trưởng phòng Kinh doanh',
      team_leader: 'Trưởng nhóm',
      sale_agent: 'Chuyên viên Tư vấn (Sale)',
      marketing_manager: 'Trưởng phòng Marketing',
      hr_admin: 'Quản trị Nhân sự (HR)'
    },
    leadStatus: {
      new: 'Mới tiếp nhận',
      unreachable: 'Không nghe máy',
      invalid: 'Sai số / Không nhu cầu',
      contacted: 'Đã liên hệ',
      qualifying: 'Xác định nhu cầu',
      doc_sent: 'Gửi tài liệu',
      appointment_set: 'Đặt hẹn',
      consulted: 'Đã gặp tư vấn',
      site_visit: 'Đi xem dự án',
      considering: 'Đang cân nhắc',
      booking: 'Booking giữ chỗ',
      deposit: 'Đặt cọc',
      contract: 'Ký HĐMB',
      lost: 'Thất bại',
      recycled: 'Thu hồi vào Pool'
    },
    financial: {
      dealValue: 'Giá trị giao dịch (GTGD)',
      commission: 'Hoa hồng',
      grossCommission: 'Hoa hồng Sàn',
      saleCommission: 'Hoa hồng Chuyên viên',
      leaderCommission: 'Thù lao Trưởng nhóm',
      managerCommission: 'Thù lao Trưởng phòng',
      taxDeduction: 'Khấu trừ thuế TNCN (10%)',
      netPayable: 'Thực nhận (Sau thuế)',
      debtAging: 'Tuổi nợ & Công nợ',
      reconciliation: 'Đối soát sao kê ngân hàng'
    },
    privacy: {
      exportData: 'Xuất dữ liệu cá nhân (NĐ 13)',
      anonymizeData: 'Ẩn danh hóa dữ liệu an toàn',
      consentStatus: 'Trạng thái đồng thuận',
      doNotContact: 'Không làm phiền'
    }
  },
  en: {
    common: {
      appName: 'CRM Broker Platform',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      actions: 'Actions',
      status: 'Status',
      search: 'Search',
      filter: 'Filter',
      loading: 'Loading...',
      success: 'Success',
      error: 'An error occurred'
    },
    roles: {
      admin: 'System Administrator',
      ceo: 'Chief Executive Officer (CEO)',
      regional_director: 'Regional Director',
      director: 'Agency Director',
      sales_manager: 'Sales Manager',
      team_leader: 'Team Leader',
      sale_agent: 'Sales Agent',
      marketing_manager: 'Marketing Manager',
      hr_admin: 'HR Administrator'
    },
    leadStatus: {
      new: 'New Lead',
      unreachable: 'Unreachable',
      invalid: 'Invalid Number / No Need',
      contacted: 'Contacted',
      qualifying: 'Qualifying',
      doc_sent: 'Documents Sent',
      appointment_set: 'Appointment Set',
      consulted: 'Consulted',
      site_visit: 'Site Visit',
      considering: 'Considering',
      booking: 'Booking Hold',
      deposit: 'Deposit Paid',
      contract: 'SPA Signed',
      lost: 'Lost Deal',
      recycled: 'Recycled to Pool'
    },
    financial: {
      dealValue: 'Gross Deal Value (GDV)',
      commission: 'Commission',
      grossCommission: 'Gross Agency Fee',
      saleCommission: 'Sales Commission',
      leaderCommission: 'Team Leader Override',
      managerCommission: 'Manager Override',
      taxDeduction: 'Personal Income Tax (10%)',
      netPayable: 'Net Payable Amount',
      debtAging: 'Debt Aging Schedule',
      reconciliation: 'Bank Statement Reconciliation'
    },
    privacy: {
      exportData: 'Export Personal Data (Decree 13)',
      anonymizeData: 'Safe Data Anonymization',
      consentStatus: 'Consent Status',
      doNotContact: 'Do Not Contact'
    }
  }
};

const STORAGE_KEY_LOCALE = 'crm_app_locale';

export class I18nManager {
  private currentLocale: SupportedLocale = 'vi';

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY_LOCALE);
    if (saved === 'vi' || saved === 'en') {
      this.currentLocale = saved;
    }
  }

  getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  setLocale(locale: SupportedLocale): void {
    this.currentLocale = locale;
    localStorage.setItem(STORAGE_KEY_LOCALE, locale);
  }

  t(path: string): string {
    const parts = path.split('.');
    let cur: any = DICTIONARY[this.currentLocale];
    for (const part of parts) {
      if (cur && cur[part] !== undefined) {
        cur = cur[part];
      } else {
        // Fallback to Vietnamese
        let fallbackCur: any = DICTIONARY['vi'];
        for (const fbPart of parts) {
          if (fallbackCur && fallbackCur[fbPart] !== undefined) {
            fallbackCur = fallbackCur[fbPart];
          } else {
            return path;
          }
        }
        return fallbackCur;
      }
    }
    return cur;
  }
}

export const i18n = new I18nManager();
