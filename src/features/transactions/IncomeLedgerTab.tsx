import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  User, 
  Users, 
  Award, 
  MapPin, 
  Layers, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  AlertCircle, 
  FileSpreadsheet, 
  ArrowUpRight, 
  ShieldAlert, 
  Loader2, 
  Eye, 
  Percent, 
  TrendingUp, 
  Receipt,
  FileCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { 
  UserProfile, 
  Project, 
  Region, 
  Agency, 
  Team, 
  CommissionEntry, 
  CommissionTierRole, 
  CommissionEntryStatus 
} from '@/domain/types';
import { contractRepository } from '@/data/repositories/contractRepository';
import { commissionService } from '@/domain/services/commissionService';
import { authRepository } from '@/data/repositories/authRepository';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';

interface Props {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  projects: Project[];
  regions: Region[];
  agencies: Agency[];
  teams: Team[];
  dateRange: { from?: string; to?: string };
  setPreset: (preset: any) => void;
  setCustomRange: (from: string, to: string) => void;
  onViewContract: (contractId: string) => void;
}

type SummaryResult = Awaited<ReturnType<typeof contractRepository.getIncomeSummary>>;

const TIER_COLORS: Record<string, string> = {
  sale: '#3b82f6',
  team: '#6366f1',
  agency_director: '#a855f7',
  regional_director: '#f59e0b',
  ceo: '#10b981',
  department_head: '#06b6d4',
  ops_fund: '#ec4899',
  co_sale: '#8b5cf6',
  referrer: '#14b8a6',
};

const TIER_LABELS: Record<string, string> = {
  sale: 'Sale trực tiếp',
  team: 'Nhóm / Trưởng nhóm',
  agency_director: 'Giám đốc Sàn',
  regional_director: 'Giám đốc Vùng',
  ceo: 'Tổng Giám Đốc',
  department_head: 'Trưởng phòng',
  ops_fund: 'Quỹ vận hành',
  co_sale: 'Đồng phụ trách',
  referrer: 'Người giới thiệu',
};

export const IncomeLedgerTab: React.FC<Props> = ({
  currentUser,
  allUsers,
  projects,
  regions,
  agencies,
  teams,
  dateRange,
  setPreset,
  setCustomRange,
  onViewContract,
}) => {
  const [loading, setLoading] = useState(false);
  const [incomeSummary, setIncomeSummary] = useState<SummaryResult | null>(null);
  const [rawEntries, setRawEntries] = useState<CommissionEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Bộ lọc
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [dateBasis, setDateBasis] = useState<'sign_date' | 'eligible_at' | 'paid_at'>('sign_date');

  // Gán người nhận
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [entryToAssign, setEntryToAssign] = useState<CommissionEntry | null>(null);
  const [assignRecipientId, setAssignRecipientId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Đổi trạng thái
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [entryToUpdateStatus, setEntryToUpdateStatus] = useState<CommissionEntry | null>(null);
  const [targetStatus, setTargetStatus] = useState<CommissionEntryStatus>('paid');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  };

  const isMarketingOrHR = ['marketing_manager', 'hr_admin'].includes(currentUser.role);
  const isSaleAgent = currentUser.role === 'sale_agent';
  const canManage = ['admin', 'ceo', 'director', 'regional_director'].includes(currentUser.role);

  // Danh sách nhân sự được phép lọc theo phân cấp
  const allowedUsers = useMemo(() => {
    if (isSaleAgent) {
      return allUsers.filter(u => u.id === currentUser.id);
    }
    if (currentUser.role === 'team_leader' || currentUser.role === 'sales_manager') {
      return allUsers.filter(u => u.id === currentUser.id || u.team_id === currentUser.team_id);
    }
    if (currentUser.role === 'director') {
      return allUsers.filter(u => u.agency_id === currentUser.agency_id);
    }
    if (currentUser.role === 'regional_director') {
      const myAgencies = agencies.filter(a => a.region_id === currentUser.region_id).map(a => a.id);
      return allUsers.filter(u => u.agency_id && myAgencies.includes(u.agency_id));
    }
    // Admin / CEO
    return allUsers;
  }, [allUsers, currentUser, agencies, isSaleAgent]);

  // Tải dữ liệu thu nhập và sổ cái
  const loadIncomeData = async () => {
    if (isMarketingOrHR) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const userIdsFilter = selectedUserId !== 'all' 
        ? [selectedUserId] 
        : (isSaleAgent ? [currentUser.id] : undefined);

      const tiersFilter = selectedTier !== 'all' 
        ? [selectedTier as CommissionTierRole] 
        : undefined;

      const statusesFilter = selectedStatus !== 'all' 
        ? [selectedStatus as CommissionEntryStatus] 
        : undefined;

      const summary = await contractRepository.getIncomeSummary(
        {
          userIds: userIdsFilter,
          tiers: tiersFilter,
          statuses: statusesFilter,
          projectId: selectedProjectId !== 'all' ? selectedProjectId : undefined,
          dateBasis: dateBasis,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
        },
        currentUser
      );

      setIncomeSummary(summary);
      setRawEntries(summary.filteredEntries || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tải báo cáo thu nhập.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncomeData();
  }, [selectedUserId, selectedTier, selectedStatus, selectedProjectId, dateBasis, dateRange.from, dateRange.to, currentUser]);

  // Danh sách bút toán sau khi áp dụng tìm kiếm
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return rawEntries;
    const q = searchQuery.toLowerCase();
    return rawEntries.filter(e => 
      (e.contract_code?.toLowerCase().includes(q)) ||
      (e.recipient_name?.toLowerCase().includes(q)) ||
      (e.project_name?.toLowerCase().includes(q)) ||
      (e.customer_name?.toLowerCase().includes(q))
    );
  }, [rawEntries, searchQuery]);

  // Xuất CSV báo cáo thu nhập
  const handleExportCsv = async () => {
    if (authRepository.isImpersonating()) {
      alert('Chế độ đóng vai (Impersonation): Đã chặn quyền xuất dữ liệu hoa hồng nhạy cảm!');
      return;
    }
    try {
      const csv = await contractRepository.exportIncomeCsv(filteredEntries, currentUser);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Bao_Cao_Thu_Nhap_Hoa_Hong_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToastMessage('Đã xuất báo cáo Thu nhập & Sổ cái CSV thành công (Đã ghi vết Audit).');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Không thể xuất file CSV.');
    }
  };

  const handleOpenAssign = (entry: CommissionEntry) => {
    setEntryToAssign(entry);
    setAssignRecipientId('');
    setAssignReason('');
    setAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToAssign || !currentUser) return;
    if (!assignRecipientId) {
      alert('Vui lòng chọn nhân sự!');
      return;
    }
    if (assignReason.trim().length < 10) {
      alert('Lý do phải có ít nhất 10 ký tự để lưu vết Audit.');
      return;
    }
    setIsAssigning(true);
    try {
      const targetUser = allUsers.find(u => u.id === assignRecipientId);
      await contractRepository.assignCommissionRecipient(
        entryToAssign.id,
        assignRecipientId,
        targetUser?.full_name || 'Nhân sự',
        assignReason.trim(),
        currentUser
      );
      setAssignModalOpen(false);
      setToastMessage('Đã gán người nhận hoa hồng thành công.');
      setTimeout(() => setToastMessage(null), 3000);
      await loadIncomeData();
    } catch (err: any) {
      alert(err?.message || 'Lỗi gán người nhận.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenStatus = (entry: CommissionEntry) => {
    setEntryToUpdateStatus(entry);
    setTargetStatus(entry.status === 'expected' ? 'eligible' : entry.status === 'eligible' ? 'paid' : 'clawback');
    setStatusReason('');
    setStatusModalOpen(true);
  };

  const handleConfirmStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToUpdateStatus || !currentUser) return;
    if (statusReason.trim().length < 10) {
      alert('Lý do phải có ít nhất 10 ký tự để lưu vết Audit.');
      return;
    }
    setIsUpdatingStatus(true);
    try {
      await contractRepository.updateCommissionEntryStatus(
        entryToUpdateStatus.id,
        targetStatus,
        statusReason.trim(),
        currentUser
      );
      setStatusModalOpen(false);
      setToastMessage('Đã cập nhật trạng thái hoa hồng thành công.');
      setTimeout(() => setToastMessage(null), 3000);
      await loadIncomeData();
    } catch (err: any) {
      alert(err?.message || 'Lỗi cập nhật trạng thái.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Nếu là Marketing hoặc HR, chặn quyền theo yêu cầu ma trận phân quyền
  if (isMarketingOrHR) {
    return (
      <div className="p-8 bg-amber-50 rounded-2xl border-2 border-amber-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-amber-600 mx-auto" />
        <h3 className="text-base font-bold text-amber-950">Quyền Truy Cập Bị Giới Hạn</h3>
        <p className="text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
          Tài khoản thuộc Khối Marketing và Khối HR không nằm trong chuỗi chỉ huy hoa hồng kinh doanh và không được phép xem sổ cái thu nhập của nhân sự.
        </p>
      </div>
    );
  }

  // Chuẩn bị dữ liệu cho biểu đồ tròn theo tầng
  const tierPieData = useMemo(() => {
    if (!incomeSummary) return [];
    return Object.entries(incomeSummary.tierBreakdown)
      .filter(([_, val]) => val > 0)
      .map(([tierKey, val]) => ({
        name: TIER_LABELS[tierKey] || tierKey,
        rawTier: tierKey,
        value: val,
      }));
  }, [incomeSummary]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-950 rounded-xl text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TOP HEADER & EXPORT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Sổ Cái Hoa Hồng & Báo Cáo Thu Nhập 5 Cấp Bậc
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân bổ minh bạch cho Sale, Nhóm, GĐ Sàn, GĐ Vùng, CEO. Tự động tính thuế TNCN tạm tính và lợi nhuận công ty giữ lại.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadIncomeData}
            isLoading={loading}
            className="text-xs"
          >
            Tải Lại
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCsv}
            disabled={rawEntries.length === 0}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 flex items-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Xuất CSV Báo Cáo</span>
          </Button>
        </div>
      </div>

      {/* 2. BỘ LỌC ĐA TIÊU CHÍ */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Lọc theo Nhân Sự */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Nhân sự thụ hưởng
            </label>
            <select
              value={selectedUserId}
              disabled={isSaleAgent}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800 disabled:bg-slate-100"
            >
              {!isSaleAgent && <option value="all">-- Tất cả nhân sự trong phạm vi --</option>}
              {allowedUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Tầng */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Tầng hoa hồng
            </label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
            >
              <option value="all">-- Tất cả các tầng --</option>
              <option value="sale">1. Chuyên viên (Sale)</option>
              <option value="team">2. Nhóm / Trưởng nhóm</option>
              <option value="agency_director">3. Giám đốc Sàn</option>
              <option value="regional_director">4. Giám đốc Vùng</option>
              <option value="ceo">5. Tổng Giám Đốc (CEO)</option>
            </select>
          </div>

          {/* Lọc theo Trạng Thái */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Trạng thái giải ngân
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
            >
              <option value="all">-- Tất cả trạng thái --</option>
              <option value="paid">Đã chi trả thành công</option>
              <option value="eligible">Đủ điều kiện giải ngân</option>
              <option value="expected">Dự kiến theo HĐMB</option>
              <option value="clawback">Đã thu hồi (Hủy HĐ)</option>
              <option value="unassigned">Chờ gán người nhận</option>
            </select>
          </div>

          {/* Lọc theo Dự Án */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Dự án
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
            >
              <option value="all">-- Tất cả dự án --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          {/* Mốc Ngày Tính Toán */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Mốc ngày đối soát
            </label>
            <select
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as any)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
            >
              <option value="sign_date">Ngày ký HĐMB (Mặc định)</option>
              <option value="eligible_at">Ngày đủ điều kiện (Đợt 1)</option>
              <option value="paid_at">Ngày đã giải ngân thực tế</option>
            </select>
          </div>
        </div>

        {/* DateRangeFilter dùng chung */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <DateRangeFilter
            value={dateRange as any}
            onPresetChange={setPreset}
            onCustomRangeChange={setCustomRange}
          />
          <div className="text-[11px] text-slate-500 font-mono">
            Hiển thị <strong>{filteredEntries.length}</strong> bút toán khớp bộ lọc
          </div>
        </div>
      </div>

      {/* 3. KPI SUMMARY CARDS */}
      {incomeSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* 1. Tổng Thu Nhập Gross */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Thu Nhập Gộp (Gross)</div>
            <div className="text-base font-black text-slate-900 truncate" title={formatVND(incomeSummary.overall.totalGrossIncome)}>
              {formatVND(incomeSummary.overall.totalGrossIncome)}
            </div>
            <div className="text-[10px] text-slate-400">Trước khấu trừ thuế</div>
          </div>

          {/* 2. Thuế TNCN Tạm Tính */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Thuế TNCN Tạm Tính</div>
            <div className="text-base font-black text-rose-600 truncate" title={formatVND(incomeSummary.overall.totalTaxAmount)}>
              {formatVND(incomeSummary.overall.totalTaxAmount)}
            </div>
            <div className="text-[10px] text-rose-500">Khấu trừ tại nguồn</div>
          </div>

          {/* 3. Thu Nhập Thực Nhận (Net) */}
          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 shadow-sm space-y-1">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Thực Nhận (Net)</div>
            <div className="text-base font-black text-emerald-700 truncate" title={formatVND(incomeSummary.overall.totalNetIncome)}>
              {formatVND(incomeSummary.overall.totalNetIncome)}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">Sau khấu trừ thuế</div>
          </div>

          {/* 4. Đã Giải Ngân */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Đã Chi Trả (Paid)</div>
            <div className="text-base font-black text-blue-700 truncate" title={formatVND(incomeSummary.overall.paidIncome)}>
              {formatVND(incomeSummary.overall.paidIncome)}
            </div>
            <div className="text-[10px] text-blue-600 font-semibold">{incomeSummary.overall.entryCount} bút toán đã ghi</div>
          </div>

          {/* 5. Đủ Điều Kiện */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Đủ Điều Kiện Chi</div>
            <div className="text-base font-black text-indigo-700 truncate" title={formatVND(incomeSummary.overall.eligibleIncome)}>
              {formatVND(incomeSummary.overall.eligibleIncome)}
            </div>
            <div className="text-[10px] text-indigo-600 font-medium">HĐ đã đóng đợt 1</div>
          </div>

          {/* 6. Dự Kiến Theo HĐMB */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Dự Kiến (Expected)</div>
            <div className="text-base font-black text-amber-700 truncate" title={formatVND(incomeSummary.overall.expectedIncome)}>
              {formatVND(incomeSummary.overall.expectedIncome)}
            </div>
            <div className="text-[10px] text-amber-600 font-medium">HĐ đang hoàn tất</div>
          </div>

          {/* 7. Thu Hồi / Clawback */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Đã Thu Hồi</div>
            <div className="text-base font-black text-slate-600 truncate" title={formatVND(incomeSummary.overall.clawbackIncome)}>
              {formatVND(incomeSummary.overall.clawbackIncome)}
            </div>
            <div className="text-[10px] text-slate-400">Do hủy HĐMB</div>
          </div>
        </div>
      )}

      {/* 4. BIỂU ĐỒ TRỰC QUAN (RECHARTS) */}
      {incomeSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Diễn biến thu nhập theo thời gian */}
          <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Diễn Biến Thu Nhập Theo Thời Gian
              </h3>
              <span className="text-[10px] text-slate-400">Theo mốc {dateBasis === 'sign_date' ? 'ngày ký' : dateBasis === 'eligible_at' ? 'đủ điều kiện' : 'đã chi'}</span>
            </div>
            <div className="h-60 w-full">
              {incomeSummary.chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Không có dữ liệu phát sinh trong khoảng thời gian này
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeSummary.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => `${Math.round(val / 1000000)}M`}
                    />
                    <Tooltip 
                      formatter={(val: any) => [formatVND(Number(val)), '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="amount" name="Tổng thu nhập" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Đã chi trả" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cơ cấu thu nhập theo 5 tầng */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-indigo-600" />
                Cơ Cấu Hoa Hồng Theo Tầng
              </h3>
            </div>
            <div className="h-60 w-full flex flex-col items-center justify-center">
              {tierPieData.length === 0 ? (
                <div className="text-xs text-slate-400">Chưa có dữ liệu hoa hồng</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {tierPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={TIER_COLORS[entry.rawTier] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [formatVND(Number(val)), '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. BẢNG SỔ CÁI BÚT TOÁN CHI TIẾT */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header bảng & ô tìm kiếm */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900">Chi Tiết Sổ Cái Hoa Hồng ({filteredEntries.length} Bút Toán)</h3>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã HĐ, tên người nhận, dự án..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Nội dung bảng */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Đang tải sổ cái hoa hồng...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 space-y-1">
            <div>Không tìm thấy bút toán hoa hồng nào phù hợp với bộ lọc hiện tại.</div>
            <div className="text-[11px] text-slate-400">Hãy thử mở rộng khoảng thời gian hoặc điều chỉnh người nhận/tầng thụ hưởng.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Mã HĐMB & Ngày Ký</th>
                  <th className="p-3">Dự Án & Khách Hàng</th>
                  <th className="p-3">Tầng & Người Nhận</th>
                  <th className="p-3 text-right">Tỷ Lệ %</th>
                  <th className="p-3 text-right">Thu Nhập Gộp (Gross)</th>
                  <th className="p-3 text-right">Thuế TNCN</th>
                  <th className="p-3 text-right">Thực Nhận (Net)</th>
                  <th className="p-3 text-center">Trạng Thái</th>
                  <th className="p-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const gross = entry.amount || 0;
                  const tax = entry.pit_tax_amount || 0;
                  const net = entry.net_payable_amount ?? (gross - tax);
                  const isUnassigned = entry.status === 'unassigned' || !entry.recipient_id;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Mã HĐMB */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{entry.contract_code || '---'}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{entry.sign_date ? new Date(entry.sign_date).toLocaleDateString('vi-VN') : (entry.created_at ? new Date(entry.created_at).toLocaleDateString('vi-VN') : '---')}</span>
                        </div>
                      </td>

                      {/* Dự án & Khách hàng */}
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{entry.project_name || 'Dự án'}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{entry.customer_name || 'Khách hàng'}</span>
                        </div>
                      </td>

                      {/* Tầng & Người nhận */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span 
                            className="inline-block w-2 h-2 rounded-full" 
                            style={{ backgroundColor: TIER_COLORS[entry.tier || 'sale'] || '#94a3b8' }} 
                          />
                          <span className="text-[10px] font-bold text-slate-700">
                            {TIER_LABELS[entry.tier || 'sale'] || entry.tier}
                          </span>
                        </div>
                        {isUnassigned ? (
                          <span className="text-rose-600 font-bold italic text-[11px] flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Chưa gán nhân sự
                          </span>
                        ) : (
                          <div className="font-semibold text-slate-900">{entry.recipient_name || 'Nhân sự'}</div>
                        )}
                      </td>

                      {/* Tỷ lệ % */}
                      <td className="p-3 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {entry.percent ?? entry.rate_percent ?? 0}%
                        <div className="text-[9px] text-slate-400">GTGD</div>
                      </td>

                      {/* Gross */}
                      <td className="p-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                        {formatVND(gross)}
                      </td>

                      {/* Tax */}
                      <td className="p-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {tax > 0 ? formatVND(tax) : '0 đ'}
                      </td>

                      {/* Net */}
                      <td className="p-3 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                        {formatVND(net)}
                      </td>

                      {/* Trạng thái */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {entry.status === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Đã chi trả
                          </span>
                        )}
                        {entry.status === 'eligible' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            <Clock className="h-3 w-3" /> Đủ điều kiện
                          </span>
                        )}
                        {entry.status === 'expected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="h-3 w-3" /> Dự kiến
                          </span>
                        )}
                        {entry.status === 'clawback' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            <RotateCcw className="h-3 w-3" /> Đã thu hồi
                          </span>
                        )}
                        {entry.status === 'unassigned' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-dashed border-slate-300">
                            <AlertCircle className="h-3 w-3" /> Chờ gán
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {entry.contract_id && (
                            <button
                              onClick={() => onViewContract(entry.contract_id)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Xem hợp đồng chi tiết"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {isUnassigned && canManage && (
                            <button
                              onClick={() => handleOpenAssign(entry)}
                              className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 rounded border border-amber-300 transition-colors"
                              title="Gán người nhận cho tầng khuyết"
                            >
                              Gán
                            </button>
                          )}

                          {!isUnassigned && canManage && entry.status !== 'clawback' && (
                            <button
                              onClick={() => handleOpenStatus(entry)}
                              className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded border border-slate-200 transition-colors"
                              title="Đổi trạng thái giải ngân"
                            >
                              Đổi TT
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal gán người nhận */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Gán Người Nhận Hoa Hồng Khuyết"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmAssign} className="space-y-3">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            Tầng: <strong>{entryToAssign?.tier}</strong> • Số tiền: <strong>{formatVND(entryToAssign?.amount || 0)}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn nhân sự tiếp nhận *</label>
            <select
              required
              value={assignRecipientId}
              onChange={(e) => setAssignRecipientId(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">-- Chọn nhân sự --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role}) - {u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do gán người nhận * (Tối thiểu 10 ký tự để lưu vết Audit)
            </label>
            <textarea
              required
              rows={3}
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              placeholder="Ví dụ: Bổ nhiệm nhân sự mới tiếp quản hợp đồng từ ngày..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isAssigning}>
              {isAssigning ? 'Đang lưu...' : 'Xác Nhận Gán'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal cập nhật trạng thái */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Cập Nhật Trạng Thái Bút Toán"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmStatus} className="space-y-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900">
            Người nhận: <strong>{entryToUpdateStatus?.recipient_name}</strong> • Số tiền: <strong>{formatVND(entryToUpdateStatus?.amount || 0)}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái mới *</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as CommissionEntryStatus)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="eligible">Đủ điều kiện chi (Khách đã đóng đợt 1)</option>
              <option value="paid">Đã chi trả thành công</option>
              <option value="clawback">Thu hồi hoa hồng (Hủy HĐ / Phạt)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do cập nhật * (Tối thiểu 10 ký tự để lưu vết Audit)
            </label>
            <textarea
              required
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Ví dụ: Đã đối soát đợt 1 thành công với CĐT, giải ngân qua ngân hàng..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStatusModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isUpdatingStatus}>
              {isUpdatingStatus ? 'Đang cập nhật...' : 'Lưu Trạng Thái'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
