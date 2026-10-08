// Raise a credit note against an invoice (R7), from the invoice page.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CreditNoteForm } from '@/components/CreditNoteForm';
import { createCreditNote } from '@/lib/actions/invoices';
import { invoiceRemaining } from '@/lib/ar/invoices';
import { loadArData } from '@/lib/ar/load';
import { hrefWithAsOf, todayInIndia } from '@/lib/asof';
import { readAsOf } from '@/lib/asof-server';
import { formatDate, formatMoney } from '@/lib/format';

type Props = PageProps<'/invoices/[id]/credit-note'>;

async function NewCreditNote({ params, searchParams }: Props) {
  const [{ id }, { keepAsof }] = await Promise.all([params, readAsOf(searchParams)]);
  const data = await loadArData();
  const invoice = data.invoices.find((i) => i.id === Number(id));
  if (!invoice) notFound();
  const customer = data.customers.find((c) => c.id === invoice.customerId)!;
  const back = hrefWithAsOf(`/invoices/${invoice.id}`, keepAsof);
  const remaining = invoiceRemaining(data, invoice.id);
  const today = todayInIndia();

  return (
    <>
      <p className="text-sm text-slate-500"><Link href={back} className="hover:underline">{invoice.invoiceNo}</Link> / Credit note</p>
      <h1 className="mb-1 text-2xl font-semibold">Raise credit note</h1>
      <p className="mb-6 text-sm text-slate-600">
        Against {invoice.invoiceNo} dated {formatDate(invoice.invoiceDate)} · {customer.name} · total {formatMoney(invoice.total)} · still open {formatMoney(remaining)}
      </p>
      {invoice.isCancelled || remaining <= 0 ? (
        <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
          {invoice.isCancelled ? 'This invoice is cancelled.' : 'Nothing is left open on this invoice.'} No credit note can be raised.{' '}
          <Link href={back} className="text-blue-700 hover:underline">Back to the invoice</Link>
        </p>
      ) : (
        <CreditNoteForm
          action={createCreditNote.bind(null, invoice.id)}
          data={data}
          invoice={invoice}
          initial={{ creditNoteDate: today < invoice.invoiceDate ? invoice.invoiceDate : today, taxableValue: '', reason: '' }}
          asof={keepAsof}
          cancelHref={back}
        />
      )}
    </>
  );
}

export default function CreditNotePage(props: Props) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewCreditNote {...props} />
    </Suspense>
  );
}
