// Create an invoice (Part 2): choose an active customer, then date, description,
// taxable value and GST rate, with a preview before saving.
import { Suspense } from 'react';
import { InvoiceForm } from '@/components/InvoiceForm';
import { createInvoice } from '@/lib/actions/invoices';
import { DEFAULT_GST_RATE_PCT } from '@/lib/ar/gst';
import { loadArData } from '@/lib/ar/load';
import { hrefWithAsOf, todayInIndia } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { sortRows } from '@/lib/sort';

async function NewInvoice({ searchParams }: { searchParams: PageProps<'/invoices/new'>['searchParams'] }) {
  const { keepAsof, params } = await readAsOf(searchParams);
  const data = await loadArData();
  const active = sortRows(data.customers.filter((c) => c.isActive), (c) => c.code, 'asc'); // R9
  const preselected = active.find((c) => String(c.id) === params.customer);

  return (
    <InvoiceForm
      action={createInvoice}
      data={data}
      customers={active}
      initial={{
        customerId: preselected ? String(preselected.id) : '', invoiceDate: todayInIndia(),
        description: '', taxableValue: '', gstRatePct: String(DEFAULT_GST_RATE_PCT),
      }}
      asof={keepAsof}
      cancelHref={hrefWithAsOf(preselected ? `/customers/${preselected.id}` : '/invoices', keepAsof)}
    />
  );
}

export default function NewInvoicePage({ searchParams }: PageProps<'/invoices/new'>) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">New invoice</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewInvoice searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
