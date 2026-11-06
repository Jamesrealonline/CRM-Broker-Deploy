// ========================================================
// REAL ESTATE CRM - ROUTE GUARDS
// Bảo vệ phân quyền, bắt buộc đổi mật khẩu lần đầu
// ========================================================

import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import { UserRole } from '@/domain/types';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading, initialize } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-xs font-medium text-slate-500">Đang đồng bộ dữ liệu phiên làm việc...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Bắt buộc đổi mật khẩu lần đầu nếu cờ must_change_password = true
  if (currentUser.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
};

export const RoleGuard: React.FC<{ allowedRoles: UserRole[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { currentUser } = useAuthStore();

  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-6">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Quyền truy cập bị từ chối</h2>
        <p className="text-xs text-slate-500">
          Vai trò hiện tại của bạn ({currentUser?.role}) không có quyền truy cập màn hình này.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
