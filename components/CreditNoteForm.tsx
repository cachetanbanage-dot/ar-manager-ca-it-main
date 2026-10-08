'use client';
// Raise a credit note (R7) with a live preview. The server works everything
// out again when saving.
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { previewCreditNote } from '@/lib/ar/invoices';
import type { ArData, Invoice } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { formatMoney } from '@/lib/format';
import { cnTaxableSchema, type CreditNoteFormState } from '@/lib/validation/credit-note';

type Action = (prev: CreditNoteFormState, formData: FormData) => Promise<CreditNoteFormState>;

export function CreditNoteForm({ action, data, invoice, initial, asof, cancelHref }: {
  action: Action; data: ArData; invoice: Invoice; initial: Record<string, string>; asof?: string; cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initial, errors: {}, attempt: 0 });
  const [v, setV] = useState(initial);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  const taxable = cnTaxableSchema.safeParse(v.taxableValue);
  const preview = taxable.success && isValidDate(v.creditNoteDate)
    ? previewCreditNote(data, invoice.id, v.creditNoteDate, taxable.data)
    : null;

  const err = (k: string) => state.errors[k]?.map((e) => <span key={e} className="text-xs text-red-700">{e}</span>);
  const box = (k: string) => `rounded border px-2 py-1.5 ${state.errors[k] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`;

  return (
    <form action={formAction} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-4">
        {asof && <input type="hidden" name="asof" value={asof} />}
        {state.message && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Credit note date <span className="text-red-600">*</span></span>
            <input type="date" name="creditNoteDate" value={v.creditNoteDate} onChange={set('creditNoteDate')} min={invoice.invoiceDate} className={box('creditNoteDate')} />
            {err('creditNoteDate')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Taxable value (₹) <span className="text-red-600">*</span></span>
            <input name="taxableValue" inputMode="decimal" value={v.taxableValue} onChange={set('taxableValue')} className={box('taxableValue')} />
            {err('taxableValue')}
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Reason <span className="text-red-600">*</span></span>
          <input name="reason" value={v.reason} onChange={set('reason')} maxLength={200} className={box('reason')} />
          {err('reason')}
        </label>
        <div className="flex gap-3">
          <button disabled={pending} className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
            {pending ? 'Saving…' : 'Save credit note'}
          </button>
          <Link href={cancelHref} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">Cancel</Link>
        </div>
      </div>

      <aside className="h-fit rounded border border-slate-200 bg-slate-50 p-4 text-sm">
        <h2 className="mb-2 font-semibold">Preview</h2>
        {!preview ? (
          <p className="text-slate-500">Enter a date and taxable value to see the GST, total and number.</p>
        ) : (
          <>
            <dl className="grid grid-cols-[1fr_max-content] gap-y-1 tabular-nums">
              <dt>Number</dt><dd className="text-right font-medium">{preview.creditNoteNo}</dd>
              <dt>Taxable value</dt><dd className="text-right">{formatMoney(taxable.success ? taxable.data : 0)}</dd>
              {invoice.igst > 0 ? (
                <><dt>IGST @ {invoice.gstRatePct}%</dt><dd className="text-right">{formatMoney(preview.igst)}</dd></>
              ) : (
                <>
                  <dt>CGST @ {invoice.gstRatePct / 2}%</dt><dd className="text-right">{formatMoney(preview.cgst)}</dd>
                  <dt>SGST @ {invoice.gstRatePct / 2}%</dt><dd className="text-right">{formatMoney(preview.sgst)}</dd>
                </>
              )}
              <dt className="border-t pt-1 font-semibold">Credit note total</dt><dd className="border-t pt-1 text-right font-semibold">{formatMoney(preview.total)}</dd>
            </dl>
            <p className={`mt-3 ${preview.exceedsRemaining ? 'font-medium text-red-700' : 'text-slate-600'}`}>
              Still open on {invoice.invoiceNo}: {formatMoney(preview.remaining)}
              {preview.exceedsRemaining && ' — this credit note is larger and cannot be saved.'}
            </p>
          </>
        )}
      </aside>
    </form>
  );
}
