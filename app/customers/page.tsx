// Customer Master list (Part 2): balances and overdue as at D, search, filter, sort.
import Link from 'next/link';
import { Suspense } from 'react';
import { ButtonLink, SortTh, StatusBadge, Td } from '@/components/ui';
import { loadArData } from '@/lib/ar/load';
import { asofParam, hrefWithAsOf } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { formatBalance, formatDate, formatMoney, formatPct } from '@/lib/format';
import { customerListOptions, customerListRows } from '@/lib/lists/customers';
import { buildHref } from '@/lib/url';

async function CustomerList({ searchParams }: { searchParams: PageProps<'/customers'>['searchParams'] }) {
  const { asof, keepAsof, params } = await readAsOf(searchParams);
  const opts = customerListOptions(params);
  const rows = customerListRows(await loadArData(), asof, opts);

  const sortHref = (sort: string, dir: 'asc' | 'desc') =>
    buildHref('/customers', { q: opts.q, status: opts.status === 'all' ? '' : opts.status, sort, dir, asof: keepAsof });
  const sortTh = (label: string, key: string, right?: boolean) => (
    <SortTh label={label} sortKey={key} current={opts.sort} dir={opts.dir} href={sortHref} right={right} />
  );

  return (
    <>
      <form action="/customers" className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          <span className="text-slate-600">Search code, name, contact or email</span>
          <input name="q" defaultValue={opts.q} className="w-72 rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="flex flex-col">
          <span className="text-slate-600">Status</span>
          <select name="status" defaultValue={opts.status} className="rounded border border-slate-300 px-2 py-1">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        {keepAsof && <input type="hidden" name="asof" value={keepAsof} />}
        <input type="hidden" name="sort" value={opts.sort} />
        <input type="hidden" name="dir" value={opts.dir} />
        <button className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700">Search</button>
        <Link href={hrefWithAsOf('/customers', keepAsof)} className="px-2 py-1 text-slate-600 hover:underline">Clear</Link>
      </form>

      <p className="mb-2 text-sm text-slate-600">
        {rows.length} customer{rows.length === 1 ? '' : 's'} · balances as at {formatDate(asof)}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {sortTh('Code', 'code')}
              {sortTh('Name', 'name')}
              {sortTh('City, state', 'city')}
              {sortTh('Contact', 'contact')}
              {sortTh('Credit days', 'creditDays', true)}
              {sortTh('Credit limit', 'creditLimit', true)}
              {sortTh('Balance', 'balance', true)}
              {sortTh('Overdue', 'overdue', true)}
              {sortTh('Limit used', 'used', true)}
              {sortTh('Status', 'status')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = hrefWithAsOf(`/customers/${r.customer.id}`, keepAsof);
              return (
                <tr key={r.customer.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <Td><Link href={href} className="font-medium text-blue-700 hover:underline">{r.customer.code}</Link></Td>
                  <Td><Link href={href} className="hover:underline">{r.customer.name}</Link></Td>
                  <Td>{r.customer.city}, {r.customer.state}</Td>
                  <Td>{r.customer.contactPerson}</Td>
                  <Td right>{r.customer.creditDays}</Td>
                  <Td right>{formatMoney(r.customer.creditLimit)}</Td>
                  <Td right>{formatBalance(r.netBalance)}</Td>
                  <Td right className={r.overdue > 0 ? 'text-red-700' : ''}>{formatMoney(r.overdue)}</Td>
                  <Td right className={r.overLimit ? 'font-semibold text-red-700' : ''}>{formatPct(r.usedPct)}</Td>
                  <Td><StatusBadge status={r.customer.isActive ? 'Active' : 'Inactive'} /></Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-slate-500">No customers match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function CustomersPage({ searchParams }: PageProps<'/customers'>) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Suspense fallback={null}>
          <AddButton searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<p>Loading customers…</p>}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AddButton({ searchParams }: { searchParams: PageProps<'/customers'>['searchParams'] }) {
  const keepAsof = asofParam((await searchParams).asof);
  return <ButtonLink primary href={hrefWithAsOf('/customers/new', keepAsof)}>Add customer</ButtonLink>;
}
