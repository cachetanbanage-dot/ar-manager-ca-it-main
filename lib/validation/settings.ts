// Settings form checks (R12, R17): text from the form to numbers, then the
// accounting checks in lib/ar/settings.ts (whole numbers, no overlapping buckets).
import { hasProblems, settingsProblems, type ArSettings } from '@/lib/ar/settings';
import type { FieldErrors, FormResult } from './common';

/** What the settings form shows after a save attempt. */
export interface SettingsFormState { errors: FieldErrors; message?: string; success?: string; attempt: number }

/** A whole number typed as text, e.g. "60"; anything else (blank, "30.5", "abc") gives NaN, which the checks refuse. */
export const wholeNumber = (text: string): number => (/^\s*\d+\s*$/.test(text) ? Number(text) : NaN);

/** Field names: dsoDays, and limit_0, limit_1 … for each overdue bucket's last day. */
export function checkSettings(dsoDaysText: string, limitTexts: string[]): FormResult<ArSettings> {
  const dsoDays = wholeNumber(dsoDaysText);
  const bucketLimits = limitTexts.map(wholeNumber);
  const p = settingsProblems(dsoDays, bucketLimits);
  if (!hasProblems(p)) return { ok: true, data: { dsoDays, bucketLimits } };

  const errors: FieldErrors = {};
  if (p.dsoDays) errors.dsoDays = [p.dsoDays];
  if (p.buckets) errors.buckets = [p.buckets];
  for (const [i, message] of Object.entries(p.limits)) errors[`limit_${i}`] = [message];
  return { ok: false, errors };
}
