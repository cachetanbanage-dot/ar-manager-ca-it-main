// Record a payment (Part 2, action 1).
import { Suspense } from 'react';
import { ReceiptForm } from '@/components/ReceiptForm';
import { recordPayment } from '@/lib/actions/receipts';
import { loadArData } from '@/lib/ar/load';
import { nextNumber } from '@/lib/ar/numbering';
import { hrefWithAsOf, todayInIndia } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { sortRows } from '@/lib/sort';

async function NewReceipt({ searchParams }: { searchParams: PageProps<'/receipts/new'>['searchParams'] }) {
  const { keepAsof, params } = await readAsOf(searchParams);
  const data = await loadArData();
  const customers = sortRows(data.customers, (c) => c.code, 'asc');
  const preselected = customers.find((c) => String(c.id) === params.customer);
  const today = todayInIndia();

  return (
    <>
      <p className="mb-4 text-sm text-slate-600">Next receipt number: {nextNumber('receipt', data, today)} (worked out again when saving)</p>
      <ReceiptForm
        action={recordPayment}
        data={data}
        customers={customers}
        initial={{ customerId: preselected ? String(preselected.id) : '', receiptDate: today, bankAmount: '', tdsAmount: '', mode: 'NEFT', reference: '' }}
        asof={keepAsof}
        cancelHref={hrefWithAsOf(preselected ? `/customers/${preselected.id}` : '/', keepAsof)}
      />
    </>
  );
}

export default function NewReceiptPage({ searchParams }: PageProps<'/receipts/new'>) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Record a payment</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewReceipt searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
