// Shown under the header whenever this browser uses settings other than the brief's,
// so nobody mistakes custom ageing or DSO figures for the standard ones.
import Link from 'next/link';
import { bucketLabels, isDefaultSettings } from '@/lib/ar/settings';
import { readSettings } from '@/lib/settings-server';

export async function SettingsNotice() {
  const s = await readSettings();
  if (isDefaultSettings(s)) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50 print:hidden">
      <p className="mx-auto max-w-7xl px-6 py-1.5 text-sm text-amber-900">
        Custom settings in use: DSO over {s.dsoDays} days · buckets {bucketLabels(s).join(', ')}.
        These differ from the brief&rsquo;s standard.{' '}
        <Link href="/settings" className="font-medium underline">Change or reset</Link>
      </p>
    </div>
  );
}
