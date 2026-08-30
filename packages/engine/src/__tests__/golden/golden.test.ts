import { describe, expect, it } from 'vitest';
import { calculateFif, type FifCalculationResult } from '../../calculate';
import { roundNzd, type Decimal } from '../../money';
import { toCalculationInput, type GoldenFixture, type GoldenHoldingExpectation } from './loader';
import { FIXTURES, gt06 } from './fixtures';

function nzd(value: Decimal): string {
  return roundNzd(value).toFixed(2);
}

function assertHolding(
  result: Extract<FifCalculationResult, { status: 'OK' }>,
  ticker: string,
  expected: GoldenHoldingExpectation,
) {
  const summary = result.holdings.find((h) => h.ticker === ticker);
  expect(summary, `no holding summary for ${ticker}`).toBeDefined();
  if (!summary) return;

  if (expected.openingMarketValueNzd !== undefined) {
    expect(nzd(summary.openingMarketValueNzd), `${ticker} opening market value`).toBe(expected.openingMarketValueNzd);
  }
  if (expected.closingMarketValueNzd !== undefined) {
    expect(nzd(summary.closingMarketValueNzd), `${ticker} closing market value`).toBe(expected.closingMarketValueNzd);
  }
  if (expected.acquiredCostNzd !== undefined) {
    expect(nzd(summary.acquiredCostNzd), `${ticker} acquired cost`).toBe(expected.acquiredCostNzd);
  }
  if (expected.acquiredQuantity !== undefined) {
    expect(summary.acquiredQuantity.toString(), `${ticker} acquired quantity`).toBe(expected.acquiredQuantity);
  }
  if (expected.disposalProceedsNzd !== undefined) {
    expect(nzd(summary.disposalProceedsNzd), `${ticker} disposal proceeds`).toBe(expected.disposalProceedsNzd);
  }
  if (expected.peakQuantity !== undefined) {
    expect(summary.peakQuantity.toString(), `${ticker} peak quantity`).toBe(expected.peakQuantity);
  }
  if (expected.closingQuantity !== undefined) {
    expect(summary.closingQuantity.toString(), `${ticker} closing quantity`).toBe(expected.closingQuantity);
  }

  const fdr = result.election.perHoldingFdr.find((f) => f.ticker === ticker);
  if (expected.fdrIncomeNzd !== undefined) {
    expect(fdr, `no FDR result for ${ticker}`).toBeDefined();
    expect(nzd(fdr!.incomeNzd), `${ticker} FDR income`).toBe(expected.fdrIncomeNzd);
  }
  if (expected.quickSaleApplies !== undefined) {
    expect(fdr!.quickSale.applies, `${ticker} quick sale applies`).toBe(expected.quickSaleApplies);
  }
  if (expected.quickSaleAdjustmentNzd !== undefined) {
    expect(nzd(fdr!.quickSale.adjustmentNzd), `${ticker} quick sale adjustment`).toBe(expected.quickSaleAdjustmentNzd);
  }
  if (expected.quickSaleBindingBranch !== undefined) {
    expect(fdr!.quickSale.bindingBranch, `${ticker} binding branch`).toBe(expected.quickSaleBindingBranch);
  }
  if (expected.peakHoldingAmountNzd !== undefined) {
    expect(nzd(fdr!.quickSale.peakHoldingAmountNzd), `${ticker} peak holding amount`).toBe(expected.peakHoldingAmountNzd);
  }
  if (expected.quickSaleGainsNzd !== undefined) {
    expect(nzd(fdr!.quickSale.quickSaleGainsNzd), `${ticker} quick sale gains`).toBe(expected.quickSaleGainsNzd);
  }
  if (expected.averageCostNzd !== undefined) {
    expect(nzd(fdr!.quickSale.averageCostNzd), `${ticker} average cost`).toBe(expected.averageCostNzd);
  }
  if (expected.cvIncomeNzd !== undefined) {
    const cv = result.election.perHoldingCv.find((c) => c.ticker === ticker);
    expect(nzd(cv!.incomeNzd), `${ticker} CV income`).toBe(expected.cvIncomeNzd);
  }
}

describe('golden test suite', () => {
  for (const fixture of FIXTURES) {
    describe(`${fixture.id} — ${fixture.title}`, () => {
      const result = calculateFif(toCalculationInput(fixture));
      const { expected } = fixture;

      it(`has status ${expected.status}`, () => {
        expect(result.status, `${fixture.id}: ${fixture.description}`).toBe(expected.status);
      });

      if (expected.blockerKinds) {
        it('reports the expected blockers', () => {
          expect([...new Set(result.blockers.map((b) => b.kind))].sort()).toEqual([...expected.blockerKinds!].sort());
        });
      }

      if (expected.duplicatesRemovedCount !== undefined) {
        it('removes the expected number of duplicate rows, and reports them', () => {
          const removed = result.duplicatesRemoved.reduce((n, g) => n + g.removed.length, 0);
          expect(removed).toBe(expected.duplicatesRemovedCount);
        });
      }

      if (expected.excludedTickers) {
        it('excludes the expected instruments from FIF, surfacing rather than hiding them', () => {
          const tickers = [...new Set(result.excluded.map((e) => e.ticker))].sort();
          expect(tickers).toEqual([...expected.excludedTickers!].sort());
        });
      }

      if (expected.peakCostNzdPolicyA !== undefined || expected.peakCostNzdPolicyB !== undefined) {
        it('reports the peak cost under both FX policies', () => {
          if (expected.peakCostNzdPolicyA !== undefined) {
            expect(nzd(result.fxVariance.peakCostNzdPolicyA)).toBe(expected.peakCostNzdPolicyA);
          }
          if (expected.peakCostNzdPolicyB !== undefined) {
            expect(nzd(result.fxVariance.peakCostNzdPolicyB)).toBe(expected.peakCostNzdPolicyB);
          }
        });
      }

      if (expected.status === 'THRESHOLD_AMBIGUOUS') {
        it('refuses to emit a single recommended figure', () => {
          expect(result).not.toHaveProperty('election');
          expect(result.fxVariance.inFifPolicyA).not.toBe(result.fxVariance.inFifPolicyB);
        });
      }

      if (expected.status === 'NOT_IN_FIF' || expected.status === 'OK') {
        it('reaches the expected de minimis verdict', () => {
          const withDeMinimis = result as Extract<FifCalculationResult, { status: 'OK' | 'NOT_IN_FIF' }>;
          if (expected.inFif !== undefined) {
            expect(withDeMinimis.deMinimis.inFif).toBe(expected.inFif);
          }
          if (expected.peakCostNzd !== undefined) {
            expect(nzd(withDeMinimis.deMinimis.peakCostNzd)).toBe(expected.peakCostNzd);
          }
          if (expected.peakCostDate !== undefined) {
            expect(withDeMinimis.deMinimis.peakCostDate).toBe(expected.peakCostDate);
          }
        });
      }

      if (expected.status === 'OK') {
        const ok = result as Extract<FifCalculationResult, { status: 'OK' }>;

        if (expected.fdrTotalNzd !== undefined) {
          it(`computes an FDR portfolio total of NZD ${expected.fdrTotalNzd}`, () => {
            expect(nzd(ok.election.fdrTotalNzd)).toBe(expected.fdrTotalNzd);
          });
        }
        if (expected.cvTotalNzd !== undefined) {
          it(`computes a CV portfolio total of NZD ${expected.cvTotalNzd}`, () => {
            expect(nzd(ok.election.cvTotalNzd)).toBe(expected.cvTotalNzd);
          });
        }
        if (expected.cvRawTotalNzd !== undefined) {
          it('preserves the pre-floor CV total so the extinguished loss stays visible', () => {
            expect(nzd(ok.election.cvRawTotalNzd)).toBe(expected.cvRawTotalNzd);
            expect(ok.election.cvLossExtinguished).toBe(true);
          });
        }
        if (expected.recommendedMethod !== undefined) {
          it(`recommends ${expected.recommendedMethod}`, () => {
            expect(ok.election.recommendedMethod).toBe(expected.recommendedMethod);
            if (expected.recommendedIncomeNzd !== undefined) {
              expect(nzd(ok.election.recommendedIncomeNzd)).toBe(expected.recommendedIncomeNzd);
            }
            expect(ok.election.explanation).toContain('consistently');
          });
        }
        if (expected.holdings) {
          for (const [ticker, holdingExpectation] of Object.entries(expected.holdings)) {
            it(`matches the working for ${ticker}`, () => {
              assertHolding(ok, ticker, holdingExpectation);
            });
          }
        }
      }
    });
  }
});

describe('GT-6 — an UNCONFIRMED transfer must not be assumed', () => {
  it('blocks until the user confirms the transfer pair, rather than inventing a quick sale', () => {
    const input = toCalculationInput(gt06 as unknown as GoldenFixture);
    const result = calculateFif({ ...input, confirmedTransferTxnIds: [] });

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers.some((b) => b.kind === 'UNMATCHED_TRANSFER')).toBe(true);
    // The candidate pair is still offered to the user for confirmation.
    expect(result.transferCandidates).toHaveLength(1);
    expect(result.transferCandidates[0]?.ticker).toBe('MSFT');
  });
});
