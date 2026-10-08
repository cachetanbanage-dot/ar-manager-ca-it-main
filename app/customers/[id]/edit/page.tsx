// Edit a customer (Part 2).
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CustomerForm } from '@/components/CustomerForm';
import { saveCustomer } from '@/lib/actions/customers';
import { loadArData } from '@/lib/ar/load';
import { asofParam, hrefWithAsOf } from '@/lib/asof';
import { rupeesPlain } from '@/lib/format';

type Props = PageProps<'/customers/[id]/edit'>;

async function EditCustomer({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const asof = asofParam(query.asof);
  const c = (await loadArData()).customers.find((x) => x.id === Number(id));
  if (!c) notFound();

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Edit {c.code} · {c.name}</h1>
      <CustomerForm
        action={saveCustomer.bind(null, c.id)}
        initial={{
          code: c.code, name: c.name, city: c.city, state: c.state, contactPerson: c.contactPerson, email: c.email,
          phone: c.phone ?? '', gstin: c.gstin ?? '', creditDays: String(c.creditDays),
          creditLimit: rupeesPlain(c.creditLimit), tdsRatePct: String(c.tdsRatePct),
        }}
        asof={asof}
        submitLabel="Save changes"
        cancelHref={hrefWithAsOf(`/customers/${c.id}`, asof)}
      />
    </>
  );
}

export default function EditCustomerPage(props: Props) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EditCustomer {...props} />
    </Suspense>
  );
}
