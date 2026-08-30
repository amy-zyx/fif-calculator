import { describe, expect, it } from 'vitest';
import {
  bundledRateTable,
  datasetDateProblems,
  getIrdDataset,
  hasBundledRates,
  irdDatasetSchema,
  loadIrdDatasets,
} from './irdDataset';

describe('bundled IRD datasets', () => {
  it('every bundled file matches the schema', () => {
    expect(() => loadIrdDatasets()).not.toThrow();
    expect(loadIrdDatasets().length).toBeGreaterThan(0);
  });

  it('every rate is a positive decimal STRING, never a JSON number', () => {
    for (const dataset of loadIrdDatasets()) {
      for (const byDate of Object.values(dataset.rates)) {
        for (const rate of Object.values(byDate)) {
          expect(typeof rate).toBe('string');
          expect(Number(rate)).toBeGreaterThan(0);
        }
      }
    }
  });

  it('no rate is filed under an income year it does not fall inside', () => {
    for (const dataset of loadIrdDatasets()) {
      expect(datasetDateProblems(dataset)).toEqual([]);
    }
  });

  it('rejects a rate stored as a JSON number rather than a string', () => {
    const bad = {
      incomeYear: 2026,
      sourceUrl: 'https://www.ird.govt.nz/x',
      retrievedOn: null,
      retrievedBy: null,
      note: '',
      rates: { USD: { '2025-04-15': 0.58 } },
    };
    expect(() => irdDatasetSchema.parse(bad)).toThrow();
  });
});

describe('the dataset ships empty, and the app is honest about it', () => {
  it('reports that no rates are bundled, so the UI can say so rather than imply coverage', () => {
    expect(hasBundledRates(2026)).toBe(false);
    expect(bundledRateTable(2026)).toEqual({});
  });

  it('records that no human has transcribed the rates yet', () => {
    const dataset = getIrdDataset(2026);
    expect(dataset?.retrievedOn).toBeNull();
    expect(dataset?.note).toMatch(/EMPTY/);
  });

  it('returns null for a year with no bundled file at all', () => {
    expect(getIrdDataset(1999)).toBeNull();
  });
});
