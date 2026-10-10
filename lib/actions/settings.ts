'use server';
// Save or reset the user's settings (ageing buckets and DSO days).
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { SETTINGS_COOKIE, SETTINGS_COOKIE_MAX_AGE } from '@/lib/settings-server';
import { checkSettings, type SettingsFormState } from '@/lib/validation/settings';

export async function saveSettings(prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const limits = [...formData.keys()]
    .filter((k) => k.startsWith('limit_'))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))
    .map((k) => String(formData.get(k) ?? ''));
  const checked = checkSettings(String(formData.get('dsoDays') ?? ''), limits);
  if (!checked.ok) return { errors: checked.errors, message: 'Nothing was saved. Please correct the problems shown in red.', attempt: prev.attempt + 1 };

  (await cookies()).set(SETTINGS_COOKIE, JSON.stringify(checked.data), {
    path: '/', maxAge: SETTINGS_COOKIE_MAX_AGE, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  });
  revalidatePath('/', 'layout');
  return { errors: {}, success: 'Settings saved. Every screen and export now uses them in this browser.', attempt: prev.attempt + 1 };
}

/** Back to the standard: DSO over 90 days and the six standard buckets. */
export async function resetSettings(prev: SettingsFormState): Promise<SettingsFormState> {
  (await cookies()).delete(SETTINGS_COOKIE);
  revalidatePath('/', 'layout');
  return { errors: {}, success: 'Back to the standard settings: DSO over 90 days and the six standard buckets.', attempt: prev.attempt + 1 };
}
