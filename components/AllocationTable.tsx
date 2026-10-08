'use client';
// The open invoices of a customer with an amount box each (R6). Used by
// "Record a payment" and "Allocate unapplied credit". Inputs are named
// alloc_<invoiceId>; the server checks everything again.
import { allocationSummary, type OpenInvoice } from '@/lib/ar/receipts';
import type { Paise } from '@/lib/ar/types';
import { formatDate, formatMoney } from '@/lib/format';
import { rupeesToPaise } from '@/lib/validation/common';
import { ALLOC_PREFIX } from '@/lib/validation/receipt';

const amount = rupeesToPaise('Amount');
const toPaise = (text: string) => { const r = amount.safeParse(text); return r.success ? r.data : 0; };

export function AllocationTable({ open, available, availableLabel, values, onChange, onSuggest, onClear, problems }: {
  open: OpenInvoice[];
  available: Paise;
  availableLabel: string;
  values: Record<number, string>;
  onChange: (invoiceId: number, value: string) => void;
  onSuggest: () => void;
  onClear: () => void;
  problems?: string[];
}) {
  const { allocated, unapplied } = allocationSummary(available, open.map((o) => toPaise(values[o.invoice.id] ?? '')));

  return (
    <div className="rounded border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Allocate to open invoices</h2>
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={onSuggest} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100">Suggest oldest first</button>
          <button type="button" onClick={onClear} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100">Clear</button>
        </div>
      </div>
      {problems?.map((p) => <p key={p} role="alert" className="mb-1 text-sm text-red-700">{p}</p>)}
      {open.length === 0 ? (
        <p className="text-sm text-slate-500">No open invoices. Everything received will be unapplied credit.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-1 font-medium">Invoice</th><th className="font-medium">Date</th><th className="font-medium">Due</th>
              <th className="text-right font-medium">Open</th><th className="w-40 text-right font-medium">Allocate (₹)</th>
            </tr>
          </thead>
          <tbody>
            {open.map((o) => (
              <tr key={o.invoice.id} className="border-b border-slate-100">
                <td className="py-1">{o.invoice.invoiceNo}{o.invoice.isDisputed && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-800">disputed</span>}</td>
                <td>{formatDate(o.invoice.invoiceDate)}</td>
                <td>{formatDate(o.invoice.dueDate)}</td>
                <td className="text-right tabular-nums">{formatMoney(o.remaining)}</td>
                <td className="py-1 text-right">
                  <input
                    name={`${ALLOC_PREFIX}${o.invoice.id}`}
                    inputMode="decimal"
                    value={values[o.invoice.id] ?? ''}
                    onChange={(e) => onChange(o.invoice.id, e.target.value)}
                    aria-label={`Allocate to ${o.invoice.invoiceNo}`}
                    className="w-36 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <dl className="mt-3 grid grid-cols-[1fr_max-content] gap-y-1 text-sm tabular-nums sm:w-80 sm:ml-auto">
        <dt>{availableLabel}</dt><dd className="text-right">{formatMoney(available)}</dd>
        <dt>Allocated</dt><dd className="text-right">{formatMoney(allocated)}</dd>
        <dt className="font-semibold">Remains unapplied</dt>
        <dd className={`text-right font-semibold ${unapplied < 0 ? 'text-red-700' : unapplied > 0 ? 'text-blue-800' : ''}`}>
          {formatMoney(unapplied)}{unapplied < 0 && ' (too much allocated)'}
        </dd>
      </dl>
    </div>
  );
}
