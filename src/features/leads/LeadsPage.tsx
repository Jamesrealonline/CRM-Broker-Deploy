// ========================================================
// REAL ESTATE CRM - LEADS MANAGEMENT PAGE
// Bảng dữ liệu, Tìm kiếm, Lọc, Trùng SĐT, Phân trang, Xuất CSV
// ========================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  AlertCircle,
  Share2,
  Copy,
  Trash2,
  Edit3,
  ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { DistributionPage } from '@/features/distribution/DistributionPage';
import { leadRepository } from '@/data/repositories/leadRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { autoTransferService } from '@/domain/services/autoTransferService';
import { notificationService } from '@/domain/services/notificationService';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { Lead, Project, LeadStatus, UserProfile, LeadSource, Region, Agency, Team } from '@/domain/types';
import { JOURNEY_STAGES } from '@/domain/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, maskPhone, formatCurrencyVND } from '@/lib/utils';
import { canViewFullPII } from '@/lib/masking';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';

export const LeadsPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') === 'distribution' ? 'distribution' : 'leads';

  const setTab = (tab: 'leads' | 'distribution') => {
    if (tab === 'distribution') {
      setSearchParams({ tab: 'distribution' });
    } else {
      setSearchParams({});
    }
  };

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const { value: dateRange, updateRange } = useDateRange('this_month');
  const [includeSample, setIncludeSample] = useState(true);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Soft Delete State (Controlled for Admin/Director)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Nguồn khách hàng (Lead Sources)
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [isAddingNewSource, setIsAddingNewSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [isCreatingSource, setIsCreatingSource] = useState(false);

  // Bulk Assign State (Module 6 & 7)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [sales, setSales] = useState<UserProfile[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [targetSaleId, setTargetSaleId] = useState('');
  const [bulkReason, setBulkReason] = useState('Phân bổ hàng loạt theo kế hoạch kinh doanh');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bộ lọc phân cấp nhánh (Cascading Branch Filter): CEO -> Giám Đốc Vùng -> Giám Đốc Sàn -> Đội Nhóm -> Chuyên Viên Sale
  const [allCeos, setAllCeos] = useState<UserProfile[]>([]);
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allSales, setAllSales] = useState<UserProfile[]>([]);

  const [selectedCeo, setSelectedCeo] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedSale, setSelectedSale] = useState('');

  useEffect(() => {
    projectRepository.getProjects(currentUser || undefined).then((list) => {
      const filteredProjects = branchHierarchyService.filterProjects(currentUser, list);
      setProjects(filteredProjects);
      if (filteredProjects.length > 0 && !newProjectId) setNewProjectId(filteredProjects[0].id);
    });

    teamRepository.getOrganizations(currentUser || undefined).then((orgs) => {
      teamRepository.getProfiles(undefined, undefined, currentUser || undefined).then((profs) => {
        let ceoList = profs.filter(p => p.role === 'ceo');
        if (ceoList.length === 0) {
          ceoList = orgs.map(o => ({
            id: o.ceo_id || `ceo-${o.id}`,
            full_name: o.ceo_name || `CEO (${o.name})`,
            email: o.email || 'ceo@diaocvang.vn',
            phone: o.phone || '',
            role: 'ceo' as const,
            organization_id: o.id,
            status: 'active' as const,
            must_change_password: false,
            totp_enabled: false,
          }));
        }
        setAllCeos(currentUser?.role !== 'admin' ? ceoList.filter(c => c.id === currentUser?.id || c.organization_id === currentUser?.organization_id) : ceoList);
      });
    });

    teamRepository.getRegions(currentUser || undefined).then((regs) => {
      setAllRegions(branchHierarchyService.filterRegions(currentUser, regs));
    });
    teamRepository.getAgencies(undefined, currentUser || undefined).then((ags) => {
      setAllAgencies(branchHierarchyService.filterAgencies(currentUser, ags));
    });
    teamRepository.getTeams(undefined, currentUser || undefined).then((tms) => {
      setAllTeams(branchHierarchyService.filterTeams(currentUser, tms));
    });
    teamRepository.getProfiles(undefined, undefined, currentUser || undefined).then((profs) => {
      const activeSales = profs.filter(p => (p.role === 'sale_agent' || p.role === 'team_leader') && p.status === 'active');
      setSales(activeSales);
      setAllSales(branchHierarchyService.filterSales(currentUser, activeSales));
      if (activeSales.length > 0 && !targetSaleId) {
        setTargetSaleId(activeSales[0].id);
      }
    });
    leadRepository.getLeadSources().then((sources) => {
      setLeadSources(sources);
      if (sources.length > 0 && !selectedSourceId) {
        setSelectedSourceId(sources[0].id);
      }
    });
  }, [currentUser, newProjectId]);

  const visibleRegions = useMemo(() => {
    if (!selectedCeo) return allRegions;
    const targetCeo = allCeos.find(c => c.id === selectedCeo);
    if (!targetCeo?.organization_id) return allRegions;
    return allRegions.filter(r => !r.organization_id || r.organization_id === targetCeo.organization_id);
  }, [allRegions, selectedCeo, allCeos]);

  const visibleAgencies = useMemo(() => {
    if (!selectedRegion) {
      if (!selectedCeo) return allAgencies;
      const regionIds = new Set(visibleRegions.map(r => r.id));
      return allAgencies.filter(a => !a.region_id || regionIds.has(a.region_id));
    }
    return allAgencies.filter(a => a.region_id === selectedRegion);
  }, [allAgencies, selectedRegion, selectedCeo, visibleRegions]);

  const visibleTeams = useMemo(() => {
    if (!selectedAgency) {
      if (!selectedRegion) return allTeams;
      const agencyIds = new Set(visibleAgencies.map(a => a.id));
      return allTeams.filter(t => t.agency_id && agencyIds.has(t.agency_id));
    }
    return allTeams.filter(t => t.agency_id === selectedAgency);
  }, [allTeams, selectedAgency, selectedRegion, visibleAgencies]);

  const visibleSales = useMemo(() => {
    if (!selectedTeam) {
      if (!selectedAgency) {
        if (!selectedRegion) return allSales;
        const agencyIds = new Set(visibleAgencies.map(a => a.id));
        return allSales.filter(s => s.agency_id && agencyIds.has(s.agency_id));
      }
      return allSales.filter(s => s.agency_id === selectedAgency);
    }
    return allSales.filter(s => s.team_id === selectedTeam);
  }, [allSales, selectedTeam, selectedAgency, selectedRegion, visibleAgencies]);

  const handleAddNewSource = async () => {
    if (!newSourceName.trim()) return;
    setIsCreatingSource(true);
    try {
      const created = await leadRepository.createLeadSource(newSourceName.trim());
      setLeadSources(prev => [...prev.filter(s => s.id !== created.id), created]);
      setSelectedSourceId(created.id);
      setNewSourceName('');
      setIsAddingNewSource(false);
    } catch (err: any) {
      alert(err.message || 'Không thể tạo nguồn lead mới');
    } finally {
      setIsCreatingSource(false);
    }
  };

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
      setBulkFeedback({
        type: 'success',
        text: `Đã phân bổ thành công ${res.updatedCount} lead cho chuyên viên ${targetSale.full_name}! Hệ thống đã tự động gửi email tổng hợp qua Webhook.`,
      });
      setSelectedLeadIds([]);
      setTimeout(() => {
        setBulkModalOpen(false);
        setBulkFeedback(null);
        fetchLeads();
      }, 1500);
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
          ceoId: selectedCeo || undefined,
          regionId: selectedRegion || undefined,
          agencyId: selectedAgency || undefined,
          teamId: selectedTeam || undefined,
          assignedTo: selectedSale || undefined,
          status: (selectedStatus as LeadStatus) || undefined,
          includeSample,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
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
  }, [currentUser, search, selectedProject, selectedCeo, selectedRegion, selectedAgency, selectedTeam, selectedSale, selectedStatus, page, dateRange, includeSample]);

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

    const chosenSource = leadSources.find(s => s.id === selectedSourceId);
    const res = await leadRepository.createLead({
      fullName: newFullName,
      phone: newPhone,
      email: newEmail,
      projectId: newProjectId,
      sourceId: selectedSourceId,
      sourceName: chosenSource?.name,
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

    const headers = ['Mã Lead', 'Khách hàng', 'SĐT', 'Email', 'Dự án', 'Trạng thái', 'Điểm', 'Sale phụ trách', 'Ngày tạo', 'Dữ liệu mẫu'];
    const rows = leads.map(l => {
      const canFull = canViewFullPII(currentUser, l.agency_id);
      return [
        l.id,
        l.customer_name || '',
        canFull ? (l.customer_phone || '') : maskPhone(l.customer_phone),
        canFull ? (l.customer_email || '') : (l.customer_email ? '***@***.***' : ''),
        l.project_name || '',
        l.status,
        l.lead_score,
        l.assigned_name || '',
        formatDate(l.created_at),
        l.is_sample ? 'Có' : 'Không',
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Leads_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenDelete = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setLeadToDelete(lead);
    setDeleteReason('');
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete || !currentUser) return;
    if (deleteReason.trim().length < 5) {
      setDeleteError('Lý do xóa có kiểm soát bắt buộc tối thiểu 5 ký tự.');
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      controlledDataService.softDeleteLead(leadToDelete.id, deleteReason.trim(), currentUser);
      setDeleteModalOpen(false);
      setLeadToDelete(null);
      fetchLeads();
    } catch (err: any) {
      setDeleteError(err.message || 'Không thể xóa lead.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedLeadIds.length === 0 || !currentUser) return;
    const reason = prompt('Nhập lý do xóa hàng loạt các lead đã chọn (tối thiểu 5 ký tự):');
    if (!reason || reason.trim().length < 5) {
      alert('Lý do xóa không hợp lệ (tối thiểu 5 ký tự).');
      return;
    }
    try {
      const res = controlledDataService.executeBatchSoftDelete('lead', selectedLeadIds, reason.trim(), currentUser);
      alert(`Đã chuyển ${res.affected_count} lead vào Thùng rác (Mã lô: ${res.batch_id}). Bạn có thể khôi phục từ Trang Quản Trị.`);
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa hàng loạt lead.');
    }
  };

  return (
    <div className="space-y-5">
      {/* 0. MODULE TABS: GOM QUẢN LÝ LEAD & PHÂN BỔ LEAD VÀO 1 MODULE */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab('leads')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            currentTab === 'leads'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Danh Sách & Tiếp Nhận Lead ({total})</span>
        </button>

        <button
          onClick={() => setTab('distribution')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            currentTab === 'distribution'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <Share2 className="h-4 w-4" />
          <span>Phân Bổ & Lead Pool (SLA 24h)</span>
        </button>
      </div>

      {currentTab === 'distribution' ? (
        <DistributionPage />
      ) : (
        <>
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

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Reusable DateRangeFilter */}
          <DateRangeFilter
            value={dateRange}
            onChange={(val) => updateRange(val.preset || 'custom', val.from, val.to, val.compare)}
          />

          {/* Bộ lọc 5 cấp: CEO -> Giám Đốc Vùng -> Giám Đốc Sàn -> Đội Nhóm -> Nhân Viên Sale */}
          {allCeos.length > 0 && (
            <select
              value={selectedCeo}
              onChange={(e) => {
                setSelectedCeo(e.target.value);
                setSelectedRegion('');
                setSelectedAgency('');
                setSelectedTeam('');
                setSelectedSale('');
                setPage(1);
              }}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 text-slate-800 font-semibold shadow-sm"
            >
              <option value="">Tất cả Tổng Giám Đốc (CEO)</option>
              {allCeos.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}

          {visibleRegions.length > 0 && (
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedAgency('');
                setSelectedTeam('');
                setSelectedSale('');
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
            >
              <option value="">Tất cả Vùng (GĐ Vùng)</option>
              {visibleRegions.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
              ))}
            </select>
          )}

          {visibleAgencies.length > 0 && (
            <select
              value={selectedAgency}
              onChange={(e) => {
                setSelectedAgency(e.target.value);
                setSelectedTeam('');
                setSelectedSale('');
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
            >
              <option value="">Tất cả Sàn (GĐ Sàn)</option>
              {visibleAgencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {visibleTeams.length > 0 && (
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value);
                setSelectedSale('');
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 text-slate-700"
            >
              <option value="">Tất cả Đội Nhóm</option>
              {visibleTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          {visibleSales.length > 0 && (
            <select
              value={selectedSale}
              onChange={(e) => {
                setSelectedSale(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 text-slate-700"
            >
              <option value="">Tất cả Nhân Viên Sale</option>
              {visibleSales.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          )}

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

          {/* Toggle Hiện dữ liệu mẫu */}
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-100">
            <input
              type="checkbox"
              checked={includeSample}
              onChange={(e) => setIncludeSample(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
            />
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Dữ liệu mẫu</span>
          </label>
        </div>
      </div>

      {/* 2.5 BANNER PHÂN BỔ & XÓA HÀNG LOẠT KHI CHỌN NHIỀU LEAD */}
      {selectedLeadIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-blue-900 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <span>Đã chọn <strong className="text-blue-700 font-bold">{selectedLeadIds.length}</strong> khách hàng</span>
              <span className="text-slate-500 font-normal ml-2 hidden sm:inline">(Thao tác hàng loạt có hoàn tác)</span>
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

            {['admin', 'director'].includes(currentUser?.role || '') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
                className="text-red-700 bg-red-50 hover:bg-red-100 border-red-200 shadow-sm"
              >
                <Trash2 className="h-4 w-4 mr-1.5 text-red-600" />
                Xóa hàng loạt ({selectedLeadIds.length})
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
                  <th className="py-3 px-3">Nguồn Lead</th>
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
                  const canFull = canViewFullPII(currentUser, lead.agency_id);
                  const displayPhone = canFull ? lead.customer_phone : (isMarketing ? maskPhone(lead.customer_phone) : lead.customer_phone);
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
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          <span>{lead.customer_name}</span>
                          {lead.is_sample && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Sparkles className="h-2.5 w-2.5 text-amber-500" /> Mẫu
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{displayPhone}</span>
                          {canFull && lead.customer_phone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(lead.customer_phone || '');
                                setCopiedPhoneId(lead.id);
                                setTimeout(() => setCopiedPhoneId(null), 1500);
                              }}
                              className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50"
                              title="Sao chép số điện thoại"
                            >
                              {copiedPhoneId === lead.id ? (
                                <span className="text-[10px] font-bold text-emerald-600">Đã chép!</span>
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {lead.source_name || 'Hotline'}
                        </span>
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
                        <div className="flex items-center justify-end gap-1.5">
                          {canFull && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenDelete(lead, e)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                              title="Xóa Lead vào Thùng rác"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                            Xem <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </span>
                        </div>
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
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Nguồn Lead *</label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewSource(!isAddingNewSource)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isAddingNewSource ? 'Chọn nguồn có sẵn' : '+ Thêm nguồn mới'}
                </button>
              </div>
              {!isAddingNewSource ? (
                <select
                  required
                  value={selectedSourceId}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setIsAddingNewSource(true);
                    } else {
                      setSelectedSourceId(e.target.value);
                    }
                  }}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500"
                >
                  {leadSources.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="__add_new__">+ Thêm nguồn mới...</option>
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="Ví dụ: Hội thảo, Billboard..."
                    className="flex-1 text-xs h-9 px-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewSource();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddNewSource}
                    isLoading={isCreatingSource}
                    className="text-xs px-2.5 h-9"
                  >
                    Thêm
                  </Button>
                </div>
              )}
            </div>
          </div>

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

      {/* 7. MODAL XÓA LEAD CÓ KIỂM SOÁT VÀO THÙNG RÁC (ADMIN & DIRECTOR) */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Xóa Lead Có Kiểm Soát (Thùng Rác)"
        description={`Lead "${leadToDelete?.customer_name}" sẽ được chuyển vào Thùng rác và có thể khôi phục bất kỳ lúc nào.`}
        maxWidth="md"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Quy định quản trị an toàn:</p>
            <p>• Lead đã phát sinh hợp đồng hiệu lực không thể xóa trực tiếp.</p>
            <p>• Khi khôi phục, hạn chót SLA 24h sẽ được tự động làm mới để bảo vệ quyền lợi Sale.</p>
            <p>• Toàn bộ lịch sử thao tác được ghi vào Nhật ký kiểm toán (Audit Log).</p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Lý do xóa lead * (Tối thiểu 5 ký tự)
            </label>
            <textarea
              rows={3}
              required
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Ví dụ: Khách hàng đổi kế hoạch tài chính, dừng liên hệ..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Xác Nhận Xóa Vào Thùng Rác
            </Button>
          </div>
        </div>
      </Modal>
        </>
      )}
    </div>
  );
};
