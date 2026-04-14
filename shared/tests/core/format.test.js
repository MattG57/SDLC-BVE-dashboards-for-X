import { describe, it, expect } from 'vitest';
import { fmtDec, fmtPct, fmtPct0, fmt, fmtCompact, fmtCurrency } from '../../core/format.js';

describe('fmtDec', () => {
  it('formats with default 1 decimal', () => {
    expect(fmtDec(3.14)).toBe('3.1');
  });

  it('formats with custom precision', () => {
    expect(fmtDec(3.14159, 3)).toBe('3.142');
  });

  it('returns — for null', () => {
    expect(fmtDec(null)).toBe('—');
  });
});

describe('fmtPct', () => {
  it('converts fraction to percentage', () => {
    expect(fmtPct(0.123)).toBe('12.3%');
  });

  it('returns — for null', () => {
    expect(fmtPct(null)).toBe('—');
  });

  it('handles zero', () => {
    expect(fmtPct(0)).toBe('0.0%');
  });

  it('handles values > 1', () => {
    expect(fmtPct(1.5)).toBe('150.0%');
  });
});

describe('fmtPct0', () => {
  it('rounds to integer percentage', () => {
    expect(fmtPct0(0.126)).toBe('13%');
  });

  it('returns — for null', () => {
    expect(fmtPct0(null)).toBe('—');
  });
});

describe('fmt', () => {
  it('formats with locale separators', () => {
    const result = fmt(1234567);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('567');
  });

  it('returns — for null', () => {
    expect(fmt(null)).toBe('—');
  });
});

describe('fmtCompact', () => {
  it('formats millions', () => {
    expect(fmtCompact(1234567)).toBe('1.2M');
  });

  it('formats thousands', () => {
    expect(fmtCompact(1234)).toBe('1.2k');
  });

  it('formats small numbers', () => {
    expect(fmtCompact(42)).toBe('42');
  });

  it('returns — for null', () => {
    expect(fmtCompact(null)).toBe('—');
  });

  it('handles negative values', () => {
    expect(fmtCompact(-5000)).toBe('-5.0k');
  });
});

describe('fmtCurrency', () => {
  it('formats with $ prefix and compact notation', () => {
    expect(fmtCurrency(1234567)).toBe('$1.2M');
  });

  it('formats thousands', () => {
    expect(fmtCurrency(5000)).toBe('$5.0k');
  });

  it('formats small amounts', () => {
    expect(fmtCurrency(42)).toBe('$42');
  });

  it('returns — for null', () => {
    expect(fmtCurrency(null)).toBe('—');
  });
});
