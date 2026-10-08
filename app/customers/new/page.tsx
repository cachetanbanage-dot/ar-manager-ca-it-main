// Add a customer (Part 2).
import { Suspense } from 'react';
import { CustomerForm } from '@/components/CustomerForm';
import { saveCustomer } from '@/lib/actions/customers';
import { asofParam, hrefWithAsOf } from '@/lib/asof';

const BLANK = {
  code: '', name: '', city: '', state: '', contactPerson: '', email: '', phone: '', gstin: '',
  creditDays: '30', creditLimit: '', tdsRatePct: '10',
};

async function NewCustomer({ searchParams }: { searchParams: PageProps<'/customers/new'>['searchParams'] }) {
  const asof = asofParam((await searchParams).asof);
  return (
    <CustomerForm
      action={saveCustomer.bind(null, null)}
      initial={BLANK}
      asof={asof}
      submitLabel="Add customer"
      cancelHref={hrefWithAsOf('/customers', asof)}
    />
  );
}

export default function NewCustomerPage({ searchParams }: PageProps<'/customers/new'>) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Add customer</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewCustomer searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
