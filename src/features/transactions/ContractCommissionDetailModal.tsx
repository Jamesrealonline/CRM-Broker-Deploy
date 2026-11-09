import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Users, 
  MapPin, 
  Award, 
  DollarSign, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  Edit3, 
  Loader2,
  Lock,
  Layers
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Transaction, CommissionEntry, CommissionEntryStatus, UserProfile } from '@/domain/types';
import { contractRepository } from '@/data/repositories/contractRepository';
import { commissionService } from '@/domain/services/commissionService';
import { useAuthStore } from '@/app/useAuthStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onUpdated?: () => void;
  allUsers?: UserProfile[];
}

export const ContractCommissionDetailModal: React.FC<Props> = ({
  isOpen,
  onClose,
  transaction,
  onUpdated,
  allUsers = [],
}) => {
  const { currentUser } = useAuthStore();
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gán người nhận
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CommissionEntry | null>(null);
  const [newRecipientId, setNewRecipientId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Đổi trạng thái
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusEntry, setStatusEntry] = useState<CommissionEntry | null>(null);
  const [targetStatus, setTargetStatus] = useState<CommissionEntryStatus>('eligible');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  };

  const loadEntries = async () => {
    if (!transaction) return;
    setLoading(true);
    setError(null);
    try {
      const data = await contractRepository.getCommissionEntries({ contractId: transaction.id });
      // Áp dụng bộ lọc phân quyền hiển thị
      const filtered = currentUser 
        ? commissionService.filterCommissionEntriesByScope(data, currentUser)
        : data;
      setEntries(filtered);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải sổ cái hoa hồng của hợp đồng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && transaction) {
      loadEntries();
    }
  }, [isOpen, transaction]);

  if (!transaction) return null;

  const dealValue = transaction.deal_value || transaction.amount || 0;
  const agencyCommission = transaction.commission_amount || Math.round(dealValue * 0.035);
  const totalAllocated = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
  const companyRetained = Math.max(0, agencyCommission - totalAllocated);

  const canSeeAllTiers = currentUser && !['sale_agent', 'marketing_manager', 'hr_admin'].includes(currentUser.role);
  const canManageCommissions = currentUser && ['admin', 'ceo', 'director', 'regional_director'].includes(currentUser.role);

  const handleOpenAssign = (entry: CommissionEntry) => {
    setSelectedEntry(entry);
    setNewRecipientId('');
    setAssignReason('');
    setError(null);
    setAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || !currentUser) return;
    if (!newRecipientId) {
      setError('Vui lòng chọn nhân sự tiếp nhận hoa hồng.');
      return;
    }
    if (assignReason.trim().length < 10) {
      setError('Lý do gán người nhận phải có ít nhất 10 ký tự.');
      return;
    }

    setIsAssigning(true);
    setError(null);
    try {
      const targetUser = allUsers.find(u => u.id === newRecipientId);
      const recipientName = targetUser?.full_name || 'Nhân sự';
      await contractRepository.assignCommissionRecipient(
        selectedEntry.id,
        newRecipientId,
        recipientName,
        assignReason.trim(),
        currentUser
      );
      setAssignModalOpen(false);
      await loadEntries();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || 'Không thể gán người nhận.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenStatus = (entry: CommissionEntry) => {
    setStatusEntry(entry);
    setTargetStatus(entry.status === 'expected' ? 'eligible' : entry.status === 'eligible' ? 'paid' : 'clawback');
    setStatusReason('');
    setError(null);
    setStatusModalOpen(true);
  };

  const handleConfirmStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEntry || !currentUser) return;
    if (statusReason.trim().length < 10) {
      setError('Lý do thay đổi trạng thái phải có ít nhất 10 ký tự.');
      return;
    }

    setIsUpdatingStatus(true);
    setError(null);
    try {
      await contractRepository.updateCommissionEntryStatus(
        statusEntry.id,
        targetStatus,
        statusReason.trim(),
        currentUser
      );
      setStatusModalOpen(false);
      await loadEntries();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err?.message || 'Không thể cập nhật trạng thái hoa hồng.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'sale':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">1. Sale Trực Tiếp</span>;
      case 'team':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">2. Nhóm / Trưởng Nhóm</span>;
      case 'agency_director':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">3. Giám Đốc Sàn</span>;
      case 'regional_director':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">4. Giám Đốc Vùng</span>;
      case 'ceo':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">5. Tổng Giám Đốc</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">{tier}</span>;
    }
  };

  const getStatusBadge = (status: CommissionEntryStatus) => {
    switch (status) {
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3" /> Đã chi trả</span>;
      case 'eligible':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800"><Clock className="h-3 w-3" /> Đủ điều kiện</span>;
      case 'expected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800"><Clock className="h-3 w-3" /> Dự kiến (HĐMB)</span>;
      case 'clawback':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800"><RotateCcw className="h-3 w-3" /> Đã thu hồi</span>;
      case 'unassigned':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-dashed border-slate-300"><AlertCircle className="h-3 w-3" /> Chờ gán người nhận</span>;
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Sổ Cái Phân Bổ Hoa Hồng 5 Tầng Theo Hợp Đồng"
        description={`Mã HĐMB: ${transaction.contract_code || transaction.code} • Căn: ${transaction.unit_code} • Dự án: ${transaction.project_name || 'N/A'}`}
        maxWidth="xl"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Tổng quan tài chính */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Giá Trị Giao Dịch</div>
              <div className="text-sm font-bold text-slate-900">{formatVND(dealValue)}</div>
              <div className="text-[10px] text-slate-400">HĐMB chính thức</div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Quỹ Hoa Hồng Sàn</div>
              <div className="text-sm font-bold text-emerald-700">{formatVND(agencyCommission)}</div>
              <div className="text-[10px] text-emerald-600 font-medium">CĐT thanh toán</div>
            </div>

            {canSeeAllTiers && (
              <>
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Tổng Chia 5 Tầng</div>
                  <div className="text-sm font-bold text-amber-700">{formatVND(totalAllocated)}</div>
                  <div className="text-[10px] text-amber-600 font-medium">{entries.length} tầng thụ hưởng</div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Công Ty Giữ Lại</div>
                  <div className="text-sm font-bold text-indigo-700">{formatVND(companyRetained)}</div>
                  <div className="text-[10px] text-indigo-600 font-medium">Lợi nhuận gộp sàn</div>
                </div>
              </>
            )}
          </div>

          {/* Bảng phân bổ 5 tầng */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>Bút Toán Sổ Cái Chi Tiết Theo Cấp Bậc</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Nguyên tắc: VND nguyên, không làm tròn lệch quỹ
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>Đang tải bút toán hoa hồng...</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Chưa có bút toán hoa hồng nào được ghi nhận cho hợp đồng này.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Tầng & Cấp Bậc</th>
                      <th className="p-2.5">Người Nhận</th>
                      <th className="p-2.5 text-right">Tỷ Lệ</th>
                      <th className="p-2.5 text-right">Gross (VNĐ)</th>
                      <th className="p-2.5 text-right">Thuế TNCN</th>
                      <th className="p-2.5 text-right">Net Thực Nhận</th>
                      <th className="p-2.5 text-center">Trạng Thái</th>
                      {canManageCommissions && <th className="p-2.5 text-center">Thao Tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry) => {
                      const gross = entry.amount || 0;
                      const tax = entry.pit_tax_amount || 0;
                      const net = entry.net_payable_amount ?? (gross - tax);
                      const isUnassigned = entry.status === 'unassigned' || !entry.recipient_id;

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 whitespace-nowrap">
                            {getTierBadge(entry.tier || 'sale')}
                          </td>
                          <td className="p-2.5">
                            {isUnassigned ? (
                              <span className="text-rose-600 font-semibold italic flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Chưa gán người nhận
                              </span>
                            ) : (
                              <div>
                                <div className="font-bold text-slate-900">{entry.recipient_name || 'Nhân sự'}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{entry.recipient_id?.slice(0, 8)}...</div>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-slate-700">
                            {entry.percent ?? entry.rate_percent ?? 0}%
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                            {formatVND(gross)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-500">
                            {tax > 0 ? formatVND(tax) : '0 đ'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-700 font-mono">
                            {formatVND(net)}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {getStatusBadge(entry.status)}
                          </td>
                          {canManageCommissions && (
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {isUnassigned && (
                                  <button
                                    onClick={() => handleOpenAssign(entry)}
                                    className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 rounded border border-amber-300 transition-colors"
                                  >
                                    Gán Người Nhận
                                  </button>
                                )}
                                {entry.status !== 'unassigned' && entry.status !== 'clawback' && (
                                  <button
                                    onClick={() => handleOpenStatus(entry)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Cập nhật trạng thái"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Đóng Cửa Sổ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal gán người nhận */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Gán Người Nhận Hoa Hồng (Khuyết Cấp Bậc)"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmAssign} className="space-y-3">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            Tầng: <strong>{selectedEntry?.tier}</strong> • Số tiền: <strong>{formatVND(selectedEntry?.amount || 0)}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn nhân sự tiếp nhận *</label>
            <select
              required
              value={newRecipientId}
              onChange={(e) => setNewRecipientId(e.target.value)}
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
              placeholder="Ví dụ: Bổ nhiệm Giám đốc Sàn mới phụ trách hợp đồng theo quyết định số..."
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
        title="Cập Nhật Trạng Thái Bút Toán Hoa Hồng"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmStatus} className="space-y-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900">
            Người nhận: <strong>{statusEntry?.recipient_name}</strong> • Số tiền: <strong>{formatVND(statusEntry?.amount || 0)}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái mới *</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as CommissionEntryStatus)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="eligible">Đủ điều kiện giải ngân (Khách đã đóng đợt 1)</option>
              <option value="paid">Đã chi trả thành công</option>
              <option value="clawback">Thu hồi hoa hồng (Hủy HĐ / Phạt)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do cập nhật trạng thái * (Tối thiểu 10 ký tự để lưu vết Audit)
            </label>
            <textarea
              required
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Ví dụ: Đã đối soát đợt 1 thành công với kế toán CĐT, duyệt giải ngân..."
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
    </>
  );
};
