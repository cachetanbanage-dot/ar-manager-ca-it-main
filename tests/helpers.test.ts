import { describe, expect, it } from 'vitest';
import { isValidDate, parseAsOf, todayInIndia } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney } from '@/lib/format';

describe('formatMoney', () => {
  it('uses the rupee sign, Indian digit grouping and two decimals', () => {
    expect(formatMoney(0)).toBe('₹0.00');
    expect(formatMoney(5)).toBe('₹0.05');
    expect(formatMoney(99999)).toBe('₹999.99');
    expect(formatMoney(100000)).toBe('₹1,000.00');
    expect(formatMoney(12345600)).toBe('₹1,23,456.00');
    expect(formatMoney(1234567850)).toBe('₹1,23,45,678.50');
  });

  it('shows a minus sign for negative amounts', () => {
    expect(formatMoney(-6960000)).toBe('-₹69,600.00');
  });
});

describe('formatBalance', () => {
  it('adds Dr for amounts owed to us and Cr for credit balances', () => {
    expect(formatBalance(8880000)).toBe('₹88,800.00 Dr'); // spot check 5
    expect(formatBalance(-10000000)).toBe('₹1,00,000.00 Cr'); // spot check 6
    expect(formatBalance(0)).toBe('₹0.00');
  });
});

describe('formatDate', () => {
  it('shows dates as 31-Aug-2026', () => {
    expect(formatDate('2026-08-31')).toBe('31-Aug-2026');
    expect(formatDate('2026-01-01')).toBe('01-Jan-2026');
    expect(formatDate('2026-12-05')).toBe('05-Dec-2026');
    expect(formatDate(null)).toBe('');
  });
});

describe('as-at date', () => {
  it('today in India is ahead of UTC from 18:30 UTC (midnight IST)', () => {
    expect(todayInIndia(new Date('2026-09-17T18:29:59Z'))).toBe('2026-09-17'); // 23:59:59 IST
    expect(todayInIndia(new Date('2026-09-17T18:30:00Z'))).toBe('2026-09-18'); // 00:00 IST
    expect(todayInIndia(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });

  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isValidDate('2026-08-31')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-04-31')).toBe(false);
    expect(isValidDate('2026-8-31')).toBe(false);
    expect(isValidDate('31-08-2026')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });

  it('uses ?asof= when valid, otherwise today in India', () => {
    const now = new Date('2026-09-17T20:00:00Z'); // 18-Sep in India
    expect(parseAsOf('2026-08-31', now)).toBe('2026-08-31');
    expect(parseAsOf(undefined, now)).toBe('2026-09-18');
    expect(parseAsOf(null, now)).toBe('2026-09-18');
    expect(parseAsOf('', now)).toBe('2026-09-18');
    expect(parseAsOf('2026-02-30', now)).toBe('2026-09-18');
    expect(parseAsOf('yesterday', now)).toBe('2026-09-18');
    expect(parseAsOf(['2026-07-12', '2026-08-31'], now)).toBe('2026-07-12');
  });
});
