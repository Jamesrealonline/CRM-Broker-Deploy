// ========================================================
// REAL ESTATE CRM - PROJECTS LIST PAGE
// ========================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Sparkles, MapPin, Tag, ChevronRight, DollarSign, Award, TrendingUp, Percent } from 'lucide-react';
import { projectRepository } from '@/data/repositories/projectRepository';
import { Project } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal tạo dự án mới
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [developer, setDeveloper] = useState('');
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('Căn hộ, Shophouse');
  const [priceRange, setPriceRange] = useState('');
  const [commissionRate, setCommissionRate] = useState('3.5');
  const [saleCommissionRate, setSaleCommissionRate] = useState('1.5');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    projectRepository.getProjects().then((list) => {
      setProjects(list);
      setLoading(false);
    });
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await projectRepository.createProject({
        name,
        code,
        developer,
        location,
        property_type: propertyType,
        expected_price_range: priceRange,
        commission_rate: Number(commissionRate) || 3.5,
        sale_commission_rate: Number(saleCommissionRate) || 1.5,
      });
      setCreateModalOpen(false);
      // Theo yêu cầu mục 7: Khi tạo dự án mới, hệ thống chuyển thẳng tới trang Dự án & Tri thức AI của dự án đó
      navigate(`/projects/${created.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Danh Mục Dự Án & Cơ Sở Tri Thức AI
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mỗi dự án tích hợp trung tâm tri thức văn bản, FAQ và Sales Scripts tự động cập nhật.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Thêm dự án mới
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => (
            <Card
              key={proj.id}
              className="hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {proj.code}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {proj.status === 'opening' ? 'Đang mở bán' : 'Sắp ra mắt'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-1">{proj.name}</h3>
                <p className="text-xs text-slate-500 mb-2">Chủ đầu tư: <span className="font-semibold text-slate-700">{proj.developer}</span></p>

                {/* Module Hoa Hồng & Lũy Tiến */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 mb-3 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Percent className="h-3 w-3 text-blue-600" /> % Hoa hồng CĐT:
                    </span>
                    <span className="font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                      {proj.commission_rate ?? 3.5}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Award className="h-3 w-3 text-amber-600" /> % Hoa hồng Sale:
                    </span>
                    <span className="font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">
                      {proj.sale_commission_rate ?? 1.8}%
                    </span>
                  </div>
                  {proj.progressive_commission && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-medium truncate">
                      📈 {proj.progressive_commission}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{proj.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{proj.expected_price_range || 'Đang cập nhật'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Tri thức & Sản phẩm
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="text-xs py-1"
                >
                  Quản lý chi tiết <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL TẠO DỰ ÁN */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Khởi Tạo Dự Án Mới"
        description="Sau khi tạo, hệ thống sẽ mở ngay trang Dự án & Tri thức AI để bổ sung dữ liệu."
        maxWidth="md"
      >
        <form onSubmit={handleCreateProject} className="space-y-3">
          <Input
            label="Tên dự án *"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Masterise Centre Point"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mã dự án (Code) *"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MCP"
            />
            <Input
              label="Chủ đầu tư *"
              required
              value={developer}
              onChange={(e) => setDeveloper(e.target.value)}
              placeholder="Masterise Homes"
            />
          </div>
          <Input
            label="Vị trí *"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Khu công nghệ cao, TP. Thủ Đức"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Loại hình"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
            />
            <Input
              label="Khung giá dự kiến"
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              placeholder="60 - 80 triệu/m²"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-200/80">
            <div>
              <Input
                label="% Phí dự án (CĐT trả) *"
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="3.5"
              />
              <p className="text-[10px] text-blue-700 mt-1 font-medium">Tỷ lệ CĐT chi trả cho Sàn/Đại lý</p>
            </div>
            <div>
              <Input
                label="% Phí hoa hồng cho Sale *"
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={saleCommissionRate}
                onChange={(e) => setSaleCommissionRate(e.target.value)}
                placeholder="1.5"
              />
              <p className="text-[10px] text-amber-700 mt-1 font-medium">Tỷ lệ chi trả trực tiếp cho Sale</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Tạo và Chuyển Tới Tri Thức AI
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
