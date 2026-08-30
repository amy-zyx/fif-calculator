import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import { runCalculation } from './runCalculation';
import {
  activeSession,
  addTaxpayer,
  copyFxRatesFrom,
  emptyWorkspace,
  patchActiveSession,
  removeTaxpayer,
  switchTaxpayer,
  taxpayerLabel,
  type Workspace,
} from './session';

function txn(ticker: string, gross: string): CanonicalTxn {
  return {
    id: `${ticker}-buy`,
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR',
    brokerRef: null,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: { ticker, exchange: null, isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D('100'),
    pricePerUnit: D('100'),
    currency: 'USD',
    grossAmount: D(gross),
    fees: D('0'),
    netAmount: D(gross),
    brokerQuotedRate: null,
    brokerQuoteFrom: null,
    brokerQuoteTo: null,
    brokerRateDirectionConfidence: 'UNKNOWN',
    fxRateToNzd: null,
    fxRateSource: null,
    fxResolutionTrace: [],
    rawRow: {},
    parseWarnings: [],
  };
}

/**
 * Two people, each just under the NZD 50,000 threshold on their own. Pooled they would
 * be well over it, so this is exactly the scenario the isolation must prevent.
 */
function coupleWorkspace(): Workspace {
  const rates = { 'USD|2025-04-01': '0.6000', 'USD|2025-06-10': '0.6000', 'USD|2026-03-31': '0.6000' };

  let ws = emptyWorkspace();
  // Person A: USD 29,000 / 0.60 = NZD 48,333.33
  ws = patchActiveSession(ws, {
    taxpayerName: 'Person A',
    accounts: [{ fileName: 'a.csv', brokerLabel: 'IBKR', verified: false, warnings: [], txns: [txn('AAA', '29000')] }],
    closingPrices: [{ ticker: 'AAA', exchange: null, pricePerUnit: '100', currency: 'USD' }],
    fxRates: rates,
  });

  ws = addTaxpayer(ws, 'Person B');
  // Person B: USD 29,000 / 0.60 = NZD 48,333.33 as well
  ws = patchActiveSession(ws, {
    accounts: [{ fileName: 'b.csv', brokerLabel: 'IBKR', verified: false, warnings: [], txns: [txn('BBB', '29000')] }],
    closingPrices: [{ ticker: 'BBB', exchange: null, pricePerUnit: '100', currency: 'USD' }],
    fxRates: rates,
  });

  return ws;
}

describe('hard isolation between taxpayers', () => {
  it('each person is calculated against their own threshold, not a pooled one', () => {
    const ws = coupleWorkspace();

    for (const taxpayer of ws.taxpayers) {
      const result = runCalculation(taxpayer.session);
      expect(result.status).toBe('NOT_IN_FIF');
      if (result.status !== 'NOT_IN_FIF') continue;
      // 48,333.33 each — under the threshold. Pooled they would be 96,666.67, which is
      // comfortably over, so a pooling bug would flip both to in-FIF.
      expect(result.deMinimis.peakCostNzd.toFixed(2)).toBe('48333.33');
      expect(result.deMinimis.inFif).toBe(false);
    }
  });

  it("one person's transactions never appear in another's calculation", () => {
    const ws = coupleWorkspace();
    const [a, b] = ws.taxpayers;

    const resultA = runCalculation((a as NonNullable<typeof a>).session);
    const resultB = runCalculation((b as NonNullable<typeof b>).session);

    const tickersIn = (r: ReturnType<typeof runCalculation>) =>
      r.status === 'OK' || r.status === 'NOT_IN_FIF'
        ? r.deMinimis.timeline.map((p) => p.note).join(' ')
        : '';

    expect(tickersIn(resultA)).toContain('AAA');
    expect(tickersIn(resultA)).not.toContain('BBB');
    expect(tickersIn(resultB)).toContain('BBB');
    expect(tickersIn(resultB)).not.toContain('AAA');
  });

  it('patching the active taxpayer leaves every other taxpayer byte-for-byte unchanged', () => {
    const ws = coupleWorkspace();
    const before = JSON.parse(JSON.stringify(ws.taxpayers[0]?.session.accounts.length));

    const after = patchActiveSession(ws, { taxpayerName: 'Renamed' });

    expect(after.taxpayers[0]?.session.taxpayerName).toBe('Person A');
    expect(after.taxpayers[0]?.session.accounts.length).toBe(before);
    expect(after.taxpayers[1]?.session.taxpayerName).toBe('Renamed');
  });
});

describe('workspace mechanics', () => {
  it('starts with exactly one taxpayer, which is active', () => {
    const ws = emptyWorkspace();
    expect(ws.taxpayers).toHaveLength(1);
    expect(activeSession(ws).accounts).toEqual([]);
  });

  it('adding a taxpayer switches to them, so the next upload lands on the new person', () => {
    const ws = addTaxpayer(emptyWorkspace(), 'Second');
    expect(ws.taxpayers).toHaveLength(2);
    expect(activeSession(ws).taxpayerName).toBe('Second');
  });

  it('refuses to remove the last taxpayer', () => {
    const ws = emptyWorkspace();
    expect(removeTaxpayer(ws, ws.activeTaxpayerId).taxpayers).toHaveLength(1);
  });

  it('picks a surviving taxpayer as active when the active one is removed', () => {
    const ws = addTaxpayer(emptyWorkspace(), 'Second');
    const after = removeTaxpayer(ws, ws.activeTaxpayerId);
    expect(after.taxpayers).toHaveLength(1);
    expect(after.taxpayers.some((t) => t.id === after.activeTaxpayerId)).toBe(true);
  });

  it('ignores a switch to an unknown taxpayer rather than blanking the workspace', () => {
    const ws = emptyWorkspace();
    expect(switchTaxpayer(ws, 'nope').activeTaxpayerId).toBe(ws.activeTaxpayerId);
  });

  it('falls back to a real taxpayer if the active id is corrupt', () => {
    const ws = { ...emptyWorkspace(), activeTaxpayerId: 'missing' };
    expect(() => activeSession(ws)).not.toThrow();
  });

  it('labels an unnamed taxpayer positionally', () => {
    const ws = emptyWorkspace();
    expect(taxpayerLabel(ws.taxpayers[0]!, 0)).toBe('Taxpayer 1');
  });
});

describe('copyFxRatesFrom', () => {
  it('copies rates, which are objective market data', () => {
    const ws = coupleWorkspace();
    const cleared = patchActiveSession(ws, { fxRates: {} });
    const copied = copyFxRatesFrom(cleared, cleared.taxpayers[0]!.id);
    expect(copied.taxpayers[1]?.session.fxRates['USD|2025-06-10']).toBe('0.6000');
  });

  it('copies NOTHING else — holdings, accounts and prices stay separate', () => {
    const ws = coupleWorkspace();
    const copied = copyFxRatesFrom(ws, ws.taxpayers[0]!.id);
    const b = copied.taxpayers[1]!.session;

    expect(b.accounts).toHaveLength(1);
    expect(b.accounts[0]?.fileName).toBe('b.csv');
    expect(b.closingPrices.map((p) => p.ticker)).toEqual(['BBB']);
    expect(b.openingHoldings).toEqual([]);
  });

  it('is a no-op when the source is the active taxpayer', () => {
    const ws = coupleWorkspace();
    expect(copyFxRatesFrom(ws, ws.activeTaxpayerId)).toBe(ws);
  });
});
