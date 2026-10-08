// Overdue at a glance (Part 2), the home screen: summary figures, ageing by
// customer, overdue invoices and what needs attention, all as at D.
import Link from 'next/link';
import { Suspense } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { Label, SectionTitle, Td, Th } from '@/components/ui';
import { markFollowUpDone } from '@/lib/actions/notes';
import { loadArData } from '@/lib/ar/load';
import { BUCKETS } from '@/lib/ar/positions';
import { hrefWithAsOf } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { formatBalance, formatDate, formatMoney } from '@/lib/format';
import { dashboard } from '@/lib/lists/dashboard';
import { buildHref } from '@/lib/url';

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'red' | 'blue' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'blue' ? 'text-blue-800' : 'text-slate-900';
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function Attention({ title, empty, children, count }: { title: string; empty: string; children: React.ReactNode; count: number }) {
  return (
    <div className="rounded border border-slate-200 p-3 text-sm">
      <h3 className="mb-2 font-semibold">{title} <span className="font-normal text-slate-500">({count})</span></h3>
      {count === 0 ? <p className="text-slate-500">{empty}</p> : <ul className="space-y-1">{children}</ul>}
    </div>
  );
}

async function Overview({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const { asof, keepAsof } = await readAsOf(searchParams);
  const d = dashboard(await loadArData(), asof);
  const s = d.summary;
  const link = (href: string) => hrefWithAsOf(href, keepAsof);
  const invoicesFor = (customer?: number, bucket?: string) => buildHref('/invoices', { customer, bucket, asof: keepAsof });

  return (
    <>
      <p className="mb-4 text-sm text-slate-600">As at {formatDate(asof)}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Figure label="Outstanding on invoices" value={formatMoney(s.outstanding)} />
        <Figure label="Unapplied credit" value={formatMoney(s.unapplied)} tone="blue" />
        <Figure label="Net receivable" value={formatBalance(s.netReceivable)} />
        <Figure label="Overdue" value={formatMoney(s.overdue)} tone="red" note={s.overduePct === null ? undefined : `${s.overduePct}% of outstanding`} />
        <Figure label="DSO" value={s.dso === null ? '—' : `${s.dso} days`} note="last 90 days' sales" />
        <Figure label="Overdue invoices" value={String(s.overdueCount)} tone={s.overdueCount > 0 ? 'red' : undefined} />
      </div>

      <SectionTitle>Ageing by customer</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Customer</Th>
              {BUCKETS.map((b) => <Th key={b} right>{b}</Th>)}
              <Th right>Outstanding</Th><Th right>Unapplied credit</Th><Th right>Net balance</Th>
            </tr>
          </thead>
          <tbody>
            {d.ageing.map((p) => (
              <tr key={p.customer.id} className="border-b border-slate-100 hover:bg-slate-50">
                <Td><Link href={invoicesFor(p.customer.id)} className="text-blue-700 hover:underline">{p.customer.code} · {p.customer.name}</Link></Td>
                {BUCKETS.map((b) => (
                  <Td key={b} right className={b !== 'Not due' && p.buckets[b] > 0 ? 'text-red-700' : ''}>
                    {p.buckets[b] === 0 ? <span className="text-slate-300">—</span>
                      : <Link href={invoicesFor(p.customer.id, b)} className="hover:underline">{formatMoney(p.buckets[b])}</Link>}
                  </Td>
                ))}
                <Td right>{formatMoney(p.outstanding)}</Td>
                <Td right className={p.unapplied > 0 ? 'text-blue-800' : ''}>{formatMoney(p.unapplied)}</Td>
                <Td right className="font-medium">{formatBalance(p.netBalance)}</Td>
              </tr>
            ))}
            {d.ageing.length === 0 && <tr><td colSpan={10} className="py-4 text-center text-slate-500">Nothing outstanding.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-400 font-semibold">
              <Td>Total</Td>
              {BUCKETS.map((b) => (
                <Td key={b} right>
                  <Link href={invoicesFor(undefined, b)} className="hover:underline">{formatMoney(d.ageingTotals.buckets[b])}</Link>
                </Td>
              ))}
              <Td right>{formatMoney(d.ageingTotals.outstanding)}</Td>
              <Td right>{formatMoney(d.ageingTotals.unapplied)}</Td>
              <Td right>{formatBalance(d.ageingTotals.netBalance)}</Td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">Buckets are days past the due date. Unapplied credit is shown on its own and not set off against any bucket.</p>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Overdue invoices</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Number</Th><Th>Customer</Th><Th>Due date</Th><Th right>Days late</Th><Th>Bucket</Th><Th right>Outstanding</Th></tr></thead>
              <tbody>
                {d.overdueInvoices.map((p) => (
                  <tr key={p.invoice.id} className="border-b border-red-100 bg-red-50 text-red-900">
                    <Td>
                      <Link href={link(`/invoices/${p.invoice.id}`)} className="font-medium hover:underline">{p.invoice.invoiceNo}</Link>
                      {p.invoice.isDisputed && <Label tone="amber">disputed</Label>}
                      {p.isPartPaid && <Label tone="blue">part-paid</Label>}
                    </Td>
                    <Td><Link href={link(`/customers/${p.customer.id}`)} className="hover:underline">{p.customer.name}</Link></Td>
                    <Td>{formatDate(p.invoice.dueDate)}</Td>
                    <Td right>{p.daysPastDue}</Td>
                    <Td>{p.bucket}</Td>
                    <Td right>{formatMoney(p.outstanding)}</Td>
                  </tr>
                ))}
                {d.overdueInvoices.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-500">No overdue invoices.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Needs attention</h2>
          <div className="grid gap-3">
            <Attention title="Over credit limit" empty="No customer is over its limit." count={d.overLimit.length}>
              {d.overLimit.map((p) => (
                <li key={p.customer.id}>
                  <Link href={link(`/customers/${p.customer.id}`)} className="text-blue-700 hover:underline">{p.customer.name}</Link>
                  {' '}{formatBalance(p.netBalance)} against {formatMoney(p.customer.creditLimit)}
                </li>
              ))}
            </Attention>
            <Attention title="Broken promises" empty="No broken promises." count={d.brokenPromises.length}>
              {d.brokenPromises.map((p) => (
                <li key={p.note.id}>
                  <Link href={link(`/customers/${p.customer.id}`)} className="text-blue-700 hover:underline">{p.customer.name}</Link>
                  {' '}promised {formatMoney(p.promiseAmount)} by {formatDate(p.promiseDate)}; received {formatMoney(p.received)}
                </li>
              ))}
            </Attention>
            <Attention title="Follow-ups due" empty="No follow-ups due." count={d.followUps.length}>
              {d.followUps.map((f) => (
                <li key={f.note.id}>
                  <span className="text-slate-500">{formatDate(f.note.followUpDate)}</span>{' '}
                  <Link href={link(`/customers/${f.customer.id}`)} className="text-blue-700 hover:underline">{f.customer.name}</Link>
                  {' '}— {f.note.body}
                  <ActionForm action={markFollowUpDone.bind(null, f.note.id)} submitLabel="Mark done" className="mt-1" />
                </li>
              ))}
            </Attention>
            <Attention title="Unapplied credit to allocate" empty="No unapplied credit." count={d.unappliedCredit.length}>
              {d.unappliedCredit.map((p) => (
                <li key={p.customer.id}>
                  <Link href={link(`/customers/${p.customer.id}`)} className="text-blue-700 hover:underline">{p.customer.name}</Link>
                  {' '}{formatMoney(p.unapplied)}
                </li>
              ))}
            </Attention>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Overdue at a glance</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
