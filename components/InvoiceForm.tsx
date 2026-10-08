'use client';
// The new invoice form with a live preview (Part 2). The preview uses the same
// lib/ar functions as the server; when saving, the server works everything out
// again and is the one that counts.
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { GST_RATES, isIntraState } from '@/lib/ar/gst';
import { previewInvoice } from '@/lib/ar/invoices';
import type { ArData, Customer } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney } from '@/lib/format';
import { taxableSchema, type InvoiceFormState } from '@/lib/validation/invoice';

type Action = (prev: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;

export function InvoiceForm({ action, data, customers, initial, asof, cancelHref }: {
  action: Action; data: ArData; customers: Customer[]; initial: Record<string, string>; asof?: string; cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initial, errors: {}, attempt: 0 });
  const [v, setV] = useState(initial);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  // Live preview, only when the inputs it needs are valid
  const taxable = taxableSchema.safeParse(v.taxableValue);
  const customer = customers.find((c) => String(c.id) === v.customerId);
  const preview = customer && taxable.success && isValidDate(v.invoiceDate)
    ? previewInvoice(data, { customerId: customer.id, invoiceDate: v.invoiceDate, taxableValue: taxable.data, gstRatePct: Number(v.gstRatePct) })
    : null;

  const err = (k: string) => state.errors[k]?.map((e) => <span key={e} className="text-xs text-red-700">{e}</span>);
  const box = (k: string) => `rounded border px-2 py-1.5 ${state.errors[k] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`;

  return (
    <form action={formAction} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-4">
        {asof && <input type="hidden" name="asof" value={asof} />}
        {state.message && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Customer <span className="text-red-600">*</span></span>
          <select name="customerId" value={v.customerId} onChange={set('customerId')} className={box('customerId')}>
            <option value="">Choose an active customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} ({c.state})</option>)}
          </select>
          {err('customerId')}
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Invoice date <span className="text-red-600">*</span></span>
            <input type="date" name="invoiceDate" value={v.invoiceDate} onChange={set('invoiceDate')} className={box('invoiceDate')} />
            {err('invoiceDate')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Taxable value (₹) <span className="text-red-600">*</span></span>
            <input name="taxableValue" inputMode="decimal" value={v.taxableValue} onChange={set('taxableValue')} placeholder="e.g. 75,000" className={box('taxableValue')} />
            {err('taxableValue')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">GST rate <span className="text-red-600">*</span></span>
            <select name="gstRatePct" value={v.gstRatePct} onChange={set('gstRatePct')} className={box('gstRatePct')}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
            {err('gstRatePct')}
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Description <span className="text-red-600">*</span></span>
          <input name="description" value={v.description} onChange={set('description')} maxLength={200} className={box('description')} />
          {err('description')}
        </label>

        <div className="flex gap-3">
          <button disabled={pending} className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
            {pending ? 'Saving…' : 'Save invoice'}
          </button>
          <Link href={cancelHref} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">Cancel</Link>
        </div>
      </div>

      <aside className="h-fit rounded border border-slate-200 bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-semibold">Preview</h2>
        {!preview ? (
          <p className="text-slate-500">Choose a customer and enter a date and taxable value to see the tax, total, due date and number.</p>
        ) : (
          <>
            <dl className="grid grid-cols-[1fr_max-content] gap-y-1 tabular-nums">
              <dt>Number</dt><dd className="text-right font-medium">{preview.invoiceNo}</dd>
              <dt>Due date</dt><dd className="text-right">{formatDate(preview.dueDate)} ({customer!.creditDays} days)</dd>
              <dt>Taxable value</dt><dd className="text-right">{formatMoney(taxable.success ? taxable.data : 0)}</dd>
              {!isIntraState(customer!.state) ? (
                <><dt>IGST @ {v.gstRatePct}%</dt><dd className="text-right">{formatMoney(preview.igst)}</dd></>
              ) : (
                <>
                  <dt>CGST @ {Number(v.gstRatePct) / 2}%</dt><dd className="text-right">{formatMoney(preview.cgst)}</dd>
                  <dt>SGST @ {Number(v.gstRatePct) / 2}%</dt><dd className="text-right">{formatMoney(preview.sgst)}</dd>
                </>
              )}
              <dt className="border-t pt-1 font-semibold">Invoice total</dt><dd className="border-t pt-1 text-right font-semibold">{formatMoney(preview.total)}</dd>
            </dl>
            <p className="mt-3 text-slate-600">
              Balance {formatBalance(preview.balanceBefore)} → {formatBalance(preview.balanceAfter)} against a limit of {formatMoney(preview.creditLimit)}
            </p>
            {preview.overLimit && (
              <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900">
                Warning: this invoice takes {customer!.name} over its credit limit. You can still save it.
              </p>
            )}
          </>
        )}
      </aside>
    </form>
  );
}
