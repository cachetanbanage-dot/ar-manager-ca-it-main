// Customer page (Part 2): profile, balance with ageing, over-limit warning,
// invoices, receipts with unapplied credit, notes, and quick actions.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ButtonLink, InvoiceStatusCell, Label, SectionTitle, StatusBadge, Td, Th } from '@/components/ui';
import { BUCKETS } from '@/lib/ar/positions';
import { loadArData } from '@/lib/ar/load';
import { setCustomerActive } from '@/lib/actions/customers';
import { hrefWithAsOf } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { formatBalance, formatDate, formatMoney, formatPct } from '@/lib/format';
import { customerDetail } from '@/lib/lists/customers';

type Props = PageProps<'/customers/[id]'>;

async function CustomerView({ params, searchParams }: Props) {
  const [{ id }, { asof, keepAsof }] = await Promise.all([params, readAsOf(searchParams)]);
  const detail = customerDetail(await loadArData(), Number(id), asof);
  if (!detail) notFound();

  const { position: p, invoices, receipts, notes } = detail;
  const c = p.customer;
  const link = (href: string) => hrefWithAsOf(href, keepAsof);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500"><Link href={link('/customers')} className="hover:underline">Customers</Link> / {c.code}</p>
          <h1 className="text-2xl font-semibold">
            {c.name} <StatusBadge status={c.isActive ? 'Active' : 'Inactive'} />
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.isActive && <ButtonLink primary href={link(`/invoices/new?customer=${c.id}`)}>New invoice</ButtonLink>}
          <ButtonLink href={link(`/receipts/new?customer=${c.id}`)}>Record payment</ButtonLink>
          <ButtonLink href={link(`/statement?customer=${c.id}`)}>Statement</ButtonLink>
          <ButtonLink href={link(`/customers/${c.id}/edit`)}>Edit</ButtonLink>
          <form action={setCustomerActive.bind(null, c.id, !c.isActive)}>
            <button className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100">
              {c.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </form>
        </div>
      </div>

      {p.overLimit && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-red-800">
          Over credit limit: balance {formatBalance(p.netBalance)} against a limit of {formatMoney(c.creditLimit)}.
        </p>
      )}
      {!c.isActive && (
        <p className="mt-4 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700">
          This customer is inactive and cannot be given new invoices. Reactivate to raise one.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Code</dt><dd>{c.code}</dd>
          <dt className="text-slate-500">Contact</dt><dd>{c.contactPerson}</dd>
          <dt className="text-slate-500">Email</dt><dd><a href={`mailto:${c.email}`} className="text-blue-700 hover:underline">{c.email}</a></dd>
          <dt className="text-slate-500">Phone</dt><dd>{c.phone ?? '—'}</dd>
          <dt className="text-slate-500">City, state</dt><dd>{c.city}, {c.state}</dd>
          <dt className="text-slate-500">GSTIN</dt><dd>{c.gstin ?? '—'}</dd>
          <dt className="text-slate-500">Credit terms</dt><dd>{c.creditDays} days</dd>
          <dt className="text-slate-500">Credit limit</dt><dd>{formatMoney(c.creditLimit)}</dd>
          <dt className="text-slate-500">TDS rate</dt><dd>{c.tdsRatePct}%</dd>
        </dl>

        <div className="rounded border border-slate-200 p-4 text-sm">
          <p className="text-slate-500">Balance as at {formatDate(asof)}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatBalance(p.netBalance)}</p>
          <dl className="mt-2 grid grid-cols-[1fr_max-content] gap-y-1 tabular-nums">
            <dt>Outstanding on invoices</dt><dd className="text-right">{formatMoney(p.outstanding)}</dd>
            <dt>Less unapplied credit</dt><dd className="text-right">{formatMoney(p.unapplied)}</dd>
            <dt className="text-red-700">Overdue</dt><dd className="text-right text-red-700">{formatMoney(p.overdue)}</dd>
            <dt>Credit limit used</dt><dd className="text-right">{formatPct(p.usedPct)}</dd>
          </dl>
          <p className="mt-3 text-xs text-slate-600">
            {BUCKETS.map((b) => `${b} ${formatMoney(p.buckets[b])}`).join(' · ')}
          </p>
        </div>
      </div>

      <SectionTitle>Invoices</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Number</Th><Th>Date</Th><Th>Due</Th><Th right>Total</Th><Th right>Received</Th>
              <Th right>Credited</Th><Th right>Outstanding</Th><Th>Status</Th><Th right>Days late</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((r) => (
              <tr key={r.invoice.id} className={`border-b border-slate-100 ${r.status === 'Overdue' ? 'bg-red-50 text-red-900' : ''}`}>
                <Td><Link href={link(`/invoices/${r.invoice.id}`)} className="text-blue-700 hover:underline">{r.invoice.invoiceNo}</Link></Td>
                <Td>{formatDate(r.invoice.invoiceDate)}</Td>
                <Td>{formatDate(r.invoice.dueDate)}</Td>
                <Td right>{formatMoney(r.invoice.total)}</Td>
                <Td right>{formatMoney(r.received)}</Td>
                <Td right>{formatMoney(r.credited)}</Td>
                <Td right>{formatMoney(r.outstanding)}</Td>
                <Td><InvoiceStatusCell status={r.status} isPartPaid={r.isPartPaid} isDisputed={r.invoice.isDisputed} /></Td>
                <Td right>{r.status === 'Overdue' ? r.daysPastDue : ''}</Td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={9} className="py-4 text-center text-slate-500">No invoices as at {formatDate(asof)}.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionTitle>Receipts</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Number</Th><Th>Date</Th><Th>Mode</Th><Th>Reference</Th><Th right>Bank</Th><Th right>TDS</Th>
              <Th right>Settlement</Th><Th right>Allocated</Th><Th right>Unapplied</Th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.receipt.id} className="border-b border-slate-100">
                <Td>{r.receipt.receiptNo}</Td>
                <Td>{formatDate(r.receipt.receiptDate)}</Td>
                <Td>{r.receipt.mode}</Td>
                <Td>{r.receipt.reference}</Td>
                <Td right>{formatMoney(r.receipt.bankAmount)}</Td>
                <Td right>{formatMoney(r.receipt.tdsAmount)}</Td>
                <Td right>{formatMoney(r.settlement)}</Td>
                <Td right>{formatMoney(r.allocated)}</Td>
                <Td right className={r.unapplied > 0 ? 'font-semibold text-blue-800' : ''}>{formatMoney(r.unapplied)}</Td>
              </tr>
            ))}
            {receipts.length === 0 && <tr><td colSpan={9} className="py-4 text-center text-slate-500">No receipts as at {formatDate(asof)}.</td></tr>}
          </tbody>
        </table>
      </div>
      {p.unapplied > 0 && (
        <p className="mt-2 text-sm text-blue-800">Unapplied credit of {formatMoney(p.unapplied)} is waiting to be allocated.</p>
      )}

      <SectionTitle>Notes</SectionTitle>
      {notes.length === 0 && <p className="text-sm text-slate-500">No notes as at {formatDate(asof)}.</p>}
      <ol className="space-y-3">
        {notes.map(({ note: n, invoiceNo, followUpDue, promiseStatus }) => (
          <li key={n.id} className="border-l-2 border-slate-300 pl-3 text-sm">
            <p className="text-slate-500">
              {formatDate(n.noteDate)} · {n.noteType}
              {invoiceNo && <> · <Link href={link(`/invoices/${n.invoiceId}`)} className="text-blue-700 hover:underline">{invoiceNo}</Link></>}
            </p>
            <p>{n.body}</p>
            {n.followUpDate && (
              <p className="text-slate-600">
                Follow up {formatDate(n.followUpDate)} {n.followUpDone ? '(done)' : followUpDue ? <Label tone="amber">due</Label> : ''}
              </p>
            )}
            {n.promiseDate && n.promiseAmount !== null && (
              <p className="text-slate-600">
                Promised {formatMoney(n.promiseAmount)} by {formatDate(n.promiseDate)}
                {promiseStatus && <span className={`ml-2 font-medium ${promiseStatus === 'Broken' ? 'text-red-700' : promiseStatus === 'Kept' ? 'text-green-700' : ''}`}>{promiseStatus}</span>}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function CustomerPage(props: Props) {
  return (
    <Suspense fallback={<p>Loading customer…</p>}>
      <CustomerView {...props} />
    </Suspense>
  );
}
