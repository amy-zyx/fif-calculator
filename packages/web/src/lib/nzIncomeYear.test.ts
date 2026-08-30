import { describe, expect, it } from 'vitest';
import { nzIncomeYearFor } from './nzIncomeYear';

describe('nzIncomeYearFor', () => {
  it('a date after 31 March falls in next calendar year\'s income year', () => {
    expect(nzIncomeYearFor('2025-06-10')).toBe(2026);
  });

  it('a date on or before 31 March falls in the current calendar year\'s income year', () => {
    expect(nzIncomeYearFor('2025-03-31')).toBe(2025);
    expect(nzIncomeYearFor('2025-01-01')).toBe(2025);
  });

  it('returns NaN for an unparseable date', () => {
    expect(Number.isNaN(nzIncomeYearFor('not-a-date'))).toBe(true);
  });
});
