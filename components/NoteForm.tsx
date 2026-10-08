'use client';
// Add a note (R16). The invoice list follows the chosen customer.
import Link from 'next/link';
import { useActionState, useState } from 'react';
import type { Customer, Invoice } from '@/lib/ar/types';
import { formatDate } from '@/lib/format';
import { NOTE_TYPES, type NoteFormState } from '@/lib/validation/note';

type Action = (prev: NoteFormState, formData: FormData) => Promise<NoteFormState>;

export function NoteForm({ action, customers, invoices, initial, asof, back, cancelHref }: {
  action: Action; customers: Customer[]; invoices: Invoice[]; initial: Record<string, string>;
  asof?: string; back: 'customer' | 'invoice'; cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initial, errors: {}, attempt: 0 });
  const [v, setV] = useState(initial);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const own = invoices.filter((i) => String(i.customerId) === v.customerId);
  const err = (k: string) => state.errors[k]?.map((e) => <span key={e} className="text-xs text-red-700">{e}</span>);
  const box = (k: string) => `rounded border px-2 py-1.5 ${state.errors[k] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`;

  return (
    <form action={formAction} noValidate className="grid max-w-3xl gap-4">
      {asof && <input type="hidden" name="asof" value={asof} />}
      <input type="hidden" name="back" value={back} />
      {state.message && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Customer <span className="text-red-600">*</span></span>
          <select name="customerId" value={v.customerId} onChange={(e) => setV({ ...v, customerId: e.target.value, invoiceId: '' })} className={box('customerId')}>
            <option value="">Choose a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
          {err('customerId')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Invoice (optional)</span>
          <select name="invoiceId" value={v.invoiceId} onChange={set('invoiceId')} className={box('invoiceId')}>
            <option value="">None — about the customer generally</option>
            {own.map((i) => <option key={i.id} value={i.id}>{i.invoiceNo} · {formatDate(i.invoiceDate)}{i.isCancelled ? ' (cancelled)' : ''}</option>)}
          </select>
          {err('invoiceId')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Date <span className="text-red-600">*</span></span>
          <input type="date" name="noteDate" value={v.noteDate} onChange={set('noteDate')} className={box('noteDate')} />
          {err('noteDate')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Type <span className="text-red-600">*</span></span>
          <select name="noteType" value={v.noteType} onChange={set('noteType')} className={box('noteType')}>
            {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {err('noteType')}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Note <span className="text-red-600">*</span></span>
        <textarea name="body" value={v.body} onChange={set('body')} rows={4} maxLength={2000} className={box('body')} />
        {err('body')}
      </label>

      <fieldset className="grid gap-4 rounded border border-slate-200 p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium">Follow-up and promise to pay (optional)</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Follow up on</span>
          <input type="date" name="followUpDate" value={v.followUpDate} onChange={set('followUpDate')} className={box('followUpDate')} />
          {err('followUpDate')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Promised to pay by</span>
          <input type="date" name="promiseDate" value={v.promiseDate} onChange={set('promiseDate')} className={box('promiseDate')} />
          {err('promiseDate')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Promised amount (₹)</span>
          <input name="promiseAmount" inputMode="decimal" value={v.promiseAmount} onChange={set('promiseAmount')} className={box('promiseAmount')} />
          {err('promiseAmount')}
        </label>
        <p className="text-xs text-slate-500 sm:col-span-3">
          A promise needs both a date and an amount. It is Kept once receipts (bank + TDS) from the note date reach the amount by the promise date.
        </p>
      </fieldset>

      <div className="flex gap-3">
        <button disabled={pending} className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? 'Saving…' : 'Save note'}
        </button>
        <Link href={cancelHref} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">Cancel</Link>
      </div>
    </form>
  );
}
