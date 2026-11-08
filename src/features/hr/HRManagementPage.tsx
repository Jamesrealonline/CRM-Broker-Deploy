// ========================================================
// REAL ESTATE CRM - COMPREHENSIVE HR LIFECYCLE MANAGEMENT (MODULE 5)
// Cơ Cấu Tổ Chức & Quản Trị Nhân Sự Vòng Đời:
// Tuyển dụng (ATS) -> Nhận việc -> Hồ sơ 360° -> Đào tạo -> 
// Hiệu suất & Chỉ tiêu -> Nghỉ phép -> Điều chuyển / Thăng giáng -> 
// Kỷ luật & Khen thưởng -> Nghỉ việc (Offboarding)
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  UserCheck, 
  Briefcase, 
  Award, 
  ShieldAlert, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  ArrowRightLeft, 
  Search, 
  Plus, 
  Filter, 
  Eye, 
  Lock, 
  Unlock, 
  Download, 
  FileCheck, 
  TrendingUp, 
  TrendingDown, 
  GraduationCap, 
  UserPlus, 
  Layers, 
  Check, 
  X,
  ExternalLink,
  Shield,
  HelpCircle
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { hrRepository, EmployeeFilters } from '@/data/repositories/hrRepository';
import { teamRepository } from '@/data/repositories/teamRepository';
import { 
  UserProfile, 
  EmployeeRecord, 
  BrokerCertificate, 
  LeaveRequest, 
  PersonnelTransferRequest, 
  JobRequisition, 
  Candidate, 
  CoachingNote,
  DisciplinaryRecord,
  OnboardingTask,
  Agency,
  Team,
  UserRole
} from '@/domain/types';
import { USER_ROLES } from '@/domain/constants';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

type HRTab = 'employees' | 'inbox' | 'recruitment' | 'leave' | 'transfers' | 'reports';

export const HRManagementPage: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as HRTab) || 'employees';
  const initialUserId = searchParams.get('userId');

  const [activeTab, setActiveTab] = useState<HRTab>(initialTab);
  const [loading, setLoading] = useState(true);

  // Data lists
  const [employees, setEmployees] = useState<Array<UserProfile & { record?: EmployeeRecord }>>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  // Filters
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('table');

  // Drawer 360 State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialUserId);
  const [employee360Data, setEmployee360Data] = useState<any | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<
    'overview' | 'contracts' | 'certificates' | 'performance' | 'training' | 'leave' | 'coaching' | 'discipline' | 'events'
  >('overview');

  // Reveal Private Modal State
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [revealField, setRevealField] = useState<'id_card_number' | 'tax_id' | 'bank_account_number'>('id_card_number');
  const [revealReason, setRevealReason] = useState('');
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealError, setRevealError] = useState('');

  // Inbox & Actions
  const [pendingTransfers, setPendingTransfers] = useState<PersonnelTransferRequest[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Transfer Request Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    userId: '',
    requestType: 'transfer' as 'transfer' | 'promotion' | 'demotion' | 'title_change',
    toAgencyId: '',
    toTeamId: '',
    toRole: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  // Leave Request Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: 'lt-1',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    totalDays: 1,
    reason: '',
  });

  // Recruitment ATS States
  const [requisitions, setRequisitions] = useState<JobRequisition[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newCandidateModalOpen, setNewCandidateModalOpen] = useState(false);
  const [candidateForm, setCandidateForm] = useState({
    requisitionId: '',
    fullName: '',
    phone: '',
    email: '',
    source: 'Tuyển dụng trực tiếp',
    notes: '',
  });
  const [hireCandidateModalOpen, setHireCandidateModalOpen] = useState(false);
  const [selectedCandidateToHire, setSelectedCandidateToHire] = useState<Candidate | null>(null);
  const [hireAccountForm, setHireAccountForm] = useState({
    email: '',
    agency_id: '',
    team_id: '',
    role: 'sale_agent' as UserRole,
  });

  // Load initial data
  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [empList, agList, tmList, mtr, trList, lvList, reqList, cndList] = await Promise.all([
        hrRepository.getEmployees({
          agencyId: selectedAgency,
          teamId: selectedTeam,
          role: selectedRole,
          status: selectedStatus,
          search: searchTerm,
        }, currentUser),
        teamRepository.getAgencies(),
        teamRepository.getTeams(),
        hrRepository.getHRMetrics(undefined, currentUser),
        hrRepository.getTransferRequests(currentUser),
        hrRepository.getLeaveRequests(currentUser),
        hrRepository.getJobRequisitions(),
        hrRepository.getCandidates(),
      ]);

      setEmployees(empList);
      setAgencies(agList);
      setTeams(tmList);
      setMetrics(mtr);
      setPendingTransfers(trList.filter(t => t.status === 'pending'));
      setPendingLeaves(lvList.filter(l => l.status === 'pending'));
      setRequisitions(reqList);
      setCandidates(cndList);
    } catch (err) {
      console.error('Error loading HR data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, selectedAgency, selectedTeam, selectedRole, selectedStatus, searchTerm]);

  // Load 360 profile when selectedEmployeeId changes
  useEffect(() => {
    if (!selectedEmployeeId || !currentUser) {
      setEmployee360Data(null);
      return;
    }
    setLoading360(true);
    hrRepository.getEmployee360Profile(selectedEmployeeId, currentUser)
      .then(setEmployee360Data)
      .catch(console.error)
      .finally(() => setLoading360(false));
  }, [selectedEmployeeId, currentUser]);

  const handleOpen360 = (userId: string) => {
    setSelectedEmployeeId(userId);
    setRevealedValue(null);
    setRevealError('');
  };

  const handleClose360 = () => {
    setSelectedEmployeeId(null);
    setEmployee360Data(null);
    setRevealedValue(null);
  };

  const handleRevealPrivate = async () => {
    if (!selectedEmployeeId || !currentUser) return;
    setRevealError('');
    try {
      const res = await hrRepository.revealPrivateField(selectedEmployeeId, revealField, revealReason, currentUser);
      setRevealedValue(res.value);
    } catch (err: any) {
      setRevealError(err.message || 'Lỗi tra cứu thông tin bảo mật');
    }
  };

  // Handle Approve Transfer
  const handleApproveTransfer = async (requestId: string) => {
    if (!currentUser) return;
    try {
      await hrRepository.applyPersonnelTransfer(requestId, currentUser);
      setActionSuccessMsg('Đã phê duyệt và thực hiện điều chuyển nhân sự thành công!');
      loadData();
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Lỗi phê duyệt điều chuyển');
    }
  };

  // Handle Approve Leave
  const handleApproveLeave = async (requestId: string, approved: boolean) => {
    if (!currentUser) return;
    try {
      await hrRepository.approveLeaveRequest(requestId, approved, undefined, currentUser);
      setActionSuccessMsg(`Đã ${approved ? 'duyệt' : 'từ chối'} đơn nghỉ phép thành công!`);
      loadData();
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Lỗi phê duyệt nghỉ phép');
    }
  };

  // Handle Atomic Hire Candidate
  const handleExecuteAtomicHire = async () => {
    if (!selectedCandidateToHire || !currentUser) return;
    try {
      const res = await hrRepository.atomicHireCandidate(
        selectedCandidateToHire.id,
        {
          email: hireAccountForm.email,
          full_name: selectedCandidateToHire.full_name,
          phone: selectedCandidateToHire.phone,
          role: hireAccountForm.role,
          agency_id: hireAccountForm.agency_id || undefined,
          team_id: hireAccountForm.team_id || undefined,
        },
        currentUser
      );

      setActionSuccessMsg(`Tuyển dụng thành công! Đã tạo tài khoản CRM, mã nhân sự ${res.employeeRecord.employee_code} và phân bổ checklist nhận việc.`);
      setHireCandidateModalOpen(false);
      setSelectedCandidateToHire(null);
      loadData();
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Lỗi tuyển dụng ứng viên');
    }
  };

  const isHrOrAdmin = currentUser && ['admin', 'director', 'hr_admin', 'sales_manager'].includes(currentUser.role);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              Phân Hệ Quản Trị Nhân Sự & Cơ Cấu
            </span>
            <span className="text-xs text-slate-500 font-mono">Module 5</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Quản Trị Vòng Đời Nhân Sự 360°
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cơ cấu cây tổ chức, tuyển dụng ATS, hồ sơ bảo mật, chứng chỉ môi giới, nghỉ phép và điều chuyển
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isHrOrAdmin && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLeaveModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>Đơn Nghỉ Phép</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setTransferModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                <span>Đề Xuất Điều Chuyển</span>
              </Button>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => setNewCandidateModalOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Thêm Ứng Viên ATS</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 2. KPI METRICS CARDS */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-3 bg-white border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Tổng Nhân Sự</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.headcount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Toàn hệ thống CRM</div>
          </Card>
          <Card className="p-3 bg-white border-slate-200">
            <div className="text-xs text-emerald-700 font-medium">Lao Động Chính Thức</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{metrics.officialCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hợp đồng dài hạn</div>
          </Card>
          <Card className="p-3 bg-white border-slate-200">
            <div className="text-xs text-amber-700 font-medium">Đang Thử Việc</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{metrics.probationCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Lộ trình 60 ngày</div>
          </Card>
          <Card className="p-3 bg-white border-slate-200">
            <div className="text-xs text-blue-700 font-medium">CTV & Đại Lý</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{metrics.collaboratorCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hợp đồng dịch vụ</div>
          </Card>
          <Card className="p-3 bg-white border-amber-200 bg-amber-50/40">
            <div className="text-xs text-amber-800 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Chứng Chỉ Sắp Hết Hạn</span>
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{metrics.expiringCertsCount}</div>
            <div className="text-[11px] text-amber-600/80 mt-0.5">Cảnh báo 90/30/7 ngày</div>
          </Card>
          <Card className="p-3 bg-white border-rose-200 bg-rose-50/40">
            <div className="text-xs text-rose-800 font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-rose-600" />
              <span>Việc Cần Duyệt</span>
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-1">
              {metrics.pendingTransfersCount + metrics.pendingLeavesCount}
            </div>
            <div className="text-[11px] text-rose-600/80 mt-0.5">Phép & Điều chuyển</div>
          </Card>
        </div>
      )}

      {/* 3. TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'employees'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Cơ Cấu & Danh Sách Nhân Sự</span>
        </button>

        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors relative ${
            activeTab === 'inbox'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Hộp Việc Cần Xử Lý</span>
          {(metrics?.pendingTransfersCount > 0 || metrics?.pendingLeavesCount > 0) && (
            <span className="h-5 px-1.5 rounded-full text-[11px] bg-rose-500 text-white font-bold flex items-center justify-center">
              {metrics.pendingTransfersCount + metrics.pendingLeavesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('recruitment')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'recruitment'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          <span>Tuyển Dụng ATS & Onboarding</span>
          <Badge variant="outline" className="text-xs bg-slate-50">{candidates.length}</Badge>
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'leave'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Lịch Nghỉ Phép Nhóm</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'transfers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          <span>Lịch Sử Điều Chuyển & Thăng Giáng</span>
        </button>
      </div>

      {/* 4. TAB CONTENT 1: DANH SÁCH NHÂN SỰ & CÂY TỔ CHỨC */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, SĐT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={selectedAgency}
                onChange={(e) => setSelectedAgency(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="all">Tất cả Sàn Giao Dịch</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="all">Tất cả Đội Nhóm</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="all">Tất cả Vai Trò</option>
                {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Hiển thị {employees.length} nhân sự</span>
              <div className="flex items-center border border-slate-200 rounded p-0.5 bg-slate-50">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2 py-1 text-xs rounded font-medium ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  Bảng
                </button>
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-2 py-1 text-xs rounded font-medium ${viewMode === 'tree' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  Cây cấp bậc
                </button>
              </div>
            </div>
          </div>

          {/* VIEW: TABLE */}
          {viewMode === 'table' && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Mã & Nhân Sự</th>
                      <th className="p-3">Chức Danh / Vai Trò</th>
                      <th className="p-3">Sàn & Đội Nhóm</th>
                      <th className="p-3">Loại Hình</th>
                      <th className="p-3">Trạng Thái</th>
                      <th className="p-3">Ngày Vào</th>
                      <th className="p-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employees.map(emp => {
                      const agency = agencies.find(a => a.id === emp.agency_id);
                      const team = teams.find(t => t.id === emp.team_id);
                      const roleObj = USER_ROLES.find(r => r.value === emp.role);

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                                {emp.full_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer" onClick={() => handleOpen360(emp.id)}>
                                  {emp.full_name}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {emp.record?.employee_code || 'Chưa gán mã'} • {emp.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="font-medium text-slate-800">{emp.record?.title || roleObj?.label}</div>
                            <div className="text-[11px] text-slate-400">Level {emp.record?.level || 1}</div>
                          </td>

                          <td className="p-3">
                            <div className="font-medium text-slate-800">{agency?.name || 'Toàn hệ thống'}</div>
                            <div className="text-[11px] text-slate-400">{team?.name || 'Không thuộc team'}</div>
                          </td>

                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              emp.record?.employment_type === 'official' ? 'bg-emerald-100 text-emerald-800' :
                              emp.record?.employment_type === 'probation' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {emp.record?.employment_type === 'official' ? 'Chính thức' :
                               emp.record?.employment_type === 'probation' ? 'Thử việc' : 'Cộng tác viên'}
                            </span>
                          </td>

                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              emp.on_leave ? 'bg-purple-100 text-purple-800' :
                              emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${emp.on_leave ? 'bg-purple-600' : emp.status === 'active' ? 'bg-green-600' : 'bg-slate-400'}`}></span>
                              {emp.on_leave ? 'Đang nghỉ phép' : emp.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'}
                            </span>
                          </td>

                          <td className="p-3 font-mono text-[11px]">
                            {emp.record?.join_date ? formatDate(emp.record.join_date) : '---'}
                          </td>

                          <td className="p-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpen360(emp.id)}
                              className="text-xs h-7 px-2.5 font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              Hồ Sơ 360° →
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: TREE HIERARCHY */}
          {viewMode === 'tree' && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" />
                <span>Cây Phân Cấp Cơ Cấu Tổ Chức Bất Động Sản</span>
              </div>

              <div className="space-y-6 pl-2">
                {agencies.map(agency => {
                  const agencyDirector = employees.find(e => e.id === agency.director_id);
                  const agencyTeams = teams.filter(t => t.agency_id === agency.id);

                  return (
                    <div key={agency.id} className="border-l-2 border-indigo-500 pl-4 space-y-4">
                      {/* Agency Node */}
                      <div className="flex items-center gap-3 bg-indigo-50/70 p-3 rounded-lg border border-indigo-100">
                        <Building2 className="h-5 w-5 text-indigo-700" />
                        <div>
                          <div className="text-sm font-bold text-indigo-950">{agency.name} ({agency.code})</div>
                          <div className="text-xs text-indigo-700">
                            Giám đốc sàn: <span className="font-semibold">{agencyDirector ? agencyDirector.full_name : 'Chưa bổ nhiệm'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Teams under Agency */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                        {agencyTeams.map(team => {
                          const leader = employees.find(e => e.id === team.leader_id);
                          const members = employees.filter(e => e.team_id === team.id && e.id !== team.leader_id);

                          return (
                            <div key={team.id} className="border border-slate-200 rounded-lg p-3 bg-white space-y-2.5 shadow-sm">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-blue-600" />
                                  <span>{team.name}</span>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                                  {members.length + (leader ? 1 : 0)} nhân sự
                                </span>
                              </div>

                              {leader && (
                                <div 
                                  onClick={() => handleOpen360(leader.id)}
                                  className="p-2 bg-amber-50 rounded border border-amber-200/60 flex items-center justify-between cursor-pointer hover:bg-amber-100/60 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                                      TL
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-amber-950">{leader.full_name}</div>
                                      <div className="text-[10px] text-amber-700">Trưởng Nhóm</div>
                                    </div>
                                  </div>
                                  <ChevronRight className="h-3.5 w-3.5 text-amber-600" />
                                </div>
                              )}

                              <div className="space-y-1.5 pt-1">
                                {members.map(member => (
                                  <div 
                                    key={member.id}
                                    onClick={() => handleOpen360(member.id)}
                                    className="p-1.5 rounded hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer border border-transparent hover:border-slate-200"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-semibold">
                                        {member.full_name.charAt(0)}
                                      </div>
                                      <span className="text-slate-800 font-medium">{member.full_name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">{member.record?.employee_code}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB CONTENT 2: HỘP VIỆC CẦN XỬ LÝ (ACTION INBOX) */}
      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section: Đơn nghỉ phép chờ duyệt */}
          <Card className="p-5 border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>Đơn Nghỉ Phép Chờ Duyệt ({pendingLeaves.length})</span>
              </div>
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">Maker-Checker</Badge>
            </div>

            {pendingLeaves.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Không có đơn nghỉ phép nào đang chờ duyệt</div>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map(leave => (
                  <div key={leave.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">{leave.user_name}</span>
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        {leave.total_days} ngày phép
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Từ <span className="font-mono font-medium">{formatDate(leave.start_date)}</span> đến <span className="font-mono font-medium">{formatDate(leave.end_date)}</span>
                    </div>
                    <div className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                      "{leave.reason}"
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproveLeave(leave.id, false)}
                        className="text-xs h-7 text-rose-600 hover:bg-rose-50"
                      >
                        Từ chối
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleApproveLeave(leave.id, true)}
                        className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                      >
                        Phê duyệt nghỉ
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Section: Yêu cầu điều chuyển / thăng giáng chờ duyệt */}
          <Card className="p-5 border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                <span>Yêu Cầu Điều Chuyển Chờ Duyệt ({pendingTransfers.length})</span>
              </div>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Quản lý cấp trên</Badge>
            </div>

            {pendingTransfers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Không có yêu cầu điều chuyển nào đang chờ duyệt</div>
            ) : (
              <div className="space-y-3">
                {pendingTransfers.map(tr => (
                  <div key={tr.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">{tr.user_name}</span>
                      <span className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded capitalize">
                        {tr.request_type === 'promotion' ? 'Thăng chức' : tr.request_type === 'demotion' ? 'Giáng chức' : 'Điều chuyển'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 flex items-center gap-1.5">
                      <span>{tr.from_team_name || 'Team cũ'}</span>
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                      <span className="font-semibold text-indigo-700">{tr.to_team_name || 'Team mới'}</span>
                    </div>

                    <div className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                      Lý do: "{tr.reason}"
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Người đề xuất: <span className="font-medium text-slate-600">{tr.requested_by_name}</span> • Hiệu lực: <span className="font-mono">{formatDate(tr.effective_date)}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleApproveTransfer(tr.id)}
                        className="text-xs h-7 bg-blue-600 hover:bg-blue-700"
                      >
                        Phê duyệt & Áp dụng
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 6. TAB CONTENT 3: TUYỂN DỤNG ATS & ONBOARDING */}
      {activeTab === 'recruitment' && (
        <div className="space-y-6">
          {/* Requisitions bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                <span>Nhu Cầu Tuyển Dụng Đang Mở (Job Requisitions)</span>
              </div>
              <Button size="sm" variant="outline" className="text-xs">
                + Tạo Nhu Cầu Tuyển
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {requisitions.map(req => (
                <div key={req.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/70 space-y-1.5">
                  <div className="font-semibold text-slate-800 text-xs">{req.title}</div>
                  <div className="text-[11px] text-slate-500">{req.agency_name} • {req.team_name}</div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-600 font-mono">Đã tuyển: {req.hired_count}/{req.target_count}</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">Đang tuyển</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kanban Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['applied', 'interview', 'offer', 'hired'] as const).map(stage => {
              const stageCandidates = candidates.filter(c => c.stage === stage);
              const stageTitles = {
                applied: 'Nhận Hồ Sơ / Sơ Loại',
                interview: 'Phỏng Vấn',
                offer: 'Đề Nghị Nhận Việc (Offer)',
                hired: 'Đã Tuyển Thành Nhân Sự',
              };

              return (
                <div key={stage} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-xs text-slate-800">{stageTitles[stage]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                      {stageCandidates.length}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {stageCandidates.map(cand => (
                      <div key={cand.id} className="bg-white p-3 border border-slate-200 rounded-md shadow-sm space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">{cand.full_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{cand.phone}</div>
                          </div>
                          {cand.is_rehire && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-100 text-purple-800">
                              Tuyển Lại
                            </span>
                          )}
                        </div>

                        {cand.notes && (
                          <div className="text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded">
                            "{cand.notes}"
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-400 font-medium">Nguồn: {cand.source}</span>
                          {stage === 'offer' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setSelectedCandidateToHire(cand);
                                setHireAccountForm({
                                  email: cand.email || '',
                                  agency_id: agencies[0]?.id || '',
                                  team_id: teams[0]?.id || '',
                                  role: 'sale_agent',
                                });
                                setHireCandidateModalOpen(true);
                              }}
                              className="text-[11px] h-6 px-2 bg-indigo-600 hover:bg-indigo-700 font-bold"
                            >
                              Nhận Việc →
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT 4: QUẢN LÝ NGHỈ PHÉP */}
      {activeTab === 'leave' && (
        <Card className="p-5 bg-white border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="font-bold text-slate-900 text-sm">Lịch Nghỉ Phép Toàn Bộ Đội Ngũ</div>
              <div className="text-xs text-slate-500">Giúp Trưởng nhóm và Quản lý sàn chủ động điều phối trực dự án và tiếp nhận Lead</div>
            </div>
            <Button size="sm" variant="primary" onClick={() => setLeaveModalOpen(true)}>
              + Gửi Đơn Nghỉ Phép Mới
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Nhân Sự</th>
                  <th className="p-3">Loại Phép</th>
                  <th className="p-3">Thời Gian Nghỉ</th>
                  <th className="p-3">Số Ngày</th>
                  <th className="p-3">Lý Do</th>
                  <th className="p-3">Trạng Thái</th>
                  <th className="p-3">Người Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingLeaves.map(req => (
                  <tr key={req.id}>
                    <td className="p-3 font-semibold text-slate-900">{req.user_name}</td>
                    <td className="p-3">{req.leave_type_name}</td>
                    <td className="p-3 font-mono">{formatDate(req.start_date)} - {formatDate(req.end_date)}</td>
                    <td className="p-3 font-bold text-slate-800">{req.total_days} ngày</td>
                    <td className="p-3 italic text-slate-500">{req.reason}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        Chờ duyệt
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">---</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 8. TAB CONTENT 5: LỊCH SỬ ĐIỀU CHUYỂN & THĂNG GIÁNG */}
      {activeTab === 'transfers' && (
        <Card className="p-5 bg-white border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="font-bold text-slate-900 text-sm">Nhật Ký & Yêu Cầu Điều Chuyển Tổ Chức (Audit Trail)</div>
              <div className="text-xs text-slate-500">Mọi thay đổi Sàn, Team, Cấp bậc đều được truy vết và lưu trữ bất biến (Append-only)</div>
            </div>
            <Button size="sm" variant="primary" onClick={() => setTransferModalOpen(true)}>
              + Tạo Yêu Cầu Điều Chuyển Mới
            </Button>
          </div>

          <div className="space-y-3">
            {pendingTransfers.map(tr => (
              <div key={tr.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{tr.user_name}</span>
                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 capitalize">
                      {tr.request_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                    <span>{tr.from_agency_name} ({tr.from_team_name})</span>
                    <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                    <span className="font-semibold text-indigo-700">{tr.to_agency_name} ({tr.to_team_name})</span>
                  </div>
                  <div className="text-xs text-slate-500 italic mt-1">Lý do: "{tr.reason}"</div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono text-slate-500">Ngày hiệu lực: {formatDate(tr.effective_date)}</div>
                  <div className="text-[11px] text-slate-400">Đề xuất bởi: {tr.requested_by_name}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ======================================================== */}
      {/* 9. DRAWER HỒ SƠ NHÂN SỰ 360 ĐỘ (9 TABS PHÂN QUYỀN) */}
      {/* ======================================================== */}
      {selectedEmployeeId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                  {employee360Data?.profile?.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="font-bold text-base flex items-center gap-2">
                    <span>{employee360Data?.profile?.full_name || 'Đang tải...'}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/30 text-indigo-300 font-mono">
                      {employee360Data?.record?.employee_code || '---'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {employee360Data?.record?.title || 'Chuyên viên tư vấn'} • {employee360Data?.profile?.email}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleClose360}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Tabs Bar */}
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 overflow-x-auto text-xs">
              {[
                { id: 'overview', label: 'Tổng quan' },
                { id: 'certificates', label: `Chứng chỉ BĐS (${employee360Data?.certificates?.length || 0})` },
                { id: 'contracts', label: 'Hợp đồng' },
                { id: 'training', label: 'Onboarding' },
                { id: 'leave', label: 'Phép' },
                { id: 'coaching', label: 'Coaching 1-1' },
                { id: 'events', label: 'Lịch sử' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDrawerTab(tab.id as any)}
                  className={`py-2.5 px-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeDrawerTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 font-bold bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {loading360 ? (
                <div className="py-12 text-center text-xs text-slate-400">Đang tải hồ sơ nhân sự 360°...</div>
              ) : employee360Data ? (
                <>
                  {/* TAB: TỔNG QUAN */}
                  {activeDrawerTab === 'overview' && (
                    <div className="space-y-4">
                      {/* Thẻ Dữ liệu nhạy cảm (CCCD, Thuế, Ngân hàng) */}
                      <Card className="p-4 border-slate-200 bg-slate-50/70 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <Shield className="h-4 w-4 text-indigo-600" />
                            <span>Thông Tin Định Danh & Bảo Mật Cá Nhân (Nghị định 13/2023)</span>
                          </div>
                          {employee360Data.hasPrivateAccess && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRevealReason('');
                                setRevealedValue(null);
                                setRevealModalOpen(true);
                              }}
                              className="text-[11px] h-6 px-2 text-indigo-600 hover:bg-indigo-50 font-medium"
                            >
                              <Unlock className="h-3 w-3 mr-1" />
                              Xem CCCD / MST / STK
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Số CCCD / CMND:</span>
                            <span className="font-mono font-medium text-slate-800">
                              {employee360Data.maskedPrivate?.id_card_number || 'Được bảo hộ'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Mã số thuế cá nhân:</span>
                            <span className="font-mono font-medium text-slate-800">
                              {employee360Data.maskedPrivate?.tax_id || 'Được bảo hộ'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Tài khoản ngân hàng:</span>
                            <span className="font-mono font-medium text-slate-800">
                              {employee360Data.maskedPrivate?.bank_account_number || 'Được bảo hộ'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Ngân hàng:</span>
                            <span className="font-medium text-slate-800">
                              {employee360Data.maskedPrivate?.bank_name || 'Chưa cập nhật'}
                            </span>
                          </div>
                        </div>
                      </Card>

                      {/* Công việc & Tuyển dụng */}
                      <Card className="p-4 border-slate-200 space-y-3">
                        <div className="font-bold text-xs text-slate-900 border-b border-slate-100 pb-2">
                          Thông Tin Công Việc & Thâm Niên
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Chức danh chính thức:</span>
                            <span className="font-semibold text-slate-800">{employee360Data.record?.title}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Loại hình nhân sự:</span>
                            <span className="capitalize font-medium text-slate-800">{employee360Data.record?.employment_type}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Ngày bắt đầu nhận việc:</span>
                            <span className="font-mono text-slate-800">{employee360Data.record?.join_date}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Hạn kết thúc thử việc:</span>
                            <span className="font-mono text-slate-800">{employee360Data.record?.probation_end_date || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Nguồn tuyển dụng:</span>
                            <span className="text-slate-800">{employee360Data.record?.recruitment_source || 'Trực tiếp'}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* TAB: CHỨNG CHỈ MÔI GIỚI */}
                  {activeDrawerTab === 'certificates' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Chứng Chỉ Hành Nghề Môi Giới BĐS (Luật BĐS 2023)</span>
                      </div>

                      {employee360Data.certificates?.length === 0 ? (
                        <div className="p-4 border border-dashed border-amber-300 rounded-lg bg-amber-50 text-amber-800 text-xs">
                          Nhân sự này chưa nộp chứng chỉ hành nghề môi giới BĐS. Vui lòng bổ sung để đảm bảo tuân thủ pháp lý.
                        </div>
                      ) : (
                        employee360Data.certificates.map((cert: BrokerCertificate) => (
                          <div key={cert.id} className="p-3 border border-slate-200 rounded-lg bg-white space-y-2 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">{cert.certificate_number}</span>
                              <Badge variant="outline" className={`text-[10px] ${
                                cert.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {cert.status === 'active' ? 'Còn hiệu lực' : 'Sắp hết hạn'}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-600">Nơi cấp: {cert.issuing_authority}</div>
                            <div className="text-xs font-mono text-slate-500">
                              Ngày cấp: {formatDate(cert.issue_date)} • Hạn hiệu lực: <span className="font-bold text-slate-800">{formatDate(cert.expiry_date)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB: ONBOARDING CHECKLIST */}
                  {activeDrawerTab === 'training' && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-800">Checklist Tiếp Nhận & Hội Nhập Tân Binh</div>
                      <div className="space-y-2">
                        {employee360Data.onboardingTasks?.map((task: OnboardingTask) => (
                          <div key={task.id} className="p-3 border border-slate-200 rounded-lg bg-white flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <input type="checkbox" checked={task.is_completed} readOnly className="rounded text-indigo-600" />
                              <div>
                                <span className={`font-medium ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                  {task.title}
                                </span>
                                {task.due_date && (
                                  <div className="text-[10px] text-slate-400 font-mono">Hạn chót: {formatDate(task.due_date)}</div>
                                )}
                              </div>
                            </div>
                            {task.is_mandatory && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Bắt buộc</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB: COACHING 1-1 */}
                  {activeDrawerTab === 'coaching' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Nhật Ký Coaching 1-1 & Kèm Cặp</span>
                      </div>
                      <div className="space-y-2.5">
                        {employee360Data.coachingNotes?.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400">Chưa có buổi coaching nào được ghi nhận</div>
                        ) : (
                          employee360Data.coachingNotes.map((note: CoachingNote) => (
                            <div key={note.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">Người kèm cặp: {note.mentor_name}</span>
                                <span className="font-mono">{formatDate(note.note_date)}</span>
                              </div>
                              <div className="text-slate-800">{note.content}</div>
                              {note.action_items && (
                                <div className="text-[11px] text-indigo-700 bg-indigo-50 p-1.5 rounded">
                                  Hành động cần làm: {note.action_items}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB: LỊCH SỬ BIẾN ĐỘNG */}
                  {activeDrawerTab === 'events' && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-800">Lịch Sử Biến Động Nhân Sự (Append-Only Audit Trail)</div>
                      <div className="border-l-2 border-indigo-500 pl-3 space-y-3">
                        {employee360Data.events?.map((ev: any) => (
                          <div key={ev.id} className="text-xs space-y-1">
                            <div className="font-bold text-slate-900 capitalize flex items-center gap-2">
                              <span>{ev.event_type}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{formatDate(ev.effective_date)}</span>
                            </div>
                            <div className="text-slate-600">{ev.reason || 'Cập nhật hệ thống'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. MODAL TRA CỨU DỮ LIỆU BẢO MẬT (REVEAL DIALOG) */}
      {/* ======================================================== */}
      <Modal
        isOpen={revealModalOpen}
        onClose={() => setRevealModalOpen(false)}
        title="Mở Khóa Tra Cứu Dữ Liệu Nhân Sự Nhạy Cảm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Theo Nghị định 13/2023/NĐ-CP, việc truy cập số CCCD, Mã số thuế và Số tài khoản ngân hàng của nhân sự bắt buộc phải nêu rõ lý do nghiệp vụ và được ghi vết vào hệ thống Audit Log bất biến.
          </p>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Chọn trường cần tra cứu *</label>
            <select
              value={revealField}
              onChange={(e) => {
                setRevealField(e.target.value as any);
                setRevealedValue(null);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="id_card_number">Số Căn Cước Công Dân (CCCD / CMND)</option>
              <option value="tax_id">Mã Số Thuế Cá Nhân (MST)</option>
              <option value="bank_account_number">Số Tài Khoản Ngân Hàng</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Lý do nghiệp vụ (Bắt buộc) *</label>
            <textarea
              rows={2}
              placeholder="VD: Quyết toán thuế TNCN cuối năm, Đăng ký BHXH..."
              value={revealReason}
              onChange={(e) => setRevealReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {revealError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
              {revealError}
            </div>
          )}

          {revealedValue && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-mono text-sm font-bold flex items-center justify-between">
              <span>{revealedValue}</span>
              <span className="text-[10px] text-emerald-700 font-sans font-normal">Đã ghi nhận Audit</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setRevealModalOpen(false)}>
              Đóng
            </Button>
            <Button variant="primary" size="sm" onClick={handleRevealPrivate} className="bg-indigo-600 hover:bg-indigo-700">
              Xác Nhận & Tra Cứu
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* 11. MODAL ĐỀ XUẤT ĐIỀU CHUYỂN / THĂNG GIÁNG */}
      {/* ======================================================== */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Khởi Tạo Yêu Cầu Điều Chuyển / Thăng Giáng Nhân Sự"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Nhân sự thực hiện *</label>
            <select
              value={transferForm.userId}
              onChange={(e) => setTransferForm({ ...transferForm, userId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">-- Chọn nhân sự --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.record?.employee_code})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Loại yêu cầu *</label>
              <select
                value={transferForm.requestType}
                onChange={(e) => setTransferForm({ ...transferForm, requestType: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="transfer">Điều chuyển Đội Nhóm / Sàn</option>
                <option value="promotion">Thăng chức (Promotion)</option>
                <option value="demotion">Giáng chức (Demotion)</option>
                <option value="title_change">Đổi chức danh chuyên môn</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Ngày hiệu lực *</label>
              <input
                type="date"
                value={transferForm.effectiveDate}
                onChange={(e) => setTransferForm({ ...transferForm, effectiveDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Chuyển đến Sàn</label>
              <select
                value={transferForm.toAgencyId}
                onChange={(e) => setTransferForm({ ...transferForm, toAgencyId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Giữ nguyên Sàn --</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Chuyển đến Team</label>
              <select
                value={transferForm.toTeamId}
                onChange={(e) => setTransferForm({ ...transferForm, toTeamId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Chọn Team mới --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Lý do điều chuyển *</label>
            <textarea
              rows={2}
              placeholder="Nêu rõ lý do và kế hoạch bàn giao giỏ lead..."
              value={transferForm.reason}
              onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setTransferModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!transferForm.userId || !transferForm.reason}
              onClick={async () => {
                if (!currentUser) return;
                try {
                  await hrRepository.createTransferRequest({
                    userId: transferForm.userId,
                    requestType: transferForm.requestType,
                    toAgencyId: transferForm.toAgencyId || undefined,
                    toTeamId: transferForm.toTeamId || undefined,
                    effectiveDate: transferForm.effectiveDate,
                    reason: transferForm.reason,
                    currentUser,
                  });
                  setTransferModalOpen(false);
                  loadData();
                  setActionSuccessMsg('Đã tạo đề xuất điều chuyển thành công, chuyển cấp trên phê duyệt!');
                } catch (err: any) {
                  alert(err.message || 'Lỗi tạo đề xuất');
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Gửi Phê Duyệt
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* 12. MODAL TUYỂN DỤNG THÀNH NHÂN SỰ (ATOMIC HIRE) */}
      {/* ======================================================== */}
      <Modal
        isOpen={hireCandidateModalOpen}
        onClose={() => setHireCandidateModalOpen(false)}
        title="Quyết Định Nhận Việc & Kích Hoạt Nhân Sự Mới"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-900">
            Ứng viên: <span className="font-bold">{selectedCandidateToHire?.full_name}</span> • SĐT: <span className="font-mono">{selectedCandidateToHire?.phone}</span>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Email công việc (dùng đăng nhập CRM) *</label>
            <input
              type="email"
              value={hireAccountForm.email}
              onChange={(e) => setHireAccountForm({ ...hireAccountForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Phân bổ Sàn Giao Dịch *</label>
              <select
                value={hireAccountForm.agency_id}
                onChange={(e) => setHireAccountForm({ ...hireAccountForm, agency_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Phân bổ Đội Nhóm *</label>
              <select
                value={hireAccountForm.team_id}
                onChange={(e) => setHireAccountForm({ ...hireAccountForm, team_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px] space-y-1">
            <div className="font-semibold text-slate-800">Thao tác Atomic bao gồm:</div>
            <div>• Tái sử dụng luồng tạo tài khoản của /admin, bắt buộc đổi mật khẩu lần đầu</div>
            <div>• Tạo hồ sơ nhân sự, mã nhân viên tự động và hạn thử việc 60 ngày</div>
            <div>• Giao checklist nhận việc (Onboarding Tasks) và ghi vết sự kiện "hired"</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setHireCandidateModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteAtomicHire}
              className="bg-indigo-600 hover:bg-indigo-700 font-bold"
            >
              Kích Hoạt Nhân Sự & Gán Checklist
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* 13. MODAL GỬI ĐƠN NGHỈ PHÉP */}
      {/* ======================================================== */}
      <Modal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Gửi Đơn Xin Nghỉ Phép"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Từ ngày *</label>
              <input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Đến hết ngày *</label>
              <input
                type="date"
                value={leaveForm.endDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Số ngày nghỉ dự kiến *</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={leaveForm.totalDays}
              onChange={(e) => setLeaveForm({ ...leaveForm, totalDays: parseFloat(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Lý do nghỉ phép *</label>
            <textarea
              rows={2}
              placeholder="Nêu lý do và người thay thế hỗ trợ lead (nếu có)..."
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setLeaveModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!leaveForm.reason}
              onClick={async () => {
                if (!currentUser) return;
                try {
                  await hrRepository.createLeaveRequest({
                    ...leaveForm,
                    currentUser,
                  });
                  setLeaveModalOpen(false);
                  loadData();
                  setActionSuccessMsg('Đã gửi đơn xin nghỉ phép thành công, đang chờ quản lý duyệt!');
                } catch (err: any) {
                  alert(err.message || 'Lỗi gửi đơn nghỉ phép');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Gửi Đơn Xin Nghỉ
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* 14. MODAL THÊM ỨNG VIÊN TUYỂN DỤNG ATS MỚI */}
      {/* ======================================================== */}
      <Modal
        isOpen={newCandidateModalOpen}
        onClose={() => setNewCandidateModalOpen(false)}
        title="Thêm Ứng Viên Tuyển Dụng Mới (ATS)"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Họ và tên ứng viên *</label>
            <input
              type="text"
              placeholder="Nguyễn Văn A"
              value={candidateForm.fullName}
              onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Số điện thoại *</label>
              <input
                type="text"
                placeholder="0912345678"
                value={candidateForm.phone}
                onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Email</label>
              <input
                type="email"
                placeholder="ungvien@gmail.com"
                value={candidateForm.email}
                onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Nhu cầu tuyển dụng</label>
              <select
                value={candidateForm.requisitionId}
                onChange={(e) => setCandidateForm({ ...candidateForm, requisitionId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Tuyển ngoài đợt --</option>
                {requisitions.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Nguồn ứng viên</label>
              <select
                value={candidateForm.source}
                onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="Tuyển dụng trực tiếp">Tuyển dụng trực tiếp</option>
                <option value="Nội bộ giới thiệu">Nội bộ giới thiệu (Referral)</option>
                <option value="Facebook / LinkedIn">Facebook / LinkedIn</option>
                <option value="VietnamWorks / TopCV">VietnamWorks / TopCV</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Ghi chú ban đầu</label>
            <textarea
              rows={2}
              placeholder="Kinh nghiệm bán BĐS, kỹ năng giao tiếp..."
              value={candidateForm.notes}
              onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setNewCandidateModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!candidateForm.fullName || !candidateForm.phone}
              onClick={async () => {
                if (!currentUser) return;
                try {
                  const res = await hrRepository.createCandidate({
                    ...candidateForm,
                    currentUser,
                  });
                  setNewCandidateModalOpen(false);
                  loadData();
                  if (res.warning) {
                    alert(res.warning);
                  } else {
                    setActionSuccessMsg('Đã tiếp nhận hồ sơ ứng viên thành công!');
                  }
                } catch (err: any) {
                  alert(err.message || 'Lỗi thêm ứng viên');
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Tiếp Nhận Hồ Sơ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
