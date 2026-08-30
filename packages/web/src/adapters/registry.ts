import { ibkrActivityStatementAdapter } from './ibkr/ibkrAdapter';
import { DETECTION_THRESHOLD, type BrokerAdapter } from './types';

/**
 * Fingerprint registry (spec §4.2 point 1). Seeded with IBKR for M1; the remaining
 * target brokers (Sharesies, Tiger, Moomoo, Hatch, Stake, InvestNow, ASB Securities)
 * land in M5, each validated against a real anonymised export before being added
 * here with `verified: true`.
 */
export const ADAPTER_REGISTRY: readonly BrokerAdapter[] = [ibkrActivityStatementAdapter];

export interface DetectionResult {
  adapter: BrokerAdapter;
  confidence: number;
}

/** Highest-scoring adapter across the registry, or null if the file matched nothing. */
export function detectBestAdapter(headers: string[], sampleRows: string[][]): DetectionResult | null {
  let best: DetectionResult | null = null;
  for (const adapter of ADAPTER_REGISTRY) {
    const confidence = adapter.detect(headers, sampleRows);
    if (!best || confidence > best.confidence) {
      best = { adapter, confidence };
    }
  }
  return best;
}

/** Whether detection is confident enough to skip the Column Mapping Wizard. */
export function isConfidentMatch(result: DetectionResult | null): result is DetectionResult {
  return result !== null && result.confidence >= DETECTION_THRESHOLD;
}
