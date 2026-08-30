import { describe, expect, it } from 'vitest';
import {
  getAlternateDeMinimisThreshold,
  getIncomeYearTaxConfig,
  listSupportedIncomeYears,
} from './tax-config';

describe('getIncomeYearTaxConfig', () => {
  it('returns the enacted $50,000 threshold for 2025-26', () => {
    const config = getIncomeYearTaxConfig(2026);
    expect(config.deMinimisThreshold.amountNzd.toString()).toBe('50000');
    expect(config.deMinimisThreshold.status).toBe('enacted');
  });

  it('returns the proposed $100,000 threshold for 2026-27, tagged proposed', () => {
    const config = getIncomeYearTaxConfig(2027);
    expect(config.deMinimisThreshold.amountNzd.toString()).toBe('100000');
    expect(config.deMinimisThreshold.status).toBe('proposed');
  });

  it('uses the 5% FDR rate for every supported year', () => {
    for (const year of listSupportedIncomeYears()) {
      expect(getIncomeYearTaxConfig(year).fdrRate.rate.toString()).toBe('0.05');
    }
  });

  it('throws rather than guessing for an unsupported year', () => {
    expect(() => getIncomeYearTaxConfig(1999)).toThrow(/No tax config/);
  });
});

describe('getAlternateDeMinimisThreshold', () => {
  it('offers the $50,000 current-law figure as the alternate for the proposed 2026-27 year', () => {
    const alt = getAlternateDeMinimisThreshold(2027);
    expect(alt?.amountNzd.toString()).toBe('50000');
    expect(alt?.status).toBe('enacted');
  });

  it('returns null for a year whose threshold is already enacted', () => {
    expect(getAlternateDeMinimisThreshold(2026)).toBeNull();
  });
});
