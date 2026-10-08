import { describe, expect, it } from 'vitest';
import { checkNote } from '@/lib/validation/note';
import { sampleData } from './fixture';

const cust = (code: string) => String(sampleData.customers.find((c) => c.code === code)!.id);
const inv = (no: string) => String(sampleData.invoices.find((i) => i.invoiceNo === no)!.id);
const base = {
  customerId: cust('C002'), invoiceId: '', noteDate: '2026-10-05', noteType: 'Call', body: 'Spoke to Rohan.',
  followUpDate: '', promiseDate: '', promiseAmount: '',
};
const errorsFor = (o: Record<string, string>) => { const r = checkNote({ ...base, ...o }, sampleData); return r.ok ? {} : r.errors; };

describe('checkNote (R16)', () => {
  it('accepts a plain note', () => {
    expect(checkNote(base, sampleData)).toEqual({
      ok: true,
      data: { customerId: Number(cust('C002')), invoiceId: null, noteDate: '2026-10-05', noteType: 'Call', body: 'Spoke to Rohan.', followUpDate: null, promiseDate: null, promiseAmount: null },
    });
  });

  it('accepts an invoice, a follow-up and a promise, with the amount in paise', () => {
    const r = checkNote({ ...base, invoiceId: inv('BWA/26-27/0018'), followUpDate: '2026-10-12', promiseDate: '2026-10-15', promiseAmount: '59,000' }, sampleData);
    expect(r.ok && r.data).toMatchObject({ invoiceId: Number(inv('BWA/26-27/0018')), followUpDate: '2026-10-12', promiseDate: '2026-10-15', promiseAmount: 5900000 });
  });

  it('needs both a promise date and an amount, or neither', () => {
    expect(errorsFor({ promiseDate: '2026-10-15' }).promiseAmount?.[0]).toBe('A promise needs an amount as well as a date');
    expect(errorsFor({ promiseAmount: '1000' }).promiseDate?.[0]).toBe('A promise needs a date as well as an amount');
    expect(errorsFor({ promiseDate: '2026-10-15', promiseAmount: '0' }).promiseAmount).toBeDefined();
  });

  it('refuses dates before the note, another customer’s invoice, and a blank note', () => {
    expect(errorsFor({ followUpDate: '2026-10-04' }).followUpDate).toBeDefined();
    expect(errorsFor({ promiseDate: '2026-10-01', promiseAmount: '100' }).promiseDate).toBeDefined();
    expect(errorsFor({ invoiceId: inv('BWA/26-27/0001') }).invoiceId).toBeDefined(); // a C001 invoice
    expect(errorsFor({ body: '  ' }).body).toBeDefined();
    expect(errorsFor({ noteType: 'Letter' }).noteType).toBeDefined();
  });
});
