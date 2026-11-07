// ========================================================
// REAL ESTATE CRM - PROJECT KNOWLEDGE & AI ENRICHMENT PAGE
// Tóm tắt văn bản <= 3000 ký tự (Tự parse nhãn), AI Enrich kèm nguồn & cờ unverified
// ========================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Sparkles, 
  Save, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  HelpCircle, 
  FileText,
  FileCheck,
  ShieldCheck,
  DollarSign,
  Award,
  TrendingUp,
  Percent,
  Edit3,
  Calendar,
  Clock,
  Trash2,
  Plus,
  Filter,
  History,
  ToggleLeft,
  ToggleRight,
  Layers
} from 'lucide-react';
import { projectRepository } from '@/data/repositories/projectRepository';
import { aiRepository, ProjectEnrichProposal } from '@/data/repositories/aiRepository';
import { 
  Project, 
  ProjectKnowledge, 
  ProjectFaq, 
  SoldProduct,
  ProjectCommissionPolicy,
  CommissionTier,
  RoleCommissionRate,
  RecognitionMilestone
} from '@/domain/types';
import { TimeRangeFilter } from '@/domain/services/financialCalculationService';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

export const ProjectKnowledgePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [faqs, setFaqs] = useState<ProjectFaq[]>([]);
  const [loading, setLoading] = useState(true);

  // Ô văn bản tóm tắt <= 3000 ký tự
  const [summaryText, setSummaryText] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Module Hoa Hồng & Sản Phẩm Bán Được (Financials & Sales)
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month' | 'quarter'>('all');
  const [financialStats, setFinancialStats] = useState<{
    total_contracts: number;
    total_revenue: number;
    total_commission: number;
    total_sale_commission: number;
    expected_commission: number;
    realized_commission: number;
    expected_sale_commission: number;
    realized_sale_commission: number;
    inventory: {
      totalUnits: number;
      soldUnits: number;
      depositUnits: number;
      bookingUnits: number;
      availableUnits: number;
    };
    sold_products: SoldProduct[];
    current_policy?: ProjectCommissionPolicy;
    policies: ProjectCommissionPolicy[];
  } | null>(null);

  // Modal Cấu Hình Chính Sách Hoa Hồng Theo Bậc
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'policy' | 'history'>('policy');
  const [editCompanyRate, setEditCompanyRate] = useState<number>(3.5);
  const [editMilestone, setEditMilestone] = useState<RecognitionMilestone>('first_installment');
  const [editValidFrom, setEditValidFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [editValidTo, setEditValidTo] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editTiers, setEditTiers] = useState<CommissionTier[]>([]);
  const [editRoleRates, setEditRoleRates] = useState<RoleCommissionRate[]>([]);
  const [isSavingCommission, setIsSavingCommission] = useState(false);

  // AI Enrichment Modal
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const [proposals, setProposals] = useState<ProjectEnrichProposal[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  const fetchProjectData = async (currentTimeFilter = timeFilter) => {
    if (!id) return;
    setLoading(true);
    try {
      const [proj, know, faqList, stats] = await Promise.all([
        projectRepository.getProjectById(id),
        projectRepository.getProjectKnowledge(id),
        projectRepository.getProjectFaqs(id),
        projectRepository.getProjectFinancialStats(id, { preset: currentTimeFilter }),
      ]);
      setProject(proj);
      setKnowledge(know);
      setSummaryText(know?.summary_text || '');
      setFaqs(faqList);
      setFinancialStats(stats as any);

      // Populate policy form from active policy
      if (stats.current_policy) {
        const cp = stats.current_policy;
        setEditCompanyRate(cp.company_commission_rate);
        setEditMilestone(cp.recognition_milestone);
        setEditValidFrom(cp.valid_from);
        setEditValidTo(cp.valid_to || '');
        setEditNotes(cp.notes || '');
        setEditTiers(cp.tiers || []);
        setEditRoleRates(cp.role_rates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id, timeFilter]);

  // Handler for adding a new progressive tier
  const handleAddTier = () => {
    const newTier: CommissionTier = {
      id: crypto.randomUUID(),
      policy_id: financialStats?.current_policy?.id || `pol-${id}`,
      tier_type: 'contract_count',
      min_threshold: editTiers.length > 0 ? (editTiers[editTiers.length - 1].max_threshold || 10) + 1 : 1,
      max_threshold: null,
      bonus_rate: 0.3,
      target_role: 'all',
      is_active: true,
    };
    setEditTiers([...editTiers, newTier]);
  };

  const handleRemoveTier = (tierId: string) => {
    setEditTiers(editTiers.filter(t => t.id !== tierId));
  };

  const handleToggleTier = (tierId: string) => {
    setEditTiers(editTiers.map(t => t.id === tierId ? { ...t, is_active: !t.is_active } : t));
  };

  const handleUpdateTierField = (tierId: string, field: keyof CommissionTier, value: any) => {
    setEditTiers(editTiers.map(t => t.id === tierId ? { ...t, [field]: value } : t));
  };

  const handleUpdateRoleRate = (role: string, default_rate: number) => {
    setEditRoleRates(editRoleRates.map(r => r.role === role ? { ...r, default_rate } : r));
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSavingCommission(true);
    try {
      await projectRepository.saveCommissionPolicy({
        id: crypto.randomUUID(), // Tạo phiên bản chính sách mới để lưu lịch sử
        project_id: id,
        company_commission_rate: editCompanyRate,
        recognition_milestone: editMilestone,
        valid_from: editValidFrom,
        valid_to: editValidTo || null,
        is_active: true,
        notes: editNotes,
        tiers: editTiers,
        role_rates: editRoleRates,
      });
      setCommissionModalOpen(false);
      await fetchProjectData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCommission(false);
    }
  };

  // Lưu tóm tắt văn bản và tự động điền các trường
  const handleSaveSummary = async () => {
    if (!id) return;
    setIsSavingSummary(true);
    try {
      const updated = await projectRepository.updateKnowledgeSummary(id, summaryText);
      setKnowledge(updated);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSummary(false);
    }
  };

  // Kích hoạt AI Bổ sung thông tin tự động
  const handleStartEnrich = async () => {
    if (!project) return;
    setIsEnriching(true);
    setEnrichModalOpen(true);
    try {
      const results = await aiRepository.enrichProject(project.name, project.location, project.developer);
      // Áp dụng quy tắc mục 8: Trường trống mặc định được chọn, trường đã có dữ liệu mặc định không bị ghi đè
      const mapped = results.map(p => {
        const currentVal = knowledge ? (knowledge[p.field] as string) : undefined;
        return {
          ...p,
          currentValue: currentVal,
          selected: !currentVal, // Trống -> mặc định chọn, đã có -> không chọn mặc định
        };
      });
      setProposals(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleToggleSelectProposal = (index: number) => {
    setProposals(prev => prev.map((item, idx) => idx === index ? { ...item, selected: !item.selected } : item));
  };

  const handleApplyEnrichment = async () => {
    if (!id || !knowledge) return;
    const updated = { ...knowledge };

    proposals.forEach(p => {
      if (p.selected) {
        (updated as any)[p.field] = p.proposedValue;
        (updated as any)[`${p.field}_source`] = p.sourceUrl;
        (updated as any)[`${p.field}_unverified`] = true; // Gắn cờ unverified cho tới khi người dùng duyệt
      }
    });

    setKnowledge(updated);
    setEnrichModalOpen(false);
    // Tự sinh lại văn bản tóm tắt
    const newSummary = `Vị trí: ${updated.location || ''}\n` +
                       `Loại hình: ${updated.property_type || ''}\n` +
                       `Giá: ${updated.price_range || ''}\n` +
                       `Pháp lý: ${updated.legal || ''}\n` +
                       `Tiến độ: ${updated.progress || ''}\n` +
                       `Chính sách: ${updated.policy || ''}\n` +
                       `Điểm nhấn: ${updated.highlights || ''}`;
    setSummaryText(newSummary.slice(0, 3000));
    await projectRepository.updateKnowledgeSummary(id, newSummary);
  };

  const formatVND = (num: number) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + ' tỷ đ';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(0) + ' tr đ';
    }
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const formatFullVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-slate-500">Không tìm thấy thông tin dự án.</div>;
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/projects')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {project.code}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Chủ đầu tư: <span className="font-semibold text-slate-700">{project.developer}</span> • {project.location}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCommissionModalOpen(true)}>
            <Edit3 className="h-4 w-4 mr-1.5" /> Cài đặt hoa hồng dự án
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/scripts')}>
            <FileText className="h-4 w-4 mr-1.5" /> Quản lý Sales Scripts
          </Button>
          <Button variant="primary" size="sm" onClick={handleStartEnrich}>
            <Sparkles className="h-4 w-4 mr-1.5" /> AI Bổ sung thông tin tự động
          </Button>
        </div>
      </div>

      {/* MODULE CHÍNH SÁCH HOA HỒNG & HIỆU SUẤT BÁN HÀNG */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/20 via-white to-indigo-50/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Percent className="h-4 w-4 text-blue-600" />
                Chính Sách Hoa Hồng & Thống Kê Bán Hàng Dự Án
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-500">Mốc ghi nhận hoa hồng:</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5 text-blue-600" />
                  {project.recognition_milestone === 'deposit' 
                    ? 'Đặt cọc' 
                    : project.recognition_milestone === 'contract' 
                    ? 'Ký HĐMB' 
                    : 'Đóng tiền Đợt 1'}
                </span>
                {financialStats?.current_policy?.valid_from && (
                  <span className="text-[10px] text-slate-400">
                    (Hiệu lực từ: {new Date(financialStats.current_policy.valid_from).toLocaleDateString('vi-VN')})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* BỘ LỌC THỜI GIAN */}
              <div className="flex items-center gap-1.5 text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Toàn bộ thời gian</option>
                  <option value="week">Tuần này</option>
                  <option value="month">Tháng này</option>
                  <option value="quarter">Quý này</option>
                </select>
              </div>

              <Button size="sm" variant="outline" className="text-xs" onClick={() => setCommissionModalOpen(true)}>
                <Edit3 className="h-3.5 w-3.5 mr-1 text-blue-600" /> Cấu hình chính sách
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="space-y-4">
          {/* 8 THẺ KPI TÀI CHÍNH & HOA HỒNG CHI TIẾT */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>% Hoa Hồng CĐT</span>
                <Percent className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-black text-blue-700 mt-1">
                {financialStats?.current_policy?.company_commission_rate ?? project.commission_rate ?? 3.5}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Sale: {editRoleRates.find(r => r.role === 'sale_agent')?.default_rate ?? project.sale_commission_rate ?? 1.8}%
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Bậc Hoa Hồng Lũy Tiến</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {financialStats?.current_policy?.tiers?.length || 3} bậc
              </div>
              <div className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
                {financialStats?.current_policy?.tiers?.filter(t => t.is_active).length || 3} bậc đang kích hoạt
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Tổng HĐMB Đã Ký</span>
                <FileCheck className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <div className="text-xl font-black text-purple-700 mt-1">
                {financialStats?.total_contracts ?? 0} căn
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Hợp đồng mua bán chính thức</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Tổng Doanh Số Ký Kết</span>
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="text-lg font-black text-slate-900 mt-1 truncate">
                {financialStats ? formatVND(financialStats.total_revenue) : '0 đ'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tính từ các HĐMB xác nhận</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>HH CĐT Dự Kiến</span>
                <Award className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="text-lg font-black text-blue-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.expected_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Toàn bộ hợp đồng phát sinh</div>
            </div>

            <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-200 shadow-sm">
              <div className="text-[11px] font-semibold text-emerald-800 flex items-center justify-between">
                <span>HH CĐT Thực Nhận</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="text-lg font-black text-emerald-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.realized_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Đã đạt mốc ghi nhận</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>HH Sale Dự Kiến</span>
                <Award className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-black text-amber-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.expected_sale_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Bao gồm thưởng lũy tiến</div>
            </div>

            <div className="p-3.5 bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-200 shadow-sm">
              <div className="text-[11px] font-semibold text-amber-800 flex items-center justify-between">
                <span>HH Sale Thực Nhận</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="text-lg font-black text-amber-700 mt-1 truncate">
                {financialStats ? formatVND(financialStats.realized_sale_commission) : '0 đ'}
              </div>
              <div className="text-[10px] text-amber-700 font-medium mt-0.5">Đủ điều kiện chi trả</div>
            </div>
          </div>

          {/* THỐNG KÊ TỒN KHO SẢN PHẨM DỰ ÁN */}
          {financialStats?.inventory && (
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Thống Kê Cơ Cấu Giỏ Hàng Dự Án
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Quy mô dự án: <strong className="text-slate-800">{financialStats.inventory.totalUnits}</strong> sản phẩm
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 bg-white rounded-lg border border-purple-200">
                  <div className="text-[11px] text-purple-700 font-semibold">Đã Bán (HĐMB)</div>
                  <div className="text-lg font-black text-purple-900">{financialStats.inventory.soldUnits}</div>
                  <div className="text-[10px] text-slate-400">
                    {Math.round((financialStats.inventory.soldUnits / financialStats.inventory.totalUnits) * 100)}% giỏ hàng
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-blue-200">
                  <div className="text-[11px] text-blue-700 font-semibold">Đã Đặt Cọc</div>
                  <div className="text-lg font-black text-blue-900">{financialStats.inventory.depositUnits}</div>
                  <div className="text-[10px] text-slate-400">Chờ hoàn tất HĐMB</div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                  <div className="text-[11px] text-amber-700 font-semibold">Đang Giữ Chỗ (Booking)</div>
                  <div className="text-lg font-black text-amber-900">{financialStats.inventory.bookingUnits}</div>
                  <div className="text-[10px] text-slate-400">Phiếu ưu tiên chọn căn</div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <div className="text-[11px] text-emerald-700 font-semibold">Sản Phẩm Còn Lại</div>
                  <div className="text-lg font-black text-emerald-900">{financialStats.inventory.availableUnits}</div>
                  <div className="text-[10px] text-slate-400">Sẵn sàng phân phối</div>
                </div>
              </div>
            </div>
          )}

          {/* BẢNG CÁC SẢN PHẨM BÁN ĐƯỢC */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Danh Sách Sản Phẩm Đã Bán ({financialStats?.sold_products.length || 0} căn)
              </span>
              <span className="text-[11px] text-slate-500">
                Thống kê tự động từ hợp đồng mua bán chính thức
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Mã Căn/Lô</th>
                    <th className="p-2.5">Loại Hình</th>
                    <th className="p-2.5 text-right">Giá Bán (GTGD)</th>
                    <th className="p-2.5">Số HĐMB</th>
                    <th className="p-2.5">Khách Hàng</th>
                    <th className="p-2.5">Chuyên Viên Chốt</th>
                    <th className="p-2.5">Ngày Bán</th>
                    <th className="p-2.5 text-right">HH CĐT</th>
                    <th className="p-2.5 text-right">HH Sale</th>
                    <th className="p-2.5 text-center">Trạng Thái HH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!financialStats || financialStats.sold_products.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400">
                        Chưa có sản phẩm nào được ký HĐMB trong khoảng thời gian này.
                      </td>
                    </tr>
                  ) : (
                    financialStats.sold_products.map((sp) => (
                      <tr key={sp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-bold text-blue-700">
                          {sp.unit_code}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {sp.property_type}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          {formatFullVND(sp.deal_value)}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] font-semibold text-slate-800">
                          {sp.contract_code}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">{sp.customer_name}</div>
                          <div className="text-[10px] text-slate-400">{sp.customer_phone}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">{sp.sale_name}</div>
                          <div className="text-[10px] text-slate-400">{sp.team_name || 'Team Q1'}</div>
                        </td>
                        <td className="p-2.5 text-slate-500">
                          {new Date(sp.sold_date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="p-2.5 text-right font-bold text-blue-700">
                          {formatFullVND(sp.commission_amount)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-amber-700">
                          {formatFullVND(sp.sale_commission_amount)}
                        </td>
                        <td className="p-2.5 text-center">
                          {sp.first_installment_paid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Thực nhận
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock className="h-3 w-3 text-amber-600" /> Dự kiến
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Đã lưu tóm tắt và tự động trích xuất các trường thông tin thành công!</span>
        </div>
      )}

      {/* 2. KHUNG DÁN VĂN BẢN TÓM TẮT DỰ ÁN (<= 3000 KÝ TỰ) */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50/20 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Ô Tóm Tắt Dự Án Dạng Văn Bản (Tối đa 3.000 ký tự)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Không upload file để tiết kiệm tài nguyên database. Định dạng các dòng dạng "Nhãn: nội dung" (Vị trí:, Giá:, Pháp lý:, Tiến độ:, Chính sách:, Điểm nhấn:) để hệ thống tự điền.
              </p>
            </div>
            <span className={`text-xs font-semibold ${summaryText.length > 2800 ? 'text-rose-600' : 'text-slate-500'}`}>
              {summaryText.length} / 3.000 ký tự
            </span>
          </div>
        </CardHeader>

        <div className="space-y-3">
          <textarea
            rows={7}
            maxLength={3000}
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder="Dán nội dung tóm tắt dự án tại đây... Ví dụ:
Vị trí: Số 259 Xa Lộ Hà Nội, An Phú, Thủ Đức
Loại hình: Căn hộ cao cấp 1-3PN
Giá: 110 - 150 triệu/m²
Pháp lý: Sổ hồng sở hữu lâu dài
Tiến độ: Đang hoàn thiện bàn giao quý 4
Chính sách: Vay 70% lãi suất 0% trong 24 tháng
Điểm nhấn: Kiến trúc mặt đứng xanh 3D lớn nhất Việt Nam"
            className="w-full text-xs font-mono p-3.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 shadow-inner leading-relaxed bg-white"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 italic">
              Khi bấm lưu, các script Tự động (is_auto) của dự án sẽ tự động cập nhật nội dung mới.
            </span>
            <Button size="sm" variant="primary" onClick={handleSaveSummary} isLoading={isSavingSummary}>
              <Save className="h-4 w-4 mr-1.5" /> Lưu Tóm Tắt & Tự Điền
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. CÁC TRƯỜNG THÔNG TIN ĐÃ ĐƯỢC ĐIỀN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { label: 'Vị trí địa lý', value: knowledge?.location, unverified: knowledge?.location_unverified, source: knowledge?.location_source },
          { label: 'Loại hình phát triển', value: knowledge?.property_type, unverified: knowledge?.property_type_unverified, source: knowledge?.property_type_source },
          { label: 'Khung giá bán & thanh toán', value: knowledge?.price_range, unverified: knowledge?.price_range_unverified, source: knowledge?.price_range_source },
          { label: 'Hồ sơ pháp lý', value: knowledge?.legal, unverified: knowledge?.legal_unverified, source: knowledge?.legal_source },
          { label: 'Tiến độ xây dựng & Bàn giao', value: knowledge?.progress, unverified: knowledge?.progress_unverified, source: knowledge?.progress_source },
          { label: 'Chính sách ưu đãi & Ngân hàng', value: knowledge?.policy, unverified: knowledge?.policy_unverified, source: knowledge?.policy_source },
          { label: 'Điểm nhấn độc quyền (Highlights)', value: knowledge?.highlights, unverified: knowledge?.highlights_unverified, source: knowledge?.highlights_source },
        ].map((item, idx) => (
          <Card key={idx} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">{item.label}</span>
              {item.unverified && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-2.5 w-2.5" /> Chưa xác minh
                </span>
              )}
            </div>

            <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-h-[48px] flex items-center">
              {item.value ? (
                <span>
                  {item.value} {item.unverified ? <span className="text-amber-600 font-medium">(chưa xác minh)</span> : null}
                </span>
              ) : (
                <span className="text-slate-400 italic">Chưa có thông tin</span>
              )}
            </div>

            {item.source && (
              <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">Nguồn: {item.source}</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 4. CÂU HỎI THƯỜNG GẶP FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            Hỏi Đáp Trọng Tâm Dự Án (Project FAQ)
          </CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-blue-600">Q:</span> {faq.question}
              </div>
              <div className="text-slate-600 pl-4">
                <span className="font-semibold text-emerald-700">A:</span> {faq.answer}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 5. MODAL AI BỔ SUNG THÔNG TIN TỰ ĐỘNG (DRAFT & REVIEW) */}
      <Modal
        isOpen={enrichModalOpen}
        onClose={() => setEnrichModalOpen(false)}
        title="AI Tự Động Tìm Kiếm & Đề Xuất Thông Tin Dự Án"
        description="Ưu tiên nguồn chính thức từ chủ đầu tư và báo chính thống. Vui lòng đối chiếu trước khi áp dụng."
        maxWidth="xl"
      >
        {isEnriching ? (
          <div className="p-10 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-xs font-bold text-slate-800">AI đang quét dữ liệu chính thống cho dự án "{project.name}"...</p>
            <p className="text-[11px] text-slate-400 mt-1">Đang lọc bỏ các nguồn diễn đàn không đáng tin cậy.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Chọn các trường bạn muốn cập nhật. Trường trống mặc định được chọn, trường đã có dữ liệu sẽ không bị ghi đè nếu bạn không tick chọn.
            </p>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {proposals.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleSelectProposal(idx)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    item.selected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleSelectProposal(idx)}
                        className="rounded text-blue-600"
                      />
                      <span>{item.label}</span>
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Gắn cờ chưa kiểm chứng
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Giá trị hiện tại:</span>
                      <span className="text-slate-600">{item.currentValue || '(Trống)'}</span>
                    </div>
                    <div className="bg-blue-50/50 p-2 rounded border border-blue-100">
                      <span className="text-[10px] text-blue-700 font-bold block mb-0.5">AI đề xuất mới:</span>
                      <span className="text-slate-800 font-medium">{item.proposedValue}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    <span>Nguồn: {item.sourceUrl}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setEnrichModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" size="sm" onClick={handleApplyEnrichment}>
                Áp Dụng Các Trường Đã Chọn
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. MODAL CẤU HÌNH CHÍNH SÁCH HOA HỒNG DỰ ÁN TOÀN DIỆN */}
      <Modal
        isOpen={commissionModalOpen}
        onClose={() => setCommissionModalOpen(false)}
        title={`Chính Sách Hoa Hồng & Bậc Lũy Tiến: ${project.name}`}
        description="Cấu hình % CĐT chi trả, bậc lũy tiến, phân bổ vai trò, mốc ghi nhận và thời gian hiệu lực."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* TABS TRONG MODAL */}
          <div className="flex items-center gap-3 border-b border-slate-200">
            <button
              onClick={() => setModalTab('policy')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
                modalTab === 'policy'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Cấu Hình Chính Sách & Bậc Lũy Tiến
            </button>
            <button
              onClick={() => setModalTab('history')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                modalTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Lịch Sử Thay Đổi Chính Sách ({financialStats?.policies?.length || 1})
            </button>
          </div>

          {modalTab === 'policy' ? (
            <form onSubmit={handleSavePolicy} className="space-y-4">
              {/* PHẦN 1: TỶ LỆ CĐT & MỐC GHI NHẬN */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    % Hoa hồng Công ty nhận từ CĐT *
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    required
                    value={editCompanyRate}
                    onChange={(e) => setEditCompanyRate(Number(e.target.value))}
                    placeholder="Ví dụ: 3.5"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Tổng hoa hồng chủ đầu tư cam kết chi trả cho sàn.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mốc Đủ Điều Kiện Ghi Nhận Hoa Hồng *
                  </label>
                  <select
                    value={editMilestone}
                    onChange={(e) => setEditMilestone(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="first_installment">Đóng tiền Đợt 1 (Mặc định chuẩn thị trường)</option>
                    <option value="contract">Ký Hợp đồng mua bán (HĐMB)</option>
                    <option value="deposit">Đặt cọc thành công</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-0.5">Hoa hồng sẽ chuyển sang trạng thái "Thực nhận" khi đạt mốc này.</p>
                </div>
              </div>

              {/* PHẦN 2: THỜI GIAN HIỆU LỰC */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hiệu lực Từ Ngày *</label>
                  <Input
                    type="date"
                    required
                    value={editValidFrom}
                    onChange={(e) => setEditValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đến Ngày (Để trống nếu vô hạn)</label>
                  <Input
                    type="date"
                    value={editValidTo}
                    onChange={(e) => setEditValidTo(e.target.value)}
                  />
                </div>
              </div>

              {/* PHẦN 3: PHÂN BỔ TỶ LỆ HOA HỒNG THEO CẤP BẬC */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Tỷ Lệ Hoa Hồng Cơ Bản Theo Cấp Bậc / Vai Trò</span>
                  <span className="text-[10px] text-slate-500 font-normal">% trên giá trị giao dịch</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Sale Agent</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-amber-700"
                      value={editRoleRates.find(r => r.role === 'sale_agent')?.default_rate ?? 1.8}
                      onChange={(e) => handleUpdateRoleRate('sale_agent', Number(e.target.value))}
                    />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Team Leader</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-blue-700"
                      value={editRoleRates.find(r => r.role === 'team_leader')?.default_rate ?? 0.4}
                      onChange={(e) => handleUpdateRoleRate('team_leader', Number(e.target.value))}
                    />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Trưởng Phòng / GĐ Sàn</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-purple-700"
                      value={editRoleRates.find(r => r.role === 'sales_manager')?.default_rate ?? 0.3}
                      onChange={(e) => handleUpdateRoleRate('sales_manager', Number(e.target.value))}
                    />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-semibold text-slate-600 block mb-1">Tổng Giám Đốc</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white font-bold text-slate-800"
                      value={editRoleRates.find(r => r.role === 'director')?.default_rate ?? 0.2}
                      onChange={(e) => handleUpdateRoleRate('director', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN 4: BẬC HOA HỒNG LŨY TIẾN (TIERS) */}
              <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      Quy Chế Hoa Hồng Lũy Tiến Theo Bậc (Tiers)
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Cấu hình thưởng thêm % khi đạt mốc doanh số hoặc số lượng HĐMB chốt được.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="text-xs" onClick={handleAddTier}>
                    <Plus className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Thêm Bậc Mới
                  </Button>
                </div>

                <div className="overflow-x-auto border border-emerald-200 rounded-lg bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-50/70 text-slate-700 font-semibold border-b border-emerald-100">
                      <tr>
                        <th className="p-2">Loại Bậc</th>
                        <th className="p-2">Từ Mốc</th>
                        <th className="p-2">Đến Mốc</th>
                        <th className="p-2">% Thưởng Thêm</th>
                        <th className="p-2 text-center">Bật / Tắt</th>
                        <th className="p-2 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editTiers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">
                            Chưa có bậc hoa hồng lũy tiến nào. Bấm "Thêm Bậc Mới" để cấu hình.
                          </td>
                        </tr>
                      ) : (
                        editTiers.map((tier, idx) => (
                          <tr key={tier.id} className="hover:bg-slate-50">
                            <td className="p-2">
                              <select
                                value={tier.tier_type}
                                onChange={(e) => handleUpdateTierField(tier.id, 'tier_type', e.target.value)}
                                className="p-1 border border-slate-200 rounded bg-white text-[11px]"
                              >
                                <option value="contract_count">Số HĐMB (Căn)</option>
                                <option value="deal_value">Doanh Số (VNĐ)</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                className="w-20 p-1 border border-slate-200 rounded bg-white text-[11px] font-bold"
                                value={tier.min_threshold}
                                onChange={(e) => handleUpdateTierField(tier.id, 'min_threshold', Number(e.target.value))}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="Vượt mốc"
                                className="w-20 p-1 border border-slate-200 rounded bg-white text-[11px]"
                                value={tier.max_threshold ?? ''}
                                onChange={(e) => handleUpdateTierField(tier.id, 'max_threshold', e.target.value ? Number(e.target.value) : null)}
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <span className="text-emerald-700 font-bold">+</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-16 p-1 border border-slate-200 rounded bg-white text-[11px] font-black text-emerald-700"
                                  value={tier.bonus_rate}
                                  onChange={(e) => handleUpdateTierField(tier.id, 'bonus_rate', Number(e.target.value))}
                                />
                                <span className="text-[11px] text-slate-500">%</span>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleTier(tier.id)}
                                className="text-xs"
                              >
                                {tier.is_active ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Đang Bật
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                                    Đang Tắt
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(tier.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi Chú Phiên Bản Chính Sách</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ghi chú về phân kỳ áp dụng, điều khoản bổ sung từ CĐT..."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setCommissionModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSavingCommission}>
                  {isSavingCommission ? 'Đang lưu...' : 'Lưu & Kích Hoạt Phiên Bản Chính Sách Mới'}
                </Button>
              </div>
            </form>
          ) : (
            /* TAB LỊCH SỬ THAY ĐỔI CHÍNH SÁCH */
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {financialStats?.policies && financialStats.policies.length > 0 ? (
                financialStats.policies.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                      p.is_active ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Phiên bản {financialStats.policies.length - idx}</span>
                        {p.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Đang hiệu lực
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(p.valid_from).toLocaleDateString('vi-VN')} {p.valid_to ? `- ${new Date(p.valid_to).toLocaleDateString('vi-VN')}` : '(Không thời hạn)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg text-[11px]">
                      <div>Hoa hồng CĐT: <strong>{p.company_commission_rate}%</strong></div>
                      <div>Mốc ghi nhận: <strong>{p.recognition_milestone}</strong></div>
                      <div>Số bậc lũy tiến: <strong>{p.tiers?.length || 0} bậc</strong></div>
                    </div>

                    {p.notes && <p className="text-[11px] text-slate-500 italic">{p.notes}</p>}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400">Chưa có lịch sử thay đổi chính sách nào.</div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
