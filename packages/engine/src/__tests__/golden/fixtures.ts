import type { GoldenFixture } from './loader';

import gt01 from './gt-01-fdr-simple-cv-wins.json';
import gt02 from './gt-02-quick-sale-peak-holding-binds.json';
import gt03 from './gt-03-quick-sale-actual-gain-binds.json';
import gt04 from './gt-04-de-minimis-boundary.json';
import gt05 from './gt-05-de-minimis-with-disposal.json';
import gt06 from './gt-06-dedupe-and-transfer.json';
import gt07 from './gt-07-option-assignment.json';
import gt10 from './gt-10-broker-rate-chained-to-usd-base.json';
import gt11 from './gt-11-inverted-rate-blocks.json';
import gt12 from './gt-12-threshold-ambiguous.json';

/**
 * The JSON-fixture golden cases. GT-8 (FX convention parity) and GT-9 (float safety)
 * live in their own test files instead: GT-8 runs the same portfolio under two
 * different policies, and GT-9 generates 10,000 transactions programmatically.
 *
 * Kept in a plain module rather than in golden.test.ts so that importing the list
 * does not re-execute the golden suite's own describe blocks.
 */
export const FIXTURES = [gt01, gt02, gt03, gt04, gt05, gt06, gt07, gt10, gt11, gt12] as unknown as GoldenFixture[];

export { gt06 };
