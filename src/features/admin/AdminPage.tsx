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
  Eye
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
import { UserProfile, Agency, Team, AuditLog, UserRole } from '@/domain/types';
import { USER_ROLES } from '@/domain/constants';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export const AdminPage: React.FC = () => {
  const { currentUser, realUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'teams' | 'settings' | 'audit'>('users');

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [uList, aList, tList, logs] = await Promise.all([
      teamRepository.getProfiles(),
      teamRepository.getAgencies(),
      teamRepository.getTeams(),
      auditRepository.getAuditLogs(),
    ]);
    setProfiles(uList);
    setAgencies(aList);
    setTeams(tList);
    setAuditLogs(logs);
    setLoading(false);
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
