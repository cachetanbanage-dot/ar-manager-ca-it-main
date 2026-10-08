// Add a note (Part 2, action 4), from the customer page or the invoice page.
import { Suspense } from 'react';
import { NoteForm } from '@/components/NoteForm';
import { createNote } from '@/lib/actions/notes';
import { loadArData } from '@/lib/ar/load';
import { hrefWithAsOf, todayInIndia } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { sortRows } from '@/lib/sort';

async function NewNote({ searchParams }: { searchParams: PageProps<'/notes/new'>['searchParams'] }) {
  const { keepAsof, params } = await readAsOf(searchParams);
  const data = await loadArData();
  const invoice = data.invoices.find((i) => String(i.id) === params.invoice);
  const customer = data.customers.find((c) => c.id === invoice?.customerId) ?? data.customers.find((c) => String(c.id) === params.customer);
  const back = invoice ? 'invoice' : 'customer';
  const cancelHref = hrefWithAsOf(invoice ? `/invoices/${invoice.id}` : customer ? `/customers/${customer.id}` : '/', keepAsof);

  return (
    <NoteForm
      action={createNote}
      customers={sortRows(data.customers, (c) => c.code, 'asc')}
      invoices={sortRows(data.invoices, (i) => i.invoiceNo, 'asc')}
      initial={{
        customerId: customer ? String(customer.id) : '', invoiceId: invoice ? String(invoice.id) : '', noteDate: todayInIndia(),
        noteType: 'Call', body: '', followUpDate: '', promiseDate: '', promiseAmount: '',
      }}
      asof={keepAsof}
      back={back}
      cancelHref={cancelHref}
    />
  );
}

export default function NewNotePage({ searchParams }: PageProps<'/notes/new'>) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Add a note</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewNote searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
