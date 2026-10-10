// User settings for ageing buckets (R12) and DSO (R17). The standard buckets are
// the client's (changed from the brief's 30/60/90/180 at their request); the DSO
// period is the brief's 90 days. Anyone without saved settings sees these.
//
// Buckets are described by their upper limits only. "Not due" (0 days or fewer)
// is always first and "Over N" always last; each bucket starts the day after the
// previous one ends. So buckets can never overlap or leave a gap, as long as each
// limit is bigger than the one before — which settingsProblems checks.

export interface ArSettings {
  dsoDays: number; // R17: the DSO period in days
  bucketLimits: number[]; // R12: the last day of each overdue bucket, increasing, e.g. [15, 30, 45, 90]
}

export const DEFAULT_SETTINGS: ArSettings = { dsoDays: 90, bucketLimits: [15, 30, 45, 90] };

export const MAX_BUCKETS = 10; // in total, including "Not due" and "Over N"
export const MAX_LIMITS = MAX_BUCKETS - 2;
export const MAX_LIMIT_DAYS = 3650;
export const MIN_DSO_DAYS = 1;
export const MAX_DSO_DAYS = 365;

/** The column headings, e.g. [30, 60] → ['Not due', '1-30', '31-60', 'Over 60']. */
export function bucketLabels(s: ArSettings): string[] {
  const labels = ['Not due'];
  let from = 1;
  for (const to of s.bucketLimits) {
    labels.push(`${from}-${to}`);
    from = to + 1;
  }
  labels.push(`Over ${s.bucketLimits.at(-1)}`);
  return labels;
}

/** R12: the bucket for a number of days past due. */
export function bucketForDays(daysPastDue: number, s: ArSettings): string {
  const labels = bucketLabels(s);
  if (daysPastDue <= 0) return labels[0];
  const i = s.bucketLimits.findIndex((to) => daysPastDue <= to);
  return i === -1 ? labels.at(-1)! : labels[i + 1];
}

export interface SettingsProblems { dsoDays?: string; limits: Record<number, string>; buckets?: string }

const isWhole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/**
 * Everything wrong with proposed settings, in plain language (none = they can be saved).
 * Limits must be whole numbers from 1 to MAX_LIMIT_DAYS, each bigger than the one
 * before: that is what keeps two buckets from overlapping.
 */
export function settingsProblems(dsoDays: unknown, bucketLimits: unknown[]): SettingsProblems {
  const p: SettingsProblems = { limits: {} };
  if (!isWhole(dsoDays) || dsoDays < MIN_DSO_DAYS || dsoDays > MAX_DSO_DAYS) {
    p.dsoDays = `DSO days must be a whole number from ${MIN_DSO_DAYS} to ${MAX_DSO_DAYS}.`;
  }
  if (bucketLimits.length < 1) p.buckets = 'Keep at least one overdue bucket.';
  if (bucketLimits.length > MAX_LIMITS) p.buckets = `At most ${MAX_BUCKETS} buckets in total (including Not due and the last "Over" bucket).`;

  let previous: number | null = null;
  bucketLimits.forEach((to, i) => {
    const n = i + 2; // bucket 1 is "Not due"
    if (!isWhole(to) || to < 1 || to > MAX_LIMIT_DAYS) {
      p.limits[i] = `Bucket ${n} must end on a whole number of days from 1 to ${MAX_LIMIT_DAYS}.`;
      previous = null;
      return;
    }
    if (previous !== null && to <= previous) {
      p.limits[i] = `Bucket ${n} (up to ${to} days) must end after bucket ${n - 1} (up to ${previous} days), or the two would overlap.`;
    }
    previous = to;
  });
  return p;
}

export function hasProblems(p: SettingsProblems): boolean {
  return Boolean(p.dsoDays || p.buckets || Object.keys(p.limits).length > 0);
}

/** Settings read back from storage. Anything missing, damaged or invalid gives the standard settings. */
export function parseSettings(stored: string | undefined | null): ArSettings {
  if (!stored) return DEFAULT_SETTINGS;
  try {
    const raw = JSON.parse(stored) as { dsoDays?: unknown; bucketLimits?: unknown };
    const limits = Array.isArray(raw.bucketLimits) ? raw.bucketLimits : [];
    if (!Array.isArray(raw.bucketLimits) || hasProblems(settingsProblems(raw.dsoDays, limits))) return DEFAULT_SETTINGS;
    return { dsoDays: raw.dsoDays as number, bucketLimits: limits as number[] };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function isDefaultSettings(s: ArSettings): boolean {
  return s.dsoDays === DEFAULT_SETTINGS.dsoDays &&
    s.bucketLimits.length === DEFAULT_SETTINGS.bucketLimits.length &&
    s.bucketLimits.every((v, i) => v === DEFAULT_SETTINGS.bucketLimits[i]);
}
