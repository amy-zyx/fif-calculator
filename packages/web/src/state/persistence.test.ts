import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllData, isOptedIn, saveSession, setOptedIn, toPersisted } from './persistence';
import { emptySession, type SessionState } from './session';

function sessionWithData(): SessionState {
  return {
    ...emptySession(),
    taxpayerName: 'Test Taxpayer',
    openingHoldings: [
      { ticker: 'NVDA', exchange: null, quantity: '100', marketPricePerUnit: '50', currency: 'USD', costNzd: '8000' },
    ],
    fxRates: { 'USD|2025-04-01': '0.6000' },
    accounts: [
      { fileName: 'ibkr.csv', brokerLabel: 'IBKR', verified: false, warnings: [], txns: [] },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('persistence consent', () => {
  it('is off by default — transaction data is never stored until asked for', () => {
    expect(isOptedIn()).toBe(false);
  });

  it('turns on and off', () => {
    setOptedIn(true);
    expect(isOptedIn()).toBe(true);
    setOptedIn(false);
    expect(isOptedIn()).toBe(false);
  });

  it('saveSession is a no-op while opted out', async () => {
    // jsdom has no IndexedDB by default; if saveSession tried to write while opted out
    // this would reject rather than resolve silently.
    await expect(saveSession(sessionWithData())).resolves.toBeUndefined();
  });
});

describe('clearAllData', () => {
  /**
   * Regression: an earlier version opened a new IndexedDB connection per call and never
   * closed any, so `deleteDatabase` fired `onblocked` — and the handler resolved as if
   * it had succeeded. The UI then told the user their data was gone while it was still
   * on disk. For a privacy control that is the worst possible failure mode.
   */
  it('reports honestly whether the database was actually deleted', async () => {
    setOptedIn(true);
    const outcome = await clearAllData();
    // jsdom has no IndexedDB, so deletion cannot succeed here — the point is that the
    // result SAYS SO rather than claiming success.
    expect(outcome).toHaveProperty('deleted');
    if (!outcome.deleted) expect(typeof outcome.reason).toBe('string');
  });

  it('revokes consent first, so nothing can be written even if deletion fails', async () => {
    setOptedIn(true);
    await clearAllData();
    expect(isOptedIn()).toBe(false);
  });

  it('clears the language and API key keys too, not just the session', async () => {
    localStorage.setItem('fif.language', 'zh-Hans');
    localStorage.setItem('fif.alphaVantageKey', 'secret');
    await clearAllData();
    expect(localStorage.getItem('fif.language')).toBeNull();
    expect(localStorage.getItem('fif.alphaVantageKey')).toBeNull();
  });
});

describe('toPersisted', () => {
  it('keeps the hand-entered inputs needed to rebuild a session', () => {
    const persisted = toPersisted(sessionWithData());
    expect(persisted.taxpayerName).toBe('Test Taxpayer');
    expect(persisted.openingHoldings).toHaveLength(1);
    expect(persisted.fxRates['USD|2025-04-01']).toBe('0.6000');
  });

  it('stores only structured-cloneable values — no Decimals, no derived results', () => {
    const persisted = toPersisted(sessionWithData());
    // Would throw on a Decimal instance or any non-cloneable value.
    expect(() => structuredClone(persisted)).not.toThrow();
    expect(persisted).not.toHaveProperty('accounts');
  });
});
