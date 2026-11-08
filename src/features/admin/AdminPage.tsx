// ========================================================
// REAL ESTATE CRM - ADMIN CONTROL CENTER
// Quản trị người dùng, Tạo User mới, Ma trận phân quyền, Cơ cấu Sàn/Team
// Bổ nhiệm Giám đốc sàn, Trưởng phòng kinh doanh (Sales Manager), Trưởng nhóm
// ========================================================

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  KeyRound, 
  Building2, 
  Sliders, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  RotateCcw, 
  UserPlus,
  Search,
  CheckCircle2, 
  AlertCircle,
  Mail,
  Phone,
  User,
  Shield,
  Plus,
  Briefcase,
  Award,
  Crown,
  ChevronRight,
  Edit,
  UserCheck,
  TrendingUp,
  Eye,
  EyeOff,
  Clock,
  Send,
  RefreshCw,
  Archive,
  HelpCircle,
  Key,
  ExternalLink,
  Sparkles,
  MessageSquare,
  Copy
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { AgencyPerformanceModal } from '@/components/AgencyPerformanceModal';
import { 
  teamRepository, 
  CreateUserInput, 
  CreateAgencyInput, 
  CreateTeamInput 
} from '@/data/repositories/teamRepository';
import { auditRepository } from '@/data/repositories/auditRepository';
import { autoTransferService, DEFAULT_AUTO_TRANSFER_CONFIG } from '@/domain/services/autoTransferService';
import { notificationService, DEFAULT_EMAIL_CONFIG } from '@/domain/services/notificationService';
import { 
  UserProfile, 
  Agency, 
  Team, 
  AuditLog, 
  UserRole,
  AutoTransferConfig,
  EmailNotificationConfig,
  NotificationLog,
  LeadStatus
} from '@/domain/types';
import { USER_ROLES, JOURNEY_STAGES } from '@/domain/constants';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export const AdminPage: React.FC = () => {
  const { currentUser, realUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'teams' | 'settings' | 'audit' | 'auto_transfer'>('users');

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Module 6 & 7: Auto-transfer & Email configs
  const [autoTransferConfig, setAutoTransferConfig] = useState<AutoTransferConfig>(DEFAULT_AUTO_TRANSFER_CONFIG);
  const [emailConfig, setEmailConfig] = useState<EmailNotificationConfig>(DEFAULT_EMAIL_CONFIG);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [isSavingAutoConfig, setIsSavingAutoConfig] = useState(false);
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);
  const [autoConfigSaved, setAutoConfigSaved] = useState(false);
  const [emailConfigSaved, setEmailConfigSaved] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'sent' | 'pending' | 'failed'>('all');

  // Test email states
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAppPassGuide, setShowAppPassGuide] = useState(false);
  const [copiedGasCode, setCopiedGasCode] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');

  // Modal: Create User
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const [newUser, setNewUser] = useState<CreateUserInput>({
    full_name: '',
    email: '',
    phone: '',
    role: 'sale_agent',
    agency_id: '',
    team_id: '',
    password: 'password123',
    must_change_password: true,
  });

  // Modal: Create Agency (Thêm Sàn Giao Dịch Mới)
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [newAgency, setNewAgency] = useState<CreateAgencyInput>({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    director_id: '',
  });

  // Modal: Create Team (Thêm Đội Nhóm Kinh Doanh Mới)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [newTeam, setNewTeam] = useState<CreateTeamInput>({
    name: '',
    code: '',
    agency_id: '',
    leader_id: '',
  });

  // Modal: Bổ nhiệm / Đổi chức vụ (Promotion / Re-assignment)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserProfile | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('sale_agent');

  // Modal: Hiệu suất Sàn Giao Dịch
  const [perfAgencyId, setPerfAgencyId] = useState<string | null>(null);
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [targetAgencyId, setTargetAgencyId] = useState<string>('');
  const [targetTeamId, setTargetTeamId] = useState<string>('');

  // Settings state
  const [maxLeads, setMaxLeads] = useState(30);
  const [autoReclaimHours, setAutoReclaimHours] = useState(48);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const reloadData = async () => {
    setLoading(true);
    const [uList, aList, tList, logs, aConfig, eConfig, nLogs] = await Promise.all([
      teamRepository.getProfiles(),
      teamRepository.getAgencies(),
      teamRepository.getTeams(),
      auditRepository.getAuditLogs(),
      autoTransferService.getConfig(),
      notificationService.getEmailConfig(),
      notificationService.getNotificationLogs(50),
    ]);
    setProfiles(uList);
    setAgencies(aList);
    setTeams(tList);
    setAuditLogs(logs);
    setAutoTransferConfig(aConfig);
    setEmailConfig(eConfig);
    setNotificationLogs(nLogs);
    setLoading(false);
  };

  const handleSaveAutoConfig = async () => {
    setIsSavingAutoConfig(true);
    await autoTransferService.saveConfig(autoTransferConfig);
    setIsSavingAutoConfig(false);
    setAutoConfigSaved(true);
    setTimeout(() => setAutoConfigSaved(false), 3000);
  };

  const handleSaveEmailConfig = async () => {
    setIsSavingEmailConfig(true);
    await notificationService.saveEmailConfig(emailConfig);
    setIsSavingEmailConfig(false);
    setEmailConfigSaved(true);
    setTimeout(() => setEmailConfigSaved(false), 3000);
  };

  const handleSendTestEmail = async () => {
    const target = testEmailAddress.trim() || currentUser?.email || '';
    if (!target) {
      setTestEmailResult({ success: false, message: 'Vui lòng nhập địa chỉ email nhận thư thử nghiệm.' });
      return;
    }
    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    // Chuẩn hóa cấu hình (trim URL và tự động đổi /dev thành /exec)
    const normalizedConfig = { ...emailConfig };
    if (normalizedConfig.google_apps_script_url) {
      let url = normalizedConfig.google_apps_script_url.trim();
      if (url.endsWith('/dev')) {
        url = url.replace(/\/dev$/, '/exec');
      }
      normalizedConfig.google_apps_script_url = url;
      setEmailConfig(normalizedConfig);
    }

    // Tự động lưu cấu hình email hiện tại trước khi test
    await notificationService.saveEmailConfig(normalizedConfig);

    const res = await notificationService.sendTestEmail(target, normalizedConfig);
    setIsSendingTestEmail(false);
    if (res.success) {
      setTestEmailResult({ 
        success: true, 
        message: `Đã gửi thành công email thử nghiệm đến ${target}! Hãy kiểm tra hộp thư đến (Inbox) hoặc Thư rác (Spam).` 
      });
      const logs = await notificationService.getNotificationLogs(50);
      setNotificationLogs(logs);
    } else {
      setTestEmailResult({ 
        success: false, 
        message: res.error || 'Gửi email thất bại. Vui lòng kiểm tra lại cấu hình tài khoản và Mật khẩu ứng dụng.' 
      });
    }
  };

  const handleRetryNotification = async (logId: string) => {
    setRetryingLogId(logId);
    await notificationService.retryNotification(logId);
    const updated = await notificationService.getNotificationLogs(50);
    setNotificationLogs(updated);
    setRetryingLogId(null);
  };

  useEffect(() => {
    reloadData();
  }, []);

  // 1. Xử lý tạo User mới
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const result = await teamRepository.createUser(newUser);
      if (result.success && result.profile) {
        setModalSuccess(`Đã tạo thành công tài khoản cho ${result.profile.full_name} (${result.profile.email})`);
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_create',
          { email: result.profile.email, role: result.profile.role }
        );
        await reloadData();
        setTimeout(() => {
          setIsCreateModalOpen(false);
          setModalSuccess(null);
          setNewUser({
            full_name: '',
            email: '',
            phone: '',
            role: 'sale_agent',
            agency_id: '',
            team_id: '',
            password: 'password123',
            must_change_password: true,
          });
        }, 1000);
      } else {
        setModalError(result.error || 'Không thể tạo người dùng. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi tạo người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Xử lý tạo Sàn Giao Dịch mới & Bổ nhiệm Giám đốc sàn
  const handleCreateAgencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      const result = await teamRepository.createAgency({
        ...newAgency,
        director_id: newAgency.director_id || null,
      });

      if (result.success && result.agency) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'agency_create',
          { agency_code: result.agency.code, agency_name: result.agency.name }
        );
        await reloadData();
        setIsAgencyModalOpen(false);
        setNewAgency({ name: '', code: '', address: '', phone: '', email: '', director_id: '' });
      } else {
        setModalError(result.error || 'Không thể tạo sàn giao dịch mới.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi tạo sàn giao dịch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Xử lý tạo Đội Nhóm Kinh Doanh mới & Bổ nhiệm Trưởng nhóm
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      const result = await teamRepository.createTeam({
        ...newTeam,
        leader_id: newTeam.leader_id || null,
      });

      if (result.success && result.team) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'team_create',
          { team_code: result.team.code, team_name: result.team.name }
        );
        await reloadData();
        setIsTeamModalOpen(false);
        setNewTeam({ name: '', code: '', agency_id: '', leader_id: '' });
      } else {
        setModalError(result.error || 'Không thể tạo đội nhóm mới.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi tạo đội nhóm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Xử lý Bổ nhiệm / Thay đổi vai trò nhân sự
  const handleOpenRoleModal = (user: UserProfile) => {
    setSelectedUserForRole(user);
    setTargetRole(user.role);
    setTargetAgencyId(user.agency_id || '');
    setTargetTeamId(user.team_id || '');
    setModalError(null);
    setIsRoleModalOpen(true);
  };

  const handleAssignRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      const result = await teamRepository.assignRole(
        selectedUserForRole.id,
        targetRole,
        targetAgencyId || null,
        targetTeamId || null
      );

      if (result.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'role_assignment',
          { targetUser: selectedUserForRole.email, newRole: targetRole }
        );
        await reloadData();
        setIsRoleModalOpen(false);
        setSelectedUserForRole(null);
      } else {
        setModalError(result.error || 'Không thể cập nhật chức danh nhân sự.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi cập nhật vai trò.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLockUser = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'locked' ? 'active' : 'locked';
    const success = await teamRepository.toggleUserStatus(userId, nextStatus);
    if (success) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: nextStatus } : p));
      auditRepository.logAction(
        realUser?.id || currentUser!.id,
        realUser?.full_name || currentUser!.full_name,
        'account_status_change',
        { targetUserId: userId, newStatus: nextStatus }
      );
    }
  };

  const handleResetPassword = (email: string) => {
    alert(`Đã đặt lại mật khẩu tạm thời là 'password123' cho tài khoản ${email}. Người dùng sẽ phải đổi mật khẩu khi đăng nhập.`);
    auditRepository.logAction(
      realUser?.id || currentUser!.id,
      realUser?.full_name || currentUser!.full_name,
      'password_reset_by_admin',
      { targetEmail: email }
    );
  };

  const handleSaveSettings = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
    auditRepository.logAction(
      realUser?.id || currentUser!.id,
      realUser?.full_name || currentUser!.full_name,
      'system_settings_updated',
      { maxLeads, autoReclaimHours }
    );
  };

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const matchSearch = 
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery));
    const matchRole = roleFilter === 'all' || p.role === roleFilter;
    const matchAgency = agencyFilter === 'all' || p.agency_id === agencyFilter;
    return matchSearch && matchRole && matchAgency;
  });

  const availableTeamsForSelectedAgency = teams.filter(
    t => !newUser.agency_id || t.agency_id === newUser.agency_id
  );

  const availableTeamsForRoleModal = teams.filter(
    t => !targetAgencyId || t.agency_id === targetAgencyId
  );

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & TABS */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Trung Tâm Quản Trị Hệ Thống (Admin Control Center)
                </h2>
                <span className="text-[10px] font-semibold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">
                  Chỉ Dành Cho Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý người dùng, tạo sàn giao dịch, thành lập đội nhóm kinh doanh và bổ nhiệm chức danh lãnh đạo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'users' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setModalError(null);
                  setModalSuccess(null);
                  setIsCreateModalOpen(true);
                }}
                className="font-semibold text-xs py-2 shadow-sm"
              >
                <UserPlus className="h-4 w-4 mr-1.5" /> Thêm người dùng mới
              </Button>
            )}

            {activeTab === 'teams' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModalError(null);
                    setIsAgencyModalOpen(true);
                  }}
                  className="font-semibold text-xs py-2 shadow-sm"
                >
                  <Building2 className="h-4 w-4 mr-1.5 text-blue-600" /> Thêm Sàn Giao Dịch
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setModalError(null);
                    setIsTeamModalOpen(true);
                  }}
                  className="font-semibold text-xs py-2 shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Thêm Team Kinh Doanh
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap border-b border-slate-200 gap-4 text-xs font-semibold">
          {[
            { id: 'users', label: `Tài khoản & Nhân sự (${profiles.length})`, icon: Users },
            { id: 'teams', label: `Cơ cấu Sàn (${agencies.length}) & Team (${teams.length})`, icon: Building2 },
            { id: 'permissions', label: 'Ma trận Phân quyền 6 Vai trò', icon: KeyRound },
            { id: 'auto_transfer', label: 'Tự Động Chuyển Lead & Email', icon: Clock },
            { id: 'settings', label: 'Cấu hình Hệ thống', icon: Sliders },
            { id: 'audit', label: 'Nhật ký Bảo mật (Audit)', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 flex items-center gap-1.5 transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. TAB 1: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Danh Sách Người Dùng & Bổ Nhiệm Chức Danh</CardTitle>
              <p className="text-xs text-slate-500">
                Quản lý tài khoản, bổ nhiệm Giám Đốc Sàn, Sales Manager (Trưởng phòng), Trưởng nhóm hoặc Sale Agent.
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm tên, email, SĐT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả vai trò</option>
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label.split('(')[0]}</option>
                ))}
              </select>

              <select
                value={agencyFilter}
                onChange={(e) => setAgencyFilter(e.target.value)}
                className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả sàn</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          </CardHeader>

          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-y border-slate-200">
                    <th className="py-3 px-4">Họ và Tên</th>
                    <th className="py-3 px-4">Email Đăng Nhập</th>
                    <th className="py-3 px-4">Số Điện Thoại</th>
                    <th className="py-3 px-4">Chức Danh (Role)</th>
                    <th className="py-3 px-4">Sàn / Đội Nhóm</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4 text-right">Thao Tác Quản Trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                        Không tìm thấy nhân sự phù hợp với tiêu chí lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((p) => {
                      const roleObj = USER_ROLES.find(r => r.value === p.role);
                      const agencyObj = agencies.find(a => a.id === p.agency_id);
                      const teamObj = teams.find(t => t.id === p.team_id);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {p.full_name}
                            {p.id === realUser?.id && (
                              <span className="ml-1.5 text-[9px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-normal">
                                Bạn
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{p.email}</td>
                          <td className="py-3 px-4 text-slate-600">{p.phone || '-'}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-200 inline-block">
                              {roleObj?.label.split('(')[0] || p.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {agencyObj ? (
                              <span className="font-medium text-slate-800">{agencyObj.code}</span>
                            ) : '-'}
                            {teamObj ? ` • ${teamObj.name}` : ''}
                          </td>
                          <td className="py-3 px-4">
                            {p.status === 'active' ? (
                              <Badge variant="success">Hoạt động</Badge>
                            ) : (
                              <Badge variant="danger">Đã khóa</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRoleModal(p)}
                              className="text-[11px] py-1 px-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                              title="Bổ nhiệm Giám đốc sàn, Sales Manager, Trưởng nhóm hoặc đổi phòng ban"
                            >
                              <Award className="h-3 w-3 mr-1" /> Bổ nhiệm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetPassword(p.email)}
                              className="text-[11px] py-1 px-2"
                              title="Đặt lại mật khẩu tạm thời thành password123"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Reset Pass
                            </Button>
                            {p.role !== 'admin' && (
                              <Button
                                size="sm"
                                variant={p.status === 'locked' ? 'primary' : 'danger'}
                                onClick={() => handleToggleLockUser(p.id, p.status)}
                                className="text-[11px] py-1 px-2"
                              >
                                {p.status === 'locked' ? (
                                  <>
                                    <Unlock className="h-3 w-3 mr-1" /> Mở khóa
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-3 w-3 mr-1" /> Khóa
                                  </>
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 3. TAB 2: TEAMS & AGENCIES MANAGEMENT */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          {/* SÀN PHÂN PHỐI */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Danh Sách Sàn Giao Dịch Phân Phối ({agencies.length} Sàn)</CardTitle>
                <p className="text-xs text-slate-500">
                  Cơ sở kinh doanh độc lập có Giám Đốc Sàn quản trị doanh số và nhân sự.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setModalError(null);
                  setIsAgencyModalOpen(true);
                }}
                className="text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Sàn Giao Dịch
              </Button>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              {agencies.map((a) => {
                const teamsInAgency = teams.filter(t => t.agency_id === a.id);
                const salesInAgency = profiles.filter(p => p.agency_id === a.id);

                return (
                  <div key={a.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 transition-all shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="info" className="mb-1 text-[10px]">{a.code}</Badge>
                          <h3 className="text-sm font-bold text-slate-900">{a.name}</h3>
                        </div>
                        <Badge variant="success">Hoạt động</Badge>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>Giám đốc sàn: <strong>{a.director_name || '(Chưa bổ nhiệm)'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{a.phone || 'Chưa cập nhật'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {a.address || 'Chưa có địa chỉ'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span><strong>{teamsInAgency.length}</strong> Team • <strong>{salesInAgency.length}</strong> Sale</span>
                      <button
                        onClick={() => {
                          setPerfAgencyId(a.id);
                          setPerfModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" /> Hiệu suất sàn
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ĐỘI NHÓM KINH DOANH (TEAMS) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Danh Sách Đội Nhóm Bán Hàng ({teams.length} Team)</CardTitle>
                <p className="text-xs text-slate-500">
                  Mỗi Team trực thuộc một Sàn và do Trưởng nhóm kinh doanh (Team Leader) dẫn dắt.
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setModalError(null);
                  setIsTeamModalOpen(true);
                }}
                className="text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Team Kinh Doanh
              </Button>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              {teams.map((t) => {
                const agency = agencies.find(a => a.id === t.agency_id);
                const members = profiles.filter(p => p.team_id === t.id);

                return (
                  <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 transition-all shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">{t.code}</span>
                          <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{agency?.code || 'Sàn'}</Badge>
                      </div>

                      <div className="mt-2.5 space-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Trưởng nhóm: <strong>{t.leader_name || '(Chưa bổ nhiệm)'}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Trực thuộc: <span className="font-medium text-slate-700">{agency?.name || 'Chưa gán'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Quy mô: <strong>{members.length}</strong> Sale Agent</span>
                      <span className="text-[10px] text-blue-600 font-medium">Đang hoạt động</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* 4. TAB 3: PERMISSION MATRIX */}
      {activeTab === 'permissions' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-sm">Ma Trận Phân Quyền Theo 6 Vai Trò (RBAC)</CardTitle>
                <p className="text-xs text-slate-500">
                  Quy định chi tiết phạm vi dữ liệu và quyền hạn của Giám đốc sàn, Trưởng phòng kinh doanh, Trưởng nhóm và Sale Agent.
                </p>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4 text-left">Chức năng & Màn hình</th>
                  <th className="bg-blue-50/60 text-blue-800">Admin (Quản trị)</th>
                  <th>Director (GĐ Sàn)</th>
                  <th>Marketing</th>
                  <th>Sales Manager (Trưởng phòng)</th>
                  <th>Team Leader (Trưởng nhóm)</th>
                  <th>Sale Agent (Tư vấn)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {[
                  { name: 'Dashboard KPI & Doanh số', a: 'Toàn hệ thống', d: 'Toàn sàn phụ trách', m: 'Toàn hệ thống', sm: 'Theo sàn & các team', tl: 'Chỉ trong team', sa: 'Cá nhân' },
                  { name: 'Phạm vi xem Lead (RLS)', a: 'Tất cả 100%', d: 'Toàn sàn phụ trách', m: 'Tất cả (Ẩn SĐT)', sm: 'Toàn sàn phụ trách', tl: 'Lead thuộc team', sa: 'Chỉ Lead được giao' },
                  { name: 'Kéo thả Journey & Xác nhận Deal', a: true, d: true, m: false, sm: true, tl: true, sa: true },
                  { name: 'Phân bổ Round Robin (Lead Pool)', a: true, d: true, m: false, sm: true, tl: true, sa: false },
                  { name: 'Bổ nhiệm Leader & Quản lý Team', a: true, d: true, m: false, sm: true, tl: false, sa: false },
                  { name: 'Xuất dữ liệu Lead ra CSV', a: true, d: true, m: true, sm: true, tl: true, sa: false },
                  { name: 'Chỉnh sửa Tri thức Dự án & FAQ', a: true, d: true, m: true, sm: true, tl: false, sa: false },
                  { name: 'Tùy chỉnh Sales Scripts theo sàn', a: true, d: true, m: true, sm: true, tl: false, sa: false },
                  { name: 'Thêm Sàn, Team & Tạo tài khoản', a: 'Chỉ Admin', d: false, m: false, sm: false, tl: false, sa: false },
                  { name: 'Chuyển đổi góc nhìn vai trò (Góc nhìn)', a: 'Chỉ Admin', d: false, m: false, sm: false, tl: false, sa: false },
                  { name: 'Cấu hình tham số & Xem Audit Logs', a: 'Chỉ Admin', d: false, m: false, sm: false, tl: false, sa: false },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-left font-semibold text-slate-900">{row.name}</td>
                    <td className="py-3 px-2 font-bold text-blue-700 bg-blue-50/40">
                      {typeof row.a === 'boolean' ? (row.a ? '✓ Toàn quyền' : '-') : row.a}
                    </td>
                    <td className="py-3 px-2 font-medium">{typeof row.d === 'boolean' ? (row.d ? '✓ Có' : '-') : row.d}</td>
                    <td className="py-3 px-2">{typeof row.m === 'boolean' ? (row.m ? '✓ Có' : '-') : row.m}</td>
                    <td className="py-3 px-2 font-medium">{typeof row.sm === 'boolean' ? (row.sm ? '✓ Có' : '-') : row.sm}</td>
                    <td className="py-3 px-2">{typeof row.tl === 'boolean' ? (row.tl ? '✓ Có' : '-') : row.tl}</td>
                    <td className="py-3 px-2">{typeof row.sa === 'boolean' ? (row.sa ? '✓ Có' : '-') : row.sa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 5. TAB 4: SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-sm">Cấu Hình Thông Số Nghiệp Vụ Toàn Hệ Thống</CardTitle>
          </CardHeader>
          <div className="p-5 space-y-5 text-xs">
            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Đã lưu thành công cấu hình hệ thống!</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Giới hạn Lead chưa chăm sóc tối đa cho mỗi Sale Agent
              </label>
              <Input
                type="number"
                value={maxLeads}
                onChange={(e) => setMaxLeads(Number(e.target.value))}
                min={5}
                max={100}
                className="w-48 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Khi Sale đạt ngưỡng này, hệ thống Round Robin sẽ tự động bỏ qua để tránh quá tải.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Thời gian tự động thu hồi Lead không phát sinh tương tác (Giờ)
              </label>
              <Input
                type="number"
                value={autoReclaimHours}
                onChange={(e) => setAutoReclaimHours(Number(e.target.value))}
                min={12}
                max={168}
                className="w-48 text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Lead ở trạng thái 'new' hoặc 'unreachable' quá thời gian này sẽ được hoàn trả về Pool chung.
              </p>
            </div>

            <Button variant="primary" size="sm" onClick={handleSaveSettings}>
              Lưu cấu hình hệ thống
            </Button>
          </div>
        </Card>
      )}

      {/* 5.5 TAB: TỰ ĐỘNG CHUYỂN LEAD & THÔNG BÁO EMAIL (MODULE 6 & 7) */}
      {activeTab === 'auto_transfer' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: CẤU HÌNH TỰ ĐỘNG CHUYỂN LEAD QUÁ HẠN 24H */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Cấu Hình Tự Động Chuyển Lead 24H Liên Tục
                  </CardTitle>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoTransferConfig.enabled}
                      onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Quy tắc 24 giờ liên tục (Wall-clock real time). Bỏ qua hoàn toàn ngày nghỉ / giờ làm việc để đảm bảo tốc độ phản hồi khách hàng.
                </p>
              </CardHeader>

              <div className="p-5 space-y-4 text-xs">
                {autoConfigSaved && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Đã lưu thành công cấu hình tự động chuyển lead!</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Thời hạn chăm sóc tối đa (Giờ liên tục)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={autoTransferConfig.deadline_hours}
                      onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, deadline_hours: Number(e.target.value) })}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Mặc định: 24 giờ liên tục</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Cảnh báo trước khi chuyển (Mốc giờ)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={autoTransferConfig.deadline_hours}
                      value={autoTransferConfig.pre_warning_hours}
                      onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, pre_warning_hours: Number(e.target.value) })}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Mặc định: 20 giờ (trước 4 giờ)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Số lần chuyển tự động tối đa cho 1 Lead
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={autoTransferConfig.max_transfer_count}
                      onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, max_transfer_count: Number(e.target.value) })}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Hết số lần này sẽ chuyển về Kho lead chung</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Ưu tiên chia Sale cùng team
                    </label>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={autoTransferConfig.priority_same_team}
                        onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, priority_same_team: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700 font-medium">Ưu tiên cùng team trước</span>
                    </div>
                  </div>
                </div>

                {/* Giờ yên tĩnh */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Giờ yên tĩnh (Quiet Hours)</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoTransferConfig.quiet_hours_enabled}
                        onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, quiet_hours_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Trong khung giờ này sẽ không gửi chuông/email cảnh báo đêm (đồng hồ deadline vẫn chạy ngầm).
                  </p>
                  {autoTransferConfig.quiet_hours_enabled && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Bắt đầu:</span>
                        <Input
                          type="time"
                          value={autoTransferConfig.quiet_hours_start}
                          onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, quiet_hours_start: e.target.value })}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Kết thúc:</span>
                        <Input
                          type="time"
                          value={autoTransferConfig.quiet_hours_end}
                          onChange={(e) => setAutoTransferConfig({ ...autoTransferConfig, quiet_hours_end: e.target.value })}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Trạng thái dừng đồng hồ */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Trạng thái tạm dừng đồng hồ chăm sóc (Stop-Clock)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Lead ở các trạng thái này sẽ được bảo lưu cho Sale hiện tại, không tự động chuyển đi.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 border rounded-lg">
                    {JOURNEY_STAGES.map((s) => {
                      const isChecked = autoTransferConfig.stop_clock_statuses.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-1.5 p-1 rounded hover:bg-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...autoTransferConfig.stop_clock_statuses, s.id]
                                : autoTransferConfig.stop_clock_statuses.filter(st => st !== s.id);
                              setAutoTransferConfig({ ...autoTransferConfig, stop_clock_statuses: next });
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span className="text-[11px] text-slate-700">{s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAutoConfig}
                  isLoading={isSavingAutoConfig}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Lưu Cấu Hình Chuyển Lead
                </Button>
              </div>
            </Card>

            {/* CARD 2: CẤU HÌNH THÔNG BÁO EMAIL & IN-APP */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-purple-600" />
                    Cấu Hình Thông Báo Email & In-App (Module 6)
                  </CardTitle>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailConfig.enabled}
                      onChange={(e) => setEmailConfig({ ...emailConfig, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Gửi email tiếng Việt responsive kèm nút CTA mở nhanh hồ sơ lead. Hỗ trợ gửi trực tiếp qua Gmail SMTP hoặc Resend API.
                </p>
              </CardHeader>

              <div className="p-5 space-y-5 text-xs">
                {emailConfigSaved && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Đã lưu thành công cấu hình email!</span>
                  </div>
                )}

                {/* 1. CỔNG GỬI EMAIL (GATEWAY CONFIG) */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Key className="h-4 w-4 text-purple-600" />
                      Cổng Gửi Email Ra Ngoài (SMTP Gateway)
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                      Bắt buộc để gửi đến Gmail thực
                    </span>
                  </div>

                  {/* Provider selection */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Chọn Phương Thức Gửi Thông Báo Ưu Tiên:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEmailConfig({ ...emailConfig, dispatch_mode: 'client_direct' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          (emailConfig.dispatch_mode || 'client_direct') === 'client_direct'
                            ? 'border-emerald-600 bg-emerald-50/70 font-semibold text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold mb-1">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                          1-Click Gmail & Zalo
                        </div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          Khuyên dùng khi có người thao tác! Mở sẵn Gmail/Zalo, không cần cài đặt mật khẩu.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmailConfig({ ...emailConfig, dispatch_mode: 'google_apps_script', provider: 'google_apps_script' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          emailConfig.dispatch_mode === 'google_apps_script'
                            ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 shadow-sm ring-1 ring-indigo-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-indigo-800 font-bold mb-1">
                          <Send className="h-3.5 w-3.5 text-indigo-600" />
                          Google Apps Script (Tự Động)
                        </div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          Tự động đảo lead 24/7 bằng chính Gmail miễn phí. Không cần App Password, không bao giờ bị chặn!
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmailConfig({ ...emailConfig, dispatch_mode: 'resend_api', provider: 'resend' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          emailConfig.dispatch_mode === 'resend_api'
                            ? 'border-purple-600 bg-purple-50/70 font-semibold text-purple-950 shadow-sm ring-1 ring-purple-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-purple-800 font-bold mb-1">
                          <Send className="h-3.5 w-3.5 text-purple-600" />
                          Resend API (Tự Động)
                        </div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          Miễn phí 3.000 email/tháng, chỉ cần 1 API key, chạy ngầm tự động 100%.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmailConfig({ ...emailConfig, dispatch_mode: 'server_smtp', provider: 'gmail_smtp', smtp_host: 'smtp.gmail.com', smtp_port: 465 })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          emailConfig.dispatch_mode === 'server_smtp'
                            ? 'border-blue-600 bg-blue-50/70 font-semibold text-blue-950 shadow-sm ring-1 ring-blue-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-blue-800 font-bold mb-1">
                          <Mail className="h-3.5 w-3.5 text-blue-600" />
                          Gmail SMTP Server
                        </div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          Dành cho tài khoản cá nhân có thể tạo Google App Password 16 ký tự.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Giải thích khi Google báo lỗi App Password */}
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      Tại sao Google báo lỗi "The setting you are looking for is not available for your account"?
                    </div>
                    <p className="leading-relaxed">
                      Lỗi này xuất hiện khi tài khoản Google của bạn là <strong>Google Workspace (email công ty có đuôi @tenmien.com)</strong> hoặc quản trị viên IT của tổ chức đã tắt tính năng tự tạo App Password theo chính sách bảo mật.
                    </p>
                    <p className="leading-relaxed font-semibold text-emerald-800">
                      👉 <strong>Giải pháp tức thì:</strong> Hãy sử dụng chế độ <strong>"1-Click Gmail & Zalo"</strong> bên trên! Mỗi khi bạn phân bổ hoặc điều chuyển lead, CRM sẽ mở sẵn tab Gmail hoặc Zalo với nội dung điền sẵn 100%, bạn chỉ cần bấm "Gửi" ngay từ máy của mình.
                    </p>
                  </div>

                  {/* Fields for Google Apps Script Webhook (Chạy ngầm tự động 24/7 bằng chính Gmail miễn phí) */}
                  {emailConfig.dispatch_mode === 'google_apps_script' && (
                    <div className="space-y-3 pt-1">
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-950 text-[11px] space-y-2">
                        <div className="font-bold flex items-center justify-between text-indigo-900">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-indigo-600" />
                            Cách Kết Nối Gmail Tự Động 24/7 Bằng Google Apps Script (3 Bước Miễn Phí 100%):
                          </span>
                          <a
                            href="https://script.google.com"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 underline"
                          >
                            Mở script.google.com <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed text-indigo-900/90">
                          <li>Truy cập <strong>script.google.com</strong> bằng tài khoản Gmail của bạn $\rightarrow$ Nhấn nút <strong>"Dự án mới" (New project)</strong>.</li>
                          <li>
                            Xóa hết mã có sẵn và dán đoạn mã bên dưới vào:
                            <div className="relative mt-1">
                              <pre className="p-2.5 bg-slate-900 text-slate-100 rounded font-mono text-[10px] overflow-x-auto leading-relaxed">
{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    MailApp.sendEmail({
      to: data.to,
      subject: data.subject,
      htmlBody: data.html
    });
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status: "active", message: "Webhook ready"})).setMimeType(ContentService.MimeType.JSON);
}`}
                              </pre>
                              <button
                                type="button"
                                onClick={() => {
                                  const code = `function doPost(e) {\n  try {\n    var data = JSON.parse(e.postData.contents);\n    MailApp.sendEmail({\n      to: data.to,\n      subject: data.subject,\n      htmlBody: data.html\n    });\n    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);\n  } catch(err) {\n    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message})).setMimeType(ContentService.MimeType.JSON);\n  }\n}\n\nfunction doGet(e) {\n  return ContentService.createTextOutput(JSON.stringify({status: "active", message: "Webhook ready"})).setMimeType(ContentService.MimeType.JSON);\n}`;
                                  navigator.clipboard.writeText(code);
                                  setCopiedGasCode(true);
                                  setTimeout(() => setCopiedGasCode(false), 2000);
                                }}
                                className="absolute right-2 top-2 px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-semibold flex items-center gap-1 backdrop-blur"
                              >
                                {copiedGasCode ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                {copiedGasCode ? 'Đã copy code!' : 'Copy Mã Script'}
                              </button>
                            </div>
                          </li>
                          <li>
                            Nhấn <strong>Triển khai (Deploy)</strong> $\rightarrow$ <strong>Triển khai mới (New deployment)</strong>:
                            <ul className="list-disc pl-4 space-y-0.5 mt-1 text-[10px] text-indigo-950 font-medium">
                              <li>Chọn loại: <strong>Ứng dụng web (Web app)</strong>.</li>
                              <li>Thực thi dưới tên (Execute as): <strong>"Tôi" (Me)</strong>.</li>
                              <li>Ai có quyền truy cập (Who has access): <strong className="text-rose-600 underline">Bắt buộc chọn "Bất kỳ ai" (Anyone)</strong>.</li>
                            </ul>
                          </li>
                          <li>
                            Nhấn nút <strong>Triển khai (Deploy)</strong> $\rightarrow$ Google sẽ hỏi <strong>"Ủy quyền truy cập" (Authorize access)</strong>:
                            <div className="p-2 bg-amber-100/80 border border-amber-300 rounded text-[10px] text-amber-900 mt-1">
                              👉 Bấm <strong>Xem lại quyền (Review permissions)</strong> $\rightarrow$ Chọn tài khoản Google $\rightarrow$ Bấm <strong>Nâng cao (Advanced)</strong> $\rightarrow$ Bấm <strong>Đi tới Dự án không an toàn (Go to ... unsafe)</strong> $\rightarrow$ Bấm <strong>Cho phép (Allow)</strong>.
                            </div>
                          </li>
                          <li>
                            Sao chép <strong>URL ứng dụng web</strong> (đường link có đuôi kết thúc bằng <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono font-bold text-indigo-900">/exec</code>) dán vào ô bên dưới.
                          </li>
                        </ol>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          URL Webhook Google Apps Script (Web app URL):
                        </label>
                        <input
                          type="url"
                          value={emailConfig.google_apps_script_url || ''}
                          onChange={(e) => setEmailConfig({ ...emailConfig, google_apps_script_url: e.target.value })}
                          placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white font-mono"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          * Tự động gửi email qua chính Gmail của bạn kể cả lúc nửa đêm khi lead quá hạn 24h mà không cần mở máy!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Fields for Gmail SMTP */}
                  {emailConfig.dispatch_mode === 'server_smtp' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Tên hiển thị người gửi (Sender Name):
                        </label>
                        <input
                          type="text"
                          value={emailConfig.smtp_from_name || ''}
                          onChange={(e) => setEmailConfig({ ...emailConfig, smtp_from_name: e.target.value })}
                          placeholder="Ví dụ: CRM Bất Động Sản - Quản Lý Bán Hàng"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Tài khoản Gmail gửi (Email Address):
                        </label>
                        <input
                          type="email"
                          value={emailConfig.smtp_user || ''}
                          onChange={(e) => setEmailConfig({ ...emailConfig, smtp_user: e.target.value })}
                          placeholder="your-company@gmail.com"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white font-mono"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-700">
                            Mật khẩu ứng dụng Google (16 ký tự App Password):
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowAppPassGuide(!showAppPassGuide)}
                            className="text-[11px] text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
                          >
                            <HelpCircle className="h-3 w-3" />
                            {showAppPassGuide ? 'Ẩn hướng dẫn' : 'Cách tạo mật khẩu 16 ký tự'}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={emailConfig.smtp_pass || ''}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtp_pass: e.target.value })}
                            placeholder="abcd efgh ijkl mnop"
                            className="w-full px-3 py-2 pr-10 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white font-mono tracking-wider"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          * Lưu ý: Google yêu cầu dùng <strong>Mật khẩu ứng dụng 16 ký tự</strong>, không dùng mật khẩu đăng nhập Gmail thông thường.
                        </p>
                      </div>

                      {/* Expandable Guide */}
                      {showAppPassGuide && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1.5">
                          <div className="font-semibold flex items-center gap-1 text-amber-800">
                            <HelpCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            4 Bước Tạo Mật Khẩu Ứng Dụng (Google App Password):
                          </div>
                          <ol className="list-decimal pl-4 space-y-1 text-amber-800/90 leading-relaxed">
                            <li>Bật <strong>Xác minh 2 bước (2-Step Verification)</strong> trong tài khoản Google của bạn.</li>
                            <li>
                              Truy cập đường dẫn{' '}
                              <a
                                href="https://myaccount.google.com/apppasswords"
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-semibold text-purple-700 hover:text-purple-800 inline-flex items-center gap-0.5"
                              >
                                myaccount.google.com/apppasswords
                                <ExternalLink className="h-3 w-3 inline" />
                              </a>
                            </li>
                            <li>Nhập tên ứng dụng là <strong>CRM Broker</strong> rồi bấm <strong>Tạo (Create)</strong>.</li>
                            <li>Google sẽ hiển thị một chuỗi 16 chữ cái (ví dụ: <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">abcd efgh ijkl mnop</code>). Sao chép và dán vào ô bên trên.</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fields for Client Direct (1-Click Gmail & Zalo) */}
                  {(emailConfig.dispatch_mode || 'client_direct') === 'client_direct' && (
                    <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2.5 text-[11px] text-emerald-950">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        Chế Độ Gửi Trực Tiếp 1-Click Đang Hoạt Động (Tối Ưu Nhất):
                      </div>
                      <p className="leading-relaxed text-slate-700">
                        Khi Quản lý thực hiện <strong>Bàn giao Lead</strong> hoặc <strong>Phân bổ hàng loạt</strong>, CRM sẽ tự động hiển thị Hộp thoại Gửi Thông Báo Tức Thì với 2 tùy chọn 1-Click:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-700">
                        <li>
                          <strong>Mở Gmail Soạn Thư (Gmail Web):</strong> Mở ngay tab Gmail của chính bạn với người nhận ({`email của Sale`}), tiêu đề và nội dung chi tiết (SĐT khách, nhu cầu, thời hạn SLA 24h, link CRM) đã điền sẵn 100%. Bạn chỉ việc nhấn nút "Gửi" trên Gmail của mình!
                        </li>
                        <li>
                          <strong>Mở Zalo Gửi Cho Sale:</strong> Tự động sao chép mẫu tin nhắn khách hàng vào clipboard và mở khung chat Zalo của Sale. Bạn chỉ cần nhấn <code>Ctrl+V</code> (hoặc Cmd+V) là gửi xong.
                        </li>
                      </ul>
                      <div className="pt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const testUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(currentUser?.email || 'sale@gmail.com')}&su=${encodeURIComponent('[CRM Broker] Thử Nghiệm Bàn Giao Lead')}&body=${encodeURIComponent('Xin chào Sale,\n\nĐây là tin nhắn thử nghiệm gửi từ trình duyệt qua Gmail Web.\n\nTrân trọng,\nCRM Broker')}`;
                            window.open(testUrl, '_blank');
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold flex items-center gap-1 text-[11px] shadow-sm transition-colors"
                        >
                          <Mail className="h-3 w-3" />
                          Thử Mở Soạn Thư Gmail Web Ngay
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('🏢 [CRM BROKER] TIN NHẮN THỬ NGHIỆM GỬI QUA ZALO CHO SALE');
                            alert('Đã copy mẫu tin nhắn Zalo vào bộ nhớ tạm! Bạn có thể dán (Ctrl+V) vào Zalo.');
                            window.open('https://chat.zalo.me', '_blank');
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1 text-[11px] shadow-sm transition-colors"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Thử Mở Zalo Web Ngay
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fields for Resend API */}
                  {emailConfig.dispatch_mode === 'resend_api' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Resend API Key:
                        </label>
                        <input
                          type="password"
                          value={emailConfig.resend_api_key || ''}
                          onChange={(e) => setEmailConfig({ ...emailConfig, resend_api_key: e.target.value })}
                          placeholder="re_123456789_abcdef..."
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Email người gửi đã xác thực trên Resend:
                        </label>
                        <input
                          type="email"
                          value={emailConfig.smtp_from_email || ''}
                          onChange={(e) => setEmailConfig({ ...emailConfig, smtp_from_email: e.target.value })}
                          placeholder="notifications@yourdomain.com"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. CÔNG CỤ GỬI THỬ EMAIL (TEST CONNECTION) */}
                <div className="p-4 bg-purple-50/40 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-900 flex items-center gap-1.5 text-xs">
                      <Send className="h-4 w-4 text-purple-600" />
                      Kiểm Tra Kết Nối & Gửi Thử Email (Test Email)
                    </span>
                    <span className="text-[10px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-medium">
                      Gửi thư thật
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Nhập một địa chỉ email Gmail bất kỳ (ví dụ email của bạn) để kiểm tra xem hệ thống đã gửi thư ra ngoài thành công chưa.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      placeholder={currentUser?.email || 'nhap-email-nhan@gmail.com'}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white font-mono"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSendTestEmail}
                      isLoading={isSendingTestEmail}
                      className="bg-purple-600 hover:bg-purple-700 shrink-0 flex items-center gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Gửi Thử Email Ngay
                    </Button>
                  </div>

                  {testEmailResult && (
                    <div
                      className={`p-3 rounded-lg border text-[11px] flex items-start gap-2 ${
                        testEmailResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {testEmailResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 leading-relaxed">{testEmailResult.message}</div>
                    </div>
                  )}
                </div>

                {/* 3. QUY TẮC SỰ KIỆN GỬI THÔNG BÁO */}
                <div className="space-y-2.5">
                  <span className="font-semibold text-slate-800 block text-xs">
                    Kích Hoạt Gửi Email Cho Các Sự Kiện:
                  </span>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100/60 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-800 block">Khi được giao lead mới</span>
                      <span className="text-[11px] text-slate-500">Gửi email cho Sale nhận lead kèm nút CTA chi tiết</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailConfig.enable_new_assign}
                      onChange={(e) => setEmailConfig({ ...emailConfig, enable_new_assign: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100/60 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-800 block">Khi nhận lead được điều chuyển</span>
                      <span className="text-[11px] text-slate-500">Gửi email cho Sale mới kèm lịch sử chăm sóc cũ</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailConfig.enable_transfer}
                      onChange={(e) => setEmailConfig({ ...emailConfig, enable_transfer: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100/60 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-800 block">Khi lead bị thu hồi do quá hạn</span>
                      <span className="text-[11px] text-slate-500">Gửi thông báo cho Sale cũ lý do thu hồi</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailConfig.enable_revoke}
                      onChange={(e) => setEmailConfig({ ...emailConfig, enable_revoke: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100/60 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-800 block">Cảnh báo sắp hết hạn (Mốc 20h)</span>
                      <span className="text-[11px] text-slate-500">Nhắc nhở Sale còn 4h để liên hệ khách hàng</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailConfig.enable_overdue_warning}
                      onChange={(e) => setEmailConfig({ ...emailConfig, enable_overdue_warning: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100/60 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-800 block">Gửi bản sao (CC) cho Trưởng phòng / Team Leader</span>
                      <span className="text-[11px] text-slate-500">Cho phép quản lý nắm bắt tiến độ phân bổ lead</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailConfig.cc_manager}
                      onChange={(e) => setEmailConfig({ ...emailConfig, cc_manager: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                  </label>
                </div>

                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg text-[11px] text-purple-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                    Chống Spam & Idempotency Key kích hoạt:
                  </div>
                  <p>
                    - Phân bổ hàng loạt (Bulk Assign): Tự động gộp thành 1 email tổng hợp bảng danh sách cho mỗi Sale.
                  </p>
                  <p>
                    - Khóa trùng lặp: Ngăn gửi trùng lặp cùng 1 sự kiện trong vòng 1 giờ cho cùng 1 lead.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEmailConfig}
                  isLoading={isSavingEmailConfig}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Lưu Cấu Hình Email
                </Button>
              </div>
            </Card>
          </div>

          {/* CARD 3: NHẬT KÝ THÔNG BÁO EMAIL & IN-APP */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-600" />
                    Nhật Ký Gửi Thông Báo Email & In-App (Notification Logs)
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Theo dõi trạng thái gửi email, mã sự kiện, số lần thử lại (retries) và thông tin lỗi.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                  {(['all', 'sent', 'failed', 'pending'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setLogStatusFilter(st)}
                      className={`px-2.5 py-1 rounded capitalize font-medium transition-colors ${
                        logStatusFilter === st
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st === 'all' ? 'Tất cả' : st === 'sent' ? 'Thành công' : st === 'failed' ? 'Thất bại' : 'Đang gửi'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Thời Gian</th>
                    <th className="py-2.5 px-4">Người Nhận</th>
                    <th className="py-2.5 px-4">Sự Kiện</th>
                    <th className="py-2.5 px-4">Kênh</th>
                    <th className="py-2.5 px-4">Trạng Thái</th>
                    <th className="py-2.5 px-4">Lần Thử</th>
                    <th className="py-2.5 px-4">Chi Tiết / Lỗi</th>
                    <th className="py-2.5 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filteredLogs = notificationLogs.filter(l => 
                      logStatusFilter === 'all' ? true : l.status === logStatusFilter
                    );

                    if (filteredLogs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            Chưa có nhật ký thông báo nào phù hợp.
                          </td>
                        </tr>
                      );
                    }

                    return filteredLogs.slice(0, 30).map((log) => {
                      const stMap = {
                        sent: { label: 'Đã gửi', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        failed: { label: 'Thất bại', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                        pending: { label: 'Đang gửi', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                      }[log.status];

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-slate-900 block">{log.recipient_name || 'Sale'}</span>
                            <span className="text-[11px] text-slate-400">{log.recipient_email}</span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700">
                            {log.event_type}
                          </td>
                          <td className="py-2.5 px-4 capitalize text-slate-600">
                            {log.channel}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${stMap.color}`}>
                              {stMap.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {log.retry_count}/3
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-xs truncate" title={log.error_message || log.content}>
                            {log.error_message ? (
                              <span className="text-rose-600 font-medium">{log.error_message}</span>
                            ) : (
                              log.title
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {log.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryNotification(log.id)}
                                isLoading={retryingLogId === log.id}
                                className="text-[11px] py-1 px-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Thử lại
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 6. TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nhật Ký Kiểm Toán & Giám Sát An Ninh (Audit Logs)</CardTitle>
            <p className="text-xs text-slate-500">
              Ghi lại mọi hoạt động tạo tài khoản, thành lập sàn, bổ nhiệm lãnh đạo và chuyển đổi góc nhìn vai trò.
            </p>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-y">
                  <th className="py-2.5 px-4">Thời Gian</th>
                  <th className="py-2.5 px-4">Người Thực Hiện</th>
                  <th className="py-2.5 px-4">Hành Động</th>
                  <th className="py-2.5 px-4">Chi Tiết Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400">Chưa có bản ghi nhật ký.</td>
                  </tr>
                ) : (
                  auditLogs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{log.user_name || 'Hệ thống'}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px] font-mono">{log.action}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 7. MODAL: THÊM NGƯỜI DÙNG MỚI */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Thêm Người Dùng Mới Vào Hệ Thống"
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          {modalSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{modalSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Nguyễn Văn A"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email đăng nhập <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="sale.nguyen@diaocvang.vn"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="0912345678"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vai trò (Role) <span className="text-red-500">*</span>
              </label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label.split('(')[0]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuộc Sàn giao dịch
              </label>
              <select
                value={newUser.agency_id || ''}
                onChange={(e) => setNewUser({ ...newUser, agency_id: e.target.value || null, team_id: null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Không gán sàn)</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuộc Team kinh doanh
              </label>
              <select
                value={newUser.team_id || ''}
                onChange={(e) => setNewUser({ ...newUser, team_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Không gán team)</option>
                {availableTeamsForSelectedAgency.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu khởi tạo
            </label>
            <div className="relative">
              <Shield className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="password123"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Mặc định: password123 (Người dùng có thể đổi sau).</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="must_change_pass"
              checked={newUser.must_change_password}
              onChange={(e) => setNewUser({ ...newUser, must_change_password: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <label htmlFor="must_change_pass" className="text-xs text-slate-700 select-none">
              Bắt buộc người dùng đổi mật khẩu ở lần đăng nhập đầu tiên
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. MODAL: THÊM SÀN GIAO DỊCH MỚI */}
      <Modal
        isOpen={isAgencyModalOpen}
        onClose={() => setIsAgencyModalOpen(false)}
        title="Thành Lập Sàn Giao Dịch Mới"
      >
        <form onSubmit={handleCreateAgencySubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên Sàn Giao Dịch <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newAgency.name}
              onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
              placeholder="Sàn Giao Dịch Bình Thạnh"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã viết tắt sàn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newAgency.code}
                onChange={(e) => setNewAgency({ ...newAgency, code: e.target.value })}
                placeholder="S4-BT"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bổ nhiệm Giám Đốc Sàn
              </label>
              <select
                value={newAgency.director_id || ''}
                onChange={(e) => setNewAgency({ ...newAgency, director_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Chọn nhân sự làm Giám đốc sàn)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role}) - {p.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số Hotline Sàn
              </label>
              <input
                type="tel"
                value={newAgency.phone || ''}
                onChange={(e) => setNewAgency({ ...newAgency, phone: e.target.value })}
                placeholder="02838889999"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email liên hệ sàn
              </label>
              <input
                type="email"
                value={newAgency.email || ''}
                onChange={(e) => setNewAgency({ ...newAgency, email: e.target.value })}
                placeholder="san.binhthanh@diaocvang.vn"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ văn phòng sàn
            </label>
            <input
              type="text"
              value={newAgency.address || ''}
              onChange={(e) => setNewAgency({ ...newAgency, address: e.target.value })}
              placeholder="128 Điện Biên Phủ, Phường 15, Bình Thạnh, TP.HCM"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAgencyModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Tạo Sàn Giao Dịch
            </Button>
          </div>
        </form>
      </Modal>

      {/* 9. MODAL: THÊM TEAM KINH DOANH MỚI */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title="Thành Lập Đội Nhóm Kinh Doanh (Sales Team)"
      >
        <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên Team Kinh Doanh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newTeam.name}
              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
              placeholder="Team Dragon (Rồng Vàng)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã viết tắt Team <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newTeam.code}
                onChange={(e) => setNewTeam({ ...newTeam, code: e.target.value })}
                placeholder="TM-DRAGON"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trực thuộc Sàn giao dịch <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={newTeam.agency_id}
                onChange={(e) => setNewTeam({ ...newTeam, agency_id: e.target.value })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="">-- Chọn sàn trực thuộc --</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bổ nhiệm Trưởng Nhóm (Team Leader)
            </label>
            <select
              value={newTeam.leader_id || ''}
              onChange={(e) => setNewTeam({ ...newTeam, leader_id: e.target.value || null })}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">(Chọn nhân sự làm Trưởng nhóm)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role}) - {p.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTeamModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Tạo Team Kinh Doanh
            </Button>
          </div>
        </form>
      </Modal>

      {/* 10. MODAL: BỔ NHIỆM / CHUYỂN ĐỔI CHỨC VỤ NHÂN SỰ */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Bổ Nhiệm & Điều Chuyển Nhân Sự"
      >
        <form onSubmit={handleAssignRoleSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          {selectedUserForRole && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <p className="text-xs font-bold text-slate-900">{selectedUserForRole.full_name}</p>
              <p className="text-[11px] text-slate-500 font-mono">{selectedUserForRole.email} • {selectedUserForRole.phone}</p>
              <p className="text-[11px] text-blue-600 font-semibold">Chức danh hiện tại: {selectedUserForRole.role}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bổ nhiệm vai trò mới (Role) <span className="text-red-500">*</span>
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as UserRole)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-bold text-blue-700"
            >
              {USER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {targetRole === 'director' && 'Giám đốc sàn: Toàn quyền quản trị doanh số và duyệt giao dịch của sàn.'}
              {targetRole === 'sales_manager' && 'Sales Manager: Quản lý các team kinh doanh, giám sát KPI và chia lead.'}
              {targetRole === 'team_leader' && 'Trưởng nhóm: Điều hành team, đôn đốc lịch hẹn và chốt deal.'}
              {targetRole === 'sale_agent' && 'Chuyên viên tư vấn: Chăm sóc khách hàng và tiếp nhận Lead.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phân công về Sàn
              </label>
              <select
                value={targetAgencyId}
                onChange={(e) => {
                  setTargetAgencyId(e.target.value);
                  setTargetTeamId('');
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Không gán sàn)</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phân công vào Team
              </label>
              <select
                value={targetTeamId}
                onChange={(e) => setTargetTeamId(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Không gán team)</option>
                {availableTeamsForRoleModal.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRoleModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Xác nhận Bổ nhiệm
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL HIỆU SUẤT SÀN GIAO DỊCH */}
      {perfAgencyId && (
        <AgencyPerformanceModal
          agencyId={perfAgencyId}
          isOpen={perfModalOpen}
          onClose={() => setPerfModalOpen(false)}
        />
      )}
    </div>
  );
};
