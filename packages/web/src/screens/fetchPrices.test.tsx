import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySession, type SessionState } from '../state/session';
import { PricesScreen } from './PricesScreen';

function txn(ticker: string, exchange: string, currency: string): CanonicalTxn {
  return {
    id: `${ticker}-buy`,
    sourceAccountId: 'acct_1',
    brokerId: 'SHARESIES',
    brokerRef: `${ticker}-1`,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: { ticker, exchange, isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D('10'),
    pricePerUnit: D('100'),
    currency,
    grossAmount: D('1000'),
    fees: D('0'),
    netAmount: D('1000'),
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

function sessionWith(txns: CanonicalTxn[]): SessionState {
  return {
    ...emptySession(),
    incomeYear: 2026,
    excludedCurrencies: [],
    accounts: [{ fileName: 'f.csv', brokerLabel: 'S', verified: true, warnings: [], txns }],
  };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetching closing prices', () => {
  it('fills a USD holding from the API and keeps the requirement currency', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          'Time Series (Daily)': { '2026-03-31': { '4. close': '512.34' } },
        }),
      })),
    );

    const onChange = vi.fn();
    render(
      <PricesScreen session={sessionWith([txn('QQQ', 'NASDAQ', 'USD')])} onChange={onChange} onNext={() => {}} onBack={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText('Alpha Vantage API key'), { target: { value: 'test-key' } });
    fireEvent.click(screen.getByTestId('fetch-prices'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const patch = onChange.mock.calls.at(-1)?.[0] as Partial<SessionState>;
    expect(patch.closingPrices?.[0]).toMatchObject({ ticker: 'QQQ', pricePerUnit: '512.34', currency: 'USD' });
  });

  /**
   * The guard that matters. Alpha Vantage's daily series states no currency and a plain
   * ticker resolves to the US listing, so fetching "BHP" for an ASX holding would store
   * the US price against an AUD holding — a silent wrong number of exactly the kind this
   * project keeps turning up.
   */
  it('refuses to fetch a non-USD holding, and says why', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const onChange = vi.fn();
    render(
      <PricesScreen session={sessionWith([txn('BHP', 'ASX', 'AUD')])} onChange={onChange} onNext={() => {}} onBack={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText('Alpha Vantage API key'), { target: { value: 'test-key' } });
    fireEvent.click(screen.getByTestId('fetch-prices'));

    await waitFor(() => expect(screen.getByTestId('fetch-prices-message')).toBeInTheDocument());
    expect(screen.getByTestId('fetch-prices-message')).toHaveTextContent(/BHP \(AUD\).*not USD/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('asks for a key before attempting anything', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <PricesScreen session={sessionWith([txn('QQQ', 'NASDAQ', 'USD')])} onChange={vi.fn()} onNext={() => {}} onBack={() => {}} />,
    );

    fireEvent.click(screen.getByTestId('fetch-prices'));
    await waitFor(() =>
      expect(screen.getByTestId('fetch-prices-message')).toHaveTextContent(/API key first/),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports the trading day actually used when 31 March was not one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          // No 2026-03-31 row — the series stops at the previous trading day.
          'Time Series (Daily)': { '2026-03-27': { '4. close': '500.00' } },
        }),
      })),
    );

    render(
      <PricesScreen session={sessionWith([txn('QQQ', 'NASDAQ', 'USD')])} onChange={vi.fn()} onNext={() => {}} onBack={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('Alpha Vantage API key'), { target: { value: 'k' } });
    fireEvent.click(screen.getByTestId('fetch-prices'));

    await waitFor(() =>
      expect(screen.getByTestId('fetch-prices-message')).toHaveTextContent(
        /used the close from 2026-03-27, the last trading day on or before 2026-03-31/,
      ),
    );
  });

  it('surfaces a rate-limit reply instead of silently filling nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ Note: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.' }),
      })),
    );

    render(
      <PricesScreen session={sessionWith([txn('QQQ', 'NASDAQ', 'USD')])} onChange={vi.fn()} onNext={() => {}} onBack={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('Alpha Vantage API key'), { target: { value: 'k' } });
    fireEvent.click(screen.getByTestId('fetch-prices'));

    await waitFor(() =>
      expect(screen.getByTestId('fetch-prices-message')).toHaveTextContent(/rate limit/i),
    );
  });
});
