/**
 * TODO(verify): a human must confirm ALL of the following for each income year before
 * the app is relied on for filing (VERIFY-ANNUALLY.md item 3):
 *
 *  1. The name of the return section FIF income is declared in, for that year's IR3.
 *     Deliberately NOT a box number — box numbering changes between years and a stale
 *     number is worse than no number, because it looks authoritative.
 *  2. Whether separate FIF disclosure is required, and the current international tax
 *     disclosure exemption (determination ITR37 as at the time of writing) for the year.
 *  3. That `sourceUrl` still resolves and still says what this file claims it says.
 *
 * Update `verifiedOn` when you check. Do not add a new income year by copying an old
 * entry forward unverified.
 */

export interface FilingGuidance {
  incomeYear: number;
  /** How to describe where FIF income goes. Never a bare box number — see above. */
  returnSectionLabel: string;
  disclosureRequirement: string;
  sourceUrl: string;
  /** ISO date a human last confirmed this against the source. */
  verifiedOn: string | null;
}

const FILING_GUIDANCE: readonly FilingGuidance[] = [
  {
    incomeYear: 2025,
    returnSectionLabel: 'the overseas income section of your IR3',
    disclosureRequirement:
      'Separate FIF disclosure may be required in myIR. Check the current international tax disclosure ' +
      'exemption (determination ITR37) for this year, or ask your accountant.',
    sourceUrl: 'https://www.ird.govt.nz/international-tax/individuals/foreign-investment-funds-fifs',
    verifiedOn: null,
  },
  {
    incomeYear: 2026,
    returnSectionLabel: 'the overseas income section of your IR3',
    disclosureRequirement:
      'Separate FIF disclosure may be required in myIR. Check the current international tax disclosure ' +
      'exemption (determination ITR37) for this year, or ask your accountant.',
    sourceUrl: 'https://www.ird.govt.nz/international-tax/individuals/foreign-investment-funds-fifs',
    verifiedOn: null,
  },
  {
    incomeYear: 2027,
    returnSectionLabel: 'the overseas income section of your IR3',
    disclosureRequirement:
      'Separate FIF disclosure may be required in myIR. Check the current international tax disclosure ' +
      'exemption (determination ITR37) for this year, or ask your accountant. Note that the FIF rules ' +
      'themselves are subject to proposed changes for this year which were not enacted as at 30 Aug 2026.',
    sourceUrl: 'https://www.ird.govt.nz/international-tax/individuals/foreign-investment-funds-fifs',
    verifiedOn: null,
  },
];

const BY_YEAR = new Map(FILING_GUIDANCE.map((g) => [g.incomeYear, g]));

export function getFilingGuidance(incomeYear: number): FilingGuidance | null {
  return BY_YEAR.get(incomeYear) ?? null;
}

/**
 * The sentence shown on screen and printed on every export. Phrased so it points the
 * user at the right part of the return without asserting a box number, and always
 * carries the caveat — per spec §8, "be careful here".
 */
export function filingSentence(incomeYear: number): string {
  const guidance = getFilingGuidance(incomeYear);
  if (!guidance) {
    return (
      `No filing guidance has been recorded for the ${incomeYear} income year. Check where FIF income is ` +
      'declared for this year with IRD or your accountant before filing.'
    );
  }
  const unverified =
    guidance.verifiedOn === null
      ? ' This guidance has NOT yet been verified by a human against the IRD source for this year — confirm it before filing.'
      : ` Last verified ${guidance.verifiedOn}.`;
  return (
    `For the ${incomeYear} income year, FIF income is declared in ${guidance.returnSectionLabel}. ` +
    `${guidance.disclosureRequirement}${unverified}`
  );
}
