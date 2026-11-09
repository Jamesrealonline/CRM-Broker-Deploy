// ========================================================
// REAL ESTATE CRM - SHARED DATE RANGE FILTER COMPONENT
// Asia/Ho_Chi_Minh, Presets, Comparison, Mobile Responsive
// ========================================================

import React, { useState } from 'react';
import { Calendar, ChevronDown, ArrowRight, TrendingUp, X } from 'lucide-react';
import { DateRangePreset, DateRangeValue } from '@/domain/types';
import { DATE_RANGE_PRESETS } from '@/domain/constants';

export interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange?: (value: DateRangeValue) => void;
  onPresetChange?: (preset: DateRangePreset) => void;
  onCustomRangeChange?: (from: string, to: string) => void;
  isComparingPrevious?: boolean;
  onCompareToggle?: (compare: boolean) => void;
  className?: string;
  showCompareToggle?: boolean;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  value,
  onChange,
  onPresetChange,
  onCustomRangeChange,
  isComparingPrevious,
  onCompareToggle,
  className = '',
  showCompareToggle = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(value.from);
  const [tempTo, setTempTo] = useState(value.to);
  const [error, setError] = useState<string | null>(null);

  const currentPresetObj = DATE_RANGE_PRESETS.find(p => p.value === value.preset);
  const label = currentPresetObj ? currentPresetObj.label : 'Tùy chọn';

  const notifyChange = (newVal: DateRangeValue) => {
    if (onChange) onChange(newVal);
    if (onPresetChange && newVal.preset && newVal.preset !== value.preset) {
      onPresetChange(newVal.preset);
    }
    if (onCustomRangeChange && (newVal.from !== value.from || newVal.to !== value.to)) {
      onCustomRangeChange(newVal.from, newVal.to);
    }
    if (onCompareToggle && newVal.compare !== value.compare) {
      onCompareToggle(Boolean(newVal.compare));
    }
  };

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setTempFrom(value.from);
      setTempTo(value.to);
      return;
    }
    setError(null);
    setIsOpen(false);
    notifyChange({
      ...value,
      preset
    });
  };

  const handleApplyCustom = () => {
    if (tempFrom > tempTo) {
      setError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }
    setError(null);
    setIsOpen(false);
    notifyChange({
      ...value,
      from: tempFrom,
      to: tempTo,
      preset: 'custom'
    });
  };

  const handleToggleCompare = (e: React.ChangeEvent<HTMLInputElement>) => {
    notifyChange({
      ...value,
      compare: e.target.checked
    });
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs transition-colors"
        >
          <Calendar className="h-4 w-4 text-blue-600" />
          <span>{label}:</span>
          <span className="font-mono text-slate-900">{value.from} → {value.to}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {showCompareToggle && (
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
            <input
              type="checkbox"
              checked={!!value.compare}
              onChange={handleToggleCompare}
              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
            />
            <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">So sánh kỳ trước</span>
            {value.compare && value.previousFrom && (
              <span className="text-[10px] text-blue-600 font-mono">
                ({value.previousFrom} → {value.previousTo})
              </span>
            )}
          </label>
        )}
      </div>

      {/* Dropdown / Modal Overlay */}
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/20 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-4 bottom-4 sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-80 p-4 bg-white rounded-xl shadow-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-600" />
                Chọn Khung Thời Gian
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {DATE_RANGE_PRESETS.map((preset) => {
                const isSelected = value.preset === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetSelect(preset.value)}
                    className={`px-2.5 py-1.5 rounded-md text-left font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Range Picker */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="font-semibold text-slate-700 block text-[11px] uppercase tracking-wider">
                Khoảng ngày tùy chọn (UTC+7)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {error && (
                <p className="text-[11px] text-red-600 font-medium">{error}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-xs"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
