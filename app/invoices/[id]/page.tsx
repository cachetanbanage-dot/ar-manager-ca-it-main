// Invoice page (Part 2): tax breakdown, allocations, credit notes, notes and
// outstanding as at D. Actions: raise a credit note, disputed flag, cancel (R8).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { ButtonLink, InvoiceStatusCell, SectionTitle, Td, Th } from '@/components/ui';
import { cancelInvoice, setInvoiceDisputed, updateInvoiceDescription } from '@/lib/actions/invoices';
import { removeAllocation } from '@/lib/actions/receipts';
import { loadArData } from '@/lib/ar/load';
import { hrefWithAsOf } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { formatDate, formatMoney } from '@/lib/format';
import { invoiceDetail } from '@/lib/lists/invoice-detail';

type Props = PageProps<'/invoices/[id]'>;

async function InvoiceView({ params, searchParams }: Props) {
  const [{ id }, { asof, keepAsof, settings }] = await Promise.all([params, readAsOf(searchParams)]);
  const d = invoiceDetail(await loadArData(), Number(id), asof, settings);
  if (!d) notFound();
  const inv = d.invoice;
  const link = (href: string) => hrefWithAsOf(href, keepAsof);
  const r = d.row;

  return (
    <div>
      <p className="text-sm text-slate-500"><Link href={link('/invoices')} className="hover:underline">Invoices</Link> / {inv.invoiceNo}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {inv.invoiceNo}{' '}
          {r ? <InvoiceStatusCell status={r.status} isPartPaid={r.isPartPaid} isDisputed={inv.isDisputed} />
            : <span className="text-base font-normal text-slate-500">(not yet raised on {formatDate(asof)})</span>}
        </h1>
        {!inv.isCancelled && d.remaining > 0 && (
          <ButtonLink primary href={link(`/invoices/${inv.id}/credit-note`)}>Raise credit note</ButtonLink>
        )}
      </div>
      <p className="mt-1">
        <Link href={link(`/customers/${d.customer.id}`)} className="text-blue-700 hover:underline">{d.customer.code} · {d.customer.name}</Link>
        <span className="text-slate-500"> · {d.customer.state}</span>
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <dl className="grid grid-cols-[max-content_1fr] content-start gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Invoice date</dt><dd>{formatDate(inv.invoiceDate)}</dd>
          <dt className="text-slate-500">Due date</dt><dd>{formatDate(inv.dueDate)}</dd>
          <dt className="text-slate-500">GST rate</dt><dd>{inv.gstRatePct}%</dd>
          <dt className="text-slate-500">Description</dt><dd>{inv.description}</dd>
        </dl>

        <table className="text-sm tabular-nums">
          <tbody>
            <tr><td className="pr-6 text-slate-500">Taxable value</td><td className="text-right">{formatMoney(inv.taxableValue)}</td></tr>
            {inv.igst > 0 ? (
              <tr><td className="text-slate-500">IGST @ {inv.gstRatePct}%</td><td className="text-right">{formatMoney(inv.igst)}</td></tr>
            ) : (
              <>
                <tr><td className="text-slate-500">CGST @ {inv.gstRatePct / 2}%</td><td className="text-right">{formatMoney(inv.cgst)}</td></tr>
                <tr><td className="text-slate-500">SGST @ {inv.gstRatePct / 2}%</td><td className="text-right">{formatMoney(inv.sgst)}</td></tr>
              </>
            )}
            <tr className="border-t font-semibold"><td>Invoice total</td><td className="text-right">{formatMoney(inv.total)}</td></tr>
          </tbody>
        </table>

        <div className="rounded border border-slate-200 p-4 text-sm">
          <p className="text-slate-500">Position as at {formatDate(asof)}</p>
          {inv.isCancelled ? (
            <p className="mt-1">Cancelled. Left out of every total, balance, ageing and statement.</p>
          ) : r ? (
            <dl className="mt-1 grid grid-cols-[1fr_max-content] gap-y-1 tabular-nums">
              <dt>Total</dt><dd className="text-right">{formatMoney(inv.total)}</dd>
              <dt>Less received</dt><dd className="text-right">{formatMoney(r.received)}</dd>
              <dt>Less credited</dt><dd className="text-right">{formatMoney(r.credited)}</dd>
              <dt className="font-semibold">Outstanding</dt><dd className="text-right font-semibold">{formatMoney(r.outstanding)}</dd>
              {r.status === 'Overdue' && <><dt className="text-red-700">Days late</dt><dd className="text-right text-red-700">{r.daysPastDue}</dd></>}
              {r.bucket && <><dt>Ageing bucket</dt><dd className="text-right">{r.bucket}</dd></>}
            </dl>
          ) : (
            <p className="mt-1">Not yet raised on this date.</p>
          )}
          {d.laterRecords > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {d.laterRecords} allocation{d.laterRecords > 1 ? 's' : ''} or credit note{d.laterRecords > 1 ? 's' : ''} dated after {formatDate(asof)} not counted here.
            </p>
          )}
          {!inv.isCancelled && <p className="mt-2 text-xs text-slate-500">Still open across all records: {formatMoney(d.remaining)}</p>}
        </div>
      </div>

      <SectionTitle>Payments allocated</SectionTitle>
      <table className="w-full text-sm">
        <thead><tr><Th>Receipt</Th><Th>Receipt date</Th><Th>Allocated on</Th><Th right>Amount</Th><Th /></tr></thead>
        <tbody>
          {d.allocations.map(({ allocation: a, receipt }) => (
            <tr key={a.id} className="border-b border-slate-100">
              <Td>{receipt.receiptNo}</Td><Td>{formatDate(receipt.receiptDate)}</Td><Td>{formatDate(a.allocationDate)}</Td>
              <Td right>{formatMoney(a.amount)}</Td>
              <Td>
                <ActionForm action={removeAllocation.bind(null, a.id)} submitLabel="Remove" danger
                  confirmText={`Remove the ${formatMoney(a.amount)} allocation from ${receipt.receiptNo}? It becomes unapplied credit again.`} />
              </Td>
            </tr>
          ))}
          {d.allocations.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-500">None as at {formatDate(asof)}.</td></tr>}
        </tbody>
      </table>

      <SectionTitle>Credit notes</SectionTitle>
      <table className="w-full text-sm">
        <thead><tr><Th>Number</Th><Th>Date</Th><Th>Reason</Th><Th right>Taxable</Th><Th right>GST</Th><Th right>Total</Th></tr></thead>
        <tbody>
          {d.creditNotes.map((c) => (
            <tr key={c.id} className="border-b border-slate-100">
              <Td>{c.creditNoteNo}</Td><Td>{formatDate(c.creditNoteDate)}</Td><Td>{c.reason}</Td>
              <Td right>{formatMoney(c.taxableValue)}</Td>
              <Td right>{formatMoney(c.gst)}</Td>
              <Td right>{formatMoney(c.total)}</Td>
            </tr>
          ))}
          {d.creditNotes.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-500">None as at {formatDate(asof)}.</td></tr>}
        </tbody>
      </table>

      <div className="mt-8 mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notes</h2>
        <ButtonLink href={link(`/notes/new?invoice=${inv.id}`)}>Add note</ButtonLink>
      </div>
      {d.notes.length === 0 && <p className="text-sm text-slate-500">No notes on this invoice as at {formatDate(asof)}.</p>}
      <ol className="space-y-2">
        {d.notes.map((n) => (
          <li key={n.id} className="border-l-2 border-slate-300 pl-3 text-sm">
            <p className="text-slate-500">{formatDate(n.noteDate)} · {n.noteType}</p>
            <p>{n.body}</p>
          </li>
        ))}
      </ol>

      {!inv.isCancelled && (
        <>
          <SectionTitle>Actions</SectionTitle>
          <div className="space-y-4">
            <ActionForm action={updateInvoiceDescription.bind(null, inv.id)} submitLabel="Save description">
              <input name="description" defaultValue={inv.description} maxLength={200}
                className="w-96 max-w-full rounded border border-slate-300 px-2 py-1 text-sm" aria-label="Description" />
            </ActionForm>
            <ActionForm action={setInvoiceDisputed.bind(null, inv.id, !inv.isDisputed)}
              submitLabel={inv.isDisputed ? 'Clear disputed flag' : 'Mark as disputed'}>
              <span className="text-sm text-slate-600">
                {inv.isDisputed ? 'This invoice is disputed.' : 'Not disputed.'} The flag is a label only; it changes no amount.
              </span>
            </ActionForm>
            {d.cancelBlocker ? (
              <p className="text-sm text-slate-600">Cancel: {d.cancelBlocker}</p>
            ) : (
              <ActionForm action={cancelInvoice.bind(null, inv.id)} submitLabel="Cancel invoice" danger>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="confirm" value="yes" />
                  I want to cancel {inv.invoiceNo}. The number will not be reused.
                </label>
              </ActionForm>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function InvoicePage(props: Props) {
  return (
    <Suspense fallback={<p>Loading invoice…</p>}>
      <InvoiceView {...props} />
    </Suspense>
  );
}
