import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Mail, 
  MessageSquare, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ClientDispatchInfo } from '@/domain/services/notificationService';

export interface LeadDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatchInfo: ClientDispatchInfo | null;
  saleName: string;
  saleEmail: string;
  salePhone?: string;
  leadCount?: number;
}

export const LeadDispatchModal: React.FC<LeadDispatchModalProps> = ({
  isOpen,
  onClose,
  dispatchInfo,
  saleName,
  saleEmail,
  salePhone,
  leadCount = 1,
}) => {
  const [copiedZalo, setCopiedZalo] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!dispatchInfo) return null;

  const handleOpenGmail = () => {
    window.open(dispatchInfo.gmailUrl, '_blank');
  };

  const handleSendZalo = async () => {
    try {
      await navigator.clipboard.writeText(dispatchInfo.zaloText);
      setCopiedZalo(true);
      setTimeout(() => setCopiedZalo(false), 4000);
    } catch {
      // Fallback nếu không truy cập được clipboard
    }

    if (dispatchInfo.zaloUrl) {
      window.open(dispatchInfo.zaloUrl, '_blank');
    } else {
      window.open('https://chat.zalo.me', '_blank');
    }
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(dispatchInfo.plainBody);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleOpenMailto = () => {
    window.location.href = dispatchInfo.mailtoUrl;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bàn Giao Lead Thành Công! Gửi Thông Báo Tức Thì"
      description={`Đã lưu thông tin bàn giao ${leadCount} khách hàng cho chuyên viên ${saleName}.`}
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        {/* Banner trạng thái */}
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <div className="p-1.5 bg-emerald-500 text-white rounded-lg shrink-0 mt-0.5">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-emerald-950 text-sm">
              Đã cập nhật hệ thống và bắt đầu đồng hồ SLA 24h
            </h4>
            <p className="text-emerald-800 text-xs mt-0.5 leading-relaxed">
              Bạn có thể gửi ngay thông báo đến máy của <strong>{saleName}</strong> ({saleEmail}{salePhone ? ` - ${salePhone}` : ''}) thông qua các kênh 1-Click bên dưới mà không cần cài đặt mật khẩu phức tạp:
            </p>
          </div>
        </div>

        {/* Thông báo copy Zalo thành công nếu có */}
        {copiedZalo && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
            <Check className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-medium">
              Đã sao chép nội dung tin nhắn Zalo vào bộ nhớ tạm! Nhấn <strong>Ctrl+V</strong> (hoặc Cmd+V) vào khung chat Zalo để gửi cho Sale.
            </span>
          </div>
        )}

        {/* 2 Nút chính: Gmail Web & Zalo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* NÚT 1: GMAIL WEB */}
          <button
            type="button"
            onClick={handleOpenGmail}
            className="group p-4 bg-white hover:bg-rose-50/50 border-2 border-rose-200 hover:border-rose-500 rounded-xl text-left transition-all shadow-sm hover:shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  <Mail className="h-3 w-3 text-rose-600" />
                  Gmail Web 1-Click
                </span>
                <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
              </div>
              <h5 className="font-bold text-slate-900 text-sm group-hover:text-rose-700 transition-colors">
                Mở Gmail Soạn Thư Ngay
              </h5>
              <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                Tự động mở tab Gmail của bạn. Người nhận, tiêu đề và nội dung bàn giao chi tiết đã được điền sẵn 100%.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-rose-100 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
              <Sparkles className="h-3.5 w-3.5" />
              Chỉ cần bấm nút "Gửi" trên Gmail
            </div>
          </button>

          {/* NÚT 2: ZALO CHAT */}
          <button
            type="button"
            onClick={handleSendZalo}
            className="group p-4 bg-white hover:bg-blue-50/50 border-2 border-blue-200 hover:border-blue-500 rounded-xl text-left transition-all shadow-sm hover:shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  <MessageSquare className="h-3 w-3 text-blue-600" />
                  Zalo Chat Nhanh
                </span>
                <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h5 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                Mở Zalo Gửi Cho Sale
              </h5>
              <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                Tự động sao chép nội dung và mở khung chat Zalo theo số điện thoại {salePhone || saleName}. Bạn chỉ cần dán (Ctrl+V) gửi đi!
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center gap-1 text-[11px] font-semibold text-blue-600">
              <Smartphone className="h-3.5 w-3.5" />
              Copy sẵn + Mở chat zalo.me
            </div>
          </button>
        </div>

        {/* Các kênh phụ */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenMailto}
            className="text-xs flex items-center gap-1.5 text-slate-700"
          >
            <Mail className="h-3.5 w-3.5 text-slate-500" />
            Mở Ứng Dụng Mail Mặc Định (Outlook / Apple Mail)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="text-xs flex items-center gap-1.5 text-slate-700"
          >
            {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
            {copiedAll ? 'Đã sao chép văn bản!' : 'Sao chép nội dung (gửi Telegram/SMS)'}
          </Button>
        </div>

        {/* Xem trước nội dung */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full px-3 py-2 text-left flex items-center justify-between text-slate-600 hover:text-slate-900 text-[11px] font-medium"
          >
            <span>Xem trước tiêu đề và nội dung tin nhắn sẽ gửi</span>
            {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showPreview && (
            <div className="p-3 bg-white border-t border-slate-200 space-y-2 text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              <div className="font-semibold text-slate-900 pb-1 border-b border-slate-100">
                Tiêu đề: {dispatchInfo.subject}
              </div>
              <div>{dispatchInfo.plainBody}</div>
            </div>
          )}
        </div>

        {/* Nút đóng */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900"
          >
            Hoàn Tất & Đóng Lại
          </Button>
        </div>
      </div>
    </Modal>
  );
};
