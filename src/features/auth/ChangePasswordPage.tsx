// ========================================================
// REAL ESTATE CRM - CHANGE PASSWORD PAGE
// Bắt buộc đổi mật khẩu lần đầu (>= 8 ký tự, chữ và số)
// ========================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { useAuthStore } from '@/app/useAuthStore';
import { authRepository } from '@/data/repositories/authRepository';
import { Button } from '@/components/ui/Button';

export const ChangePasswordPage: React.FC = () => {
  const { currentUser, initialize } = useAuthStore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số.');
      return;
    }

    setIsLoading(true);
    try {
      if (!currentUser) return;
      const res = await authRepository.changePassword(currentUser.id, newPassword);
      if (res.success) {
        await initialize();
        navigate('/dashboard');
      } else {
        setError(res.error || 'Đổi mật khẩu thất bại.');
      }
    } catch {
      setError('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 items-center justify-center text-amber-400 mb-3">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Đổi Mật Khẩu Bắt Buộc</h2>
          <p className="text-xs text-slate-400 mt-1">
            Để đảm bảo an toàn thông tin khách hàng, bạn cần cập nhật mật khẩu mới cho tài khoản.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">Mật khẩu mới</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự, có chữ và số"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">Xác nhận mật khẩu mới</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs space-y-1 text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-3.5 w-3.5 ${newPassword.length >= 8 ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span>Độ dài từ 8 ký tự trở lên</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-3.5 w-3.5 ${/[a-zA-Z]/.test(newPassword) ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span>Chứa ít nhất 1 chữ cái (a-z, A-Z)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-3.5 w-3.5 ${/[0-9]/.test(newPassword) ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span>Chứa ít nhất 1 chữ số (0-9)</span>
            </div>
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full py-2.5">
            Xác nhận đổi mật khẩu
          </Button>
        </form>
      </div>
    </div>
  );
};
