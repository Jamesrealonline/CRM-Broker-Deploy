// ========================================================
// REAL ESTATE CRM - TRANSACTIONS & CONTRACTS PAGE
// Module Quản lý Giao dịch & Hợp đồng khách hàng
// Cọc, Ký HĐMB, Đóng tiền Đợt 1, Giá trị giao dịch, Hoa hồng Sàn & Hoa hồng Sale
// ========================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ShieldCheck,
  Copy,
  Trash2,
  RotateCcw,
  Users,
  Coins,
  Eye,
  Layers,
  Percent
} from 'lucide-react';
import { contractRepository } from '@/data/repositories/contractRepository';
import { projectRepository } from '@/data/repositories/projectRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { commissionService } from '@/domain/services/commissionService';
import { 
  Transaction, 
  Project, 
  Lead, 
  ProjectUnit, 
  LeadSource, 
  Region, 
  Agency, 
  Team, 
  UserProfile, 
  Organization,
  CommissionBaseMode,
  TeamSplitMode,
  CommissionEntry
} from '@/domain/types';
import { useAuthStore } from '@/app/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDateRange } from '@/hooks/useDateRange';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { canViewFullPII, maskPhone } from '@/lib/masking';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { IncomeLedgerTab } from './IncomeLedgerTab';
import { ContractCommissionDetailModal } from './ContractCommissionDetailModal';

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

  // Bộ lọc phân cấp 4 cấp: Giám Đốc Vùng -> Giám Đốc Sàn -> Đội Nhóm -> Nhân Viên Sale
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allSales, setAllSales] = useState<UserProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);

  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedSaleId, setSelectedSaleId] = useState<string>('all');

  useEffect(() => {
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
      const filteredProfiles = branchHierarchyService.filterProfiles(currentUser, profs);
      setAllProfiles(filteredProfiles);
      const activeSales = filteredProfiles.filter(p => (p.role === 'sale_agent' || p.role === 'team_leader') && p.status === 'active');
      setAllSales(branchHierarchyService.filterSales(currentUser, activeSales));
    });
    teamRepository.getOrganizations(currentUser || undefined).then((orgs) => {
      setAllOrganizations(branchHierarchyService.filterOrganizations(currentUser, orgs));
    });
  }, [currentUser]);

  const visibleAgencies = useMemo(() => {
    if (selectedRegionId === 'all') return allAgencies;
    return allAgencies.filter(a => a.region_id === selectedRegionId);
  }, [allAgencies, selectedRegionId]);

  const visibleTeams = useMemo(() => {
    if (selectedAgencyId === 'all') {
      if (selectedRegionId === 'all') return allTeams;
      const agencyIds = new Set(visibleAgencies.map(a => a.id));
      return allTeams.filter(t => t.agency_id && agencyIds.has(t.agency_id));
    }
    return allTeams.filter(t => t.agency_id === selectedAgencyId);
  }, [allTeams, selectedAgencyId, selectedRegionId, visibleAgencies]);

  const visibleSales = useMemo(() => {
    if (selectedTeamId === 'all') {
      if (selectedAgencyId === 'all') {
        if (selectedRegionId === 'all') return allSales;
        const agencyIds = new Set(visibleAgencies.map(a => a.id));
        return allSales.filter(s => s.agency_id && agencyIds.has(s.agency_id));
      }
      return allSales.filter(s => s.agency_id === selectedAgencyId);
    }
    return allSales.filter(s => s.team_id === selectedTeamId);
  }, [allSales, selectedTeamId, selectedAgencyId, selectedRegionId, visibleAgencies]);

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
  const [teamLeaderRate, setTeamLeaderRate] = useState<number>(0.3);
  const [agencyDirectorRate, setAgencyDirectorRate] = useState<number>(0.2);
  const [regionalDirectorRate, setRegionalDirectorRate] = useState<number>(0.1);
  const [ceoRate, setCeoRate] = useState<number>(0.05);
  const [baseMode, setBaseMode] = useState<CommissionBaseMode>('contract_value');
  const [teamSplitMode, setTeamSplitMode] = useState<TeamSplitMode>('leader_only');
  const [withholdingRate, setWithholdingRate] = useState<number>(0);
  const [contractSaleId, setContractSaleId] = useState<string>('');
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

  // Bộ lọc thời gian & Dữ liệu mẫu
  const { dateRange, setPreset, setCustomRange, isComparingPrevious, setIsComparingPrevious } = useDateRange({
    storageKey: 'crm_date_range_transactions',
    defaultPreset: 'this_month',
  });
  const [includeSample, setIncludeSample] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Tab chính: Hợp đồng vs Sổ cái thu nhập 5 cấp bậc
  const [activeMainTab, setActiveMainTab] = useState<'contracts' | 'income'>('contracts');

  // Modal Chi tiết HĐMB & Sổ cái hoa hồng 5 tầng
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  const handleOpenDetailModal = (tx: Transaction) => {
    setDetailTx(tx);
    setDetailModalOpen(true);
  };

  const handleViewContractById = (contractId: string) => {
    const found = transactions.find(t => t.id === contractId);
    if (found) {
      setDetailTx(found);
      setDetailModalOpen(true);
    }
  };

  // Modal Xóa / Hủy hợp đồng có kiểm soát (Admin / Giám đốc Sàn)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Transaction | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txList, prjList] = await Promise.all([
        contractRepository.getTransactions({
          regionId: selectedRegionId === 'all' ? undefined : selectedRegionId,
          agencyId: selectedAgencyId === 'all' ? undefined : selectedAgencyId,
          teamId: selectedTeamId === 'all' ? undefined : selectedTeamId,
          saleId: selectedSaleId === 'all' ? undefined : selectedSaleId,
          projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
          type: selectedType === 'all' ? undefined : selectedType,
          search: searchQuery,
          includeSample: includeSample,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          currentUser: currentUser || undefined,
        }),
        projectRepository.getProjects(currentUser || undefined),
      ]);
      setTransactions(txList);
      setProjects(branchHierarchyService.filterProjects(currentUser, prjList));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, selectedRegionId, selectedAgencyId, selectedTeamId, selectedSaleId, selectedProjectId, selectedType, searchQuery, includeSample, dateRange.from, dateRange.to]);

  // Mở modal tạo hợp đồng mới và tải dữ liệu dự án & giỏ hàng
  const handleOpenCreateModal = async () => {
    setCurrentRequestId(crypto.randomUUID());
    setContractError(null);
    setDuplicatePhoneData(null);
    setPhoneWarning(null);

    let prjList = projects;
    if (prjList.length === 0) {
      const rawProjects = await projectRepository.getProjects(currentUser || undefined);
      prjList = branchHierarchyService.filterProjects(currentUser, rawProjects);
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

    const defaultSale = currentUser?.role === 'sale_agent' ? currentUser.id : (allSales[0]?.id || currentUser?.id || '');
    setContractSaleId(defaultSale);

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

  // Phân giải chuỗi nhân sự 5 cấp (Sale -> Trưởng phòng / Trưởng nhóm -> Giám đốc Sàn -> Giám đốc Vùng -> CEO)
  const contractSaleProfile = useMemo(() => {
    return allProfiles.find(p => p.id === contractSaleId) || 
           allSales.find(s => s.id === contractSaleId) || 
           (contractSaleId === currentUser?.id ? currentUser : null);
  }, [allProfiles, allSales, contractSaleId, currentUser]);

  const contractHierarchy = useMemo(() => {
    const sale = contractSaleProfile;
    const team = allTeams.find(t => t.id === sale?.team_id);
    const agency = allAgencies.find(a => a.id === (team?.agency_id || sale?.agency_id));
    const region = allRegions.find(r => r.id === (agency?.region_id || sale?.region_id));
    const org = allOrganizations.find(o => o.id === (region?.organization_id || agency?.organization_id || sale?.organization_id)) || allOrganizations[0];

    // Trưởng phòng / Trưởng nhóm:
    const teamLeader = team?.leader_id ? allProfiles.find(p => p.id === team.leader_id) : null;
    const teamLeaderName = team?.leader_name || teamLeader?.full_name || (team ? `Trưởng nhóm (${team.name})` : 'Chưa phân nhóm');

    // Giám đốc Sàn:
    const agencyDirector = agency?.director_id ? allProfiles.find(p => p.id === agency.director_id) : null;
    const agencyDirectorName = agency?.director_name || agencyDirector?.full_name || (agency ? `GĐ Sàn (${agency.name})` : 'Chưa phân sàn');

    // Giám đốc Vùng:
    const regionalDirector = region?.regional_director_id ? allProfiles.find(p => p.id === region.regional_director_id) : null;
    const regionalDirectorName = region?.regional_director_name || regionalDirector?.full_name || (region ? `GĐ Vùng (${region.name})` : 'Chưa phân vùng');

    // CEO:
    const ceoProfile = allProfiles.find(p => p.role === 'ceo' && (!org || p.organization_id === org.id));
    const ceoName = org?.ceo_name || ceoProfile?.full_name || 'Tổng Giám Đốc';

    return {
      saleId: sale?.id || currentUser?.id || '',
      saleName: sale?.full_name || currentUser?.full_name || 'Chuyên viên tư vấn',
      teamId: team?.id,
      teamName: team?.name || 'Chưa phân nhóm',
      teamLeaderId: team?.leader_id,
      teamLeaderName,
      salesManagerId: team?.department_id,
      salesManagerName: teamLeaderName,
      agencyId: agency?.id,
      agencyName: agency?.name || 'Chưa phân sàn',
      agencyDirectorId: agency?.director_id,
      agencyDirectorName,
      regionId: region?.id,
      regionName: region?.name || 'Chưa phân vùng',
      regionalDirectorId: region?.regional_director_id,
      regionalDirectorName,
      ceoId: org?.ceo_id || ceoProfile?.id,
      ceoName,
      organizationId: org?.id,
    };
  }, [contractSaleProfile, allTeams, allAgencies, allRegions, allOrganizations, allProfiles, currentUser]);

  // Tính toán trước hoa hồng 5 tầng theo thời gian thực (Live Preview)
  const liveCommissionPreview = useMemo(() => {
    return commissionService.calculateCommission({
      dealValue: dealValue,
      projectCommissionRate: commissionRate,
      tiers: {
        sale: saleCommissionRate,
        team: teamLeaderRate,
        agency_director: agencyDirectorRate,
        regional_director: regionalDirectorRate,
        ceo: ceoRate,
      },
      baseMode: baseMode,
      teamSplitMode: teamSplitMode,
      withholdingRate: withholdingRate,
      chain: {
        sale: { id: contractHierarchy.saleId, name: contractHierarchy.saleName },
        team: { 
          id: contractHierarchy.teamId, 
          name: contractHierarchy.teamName, 
          leaderId: contractHierarchy.teamLeaderId, 
          leaderName: contractHierarchy.teamLeaderName 
        },
        agencyDirector: { 
          id: contractHierarchy.agencyDirectorId, 
          name: contractHierarchy.agencyDirectorName, 
          agencyId: contractHierarchy.agencyId, 
          agencyName: contractHierarchy.agencyName 
        },
        regionalDirector: { 
          id: contractHierarchy.regionalDirectorId, 
          name: contractHierarchy.regionalDirectorName, 
          regionId: contractHierarchy.regionId, 
          regionName: contractHierarchy.regionName 
        },
        ceo: { 
          id: contractHierarchy.ceoId, 
          name: contractHierarchy.ceoName, 
          organizationId: contractHierarchy.organizationId 
        },
      },
    });
  }, [
    dealValue,
    commissionRate,
    saleCommissionRate,
    teamLeaderRate,
    agencyDirectorRate,
    regionalDirectorRate,
    ceoRate,
    baseMode,
    teamSplitMode,
    withholdingRate,
    contractHierarchy,
  ]);

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
    if (liveCommissionPreview.isExceedsPool) {
      setContractError(`Lỗi vượt quỹ hoa hồng: Tổng tỷ lệ các tầng (${liveCommissionPreview.totalDistributedRate}%) vượt quá % Hoa hồng Sàn (${liveCommissionPreview.agencyCommissionRate}%). Công ty giữ lại bị âm (${liveCommissionPreview.companyRetainedRate}%). Vui lòng điều chỉnh lại tỷ lệ các cấp.`);
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
        assignedTo: contractHierarchy.saleId,

        // Chuỗi nhân sự đầy đủ (Sale -> Trưởng phòng / Trưởng nhóm -> Giám đốc Sàn -> Giám đốc Vùng -> CEO)
        saleId: contractHierarchy.saleId,
        saleName: contractHierarchy.saleName,
        teamId: contractHierarchy.teamId,
        teamName: contractHierarchy.teamName,
        teamLeaderId: contractHierarchy.teamLeaderId,
        teamLeaderName: contractHierarchy.teamLeaderName,
        salesManagerId: contractHierarchy.salesManagerId,
        salesManagerName: contractHierarchy.salesManagerName,
        agencyId: contractHierarchy.agencyId,
        agencyName: contractHierarchy.agencyName,
        agencyDirectorId: contractHierarchy.agencyDirectorId,
        agencyDirectorName: contractHierarchy.agencyDirectorName,
        regionId: contractHierarchy.regionId,
        regionName: contractHierarchy.regionName,
        regionalDirectorId: contractHierarchy.regionalDirectorId,
        regionalDirectorName: contractHierarchy.regionalDirectorName,
        ceoId: contractHierarchy.ceoId,
        ceoName: contractHierarchy.ceoName,
        organizationId: contractHierarchy.organizationId,

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
        teamLeaderRate: teamLeaderRate,
        agencyDirectorRate: agencyDirectorRate,
        regionalDirectorRate: regionalDirectorRate,
        ceoRate: ceoRate,
        baseMode: baseMode,
        teamSplitMode: teamSplitMode,
        withholdingRate: withholdingRate,
        notes: notes.trim() || undefined,

        currentUser: currentUser,
        requestId: currentRequestId,
      });

      // Cập nhật trạng thái giỏ hàng
      if (createProjectId && unitCode) {
        await projectRepository.updateUnitStatusByCode(createProjectId, unitCode, 'deposit', {
          customer_name: customerMode === 'new' ? newCustName : candidateLeads.find(l => l.id === selectedLeadId)?.customer_name,
          sale_name: contractHierarchy.saleName,
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

  const handleConfirmDelete = async () => {
    if (!contractToDelete || !currentUser) return;
    if (!deleteReason.trim()) {
      setDeleteError('Vui lòng nhập lý do hủy/xóa hợp đồng.');
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await controlledDataService.softDeleteContract(
        contractToDelete.id,
        deleteReason.trim(),
        currentUser,
        { forceCancelApproved: true }
      );
      setDeleteModalOpen(false);
      setContractToDelete(null);
      await loadData();
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      setDeleteError(err.message || 'Lỗi khi xóa hợp đồng.');
    } finally {
      setIsDeleting(false);
    }
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

      {/* 0. TAB CHUYỂN ĐỔI CHÍNH: HỢP ĐỒNG vs SỔ CÁI HOA HỒNG 5 TẦNG */}
      <div className="flex items-center gap-2 bg-slate-100/90 p-1.5 rounded-xl w-fit border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveMainTab('contracts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeMainTab === 'contracts'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <FileCheck className="h-4 w-4" />
          <span>Danh Sách Hợp Đồng ({transactions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('income')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeMainTab === 'income'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Coins className="h-4 w-4" />
          <span>Thu Nhập & Sổ Cái Hoa Hồng 5 Tầng</span>
        </button>
      </div>

      {activeMainTab === 'income' ? (
        currentUser && (
          <IncomeLedgerTab
            currentUser={currentUser}
            allUsers={allProfiles}
            projects={projects}
            regions={allRegions}
            agencies={allAgencies}
            teams={allTeams}
            dateRange={dateRange}
            setPreset={setPreset}
            setCustomRange={setCustomRange}
            onViewContract={handleViewContractById}
          />
        )
      ) : (
        <>
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

      {/* 2.5 DATE RANGE & SAMPLE DATA BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <DateRangeFilter
          value={dateRange}
          onPresetChange={setPreset}
          onCustomRangeChange={setCustomRange}
          isComparingPrevious={isComparingPrevious}
          onCompareToggle={setIsComparingPrevious}
          className="w-full sm:w-auto"
        />

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={includeSample}
              onChange={(e) => setIncludeSample(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
            />
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span>Hiện dữ liệu mẫu</span>
          </label>
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

          {/* Bộ lọc 4 cấp: Giám Đốc Vùng -> Giám Đốc Sàn -> Đội Nhóm -> Nhân Viên Sale */}
          {allRegions.length > 0 && (
            <select
              value={selectedRegionId}
              onChange={(e) => {
                setSelectedRegionId(e.target.value);
                setSelectedAgencyId('all');
                setSelectedTeamId('all');
                setSelectedSaleId('all');
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="all">Tất cả Vùng (GĐ Vùng)</option>
              {allRegions.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
              ))}
            </select>
          )}

          {visibleAgencies.length > 0 && (
            <select
              value={selectedAgencyId}
              onChange={(e) => {
                setSelectedAgencyId(e.target.value);
                setSelectedTeamId('all');
                setSelectedSaleId('all');
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="all">Tất cả Sàn (GĐ Sàn)</option>
              {visibleAgencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {visibleTeams.length > 0 && (
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setSelectedSaleId('all');
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="all">Tất cả Đội Nhóm</option>
              {visibleTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          {visibleSales.length > 0 && (
            <select
              value={selectedSaleId}
              onChange={(e) => setSelectedSaleId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="all">Tất cả Nhân Viên Sale</option>
              {visibleSales.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          )}

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
                  <th className="p-3">Tổng Chia 5 Tầng</th>
                  {currentUser && !['sale_agent', 'marketing_manager', 'hr_admin'].includes(currentUser.role) && (
                    <th className="p-3">Công Ty Giữ Lại</th>
                  )}
                  <th className="p-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-blue-50/30 transition-colors group">
                    {/* Mã GD & Căn */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-blue-900 group-hover:text-blue-700">
                          {tx.unit_code || 'Chưa định danh'}
                        </span>
                        {tx.is_sample && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <Sparkles className="h-2.5 w-2.5" /> Mẫu
                          </span>
                        )}
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
                      {(() => {
                        const isFull = canViewFullPII(currentUser, tx.agency_id);
                        const phoneText = isFull ? tx.customer_phone : maskPhone(tx.customer_phone || '');
                        return (
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{phoneText || '---'}</span>
                            {isFull && tx.customer_phone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(tx.customer_phone || '');
                                  setCopiedPhoneId(tx.id);
                                  setTimeout(() => setCopiedPhoneId(null), 1500);
                                }}
                                className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors ml-0.5"
                                title="Sao chép SĐT đầy đủ"
                              >
                                {copiedPhoneId === tx.id ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()}
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
                        Tỷ lệ CĐT: {tx.commission_rate ?? 3.5}%
                      </div>
                    </td>

                    {/* Tổng chia 5 tầng */}
                    <td className="p-3">
                      {(() => {
                        const totalShared = (tx.sale_commission_amount || 0) + 
                          (tx.team_commission_amount || 0) + 
                          (tx.director_commission_amount || 0) + 
                          (tx.regional_commission_amount || 0) + 
                          (tx.ceo_commission_amount || 0);
                        const displayTotal = totalShared > 0 
                          ? totalShared 
                          : Math.round((tx.deal_value || tx.amount) * 0.0215);
                        return (
                          <div>
                            <div className="font-bold text-amber-700">{formatFullVND(displayTotal)}</div>
                            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">5 Cấp thụ hưởng</div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Công ty giữ lại */}
                    {currentUser && !['sale_agent', 'marketing_manager', 'hr_admin'].includes(currentUser.role) && (
                      <td className="p-3">
                        {(() => {
                          const agencyComm = tx.commission_amount || Math.round((tx.deal_value || tx.amount) * 0.035);
                          const totalShared = (tx.sale_commission_amount || 0) + 
                            (tx.team_commission_amount || 0) + 
                            (tx.director_commission_amount || 0) + 
                            (tx.regional_commission_amount || 0) + 
                            (tx.ceo_commission_amount || 0);
                          const retained = tx.company_retained_amount !== undefined 
                            ? tx.company_retained_amount 
                            : Math.max(0, agencyComm - (totalShared > 0 ? totalShared : Math.round((tx.deal_value || tx.amount) * 0.0215)));
                          return (
                            <div>
                              <div className="font-bold text-indigo-700">{formatFullVND(retained)}</div>
                              <div className="text-[10px] text-indigo-600 font-medium">Lợi nhuận gộp</div>
                            </div>
                          );
                        })()}
                      </td>
                    )}

                    {/* Thao tác */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenDetailModal(tx)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Xem sổ cái hoa hồng 5 tầng"
                        >
                          <Coins className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenUpdateModal(tx)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Cập nhật tiến độ / Ghi chú"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {(currentUser?.role === 'admin' || currentUser?.role === 'director') && (
                          <button
                            onClick={() => {
                              setContractToDelete(tx);
                              setDeleteReason('');
                              setDeleteError(null);
                              setDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hủy / Xóa HĐ vào thùng rác (Có kiểm soát)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

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

          {/* 3. CHUYÊN VIÊN TƯ VẤN (SALE) & CHUỖI PHÂN CẤP QUẢN LÝ (TRƯỞNG PHÒNG, GĐ SÀN, GĐ VÙNG, CEO) */}
          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-indigo-600" /> 3. Chuyên Viên Bán Hàng & Chuỗi Phân Cấp Quản Lý *
              </label>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                Chuỗi Snapshot Bất Biến
              </span>
            </div>

            {/* Chọn Chuyên Viên Sale */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Chuyên viên tư vấn (Sale phụ trách giao dịch) *
              </label>
              {currentUser?.role === 'sale_agent' ? (
                <div className="flex items-center justify-between px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800">
                  <span className="font-bold text-indigo-900">{currentUser.full_name} ({currentUser.email})</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">Tài khoản hiện tại</span>
                </div>
              ) : (
                <select
                  value={contractSaleId}
                  onChange={(e) => setContractSaleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                >
                  {allSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.role === 'team_leader' ? 'Trưởng nhóm' : 'Chuyên viên'}) - {allTeams.find(t => t.id === s.team_id)?.name || 'Chưa nhóm'}
                    </option>
                  ))}
                  {allSales.length === 0 && (
                    <option value={currentUser?.id}>{currentUser?.full_name} (Hiện tại)</option>
                  )}
                </select>
              )}
            </div>

            {/* Thẻ hiển thị trực quan chuỗi 5 cấp nhân sự */}
            <div className="p-3 bg-white rounded-lg border border-indigo-100 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Chuỗi nhân sự quản lý trực thuộc của giao dịch:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                {/* 1. Sale */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-0.5">
                    <User className="h-3 w-3 text-blue-600" /> 1. Chuyên Viên (Sale)
                  </div>
                  <div className="font-bold text-slate-900 truncate" title={contractHierarchy.saleName}>
                    {contractHierarchy.saleName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {contractHierarchy.teamName}
                  </div>
                </div>

                {/* 2. Trưởng nhóm / Trưởng phòng */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-0.5">
                    <Users className="h-3 w-3 text-indigo-600" /> 2. Trưởng Phòng / Nhóm
                  </div>
                  <div className="font-bold text-slate-900 truncate" title={contractHierarchy.teamLeaderName}>
                    {contractHierarchy.teamLeaderName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {contractHierarchy.teamName}
                  </div>
                </div>

                {/* 3. Giám đốc Sàn */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-0.5">
                    <Building2 className="h-3 w-3 text-purple-600" /> 3. Giám Đốc Sàn
                  </div>
                  <div className="font-bold text-slate-900 truncate" title={contractHierarchy.agencyDirectorName}>
                    {contractHierarchy.agencyDirectorName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {contractHierarchy.agencyName}
                  </div>
                </div>

                {/* 4. Giám đốc Vùng */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-0.5">
                    <MapPin className="h-3 w-3 text-amber-600" /> 4. Giám Đốc Vùng
                  </div>
                  <div className="font-bold text-slate-900 truncate" title={contractHierarchy.regionalDirectorName}>
                    {contractHierarchy.regionalDirectorName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {contractHierarchy.regionName}
                  </div>
                </div>

                {/* 5. Tổng Giám Đốc (CEO) */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-0.5">
                    <Award className="h-3 w-3 text-emerald-600" /> 5. Tổng Giám Đốc
                  </div>
                  <div className="font-bold text-slate-900 truncate" title={contractHierarchy.ceoName}>
                    {contractHierarchy.ceoName}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold truncate">
                    Điều hành chung
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. GIÁ TRỊ GIAO DỊCH & THÔNG TIN HỢP ĐỒNG */}
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

          {/* 5. CƠ CẤU PHÂN BỔ HOA HỒNG 5 TẦNG & LỢI NHUẬN CÔNG TY */}
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
              <div>
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-amber-600" /> 5. Phân Bổ Hoa Hồng 5 Tầng & Công Ty Giữ Lại *
                </label>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  Nguyên tắc: VND nguyên, phương pháp phần dư lớn nhất, không thất thoát lẻ.
                </div>
              </div>

              {/* Tùy chọn cấu hình tính toán */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={baseMode}
                  onChange={(e) => setBaseMode(e.target.value as any)}
                  className="text-[11px] h-7 px-2 bg-white border border-amber-300 rounded-md text-slate-700 font-medium"
                  title="Cơ sở tính toán"
                >
                  <option value="contract_value">Tính trên Giá Trị GD</option>
                  <option value="company_commission">Tính trên Hoa Hồng Sàn</option>
                </select>

                <select
                  value={withholdingRate}
                  onChange={(e) => setWithholdingRate(Number(e.target.value))}
                  className="text-[11px] h-7 px-2 bg-white border border-amber-300 rounded-md text-slate-700 font-medium"
                  title="Thuế TNCN tạm tính"
                >
                  <option value={0}>Thuế TNCN: 0%</option>
                  <option value={10}>Thuế TNCN: 10% (Tạm tính)</option>
                </select>
              </div>
            </div>

            {/* Quỹ Hoa Hồng Sàn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-white rounded-lg border border-amber-100">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  % Hoa hồng Sàn (CĐT chi trả) *
                </label>
                <Input
                  type="number"
                  step="0.05"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Tổng Quỹ Hoa Hồng Sàn</div>
                <div className="text-sm font-black text-emerald-700">
                  = {formatFullVND(liveCommissionPreview.agencyCommissionAmount)}
                </div>
              </div>
            </div>

            {/* Bảng phân bổ 5 tầng trực quan */}
            <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-amber-100/60 text-[10px] font-bold text-amber-950 uppercase border-b border-amber-200">
                  <tr>
                    <th className="p-2">Cấp Bậc Thụ Hưởng</th>
                    <th className="p-2">Người Nhận</th>
                    <th className="p-2 w-20 text-center">% Tỷ Lệ</th>
                    <th className="p-2 text-right">Số Tiền (Gross)</th>
                    <th className="p-2 text-right">Net Thực Nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {/* 1. Sale */}
                  {(() => {
                    const item = liveCommissionPreview.items.find(t => t.tier === 'sale');
                    const gross = item?.amount || 0;
                    const net = item?.net_payable_amount ?? gross;
                    return (
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold text-blue-900">1. Chuyên Viên (Sale)</td>
                        <td className="p-2 text-slate-700 truncate max-w-[120px]" title={contractHierarchy.saleName}>
                          {contractHierarchy.saleName}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="0.05"
                            value={saleCommissionRate}
                            onChange={(e) => setSaleCommissionRate(Number(e.target.value))}
                            className="w-full text-xs py-1 px-1.5 text-center font-bold border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatFullVND(gross)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">
                          {formatFullVND(net)}
                        </td>
                      </tr>
                    );
                  })()}

                  {/* 2. Nhóm */}
                  {(() => {
                    const item = liveCommissionPreview.items.find(t => t.tier === 'team');
                    const gross = item?.amount || 0;
                    const net = item?.net_payable_amount ?? gross;
                    return (
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold text-indigo-900">2. Nhóm / Trưởng Nhóm</td>
                        <td className="p-2 text-slate-700 truncate max-w-[120px]" title={contractHierarchy.teamLeaderName}>
                          {contractHierarchy.teamLeaderName || <span className="text-amber-600 italic">Chờ gán</span>}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="0.05"
                            value={teamLeaderRate}
                            onChange={(e) => setTeamLeaderRate(Number(e.target.value))}
                            className="w-full text-xs py-1 px-1.5 text-center font-bold border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatFullVND(gross)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">
                          {formatFullVND(net)}
                        </td>
                      </tr>
                    );
                  })()}

                  {/* 3. Giám đốc Sàn */}
                  {(() => {
                    const item = liveCommissionPreview.items.find(t => t.tier === 'agency_director');
                    const gross = item?.amount || 0;
                    const net = item?.net_payable_amount ?? gross;
                    return (
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold text-purple-900">3. Giám Đốc Sàn</td>
                        <td className="p-2 text-slate-700 truncate max-w-[120px]" title={contractHierarchy.agencyDirectorName}>
                          {contractHierarchy.agencyDirectorName || <span className="text-amber-600 italic">Chờ gán</span>}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="0.05"
                            value={agencyDirectorRate}
                            onChange={(e) => setAgencyDirectorRate(Number(e.target.value))}
                            className="w-full text-xs py-1 px-1.5 text-center font-bold border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatFullVND(gross)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">
                          {formatFullVND(net)}
                        </td>
                      </tr>
                    );
                  })()}

                  {/* 4. Giám đốc Vùng */}
                  {(() => {
                    const item = liveCommissionPreview.items.find(t => t.tier === 'regional_director');
                    const gross = item?.amount || 0;
                    const net = item?.net_payable_amount ?? gross;
                    return (
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold text-amber-900">4. Giám Đốc Vùng</td>
                        <td className="p-2 text-slate-700 truncate max-w-[120px]" title={contractHierarchy.regionalDirectorName}>
                          {contractHierarchy.regionalDirectorName || <span className="text-amber-600 italic">Chờ gán</span>}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="0.05"
                            value={regionalDirectorRate}
                            onChange={(e) => setRegionalDirectorRate(Number(e.target.value))}
                            className="w-full text-xs py-1 px-1.5 text-center font-bold border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatFullVND(gross)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">
                          {formatFullVND(net)}
                        </td>
                      </tr>
                    );
                  })()}

                  {/* 5. Tổng Giám Đốc (CEO) */}
                  {(() => {
                    const item = liveCommissionPreview.items.find(t => t.tier === 'ceo');
                    const gross = item?.amount || 0;
                    const net = item?.net_payable_amount ?? gross;
                    return (
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-2 font-bold text-emerald-900">5. Tổng Giám Đốc (CEO)</td>
                        <td className="p-2 text-slate-700 truncate max-w-[120px]" title={contractHierarchy.ceoName}>
                          {contractHierarchy.ceoName || <span className="text-amber-600 italic">Chờ gán</span>}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={ceoRate}
                            onChange={(e) => setCeoRate(Number(e.target.value))}
                            className="w-full text-xs py-1 px-1.5 text-center font-bold border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatFullVND(gross)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">
                          {formatFullVND(net)}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Dòng Tổng Kết & Công Ty Giữ Lại */}
            <div className="grid grid-cols-2 gap-3 p-2.5 bg-amber-100/50 rounded-lg border border-amber-200">
              <div>
                <div className="text-[10px] text-amber-900 font-bold uppercase">Tổng Chia 5 Tầng ({liveCommissionPreview.totalDistributedRate}%)</div>
                <div className="text-sm font-black text-amber-800">
                  {formatFullVND(liveCommissionPreview.totalDistributedAmount)}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-indigo-900 font-bold uppercase">Công Ty Giữ Lại ({liveCommissionPreview.companyRetainedRate}%)</div>
                <div className={`text-sm font-black ${liveCommissionPreview.isExceedsPool ? 'text-rose-600' : 'text-indigo-800'}`}>
                  {formatFullVND(liveCommissionPreview.companyRetainedAmount)}
                </div>
              </div>
            </div>

            {/* Cảnh báo vượt quỹ */}
            {liveCommissionPreview.isExceedsPool && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Cảnh báo vượt quỹ:</strong> Tổng % các cấp ({liveCommissionPreview.totalDistributedRate}%) vượt quá % Hoa hồng Sàn ({liveCommissionPreview.agencyCommissionRate}%). Vui lòng hạ tỷ lệ các cấp.
                </span>
              </div>
            )}
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

      {/* MODAL XÓA / HỦY HỢP ĐỒNG CÓ KIỂM SOÁT */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setContractToDelete(null);
          }
        }}
        title="Xóa / Hủy Hợp Đồng Có Kiểm Soát (Thùng Rác)"
        description="Chức năng dành riêng cho Admin và Giám đốc Sàn. Hợp đồng sẽ được chuyển vào Thùng rác, tự động hoàn nguyên bút toán hoa hồng và giải phóng căn."
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{deleteError}</span>
            </div>
          )}

          {contractToDelete && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div><strong>Mã hợp đồng:</strong> {contractToDelete.contract_code || contractToDelete.code}</div>
              <div><strong>Khách hàng:</strong> {contractToDelete.customer_name || 'Chưa định danh'}</div>
              <div><strong>Căn:</strong> {contractToDelete.unit_code || '---'} • <strong>Dự án:</strong> {contractToDelete.project_name}</div>
              <div><strong>Giá trị giao dịch:</strong> {formatFullVND(contractToDelete.deal_value || contractToDelete.amount)}</div>
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Cơ chế an toàn tự động:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Hợp đồng được chuyển vào Thùng rác (có thể khôi phục trong 30 ngày).</li>
                <li>Tự động tạo bút toán hoàn nguyên (reversal) hoa hồng để giữ cân đối sổ kế toán.</li>
                <li>Trạng thái căn hộ được giải phóng về giỏ hàng (nếu đang giữ chỗ/cọc).</li>
                <li>Ghi lại vết kiểm toán Audit Diff đầy đủ người thực hiện và lý do.</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do hủy / xóa hợp đồng *
            </label>
            <textarea
              rows={3}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Ví dụ: Khách hàng đổi ý hủy cọc theo thỏa thuận; Giao dịch tạo nhầm mã căn..."
              className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                setDeleteModalOpen(false);
                setContractToDelete(null);
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isDeleting || !deleteReason.trim()}
              onClick={handleConfirmDelete}
            >
              {isDeleting ? 'Đang chuyển vào Thùng rác...' : 'Xác Nhận Hủy / Chuyển Thùng Rác'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL CHI TIẾT HOA HỒNG 5 TẦNG */}
      <ContractCommissionDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        transaction={detailTx}
        onUpdated={loadData}
        allUsers={allProfiles}
      />
    </div>
  );
};
