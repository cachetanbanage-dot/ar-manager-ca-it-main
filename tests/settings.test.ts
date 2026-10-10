import { describe, expect, it } from 'vitest';
import { dashboardSummary } from '@/lib/ar/dashboard';
import { addDays } from '@/lib/ar/dates';
import { dso } from '@/lib/ar/dso';
import { balanceByDocuments, bucketFor, customerPositions } from '@/lib/ar/positions';
import { DEFAULT_SETTINGS, bucketLabels, isDefaultSettings, parseSettings, type ArSettings } from '@/lib/ar/settings';
import { statement } from '@/lib/ar/statement';
import { ageingRowsCsv } from '@/lib/exports';
import { dashboard } from '@/lib/lists/dashboard';
import { invoiceListOptions } from '@/lib/lists/invoices';
import { checkSettings } from '@/lib/validation/settings';
import { sampleData } from './fixture';

const custom: ArSettings = { dsoDays: 60, bucketLimits: [15, 45] };
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('standard settings (R12, R17)', () => {
  it("90-day DSO and the client's six standard buckets", () => {
    expect(DEFAULT_SETTINGS).toEqual({ dsoDays: 90, bucketLimits: [15, 30, 45, 90] });
    expect(bucketLabels(DEFAULT_SETTINGS)).toEqual(['Not due', '1-15', '16-30', '31-45', '46-90', 'Over 90']);
    expect(isDefaultSettings(DEFAULT_SETTINGS)).toBe(true);
    expect(isDefaultSettings(custom)).toBe(false);
  });
});

describe('custom buckets', () => {
  it('headings follow the limits, each starting the day after the previous ends', () => {
    expect(bucketLabels(custom)).toEqual(['Not due', '1-15', '16-45', 'Over 45']);
    expect(bucketLabels({ dsoDays: 90, bucketLimits: [7] })).toEqual(['Not due', '1-7', 'Over 7']);
  });

  it('puts each boundary day in the right bucket', () => {
    expect([-3, 0, 1, 15, 16, 45, 46, 400].map((d) => bucketFor(d, custom)))
      .toEqual(['Not due', 'Not due', '1-15', '1-15', '16-45', '16-45', 'Over 45', 'Over 45']);
  });
});

describe('checkSettings: whole numbers and no overlapping buckets', () => {
  const errors = (dso: string, limits: string[]) => { const r = checkSettings(dso, limits); return r.ok ? {} : r.errors; };

  it('accepts valid settings and returns numbers', () => {
    expect(checkSettings('60', ['15', '45'])).toEqual({ ok: true, data: custom });
    expect(checkSettings(' 90 ', ['30', '60', '90', '180'])).toEqual({ ok: true, data: { dsoDays: 90, bucketLimits: [30, 60, 90, 180] } }); // the brief's buckets
  });

  it('refuses a limit that would overlap the bucket before it', () => {
    expect(errors('90', ['30', '60', '45']).limit_2)
      .toEqual(['Bucket 4 (up to 45 days) must end after bucket 3 (up to 60 days), or the two would overlap.']);
    expect(errors('90', ['30', '60', '60']).limit_2).toBeDefined(); // same day twice
    expect(errors('90', ['30', '30']).limit_1).toBeDefined();
  });

  it('refuses decimals, zero, negatives, blanks, text and limits over 3,650 days', () => {
    for (const bad of ['30.5', '0', '-5', '', 'abc', '3651']) {
      expect(errors('90', ['10', bad]).limit_1, `limit "${bad}"`).toBeDefined();
    }
    expect(errors('90', ['3650'])).toEqual({});
  });

  it('allows 1 to 8 limits (3 to 10 buckets in all)', () => {
    expect(errors('90', []).buckets).toBeDefined();
    expect(errors('90', ['1', '2', '3', '4', '5', '6', '7', '8'])).toEqual({});
    expect(errors('90', ['1', '2', '3', '4', '5', '6', '7', '8', '9']).buckets).toBeDefined();
  });

  it('DSO days must be a whole number from 1 to 365', () => {
    for (const bad of ['0', '366', '30.5', '', 'sixty']) expect(errors(bad, ['30']).dsoDays, `dso "${bad}"`).toBeDefined();
    expect(errors('1', ['30'])).toEqual({});
    expect(errors('365', ['30'])).toEqual({});
  });
});

describe('parseSettings: the stored cookie is never trusted blindly', () => {
  it('missing, damaged or invalid settings give the standard settings', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"dsoDays":60,"bucketLimits":[60,45]}')).toEqual(DEFAULT_SETTINGS); // overlapping, typed by hand
    expect(parseSettings('{"dsoDays":30.5,"bucketLimits":[30]}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"dsoDays":60}')).toEqual(DEFAULT_SETTINGS);
  });
  it('valid settings are read back', () => {
    expect(parseSettings(JSON.stringify(custom))).toEqual(custom);
  });
});

describe('figures under custom settings', () => {
  it('C003 as at 31-Aug-2026 with buckets 1-15, 16-45, Over 45 (worked by hand)', () => {
    const c003 = customerPositions(sampleData, '2026-08-31', custom).find((p) => p.customer.code === 'C003')!;
    expect(c003.buckets).toEqual({ 'Not due': 0, '1-15': 0, '16-45': 8260000, 'Over 45': 36400000 });
    expect(c003.outstanding).toBe(44660000);
  });

  it('buckets add up to outstanding, overdue is unchanged, and balances still agree with the documents, every day', () => {
    for (let d = '2026-01-01'; d <= '2026-10-31'; d = addDays(d, 1)) {
      const standard = customerPositions(sampleData, d);
      for (const p of customerPositions(sampleData, d, custom)) {
        expect(sum(p.buckets), d).toBe(p.outstanding);
        expect(p.overdue, d).toBe(standard.find((s) => s.customer.id === p.customer.id)!.overdue);
        expect(p.netBalance, d).toBe(balanceByDocuments(sampleData, p.customer.id, d));
      }
    }
  });

  it('dashboard ageing totals equal the summary', () => {
    const d = dashboard(sampleData, '2026-08-31', custom);
    expect(Object.keys(d.ageingTotals.buckets)).toEqual(['Not due', '1-15', '16-45', 'Over 45']);
    expect(sum(d.ageingTotals.buckets)).toBe(d.summary.outstanding);
    expect(d.ageingTotals.overdue).toBe(d.summary.overdue);
  });

  it('DSO over 60 days as at 31-Aug-2026 is 122; over 90 days it is still 111', () => {
    expect(dashboardSummary(sampleData, '2026-08-31', custom).dso).toBe(122);
    expect(dso(sampleData, '2026-08-31', 60)).toBe(122);
    expect(dso(sampleData, '2026-08-31')).toBe(111);
  });

  it('statement footer still makes up the closing balance', () => {
    for (const c of sampleData.customers) {
      const s = statement(sampleData, c.id, '2026-04-01', '2026-08-31', custom);
      expect(Object.keys(s.ageing)).toEqual(['Not due', '1-15', '16-45', 'Over 45']);
      expect(sum(s.ageing) - s.unapplied, c.code).toBe(s.closingBalance);
    }
  });

  it('CSV headings and the invoice bucket filter use the custom buckets', () => {
    const d = dashboard(sampleData, '2026-08-31', custom);
    expect(ageingRowsCsv(d.ageing, d.ageingTotals, custom)[0])
      .toEqual(['Code', 'Customer', 'Not due', '1-15', '16-45', 'Over 45', 'Outstanding', 'Unapplied credit', 'Net balance', 'Dr/Cr']);
    expect(invoiceListOptions({ bucket: '16-45' }, custom).bucket).toBe('16-45');
    expect(invoiceListOptions({ bucket: '46-90' }, custom).bucket).toBe(''); // not one of these buckets
  });
});
