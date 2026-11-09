// ========================================================
// REAL ESTATE CRM - FEATURE FLAGS SYSTEM (PHASE 6)
// Quản lý cờ tính năng linh hoạt qua biến môi trường & runtime override
// ========================================================

export type FeatureFlagKey = 
  | 'ai_advisor'
  | 'debt_aging'
  | 'quotations'
  | 'pwa_offline'
  | 'sms_integration'
  | 'marketing_analytics'
  | 'privacy_center';

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  ai_advisor: true,
  debt_aging: true,
  quotations: true,
  pwa_offline: true,
  sms_integration: false, // Default false until provider credentials configured
  marketing_analytics: true,
  privacy_center: true
};

const STORAGE_KEY_FLAG_OVERRIDES = 'crm_feature_flag_overrides';

export class FeatureFlagManager {
  private getOverrides(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_FLAG_OVERRIDES) || '{}');
    } catch {
      return {};
    }
  }

  isEnabled(key: FeatureFlagKey): boolean {
    const overrides = this.getOverrides();
    if (typeof overrides[key] === 'boolean') {
      return overrides[key];
    }

    // Check environment variable (Vite prefix VITE_FF_)
    const envVarName = `VITE_FF_${key.toUpperCase()}`;
    const envValue = (import.meta as any).env?.[envVarName];
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === '1';
    }

    return DEFAULT_FLAGS[key] ?? false;
  }

  setOverride(key: FeatureFlagKey, enabled: boolean): void {
    const overrides = this.getOverrides();
    overrides[key] = enabled;
    localStorage.setItem(STORAGE_KEY_FLAG_OVERRIDES, JSON.stringify(overrides));
  }

  clearOverride(key: FeatureFlagKey): void {
    const overrides = this.getOverrides();
    delete overrides[key];
    localStorage.setItem(STORAGE_KEY_FLAG_OVERRIDES, JSON.stringify(overrides));
  }

  clearAllOverrides(): void {
    localStorage.removeItem(STORAGE_KEY_FLAG_OVERRIDES);
  }

  getAllFlags(): Record<FeatureFlagKey, boolean> {
    const keys: FeatureFlagKey[] = [
      'ai_advisor',
      'debt_aging',
      'quotations',
      'pwa_offline',
      'sms_integration',
      'marketing_analytics',
      'privacy_center'
    ];

    const result: Partial<Record<FeatureFlagKey, boolean>> = {};
    for (const key of keys) {
      result[key] = this.isEnabled(key);
    }
    return result as Record<FeatureFlagKey, boolean>;
  }
}

export const featureFlags = new FeatureFlagManager();
