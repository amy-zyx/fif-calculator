import { describe, expect, it } from 'vitest';
import en from './en';
import zhHans from './zh-Hans';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('translations', () => {
  it('zh-Hans has exactly the same keys as en — no missing or stray strings', () => {
    expect(flattenKeys(zhHans).sort()).toEqual(flattenKeys(en).sort());
  });

  it('has no empty strings in either language', () => {
    for (const [name, bundle] of [
      ['en', en],
      ['zh-Hans', zhHans],
    ] as const) {
      const empties = flattenKeys(bundle).filter((path) => {
        const value = path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], bundle);
        return typeof value === 'string' && value.trim() === '';
      });
      expect(empties, `${name} has empty strings`).toEqual([]);
    }
  });

  it('keeps tax terms of art in English in the Chinese bundle, with the gloss alongside', () => {
    // Spec §7: never translate these away — the user must be able to match them against
    // IR461 and discuss them with an accountant.
    expect(zhHans.results.fdrLabel).toContain('Fair Dividend Rate');
    expect(zhHans.results.fdrLabel).toContain('公平股息率法');
    expect(zhHans.results.cvLabel).toContain('Comparative Value');
    expect(zhHans.results.cvLabel).toContain('比较价值法');
  });

  it('carries the disclaimer in both languages', () => {
    expect(en.disclaimer.text).toMatch(/not tax advice/i);
    expect(zhHans.disclaimer.text).toContain('不构成税务建议');
  });
});
