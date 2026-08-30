import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptySession, type SessionState } from '../state/session';
import { PricesScreen } from './PricesScreen';

/** An ASX holding priced in AUD — deliberately not USD. */
function audSession(): SessionState {
  const txn: CanonicalTxn = {
    id: 'buy-bhp',
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR',
    brokerRef: null,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: { ticker: 'BHP', exchange: 'ASX', isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D('1000'),
    pricePerUnit: D('60'),
    currency: 'AUD',
    grossAmount: D('60000'),
    fees: D('0'),
    netAmount: D('60000'),
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
  return {
    ...emptySession(),
    incomeYear: 2026,
    accounts: [{ fileName: 'asx.csv', brokerLabel: 'IBKR', verified: false, warnings: [], txns: [txn] }],
  };
}

describe('PricesScreen closing-price currency', () => {
  /**
   * Regression: a newly created closing-price row hardcoded `currency: 'USD'`. The UI
   * displayed AUD, because the input falls back to the requirement's currency when no
   * entry exists yet — so the screen looked right while the session stored USD, and the
   * closing price would then be converted at the USD rate. Silent, and wrong in exactly
   * the way that yields a plausible but incorrect tax figure.
   */
  it('creates the row in the instrument’s own currency, not a hardcoded USD', () => {
    const onChange = vi.fn();
    render(
      <PricesScreen session={audSession()} onChange={onChange} onNext={() => {}} onBack={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText('Closing price for BHP'), { target: { value: '60' } });

    const patch = onChange.mock.calls[0]?.[0] as Partial<SessionState> | undefined;
    expect(patch?.closingPrices?.[0]).toMatchObject({ ticker: 'BHP', pricePerUnit: '60', currency: 'AUD' });
  });

  it('asks for a rate in the instrument’s currency', () => {
    render(<PricesScreen session={audSession()} onChange={() => {}} onNext={() => {}} onBack={() => {}} />);
    expect(screen.getByLabelText('Rate for AUD on 2025-06-10')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rate for USD on 2025-06-10')).not.toBeInTheDocument();
  });

  it('blocks Calculate until every price and rate is present', () => {
    render(<PricesScreen session={audSession()} onChange={() => {}} onNext={() => {}} onBack={() => {}} />);
    expect(screen.getByRole('button', { name: 'Calculate' })).toBeDisabled();
  });
});
