// Temporary home page (Part 5, step 2): proves the database connection works
// by listing the customers. Replaced by "Overdue at a glance" in step 8.
import { Suspense } from 'react';
import { connection } from 'next/server';
import { db } from '@/lib/db';

async function CustomerList() {
  await connection(); // read fresh data on every request, never at build time
  const { data, error } = await db
    .from('customers')
    .select('code, name, city, state')
    .order('code');

  if (error) return <p className="text-red-600">Could not load customers: {error.message}</p>;

  return (
    <>
      <p className="mb-4 text-sm text-zinc-600">{data.length} customers</p>
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
          {data.map((c) => (
            <tr key={c.code} className="border-b">
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

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">AR Manager</h1>
      <Suspense fallback={<p>Loading customers…</p>}>
        <CustomerList />
      </Suspense>
    </main>
  );
}
