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
  Copy,
  Trash2,
  History,
  FileText,
  Database,
  Layers,
  Building
} from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { AgencyPerformanceModal } from '@/components/AgencyPerformanceModal';
import { 
  teamRepository, 
  generateOrganizationCode,
  CreateUserInput, 
  UpdateUserInput,
  DeleteUserOptions,
  CreateAgencyInput, 
  CreateTeamInput,
  CreateRegionInput,
  CreateOrganizationInput
} from '@/data/repositories/teamRepository';
import { auditRepository } from '@/data/repositories/auditRepository';
import { leadRepository } from '@/data/repositories/leadRepository';
import { controlledDataService } from '@/domain/services/controlledDataService';
import { branchHierarchyService } from '@/domain/services/branchHierarchyService';
import { autoTransferService, DEFAULT_AUTO_TRANSFER_CONFIG } from '@/domain/services/autoTransferService';
import { notificationService, DEFAULT_EMAIL_CONFIG } from '@/domain/services/notificationService';
import { 
  UserProfile, 
  Agency, 
  Team, 
  Region,
  Organization,
  AuditLog, 
  UserRole,
  AutoTransferConfig,
  EmailNotificationConfig,
  NotificationLog,
  LeadStatus,
  TrashBinItem,
  ControlledAuditEntry
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
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'teams' | 'settings' | 'audit' | 'auto_transfer' | 'trash_bin' | 'audit_diff'>('users');

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [trashItems, setTrashItems] = useState<TrashBinItem[]>([]);
  const [controlledAuditLogs, setControlledAuditLogs] = useState<ControlledAuditEntry[]>([]);
  const [trashFilterType, setTrashFilterType] = useState<string>('all');
  const [directorGlobalScope, setDirectorGlobalScopeState] = useState<boolean>(() => controlledDataService.isDirectorGlobalScopeEnabled());
  const [sampleDataMsg, setSampleDataMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSampleDataOperating, setIsSampleDataOperating] = useState(false);
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);
  const [hardDeletingItemId, setHardDeletingItemId] = useState<string | null>(null);
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
  const isCompanyAdmin = currentUser?.role === 'company_admin';

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
    organization_id: '',
    region_id: '',
    agency_id: '',
    team_id: '',
    password: 'password123',
    must_change_password: true,
  });

  // Modal: Create Organization (Thành Lập Doanh Nghiệp Mới - CEO)
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isOrgCodeAutoGenerated, setIsOrgCodeAutoGenerated] = useState(true);
  const [newOrg, setNewOrg] = useState<CreateOrganizationInput>({
    name: '',
    code: '',
    tax_number: '',
    phone: '',
    email: '',
    address: '',
    ceo_id: '',
    admin_id: '',
  });

  const handleOpenCreateOrgModal = () => {
    setModalError(null);
    const autoCode = generateOrganizationCode('', organizations);
    setNewOrg({
      name: '',
      code: autoCode,
      tax_number: '',
      phone: '',
      email: '',
      address: '',
      ceo_id: '',
      admin_id: '',
    });
    setIsOrgCodeAutoGenerated(true);
    setIsOrgModalOpen(true);
  };

  const handleRegenerateOrgCode = () => {
    const autoCode = generateOrganizationCode(newOrg.name, organizations);
    setNewOrg(prev => ({ ...prev, code: autoCode }));
    setIsOrgCodeAutoGenerated(true);
  };

  // Modal: Bổ Nhiệm / Tạo Quản Trị Doanh Nghiệp (Chỉ Quản trị tổng)
  const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);
  const [selectedOrgForAdmin, setSelectedOrgForAdmin] = useState<Organization | null>(null);
  const [assignAdminMode, setAssignAdminMode] = useState<'choose_existing' | 'create_new'>('choose_existing');
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string>('');
  const [newOrgAdmin, setNewOrgAdmin] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: 'password123',
  });

  const handleOpenAssignAdminModal = (org: Organization) => {
    setSelectedOrgForAdmin(org);
    setSelectedAdminUserId(org.admin_id || '');
    setAssignAdminMode('choose_existing');
    setNewOrgAdmin({
      full_name: '',
      email: '',
      phone: '',
      password: 'password123',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsAssignAdminModalOpen(true);
  };

  // Modal: Bổ Nhiệm / Tạo Tổng Giám Đốc CEO (Chỉ Quản trị tổng)
  const [isAssignCeoModalOpen, setIsAssignCeoModalOpen] = useState(false);
  const [selectedOrgForCeo, setSelectedOrgForCeo] = useState<Organization | null>(null);
  const [assignCeoMode, setAssignCeoMode] = useState<'choose_existing' | 'create_new'>('choose_existing');
  const [selectedCeoUserId, setSelectedCeoUserId] = useState<string>('');
  const [newOrgCeo, setNewOrgCeo] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: 'password123',
  });

  const handleOpenAssignCeoModal = (org: Organization) => {
    setSelectedOrgForCeo(org);
    setSelectedCeoUserId(org.ceo_id || '');
    setAssignCeoMode('choose_existing');
    setNewOrgCeo({
      full_name: '',
      email: '',
      phone: '',
      password: 'password123',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsAssignCeoModalOpen(true);
  };

  // Modal: Edit User (Chỉnh Sửa Thông Tin Người Dùng)
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
  const [editUserForm, setEditUserForm] = useState<UpdateUserInput>({
    full_name: '',
    phone: '',
    email: '',
    role: 'sale_agent',
    organization_id: '',
    region_id: '',
    agency_id: '',
    team_id: '',
    status: 'active',
    employment_type: 'official',
  });

  // Modal: Delete User (Xóa Mềm Người Dùng & Bàn Giao)
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserProfile | null>(null);
  const [deleteUserReason, setDeleteUserReason] = useState('');
  const [handoverUserId, setHandoverUserId] = useState('');
  const [userAssignedLeadsCount, setUserAssignedLeadsCount] = useState(0);

  // Modal: Create Region (Thành Lập Vùng Kinh Doanh Mới)
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [newRegion, setNewRegion] = useState<CreateRegionInput>({
    name: '',
    code: '',
    organization_id: '',
    regional_director_id: '',
    description: '',
  });

  // Modal: Create Agency (Thêm Sàn Giao Dịch Mới)
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [newAgency, setNewAgency] = useState<CreateAgencyInput>({
    name: '',
    code: '',
    organization_id: '',
    region_id: '',
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

  // Modal: Edit & Delete Organization
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [selectedOrgForEdit, setSelectedOrgForEdit] = useState<Organization | null>(null);
  const [editOrgForm, setEditOrgForm] = useState<CreateOrganizationInput>({
    name: '',
    code: '',
    tax_number: '',
    phone: '',
    email: '',
    address: '',
    ceo_id: '',
    admin_id: '',
  });
  const [isDeleteOrgModalOpen, setIsDeleteOrgModalOpen] = useState(false);
  const [selectedOrgForDelete, setSelectedOrgForDelete] = useState<Organization | null>(null);

  // Modal: Edit & Delete Region
  const [isEditRegionModalOpen, setIsEditRegionModalOpen] = useState(false);
  const [selectedRegionForEdit, setSelectedRegionForEdit] = useState<Region | null>(null);
  const [editRegionForm, setEditRegionForm] = useState<CreateRegionInput>({
    name: '',
    code: '',
    organization_id: '',
    regional_director_id: '',
    description: '',
  });
  const [isDeleteRegionModalOpen, setIsDeleteRegionModalOpen] = useState(false);
  const [selectedRegionForDelete, setSelectedRegionForDelete] = useState<Region | null>(null);
  const [fallbackRegionId, setFallbackRegionId] = useState('');

  // Modal: Edit & Delete Agency
  const [isEditAgencyModalOpen, setIsEditAgencyModalOpen] = useState(false);
  const [selectedAgencyForEdit, setSelectedAgencyForEdit] = useState<Agency | null>(null);
  const [editAgencyForm, setEditAgencyForm] = useState<CreateAgencyInput>({
    name: '',
    code: '',
    organization_id: '',
    region_id: '',
    address: '',
    phone: '',
    email: '',
    director_id: '',
  });
  const [isDeleteAgencyModalOpen, setIsDeleteAgencyModalOpen] = useState(false);
  const [selectedAgencyForDelete, setSelectedAgencyForDelete] = useState<Agency | null>(null);
  const [fallbackAgencyId, setFallbackAgencyId] = useState('');

  // Modal: Edit & Delete Team
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [selectedTeamForEdit, setSelectedTeamForEdit] = useState<Team | null>(null);
  const [editTeamForm, setEditTeamForm] = useState<CreateTeamInput>({
    name: '',
    code: '',
    agency_id: '',
    leader_id: '',
  });
  const [isDeleteTeamModalOpen, setIsDeleteTeamModalOpen] = useState(false);
  const [selectedTeamForDelete, setSelectedTeamForDelete] = useState<Team | null>(null);
  const [fallbackTeamId, setFallbackTeamId] = useState('');

  // Modal: Bổ nhiệm / Đổi chức vụ (Promotion / Re-assignment)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserProfile | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('sale_agent');

  // Modal: Hiệu suất Sàn Giao Dịch
  const [perfAgencyId, setPerfAgencyId] = useState<string | null>(null);
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [targetAgencyId, setTargetAgencyId] = useState<string>('');
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [targetRegionId, setTargetRegionId] = useState<string>('');
  const [targetOrgId, setTargetOrgId] = useState<string>('');

  // Settings state
  const [maxLeads, setMaxLeads] = useState(30);
  const [autoReclaimHours, setAutoReclaimHours] = useState(48);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const reloadData = async () => {
    setLoading(true);
    const [uList, aList, tList, rList, oList, logs, aConfig, eConfig, nLogs] = await Promise.all([
      teamRepository.getProfiles(undefined, undefined, currentUser || undefined),
      teamRepository.getAgencies(undefined, currentUser || undefined),
      teamRepository.getTeams(undefined, currentUser || undefined),
      teamRepository.getRegions(currentUser || undefined),
      teamRepository.getOrganizations(currentUser || undefined),
      auditRepository.getAuditLogs(),
      autoTransferService.getConfig(),
      notificationService.getEmailConfig(),
      notificationService.getNotificationLogs(50),
    ]);
    setProfiles(uList);
    setAgencies(aList);
    setTeams(tList);
    setRegions(rList);
    setOrganizations(oList);
    if (isCompanyAdmin && currentUser?.organization_id) {
      const allowedUserIds = new Set(uList.map(u => u.id));
      setAuditLogs(logs.filter(l => l.user_id ? allowedUserIds.has(l.user_id) : false));
    } else {
      setAuditLogs(logs);
    }
    setAutoTransferConfig(aConfig);
    setEmailConfig(eConfig);
    setNotificationLogs(nLogs);
    if (currentUser) {
      setTrashItems(controlledDataService.getTrashBin(currentUser));
      setControlledAuditLogs(controlledDataService.getControlledAuditLogs(currentUser));
    }
    setDirectorGlobalScopeState(controlledDataService.isDirectorGlobalScopeEnabled());
    setLoading(false);
  };

  const handleRestoreTrash = async (item: TrashBinItem) => {
    if (!currentUser) return;
    setRestoringItemId(item.id);
    try {
      if (item.entity_type === 'contract' || item.entity_type === 'draft_contract') {
        controlledDataService.restoreContractFromTrash(item.entity_id, currentUser);
      } else if (item.entity_type === 'employee') {
        const res = await teamRepository.restoreUser(item.entity_id, currentUser);
        if (!res.success) {
          alert(res.error || 'Lỗi khi khôi phục nhân sự.');
          return;
        }
      } else {
        controlledDataService.restoreLeadFromTrash(item.entity_id, currentUser);
      }
      await reloadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi khôi phục đối tượng.');
    } finally {
      setRestoringItemId(null);
    }
  };

  const handleHardDeleteTrash = async (item: TrashBinItem) => {
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      alert('Chỉ Admin mới có quyền xóa vĩnh viễn khỏi Thùng rác.');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN đối tượng "${item.entity_name || item.entity_id}"? Hành động này KHÔNG THỂ HOÀN TÁC.`)) {
      return;
    }
    setHardDeletingItemId(item.id);
    try {
      controlledDataService.hardDeleteTrashItem(item.id, currentUser);
      await reloadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa vĩnh viễn đối tượng.');
    } finally {
      setHardDeletingItemId(null);
    }
  };

  const handleToggleDirectorGlobalScope = (enabled: boolean) => {
    controlledDataService.setDirectorGlobalScope(enabled);
    setDirectorGlobalScopeState(enabled);
  };

  const handleSeedSampleData = async () => {
    if (!currentUser) return;
    setIsSampleDataOperating(true);
    setSampleDataMsg(null);
    try {
      const res = await leadRepository.seedSampleLeads(currentUser);
      setSampleDataMsg({ type: 'success', text: res.message || 'Đã khởi tạo thành công dữ liệu mẫu!' });
      await reloadData();
    } catch (err: any) {
      setSampleDataMsg({ type: 'error', text: err.message || 'Lỗi khi khởi tạo dữ liệu mẫu.' });
    } finally {
      setIsSampleDataOperating(false);
    }
  };

  const handlePurgeSampleData = async () => {
    if (!currentUser) return;
    if (!window.confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu mẫu (is_sample=true) khỏi hệ thống?')) {
      return;
    }
    setIsSampleDataOperating(true);
    setSampleDataMsg(null);
    try {
      const res = await leadRepository.purgeSampleData(currentUser);
      setSampleDataMsg({
        type: 'success',
        text: res.message || 'Đã xóa toàn bộ dữ liệu mẫu thành công!'
      });
      await reloadData();
    } catch (err: any) {
      setSampleDataMsg({ type: 'error', text: err.message || 'Lỗi khi xóa dữ liệu mẫu.' });
    } finally {
      setIsSampleDataOperating(false);
    }
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
  }, [currentUser]);

  // 1. Xử lý tạo User mới
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    if (newUser.role === 'company_admin' && !newUser.organization_id) {
      setModalError('Vui lòng chọn Doanh nghiệp cho tài khoản Quản Trị Doanh Nghiệp.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await teamRepository.createUser(newUser, currentUser);
      if (result.success && result.profile) {
        setModalSuccess(`Đã tạo thành công tài khoản cho ${result.profile.full_name} (${result.profile.email})`);
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_create',
          { email: result.profile.email, role: result.profile.role, organization_id: result.profile.organization_id }
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
            organization_id: '',
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

  // 1a2. Xử lý Bổ nhiệm / Tạo Quản Trị Doanh Nghiệp cho Organization
  const handleAssignAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgForAdmin) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      if (assignAdminMode === 'choose_existing') {
        if (!selectedAdminUserId) {
          setModalError('Vui lòng chọn nhân sự để bổ nhiệm làm Quản Trị Doanh Nghiệp.');
          setIsSubmitting(false);
          return;
        }

        const res = await teamRepository.assignOrganizationAdmin(
          selectedOrgForAdmin.id,
          selectedAdminUserId,
          currentUser
        );

        if (!res.success) {
          setModalError(res.error || 'Bổ nhiệm Quản Trị Doanh Nghiệp thất bại.');
          setIsSubmitting(false);
          return;
        }

        const appointedUser = profiles.find(p => p.id === selectedAdminUserId);
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_role_change',
          {
            target_user_id: selectedAdminUserId,
            new_role: 'company_admin',
            organization_id: selectedOrgForAdmin.id,
            organization_name: selectedOrgForAdmin.name,
          }
        );

        setModalSuccess(`Đã bổ nhiệm thành công Quản Trị Doanh Nghiệp cho ${selectedOrgForAdmin.name}!`);
        await reloadData();
        setTimeout(() => {
          setIsAssignAdminModalOpen(false);
          setModalSuccess(null);
        }, 900);
      } else {
        if (!newOrgAdmin.full_name.trim() || !newOrgAdmin.email.trim() || !newOrgAdmin.phone.trim()) {
          setModalError('Vui lòng điền đầy đủ Họ tên, Email và Số điện thoại.');
          setIsSubmitting(false);
          return;
        }

        const res = await teamRepository.createUser({
          full_name: newOrgAdmin.full_name.trim(),
          email: newOrgAdmin.email.trim(),
          phone: newOrgAdmin.phone.trim(),
          password: newOrgAdmin.password || 'password123',
          role: 'company_admin',
          organization_id: selectedOrgForAdmin.id,
          must_change_password: true,
        }, currentUser);

        if (!res.success || !res.profile) {
          setModalError(res.error || 'Tạo tài khoản Quản Trị Doanh Nghiệp thất bại.');
          setIsSubmitting(false);
          return;
        }

        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_create',
          {
            email: res.profile.email,
            role: 'company_admin',
            organization_id: selectedOrgForAdmin.id,
            organization_name: selectedOrgForAdmin.name,
          }
        );

        setModalSuccess(`Đã tạo Quản Trị Doanh Nghiệp ${res.profile.full_name} (${res.profile.email})!`);
        await reloadData();
        setTimeout(() => {
          setIsAssignAdminModalOpen(false);
          setModalSuccess(null);
        }, 900);
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi phân quyền Quản Trị Doanh Nghiệp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1a2-b. Xử lý Bổ nhiệm / Tạo Tổng Giám Đốc (CEO) cho Organization
  const handleAssignCeoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgForCeo) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      if (assignCeoMode === 'choose_existing') {
        if (!selectedCeoUserId) {
          setModalError('Vui lòng chọn nhân sự để bổ nhiệm làm Tổng Giám Đốc (CEO).');
          setIsSubmitting(false);
          return;
        }

        const res = await teamRepository.assignOrganizationCEO(
          selectedOrgForCeo.id,
          selectedCeoUserId,
          currentUser
        );

        if (!res.success) {
          setModalError(res.error || 'Bổ nhiệm Tổng Giám Đốc (CEO) thất bại.');
          setIsSubmitting(false);
          return;
        }

        const appointedUser = profiles.find(p => p.id === selectedCeoUserId);
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_role_change',
          {
            target_user_id: selectedCeoUserId,
            new_role: 'ceo',
            organization_id: selectedOrgForCeo.id,
            organization_name: selectedOrgForCeo.name,
          }
        );

        setModalSuccess(`Đã bổ nhiệm thành công ${appointedUser?.full_name || 'nhân sự'} làm Tổng Giám Đốc (CEO) ${selectedOrgForCeo.name}!`);
        await reloadData();
        setTimeout(() => {
          setIsAssignCeoModalOpen(false);
          setModalSuccess(null);
        }, 900);
      } else {
        if (!newOrgCeo.full_name.trim() || !newOrgCeo.email.trim() || !newOrgCeo.phone.trim()) {
          setModalError('Vui lòng điền đầy đủ Họ tên, Email và Số điện thoại.');
          setIsSubmitting(false);
          return;
        }

        const res = await teamRepository.createUser({
          full_name: newOrgCeo.full_name.trim(),
          email: newOrgCeo.email.trim(),
          phone: newOrgCeo.phone.trim(),
          password: newOrgCeo.password || 'password123',
          role: 'ceo',
          organization_id: selectedOrgForCeo.id,
          must_change_password: true,
        }, currentUser);

        if (!res.success || !res.profile) {
          setModalError(res.error || 'Tạo tài khoản Tổng Giám Đốc (CEO) thất bại.');
          setIsSubmitting(false);
          return;
        }

        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_create',
          {
            email: res.profile.email,
            role: 'ceo',
            organization_id: selectedOrgForCeo.id,
            organization_name: selectedOrgForCeo.name,
          }
        );

        setModalSuccess(`Đã tạo và bổ nhiệm Tổng Giám Đốc cho ${res.profile.full_name} (${res.profile.email})!`);
        await reloadData();
        setTimeout(() => {
          setIsAssignCeoModalOpen(false);
          setModalSuccess(null);
        }, 900);
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi bổ nhiệm Tổng Giám Đốc (CEO).');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1a3. Xử lý Chỉnh sửa Người dùng (Edit User)
  const handleOpenEditModal = (user: UserProfile) => {
    setSelectedUserForEdit(user);
    setEditUserForm({
      full_name: user.full_name,
      phone: user.phone || '',
      email: user.email,
      role: user.role,
      organization_id: user.organization_id || '',
      region_id: user.region_id || '',
      agency_id: user.agency_id || '',
      team_id: user.team_id || '',
      status: user.status,
      employment_type: user.employment_type || 'official',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsEditUserModalOpen(true);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.updateUser(selectedUserForEdit.id, editUserForm, currentUser);
      if (res.success && res.profile) {
        setModalSuccess(`Đã cập nhật thành công thông tin cho ${res.profile.full_name}!`);
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_update',
          {
            target_user_id: selectedUserForEdit.id,
            target_email: res.profile.email,
            updated_fields: editUserForm,
          }
        );
        await reloadData();
        setTimeout(() => {
          setIsEditUserModalOpen(false);
          setModalSuccess(null);
        }, 1200);
      } else {
        setModalError(res.error || 'Cập nhật thông tin người dùng thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi cập nhật người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1a4. Xử lý Xóa Người dùng (Soft Delete User)
  const handleOpenDeleteModal = (user: UserProfile) => {
    if (user.id === realUser?.id) {
      alert('Bạn không thể tự xóa tài khoản của chính mình.');
      return;
    }
    const rawLeads = typeof localStorage !== 'undefined' ? localStorage.getItem('crm_leads') : null;
    let count = 0;
    if (rawLeads) {
      try {
        const leads = JSON.parse(rawLeads);
        count = leads.filter((l: any) => l.assigned_to === user.id && !l.deleted_at && !['contract', 'lost'].includes(l.status)).length;
      } catch (e) {
        count = 0;
      }
    }
    setUserAssignedLeadsCount(count);
    setSelectedUserForDelete(user);
    setDeleteUserReason('');
    setHandoverUserId('');
    setModalError(null);
    setModalSuccess(null);
    setIsDeleteUserModalOpen(true);
  };

  const handleDeleteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForDelete) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.deleteUser(
        selectedUserForDelete.id,
        {
          delete_reason: deleteUserReason,
          handover_user_id: handoverUserId || undefined,
        },
        currentUser
      );

      if (res.success) {
        setModalSuccess(`Đã xóa mềm thành công tài khoản của ${selectedUserForDelete.full_name}. Dữ liệu được lưu trữ trong Thùng Rác Quản Trị.`);
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'user_delete',
          {
            target_user_id: selectedUserForDelete.id,
            target_email: selectedUserForDelete.email,
            reason: deleteUserReason,
            handover_user_id: handoverUserId || null,
          }
        );
        await reloadData();
        setTimeout(() => {
          setIsDeleteUserModalOpen(false);
          setModalSuccess(null);
        }, 1200);
      } else {
        setModalError(res.error || 'Xóa nhân sự thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi xóa nhân sự.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1b. Xử lý tạo Doanh Nghiệp (CEO) mới
  const handleCreateOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      const codeToSubmit = newOrg.code?.trim() || generateOrganizationCode(newOrg.name, organizations);
      const result = await teamRepository.createOrganization({
        ...newOrg,
        code: codeToSubmit,
        ceo_id: newOrg.ceo_id || null,
        admin_id: newOrg.admin_id || null,
      }, currentUser);

      if (result.success && result.organization) {
        const createdOrg = result.organization;
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'organization_create',
          { org_code: createdOrg.code, org_name: createdOrg.name }
        );
        setModalSuccess(`Thành lập doanh nghiệp "${createdOrg.name}" thành công!`);
        await reloadData();
        setTimeout(() => {
          setIsOrgModalOpen(false);
          setModalSuccess(null);
          setNewOrg({ name: '', code: '', tax_number: '', phone: '', email: '', address: '', ceo_id: '', admin_id: '' });
          setIsOrgCodeAutoGenerated(true);
        }, 800);
      } else {
        setModalError(result.error || 'Không thể tạo doanh nghiệp mới.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi tạo doanh nghiệp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1c. Xử lý tạo Vùng Kinh Doanh mới & Bổ nhiệm Giám đốc vùng
  const handleCreateRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      const result = await teamRepository.createRegion({
        ...newRegion,
        organization_id: newRegion.organization_id || null,
        regional_director_id: newRegion.regional_director_id || null,
      }, currentUser);

      if (result.success && result.region) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'region_create',
          { region_code: result.region.code, region_name: result.region.name }
        );
        await reloadData();
        setIsRegionModalOpen(false);
        setNewRegion({ name: '', code: '', organization_id: '', regional_director_id: '', description: '' });
      } else {
        setModalError(result.error || 'Không thể tạo vùng kinh doanh mới.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi tạo vùng kinh doanh.');
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
        organization_id: newAgency.organization_id || null,
        region_id: newAgency.region_id || null,
        director_id: newAgency.director_id || null,
      }, currentUser);

      if (result.success && result.agency) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'agency_create',
          { agency_code: result.agency.code, agency_name: result.agency.name }
        );
        await reloadData();
        setIsAgencyModalOpen(false);
        setNewAgency({ name: '', code: '', organization_id: '', region_id: '', address: '', phone: '', email: '', director_id: '' });
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

  // --- 3a. Xử lý Sửa & Xóa Doanh Nghiệp (Organization) ---
  const handleOpenEditOrgModal = (org: Organization) => {
    setSelectedOrgForEdit(org);
    setEditOrgForm({
      name: org.name,
      code: org.code,
      tax_number: org.tax_number || '',
      phone: org.phone || '',
      email: org.email || '',
      address: org.address || '',
      ceo_id: org.ceo_id || '',
      admin_id: org.admin_id || '',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsEditOrgModalOpen(true);
  };

  const handleEditOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgForEdit) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.updateOrganization(selectedOrgForEdit.id, editOrgForm, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'organization_update',
          { org_id: selectedOrgForEdit.id, org_name: editOrgForm.name }
        );
        await reloadData();
        setModalSuccess('Cập nhật thông tin Doanh nghiệp thành công!');
        setTimeout(() => {
          setIsEditOrgModalOpen(false);
          setModalSuccess(null);
        }, 800);
      } else {
        setModalError(res.error || 'Cập nhật Doanh nghiệp thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi cập nhật Doanh nghiệp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteOrgModal = (org: Organization) => {
    setSelectedOrgForDelete(org);
    setModalError(null);
    setIsDeleteOrgModalOpen(true);
  };

  const handleDeleteOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgForDelete) return;
    setModalError(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.deleteOrganization(selectedOrgForDelete.id, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'organization_delete',
          { org_id: selectedOrgForDelete.id, org_name: selectedOrgForDelete.name }
        );
        await reloadData();
        setIsDeleteOrgModalOpen(false);
      } else {
        setModalError(res.error || 'Xóa Doanh nghiệp thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi xóa Doanh nghiệp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 3b. Xử lý Sửa & Xóa Vùng Kinh Doanh (Region) ---
  const handleOpenEditRegionModal = (reg: Region) => {
    setSelectedRegionForEdit(reg);
    setEditRegionForm({
      name: reg.name,
      code: reg.code,
      organization_id: reg.organization_id || '',
      regional_director_id: reg.regional_director_id || '',
      description: reg.description || '',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsEditRegionModalOpen(true);
  };

  const handleEditRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegionForEdit) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.updateRegion(selectedRegionForEdit.id, {
        name: editRegionForm.name,
        code: editRegionForm.code,
        description: editRegionForm.description,
        regional_director_id: editRegionForm.regional_director_id || undefined,
        organization_id: editRegionForm.organization_id || undefined,
      }, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'region_update',
          { region_id: selectedRegionForEdit.id, region_name: editRegionForm.name }
        );
        await reloadData();
        setModalSuccess('Cập nhật Vùng kinh doanh thành công!');
        setTimeout(() => {
          setIsEditRegionModalOpen(false);
          setModalSuccess(null);
        }, 800);
      } else {
        setModalError(res.error || 'Cập nhật Vùng kinh doanh thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi cập nhật Vùng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteRegionModal = (reg: Region) => {
    setSelectedRegionForDelete(reg);
    const otherRegs = regions.filter(r => r.id !== reg.id);
    setFallbackRegionId(otherRegs.length > 0 ? otherRegs[0].id : 'REG-DEFAULT');
    setModalError(null);
    setIsDeleteRegionModalOpen(true);
  };

  const handleDeleteRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegionForDelete) return;
    setModalError(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.deleteRegion(selectedRegionForDelete.id, fallbackRegionId, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'region_delete',
          { region_id: selectedRegionForDelete.id, region_name: selectedRegionForDelete.name, fallbackRegionId }
        );
        await reloadData();
        setIsDeleteRegionModalOpen(false);
      } else {
        setModalError(res.error || 'Xóa Vùng kinh doanh thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi xóa Vùng kinh doanh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 3c. Xử lý Sửa & Xóa Sàn Giao Dịch (Agency) ---
  const handleOpenEditAgencyModal = (agency: Agency) => {
    setSelectedAgencyForEdit(agency);
    setEditAgencyForm({
      name: agency.name,
      code: agency.code,
      organization_id: agency.organization_id || '',
      region_id: agency.region_id || '',
      director_id: agency.director_id || '',
      phone: agency.phone || '',
      email: agency.email || '',
      address: agency.address || '',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsEditAgencyModalOpen(true);
  };

  const handleEditAgencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgencyForEdit) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.updateAgency(selectedAgencyForEdit.id, editAgencyForm, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'agency_update',
          { agency_id: selectedAgencyForEdit.id, agency_name: editAgencyForm.name }
        );
        await reloadData();
        setModalSuccess('Cập nhật Sàn giao dịch thành công!');
        setTimeout(() => {
          setIsEditAgencyModalOpen(false);
          setModalSuccess(null);
        }, 800);
      } else {
        setModalError(res.error || 'Cập nhật Sàn giao dịch thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi cập nhật Sàn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteAgencyModal = (agency: Agency) => {
    setSelectedAgencyForDelete(agency);
    const otherAgencies = agencies.filter(a => a.id !== agency.id);
    setFallbackAgencyId(otherAgencies.length > 0 ? otherAgencies[0].id : '');
    setModalError(null);
    setIsDeleteAgencyModalOpen(true);
  };

  const handleDeleteAgencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgencyForDelete) return;
    setModalError(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.deleteAgency(selectedAgencyForDelete.id, fallbackAgencyId || undefined, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'agency_delete',
          { agency_id: selectedAgencyForDelete.id, agency_name: selectedAgencyForDelete.name, fallbackAgencyId }
        );
        await reloadData();
        setIsDeleteAgencyModalOpen(false);
      } else {
        setModalError(res.error || 'Xóa Sàn giao dịch thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi xóa Sàn giao dịch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 3d. Xử lý Sửa & Xóa Đội Nhóm Kinh Doanh (Team) ---
  const handleOpenEditTeamModal = (team: Team) => {
    setSelectedTeamForEdit(team);
    setEditTeamForm({
      name: team.name,
      code: team.code,
      agency_id: team.agency_id,
      leader_id: team.leader_id || '',
    });
    setModalError(null);
    setModalSuccess(null);
    setIsEditTeamModalOpen(true);
  };

  const handleEditTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForEdit) return;
    setModalError(null);
    setModalSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.updateTeam(selectedTeamForEdit.id, editTeamForm, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'team_update',
          { team_id: selectedTeamForEdit.id, team_name: editTeamForm.name }
        );
        await reloadData();
        setModalSuccess('Cập nhật Đội nhóm thành công!');
        setTimeout(() => {
          setIsEditTeamModalOpen(false);
          setModalSuccess(null);
        }, 800);
      } else {
        setModalError(res.error || 'Cập nhật Đội nhóm thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi hệ thống khi cập nhật Team.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteTeamModal = (team: Team) => {
    setSelectedTeamForDelete(team);
    const otherTeams = teams.filter(t => t.id !== team.id && t.agency_id === team.agency_id);
    setFallbackTeamId(otherTeams.length > 0 ? otherTeams[0].id : '');
    setModalError(null);
    setIsDeleteTeamModalOpen(true);
  };

  const handleDeleteTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForDelete) return;
    setModalError(null);
    setIsSubmitting(true);

    try {
      const res = await teamRepository.deleteTeam(selectedTeamForDelete.id, fallbackTeamId || undefined, currentUser);
      if (res.success) {
        auditRepository.logAction(
          realUser?.id || currentUser!.id,
          realUser?.full_name || currentUser!.full_name,
          'team_delete',
          { team_id: selectedTeamForDelete.id, team_name: selectedTeamForDelete.name, fallbackTeamId }
        );
        await reloadData();
        setIsDeleteTeamModalOpen(false);
      } else {
        setModalError(res.error || 'Xóa Đội nhóm thất bại.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi xóa Đội nhóm.');
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
    setTargetRegionId(user.region_id || '');
    setTargetOrgId(user.organization_id || '');
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
        targetTeamId || null,
        targetRegionId || null,
        targetOrgId || null
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
    if (currentUser?.role !== 'admin') {
      if (currentUser?.organization_id && p.organization_id && p.organization_id !== currentUser.organization_id) return false;
      if (!branchHierarchyService.canAccessUser(currentUser, p)) return false;
    }
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
                  {isCompanyAdmin ? 'Trung Tâm Quản Trị Doanh Nghiệp (Enterprise Admin)' : 'Trung Tâm Quản Trị Hệ Thống (Admin Control Center)'}
                </h2>
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${isCompanyAdmin ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                  {isCompanyAdmin ? 'Quản Trị Doanh Nghiệp' : 'Chỉ Dành Cho Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isCompanyAdmin 
                  ? 'Quản lý cấu hình, người dùng, tạo sàn giao dịch, thành lập đội nhóm kinh doanh trong doanh nghiệp.'
                  : 'Quản lý người dùng, tạo sàn giao dịch, thành lập đội nhóm kinh doanh và bổ nhiệm chức danh lãnh đạo.'}
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
                  if (isCompanyAdmin && currentUser?.organization_id) {
                    setNewUser(prev => ({ ...prev, organization_id: currentUser.organization_id || '' }));
                  }
                  setIsCreateModalOpen(true);
                }}
                className="font-semibold text-xs py-2 shadow-sm"
              >
                <UserPlus className="h-4 w-4 mr-1.5" /> Thêm người dùng mới
              </Button>
            )}

            {activeTab === 'teams' && (
              <div className="flex flex-wrap items-center gap-2">
                {!isCompanyAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenCreateOrgModal}
                    className="font-semibold text-xs py-2 shadow-sm border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                  >
                    <Crown className="h-4 w-4 mr-1.5 text-amber-500" /> Thêm Doanh Nghiệp (CEO)
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModalError(null);
                    setIsRegionModalOpen(true);
                  }}
                  className="font-semibold text-xs py-2 shadow-sm border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100"
                >
                  <Layers className="h-4 w-4 mr-1.5 text-purple-600" /> Thêm Vùng Kinh Doanh
                </Button>
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
            { id: 'teams', label: isCompanyAdmin ? `Cơ Cấu Tổ Chức (${regions.length} Vùng • ${agencies.length} Sàn • ${teams.length} Team)` : `Cơ cấu Tổ Chức (${organizations.length} DN • ${regions.length} Vùng • ${agencies.length} Sàn • ${teams.length} Team)`, icon: Building2 },
            { id: 'permissions', label: 'Ma Trận Phân Quyền 10 Vai Trò', icon: KeyRound },
            ...(!isCompanyAdmin ? [
              { id: 'auto_transfer', label: 'Tự Động Chuyển Lead & Email', icon: Clock },
              { id: 'trash_bin', label: `Thùng Rác Quản Trị (${trashItems.length})`, icon: Trash2 },
              { id: 'audit_diff', label: 'Nhật Ký Kiểm Toán (Audit Diff)', icon: History },
              { id: 'settings', label: 'Cấu hình Hệ thống', icon: Sliders },
              { id: 'audit', label: 'Nhật ký Bảo mật (Audit)', icon: ShieldAlert },
            ] : [
              { id: 'trash_bin', label: `Thùng Rác (${trashItems.length})`, icon: Trash2 },
              { id: 'audit', label: 'Nhật ký Hoạt động', icon: ShieldAlert },
            ])
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
                            ) : p.status === 'locked' ? (
                              <Badge variant="danger">Đã khóa</Badge>
                            ) : (
                              <Badge variant="warning">Ngừng HĐ</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditModal(p)}
                              className="text-[11px] py-1 px-2 border-slate-300 text-slate-700 hover:bg-slate-100"
                              title="Chỉnh sửa thông tin, vai trò, phòng ban"
                            >
                              <Edit className="h-3 w-3 mr-1 text-slate-500" /> Sửa
                            </Button>
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
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={p.id === realUser?.id || (p.role === 'admin' && profiles.filter(x => x.role === 'admin' && x.status === 'active').length <= 1)}
                              onClick={() => handleOpenDeleteModal(p)}
                              className="text-[11px] py-1 px-2"
                              title={p.id === realUser?.id ? 'Không thể tự xóa tài khoản của bạn' : 'Xóa mềm tài khoản có bàn giao khách hàng'}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Xóa
                            </Button>
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

      {/* 3. TAB 2: TEAMS, AGENCIES, REGIONS & ORGANIZATIONS MANAGEMENT */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          {/* 1. DOANH NGHIỆP / TỔ CHỨC (CEO) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  {isCompanyAdmin 
                    ? `Thông Tin Doanh Nghiệp Quản Trị (${organizations.length === 1 ? organizations[0].name : '1 Doanh Nghiệp'})`
                    : `Danh Sách Doanh Nghiệp & Tổng Giám Đốc (CEO) (${organizations.length} Doanh Nghiệp)`}
                </CardTitle>
                <p className="text-xs text-slate-500">
                  {isCompanyAdmin
                    ? 'Thông tin pháp lý và ban lãnh đạo điều hành doanh nghiệp của bạn.'
                    : 'Cấp quản trị cao nhất, mỗi doanh nghiệp có CEO trực tiếp điều hành toàn bộ các Vùng, Sàn, Marketing và HR.'}
                </p>
              </div>
              {!isCompanyAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenCreateOrgModal}
                  className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Doanh Nghiệp (CEO)
                </Button>
              )}
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {organizations.map((org) => {
                const ceo = profiles.find(p => p.role === 'ceo' && p.organization_id === org.id) || profiles.find(p => p.id === org.ceo_id);
                const compAdmin = profiles.find(p => p.role === 'company_admin' && p.organization_id === org.id) || profiles.find(p => p.id === org.admin_id);
                const regionsInOrg = regions.filter(r => r.organization_id === org.id);
                const agenciesInOrg = agencies.filter(a => a.organization_id === org.id);
                const staffInOrg = profiles.filter(p => p.organization_id === org.id);

                return (
                  <div key={org.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 transition-all shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="info" className="mb-1 text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">{org.code}</Badge>
                          <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{org.name}</h3>
                        </div>
                        <Badge variant="success">Hoạt động</Badge>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>Tổng Giám Đốc (CEO): <strong className="text-indigo-950 font-bold">{ceo?.full_name || org.ceo_name || '(Chưa bổ nhiệm)'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Quản Trị DN (Admin): <strong className="text-blue-950 font-bold">{compAdmin?.full_name || org.admin_name || '(Chưa bổ nhiệm)'}</strong></span>
                        </div>
                        {org.tax_number && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="font-mono">MST: {org.tax_number}</span>
                          </div>
                        )}
                        {org.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{org.phone}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 truncate">
                          {org.address || 'Chưa có địa chỉ trụ sở'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span><strong>{regionsInOrg.length}</strong> Vùng • <strong>{agenciesInOrg.length}</strong> Sàn • <strong>{staffInOrg.length}</strong> Nhân sự</span>
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Khối DN</span>
                    </div>

                    {currentUser?.role === 'admin' && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditOrgModal(org)}
                            className="text-xs text-blue-700 hover:bg-blue-50 px-2 py-1 h-7 font-medium"
                            title="Sửa thông tin Doanh nghiệp"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Sửa
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDeleteOrgModal(org)}
                            className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 h-7 font-medium"
                            title="Xóa Doanh nghiệp"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAssignAdminModal(org)}
                            className="text-xs text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100 font-medium"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-blue-600" />
                            {compAdmin ? 'Đổi Quản Trị DN' : 'Quản Trị DN'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAssignCeoModal(org)}
                            className="text-xs text-amber-700 border-amber-200 bg-amber-50/50 hover:bg-amber-100 font-medium"
                          >
                            <Crown className="h-3.5 w-3.5 mr-1 text-amber-600" />
                            {ceo ? 'Đổi CEO' : 'Bổ nhiệm CEO'}
                          </Button>
                        </div>
                      </div>
                    )}
                    {currentUser && ['company_admin', 'ceo'].includes(currentUser.role) && currentUser.organization_id === org.id && currentUser.role !== 'admin' && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditOrgModal(org)}
                          className="text-xs text-slate-700 border-slate-200 hover:bg-slate-50 font-medium"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1 text-slate-600" /> Chỉnh Sửa Thông Tin DN
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 2. VÙNG KINH DOANH (REGIONS) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600" />
                  Danh Sách Vùng Kinh Doanh ({regions.length} Vùng)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Quản lý tập trung các Sàn giao dịch theo khu vực địa lý do Giám Đốc Vùng điều phối.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setModalError(null);
                  setIsRegionModalOpen(true);
                }}
                className="text-xs border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100 font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Vùng Kinh Doanh
              </Button>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {regions.map((reg) => {
                const director = profiles.find(p => p.id === reg.regional_director_id);
                const parentOrg = organizations.find(o => o.id === reg.organization_id);
                const agenciesInReg = agencies.filter(a => a.region_id === reg.id);
                const staffInReg = profiles.filter(p => p.region_id === reg.id);

                return (
                  <div key={reg.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-400 transition-all shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="info" className="mb-1 text-[10px] bg-purple-50 text-purple-700 border-purple-200">{reg.code}</Badge>
                          <h3 className="text-sm font-bold text-slate-900">{reg.name}</h3>
                        </div>
                        <Badge variant="success">Hoạt động</Badge>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span>Giám Đốc Vùng: <strong className="text-purple-950 font-bold">{director?.full_name || reg.regional_director_name || '(Chưa bổ nhiệm)'}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Trực thuộc: <span className="font-semibold text-slate-700">{parentOrg?.name || 'Tập đoàn'}</span>
                        </div>
                        {reg.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-2">
                            {reg.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span><strong>{agenciesInReg.length}</strong> Sàn • <strong>{staffInReg.length}</strong> Nhân sự</span>
                      <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">Cấp Vùng</span>
                    </div>

                    {(currentUser?.role === 'admin' || (['company_admin', 'ceo'].includes(currentUser?.role || '') && currentUser?.organization_id === reg.organization_id)) && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditRegionModal(reg)}
                          className="text-xs text-purple-700 hover:bg-purple-50 px-2 py-1 h-7 font-medium"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Sửa Vùng
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDeleteRegionModal(reg)}
                          className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 h-7 font-medium"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa Vùng
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 3. SÀN PHÂN PHỐI */}
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
                className="text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Sàn Giao Dịch
              </Button>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {agencies.map((a) => {
                const teamsInAgency = teams.filter(t => t.agency_id === a.id);
                const salesInAgency = profiles.filter(p => p.agency_id === a.id);
                const regionObj = regions.find(r => r.id === a.region_id);

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
                        <div className="text-[11px] text-slate-500">
                          Vùng: <span className="font-semibold text-slate-700">{regionObj?.name || a.region_name || 'Chưa gán vùng'}</span>
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

                    {(currentUser?.role === 'admin' || ['company_admin', 'ceo', 'director'].includes(currentUser?.role || '')) && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditAgencyModal(a)}
                          className="text-xs text-blue-700 hover:bg-blue-50 px-2 py-1 h-7 font-medium"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Sửa Sàn
                        </Button>
                        {['admin', 'company_admin', 'ceo'].includes(currentUser?.role || '') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDeleteAgencyModal(a)}
                            className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 h-7 font-medium"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa Sàn
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 4. ĐỘI NHÓM KINH DOANH (TEAMS) */}
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
                className="text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Team Kinh Doanh
              </Button>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
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

                    {(currentUser?.role === 'admin' || ['company_admin', 'ceo', 'director', 'sales_manager'].includes(currentUser?.role || '')) && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditTeamModal(t)}
                          className="text-xs text-blue-700 hover:bg-blue-50 px-2 py-1 h-7 font-medium"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Sửa Team
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDeleteTeamModal(t)}
                          className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 h-7 font-medium"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa Team
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* 4. TAB 3: PERMISSION MATRIX 9 VAI TRÒ */}
      {activeTab === 'permissions' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-sm">Ma Trận Phân Quyền Toàn Diện Theo 10 Vai Trò (RBAC & Multi-tenant)</CardTitle>
                <p className="text-xs text-slate-500">
                  Quy định chi tiết phạm vi dữ liệu và quyền hạn của Quản trị viên Kỹ thuật, Quản Trị Doanh Nghiệp, Tổng Giám Đốc, Giám Đốc Vùng, Giám Đốc Sàn, Giám Đốc Marketing, Giám Đốc HR, Trưởng Phòng, Trưởng Nhóm và Chuyên Viên Tư Vấn.
                </p>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4 text-left">Chức năng & Màn hình</th>
                  <th className="bg-blue-50/60 text-blue-800">Admin (Quản trị tổng)</th>
                  <th className="bg-sky-50/60 text-sky-800">Quản Trị DN (Company Admin)</th>
                  <th className="bg-indigo-50/60 text-indigo-800">CEO (Tổng GĐ)</th>
                  <th className="bg-purple-50/60 text-purple-800">GĐ Vùng (Regional)</th>
                  <th>GĐ Sàn (Director)</th>
                  <th>Marketing</th>
                  <th>HR Admin</th>
                  <th>Trưởng Phòng (Sales Mgr)</th>
                  <th>Team Leader (Trưởng nhóm)</th>
                  <th>Sale Agent (Tư vấn)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {[
                  { name: 'Dashboard KPI & Báo cáo', a: 'Toàn hệ thống (Tất cả CEO)', ca: 'Toàn DN (Cô lập chéo)', ceo: 'Toàn DN (Cô lập chéo)', rd: 'Toàn vùng phụ trách', d: 'Toàn sàn phụ trách', m: 'Toàn DN trực thuộc', hr: 'Toàn DN trực thuộc', sm: 'Theo sàn & các team', tl: 'Chỉ trong team', sa: 'Cá nhân' },
                  { name: 'Phạm vi xem Lead (RLS)', a: 'Tất cả 100%', ca: 'Toàn DN thuộc quyền', ceo: 'Toàn DN thuộc quyền', rd: 'Toàn vùng phụ trách', d: 'Toàn sàn phụ trách', m: 'Toàn DN (Ẩn SĐT NĐ 13)', hr: 'Toàn DN (HR)', sm: 'Toàn sàn phụ trách', tl: 'Lead thuộc team', sa: 'Chỉ Lead được giao' },
                  { name: 'Kéo thả Journey & Xác nhận Deal', a: true, ca: true, ceo: true, rd: true, d: true, m: false, hr: false, sm: true, tl: true, sa: true },
                  { name: 'Tạo Doanh Nghiệp, Vùng, Sàn, Team', a: 'Toàn quyền', ca: 'Vùng/Sàn/Team DN (Không tạo CEO/DN)', ceo: 'Vùng/Sàn/Team DN', rd: false, d: false, m: false, hr: false, sm: false, tl: false, sa: false },
                  { name: 'Duyệt HĐMB Maker-Checker đa tầng', a: 'Toàn quyền (L1/L2/L3)', ca: 'Duyệt nội bộ DN', ceo: 'Duyệt L3 (>15 tỷ)', rd: 'Duyệt L2 (5-15 tỷ)', d: 'Duyệt L1 (<5 tỷ)', m: false, hr: false, sm: 'Kiểm tra hồ sơ', tl: 'Đề xuất', sa: false },
                  { name: 'Xem SĐT & CCCD Nhân sự (NĐ 13)', a: 'Đầy đủ 100%', ca: 'Đầy đủ 100% DN', ceo: 'Đầy đủ 100%', rd: 'Đầy đủ vùng', d: 'Đầy đủ sàn', m: 'Đầy đủ DN', hr: 'Toàn quyền xem & sửa', sm: 'Đầy đủ sàn', tl: 'Đầy đủ team', sa: 'Đầy đủ cá nhân' },
                  { name: 'Bổ nhiệm Leader & Quản lý Team', a: true, ca: true, ceo: true, rd: 'Đề xuất', d: true, m: false, hr: 'Thực thi hồ sơ', sm: true, tl: false, sa: false },
                  { name: 'Quản trị Marketing Ads & CPL', a: true, ca: 'Xem ROI/CPL', ceo: 'Xem ROI/CPL', rd: 'Xem vùng', d: 'Xem sàn', m: 'Toàn quyền quản trị', hr: false, sm: false, tl: false, sa: false },
                  { name: 'Quản lý Vòng đời HR (ATS & Phép)', a: true, ca: 'Duyệt cấp cao DN', ceo: 'Duyệt cấp cao', rd: 'Duyệt nghỉ vùng', d: 'Duyệt nghỉ sàn', m: 'Duyệt MKT', hr: 'Toàn quyền vận hành', sm: 'Duyệt phòng', tl: 'Duyệt nhóm', sa: 'Đệ trình đơn' },
                  { name: 'Chuyển đổi góc nhìn (Impersonate)', a: 'Chỉ Admin', ca: false, ceo: false, rd: false, d: false, m: false, hr: false, sm: false, tl: false, sa: false },
                  { name: 'Cấu hình tham số & Xem Audit Logs', a: 'Chỉ Admin', ca: 'Cấu hình DN', ceo: false, rd: false, d: false, m: false, hr: false, sm: false, tl: false, sa: false },
                  { name: 'Xóa vĩnh viễn Thùng rác (Hard Delete)', a: 'Chỉ Admin', ca: false, ceo: false, rd: false, d: false, m: false, hr: false, sm: false, tl: false, sa: false },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-left font-semibold text-slate-900">{row.name}</td>
                    <td className="py-3 px-2 font-bold text-blue-700 bg-blue-50/40">
                      {typeof row.a === 'boolean' ? (row.a ? '✓ Toàn quyền' : '-') : row.a}
                    </td>
                    <td className="py-3 px-2 font-bold text-sky-700 bg-sky-50/30">
                      {typeof row.ca === 'boolean' ? (row.ca ? '✓ Có' : '-') : row.ca}
                    </td>
                    <td className="py-3 px-2 font-bold text-indigo-700 bg-indigo-50/30">
                      {typeof row.ceo === 'boolean' ? (row.ceo ? '✓ Có' : '-') : row.ceo}
                    </td>
                    <td className="py-3 px-2 font-semibold text-purple-700 bg-purple-50/20">
                      {typeof row.rd === 'boolean' ? (row.rd ? '✓ Có' : '-') : row.rd}
                    </td>
                    <td className="py-3 px-2 font-medium">{typeof row.d === 'boolean' ? (row.d ? '✓ Có' : '-') : row.d}</td>
                    <td className="py-3 px-2">{typeof row.m === 'boolean' ? (row.m ? '✓ Có' : '-') : row.m}</td>
                    <td className="py-3 px-2">{typeof row.hr === 'boolean' ? (row.hr ? '✓ Có' : '-') : row.hr}</td>
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
        <div className="space-y-6">
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

        {/* CẤU HÌNH PHẠM VI GIÁM ĐỐC SÀN */}
        <Card className="max-w-2xl mt-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Quyền Hạn & Phạm Vi Quản Trị Của Giám Đốc Sàn (Director Scope)
            </CardTitle>
          </CardHeader>
          <div className="p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="space-y-1 pr-4">
                <div className="font-bold text-slate-800">
                  Mở rộng phạm vi Giám đốc Sàn ra Toàn hệ thống (director_global_scope)
                </div>
                <div className="text-[11px] text-slate-500">
                  Mặc định (Tắt): Giám đốc Sàn chỉ quản lý nhân sự, lead, khách hàng và hợp đồng thuộc Sàn của mình.
                  Khi bật: Giám đốc Sàn có quyền xem và quản lý dữ liệu toàn công ty (ngoại trừ sửa/xóa Admin hoặc Giám đốc Sàn khác).
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={directorGlobalScope}
                  onChange={(e) => handleToggleDirectorGlobalScope(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* QUẢN LÝ DỮ LIỆU MẪU */}
        <Card className="max-w-2xl mt-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-600" />
              Quản Lý Dữ Liệu Mẫu (Sample Data Seeding & Purge)
            </CardTitle>
          </CardHeader>
          <div className="p-5 space-y-4 text-xs">
            {sampleDataMsg && (
              <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                sampleDataMsg.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {sampleDataMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{sampleDataMsg.text}</span>
              </div>
            )}

            <p className="text-slate-600 leading-relaxed">
              Dữ liệu mẫu (10 Lead kèm Khách hàng và Hợp đồng phân bổ đều qua 10 trạng thái) được gắn nhãn <span className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">is_sample = true</span> để phục vụ đào tạo và kiểm thử. Dữ liệu mẫu được miễn trừ gửi email thật và phạt SLA.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isSampleDataOperating}
                onClick={handleSeedSampleData}
                className="text-xs text-purple-700 border-purple-300 hover:bg-purple-50"
              >
                <Sparkles className="h-4 w-4 mr-1.5 text-purple-600" />
                {isSampleDataOperating ? 'Đang khởi tạo...' : 'Khởi Tạo 10 Lead Mẫu & HĐMB'}
              </Button>

              {currentUser?.role === 'admin' && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isSampleDataOperating}
                  onClick={handlePurgeSampleData}
                  className="text-xs"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  {isSampleDataOperating ? 'Đang xóa...' : 'Xóa Toàn Bộ Dữ Liệu Mẫu'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
      )}

      {/* TAB: THÙNG RÁC QUẢN TRỊ (TRASH BIN) */}
      {activeTab === 'trash_bin' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600" />
                Thùng Rác Quản Trị Hệ Thống (Trash Bin)
              </CardTitle>
              <p className="text-xs text-slate-500">
                Lưu trữ các Lead, Hợp đồng, Team đã bị xóa mềm. Admin và Giám đốc Sàn có thể khôi phục an toàn. Admin có quyền xóa vĩnh viễn.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={trashFilterType}
                onChange={(e) => setTrashFilterType(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả loại đối tượng ({trashItems.length})</option>
                <option value="lead">Khách hàng / Lead</option>
                <option value="contract">Hợp đồng giao dịch</option>
                <option value="draft_contract">Hợp đồng dự thảo</option>
                <option value="team">Đội nhóm kinh doanh</option>
                <option value="employee">Nhân sự</option>
              </select>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-y">
                  <th className="py-2.5 px-4">Loại Đối Tượng</th>
                  <th className="py-2.5 px-4">Tên / Mã Đối Tượng</th>
                  <th className="py-2.5 px-4">Người Xóa</th>
                  <th className="py-2.5 px-4">Thời Gian Xóa</th>
                  <th className="py-2.5 px-4">Lý Do Xóa</th>
                  <th className="py-2.5 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trashItems
                  .filter(item => trashFilterType === 'all' || item.entity_type === trashFilterType)
                  .length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Thùng rác hiện đang trống. Chưa có đối tượng nào bị xóa mềm.
                    </td>
                  </tr>
                ) : (
                  trashItems
                    .filter(item => trashFilterType === 'all' || item.entity_type === trashFilterType)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.entity_type === 'contract' ? 'bg-amber-100 text-amber-800' :
                            item.entity_type === 'lead' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {item.entity_type === 'contract' ? 'Hợp Đồng' :
                             item.entity_type === 'lead' ? 'Khách/Lead' :
                             item.entity_type === 'team' ? 'Đội Nhóm' : item.entity_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          <div>{item.entity_name || item.entity_id}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.entity_id}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 font-medium">
                          {item.deleted_by_name || item.deleted_by}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                          {formatDate(item.deleted_at)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate" title={item.delete_reason}>
                          {item.delete_reason || 'Không ghi rõ'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 py-1 px-2.5"
                              disabled={restoringItemId === item.id}
                              onClick={() => handleRestoreTrash(item)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {restoringItemId === item.id ? 'Đang khôi phục...' : 'Khôi phục'}
                            </Button>
                            {currentUser?.role === 'admin' && (
                              <Button
                                variant="danger"
                                size="sm"
                                className="text-xs py-1 px-2.5"
                                disabled={hardDeletingItemId === item.id}
                                onClick={() => handleHardDeleteTrash(item)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {hardDeletingItemId === item.id ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB: NHẬT KÝ KIỂM TOÁN CÓ SO SÁNH (AUDIT DIFF) */}
      {activeTab === 'audit_diff' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-600" />
              Nhật Ký Kiểm Toán Thay Đổi Có Đối Chiếu Dữ Liệu (Audit Diff)
            </CardTitle>
            <p className="text-xs text-slate-500">
              Ghi nhận chi tiết từng trường dữ liệu trước (Before) và sau (After) của các thao tác có kiểm soát (Sửa, Xóa mềm, Khôi phục, Batch).
            </p>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-y">
                  <th className="py-2.5 px-4">Thời Gian</th>
                  <th className="py-2.5 px-4">Người Thực Hiện</th>
                  <th className="py-2.5 px-4">Hành Động</th>
                  <th className="py-2.5 px-4">Đối Tượng</th>
                  <th className="py-2.5 px-4">Lý Do Nghiệp Vụ</th>
                  <th className="py-2.5 px-4">Chi Tiết Thay Đổi (Diffs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {controlledAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Chưa có sự kiện kiểm toán có kiểm soát nào.
                    </td>
                  </tr>
                ) : (
                  controlledAuditLogs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 align-top">
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{log.operator_name || log.operator_id}</div>
                        <div className="text-[10px] text-slate-400 font-mono capitalize">{log.operator_role}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className={`text-[10px] font-mono ${
                          log.action === 'soft_delete' ? 'text-rose-700 border-rose-300 bg-rose-50' :
                          log.action === 'restore' ? 'text-emerald-700 border-emerald-300 bg-emerald-50' :
                          'text-blue-700 border-blue-300 bg-blue-50'
                        }`}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-slate-800 capitalize">{log.entity_type}</span>
                        <div className="text-[10px] text-slate-400 font-mono">{log.entity_id}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-xs">
                        {log.reason || '---'}
                      </td>
                      <td className="py-2.5 px-4">
                        {log.diffs && log.diffs.length > 0 ? (
                          <div className="space-y-1 font-mono text-[10px]">
                            {log.diffs.map((d, idx) => (
                              <div key={idx} className="p-1.5 bg-slate-50 rounded border border-slate-200">
                                <span className="font-bold text-slate-700">{d.field}:</span>{' '}
                                <span className="text-rose-600 line-through mr-1">
                                  {typeof d.old_value === 'object' ? JSON.stringify(d.old_value) : String(d.old_value ?? 'null')}
                                </span>
                                →{' '}
                                <span className="text-emerald-700 font-semibold">
                                  {typeof d.new_value === 'object' ? JSON.stringify(d.new_value) : String(d.new_value ?? 'null')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Không có diff chi tiết</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                      Phương Thức Gửi Email & Webhook Tự Động (Chạy Ngầm 24/7):
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEmailConfig({ ...emailConfig, dispatch_mode: 'google_apps_script', provider: 'google_apps_script' })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          (emailConfig.dispatch_mode || 'google_apps_script') === 'google_apps_script'
                            ? 'border-indigo-600 bg-indigo-50/80 font-semibold text-indigo-950 shadow-sm ring-1 ring-indigo-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-indigo-800 font-bold mb-1">
                          <Sparkles className="h-4 w-4 text-indigo-600" />
                          Google Apps Script (Khuyên Dùng)
                        </div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          Tự động gửi email 24/7 qua chính Gmail của bạn. Miễn phí 100%, không cần App Password, không bao giờ bị chặn!
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmailConfig({ ...emailConfig, dispatch_mode: 'resend_api', provider: 'resend' })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          emailConfig.dispatch_mode === 'resend_api'
                            ? 'border-purple-600 bg-purple-50/80 font-semibold text-purple-950 shadow-sm ring-1 ring-purple-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-purple-800 font-bold mb-1">
                          <Send className="h-4 w-4 text-purple-600" />
                          Resend API (Tự Động)
                        </div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          Miễn phí 3.000 email/tháng, chỉ cần 1 API key, chạy ngầm tự động độc lập với Google.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmailConfig({ ...emailConfig, dispatch_mode: 'server_smtp', provider: 'gmail_smtp', smtp_host: 'smtp.gmail.com', smtp_port: 465 })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          emailConfig.dispatch_mode === 'server_smtp'
                            ? 'border-blue-600 bg-blue-50/80 font-semibold text-blue-950 shadow-sm ring-1 ring-blue-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-blue-800 font-bold mb-1">
                          <Mail className="h-4 w-4 text-blue-600" />
                          Gmail SMTP Server
                        </div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          Dành cho tài khoản cá nhân có thể tạo Google App Password 16 ký tự.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Giải thích khi Google báo lỗi App Password */}
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      Lưu ý về tài khoản Google:
                    </div>
                    <p className="leading-relaxed">
                      Nếu tài khoản của bạn là email công ty (Google Workspace) và bị khóa tính năng tạo App Password, hãy chọn chế độ <strong>"Google Apps Script"</strong> bên trên để hệ thống tự động gửi email hoàn toàn miễn phí mà không cần mật khẩu ứng dụng.
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

                      <div className="pt-2 border-t border-indigo-100">
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          URL Webhook Mở Rộng (Tùy chọn - Bắn thông báo đến Nhóm Zalo / Telegram / Make / Zapier):
                        </label>
                        <input
                          type="url"
                          value={emailConfig.custom_webhook_url || ''}
                          onChange={(e) => setEmailConfig({ ...emailConfig, custom_webhook_url: e.target.value })}
                          placeholder="https://webhook.site/... hoặc https://api.telegram.org/bot.../sendMessage"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white font-mono"
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Tự động gửi payload JSON (sự kiện, tên lead, SĐT, sale nhận, hạn 24h) tới bot chat hoặc hệ thống bên thứ ba mỗi khi đảo lead.
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

          {newUser.role === 'company_admin' && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold">Tài khoản Quản Trị Doanh Nghiệp (Company Admin)</p>
                <p className="text-[11px] text-blue-700 mt-0.5">Tài khoản này sẽ toàn quyền quản trị cấu hình, nhân sự và các sàn thuộc Doanh nghiệp được chọn. Bắt buộc phải chọn Doanh nghiệp gán quyền bên dưới.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vai trò (Role) <span className="text-red-500">*</span>
              </label>
              <select
                value={newUser.role}
                onChange={(e) => {
                  const role = e.target.value as UserRole;
                  const sanitized = teamRepository.sanitizeRoleHierarchy(
                    role,
                    newUser.organization_id,
                    newUser.region_id,
                    newUser.agency_id,
                    newUser.team_id
                  );
                  setNewUser({
                    ...newUser,
                    role,
                    organization_id: sanitized.organization_id,
                    region_id: sanitized.region_id,
                    agency_id: sanitized.agency_id,
                    team_id: sanitized.team_id,
                  });
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                {USER_ROLES
                  .filter((r) => !isCompanyAdmin || !['admin', 'ceo', 'company_admin'].includes(r.value))
                  .map((r) => (
                    <option key={r.value} value={r.value}>{r.label.split('(')[0]}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuộc Doanh Nghiệp {newUser.role === 'company_admin' ? <span className="text-red-500">* (Bắt buộc)</span> : '(CEO)'}
              </label>
              <select
                value={isCompanyAdmin ? (currentUser?.organization_id || '') : (newUser.organization_id || '')}
                disabled={isCompanyAdmin}
                required={newUser.role === 'company_admin'}
                onChange={(e) => setNewUser({ ...newUser, organization_id: e.target.value || null, region_id: null, agency_id: null, team_id: null })}
                className={`w-full py-2 px-3 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-75 disabled:bg-slate-100 ${
                  newUser.role === 'company_admin' ? 'border-blue-400 bg-blue-50/20 font-medium' : 'border-slate-200'
                }`}
              >
                <option value="">{newUser.role === 'company_admin' ? '-- Chọn Doanh Nghiệp gán quyền --' : newUser.role === 'admin' ? '(Quản trị toàn hệ thống / Không gán DN)' : '(Không gán DN / Mặc định)'}</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Phân cấp Vùng / Sàn / Team theo chuẩn vai trò */}
          {['admin', 'company_admin', 'ceo', 'marketing_manager', 'hr_admin'].includes(newUser.role) ? (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold">Vai trò cấp Doanh Nghiệp / Toàn Công Ty</p>
                <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                  Cấp cao hơn Giám Đốc Vùng điều hành toàn bộ công ty, không cần bổ nhiệm vào Vùng, Sàn hoặc Đội nhóm kinh doanh.
                </p>
              </div>
            </div>
          ) : newUser.role === 'regional_director' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Vùng Kinh Doanh <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUser.region_id || ''}
                  required
                  onChange={(e) => setNewUser({ ...newUser, region_id: e.target.value || null, agency_id: null, team_id: null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Chọn Vùng Kinh Doanh phụ trách --</option>
                  {regions
                    .filter(r => !newUser.organization_id || r.organization_id === newUser.organization_id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                    ))}
                </select>
              </div>
              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Quản Trị Toàn Vùng Kinh Doanh</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Giám Đốc Vùng quản lý tất cả các Sàn giao dịch và Đội nhóm trong Vùng, không phân công vào Sàn hoặc Team cụ thể.
                  </p>
                </div>
              </div>
            </div>
          ) : ['director', 'sales_manager'].includes(newUser.role) ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thuộc Vùng Kinh Doanh
                  </label>
                  <select
                    value={newUser.region_id || ''}
                    onChange={(e) => setNewUser({ ...newUser, region_id: e.target.value || null, agency_id: null, team_id: null })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">(Tất cả / Không gán vùng)</option>
                    {regions
                      .filter(r => !newUser.organization_id || r.organization_id === newUser.organization_id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thuộc Sàn Giao Dịch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newUser.agency_id || ''}
                    required
                    onChange={(e) => setNewUser({ ...newUser, agency_id: e.target.value || null, team_id: null })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Chọn Sàn Giao Dịch --</option>
                    {agencies
                      .filter(a => (!newUser.region_id || a.region_id === newUser.region_id) && (!newUser.organization_id || a.organization_id === newUser.organization_id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-800 flex items-start gap-2">
                <Building2 className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Quản Trị Cấp Sàn Giao Dịch</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    {newUser.role === 'director' ? 'Giám Đốc Sàn' : 'Trưởng Phòng KD'} điều hành toàn bộ các Team trong Sàn, không trực thuộc riêng 1 Team cụ thể.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Vùng kinh doanh
                </label>
                <select
                  value={newUser.region_id || ''}
                  onChange={(e) => setNewUser({ ...newUser, region_id: e.target.value || null, agency_id: null, team_id: null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">(Không gán vùng)</option>
                  {regions
                    .filter(r => !newUser.organization_id || r.organization_id === newUser.organization_id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Sàn giao dịch <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUser.agency_id || ''}
                  required
                  onChange={(e) => setNewUser({ ...newUser, agency_id: e.target.value || null, team_id: null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">(Không gán sàn)</option>
                  {agencies
                    .filter(a => (!newUser.region_id || a.region_id === newUser.region_id) && (!newUser.organization_id || a.organization_id === newUser.organization_id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Team kinh doanh {newUser.role === 'team_leader' ? <span className="text-red-500">*</span> : ''}
                </label>
                <select
                  value={newUser.team_id || ''}
                  required={newUser.role === 'team_leader'}
                  onChange={(e) => setNewUser({ ...newUser, team_id: e.target.value || null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">(Không gán team)</option>
                  {teams
                    .filter(t => !newUser.agency_id || t.agency_id === newUser.agency_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                </select>
              </div>
            </div>
          )}

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

      {/* 7b. MODAL: CHỈNH SỬA THÔNG TIN NGƯỜI DÙNG */}
      <Modal
        isOpen={isEditUserModalOpen}
        onClose={() => setIsEditUserModalOpen(false)}
        title={`Chỉnh Sửa Thông Tin Người Dùng: ${selectedUserForEdit?.full_name || ''}`}
      >
        <form onSubmit={handleEditUserSubmit} className="space-y-4">
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
                value={editUserForm.full_name || ''}
                onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                placeholder="Nguyễn Văn A"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email đăng nhập
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={editUserForm.email || ''}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  placeholder="sale.nguyen@diaocvang.vn"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
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
                  value={editUserForm.phone || ''}
                  onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  placeholder="0912345678"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vai trò (Role) <span className="text-red-500">*</span>
              </label>
              <select
                value={editUserForm.role}
                onChange={(e) => {
                  const role = e.target.value as UserRole;
                  const sanitized = teamRepository.sanitizeRoleHierarchy(
                    role,
                    editUserForm.organization_id,
                    editUserForm.region_id,
                    editUserForm.agency_id,
                    editUserForm.team_id
                  );
                  setEditUserForm({
                    ...editUserForm,
                    role,
                    organization_id: sanitized.organization_id,
                    region_id: sanitized.region_id,
                    agency_id: sanitized.agency_id,
                    team_id: sanitized.team_id,
                  });
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                {USER_ROLES
                  .filter((r) => !isCompanyAdmin || !['admin', 'ceo', 'company_admin'].includes(r.value))
                  .map((r) => (
                    <option key={r.value} value={r.value}>{r.label.split('(')[0]}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trạng thái tài khoản <span className="text-red-500">*</span>
              </label>
              <select
                value={editUserForm.status || 'active'}
                onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value as any })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="active">Hoạt động (Active)</option>
                <option value="locked">Tạm khóa (Locked)</option>
                <option value="inactive">Ngừng hoạt động (Inactive)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Thuộc Doanh Nghiệp {editUserForm.role === 'company_admin' ? <span className="text-red-500">* (Bắt buộc)</span> : '(CEO)'}
            </label>
            <select
              value={isCompanyAdmin ? (currentUser?.organization_id || '') : (editUserForm.organization_id || '')}
              disabled={isCompanyAdmin}
              onChange={(e) => setEditUserForm({ ...editUserForm, organization_id: e.target.value || null, region_id: null, agency_id: null, team_id: null })}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-75 disabled:bg-slate-100"
            >
              <option value="">{editUserForm.role === 'admin' ? '(Quản trị toàn hệ thống / Không gán DN)' : '(Không gán DN / Mặc định)'}</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
              ))}
            </select>
          </div>

          {/* Phân cấp Vùng / Sàn / Team theo chuẩn vai trò */}
          {['admin', 'company_admin', 'ceo', 'marketing_manager', 'hr_admin'].includes(editUserForm.role || '') ? (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold">Vai trò cấp Doanh Nghiệp / Toàn Công Ty</p>
                <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                  Cấp cao hơn Giám Đốc Vùng điều hành toàn bộ công ty, không cần bổ nhiệm vào Vùng, Sàn hoặc Đội nhóm kinh doanh.
                </p>
              </div>
            </div>
          ) : editUserForm.role === 'regional_director' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Vùng Kinh Doanh <span className="text-red-500">*</span>
                </label>
                <select
                  value={editUserForm.region_id || ''}
                  required
                  onChange={(e) => setEditUserForm({ ...editUserForm, region_id: e.target.value || null, agency_id: null, team_id: null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Chọn Vùng Kinh Doanh phụ trách --</option>
                  {regions
                    .filter(r => !editUserForm.organization_id || r.organization_id === editUserForm.organization_id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                    ))}
                </select>
              </div>
              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Quản Trị Toàn Vùng Kinh Doanh</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Giám Đốc Vùng quản lý tất cả các Sàn giao dịch và Đội nhóm trong Vùng, không phân công vào Sàn hoặc Team cụ thể.
                  </p>
                </div>
              </div>
            </div>
          ) : ['director', 'sales_manager'].includes(editUserForm.role || '') ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thuộc Vùng Kinh Doanh
                  </label>
                  <select
                    value={editUserForm.region_id || ''}
                    onChange={(e) => setEditUserForm({ ...editUserForm, region_id: e.target.value || null, agency_id: null, team_id: null })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">(Tất cả / Không gán vùng)</option>
                    {regions
                      .filter(r => !editUserForm.organization_id || r.organization_id === editUserForm.organization_id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thuộc Sàn Giao Dịch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editUserForm.agency_id || ''}
                    required
                    onChange={(e) => setEditUserForm({ ...editUserForm, agency_id: e.target.value || null, team_id: null })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Chọn Sàn Giao Dịch --</option>
                    {agencies
                      .filter(a => (!editUserForm.region_id || a.region_id === editUserForm.region_id) && (!editUserForm.organization_id || a.organization_id === editUserForm.organization_id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-800 flex items-start gap-2">
                <Building2 className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Quản Trị Cấp Sàn Giao Dịch</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    {editUserForm.role === 'director' ? 'Giám Đốc Sàn' : 'Trưởng Phòng KD'} điều hành toàn bộ các Team trong Sàn, không trực thuộc riêng 1 Team cụ thể.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Vùng kinh doanh
                </label>
                <select
                  value={editUserForm.region_id || ''}
                  onChange={(e) => setEditUserForm({ ...editUserForm, region_id: e.target.value || null, agency_id: null, team_id: null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">(Không gán vùng)</option>
                  {regions
                    .filter(r => !editUserForm.organization_id || r.organization_id === editUserForm.organization_id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Sàn giao dịch <span className="text-red-500">*</span>
                </label>
                <select
                  value={editUserForm.agency_id || ''}
                  required
                  onChange={(e) => {
                    setEditUserForm({ ...editUserForm, agency_id: e.target.value || null, team_id: null });
                  }}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">(Không gán sàn)</option>
                  {agencies
                    .filter(a => (!editUserForm.region_id || a.region_id === editUserForm.region_id) && (!editUserForm.organization_id || a.organization_id === editUserForm.organization_id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Team kinh doanh {editUserForm.role === 'team_leader' ? <span className="text-red-500">*</span> : ''}
                </label>
                <select
                  value={editUserForm.team_id || ''}
                  required={editUserForm.role === 'team_leader'}
                  onChange={(e) => setEditUserForm({ ...editUserForm, team_id: e.target.value || null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">(Không gán team)</option>
                  {teams
                    .filter(t => !editUserForm.agency_id || t.agency_id === editUserForm.agency_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditUserModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7c. MODAL: XÁC NHẬN XÓA NHÂN SỰ (SOFT DELETE & HANDOVER) */}
      <Modal
        isOpen={isDeleteUserModalOpen}
        onClose={() => setIsDeleteUserModalOpen(false)}
        title="Xác Nhận Xóa Nhân Sự (Xóa Mềm)"
      >
        <form onSubmit={handleDeleteUserSubmit} className="space-y-4">
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

          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              Cảnh báo an toàn dữ liệu:
            </div>
            <div>
              Bạn đang chuẩn bị xóa tài khoản của nhân sự <strong className="font-semibold">{selectedUserForDelete?.full_name}</strong> ({selectedUserForDelete?.email}) - Chức danh: <strong className="font-semibold">{USER_ROLES.find(r => r.value === selectedUserForDelete?.role)?.label.split('(')[0] || selectedUserForDelete?.role}</strong>.
            </div>
            <div className="text-[11px] text-rose-700">
              Hệ thống áp dụng cơ chế <strong>Xóa mềm (Soft Delete)</strong>. Dữ liệu tài khoản sẽ được chuyển vào <strong>Thùng Rác Quản Trị</strong> và có thể khôi phục bất cứ lúc nào.
            </div>
          </div>

          {userAssignedLeadsCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-amber-800 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-amber-600" />
                Khách hàng đang phụ trách: {userAssignedLeadsCount} Lead
              </div>
              <p className="text-[11px] text-amber-700">
                Nhân sự này hiện đang phụ trách {userAssignedLeadsCount} khách hàng tiềm năng chưa ký hợp đồng. Vui lòng chọn nhân sự tiếp nhận bàn giao bên dưới để đảm bảo không thất thoát dữ liệu khách hàng.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nhân sự tiếp nhận bàn giao {userAssignedLeadsCount > 0 && <span className="text-amber-600">(Khuyến nghị)</span>}
            </label>
            <select
              value={handoverUserId}
              onChange={(e) => setHandoverUserId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">-- {userAssignedLeadsCount > 0 ? 'Chọn nhân sự nhận bàn giao Lead' : 'Không bàn giao'} --</option>
              {profiles
                .filter(p => p.id !== selectedUserForDelete?.id && p.status === 'active')
                .map((p) => {
                  const roleLabel = USER_ROLES.find(r => r.value === p.role)?.label.split('(')[0] || p.role;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.email}) - {roleLabel}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do xóa / cho thôi việc <span className="text-red-500">* (Tối thiểu 5 ký tự)</span>
            </label>
            <textarea
              required
              minLength={5}
              rows={3}
              value={deleteUserReason}
              onChange={(e) => setDeleteUserReason(e.target.value)}
              placeholder="VD: Nghỉ việc theo nguyện vọng cá nhân; Chuyển công tác sang đơn vị khác; Tái cơ cấu phòng ban..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteUserModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Xác nhận xóa nhân sự
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8a. MODAL: THÀNH LẬP DOANH NGHIỆP MỚI */}
      <Modal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        title="Thành Lập Doanh Nghiệp Mới"
      >
        <form onSubmit={handleCreateOrganizationSubmit} className="space-y-4">
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
              Tên Doanh Nghiệp / Công Ty <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newOrg.name}
              onChange={(e) => {
                const nextName = e.target.value;
                if (isOrgCodeAutoGenerated) {
                  const autoCode = generateOrganizationCode(nextName, organizations);
                  setNewOrg({ ...newOrg, name: nextName, code: autoCode });
                } else {
                  setNewOrg({ ...newOrg, name: nextName });
                }
              }}
              placeholder="Công ty Cổ phần BĐS Địa Ốc Vàng Miền Trung"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  Mã Doanh Nghiệp <span className="text-red-500">*</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Tự động
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateOrgCode}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                  title="Sinh lại mã tự động"
                >
                  <RefreshCw className="w-3 h-3" /> Sinh lại
                </button>
              </div>
              <input
                type="text"
                required
                value={newOrg.code}
                onChange={(e) => {
                  setIsOrgCodeAutoGenerated(false);
                  setNewOrg({ ...newOrg, code: e.target.value.toUpperCase() });
                }}
                placeholder="Hệ thống tự động sinh (VD: ORG-DOVMT)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono font-semibold uppercase focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Hệ thống tự động sinh theo tên doanh nghiệp, đảm bảo tính duy nhất.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã Số Thuế (MST)
              </label>
              <input
                type="text"
                value={newOrg.tax_number || ''}
                onChange={(e) => setNewOrg({ ...newOrg, tax_number: e.target.value })}
                placeholder="0312984729"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số Điện Thoại Doanh Nghiệp
              </label>
              <input
                type="tel"
                value={newOrg.phone || ''}
                onChange={(e) => setNewOrg({ ...newOrg, phone: e.target.value })}
                placeholder="028.7777.8888"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Doanh Nghiệp
              </label>
              <input
                type="email"
                value={newOrg.email || ''}
                onChange={(e) => setNewOrg({ ...newOrg, email: e.target.value })}
                placeholder="contact@diaocvang.vn"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa Chỉ Trụ Sở Doanh Nghiệp
            </label>
            <input
              type="text"
              value={newOrg.address || ''}
              onChange={(e) => setNewOrg({ ...newOrg, address: e.target.value })}
              placeholder="Tòa nhà Bitexco, Q.1, TP.HCM"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Tùy chọn gán ngay nếu đã có sẵn nhân sự */}
          <details className="group border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
            <summary className="text-[11px] font-medium text-slate-600 cursor-pointer list-none flex items-center justify-between select-none">
              <span>(Tùy chọn) Bổ nhiệm ngay nếu nhân sự đã có tài khoản sẵn</span>
              <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200/60">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bổ nhiệm Tổng Giám Đốc (CEO)
                </label>
                <select
                  value={newOrg.ceo_id || ''}
                  onChange={(e) => setNewOrg({ ...newOrg, ceo_id: e.target.value || null })}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">-- Chưa bổ nhiệm (Tùy chọn) --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role}) - {p.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bổ nhiệm Quản Trị Doanh Nghiệp (Admin)
                </label>
                <select
                  value={newOrg.admin_id || ''}
                  onChange={(e) => setNewOrg({ ...newOrg, admin_id: e.target.value || null })}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">-- Chưa bổ nhiệm (Tùy chọn) --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role}) - {p.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOrgModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Thành Lập Doanh Nghiệp
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8a2. MODAL: BỔ NHIỆM / TẠO QUẢN TRỊ DOANH NGHIỆP (COMPANY ADMIN) */}
      <Modal
        isOpen={isAssignAdminModalOpen}
        onClose={() => setIsAssignAdminModalOpen(false)}
        title={`Quản Trị Doanh Nghiệp: ${selectedOrgForAdmin?.name || ''}`}
      >
        <form onSubmit={handleAssignAdminSubmit} className="space-y-4">
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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Doanh nghiệp:</span>
              <strong className="text-slate-900">{selectedOrgForAdmin?.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mã Doanh Nghiệp:</span>
              <span className="font-mono font-bold text-indigo-700">{selectedOrgForAdmin?.code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Quản Trị DN hiện tại:</span>
              <span className="font-medium text-slate-700">
                {profiles.find(p => p.id === selectedOrgForAdmin?.admin_id)?.full_name || selectedOrgForAdmin?.admin_name || '(Chưa bổ nhiệm)'}
              </span>
            </div>
          </div>

          {/* Tab chuyển đổi chế độ */}
          <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-100">
            <button
              type="button"
              onClick={() => { setAssignAdminMode('create_new'); setModalError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                assignAdminMode === 'create_new'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tạo tài khoản mới (Khuyến nghị)
            </button>
            <button
              type="button"
              onClick={() => { setAssignAdminMode('choose_existing'); setModalError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                assignAdminMode === 'choose_existing'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chọn từ nhân sự có sẵn
            </button>
          </div>

          {assignAdminMode === 'choose_existing' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn nhân sự làm Quản Trị Doanh Nghiệp <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedAdminUserId}
                  onChange={(e) => setSelectedAdminUserId(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">-- Chọn nhân sự trong hệ thống --</option>
                  {profiles
                    .filter(p => p.role !== 'admin')
                    .map((p) => {
                      const roleLabel = USER_ROLES.find(r => r.value === p.role)?.label.split('(')[0] || p.role;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.email}) - {roleLabel}
                        </option>
                      );
                    })}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                * Khi xác nhận, nhân sự này sẽ được chuyển vai trò thành <strong>Quản Trị Doanh Nghiệp</strong> và gán quyền quản lý cấu hình, nhân sự cho riêng doanh nghiệp <strong>{selectedOrgForAdmin?.name}</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên Quản Trị Viên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newOrgAdmin.full_name}
                  onChange={(e) => setNewOrgAdmin({ ...newOrgAdmin, full_name: e.target.value })}
                  placeholder="Nguyễn Văn Quản Trị"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email đăng nhập <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newOrgAdmin.email}
                    onChange={(e) => setNewOrgAdmin({ ...newOrgAdmin, email: e.target.value })}
                    placeholder="admin.dn@diaocvang.vn"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newOrgAdmin.phone}
                    onChange={(e) => setNewOrgAdmin({ ...newOrgAdmin, phone: e.target.value })}
                    placeholder="0912345678"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu ban đầu
                </label>
                <input
                  type="text"
                  value={newOrgAdmin.password}
                  onChange={(e) => setNewOrgAdmin({ ...newOrgAdmin, password: e.target.value })}
                  placeholder="password123"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Mặc định: password123. Tài khoản sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAssignAdminModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {assignAdminMode === 'choose_existing' ? 'Xác Nhận Bổ Nhiệm' : 'Tạo Quản Trị & Gán Cho Doanh Nghiệp'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8a3. MODAL: BỔ NHIỆM / TẠO TỔNG GIÁM ĐỐC (CEO) */}
      <Modal
        isOpen={isAssignCeoModalOpen}
        onClose={() => setIsAssignCeoModalOpen(false)}
        title={`Bổ Nhiệm Tổng Giám Đốc (CEO): ${selectedOrgForCeo?.name || ''}`}
      >
        <form onSubmit={handleAssignCeoSubmit} className="space-y-4">
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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Doanh nghiệp:</span>
              <strong className="text-slate-900">{selectedOrgForCeo?.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mã Doanh Nghiệp:</span>
              <span className="font-mono font-bold text-indigo-700">{selectedOrgForCeo?.code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tổng Giám Đốc hiện tại:</span>
              <span className="font-medium text-slate-700">
                {profiles.find(p => p.id === selectedOrgForCeo?.ceo_id)?.full_name || selectedOrgForCeo?.ceo_name || '(Chưa bổ nhiệm)'}
              </span>
            </div>
          </div>

          {/* Tab chuyển đổi chế độ */}
          <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-100">
            <button
              type="button"
              onClick={() => { setAssignCeoMode('create_new'); setModalError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                assignCeoMode === 'create_new'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tạo tài khoản CEO mới
            </button>
            <button
              type="button"
              onClick={() => { setAssignCeoMode('choose_existing'); setModalError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                assignCeoMode === 'choose_existing'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chọn từ nhân sự có sẵn
            </button>
          </div>

          {assignCeoMode === 'choose_existing' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn nhân sự làm Tổng Giám Đốc (CEO) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCeoUserId}
                  onChange={(e) => setSelectedCeoUserId(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="">-- Chọn nhân sự trong hệ thống --</option>
                  {profiles
                    .filter(p => p.role !== 'admin')
                    .map((p) => {
                      const roleLabel = USER_ROLES.find(r => r.value === p.role)?.label.split('(')[0] || p.role;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.email}) - {roleLabel}
                        </option>
                      );
                    })}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                * Khi xác nhận, nhân sự này sẽ được chuyển vai trò thành <strong>Tổng Giám Đốc (CEO)</strong> đại diện quản lý riêng nhánh doanh nghiệp <strong>{selectedOrgForCeo?.name}</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên Tổng Giám Đốc (CEO) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newOrgCeo.full_name}
                  onChange={(e) => setNewOrgCeo({ ...newOrgCeo, full_name: e.target.value })}
                  placeholder="Nguyễn Văn Tổng Giám Đốc"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email đăng nhập <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newOrgCeo.email}
                    onChange={(e) => setNewOrgCeo({ ...newOrgCeo, email: e.target.value })}
                    placeholder="ceo.dn@diaocvang.vn"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newOrgCeo.phone}
                    onChange={(e) => setNewOrgCeo({ ...newOrgCeo, phone: e.target.value })}
                    placeholder="0918889999"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu ban đầu
                </label>
                <input
                  type="text"
                  value={newOrgCeo.password}
                  onChange={(e) => setNewOrgCeo({ ...newOrgCeo, password: e.target.value })}
                  placeholder="password123"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Mặc định: password123. Tài khoản sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAssignCeoModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {assignCeoMode === 'choose_existing' ? 'Xác Nhận Bổ Nhiệm CEO' : 'Tạo Tài Khoản & Bổ Nhiệm CEO'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8a4. MODAL: CHỈNH SỬA DOANH NGHIỆP */}
      <Modal
        isOpen={isEditOrgModalOpen}
        onClose={() => setIsEditOrgModalOpen(false)}
        title={`Chỉnh Sửa Doanh Nghiệp: ${selectedOrgForEdit?.name || ''}`}
      >
        <form onSubmit={handleEditOrgSubmit} className="space-y-4">
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
              Tên Doanh Nghiệp / Công Ty <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editOrgForm.name}
              onChange={(e) => setEditOrgForm({ ...editOrgForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã Doanh Nghiệp <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editOrgForm.code}
                onChange={(e) => setEditOrgForm({ ...editOrgForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono font-semibold uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã Số Thuế (MST)
              </label>
              <input
                type="text"
                value={editOrgForm.tax_number || ''}
                onChange={(e) => setEditOrgForm({ ...editOrgForm, tax_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số Điện Thoại Doanh Nghiệp
              </label>
              <input
                type="tel"
                value={editOrgForm.phone || ''}
                onChange={(e) => setEditOrgForm({ ...editOrgForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Doanh Nghiệp
              </label>
              <input
                type="email"
                value={editOrgForm.email || ''}
                onChange={(e) => setEditOrgForm({ ...editOrgForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa Chỉ Trụ Sở Doanh Nghiệp
            </label>
            <input
              type="text"
              value={editOrgForm.address || ''}
              onChange={(e) => setEditOrgForm({ ...editOrgForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          {currentUser?.role === 'admin' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tổng Giám Đốc (CEO)
                </label>
                <select
                  value={editOrgForm.ceo_id || ''}
                  onChange={(e) => setEditOrgForm({ ...editOrgForm, ceo_id: e.target.value || null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">(Chưa bổ nhiệm)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.role}) - {p.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quản Trị Doanh Nghiệp (Admin)
                </label>
                <select
                  value={editOrgForm.admin_id || ''}
                  onChange={(e) => setEditOrgForm({ ...editOrgForm, admin_id: e.target.value || null })}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">(Chưa bổ nhiệm)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.role}) - {p.email}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditOrgModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8a5. MODAL: XÓA DOANH NGHIỆP */}
      <Modal
        isOpen={isDeleteOrgModalOpen}
        onClose={() => setIsDeleteOrgModalOpen(false)}
        title="Xác Nhận Xóa Doanh Nghiệp"
      >
        <form onSubmit={handleDeleteOrgSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
            <div className="flex items-start gap-2 text-red-800 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>Hành động nguy hiểm: Xóa Doanh Nghiệp</span>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Bạn đang chuẩn bị xóa doanh nghiệp <strong>{selectedOrgForDelete?.name}</strong> ({selectedOrgForDelete?.code}).
            </p>
            <p className="text-[11px] text-red-600">
              * Lưu ý an toàn: Hệ thống sẽ từ chối xóa nếu doanh nghiệp này vẫn còn Vùng, Sàn hoặc Nhân sự hoạt động trực thuộc.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOrgModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Xác nhận xóa doanh nghiệp
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8b. MODAL: THÀNH LẬP VÙNG KINH DOANH MỚI */}
      <Modal
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        title="Thành Lập Vùng Kinh Doanh Mới"
      >
        <form onSubmit={handleCreateRegionSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên Vùng Kinh Doanh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newRegion.name}
              onChange={(e) => setNewRegion({ ...newRegion, name: e.target.value })}
              placeholder="Vùng Đông Sài Gòn (Thủ Đức - Q9 - Q2)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã Viết Tắt Vùng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newRegion.code}
                onChange={(e) => setNewRegion({ ...newRegion, code: e.target.value })}
                placeholder="REG-EAST"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuộc Doanh Nghiệp (CEO)
              </label>
              <select
                value={isCompanyAdmin ? (currentUser?.organization_id || '') : (newRegion.organization_id || '')}
                disabled={isCompanyAdmin}
                onChange={(e) => setNewRegion({ ...newRegion, organization_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium disabled:opacity-75 disabled:bg-slate-100"
              >
                <option value="">(Chọn Doanh nghiệp trực thuộc)</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bổ nhiệm Giám Đốc Vùng (Regional Director)
            </label>
            <select
              value={newRegion.regional_director_id || ''}
              onChange={(e) => setNewRegion({ ...newRegion, regional_director_id: e.target.value || null })}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">(Chọn nhân sự làm Giám Đốc Vùng)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role}) - {p.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô Tả & Địa Bàn Hoạt Động
            </label>
            <input
              type="text"
              value={newRegion.description || ''}
              onChange={(e) => setNewRegion({ ...newRegion, description: e.target.value })}
              placeholder="Bao gồm các dự án và sàn tại khu vực TP. Thủ Đức và lân cận"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRegionModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Thành Lập Vùng Kinh Doanh
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8b2. MODAL: CHỈNH SỬA VÙNG KINH DOANH */}
      <Modal
        isOpen={isEditRegionModalOpen}
        onClose={() => setIsEditRegionModalOpen(false)}
        title={`Chỉnh Sửa Vùng Kinh Doanh: ${selectedRegionForEdit?.name || ''}`}
      >
        <form onSubmit={handleEditRegionSubmit} className="space-y-4">
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
              Tên Vùng Kinh Doanh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editRegionForm.name}
              onChange={(e) => setEditRegionForm({ ...editRegionForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã Viết Tắt Vùng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editRegionForm.code}
                onChange={(e) => setEditRegionForm({ ...editRegionForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thuộc Doanh Nghiệp (CEO)
              </label>
              <select
                value={editRegionForm.organization_id || ''}
                disabled={isCompanyAdmin}
                onChange={(e) => setEditRegionForm({ ...editRegionForm, organization_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium disabled:opacity-75 disabled:bg-slate-100"
              >
                <option value="">(Chọn Doanh nghiệp trực thuộc)</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bổ nhiệm Giám Đốc Vùng (Regional Director)
            </label>
            <select
              value={editRegionForm.regional_director_id || ''}
              onChange={(e) => setEditRegionForm({ ...editRegionForm, regional_director_id: e.target.value || null })}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">(Chưa bổ nhiệm)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role}) - {p.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô Tả & Địa Bàn Hoạt Động
            </label>
            <input
              type="text"
              value={editRegionForm.description || ''}
              onChange={(e) => setEditRegionForm({ ...editRegionForm, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditRegionModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8b3. MODAL: XÓA VÙNG KINH DOANH */}
      <Modal
        isOpen={isDeleteRegionModalOpen}
        onClose={() => setIsDeleteRegionModalOpen(false)}
        title="Xác Nhận Xóa Vùng Kinh Doanh"
      >
        <form onSubmit={handleDeleteRegionSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
            <div className="flex items-start gap-2 text-red-800 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>Xóa Vùng: {selectedRegionForDelete?.name} ({selectedRegionForDelete?.code})</span>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Các Sàn giao dịch thuộc Vùng này sẽ được tự động chuyển giao sang Vùng tiếp nhận bên dưới để đảm bảo dữ liệu không bị gián đoạn.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chọn Vùng Tiếp Nhận Các Sàn Trực Thuộc <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={fallbackRegionId}
              onChange={(e) => setFallbackRegionId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="REG-DEFAULT">Vùng Mặc Định (Chưa phân vùng)</option>
              {regions
                .filter(r => r.id !== selectedRegionForDelete?.id && r.id !== 'REG-DEFAULT')
                .map((r) => (
                  <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteRegionModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Xác nhận xóa vùng
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
                Trực thuộc Doanh Nghiệp (CEO)
              </label>
              <select
                value={isCompanyAdmin ? (currentUser?.organization_id || '') : (newAgency.organization_id || '')}
                disabled={isCompanyAdmin}
                onChange={(e) => setNewAgency({ ...newAgency, organization_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-75 disabled:bg-slate-100"
              >
                <option value="">(Chọn Doanh nghiệp)</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trực thuộc Vùng Kinh Doanh
              </label>
              <select
                value={newAgency.region_id || ''}
                onChange={(e) => setNewAgency({ ...newAgency, region_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Chọn Vùng kinh doanh)</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                ))}
              </select>
            </div>
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

      {/* 8c2. MODAL: CHỈNH SỬA SÀN GIAO DỊCH */}
      <Modal
        isOpen={isEditAgencyModalOpen}
        onClose={() => setIsEditAgencyModalOpen(false)}
        title={`Chỉnh Sửa Sàn Giao Dịch: ${selectedAgencyForEdit?.name || ''}`}
      >
        <form onSubmit={handleEditAgencySubmit} className="space-y-4">
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
              Tên Sàn Giao Dịch <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editAgencyForm.name}
              onChange={(e) => setEditAgencyForm({ ...editAgencyForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trực thuộc Doanh Nghiệp (CEO)
              </label>
              <select
                value={editAgencyForm.organization_id || ''}
                disabled={isCompanyAdmin}
                onChange={(e) => setEditAgencyForm({ ...editAgencyForm, organization_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-75 disabled:bg-slate-100"
              >
                <option value="">(Chọn Doanh nghiệp)</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trực thuộc Vùng Kinh Doanh
              </label>
              <select
                value={editAgencyForm.region_id || ''}
                onChange={(e) => setEditAgencyForm({ ...editAgencyForm, region_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Chọn Vùng kinh doanh)</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã viết tắt sàn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editAgencyForm.code}
                onChange={(e) => setEditAgencyForm({ ...editAgencyForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bổ nhiệm Giám Đốc Sàn
              </label>
              <select
                value={editAgencyForm.director_id || ''}
                onChange={(e) => setEditAgencyForm({ ...editAgencyForm, director_id: e.target.value || null })}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Chưa bổ nhiệm)</option>
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
                value={editAgencyForm.phone || ''}
                onChange={(e) => setEditAgencyForm({ ...editAgencyForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email liên hệ sàn
              </label>
              <input
                type="email"
                value={editAgencyForm.email || ''}
                onChange={(e) => setEditAgencyForm({ ...editAgencyForm, email: e.target.value })}
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
              value={editAgencyForm.address || ''}
              onChange={(e) => setEditAgencyForm({ ...editAgencyForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditAgencyModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8c3. MODAL: XÓA SÀN GIAO DỊCH */}
      <Modal
        isOpen={isDeleteAgencyModalOpen}
        onClose={() => setIsDeleteAgencyModalOpen(false)}
        title="Xác Nhận Xóa Sàn Giao Dịch"
      >
        <form onSubmit={handleDeleteAgencySubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
            <div className="flex items-start gap-2 text-red-800 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>Xóa Sàn: {selectedAgencyForDelete?.name} ({selectedAgencyForDelete?.code})</span>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Các Đội nhóm và Nhân sự thuộc Sàn này sẽ được tự động chuyển giao sang Sàn tiếp nhận bên dưới để bảo toàn toàn bộ dữ liệu giao dịch và khách hàng.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chọn Sàn Tiếp Nhận Teams & Nhân Sự <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={fallbackAgencyId}
              onChange={(e) => setFallbackAgencyId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">-- Chọn sàn tiếp nhận thay thế --</option>
              {agencies
                .filter(a => a.id !== selectedAgencyForDelete?.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteAgencyModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Xác nhận xóa sàn
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

      {/* 9b. MODAL: CHỈNH SỬA TEAM KINH DOANH */}
      <Modal
        isOpen={isEditTeamModalOpen}
        onClose={() => setIsEditTeamModalOpen(false)}
        title={`Chỉnh Sửa Team Kinh Doanh: ${selectedTeamForEdit?.name || ''}`}
      >
        <form onSubmit={handleEditTeamSubmit} className="space-y-4">
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
              Tên Team Kinh Doanh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editTeamForm.name}
              onChange={(e) => setEditTeamForm({ ...editTeamForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
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
                value={editTeamForm.code}
                onChange={(e) => setEditTeamForm({ ...editTeamForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trực thuộc Sàn giao dịch <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={editTeamForm.agency_id}
                onChange={(e) => setEditTeamForm({ ...editTeamForm, agency_id: e.target.value })}
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
              value={editTeamForm.leader_id || ''}
              onChange={(e) => setEditTeamForm({ ...editTeamForm, leader_id: e.target.value || null })}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">(Chưa bổ nhiệm)</option>
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
              onClick={() => setIsEditTeamModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* 9c. MODAL: XÓA TEAM KINH DOANH */}
      <Modal
        isOpen={isDeleteTeamModalOpen}
        onClose={() => setIsDeleteTeamModalOpen(false)}
        title="Xác Nhận Xóa Đội Nhóm Kinh Doanh"
      >
        <form onSubmit={handleDeleteTeamSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
            <div className="flex items-start gap-2 text-red-800 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>Xóa Team: {selectedTeamForDelete?.name} ({selectedTeamForDelete?.code})</span>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Bạn có thể chuyển giao các chuyên viên tư vấn (Sale Agents) sang Team tiếp nhận bên dưới, hoặc để trống để đưa nhân sự về trạng thái trực thuộc Sàn (chưa vào Team).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chọn Team Tiếp Nhận Nhân Sự (Tùy chọn)
            </label>
            <select
              value={fallbackTeamId}
              onChange={(e) => setFallbackTeamId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">(Không chọn - Nhân sự sẽ trực thuộc thẳng Sàn)</option>
              {teams
                .filter(t => t.id !== selectedTeamForDelete?.id && t.agency_id === selectedTeamForDelete?.agency_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteTeamModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Xác nhận xóa team
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
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setTargetRole(newRole);
                const sanitized = teamRepository.sanitizeRoleHierarchy(
                  newRole,
                  targetOrgId,
                  targetRegionId,
                  targetAgencyId,
                  targetTeamId
                );
                setTargetOrgId(sanitized.organization_id || '');
                setTargetRegionId(sanitized.region_id || '');
                setTargetAgencyId(sanitized.agency_id || '');
                setTargetTeamId(sanitized.team_id || '');
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-bold text-blue-700"
            >
              {USER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {['admin', 'company_admin', 'ceo', 'marketing_manager', 'hr_admin'].includes(targetRole) && 'Cấp cao hơn Giám Đốc Vùng: Quản trị cấp Công ty / Toàn doanh nghiệp, không cần bổ nhiệm Vùng, Sàn hay Team.'}
              {targetRole === 'regional_director' && 'Giám Đốc Vùng: Cấp cao hơn Trưởng phòng/Sàn, quản lý toàn bộ Vùng kinh doanh (không phân công vào Sàn hay Team cụ thể).'}
              {targetRole === 'director' && 'Giám đốc sàn: Cấp cao hơn Trưởng nhóm, toàn quyền điều hành Sàn (không phân công vào Team cụ thể).'}
              {targetRole === 'sales_manager' && 'Trưởng phòng KD: Cấp cao hơn Trưởng nhóm, quản lý các team trong Sàn (không phân công vào Team cụ thể).'}
              {targetRole === 'team_leader' && 'Trưởng nhóm: Điều hành Team kinh doanh, đôn đốc KPI và hỗ trợ chốt deal.'}
              {targetRole === 'sale_agent' && 'Chuyên viên tư vấn: Chăm sóc khách hàng và tiếp nhận Lead theo Team.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phân công Doanh Nghiệp {targetRole === 'company_admin' ? <span className="text-red-500">* (Bắt buộc)</span> : '(CEO)'}
            </label>
            <select
              value={targetOrgId}
              required={targetRole === 'company_admin'}
              disabled={isCompanyAdmin}
              onChange={(e) => {
                const orgId = e.target.value;
                setTargetOrgId(orgId);
                setTargetRegionId('');
                setTargetAgencyId('');
                setTargetTeamId('');
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium disabled:opacity-75 disabled:bg-slate-100"
            >
              <option value="">{targetRole === 'admin' ? '(Quản trị toàn hệ thống / Không gán DN)' : '(Không gán DN / Mặc định)'}</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.code} - {o.name}</option>
              ))}
            </select>
          </div>

          {/* Cấp cao hơn Giám đốc vùng (admin, company_admin, ceo, marketing_manager, hr_admin): Không cần bổ nhiệm Vùng, Sàn, Team */}
          {['admin', 'company_admin', 'ceo', 'marketing_manager', 'hr_admin'].includes(targetRole) ? (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <p className="font-semibold">Vai trò cấp Doanh Nghiệp / Toàn Công Ty</p>
                <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                  Cấp cao hơn Giám Đốc Vùng điều hành toàn bộ công ty, không cần bổ nhiệm vào Vùng, Sàn hoặc Đội nhóm kinh doanh cụ thể.
                </p>
              </div>
            </div>
          ) : targetRole === 'regional_director' ? (
            /* Giám đốc vùng (regional_director): Cấp cao hơn Trưởng phòng/Sàn -> Chỉ bổ nhiệm Vùng, không cần Sàn, không cần Team */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bổ nhiệm Vùng Kinh Doanh <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetRegionId}
                  required
                  onChange={(e) => setTargetRegionId(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">-- Chọn Vùng Kinh Doanh phụ trách --</option>
                  {regions
                    .filter(r => !targetOrgId || r.organization_id === targetOrgId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                    ))}
                </select>
              </div>
              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Quản Trị Toàn Vùng Kinh Doanh</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Giám Đốc Vùng quản lý tất cả các Sàn giao dịch và Đội nhóm trong Vùng, không bổ nhiệm vào Sàn hoặc Team cụ thể.
                  </p>
                </div>
              </div>
            </div>
          ) : ['director', 'sales_manager'].includes(targetRole) ? (
            /* Giám đốc sàn & Trưởng phòng KD: Cấp cao hơn Trưởng nhóm -> Bổ nhiệm Vùng và Sàn, không cần Team */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thuộc Vùng Kinh Doanh
                  </label>
                  <select
                    value={targetRegionId}
                    onChange={(e) => {
                      setTargetRegionId(e.target.value);
                      setTargetAgencyId('');
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">(Tất cả / Không gán vùng)</option>
                    {regions
                      .filter(r => !targetOrgId || r.organization_id === targetOrgId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bổ nhiệm Sàn Giao Dịch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetAgencyId}
                    required
                    onChange={(e) => setTargetAgencyId(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Chọn Sàn Giao Dịch --</option>
                    {agencies
                      .filter(a => (!targetRegionId || a.region_id === targetRegionId) && (!targetOrgId || a.organization_id === targetOrgId))
                      .map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-800 flex items-start gap-2">
                <Building2 className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Quản Trị Cấp Sàn Giao Dịch</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    {targetRole === 'director' ? 'Giám Đốc Sàn' : 'Trưởng Phòng Kinh Doanh'} điều hành toàn bộ các Team trong Sàn, không bổ nhiệm vào riêng 1 Team cụ thể.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Trưởng nhóm (team_leader) & Chuyên viên (sale_agent): Bổ nhiệm đầy đủ Vùng, Sàn, Team */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thuộc Vùng Kinh Doanh
                  </label>
                  <select
                    value={targetRegionId}
                    onChange={(e) => {
                      setTargetRegionId(e.target.value);
                      setTargetAgencyId('');
                      setTargetTeamId('');
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">(Tất cả / Không gán vùng)</option>
                    {regions
                      .filter(r => !targetOrgId || r.organization_id === targetOrgId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thuộc Sàn Giao Dịch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetAgencyId}
                    required
                    onChange={(e) => {
                      setTargetAgencyId(e.target.value);
                      setTargetTeamId('');
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Chọn Sàn Giao Dịch --</option>
                    {agencies
                      .filter(a => (!targetRegionId || a.region_id === targetRegionId) && (!targetOrgId || a.organization_id === targetOrgId))
                      .map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thuộc Đội Nhóm (Team) {targetRole === 'team_leader' ? <span className="text-red-500">* (Trưởng nhóm)</span> : ''}
                </label>
                <select
                  value={targetTeamId}
                  required={targetRole === 'team_leader'}
                  onChange={(e) => setTargetTeamId(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">(Không gán team / Trực thuộc Sàn)</option>
                  {teams
                    .filter(t => !targetAgencyId || t.agency_id === targetAgencyId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                </select>
              </div>
            </div>
          )}

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
