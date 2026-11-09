// ========================================================
// REAL ESTATE CRM - TRANSACTIONS & CONTRACTS PAGE
// Module Quản lý Giao dịch & Hợp đồng khách hàng
// Cọc, Ký HĐMB, Đóng tiền Đợt 1, Giá trị giao dịch, Hoa hồng Sàn & Hoa hồng Sale
// ========================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  Edit2, 
  Home,
  Check,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  MapPin,
  Mail,
  CreditCard,
  X,
  ShieldCheck
} from 'lucide-react';
import { contractRepository } from '@/data/repositories/contractRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { Transaction, Project, Lead, ProjectUnit, LeadSource } from '@/domain/types';
import { useAuthStore } from '@/app/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

export const TransactionsPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const phoneDebounceTimer = useRef<NodeJS.Timeout | null>(null);

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
  const [currentRequestId, setCurrentRequestId] = useState<string>('');
  const [createProjectId, setCreateProjectId] = useState<string>('');
  const [projectUnits, setProjectUnits] = useState<ProjectUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [manualUnitInput, setManualUnitInput] = useState(false);
  const [propertyType, setPropertyType] = useState('Căn hộ 2PN (2WC)');
  const [candidateLeads, setCandidateLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
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
  const [receiptCode, setReceiptCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [commissionRate, setCommissionRate] = useState<number>(3.5);
  const [saleCommissionRate, setSaleCommissionRate] = useState<number>(1.5);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chế độ khách hàng: Chọn lead có sẵn hoặc Điền mới trực tiếp
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustIdCard, setNewCustIdCard] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustPurpose, setNewCustPurpose] = useState<'residence' | 'investment' | 'both' | 'undecided'>('investment');
  const [newCustBudgetMin, setNewCustBudgetMin] = useState('2500000000');
  const [newCustBudgetMax, setNewCustBudgetMax] = useState('4000000000');
  const [newCustConsent, setNewCustConsent] = useState(true);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [newCustSourceId, setNewCustSourceId] = useState('');
  const [newCustSourceDetail, setNewCustSourceDetail] = useState('');
  const [isAddingNewSource, setIsAddingNewSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [isCreatingSource, setIsCreatingSource] = useState(false);

  const [phoneCheckLoading, setPhoneCheckLoading] = useState(false);
  const [duplicatePhoneData, setDuplicatePhoneData] = useState<{
    isDuplicate: boolean;
    canUse: boolean;
    isProtected: boolean;
    message?: string;
    existingCustomer?: any;
    existingLead?: any;
  } | null>(null);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);

  // Toast thông báo thành công kèm link xem Lead
  const [successToast, setSuccessToast] = useState<{
    message: string;
    leadId: string;
    contractCode: string;
  } | null>(null);

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

  // Mở modal tạo hợp đồng mới và tải dữ liệu dự án & giỏ hàng
  const handleOpenCreateModal = async () => {
    setCurrentRequestId(crypto.randomUUID());
    setContractError(null);
    setDuplicatePhoneData(null);
    setPhoneWarning(null);

    let prjList = projects;
    if (prjList.length === 0) {
      prjList = await projectRepository.getProjects();
      setProjects(prjList);
    }

    const defaultProj = prjList[0];
    const defaultProjId = defaultProj?.id || '';
    setCreateProjectId(defaultProjId);
    if (defaultProj) {
      setCommissionRate(defaultProj.commission_rate ?? 3.5);
      setSaleCommissionRate(defaultProj.sale_commission_rate ?? 1.5);
    }

    // Tải giỏ hàng của dự án
    if (defaultProjId) {
      const units = await projectRepository.getProjectUnits(defaultProjId);
      setProjectUnits(units);
      const firstAvail = units.find(u => u.status === 'available');
      if (firstAvail) {
        setSelectedUnitId(firstAvail.id);
        setUnitCode(firstAvail.unit_code);
        setDealValue(firstAvail.price);
        setPropertyType(firstAvail.property_type);
        setFirstInstallmentAmount(Math.round(firstAvail.price * 0.1));
        setNewCustBudgetMin(String(Math.round(firstAvail.price * 0.9)));
        setNewCustBudgetMax(String(Math.round(firstAvail.price * 1.1)));
      } else {
        setSelectedUnitId('');
      }
    }

    if (currentUser) {
      const [res, sources] = await Promise.all([
        leadRepository.getLeads({ page: 1, pageSize: 100 }, currentUser),
        leadRepository.getLeadSources(),
      ]);
      setCandidateLeads(res.leads);
      setLeadSources(sources);
      if (sources.length > 0 && !newCustSourceId) {
        setNewCustSourceId(sources[0].id);
      }
      // Ưu tiên chọn lead thuộc dự án
      const matchingLead = res.leads.find(l => l.project_id === defaultProjId) || res.leads[0];
      if (matchingLead) {
        setSelectedLeadId(matchingLead.id);
      }
    }

    setCreateModalOpen(true);
  };

  // Kiểm tra trùng SĐT có debounce 400ms và bảo hộ Lead
  const handlePhoneChangeDebounced = (val: string) => {
    setNewCustPhone(val);
    setPhoneWarning(null);
    setDuplicatePhoneData(null);

    if (phoneDebounceTimer.current) {
      clearTimeout(phoneDebounceTimer.current);
    }

    const clean = val.replace(/[^0-9]/g, '');
    if (clean.length >= 9) {
      setPhoneCheckLoading(true);
      phoneDebounceTimer.current = setTimeout(async () => {
        try {
          const check = await leadRepository.checkCustomerPhoneProtection(val, currentUser || undefined, createProjectId);
          setDuplicatePhoneData(check);
          if (check.isDuplicate) {
            if (check.isProtected) {
              setPhoneWarning(check.message || 'Khách hàng đang được chăm sóc bởi chuyên viên khác.');
            } else {
              setPhoneWarning(`Khách hàng "${check.existingCustomer?.name || 'này'}" đã có trên hệ thống.`);
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setPhoneCheckLoading(false);
        }
      }, 400);
    }
  };

  // Chuyển sang khách hàng có sẵn khi bấm "Dùng khách này"
  const handleUseExistingCustomer = (leadId: string) => {
    setCustomerMode('existing');
    setSelectedLeadId(leadId);
    setDuplicatePhoneData(null);
    setPhoneWarning(null);
  };

  // Chuyển tab khách hàng và tự focus vào Họ tên nếu là khách mới
  const handleSwitchCustomerMode = (mode: 'existing' | 'new') => {
    setCustomerMode(mode);
    setContractError(null);
    if (mode === 'new') {
      setTimeout(() => {
        fullNameInputRef.current?.focus();
      }, 50);
    }
  };

  const handleAddNewSource = async () => {
    if (!newSourceName.trim()) return;
    setIsCreatingSource(true);
    try {
      const created = await leadRepository.createLeadSource(newSourceName.trim(), undefined, false);
      setLeadSources(prev => [...prev.filter(s => s.id !== created.id), created]);
      setNewCustSourceId(created.id);
      setNewSourceName('');
      setIsAddingNewSource(false);
    } catch (err: any) {
      alert(err.message || 'Không thể tạo nguồn lead mới');
    } finally {
      setIsCreatingSource(false);
    }
  };

  // Khi thay đổi Dự án trong modal tạo hợp đồng
  const handleProjectChange = async (projId: string) => {
    setCreateProjectId(projId);
    const p = projects.find(x => x.id === projId);
    if (p) {
      setCommissionRate(p.commission_rate ?? 3.5);
      setSaleCommissionRate(p.sale_commission_rate ?? 1.5);
    }

    // Tải giỏ hàng sản phẩm tương ứng với dự án mới
    const units = await projectRepository.getProjectUnits(projId);
    setProjectUnits(units);
    const firstAvail = units.find(u => u.status === 'available');
    if (firstAvail) {
      setSelectedUnitId(firstAvail.id);
      setUnitCode(firstAvail.unit_code);
      setDealValue(firstAvail.price);
      setPropertyType(firstAvail.property_type);
      setFirstInstallmentAmount(Math.round(firstAvail.price * 0.1));
    } else {
      setSelectedUnitId('');
      setUnitCode('');
    }

    // Chọn lead phù hợp với dự án mới
    const match = candidateLeads.find(l => l.project_id === projId);
    if (match) {
      setSelectedLeadId(match.id);
    }
  };

  // Khi chọn một sản phẩm từ Giỏ Hàng
  const handleUnitSelect = (uId: string) => {
    setSelectedUnitId(uId);
    const target = projectUnits.find(u => u.id === uId);
    if (target) {
      setUnitCode(target.unit_code);
      setDealValue(target.price);
      setPropertyType(target.property_type);
      setFirstInstallmentAmount(Math.round(target.price * 0.1));
    }
  };

  // Tính tự động hoa hồng khi đổi giá trị giao dịch hoặc %
  const calculatedAgencyCommission = Math.round(dealValue * (commissionRate / 100));
  const calculatedSaleCommission = Math.round(dealValue * (saleCommissionRate / 100));

  // Gợi ý hiển thị tiền tỷ / triệu
  const formatDealValueShortText = (val: number) => {
    if (!val || val <= 0) return '';
    if (val >= 1000000000) {
      const ty = (val / 1000000000).toFixed(2).replace(/\.00$/, '');
      return `≈ ${ty} tỷ VNĐ`;
    }
    if (val >= 1000000) {
      const tr = (val / 1000000).toFixed(0);
      return `≈ ${tr} triệu VNĐ`;
    }
    return '';
  };

  // Lưu hợp đồng trong transaction atomic
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setContractError(null);

    // 1. Validation
    if (customerMode === 'new') {
      if (!newCustName.trim()) {
        setContractError('Vui lòng nhập họ và tên khách hàng.');
        return;
      }
      if (!newCustPhone.trim()) {
        setContractError('Vui lòng nhập số điện thoại của khách hàng.');
        return;
      }
      if (duplicatePhoneData?.isProtected) {
        setContractError('Không thể tạo hợp đồng: Khách hàng đang được bảo hộ bởi chuyên viên khác.');
        return;
      }
      if (!newCustConsent) {
        setContractError('Bắt buộc xác nhận khách hàng đồng ý cho lưu và xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.');
        return;
      }
      const selectedSource = leadSources.find(s => s.id === newCustSourceId);
      if (selectedSource?.requires_detail && !newCustSourceDetail.trim()) {
        setContractError(`Nguồn "${selectedSource.name}" bắt buộc nhập chi tiết / người giới thiệu.`);
        return;
      }
    } else {
      if (!selectedLeadId) {
        setContractError('Vui lòng chọn khách hàng từ danh sách.');
        return;
      }
    }

    if (dealValue <= 0) {
      setContractError('Giá trị giao dịch phải lớn hơn 0.');
      return;
    }
    if (saleCommissionRate > commissionRate) {
      setContractError('Tỷ lệ hoa hồng cho Sale (%) không được vượt quá % hoa hồng của Sàn (%).');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedProj = projects.find(p => p.id === createProjectId);
      
      const res = await contractRepository.createContractWithCustomer({
        projectId: createProjectId,
        projectName: selectedProj?.name,
        unitCode: unitCode || 'CH-01',
        propertyType: propertyType,

        leadId: customerMode === 'existing' ? selectedLeadId : undefined,
        customerName: customerMode === 'new' ? newCustName.trim() : undefined,
        customerPhone: customerMode === 'new' ? newCustPhone.trim() : undefined,
        customerEmail: customerMode === 'new' ? newCustEmail.trim() || undefined : undefined,
        identityCard: customerMode === 'new' ? newCustIdCard.trim() || undefined : undefined,
        address: customerMode === 'new' ? newCustAddress.trim() || undefined : undefined,
        consentObtained: newCustConsent,
        purpose: newCustPurpose,
        budgetMin: Number(newCustBudgetMin) || Math.round(dealValue * 0.9),
        budgetMax: Number(newCustBudgetMax) || Math.round(dealValue * 1.1),

        sourceId: customerMode === 'new' ? newCustSourceId : undefined,
        sourceDetail: customerMode === 'new' ? newCustSourceDetail.trim() || undefined : undefined,
        assignedTo: currentUser.id,

        dealValue: dealValue,
        contractCode: contractCode.trim() || undefined,
        depositDate: depositDate,
        contractDate: contractDate,
        firstInstallmentAmount: firstInstallmentAmount,
        firstInstallmentDate: firstInstallmentDate,
        firstInstallmentPaid: firstInstallmentPaid,
        receiptCode: receiptCode.trim() || undefined,
        commissionRate: commissionRate,
        saleCommissionRate: saleCommissionRate,
        notes: notes.trim() || undefined,

        currentUser: currentUser,
        requestId: currentRequestId,
      });

      // Cập nhật trạng thái giỏ hàng
      if (createProjectId && unitCode) {
        await projectRepository.updateUnitStatusByCode(createProjectId, unitCode, 'deposit', {
          customer_name: customerMode === 'new' ? newCustName : candidateLeads.find(l => l.id === selectedLeadId)?.customer_name,
          sale_name: currentUser.full_name,
        });
      }

      // Invalidate queries in TanStack Query để đồng bộ toàn bộ giao diện
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['journey'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      setCreateModalOpen(false);

      // Hiển thị toast thành công kèm nút xem Lead
      setSuccessToast({
        message: `Khởi tạo hợp đồng ${res.contract_code} thành công! Hồ sơ đã được cập nhật vào danh sách Lead và hành trình bán hàng.`,
        leadId: res.lead_id,
        contractCode: res.contract_code,
      });

      // Reset form
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustIdCard('');
      setNewCustAddress('');
      setNewCustSourceDetail('');
      setNotes('');
      setDuplicatePhoneData(null);
      setPhoneWarning(null);

      await loadData();
    } catch (err: any) {
      setContractError(err.message || 'Lỗi khi khởi tạo hợp đồng giao dịch.');
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

  // Lọc leads cho tab Khách hàng có sẵn
  const filteredCandidateLeads = candidateLeads.filter(l => {
    if (!leadSearchQuery.trim()) return true;
    const q = leadSearchQuery.toLowerCase().trim();
    return (
      (l.customer_name && l.customer_name.toLowerCase().includes(q)) ||
      (l.customer_phone && l.customer_phone.includes(q)) ||
      (l.project_name && l.project_name.toLowerCase().includes(q))
    );
  });

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
      {/* TOAST THÀNH CÔNG KÈM NÚT XEM LEAD */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">{successToast.message}</h4>
              <p className="text-xs text-emerald-800 mt-0.5">Mã HĐMB: <strong>{successToast.contractCode}</strong> • Trạng thái: <strong>Chờ duyệt hoa hồng</strong></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-700 hover:bg-emerald-800 text-xs flex items-center gap-1.5 shadow-sm"
              onClick={() => navigate(`/leads/${successToast.leadId}`)}
            >
              <span>Xem Hồ Sơ Lead</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={() => setSuccessToast(null)}
              className="p-1.5 text-emerald-700 hover:text-emerald-900 rounded-lg hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
            <div className="text-[11px] font-semibold text-slate-500">Tổng Hoa Hồng Cho Sale</div>
            <div className="text-lg font-black text-amber-700">{formatVND(totalSaleComm)}</div>
            <div className="text-[10px] text-amber-600 font-medium">Đã bao gồm thưởng chỉ tiêu</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Đã Hoàn Thành Đợt 1</div>
            <div className="text-lg font-black text-indigo-900">
              {displayedTransactions.filter(t => t.first_installment_paid).length}
              <span className="text-xs text-slate-400 font-normal"> / {displayedTransactions.length}</span>
            </div>
            <div className="text-[10px] text-slate-400">Tiến độ thu tiền thực tế</div>
          </div>
        </div>
      </div>

      {/* 3. BỘ LỌC VÀ TÌM KIẾM */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã HĐMB, mã căn, khách, sale..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả dự án ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả loại giao dịch</option>
            <option value="contract">Hợp đồng mua bán (HĐMB)</option>
            <option value="deposit">Đặt cọc</option>
            <option value="booking">Booking giữ chỗ</option>
          </select>

          <select
            value={selectedPaidFilter}
            onChange={(e) => setSelectedPaidFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả tiến độ đợt 1</option>
            <option value="paid">Đã đóng tiền đợt 1</option>
            <option value="unpaid">Chưa đóng đợt 1</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 shrink-0 font-medium">
          Hiển thị <strong>{displayedTransactions.length}</strong> giao dịch
        </div>
      </div>

      {/* 4. BẢNG DANH SÁCH GIAO DỊCH */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">Chưa có hợp đồng nào phù hợp bộ lọc</p>
            <p className="text-xs mt-1">Bấm "Tạo Hợp Đồng Mới" để bắt đầu ghi nhận doanh số.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã GD / Căn</th>
                  <th className="p-3">Khách Hàng</th>
                  <th className="p-3">Dự Án</th>
                  <th className="p-3">Đặt Cọc</th>
                  <th className="p-3">Ký HĐMB</th>
                  <th className="p-3">Tiến Độ Đợt 1</th>
                  <th className="p-3">Giá Trị GD</th>
                  <th className="p-3">Hoa Hồng Sàn</th>
                  <th className="p-3">Hoa Hồng Sale</th>
                  <th className="p-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-blue-50/30 transition-colors group">
                    {/* Mã GD & Căn */}
                    <td className="p-3">
                      <div className="font-bold text-blue-900 group-hover:text-blue-700">
                        {tx.unit_code || 'Chưa định danh'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {tx.code}
                      </div>
                    </td>

                    {/* Khách hàng */}
                    <td className="p-3">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{tx.customer_name || 'Khách vãng lai'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{tx.customer_phone || '---'}</span>
                      </div>
                    </td>

                    {/* Dự án */}
                    <td className="p-3">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{tx.project_name || 'Dự án'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Sale: <span className="font-semibold text-slate-600">{tx.sale_name || 'Chưa giao'}</span>
                      </div>
                    </td>

                    {/* Đặt cọc */}
                    <td className="p-3">
                      <div className="font-semibold text-slate-700">
                        {formatFullVND(tx.type === 'deposit' ? tx.amount : (tx.deal_value ? Math.round(tx.deal_value * 0.03) : 100000000))}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
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
                    <td className="p-3 font-bold text-slate-900">
                      {formatFullVND(tx.deal_value || tx.amount)}
                    </td>

                    {/* Hoa hồng sàn */}
                    <td className="p-3">
                      <div className="font-bold text-emerald-700">
                        {formatFullVND(tx.commission_amount || Math.round((tx.deal_value || tx.amount) * 0.035))}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Tỷ lệ: {tx.sale_commission_rate ? `${(Number(tx.sale_commission_rate) + 2).toFixed(1)}%` : '3.5%'}
                      </div>
                    </td>

                    {/* Hoa hồng Sale */}
                    <td className="p-3">
                      <div className="font-bold text-amber-700">
                        {formatFullVND(tx.sale_commission_amount || Math.round((tx.deal_value || tx.amount) * 0.015))}
                      </div>
                      <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                        {tx.sale_commission_rate ?? 1.5}% GTGD
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
        description="Ghi nhận mốc Cọc, ký HĐMB, đóng tiền Đợt 1 và phân bổ hoa hồng CĐT & Sale trong 1 transaction an toàn."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateContract} className="space-y-4">
          {contractError && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{contractError}</div>
            </div>
          )}

          {/* 1. CHỌN DỰ ÁN & GIỎ HÀNG */}
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" /> 1. Dự Án Phân Phối & Giỏ Hàng *
              </label>
              <div className="text-[11px] text-blue-700 font-medium">
                CĐT trả: <strong>{commissionRate}%</strong> • Sale: <strong>{saleCommissionRate}%</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dự án *</label>
                <select
                  required
                  value={createProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) • Phí dự án: {p.commission_rate ?? 3.5}%
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <Home className="h-3.5 w-3.5 text-indigo-600" /> Căn hộ / Sản phẩm *
                  </label>
                  <button
                    type="button"
                    onClick={() => setManualUnitInput(!manualUnitInput)}
                    className="text-[10px] text-blue-600 hover:underline font-medium"
                  >
                    {manualUnitInput ? '← Chọn từ giỏ hàng' : 'Nhập tự do →'}
                  </button>
                </div>

                {!manualUnitInput ? (
                  <select
                    value={selectedUnitId}
                    onChange={(e) => handleUnitSelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                  >
                    <option value="">-- Chọn sản phẩm ({projectUnits.filter(u => u.status === 'available').length} căn trống) --</option>
                    {projectUnits.map((u) => (
                      <option key={u.id} value={u.id} disabled={u.status === 'sold' || u.status === 'locked'}>
                        {u.unit_code} - {u.property_type} ({new Intl.NumberFormat('vi-VN').format(u.price)} đ) [{u.status === 'available' ? 'Còn trống' : u.status}]
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    required
                    value={unitCode}
                    onChange={(e) => setUnitCode(e.target.value)}
                    placeholder="Ví dụ: OG-S7.02-15.08"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 2. CHỌN HOẶC ĐIỀN MỚI KHÁCH HÀNG (SEGMENTED CONTROL) */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <User className="h-4 w-4 text-indigo-600" /> 2. Thông Tin Khách Hàng & Nguồn Tiếp Nhận *
              </label>

              {/* Segmented Control */}
              <div className="inline-flex p-1 bg-slate-200/70 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => handleSwitchCustomerMode('existing')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    customerMode === 'existing'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Khách Hàng Có Sẵn
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchCustomerMode('new')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    customerMode === 'new'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  + Khách Hàng Mới
                </button>
              </div>
            </div>

            {/* TAB A: KHÁCH HÀNG CÓ SẴN */}
            {customerMode === 'existing' ? (
              <div className="space-y-2.5 animate-in fade-in duration-150">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={leadSearchQuery}
                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                    placeholder="Tìm nhanh theo tên, SĐT khách..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <select
                    required={customerMode === 'existing'}
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                  >
                    <option value="">-- Chọn khách hàng tiềm năng ({filteredCandidateLeads.length}) --</option>
                    {filteredCandidateLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.customer_name} ({l.customer_phone}) - Nguồn: {l.source_name || 'Hotline'} • {l.project_name || 'Dự án'}
                      </option>
                    ))}
                  </select>
                  {selectedLeadId && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-0.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Ghi nhận nguồn First-Touch: <strong>{candidateLeads.find(l => l.id === selectedLeadId)?.source_name || 'Hotline'}</strong> (Bảo lưu nguồn gốc tiếp nhận ban đầu).</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB B: KHÁCH HÀNG MỚI (ĐẦY ĐỦ THÔNG TIN & PHÁT HIỆN TRÙNG SĐT) */
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Banner Trùng SĐT */}
                {phoneWarning && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    duplicatePhoneData?.isProtected 
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      {duplicatePhoneData?.isProtected ? (
                        <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <span>{phoneWarning}</span>
                    </div>
                    {duplicatePhoneData?.canUse && duplicatePhoneData?.existingLead && (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => handleUseExistingCustomer(duplicatePhoneData.existingLead.id)}
                        className="text-[11px] bg-amber-700 hover:bg-amber-800 text-white shrink-0 h-7 px-2.5"
                      >
                        Dùng khách này →
                      </Button>
                    )}
                  </div>
                )}

                {/* Hàng 1: Họ tên & SĐT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Input
                      ref={fullNameInputRef}
                      label="Họ và tên khách hàng *"
                      required={customerMode === 'new'}
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="Ví dụ: Bùi Quốc Cường"
                    />
                  </div>
                  <div className="relative">
                    <Input
                      label="Số điện thoại *"
                      required={customerMode === 'new'}
                      value={newCustPhone}
                      onChange={(e) => handlePhoneChangeDebounced(e.target.value)}
                      placeholder="0914xxxxxx"
                    />
                    {phoneCheckLoading && (
                      <div className="absolute right-3 top-8 text-blue-600 animate-spin">
                        <Loader2 className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Hàng 2: Email & CCCD */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Email liên hệ"
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="khachhang@gmail.com"
                  />
                  <Input
                    label="Số CCCD / CMND"
                    value={newCustIdCard}
                    onChange={(e) => setNewCustIdCard(e.target.value)}
                    placeholder="07909000xxxx"
                  />
                </div>

                {/* Hàng 3: Địa chỉ & Loại BĐS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Địa chỉ thường trú / liên hệ"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="Quận 2, TP. Hồ Chí Minh"
                  />
                  <Input
                    label="Loại BĐS quan tâm"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    placeholder="Căn hộ 2PN, Shophouse..."
                  />
                </div>

                {/* Hàng 4: Mục đích & Nguồn Lead */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">Mục đích sở hữu</label>
                    <select
                      value={newCustPurpose}
                      onChange={(e) => setNewCustPurpose(e.target.value as any)}
                      className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="investment">Đầu tư sinh lời / Cho thuê</option>
                      <option value="residence">Mua để ở / an cư</option>
                      <option value="both">Cả hai mục đích</option>
                      <option value="undecided">Chưa xác định</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">Nguồn Lead *</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewSource(!isAddingNewSource)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {isAddingNewSource ? 'Chọn có sẵn' : '+ Thêm nguồn'}
                      </button>
                    </div>

                    {!isAddingNewSource ? (
                      <select
                        required={customerMode === 'new'}
                        value={newCustSourceId}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setIsAddingNewSource(true);
                          } else {
                            setNewCustSourceId(e.target.value);
                          }
                        }}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                      >
                        {leadSources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.requires_detail ? '(Cần chi tiết)' : ''}
                          </option>
                        ))}
                        <option value="__add_new__">+ Thêm nguồn mới...</option>
                      </select>
                    ) : (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newSourceName}
                          onChange={(e) => setNewSourceName(e.target.value)}
                          placeholder="Tên nguồn mới..."
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

                {/* Hàng 5: Chi tiết nguồn (nếu có hoặc nếu nguồn yêu cầu) */}
                <div>
                  <Input
                    label={`Chi tiết nguồn ${leadSources.find(s => s.id === newCustSourceId)?.requires_detail ? '(Bắt buộc: Tên người giới thiệu / Chiến dịch) *' : '(Tùy chọn: Chiến dịch, UTM, ghi chú)'}`}
                    value={newCustSourceDetail}
                    required={Boolean(leadSources.find(s => s.id === newCustSourceId)?.requires_detail)}
                    onChange={(e) => setNewCustSourceDetail(e.target.value)}
                    placeholder="Ví dụ: Anh Nam F1 giới thiệu, Chiến dịch Facebook Q4..."
                  />
                </div>

                {/* Checkbox Consent bảo mật dữ liệu */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1 p-2.5 bg-blue-50/50 rounded-lg border border-blue-200/60">
                  <input
                    type="checkbox"
                    checked={newCustConsent}
                    onChange={(e) => setNewCustConsent(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <span className="text-[11px] text-blue-900 leading-relaxed">
                    Xác nhận khách hàng đã đồng ý cho hệ thống lưu trữ và xử lý dữ liệu cá nhân (SĐT, Email, CCCD) theo đúng quy định tại <strong>Nghị định 13/2023/NĐ-CP</strong> về bảo vệ dữ liệu cá nhân.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* 3. GIÁ TRỊ GIAO DỊCH & THÔNG TIN HỢP ĐỒNG */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Giá Trị Giao Dịch (VNĐ) *</label>
                <span className="text-[11px] font-bold text-blue-600">
                  {formatDealValueShortText(dealValue)}
                </span>
              </div>
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

            {firstInstallmentPaid && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-200/60 animate-in fade-in duration-150">
                <Input
                  label="Mã phiếu thu đợt 1"
                  value={receiptCode}
                  onChange={(e) => setReceiptCode(e.target.value)}
                  placeholder="Ví dụ: PT-2026-001"
                />
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Hình thức thanh toán</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                    <option value="cash">Tiền mặt</option>
                    <option value="credit_card">Thẻ tín dụng / POS</option>
                  </select>
                </div>
              </div>
            )}
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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang khởi tạo hợp đồng...
                </span>
              ) : (
                'Lưu Hợp Đồng & Hoa Hồng'
              )}
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
