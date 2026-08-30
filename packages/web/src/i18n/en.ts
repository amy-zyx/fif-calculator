/**
 * English strings. This file is the source of truth for key names — zh-Hans.ts must
 * mirror its shape exactly, and a test asserts that it does.
 *
 * Tax terms of art deliberately keep their English name in BOTH languages, with the
 * Chinese gloss appended in zh-Hans (spec §7).
 */
/**
 * Same key shape, but string values widened. `en` is `as const` so its keys are exact;
 * without this a translation bundle would be required to repeat the English literals.
 */
export type Translations<T> = {
  [K in keyof T]: T[K] extends string ? string : Translations<T[K]>;
};

const en = {
  app: {
    title: 'NZ FIF Tax Calculator',
    tagline:
      'Upload your broker exports and get a consolidated Foreign Investment Fund (FIF) income figure for the NZ tax year, calculated under both FDR and Comparative Value, with a full audit trail.',
    privacy:
      'No transaction data ever leaves your browser. This is a static, client-side-only app — there is no backend and no database.',
    getStarted: 'Get started',
    back: 'Back',
    language: 'Language',
  },
  disclaimer: {
    text:
      'This tool provides an estimate only and is not tax advice. FIF calculations depend on facts and elections specific to you. Verify all figures against IRD guide IR461 and confirm with a chartered accountant before filing. The authors accept no liability.',
    heading: 'Before you continue',
    accept: 'I understand — this is an estimate, not tax advice',
    notVerified:
      'Nothing in this app has been checked against a real broker export or reviewed by a tax professional. The Australian listed share exemption list is empty, the filing guidance is unverified, and no IRD exchange rates are bundled.',
  },
  setup: {
    title: 'Set up',
    subtitle:
      'These choices must be applied consistently across your whole portfolio, and they appear on every export.',
    taxpayerName: 'Taxpayer name (stored only in your browser)',
    incomeYear: 'Income year (year ended 31 March)',
    fxApproach: 'FX conversion approach',
    costBasis: 'Cost basis for partial disposals',
    continue: 'Continue to upload',
  },
  results: {
    inFifHeading: '1. Are you in the FIF regime?',
    comparisonHeading: '2. FDR vs Comparative Value',
    perHoldingHeading: '3. Per-holding breakdown',
    foreignTaxHeading: '4. Foreign tax credits',
    fdrLabel: 'Fair Dividend Rate (FDR)',
    cvLabel: 'Comparative Value (CV)',
    recommended: 'Recommended (the lower of the two)',
    excludedHeading: 'Not included in FIF — may be taxable under other rules',
    exportHeading: 'Export',
    showWorking: 'Show working',
  },
} as const;

export default en;
