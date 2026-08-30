import { describe, expect, it } from 'vitest';
import { D, roundNzd } from '../money';
import { TableIrdRateProvider, irdRateToNzdFactor } from './irdProvider';
import { convertToNzd, deriveImpliedRate, resolveFxToNzd } from './resolver';

const ird = new TableIrdRateProvider({
  USD: { '2025-04-01': '0.5800', '2025-06-10': '0.6000', '2026-03-31': '0.6000' },
  HKD: { '2025-06-10': '4.6800' },
  AUD: { '2025-06-10': '0.9200' },
});

const BASE = { currency: 'USD', date: '2025-06-10', incomeYear: 2026 } as const;

describe('the FX direction convention', () => {
  it('an IRD rate of 0.58 USD per NZD converts USD 220,000 to NZD 379,310.34 (divide, not multiply)', () => {
    const factor = irdRateToNzdFactor('USD', D('0.5800')).factor;
    expect(roundNzd(D('220000').times(factor)).toString()).toBe('379310.34');
  });

  it('rejects a zero or negative published rate rather than producing an infinity', () => {
    expect(() => irdRateToNzdFactor('USD', D('0'))).toThrow(/must be positive/);
    expect(() => irdRateToNzdFactor('USD', D('-0.58'))).toThrow(/must be positive/);
  });
});

describe('resolveFxToNzd — ladder step 0: NZD needs no conversion', () => {
  it('returns an identity factor for NZD', () => {
    const result = resolveFxToNzd({ currency: 'NZD', date: '2025-06-10', incomeYear: 2026 }, 'A', ird);
    expect(result.factorToNzd?.toString()).toBe('1');
    expect(result.blocked).toBeNull();
  });
});

describe('resolveFxToNzd — ladder step 1: manual override', () => {
  it('a manual override wins over every other source', () => {
    const result = resolveFxToNzd(
      { ...BASE, manualOverride: D('0.55'), brokerQuotedRate: D('0.61') },
      'B',
      ird,
    );
    expect(result.source).toBe('MANUAL');
    expect(result.publishedRate?.toString()).toBe('0.55');
    expect(result.trace[0]).toMatch(/Manual override/);
  });
});

describe('resolveFxToNzd — ladder step 2: policies A and C are always IRD', () => {
  it('policy A uses the IRD rate for the date and ignores a present broker rate', () => {
    const result = resolveFxToNzd({ ...BASE, brokerQuotedRate: D('0.6100') }, 'A', ird);
    expect(result.source).toBe('IRD_MID_MONTH');
    expect(result.publishedRate?.toString()).toBe('0.6');
  });

  it('policy C uses the IRD rolling 12-month average', () => {
    const result = resolveFxToNzd(BASE, 'C', ird);
    expect(result.source).toBe('IRD_ROLLING_AVG');
    // Average of the three published USD points inside the 2026 income year.
    expect(result.publishedRate?.toString()).toBe('0.5933333333333333333333333333333333333333');
  });

  it('policy A blocks rather than guessing when no IRD rate exists', () => {
    const result = resolveFxToNzd({ ...BASE, currency: 'JPY' }, 'A', ird);
    expect(result.factorToNzd).toBeNull();
    expect(result.blocked?.reason).toBe('MISSING_RATE');
  });

  it('policy C blocks when no rolling average is available', () => {
    const result = resolveFxToNzd({ ...BASE, currency: 'JPY' }, 'C', ird);
    expect(result.blocked?.reason).toBe('MISSING_RATE');
  });
});

describe('resolveFxToNzd — ladder step 3: BROKER_DIRECT', () => {
  it('accepts a normal broker spread without prompting (GT-11 second case)', () => {
    // 0.5850 dealt vs 0.5800 published is a ~0.86% spread — normal, not a bug.
    const irdAtOpening = new TableIrdRateProvider({ USD: { '2025-04-01': '0.5800' } });
    const result = resolveFxToNzd(
      { currency: 'USD', date: '2025-04-01', incomeYear: 2026, brokerQuotedRate: D('0.5850'), brokerQuoteTo: 'NZD' },
      'B',
      irdAtOpening,
    );
    expect(result.blocked).toBeNull();
    expect(result.source).toBe('BROKER_DIRECT');
    expect(result.publishedRate?.toString()).toBe('0.585');
  });

  it('flags a suspected inversion, does NOT auto-apply it, and proposes the reciprocal (GT-11 first case)', () => {
    const irdAtOpening = new TableIrdRateProvider({ USD: { '2025-04-01': '0.5800' } });
    const result = resolveFxToNzd(
      { currency: 'USD', date: '2025-04-01', incomeYear: 2026, brokerQuotedRate: D('1.7241'), brokerQuoteTo: 'NZD' },
      'B',
      irdAtOpening,
    );
    expect(result.factorToNzd).toBeNull(); // never silently used
    expect(result.blocked?.reason).toBe('INVERSION_SUSPECTED');
    expect(roundNzd(result.blocked!.proposedRate!).toString()).toBe('0.58');
  });

  it('blocks a rate that is implausible in both directions', () => {
    const result = resolveFxToNzd({ ...BASE, brokerQuotedRate: D('42'), brokerQuoteTo: 'NZD' }, 'B', ird);
    expect(result.blocked?.reason).toBe('IMPLAUSIBLE_RATE');
  });
});

describe('resolveFxToNzd — ladder step 4: BROKER_CHAINED (GT-10)', () => {
  const chained = {
    currency: 'HKD',
    date: '2025-06-10',
    incomeYear: 2026,
    brokerQuotedRate: D('0.1250'),
    brokerQuoteTo: 'USD',
    accountBaseCurrency: 'USD',
  } as const;

  it('chains trade -> base -> NZD instead of treating the broker rate as an NZD rate', () => {
    const result = resolveFxToNzd(chained, 'B', ird);
    expect(result.blocked).toBeNull();
    expect(result.source).toBe('BROKER_CHAINED');

    // HKD 80,000 x 0.1250 = USD 10,000; USD 10,000 / 0.6000 = NZD 16,666.67
    expect(roundNzd(convertToNzd(D('80000'), result)).toString()).toBe('16666.67');
  });

  it('does NOT produce the naive NZD 640,000 that treating 0.1250 as an NZD rate would give', () => {
    const result = resolveFxToNzd(chained, 'B', ird);
    const naiveWrongAnswer = D('80000').dividedBy(D('0.1250'));
    expect(naiveWrongAnswer.toString()).toBe('640000'); // the failure we are guarding against
    expect(convertToNzd(D('80000'), result).toString()).not.toBe('640000');
  });

  it('records both legs of the chain in the trace', () => {
    const result = resolveFxToNzd(chained, 'B', ird);
    expect(result.trace.some((t) => t.includes('Leg 1 HKD->USD'))).toBe(true);
    expect(result.trace.some((t) => t.includes('Leg 2 USD->NZD'))).toBe(true);
    expect(result.trace.some((t) => t.includes('not NZD'))).toBe(true);
  });

  it('blocks when the direction of the chained leg cannot be established', () => {
    const result = resolveFxToNzd({ ...chained, brokerQuotedRate: D('999') }, 'B', ird);
    expect(result.factorToNzd).toBeNull();
    expect(result.blocked).not.toBeNull();
  });

  it('blocks when the target currency of the broker rate is unknown', () => {
    const result = resolveFxToNzd(
      { currency: 'HKD', date: '2025-06-10', incomeYear: 2026, brokerQuotedRate: D('0.125'), brokerQuoteTo: 'XXX' },
      'B',
      ird,
    );
    expect(result.blocked?.reason).toBe('MISSING_RATE');
  });
});

describe('resolveFxToNzd — ladder step 5: fall back to IRD with a warning', () => {
  it('policy B with no broker rate falls back to IRD and says so in the trace', () => {
    const result = resolveFxToNzd(BASE, 'B', ird);
    expect(result.source).toBe('IRD_MID_MONTH');
    expect(result.trace.some((t) => t.includes('fell back to IRD'))).toBe(true);
  });

  it('policy B with a zero broker rate falls back rather than dividing by zero', () => {
    const result = resolveFxToNzd({ ...BASE, brokerQuotedRate: D('0') }, 'B', ird);
    expect(result.source).toBe('IRD_MID_MONTH');
  });
});

describe('deriveImpliedRate (trap 3: the label lies, the arithmetic does not)', () => {
  it('derives the rate actually used from the two amounts on the row', () => {
    // HKD 80,000 settled as USD 10,000 implies 0.125, whatever the column claims.
    expect(deriveImpliedRate(D('80000'), D('10000'))?.toString()).toBe('0.125');
  });

  it('returns null when the source amount is zero', () => {
    expect(deriveImpliedRate(D('0'), D('10000'))).toBeNull();
  });
});

describe('convertToNzd', () => {
  it('throws rather than silently producing a number from a blocked resolution', () => {
    const blocked = resolveFxToNzd({ ...BASE, currency: 'JPY' }, 'A', ird);
    expect(() => convertToNzd(D('100'), blocked)).toThrow(/blocked/);
  });
});

describe('TableIrdRateProvider', () => {
  it('falls back to the most recent published rate on or before the date', () => {
    expect(ird.getRate('USD', '2025-06-20')?.toString()).toBe('0.6');
  });

  it('returns null before the first published rate rather than extrapolating', () => {
    expect(ird.getRate('USD', '2024-01-01')).toBeNull();
  });

  it('treats NZD as rate 1', () => {
    expect(ird.getRate('NZD', '2025-06-10')?.toString()).toBe('1');
  });
});
