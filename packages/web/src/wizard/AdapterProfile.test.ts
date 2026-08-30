import { describe, expect, it } from 'vitest';
import { parseAdapterProfile, serializeAdapterProfile, type AdapterProfile } from './AdapterProfile';

const SAMPLE: AdapterProfile = {
  version: 1,
  profileName: 'My Broker export',
  brokerId: 'USER_DEFINED',
  createdAt: '2026-08-30T00:00:00.000Z',
  columnMapping: { tradeDate: 'Date', ticker: 'Symbol' },
  typeValueMap: { Buy: 'BUY' },
  fxRateConvertsTo: 'NZD',
};

describe('serializeAdapterProfile / parseAdapterProfile round-trip', () => {
  it('round-trips a profile through JSON unchanged', () => {
    const json = serializeAdapterProfile(SAMPLE);
    const parsed = parseAdapterProfile(json);
    expect(parsed).toEqual(SAMPLE);
  });
});

describe('parseAdapterProfile validation', () => {
  it('rejects invalid JSON', () => {
    expect(() => parseAdapterProfile('not json')).toThrow(/valid JSON/);
  });

  it('rejects an unsupported version', () => {
    expect(() => parseAdapterProfile(JSON.stringify({ ...SAMPLE, version: 2 }))).toThrow(/version/);
  });

  it('rejects a profile missing profileName', () => {
    const { profileName, ...rest } = SAMPLE;
    void profileName;
    expect(() => parseAdapterProfile(JSON.stringify(rest))).toThrow(/Malformed/);
  });
});
