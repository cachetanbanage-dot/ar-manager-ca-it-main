'use client';
// Allocate unapplied credit (Part 2, action 2): choose a receipt with credit
// left, an allocation date, and amounts against open invoices.
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { openInvoices, suggestAllocations } from '@/lib/ar/receipts';
import type { ArData, Paise, Receipt } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { formatDate, formatMoney, rupeesPlain } from '@/lib/format';
import type { PaymentFormState } from '@/lib/validation/receipt';
import { AllocationTable } from './AllocationTable';

type Action = (prev: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;

export function AllocateForm({ action, data, receipts, initial, asof, cancelHref }: {
  action: Action;
  data: ArData;
  receipts: { receipt: Receipt; remaining: Paise }[];
  initial: Record<string, string>;
  asof?: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initial, errors: {}, attempt: 0 });
  const [v, setV] = useState(initial);
  const [lines, setLines] = useState<Record<number, string> | null>(null);

  const chosen = receipts.find((r) => String(r.receipt.id) === v.receiptId);
  const open = chosen && isValidDate(v.allocationDate) ? openInvoices(data, chosen.receipt.customerId, v.allocationDate) : [];
  const values = lines ?? Object.fromEntries([...suggestAllocations(open, chosen?.remaining ?? 0)].map(([id, p]) => [id, rupeesPlain(p)]));
  const err = (k: string) => state.errors[k]?.map((e) => <span key={e} className="text-xs text-red-700">{e}</span>);

  return (
    <form action={formAction} noValidate className="grid max-w-4xl gap-6">
      {asof && <input type="hidden" name="asof" value={asof} />}
      {state.message && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Receipt with unapplied credit</span>
          <select name="receiptId" value={v.receiptId} onChange={(e) => { setV({ ...v, receiptId: e.target.value }); setLines(null); }}
            className="rounded border border-slate-300 px-2 py-1.5">
            {receipts.map(({ receipt: r, remaining }) => (
              <option key={r.id} value={r.id}>{r.receiptNo} · {formatDate(r.receiptDate)} · {formatMoney(remaining)} unapplied</option>
            ))}
          </select>
          {err('receiptId')}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Allocation date</span>
          <input type="date" name="allocationDate" value={v.allocationDate} min={chosen?.receipt.receiptDate}
            onChange={(e) => { setV({ ...v, allocationDate: e.target.value }); setLines(null); }}
            className={`rounded border px-2 py-1.5 ${state.errors.allocationDate ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} />
          {err('allocationDate')}
        </label>
      </div>

      {chosen && (
        <AllocationTable
          open={open}
          available={chosen.remaining}
          availableLabel={`Unapplied on ${chosen.receipt.receiptNo}`}
          values={values}
          onChange={(id, text) => setLines({ ...values, [id]: text })}
          onSuggest={() => setLines(null)}
          onClear={() => setLines({})}
          problems={state.errors.allocations}
        />
      )}

      <div className="flex gap-3">
        <button disabled={pending} className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? 'Saving…' : 'Save allocation'}
        </button>
        <Link href={cancelHref} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">Cancel</Link>
      </div>
    </form>
  );
}
