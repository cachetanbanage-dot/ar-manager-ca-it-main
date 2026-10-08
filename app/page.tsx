// Temporary home page (Part 5, steps 2 and 5): proves the connection, the
// loader and the as-at date work. Replaced by "Overdue at a glance" in step 8.
import { Suspense } from 'react';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { formatDate } from '@/lib/format';

async function CustomerList({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const asof = parseAsOf((await searchParams).asof);
  const data = await loadArData();
  const customers = [...data.customers].sort((a, b) => (a.code < b.code ? -1 : 1));

  return (
    <>
      <p className="mb-4 text-sm text-slate-600">
        As at {formatDate(asof)} · {customers.length} customers
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Code</th>
            <th className="py-2">Name</th>
            <th className="py-2">City</th>
            <th className="py-2">State</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-2">{c.code}</td>
              <td className="py-2">{c.name}</td>
              <td className="py-2">{c.city}</td>
              <td className="py-2">{c.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Overdue at a glance</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
