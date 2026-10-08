'use client';
// The add / edit customer form. The server action does all the checking
// (lib/validation/customer.ts); this form only shows the fields and any errors.
import Link from 'next/link';
import { useActionState } from 'react';
import type { CustomerFormState } from '@/lib/validation/customer';
import { INDIAN_STATES } from '@/lib/states';

type Action = (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;

export function CustomerForm({ action, initial, asof, submitLabel, cancelHref }: {
  action: Action; initial: Record<string, string>; asof?: string; submitLabel: string; cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, { values: initial, errors: {}, attempt: 0 });
  const v = state.values;

  const field = (name: string, label: string, opts: { type?: string; hint?: string; required?: boolean; inputMode?: 'numeric' | 'decimal' } = {}) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}{opts.required !== false && <span className="text-red-600"> *</span>}</span>
      <input
        name={name}
        type={opts.type ?? 'text'}
        inputMode={opts.inputMode}
        defaultValue={v[name] ?? ''}
        aria-invalid={!!state.errors[name]}
        className={`rounded border px-2 py-1.5 ${state.errors[name] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
      />
      {opts.hint && !state.errors[name] && <span className="text-xs text-slate-500">{opts.hint}</span>}
      {state.errors[name]?.map((e) => <span key={e} className="text-xs text-red-700">{e}</span>)}
    </label>
  );

  return (
    // key: show the values returned by the server after every attempt
    <form key={state.attempt} action={formAction} noValidate className="max-w-3xl">
      {asof && <input type="hidden" name="asof" value={asof} />}
      {state.message && (
        <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {field('code', 'Code', { hint: 'Unique, e.g. C009' })}
        {field('name', 'Name')}
        {field('contactPerson', 'Contact person')}
        {field('email', 'Email', { type: 'email' })}
        {field('phone', 'Phone', { required: false })}
        {field('gstin', 'GSTIN', { required: false, hint: 'Optional; 15 characters' })}
        {field('city', 'City')}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">State<span className="text-red-600"> *</span></span>
          <select
            name="state"
            defaultValue={v.state ?? ''}
            className={`rounded border px-2 py-1.5 ${state.errors.state ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
          >
            <option value="">Choose a state…</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {!state.errors.state && <span className="text-xs text-slate-500">Maharashtra: CGST + SGST; other states: IGST</span>}
          {state.errors.state?.map((e) => <span key={e} className="text-xs text-red-700">{e}</span>)}
        </label>
        {field('creditDays', 'Credit days', {
          inputMode: 'numeric', hint: 'Changing this does not change the due dates of existing invoices',
        })}
        {field('creditLimit', 'Credit limit (₹)', { inputMode: 'decimal', hint: 'e.g. 500000 or 5,00,000' })}
        {field('tdsRatePct', 'TDS rate (%)', { inputMode: 'decimal', hint: 'Pre-fills the expected TDS on receipts; 0 to 100' })}
      </div>

      <div className="mt-6 flex gap-3">
        <button disabled={pending} className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href={cancelHref} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">Cancel</Link>
      </div>
    </form>
  );
}
