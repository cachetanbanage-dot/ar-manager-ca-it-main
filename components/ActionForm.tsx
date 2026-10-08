'use client';
// A small form for one action (a button, or a field and a button). The server
// action does the checking; this shows its result or error in plain language.
import { useActionState } from 'react';
import type { ActionState } from '@/lib/validation/common';

export function ActionForm({ action, children, submitLabel, danger, className = '' }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  danger?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { attempt: 0 });
  return (
    <form action={formAction} className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button
          disabled={pending}
          className={`rounded px-3 py-1.5 text-sm disabled:opacity-50 ${
            danger ? 'border border-red-300 bg-white text-red-700 hover:bg-red-50' : 'border border-slate-300 bg-white hover:bg-slate-100'
          }`}
        >
          {pending ? 'Working…' : submitLabel}
        </button>
      </div>
      {state.error && <p role="alert" className="mt-1 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mt-1 text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
