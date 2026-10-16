import { describe, expect, it } from 'vitest';
import { formatAway, formatClock, formatCost, formatNumber, formatRate } from './format';

describe('formatting', () => {
  it('shortens big numbers as 1.2K, 3.4M, 5.6B', () => {
    expect(formatNumber(999.9)).toBe('999');
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(3_400_000)).toBe('3.4M');
    expect(formatNumber(5_600_000_000)).toBe('5.6B');
    expect(formatNumber(2000)).toBe('2K');
  });

  it('shows rates with one decimal below 10', () => {
    expect(formatRate(0.45)).toBe('0.5');
    expect(formatRate(2.4)).toBe('2.4');
    expect(formatRate(12.3)).toBe('12');
  });

  it('formats clocks, costs and time away', () => {
    expect(formatClock(150)).toBe('2:30');
    expect(formatClock(9.2)).toBe('0:10');
    expect(formatCost({ wood: 40, materials: 5 })).toBe('40 Wood · 5 Mat');
    expect(formatAway(20_000)).toBe('a moment');
    expect(formatAway(60_000)).toBe('1 minute');
    expect(formatAway((2 * 60 + 5) * 60_000)).toBe('2 hours 5 minutes');
    expect(formatAway(3 * 24 * 3_600_000)).toBe('3 days');
  });
});
