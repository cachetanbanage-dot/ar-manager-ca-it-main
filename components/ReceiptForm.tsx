'use client';
// Record a payment (Part 2, R5, R6). TDS is pre-filled from the bank amount and
// the customer's TDS rate until it is typed over; the allocation boxes follow the
// oldest-first suggestion until one is changed. The server checks everything again.
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { openInvoices, suggestAllocations, tdsPrefill } from '@/lib/ar/receipts';
import type { ArData, Customer } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { rupeesPlain } from '@/lib/format';
import { rupeesToPaise } from '@/lib/validation/common';
import { RECEIPT_MODES, type PaymentFormState } from '@/lib/validation/receipt';
import { AllocationTable } from './AllocationTable';

type Action = (prev: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;
const amount = rupeesToPaise('Amount');
const toPaise = (text: string) => { const r = amount.safeParse(text); return r.success ? r.data : 0; };

export function ReceiptForm({ action, data, customers, initial, asof, cancelHref }: {
  action: Action; data: ArData; customers: Customer[]; initial: Record<string, string>; asof?: string; cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initial, errors: {}, attempt: 0 });
  const [v, setV] = useState(initial);
  const [tdsTyped, setTdsTyped] = useState(false);
  const [lines, setLines] = useState<Record<number, string> | null>(null); // null = follow the suggestion
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const customer = customers.find((c) => String(c.id) === v.customerId);
  const bank = toPaise(v.bankAmount);
  const tdsText = tdsTyped ? v.tdsAmount : customer ? rupeesPlain(tdsPrefill(bank, customer.tdsRatePct)) : '0.00';
  const settlement = bank + toPaise(tdsText);
  const open = customer && isValidDate(v.receiptDate) ? openInvoices(data, customer.id, v.receiptDate) : [];
  const suggested = () => Object.fromEntries([...suggestAllocations(open, settlement)].map(([id, p]) => [id, rupeesPlain(p)]));
  const values = lines ?? suggested();

  const err = (k: string) => state.errors[k]?.map((e) => <span key={e} className="text-xs text-red-700">{e}</span>);
  const box = (k: string) => `rounded border px-2 py-1.5 ${state.errors[k] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`;

  return (
    <form action={formAction} noValidate className="grid max-w-4xl gap-6">
      {asof && <input type="hidden" name="asof" value={asof} />}
      {state.message && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Customer <span className="text-red-600">*</span></span>
          <select name="customerId" value={v.customerId} onChange={(e) => { set('customerId')(e); setLines(null); }} className={box('customerId')}>
            <option value="">Choose a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}{c.isActive ? '' : ' (inactive)'}</option>)}
          </select>
          {err('customerId')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Receipt date <span className="text-red-600">*</span></span>
          <input type="date" name="receiptDate" value={v.receiptDate} onChange={(e) => { set('receiptDate')(e); setLines(null); }} className={box('receiptDate')} />
          {err('receiptDate')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Bank amount (₹) <span className="text-red-600">*</span></span>
          <input name="bankAmount" inputMode="decimal" value={v.bankAmount} onChange={set('bankAmount')} placeholder="e.g. 81,000" className={box('bankAmount')} />
          {err('bankAmount')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">TDS deducted (₹) <span className="text-red-600">*</span></span>
          <input name="tdsAmount" inputMode="decimal" value={tdsText}
            onChange={(e) => { setTdsTyped(true); setV({ ...v, tdsAmount: e.target.value }); }} className={box('tdsAmount')} />
          {!state.errors.tdsAmount && (
            <span className="text-xs text-slate-500">
              {tdsTyped ? 'As entered — what the customer actually deducted.' : customer ? `Pre-filled at ${customer.tdsRatePct}% of the taxable value; type over it if different.` : ''}
            </span>
          )}
          {err('tdsAmount')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Mode <span className="text-red-600">*</span></span>
          <select name="mode" value={v.mode} onChange={set('mode')} className={box('mode')}>
            {RECEIPT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {err('mode')}
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          <span className="font-medium">Reference <span className="text-red-600">*</span></span>
          <input name="reference" value={v.reference} onChange={set('reference')} placeholder="UTR or cheque number" className={box('reference')} />
          {err('reference')}
        </label>
      </div>

      {customer && (
        <AllocationTable
          open={open}
          available={settlement}
          availableLabel="Settlement value (bank + TDS)"
          values={values}
          onChange={(id, text) => setLines({ ...values, [id]: text })}
          onSuggest={() => setLines(null)}
          onClear={() => setLines({})}
          problems={state.errors.allocations}
        />
      )}

      <div className="flex gap-3">
        <button disabled={pending} className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? 'Saving…' : 'Save payment'}
        </button>
        <Link href={cancelHref} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">Cancel</Link>
      </div>
    </form>
  );
}
