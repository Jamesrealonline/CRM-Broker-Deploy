// ========================================================
// REAL ESTATE CRM - TRANSACTIONS & CONTRACTS PAGE
// Module Quản lý Giao dịch & Hợp đồng khách hàng
// Cọc, Ký HĐMB, Đóng tiền Đợt 1, Giá trị giao dịch, Hoa hồng Sàn & Hoa hồng Sale
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Tag, 
  Calendar,
  User,
  Phone,
  Award,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { contractRepository } from '@/data/repositories/contractRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { Transaction, Project, Lead } from '@/domain/types';
import { useAuthStore } from '@/app/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

export const TransactionsPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPaidFilter, setSelectedPaidFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal tạo giao dịch mới
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [candidateLeads, setCandidateLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [dealValue, setDealValue] = useState<number>(3200000000);
  const [contractCode, setContractCode] = useState('');
  const [depositAmount, setDepositAmount] = useState<number>(100000000);
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
  const [firstInstallmentAmount, setFirstInstallmentAmount] = useState<number>(320000000);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [firstInstallmentPaid, setFirstInstallmentPaid] = useState(false);
  const [commissionRate, setCommissionRate] = useState<number>(3.5);
  const [saleCommissionRate, setSaleCommissionRate] = useState<number>(1.8);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal cập nhật tiến độ
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editPaid, setEditPaid] = useState(false);
  const [editInstallmentAmount, setEditInstallmentAmount] = useState<number>(0);
  const [editContractCode, setEditContractCode] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [txList, prjList] = await Promise.all([
        contractRepository.getTransactions({
          projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
          type: selectedType === 'all' ? undefined : selectedType,
          search: searchQuery,
        }),
        projectRepository.getProjects(),
      ]);
      setTransactions(txList);
      setProjects(prjList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProjectId, selectedType, searchQuery]);

  // Load candidate leads when opening create modal
  const handleOpenCreateModal = async () => {
    if (currentUser) {
      const res = await leadRepository.getLeads({ page: 1, pageSize: 50 }, currentUser);
      setCandidateLeads(res.leads);
      if (res.leads.length > 0) {
        setSelectedLeadId(res.leads[0].id);
      }
    }
    setCreateModalOpen(true);
  };

  // Tính tự động hoa hồng khi đổi giá trị giao dịch hoặc %
  const calculatedAgencyCommission = Math.round(dealValue * (commissionRate / 100));
  const calculatedSaleCommission = Math.round(dealValue * (saleCommissionRate / 100));

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) return;
    setIsSubmitting(true);
    try {
      await contractRepository.createContractTransaction({
        lead_id: selectedLeadId,
        type: 'contract',
        code: `HD-${Date.now().toString().slice(-6)}`,
        contract_code: contractCode || `HĐMB-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        unit_code: unitCode || 'OG-S7.02-15.08',
        amount: dealValue,
        deal_value: dealValue,
        commission_amount: calculatedAgencyCommission,
        sale_commission_rate: saleCommissionRate,
        sale_commission_amount: calculatedSaleCommission,
        deposit_date: new Date(depositDate).toISOString(),
        contract_date: new Date(contractDate).toISOString(),
        first_installment_amount: firstInstallmentAmount,
        first_installment_date: new Date(firstInstallmentDate).toISOString(),
        first_installment_paid: firstInstallmentPaid,
        notes,
        created_by: currentUser?.id,
      });
      setCreateModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenUpdateModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditPaid(Boolean(tx.first_installment_paid));
    setEditInstallmentAmount(tx.first_installment_amount || Math.round((tx.deal_value || tx.amount) * 0.1));
    setEditContractCode(tx.contract_code || '');
    setEditNotes(tx.notes || '');
    setUpdateModalOpen(true);
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setIsSubmitting(true);
    try {
      await contractRepository.updateContractMilestone(editingTx.id, {
        first_installment_paid: editPaid,
        first_installment_amount: editInstallmentAmount,
        contract_code: editContractCode,
        notes: editNotes,
      });
      setUpdateModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickTogglePaid = async (tx: Transaction) => {
    const newStatus = !tx.first_installment_paid;
    await contractRepository.updateContractMilestone(tx.id, {
      first_installment_paid: newStatus,
    });
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, first_installment_paid: newStatus } : t));
  };

  // Filter transactions by paid status
  const displayedTransactions = transactions.filter(t => {
    if (selectedPaidFilter === 'paid') return t.first_installment_paid === true;
    if (selectedPaidFilter === 'unpaid') return t.first_installment_paid === false;
    return true;
  });

  // KPI Header Stats
  const totalDealRevenue = displayedTransactions.reduce((acc, t) => acc + (t.deal_value || t.amount || 0), 0);
  const totalAgencyComm = displayedTransactions.reduce((acc, t) => acc + (t.commission_amount || 0), 0);
  const totalSaleComm = displayedTransactions.reduce((acc, t) => acc + (t.sale_commission_amount || 0), 0);
  const confirmedContractsCount = displayedTransactions.filter(t => t.type === 'contract').length;

  const formatVND = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + ' tỷ';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(0) + ' tr';
    }
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const formatFullVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & CALL TO ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-blue-600" />
            Quản Lý Giao Dịch & Hợp Đồng Khách Hàng
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi toàn trình từ Cọc, Ký HĐMB, Đóng tiền Đợt 1, Giá trị giao dịch và đối soát Hoa hồng Sàn / Sale.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
          <Plus className="h-4 w-4 mr-1.5" /> Tạo Hợp Đồng Mới
        </Button>
      </div>

      {/* 2. STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Tổng Giá Trị Giao Dịch</div>
            <div className="text-lg font-black text-slate-900">{formatVND(totalDealRevenue)}</div>
            <div className="text-[10px] text-slate-400 font-mono">{confirmedContractsCount} HĐMB đã ký</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Tổng Hoa Hồng Sàn</div>
            <div className="text-lg font-black text-emerald-700">{formatVND(totalAgencyComm)}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Trung bình ~3.5% CĐT</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Tổng Hoa Hồng Sale</div>
            <div className="text-lg font-black text-amber-700">{formatVND(totalSaleComm)}</div>
            <div className="text-[10px] text-amber-600 font-medium">Tỷ lệ chi trả 1.5 - 2.0%</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Tiến Độ Thu Tiền Đợt 1</div>
            <div className="text-lg font-black text-purple-700">
              {displayedTransactions.filter(t => t.first_installment_paid).length} / {displayedTransactions.length}
            </div>
            <div className="text-[10px] text-slate-400">
              {displayedTransactions.length > 0 
                ? Math.round((displayedTransactions.filter(t => t.first_installment_paid).length / displayedTransactions.length) * 100)
                : 0}% hoàn tất đợt 1
            </div>
          </div>
        </div>
      </div>

      {/* 3. BỘ LỌC TÌM KIẾM */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Lọc Dự Án */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Lọc Loại Giao Dịch */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả loại giao dịch</option>
            <option value="contract">Ký Hợp đồng mua bán (HĐMB)</option>
            <option value="deposit">Đặt cọc</option>
            <option value="booking">Booking giữ chỗ</option>
          </select>

          {/* Lọc Đóng tiền Đợt 1 */}
          <select
            value={selectedPaidFilter}
            onChange={(e) => setSelectedPaidFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả trạng thái Đợt 1</option>
            <option value="paid">Đã thanh toán Đợt 1</option>
            <option value="unpaid">Chưa đóng Đợt 1</option>
          </select>
        </div>

        {/* Ô Tìm Kiếm */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã căn, HĐMB, khách hàng, sale..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 4. BẢNG DANH SÁCH GIAO DỊCH & HỢP ĐỒNG */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">Không tìm thấy giao dịch nào phù hợp.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Khách Hàng & Liên Hệ</th>
                  <th className="p-3">Dự Án & Mã Căn</th>
                  <th className="p-3">Mốc Cọc & Ngày Cọc</th>
                  <th className="p-3">Ký HĐMB & Ngày Ký</th>
                  <th className="p-3">Đóng Tiền Đợt 1</th>
                  <th className="p-3 text-right">Giá Trị Giao Dịch</th>
                  <th className="p-3 text-right">Hoa Hồng Sàn / Sale</th>
                  <th className="p-3">Chuyên Viên Tư Vấn</th>
                  <th className="p-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Khách hàng */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{tx.customer_name || 'Khách hàng'}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{tx.customer_phone || '---'}</span>
                      </div>
                    </td>

                    {/* Dự án & Mã căn */}
                    <td className="p-3">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mb-1">
                        {tx.unit_code || 'Chưa định danh'}
                      </span>
                      <div className="text-[11px] text-slate-600 font-medium truncate max-w-[160px]">
                        {tx.project_name || 'Dự án'}
                      </div>
                    </td>

                    {/* Mốc Cọc */}
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">
                        {formatFullVND(tx.type === 'deposit' ? tx.amount : (tx.deal_value ? Math.round(tx.deal_value * 0.03) : 100000000))}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>
                          {tx.deposit_date 
                            ? new Date(tx.deposit_date).toLocaleDateString('vi-VN') 
                            : new Date(tx.created_at || '').toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </td>

                    {/* Ký HĐMB */}
                    <td className="p-3">
                      {tx.type === 'contract' ? (
                        <>
                          <div className="font-mono font-bold text-slate-900 text-[11px]">
                            {tx.contract_code || tx.code}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>
                              {tx.contract_date 
                                ? new Date(tx.contract_date).toLocaleDateString('vi-VN') 
                                : new Date(tx.created_at || '').toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Chưa ký HĐMB</span>
                      )}
                    </td>

                    {/* Đóng tiền Đợt 1 */}
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">
                        {formatFullVND(tx.first_installment_amount || Math.round((tx.deal_value || tx.amount) * 0.1))}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <button
                          onClick={() => handleQuickTogglePaid(tx)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                            tx.first_installment_paid
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {tx.first_installment_paid ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Đã đóng đợt 1</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 text-amber-600" />
                              <span>Chưa đóng (Bấm thu)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Giá trị giao dịch */}
                    <td className="p-3 text-right">
                      <div className="font-black text-slate-900 text-sm">
                        {formatFullVND(tx.deal_value || tx.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400">Giá trị ký kết</div>
                    </td>

                    {/* Hoa hồng Sàn & Sale */}
                    <td className="p-3 text-right space-y-0.5">
                      <div className="font-bold text-emerald-700">
                        {formatFullVND(tx.commission_amount || Math.round((tx.deal_value || tx.amount) * 0.035))}
                        <span className="text-[10px] text-slate-500 font-normal ml-1">(Sàn)</span>
                      </div>
                      <div className="font-semibold text-amber-700 text-[11px]">
                        {formatFullVND(tx.sale_commission_amount || Math.round((tx.deal_value || tx.amount) * 0.018))}
                        <span className="text-[10px] text-slate-500 font-normal ml-1">({tx.sale_commission_rate || 1.8}% Sale)</span>
                      </div>
                    </td>

                    {/* Chuyên viên phụ trách */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{tx.sale_name || 'Chuyên viên tư vấn'}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                        {tx.team_name || 'Team Q1'} • {tx.agency_name || 'Sàn Q1'}
                      </div>
                    </td>

                    {/* Thao tác */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleOpenUpdateModal(tx)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Cập nhật tiến độ / Ghi chú"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL TẠO GIAO DỊCH / HỢP ĐỒNG MỚI */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Khởi Tạo Hợp Đồng Giao Dịch Mới"
        description="Ghi nhận mốc Cọc, ký HĐMB, đóng tiền Đợt 1 và phân bổ hoa hồng CĐT & Sale."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateContract} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Khách Hàng (Lead) *</label>
              <select
                required
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {candidateLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customer_name} ({l.customer_phone}) - {l.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mã Căn Hộ / Sản Phẩm *</label>
              <Input
                required
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                placeholder="Ví dụ: OG-S7.02-15.08"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Giá Trị Giao Dịch (VNĐ) *</label>
              <Input
                type="number"
                required
                value={dealValue}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDealValue(val);
                  setFirstInstallmentAmount(Math.round(val * 0.1));
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mã Số HĐMB</label>
              <Input
                value={contractCode}
                onChange={(e) => setContractCode(e.target.value)}
                placeholder="Ví dụ: HĐMB-2026-0099"
              />
            </div>
          </div>

          {/* Mốc Cọc & Ký HĐMB */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày Đặt Cọc</label>
              <Input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày Ký HĐMB</label>
              <Input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
              />
            </div>
          </div>

          {/* Mốc Đóng tiền Đợt 1 */}
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
            <div className="text-xs font-bold text-slate-800">Tiến Độ Đóng Tiền Đợt 1 (10% GTGD)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Số tiền đợt 1 (VNĐ)</label>
                <Input
                  type="number"
                  value={firstInstallmentAmount}
                  onChange={(e) => setFirstInstallmentAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hạn đóng đợt 1</label>
                <Input
                  type="date"
                  value={firstInstallmentDate}
                  onChange={(e) => setFirstInstallmentDate(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={firstInstallmentPaid}
                onChange={(e) => setFirstInstallmentPaid(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700">Khách hàng đã thanh toán thành công Đợt 1</span>
            </label>
          </div>

          {/* Tỷ lệ hoa hồng */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
            <div>
              <label className="block text-[11px] font-semibold text-amber-900 mb-1">% Hoa hồng Sàn (CĐT chi trả)</label>
              <Input
                type="number"
                step="0.1"
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
              />
              <div className="text-[11px] font-bold text-emerald-700 mt-1">
                = {formatFullVND(calculatedAgencyCommission)}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-amber-900 mb-1">% Hoa hồng Sale nhận được</label>
              <Input
                type="number"
                step="0.1"
                value={saleCommissionRate}
                onChange={(e) => setSaleCommissionRate(Number(e.target.value))}
              />
              <div className="text-[11px] font-bold text-amber-700 mt-1">
                = {formatFullVND(calculatedSaleCommission)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi Chú Tiến Độ / Chính Sách</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú về tiến độ ký, chiết khấu hoặc phương thức giải ngân..."
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu Hợp Đồng & Hoa Hồng'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL CẬP NHẬT TIẾN ĐỘ GIAO DỊCH */}
      <Modal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title="Cập Nhật Tiến Độ & Đóng Tiền Đợt 1"
        maxWidth="md"
      >
        {editingTx && (
          <form onSubmit={handleSaveUpdate} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>Khách hàng: <span className="font-bold text-slate-900">{editingTx.customer_name}</span></div>
              <div>Mã căn: <span className="font-bold text-blue-700">{editingTx.unit_code}</span></div>
              <div>Giá trị giao dịch: <span className="font-bold text-slate-900">{formatFullVND(editingTx.deal_value || editingTx.amount)}</span></div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mã Số HĐMB</label>
              <Input
                value={editContractCode}
                onChange={(e) => setEditContractCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Số tiền đóng Đợt 1 (VNĐ)</label>
              <Input
                type="number"
                value={editInstallmentAmount}
                onChange={(e) => setEditInstallmentAmount(Number(e.target.value))}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <input
                type="checkbox"
                checked={editPaid}
                onChange={(e) => setEditPaid(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-emerald-800">Xác nhận khách hàng ĐÃ thanh toán Đợt 1 thành công</span>
            </label>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú bổ sung</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setUpdateModalOpen(false)}>
                Đóng
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật Tiến Độ'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
