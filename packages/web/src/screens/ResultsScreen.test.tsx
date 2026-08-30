import { D } from '@fif-calculator/engine';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DrillDownPanel, DrillDownProvider } from '../components/DrillDown';
import { runCalculation } from '../state/runCalculation';
import { emptySession, type SessionState } from '../state/session';
import { ResultsScreen } from './ResultsScreen';

/**
 * GT-1 driven through the real engine and into the UI: 1,000 AAPL held all year, an
 * opening market value of NZD 379,310.34, a dividend, and a fall in price that makes
 * CV a loss. FDR is NZD 18,965.52; CV floors to zero and therefore wins.
 */
function gt1Session(): SessionState {
  return {
    ...emptySession(),
    incomeYear: 2026,
    taxpayerName: 'Test Taxpayer',
    accounts: [
      {
        fileName: 'gt1.csv',
        brokerLabel: 'IBKR',
        verified: false,
        warnings: [],
        txns: [
          {
            id: 'div-1',
            sourceAccountId: 'acct_1',
            brokerId: 'IBKR',
            brokerRef: null,
            tradeDate: '2025-09-05',
            settleDate: null,
            nzIncomeYear: 2026,
            type: 'DIVIDEND',
            instrument: { ticker: 'AAPL', exchange: 'NASDAQ', isin: null, name: null, assetClass: 'EQUITY' },
            quantity: null,
            pricePerUnit: null,
            currency: 'USD',
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
          },
        ],
      },
    ],
    openingHoldings: [
      {
        ticker: 'AAPL',
        exchange: 'NASDAQ',
        quantity: '1000',
        marketPricePerUnit: '220.00',
        currency: 'USD',
        costNzd: '300000',
      },
    ],
    closingPrices: [{ ticker: 'AAPL', exchange: 'NASDAQ', pricePerUnit: '200.00', currency: 'USD' }],
    fxRates: {
      'USD|2025-04-01': '0.5800',
      'USD|2025-09-05': '0.5800',
      'USD|2026-03-31': '0.6000',
    },
  };
}

function renderResults(session: SessionState) {
  const result = runCalculation(session);
  render(
    <DrillDownProvider>
      <ResultsScreen result={result} session={session} onBack={() => {}} />
      <DrillDownPanel />
    </DrillDownProvider>,
  );
  return result;
}

describe('ResultsScreen — GT-1 through the real engine', () => {
  it('reaches status OK', () => {
    expect(runCalculation(gt1Session()).status).toBe('OK');
  });

  it('reports the de minimis verdict as in-FIF', () => {
    renderResults(gt1Session());
    expect(screen.getByText(/the FIF rules apply/i)).toBeInTheDocument();
  });

  it('shows the FDR total, the floored CV total, and recommends CV', () => {
    renderResults(gt1Session());
    expect(screen.getByText('NZD 18,965.52'.replace(/,/g, ''))).toBeInTheDocument();
    expect(screen.getByText(/CV — NZD 0\.00/)).toBeInTheDocument();
  });

  it('opens a drill-down showing the formula and inputs when a number is clicked', () => {
    renderResults(gt1Session());

    expect(screen.queryByTestId('drilldown-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /FDR portfolio total.*Show working/i }));

    const panel = screen.getByTestId('drilldown-panel');
    expect(within(panel).getByText(/0\.05 x opening market value/)).toBeInTheDocument();
    expect(within(panel).getByText(/dividends from FIF interests are not separately taxable/i)).toBeInTheDocument();
  });

  it('explains that the CV loss is extinguished rather than carried forward', () => {
    renderResults(gt1Session());
    fireEvent.click(screen.getByRole('button', { name: /Comparative Value portfolio total.*Show working/i }));
    const panel = screen.getByTestId('drilldown-panel');
    expect(within(panel).getByText(/not carried forward/i)).toBeInTheDocument();
  });
});

describe('ResultsScreen — blocking states are never silently resolved', () => {
  it('shows the blockers and no FIF figure when a closing price is missing', () => {
    const session = { ...gt1Session(), closingPrices: [] };
    const result = runCalculation(session);
    expect(result.status).toBe('BLOCKED');

    render(
      <DrillDownProvider>
        <ResultsScreen result={result} session={session} onBack={() => {}} />
      </DrillDownProvider>,
    );
    expect(screen.getByTestId('blockers')).toBeInTheDocument();
    expect(screen.getByText(/MISSING_CLOSING_PRICE/)).toBeInTheDocument();
  });
});
