'use client';
// Settings for ageing buckets (R12) and DSO (R17). Only each bucket's last day is
// typed; its first day is always the previous bucket's last day + 1, so buckets
// cannot overlap or leave gaps. The same checks run here as you type and again on
// the server when saving (lib/ar/settings.ts).
import { useActionState, useState } from 'react';
import { DEFAULT_SETTINGS, MAX_LIMITS, MAX_LIMIT_DAYS, bucketLabels, type ArSettings } from '@/lib/ar/settings';
import { checkSettings, wholeNumber, type SettingsFormState } from '@/lib/validation/settings';

type Action = (prev: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

export function SettingsForm({ saved, save, reset }: { saved: ArSettings; save: Action; reset: Action }) {
  const [saveState, saveAction, saving] = useActionState(save, { errors: {}, attempt: 0 });
  const [resetState, resetAction, resetting] = useActionState(reset, { errors: {}, attempt: 0 });
  const [dsoDays, setDsoDays] = useState(String(saved.dsoDays));
  const [limits, setLimits] = useState(saved.bucketLimits.map(String));

  // When the saved settings change (after Save or Reset), show them, keeping the message on screen
  const [shown, setShown] = useState(saved);
  if (JSON.stringify(shown) !== JSON.stringify(saved)) {
    setShown(saved);
    setDsoDays(String(saved.dsoDays));
    setLimits(saved.bucketLimits.map(String));
  }

  const check = checkSettings(dsoDays, limits);
  const errors = check.ok ? {} : check.errors;
  const err = (k: string) => errors[k]?.map((e) => <p key={e} className="text-xs text-red-700">{e}</p>);
  const setLimit = (i: number, v: string) => setLimits(limits.map((x, j) => (j === i ? v : x)));
  const lastValid = limits.map(wholeNumber).filter((n) => !Number.isNaN(n)).at(-1) ?? 0;
  const message = resetState.attempt > saveState.attempt ? resetState : saveState;

  return (
    <div className="max-w-3xl space-y-8">
      {message.message && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{message.message}</p>}
      {message.success && <p role="status" className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">{message.success}</p>}

      <form action={saveAction} noValidate className="space-y-8">
        <section>
          <h2 className="mb-1 text-lg font-semibold">DSO period (R17)</h2>
          <p className="mb-2 text-sm text-slate-600">
            DSO = outstanding ÷ sales of the last <em>N</em> days × <em>N</em>. The brief uses 90.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">N =</span>
            <input name="dsoDays" inputMode="numeric" value={dsoDays} onChange={(e) => setDsoDays(e.target.value)}
              className={`w-24 rounded border px-2 py-1 text-right ${errors.dsoDays ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} />
            <span>days</span>
          </label>
          {err('dsoDays')}
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold">Ageing buckets (R12)</h2>
          <p className="mb-2 text-sm text-slate-600">
            Days past the due date. Type the last day of each bucket; it starts the day after the previous one ends,
            so buckets can never overlap. &ldquo;Not due&rdquo; and the last &ldquo;Over&rdquo; bucket are always there.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-1 font-medium">Bucket</th><th className="font-medium">From day</th><th className="font-medium">To day</th><th />
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 text-slate-500">
                <td className="py-2">1 · Not due</td><td>—</td><td>0 or fewer (fixed)</td><td />
              </tr>
              {limits.map((to, i) => {
                const prev = i === 0 ? 0 : wholeNumber(limits[i - 1]);
                return (
                  <tr key={i} className="border-b border-slate-100 align-top">
                    <td className="py-2">{i + 2}</td>
                    <td className="py-2 tabular-nums">{Number.isNaN(prev) ? '—' : prev + 1}</td>
                    <td className="py-1">
                      <input name={`limit_${i}`} inputMode="numeric" value={to} onChange={(e) => setLimit(i, e.target.value)}
                        aria-label={`Last day of bucket ${i + 2}`}
                        className={`w-24 rounded border px-2 py-1 text-right ${errors[`limit_${i}`] ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} />
                      {err(`limit_${i}`)}
                    </td>
                    <td className="py-1 text-right">
                      <button type="button" disabled={limits.length <= 1} onClick={() => setLimits(limits.filter((_, j) => j !== i))}
                        className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100 disabled:opacity-40">Remove</button>
                    </td>
                  </tr>
                );
              })}
              <tr className="text-slate-500">
                <td className="py-2">{limits.length + 2} · Over</td>
                <td className="tabular-nums">{Number.isNaN(wholeNumber(limits.at(-1) ?? '')) ? '—' : wholeNumber(limits.at(-1)!) + 1}</td>
                <td>no upper limit (fixed)</td><td />
              </tr>
            </tbody>
          </table>
          {err('buckets')}
          <button type="button" disabled={limits.length >= MAX_LIMITS}
            onClick={() => setLimits([...limits, String(Math.min(lastValid + 30, MAX_LIMIT_DAYS))])}
            className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-40">
            Add bucket
          </button>
          <p className="mt-3 text-sm">
            <span className="font-medium">Columns: </span>
            {check.ok ? bucketLabels(check.data).join(' · ') : <span className="text-red-700">fix the problems above to see them</span>}
          </p>
        </section>

        <div className="flex gap-3">
          <button disabled={saving} className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>

      <form action={resetAction} className="border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm text-slate-600">
          Standard: DSO over {DEFAULT_SETTINGS.dsoDays} days; buckets {bucketLabels(DEFAULT_SETTINGS).join(' · ')}.
        </p>
        <button disabled={resetting} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50">
          {resetting ? 'Resetting…' : 'Reset to standard'}
        </button>
      </form>
    </div>
  );
}
