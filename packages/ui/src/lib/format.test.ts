import { describe, expect, it } from 'vitest';

import { fmtBytes, fmtCost, fmtDuration, fmtNum, relTime } from './format';

describe('relTime', () => {
  const now = new Date('2026-07-13T12:00:00.000Z').getTime();

  it('says "just now" under 45s', () => {
    expect(relTime(now - 10_000, now)).toBe('just now');
  });

  it('formats minutes ago', () => {
    expect(relTime(now - 4 * 60_000, now)).toBe('4m ago');
  });

  it('formats hours ago', () => {
    expect(relTime(now - 3 * 3_600_000, now)).toBe('3h ago');
  });

  it('formats days ago', () => {
    expect(relTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });

  it('formats weeks ago', () => {
    expect(relTime(now - 2 * 604_800_000, now)).toBe('2w ago');
  });

  it('formats months ago', () => {
    expect(relTime(now - 2 * 2_592_000_000, now)).toBe('2mo ago');
  });

  it('formats years ago', () => {
    expect(relTime(now - 2 * 31_536_000_000, now)).toBe('2y ago');
  });

  it('is sign-aware for future times', () => {
    expect(relTime(now + 4 * 60_000, now)).toBe('in 4m');
  });

  it('accepts epoch seconds (< 1e11)', () => {
    const nowSeconds = now / 1000;
    expect(relTime(nowSeconds - 4 * 60, nowSeconds)).toBe('4m ago');
  });

  it('accepts a Date instance', () => {
    expect(relTime(new Date(now - 4 * 60_000), now)).toBe('4m ago');
  });

  it('returns em-dash for unparseable input', () => {
    expect(relTime('not-a-date', now)).toBe('—');
  });
});

describe('fmtDuration', () => {
  it('formats sub-second as ms', () => {
    expect(fmtDuration(840)).toBe('840ms');
  });

  it('formats seconds under a minute with one decimal', () => {
    expect(fmtDuration(12_400)).toBe('12.4s');
  });

  it('formats minutes and seconds', () => {
    expect(fmtDuration(128_000)).toBe('2m 08s');
  });

  it('formats hours and minutes', () => {
    expect(fmtDuration(3_600_000 + 4 * 60_000)).toBe('1h 04m');
  });

  it('returns em-dash for negative or non-finite', () => {
    expect(fmtDuration(-5)).toBe('—');
    expect(fmtDuration(NaN)).toBe('—');
    expect(fmtDuration(Infinity)).toBe('—');
  });
});

describe('fmtBytes', () => {
  it('formats sub-KB as whole bytes', () => {
    expect(fmtBytes(512)).toBe('512 B');
  });

  it('formats KB/MB with one decimal by default', () => {
    expect(fmtBytes(1024 * 1.4)).toBe('1.4 KB');
    expect(fmtBytes(1024 * 1024 * 2.3)).toBe('2.3 MB');
  });

  it('climbs through GB/TB/PB', () => {
    expect(fmtBytes(1024 ** 3 * 5)).toBe('5.0 GB');
    expect(fmtBytes(1024 ** 4 * 5)).toBe('5.0 TB');
    expect(fmtBytes(1024 ** 5 * 5)).toBe('5.0 PB');
  });

  it('returns em-dash for non-finite', () => {
    expect(fmtBytes(NaN)).toBe('—');
  });
});

describe('fmtNum', () => {
  it('rounds sub-1000 to a whole number', () => {
    expect(fmtNum(947)).toBe('947');
  });

  it('compacts thousands and millions', () => {
    expect(fmtNum(12_400)).toBe('12.4k');
    expect(fmtNum(3_100_000)).toBe('3.1M');
  });

  it('compacts billions', () => {
    expect(fmtNum(2_500_000_000)).toBe('2.5B');
  });

  it('is negative-aware', () => {
    expect(fmtNum(-12_400)).toBe('-12.4k');
  });
});

describe('fmtCost', () => {
  it('keeps 4 significant digits under a cent', () => {
    expect(fmtCost(0.0041)).toBe('$0.0041');
  });

  it('uses 2 decimals between a cent and $100', () => {
    expect(fmtCost(1.24)).toBe('$1.24');
  });

  it('drops decimals at $100+', () => {
    expect(fmtCost(312)).toBe('$312');
  });

  it('formats exactly zero with 2 decimals', () => {
    expect(fmtCost(0)).toBe('$0.00');
  });

  it('is negative-aware and respects a custom currency symbol', () => {
    expect(fmtCost(-1.5, '€')).toBe('-€1.50');
  });

  it('returns em-dash for non-finite', () => {
    expect(fmtCost(NaN)).toBe('—');
  });
});
