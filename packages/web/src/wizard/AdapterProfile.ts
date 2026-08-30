import type { BrokerId } from '@fif-calculator/engine';
import type { ColumnMapping, TypeValueMap } from './applyMapping';

/**
 * A completed Column Mapping Wizard mapping, saved as a portable, exportable /
 * importable profile (spec §4.2 point 3) — "this is what makes the product survive
 * contact with reality."
 */
export interface AdapterProfile {
  version: 1;
  profileName: string;
  brokerId: BrokerId;
  createdAt: string; // ISO datetime
  columnMapping: ColumnMapping;
  typeValueMap: TypeValueMap;
  fxRateConvertsTo: 'NZD' | 'ACCOUNT_BASE_CURRENCY' | 'UNKNOWN' | null;
}

export function serializeAdapterProfile(profile: AdapterProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function parseAdapterProfile(json: string): AdapterProfile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Not valid JSON');
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('Malformed adapter profile');
  }
  const candidate = data as Partial<AdapterProfile>;
  if (candidate.version !== 1) {
    throw new Error(`Unsupported adapter profile version: ${String(candidate.version)}`);
  }
  if (typeof candidate.profileName !== 'string' || typeof candidate.columnMapping !== 'object') {
    throw new Error('Malformed adapter profile: missing profileName or columnMapping');
  }
  return candidate as AdapterProfile;
}
