// Statement of account (R15, Part 2 action 5): on screen, print (A4) and CSV.
import { Suspense } from 'react';
import { PrintButton } from '@/components/PrintButton';
import { Td, Th } from '@/components/ui';
import { loadArData } from '@/lib/ar/load';
import { bucketLabels } from '@/lib/ar/settings';
import { statement } from '@/lib/ar/statement';
import { readAsOf } from '@/lib/asof-server';
import { formatBalance, formatDate, formatMoney } from '@/lib/format';
import { statementOptions } from '@/lib/lists/statement';
import { SELLER } from '@/lib/seller';
import { sortRows } from '@/lib/sort';
import { buildHref } from '@/lib/url';

async function StatementView({ searchParams }: { searchParams: PageProps<'/statement'>['searchParams'] }) {
  const { asof, keepAsof, params, settings } = await readAsOf(searchParams);
  const data = await loadArData();
  const o = statementOptions(params, data, asof);
  const customers = sortRows(data.customers, (c) => c.code, 'asc');
  const s = o.customer && !o.error ? statement(data, o.customer.id, o.from, o.to, settings) : null;
  const buckets = bucketLabels(settings);
  const input = 'rounded border border-slate-300 px-2 py-1';

  return (
    <>
      <form action="/statement" className="mb-6 flex flex-wrap items-end gap-2 text-sm print:hidden">
        <label className="flex flex-col"><span className="text-slate-600">Customer</span>
          <select name="customer" defaultValue={o.customer?.id ?? ''} className={input}>
            <option value="">Choose a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col"><span className="text-slate-600">From</span>
          <input type="date" name="from" defaultValue={o.from} className={input} />
        </label>
        <label className="flex flex-col"><span className="text-slate-600">To</span>
          <input type="date" name="to" defaultValue={o.to} className={input} />
        </label>
        {keepAsof && <input type="hidden" name="asof" value={keepAsof} />}
        <button className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700">Show statement</button>
      </form>

      {o.error && <p role="alert" className="text-red-700">{o.error}</p>}
      {!o.customer && <p className="text-slate-600">Choose a customer and a period.</p>}

      {s && (
        <article className="max-w-4xl text-sm">
          <div className="mb-4 flex justify-end gap-2 print:hidden">
            <PrintButton />
            <a href={buildHref('/statement/export', { customer: s.customer.id, from: s.from, to: s.to })}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">Download CSV</a>
          </div>

          <header className="mb-6 flex flex-wrap justify-between gap-4 border-b border-slate-300 pb-4">
            <div>
              <p className="text-lg font-semibold">{SELLER.name}</p>
              <p className="text-slate-600">{SELLER.address}, {SELLER.state}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">Statement of account</p>
              <p>{formatDate(s.from)} to {formatDate(s.to)}</p>
            </div>
          </header>
          <div className="mb-4">
            <p className="text-slate-500">To</p>
            <p className="font-semibold">{s.customer.name} ({s.customer.code})</p>
            <p>{s.customer.city}, {s.customer.state}{s.customer.gstin ? ` · GSTIN ${s.customer.gstin}` : ''}</p>
          </div>

          <table className="w-full">
            <thead>
              <tr><Th>Date</Th><Th>Document</Th><Th>Description</Th><Th right>Debit</Th><Th right>Credit</Th><Th right>Balance</Th></tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 font-medium">
                <Td className="whitespace-nowrap">{formatDate(s.from)}</Td><Td /><Td>Opening balance</Td><Td /><Td />
                <Td right>{formatBalance(s.openingBalance)}</Td>
              </tr>
              {s.lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 break-inside-avoid">
                  <Td className="whitespace-nowrap">{formatDate(l.date)}</Td>
                  <Td className="whitespace-nowrap">{l.documentNo}</Td>
                  <Td>{l.description}</Td>
                  <Td right>{l.debit ? formatMoney(l.debit) : ''}</Td>
                  <Td right>{l.credit ? formatMoney(l.credit) : ''}</Td>
                  <Td right>{formatBalance(l.balance)}</Td>
                </tr>
              ))}
              {s.lines.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-slate-500">No transactions in this period.</td></tr>}
              <tr className="border-t-2 border-slate-400 font-semibold">
                <Td className="whitespace-nowrap">{formatDate(s.to)}</Td><Td /><Td>Closing balance</Td><Td /><Td />
                <Td right>{formatBalance(s.closingBalance)}</Td>
              </tr>
            </tbody>
          </table>

          <section className="mt-6 break-inside-avoid">
            <p className="mb-1 font-semibold">Closing balance by age (days past due date, as at {formatDate(s.to)})</p>
            <table className="w-full">
              <thead><tr>{buckets.map((b) => <Th key={b} right>{b}</Th>)}<Th right>Unapplied credit</Th></tr></thead>
              <tbody>
                <tr>
                  {buckets.map((b) => <Td key={b} right>{formatMoney(s.ageing[b])}</Td>)}
                  <Td right>{s.unapplied > 0 ? `${formatMoney(s.unapplied)} Cr` : formatMoney(0)}</Td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              Payments are shown at the amount received in the bank; tax deducted at source is shown separately.
              Please quote the invoice numbers with your payment.
            </p>
          </section>
        </article>
      )}
    </>
  );
}

export default function StatementPage({ searchParams }: PageProps<'/statement'>) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold print:hidden">Statement of account</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <StatementView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
