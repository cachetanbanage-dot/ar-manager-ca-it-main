// Invoice list (Part 2): every invoice as at D, with filters, search, sort and a totals row.
import Link from 'next/link';
import { Suspense } from 'react';
import { ButtonLink, InvoiceStatusCell, SortTh, Td } from '@/components/ui';
import { loadArData } from '@/lib/ar/load';
import { hrefWithAsOf } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { formatDate, formatMoney } from '@/lib/format';
import { STATUS_FILTERS, STATUS_LABELS, invoiceListOptions, invoiceListRows } from '@/lib/lists/invoices';
import { sortRows } from '@/lib/sort';
import { buildHref } from '@/lib/url';

type SearchParams = PageProps<'/invoices'>['searchParams'];

async function InvoiceList({ searchParams }: { searchParams: SearchParams }) {
  const { asof, keepAsof, params } = await readAsOf(searchParams);
  const o = invoiceListOptions(params);
  const data = await loadArData();
  const { rows, totals } = invoiceListRows(data, asof, o);
  const customers = sortRows(data.customers, (c) => c.name, 'asc');

  const filters = { q: o.q, customer: o.customer, status: o.status === 'all' ? '' : o.status,
    disputed: o.disputed === 'all' ? '' : o.disputed, from: o.from, to: o.to, asof: keepAsof };
  const sortHref = (sort: string, dir: 'asc' | 'desc') => buildHref('/invoices', { ...filters, sort, dir });
  const th = (label: string, key: string, right?: boolean) => (
    <SortTh label={label} sortKey={key} current={o.sort} dir={o.dir} href={sortHref} right={right} />
  );
  const input = 'rounded border border-slate-300 px-2 py-1';

  return (
    <>
      <form action="/invoices" className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col"><span className="text-slate-600">Invoice number</span>
          <input name="q" defaultValue={o.q} placeholder="e.g. 0007" className={`${input} w-36`} />
        </label>
        <label className="flex flex-col"><span className="text-slate-600">Customer</span>
          <select name="customer" defaultValue={o.customer ?? ''} className={input}>
            <option value="">All customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col"><span className="text-slate-600">Status</span>
          <select name="status" defaultValue={o.status} className={input}>
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col"><span className="text-slate-600">Disputed</span>
          <select name="disputed" defaultValue={o.disputed} className={input}>
            <option value="all">All</option><option value="yes">Disputed</option><option value="no">Not disputed</option>
          </select>
        </label>
        <label className="flex flex-col"><span className="text-slate-600">Invoice date from</span>
          <input type="date" name="from" defaultValue={o.from} className={input} />
        </label>
        <label className="flex flex-col"><span className="text-slate-600">to</span>
          <input type="date" name="to" defaultValue={o.to} className={input} />
        </label>
        {keepAsof && <input type="hidden" name="asof" value={keepAsof} />}
        <input type="hidden" name="sort" value={o.sort} />
        <input type="hidden" name="dir" value={o.dir} />
        <button className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700">Filter</button>
        <Link href={hrefWithAsOf('/invoices', keepAsof)} className="px-2 py-1 text-slate-600 hover:underline">Clear</Link>
      </form>

      <p className="mb-2 text-sm text-slate-600">
        {rows.length} invoice{rows.length === 1 ? '' : 's'} · positions as at {formatDate(asof)} · cancelled invoices are left out of the totals
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {th('Number', 'number')}{th('Customer', 'customer')}{th('Invoice date', 'date')}{th('Due date', 'due')}
              {th('Total', 'total', true)}{th('Received', 'received', true)}{th('Credited', 'credited', true)}
              {th('Outstanding', 'outstanding', true)}{th('Status', 'status')}{th('Days late', 'daysLate', true)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice.id} className={`border-b border-slate-100 ${r.status === 'Overdue' ? 'bg-red-50 text-red-900' : r.status === 'Cancelled' ? 'text-slate-400' : ''}`}>
                <Td><Link href={hrefWithAsOf(`/invoices/${r.invoice.id}`, keepAsof)} className="font-medium text-blue-700 hover:underline">{r.invoice.invoiceNo}</Link></Td>
                <Td><Link href={hrefWithAsOf(`/customers/${r.customer.id}`, keepAsof)} className="hover:underline">{r.customer.name}</Link></Td>
                <Td>{formatDate(r.invoice.invoiceDate)}</Td>
                <Td>{formatDate(r.invoice.dueDate)}</Td>
                <Td right>{formatMoney(r.invoice.total)}</Td>
                <Td right>{formatMoney(r.received)}</Td>
                <Td right>{formatMoney(r.credited)}</Td>
                <Td right>{formatMoney(r.outstanding)}</Td>
                <Td><InvoiceStatusCell status={r.status} isPartPaid={r.isPartPaid} isDisputed={r.invoice.isDisputed} /></Td>
                <Td right>{r.daysLate ?? ''}</Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-slate-500">No invoices match.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-400 font-semibold">
              <Td>Total</Td><Td /><Td /><Td />
              <Td right>{formatMoney(totals.total)}</Td>
              <Td right>{formatMoney(totals.received)}</Td>
              <Td right>{formatMoney(totals.credited)}</Td>
              <Td right>{formatMoney(totals.outstanding)}</Td>
              <Td /><Td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

async function NewButton({ searchParams }: { searchParams: SearchParams }) {
  const { keepAsof } = await readAsOf(searchParams);
  return <ButtonLink primary href={hrefWithAsOf('/invoices/new', keepAsof)}>New invoice</ButtonLink>;
}

export default function InvoicesPage({ searchParams }: PageProps<'/invoices'>) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Suspense fallback={null}><NewButton searchParams={searchParams} /></Suspense>
      </div>
      <Suspense fallback={<p>Loading invoices…</p>}>
        <InvoiceList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
