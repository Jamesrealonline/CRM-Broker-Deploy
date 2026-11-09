// ========================================================
// REAL ESTATE CRM - SHARED DATE RANGE HOOK (PHASE 8 / YÊU CẦU 4)
// Timezone Asia/Ho_Chi_Minh (UTC+7), Presets, Comparison,
// URL Sync & LocalStorage Preference
// ========================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DateRangePreset, DateRangeValue } from '@/domain/types';

const STORAGE_KEY_PRESET_PREFERENCE = 'crm_preferred_date_preset';

/**
 * Format a Date object to YYYY-MM-DD in Vietnam Timezone (Asia/Ho_Chi_Minh, UTC+7)
 */
export function formatVietnamDate(date: Date): string {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const vnDate = new Date(utc + (7 * 3600000));
  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, '0');
  const day = String(vnDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

export function computePresetRange(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date();
  const todayStr = formatVietnamDate(now);
  const today = parseISODate(todayStr);

  switch (preset) {
    case 'today':
      return { from: todayStr, to: todayStr };

    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 24 * 3600000);
      const str = formatVietnamDate(yesterday);
      return { from: str, to: str };
    }

    case 'last_7_days': {
      const past7 = new Date(today.getTime() - 6 * 24 * 3600000);
      return { from: formatVietnamDate(past7), to: todayStr };
    }

    case 'last_30_days': {
      const past30 = new Date(today.getTime() - 29 * 24 * 3600000);
      return { from: formatVietnamDate(past30), to: todayStr };
    }

    case 'this_week': {
      // Day of week in VN (Monday is start of week: 1, Sunday is 0)
      const day = today.getUTCDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(today.getTime() - diffToMonday * 24 * 3600000);
      return { from: formatVietnamDate(monday), to: todayStr };
    }

    case 'this_month': {
      const [yearStr, monthStr] = todayStr.split('-');
      const from = `${yearStr}-${monthStr}-01`;
      return { from, to: todayStr };
    }

    case 'last_month': {
      const y = today.getUTCFullYear();
      const m = today.getUTCMonth(); // 0-based
      const firstDayLastMonth = new Date(Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1));
      const lastDayLastMonth = new Date(Date.UTC(y, m, 0));
      return {
        from: formatVietnamDate(firstDayLastMonth),
        to: formatVietnamDate(lastDayLastMonth)
      };
    }

    case 'this_quarter': {
      const y = today.getUTCFullYear();
      const m = today.getUTCMonth(); // 0-11
      const qStartMonth = Math.floor(m / 3) * 3;
      const firstDayQuarter = new Date(Date.UTC(y, qStartMonth, 1));
      return { from: formatVietnamDate(firstDayQuarter), to: todayStr };
    }

    case 'this_year': {
      const y = today.getUTCFullYear();
      return { from: `${y}-01-01`, to: todayStr };
    }

    case 'custom':
    default:
      return { from: todayStr, to: todayStr };
  }
}

/**
 * Calculates the exact preceding period for comparison
 */
export function computeComparisonRange(from: string, to: string): { previousFrom: string; previousTo: string } {
  const fromDate = parseISODate(from);
  const toDate = parseISODate(to);
  const durationMs = toDate.getTime() - fromDate.getTime() + 24 * 3600000;
  
  const prevToDate = new Date(fromDate.getTime() - 24 * 3600000);
  const prevFromDate = new Date(prevToDate.getTime() - durationMs + 24 * 3600000);

  return {
    previousFrom: formatVietnamDate(prevFromDate),
    previousTo: formatVietnamDate(prevToDate)
  };
}

export function useDateRange(defaultPresetOrConfig: DateRangePreset | { defaultPreset?: DateRangePreset; storageKey?: string } = 'this_month') {
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultPreset: DateRangePreset = typeof defaultPresetOrConfig === 'string'
    ? defaultPresetOrConfig
    : defaultPresetOrConfig.defaultPreset || 'this_month';

  const storageKey = typeof defaultPresetOrConfig === 'object' && defaultPresetOrConfig.storageKey
    ? defaultPresetOrConfig.storageKey
    : STORAGE_KEY_PRESET_PREFERENCE;

  // Read preferred preset from localStorage if available
  const initialPreset = useMemo<DateRangePreset>(() => {
    const urlPreset = searchParams.get('preset') as DateRangePreset;
    if (urlPreset) return urlPreset;
    try {
      const stored = localStorage.getItem(storageKey) as DateRangePreset;
      if (stored) return stored;
    } catch {
      // ignore
    }
    return defaultPreset;
  }, [searchParams, defaultPreset, storageKey]);

  // Initial from & to
  const initialRange = useMemo<{ from: string; to: string }>(() => {
    const urlFrom = searchParams.get('from');
    const urlTo = searchParams.get('to');
    if (urlFrom && urlTo) {
      return { from: urlFrom, to: urlTo };
    }
    return computePresetRange(initialPreset);
  }, [searchParams, initialPreset]);

  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [from, setFrom] = useState<string>(initialRange.from);
  const [to, setTo] = useState<string>(initialRange.to);
  const [compare, setCompare] = useState<boolean>(searchParams.get('compare') === 'true');

  // Update URL params when date range changes
  const updateRange = useCallback((newPreset: DateRangePreset, newFrom?: string, newTo?: string, newCompare?: boolean) => {
    let f = newFrom;
    let t = newTo;

    if (newPreset !== 'custom') {
      const computed = computePresetRange(newPreset);
      f = computed.from;
      t = computed.to;
    } else {
      f = f || from;
      t = t || to;
    }

    // Validation: from <= to
    if (f && t && f > t) {
      t = f; // auto adjust
    }

    const c = newCompare !== undefined ? newCompare : compare;

    setPreset(newPreset);
    if (f) setFrom(f);
    if (t) setTo(t);
    setCompare(c);

    try {
      localStorage.setItem(storageKey, newPreset);
    } catch {
      // ignore
    }

    // Sync to URL
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('preset', newPreset);
      if (f) next.set('from', f);
      if (t) next.set('to', t);
      if (c) next.set('compare', 'true');
      else next.delete('compare');
      return next;
    }, { replace: true });
  }, [from, to, compare, setSearchParams, storageKey]);

  // Comparison dates calculation
  const comparison = useMemo<{ previousFrom?: string; previousTo?: string }>(() => {
    if (!compare) return {};
    return computeComparisonRange(from, to);
  }, [compare, from, to]);

  const dateRangeValue: DateRangeValue = useMemo(() => ({
    from,
    to,
    preset,
    compare,
    previousFrom: comparison.previousFrom,
    previousTo: comparison.previousTo,
  }), [from, to, preset, compare, comparison]);

  return {
    value: dateRangeValue,
    dateRange: dateRangeValue,
    preset,
    from,
    to,
    compare,
    isComparingPrevious: compare,
    previousFrom: comparison.previousFrom,
    previousTo: comparison.previousTo,
    setPreset: (p: DateRangePreset) => updateRange(p),
    setCustomRange: (customFrom: string, customTo: string) => updateRange('custom', customFrom, customTo),
    setCompare: (c: boolean) => updateRange(preset, from, to, c),
    setIsComparingPrevious: (c: boolean) => updateRange(preset, from, to, c),
    updateRange,
  };
}
