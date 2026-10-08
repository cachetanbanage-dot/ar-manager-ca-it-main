// Settings: DSO period and ageing buckets, remembered in this browser.
import { Suspense } from 'react';
import { SettingsForm } from '@/components/SettingsForm';
import { resetSettings, saveSettings } from '@/lib/actions/settings';
import { readAsOf } from '@/lib/asof-server';

async function Settings({ searchParams }: { searchParams: PageProps<'/settings'>['searchParams'] }) {
  const { settings } = await readAsOf(searchParams);
  return <SettingsForm saved={settings} save={saveSettings} reset={resetSettings} />;
}

export default function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-slate-600">
        Saved in this browser only. Anyone else, on another browser or device, sees the standard settings from the brief.
      </p>
      <Suspense fallback={<p>Loading…</p>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
