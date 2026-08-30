import { describe, expect, it } from 'vitest';
import { D, ZERO, floorAtZero, formatNzd, roundNzd, roundRate, sum } from './money';

describe('D()', () => {
  it('parses decimal strings exactly', () => {
    expect(D('379310.34').toString()).toBe('379310.34');
  });

  it('rejects non-finite numbers', () => {
    expect(() => D(NaN)).toThrow();
    expect(() => D(Infinity)).toThrow();
  });

  it('rejects unparseable strings', () => {
    expect(() => D('not-a-number')).toThrow();
  });
});

describe('float safety (GT-9 style regression)', () => {
  it('0.1 + 0.2 style drift cannot occur', () => {
    // The canonical float trap: in native JS, 0.1 + 0.2 !== 0.3.
    expect(0.1 + 0.2).not.toBe(0.3); // sanity check the trap is real in plain JS
    expect(D('0.1').plus(D('0.2')).toString()).toBe('0.3');
  });

  it('sums ten thousand fractional-share amounts to the cent with no drift', () => {
    const amounts = Array.from({ length: 10_000 }, () => D('0.1'));
    const total = sum(amounts);
    expect(total.toString()).toBe('1000');
  });

  it('repeated division and multiplication round-trips exactly at high precision', () => {
    const cost = D('36666.67');
    const perShare = cost.dividedBy(D('200'));
    const backToTotal = perShare.times(D('200'));
    expect(roundNzd(backToTotal).toString()).toBe('36666.67');
  });
});

describe('floorAtZero', () => {
  it('leaves positive values unchanged', () => {
    expect(floorAtZero(D('5')).toString()).toBe('5');
  });

  it('clamps negative values to zero', () => {
    expect(floorAtZero(D('-44252.87')).toString()).toBe('0');
  });

  it('leaves zero as zero', () => {
    expect(floorAtZero(ZERO).toString()).toBe('0');
  });
});

describe('roundNzd', () => {
  it('rounds half up to 2dp', () => {
    expect(roundNzd(D('18965.5165')).toString()).toBe('18965.52');
    expect(roundNzd(D('18965.5149')).toString()).toBe('18965.51');
  });

  it('does not mutate the input', () => {
    const input = D('1.005');
    roundNzd(input);
    expect(input.toString()).toBe('1.005');
  });
});

describe('roundRate', () => {
  it('rounds to 6dp', () => {
    expect(roundRate(D('0.583333333')).toString()).toBe('0.583333');
  });
});

describe('formatNzd', () => {
  it('formats as a fixed 2dp string', () => {
    expect(formatNzd(D('18965.5'))).toBe('18965.50');
    expect(formatNzd(ZERO)).toBe('0.00');
  });
});

describe('sum', () => {
  it('sums an empty list to zero', () => {
    expect(sum([]).toString()).toBe('0');
  });

  it('sums exactly (GT-1 opening value check)', () => {
    // 1,000 shares @ USD 220.00, FX 0.5800 -> NZD opening market value
    const qty = D('1000');
    const priceUsd = D('220.00');
    const fx = D('0.5800');
    const openingNzd = qty.times(priceUsd).dividedBy(fx);
    expect(roundNzd(openingNzd).toString()).toBe('379310.34');
  });
});
