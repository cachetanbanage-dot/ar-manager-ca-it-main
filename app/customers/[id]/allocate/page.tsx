// Allocate unapplied credit from the customer page (Part 2, action 2).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AllocateForm } from '@/components/AllocateForm';
import { allocateCredit } from '@/lib/actions/receipts';
import { loadArData } from '@/lib/ar/load';
import { receiptRemaining } from '@/lib/ar/receipts';
import { hrefWithAsOf, todayInIndia } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { sortRows } from '@/lib/sort';

type Props = PageProps<'/customers/[id]/allocate'>;

async function Allocate({ params, searchParams }: Props) {
  const [{ id }, { keepAsof, params: query }] = await Promise.all([params, readAsOf(searchParams)]);
  const data = await loadArData();
  const customer = data.customers.find((c) => c.id === Number(id));
  if (!customer) notFound();
  const back = hrefWithAsOf(`/customers/${customer.id}`, keepAsof);

  // Receipts with credit left across all records, oldest first
  const receipts = sortRows(
    data.receipts.filter((r) => r.customerId === customer.id).map((receipt) => ({ receipt, remaining: receiptRemaining(data, receipt.id) })),
    (r) => `${r.receipt.receiptDate} ${r.receipt.receiptNo}`, 'asc',
  ).filter((r) => r.remaining > 0);
  const first = receipts.find((r) => String(r.receipt.id) === query.receipt) ?? receipts[0];
  const today = todayInIndia();

  return (
    <>
      <p className="text-sm text-slate-500"><Link href={back} className="hover:underline">{customer.code} · {customer.name}</Link> / Allocate</p>
      <h1 className="mb-4 text-2xl font-semibold">Allocate unapplied credit</h1>
      {!first ? (
        <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
          {customer.name} has no unapplied credit to allocate. <Link href={back} className="text-blue-700 hover:underline">Back</Link>
        </p>
      ) : (
        <AllocateForm
          action={allocateCredit}
          data={data}
          receipts={receipts}
          initial={{ receiptId: String(first.receipt.id), allocationDate: today < first.receipt.receiptDate ? first.receipt.receiptDate : today }}
          asof={keepAsof}
          cancelHref={back}
        />
      )}
    </>
  );
}

export default function AllocatePage(props: Props) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Allocate {...props} />
    </Suspense>
  );
}
