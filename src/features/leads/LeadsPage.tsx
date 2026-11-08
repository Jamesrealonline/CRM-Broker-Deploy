// ========================================================
// REAL ESTATE CRM - LEADS MANAGEMENT PAGE
// Bảng dữ liệu, Tìm kiếm, Lọc, Trùng SĐT, Phân trang, Xuất CSV
// ========================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Plus, 
  Download, 
  Filter, 
  AlertTriangle, 
  Phone, 
  Building2, 
  Calendar, 
  ChevronRight,
  Sparkles,
  ExternalLink,
  Clock,
  CheckSquare,
  Square,
  UserCheck,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { leadRepository } from '@/data/repositories/leadRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { autoTransferService } from '@/domain/services/autoTransferService';
import { notificationService, ClientDispatchInfo } from '@/domain/services/notificationService';
import { LeadDispatchModal } from '@/components/LeadDispatchModal';
import { Lead, Project, LeadStatus, UserProfile } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, maskPhone, formatCurrencyVND } from '@/lib/utils';

export const LeadsPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [projects, setProjects] = useState<Project[]>([]);

  // Modal tạo Lead
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newBudgetMin, setNewBudgetMin] = useState('2000000000');
  const [newBudgetMax, setNewBudgetMax] = useState('3500000000');
  const [newPurpose, setNewPurpose] = useState<'investment' | 'residence'>('investment');
  const [newNotes, setNewNotes] = useState('');
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Bulk Assign State (Module 6 & 7)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [sales, setSales] = useState<UserProfile[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [targetSaleId, setTargetSaleId] = useState('');
  const [bulkReason, setBulkReason] = useState('Phân bổ hàng loạt theo kế hoạch kinh doanh');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1-Click Client Dispatch Modal (Gmail Web & Zalo)
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchInfo, setDispatchInfo] = useState<ClientDispatchInfo | null>(null);
  const [dispatchedSale, setDispatchedSale] = useState<UserProfile | null>(null);
  const [dispatchedCount, setDispatchedCount] = useState(1);

  useEffect(() => {
    projectRepository.getProjects().then((list) => {
      setProjects(list);
      if (list.length > 0 && !newProjectId) setNewProjectId(list[0].id);
    });

    teamRepository.getProfiles().then((profs) => {
      const activeSales = profs.filter(p => (p.role === 'sale_agent' || p.role === 'team_leader') && p.status === 'active');
      setSales(activeSales);
      if (activeSales.length > 0 && !targetSaleId) {
        setTargetSaleId(activeSales[0].id);
      }
    });
  }, [newProjectId]);

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
  };

  const toggleSelectLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || selectedLeadIds.length === 0 || !targetSaleId) return;

    const targetSale = sales.find(s => s.id === targetSaleId);
    if (!targetSale) return;

    setBulkSubmitting(true);
    setBulkFeedback(null);

    const res = await leadRepository.assignBulkLeads(
      selectedLeadIds,
      targetSale,
      currentUser,
      bulkReason
    );

    setBulkSubmitting(false);
    if (res.success) {
      const chosenLeads = leads.filter(l => selectedLeadIds.includes(l.id));
      const info = notificationService.buildBulkClientDispatchInfo({
        leads: chosenLeads.map(l => ({
          id: l.id,
          full_name: l.customer_name || 'Khách hàng',
          phone: l.customer_phone || 'Chưa có SĐT',
          project_name: l.project_name,
        })),
        saleName: targetSale.full_name,
        saleEmail: targetSale.email,
        salePhone: targetSale.phone,
        managerName: currentUser.full_name,
        reason: bulkReason,
      });

      setSelectedLeadIds([]);
      setBulkModalOpen(false);
      setBulkFeedback(null);
      fetchLeads();

      // Mở modal gửi thông báo 1-Click
      setDispatchInfo(info);
      setDispatchedSale(targetSale);
      setDispatchedCount(res.updatedCount);
      setDispatchModalOpen(true);
    } else {
      setBulkFeedback({
        type: 'error',
        text: res.error || 'Phân bổ hàng loạt thất bại.',
      });
    }
  };

  const fetchLeads = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await leadRepository.getLeads(
        {
          search: search || undefined,
          projectId: selectedProject || undefined,
          status: (selectedStatus as LeadStatus) || undefined,
          page,
          pageSize,
        },
        currentUser
      );
      setLeads(res.leads);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [currentUser, search, selectedProject, selectedStatus, page]);

  // Kiểm tra trùng SĐT real-time khi gõ vào form tạo Lead
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewPhone(val);
    setPhoneWarning(null);

    if (val.length >= 9) {
      const check = await leadRepository.checkDuplicatePhone(val);
      if (check.isDuplicate) {
        setPhoneWarning(`Cảnh báo: SĐT này đã tồn tại trong hồ sơ "${check.existingLead?.customer_name}".`);
      }
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const res = await leadRepository.createLead({
      fullName: newFullName,
      phone: newPhone,
      email: newEmail,
      projectId: newProjectId,
      budgetMin: Number(newBudgetMin),
      budgetMax: Number(newBudgetMax),
      purpose: newPurpose,
      notes: newNotes,
      currentUser,
    });

    setIsSubmitting(false);
    if (res.success) {
      setCreateModalOpen(false);
      setNewFullName('');
      setNewPhone('');
      setNewEmail('');
      setNewNotes('');
      fetchLeads();
    } else {
      setSubmitError(res.error || 'Tạo Lead thất bại');
    }
  };

  // Xuất CSV theo quyền
  const handleExportCSV = () => {
    if (currentUser?.role === 'sale_agent') {
      alert('Chuyên viên tư vấn không có quyền xuất dữ liệu CSV. Vui lòng liên hệ Trưởng nhóm.');
      return;
    }

    const headers = ['Mã Lead', 'Khách hàng', 'SĐT', 'Email', 'Dự án', 'Trạng thái', 'Điểm', 'Sale phụ trách', 'Ngày tạo'];
    const rows = leads.map(l => [
      l.id,
      l.customer_name || '',
      currentUser?.role === 'marketing_manager' ? maskPhone(l.customer_phone) : (l.customer_phone || ''),
      l.customer_email || '',
      l.project_name || '',
      l.status,
      l.lead_score,
      l.assigned_name || '',
      formatDate(l.created_at),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Leads_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* 1. THANH CÔNG CỤ TRÊN CÙNG */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Danh Sách Khách Hàng Tiềm Năng (Leads)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng cộng: <span className="font-semibold text-slate-800">{total}</span> Lead theo phân quyền của bạn
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            Xuất CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm Lead mới
          </Button>
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM VÀ BỘ LỌC */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng, số điện thoại, nhu cầu..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedProject}
            onChange={(e) => { setSelectedProject(e.target.value); setPage(1); }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-slate-700"
          >
            <option value="">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-slate-700"
          >
            <option value="">Tất cả trạng thái</option>
            {JOURNEY_STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2.5 BANNER PHÂN BỔ HÀNG LOẠT KHI CHỌN NHIỀU LEAD */}
      {selectedLeadIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-blue-900 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <span>Đã chọn <strong className="text-blue-700 font-bold">{selectedLeadIds.length}</strong> khách hàng</span>
              <span className="text-slate-500 font-normal ml-2 hidden sm:inline">(Sẽ gộp vào 1 thông báo phân bổ duy nhất)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['admin', 'director', 'sales_manager', 'team_leader'].includes(currentUser?.role || '') && (
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => setBulkModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <UserCheck className="h-4 w-4 mr-1.5" />
                Phân bổ cho Sale ({selectedLeadIds.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setSelectedLeadIds([])}>
              Bỏ chọn tất cả
            </Button>
          </div>
        </div>
      )}

      {/* 3. BẢNG DANH SÁCH LEADS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Không tìm thấy Lead nào"
              description="Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các tiêu chí lọc."
              actionLabel="Tạo Lead mới"
              onAction={() => setCreateModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                    />
                  </th>
                  <th className="py-3 px-4">Khách Hàng</th>
                  <th className="py-3 px-4">Dự Án</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Đồng Hồ 24h</th>
                  <th className="py-3 px-4">Điểm Lead</th>
                  <th className="py-3 px-4">Ngân Sách</th>
                  <th className="py-3 px-4">Phụ Trách</th>
                  <th className="py-3 px-4">Tiếp Nhận</th>
                  <th className="py-3 px-4 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => {
                  const stage = JOURNEY_STAGES.find((s) => s.id === lead.status);
                  const isMarketing = currentUser?.role === 'marketing_manager';
                  const displayPhone = isMarketing ? maskPhone(lead.customer_phone) : lead.customer_phone;
                  const isSelected = selectedLeadIds.includes(lead.id);

                  // Đếm ngược 24h
                  const careInfo = autoTransferService.getCareRemainingHours(lead);
                  const colorClasses = {
                    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
                    red: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-bold',
                    gray: 'bg-slate-100 text-slate-600 border-slate-200',
                  }[careInfo.badgeColor];

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/20' : ''}`}
                    >
                      <td className="py-3.5 px-3 text-center" onClick={(e) => toggleSelectLead(lead.id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {lead.customer_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{displayPhone}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{lead.project_name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${stage?.bgColor} ${stage?.color} ${stage?.borderColor}`}
                        >
                          {stage?.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          title={careInfo.pauseReason || `Hạn chót: ${lead.care_deadline_at ? formatDate(lead.care_deadline_at) : '24h'}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${colorClasses}`}
                        >
                          <Clock className="h-3 w-3" />
                          {careInfo.badgeLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              lead.lead_score >= 80
                                ? 'text-emerald-600'
                                : lead.lead_score >= 60
                                ? 'text-blue-600'
                                : 'text-slate-600'
                            }`}
                          >
                            {lead.lead_score}
                          </span>
                          <span className="text-[10px] text-slate-400">/100</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        {formatCurrencyVND(lead.budget_min)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        {lead.assigned_name || <span className="text-slate-400 italic">Chưa giao</span>}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {formatDate(lead.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                          Xem <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. PHÂN TRANG */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
          <div>
            Hiển thị <span className="font-medium text-slate-700">{leads.length}</span> trên{' '}
            <span className="font-medium text-slate-700">{total}</span> kết quả
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Trang trước
            </Button>
            <span className="font-medium text-slate-700 px-2">Trang {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      </div>

      {/* 5. MODAL TẠO LEAD MỚI VỚI BẢO VỆ CHỐNG TRÙNG SĐT */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Thêm Khách Hàng Tiềm Năng Mới"
        description="Nhập thông tin tiếp nhận ban đầu. Hệ thống sẽ kiểm tra trùng số điện thoại."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Họ và tên khách hàng *"
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
            />
            <div>
              <Input
                label="Số điện thoại *"
                required
                value={newPhone}
                onChange={handlePhoneChange}
                placeholder="0987654321"
              />
              {phoneWarning && (
                <div className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{phoneWarning}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email liên hệ"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="khachhang@gmail.com"
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Dự án quan tâm *</label>
              <select
                required
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ngân sách dự kiến tối thiểu (VNĐ)"
              type="number"
              value={newBudgetMin}
              onChange={(e) => setNewBudgetMin(e.target.value)}
            />
            <Input
              label="Ngân sách dự kiến tối đa (VNĐ)"
              type="number"
              value={newBudgetMax}
              onChange={(e) => setNewBudgetMax(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Mục đích mua</label>
            <div className="flex gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="purpose"
                  checked={newPurpose === 'investment'}
                  onChange={() => setNewPurpose('investment')}
                />
                <span>Đầu tư sinh lời</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="purpose"
                  checked={newPurpose === 'residence'}
                  onChange={() => setNewPurpose('residence')}
                />
                <span>Mua để ở / an cư</span>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Ghi chú nhu cầu chi tiết</label>
            <textarea
              rows={3}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Khách cần căn 2 phòng ngủ view thoáng, quan tâm chính sách vay 0%..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Lưu Khách Hàng
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. MODAL PHÂN BỔ HÀNG LOẠT CHO SALE (MODULE 6 & 7) */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Phân Bổ Hàng Loạt Cho Sale (${selectedLeadIds.length} Lead)`}
        description="Giao đồng thời nhiều khách hàng cho chuyên viên tư vấn. Hệ thống tự động gộp 1 email tổng hợp để tránh spam."
        maxWidth="md"
      >
        <form onSubmit={handleBulkAssign} className="space-y-4">
          {bulkFeedback && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              bulkFeedback.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}>
              {bulkFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{bulkFeedback.text}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Số lượng lead phân bổ:</span>
              <strong className="text-blue-600">{selectedLeadIds.length} khách hàng</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Hạn chăm sóc mới:</span>
              <strong className="text-slate-800">24 giờ liên tục (Wall-clock)</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Kênh thông báo:</span>
              <strong className="text-slate-800">Email tổng hợp (Digest) + In-App</strong>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Chọn Chuyên Viên Tư Vấn (Sale) *</label>
            <select
              required
              value={targetSaleId}
              onChange={(e) => setTargetSaleId(e.target.value)}
              className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500"
            >
              {sales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.email}) {s.on_leave ? '- [Nghỉ phép]' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Sale sẽ nhận được danh sách tổng hợp bảng HTML kèm nút mở nhanh chi tiết từng lead.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Lý do / Chỉ đạo phân bổ</label>
            <textarea
              rows={2}
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              placeholder="Nhập lý do phân bổ hoặc yêu cầu liên hệ ngay..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setBulkModalOpen(false)}>
              Hủy
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              size="sm" 
              isLoading={bulkSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Xác Nhận Phân Bổ & Gửi Email
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL GỬI THÔNG BÁO TỨC THÌ 1-CLICK (GMAIL WEB & ZALO) */}
      <LeadDispatchModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        dispatchInfo={dispatchInfo}
        saleName={dispatchedSale?.full_name || ''}
        saleEmail={dispatchedSale?.email || ''}
        salePhone={dispatchedSale?.phone}
        leadCount={dispatchedCount}
      />
    </div>
  );
};
