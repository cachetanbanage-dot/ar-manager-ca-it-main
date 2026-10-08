import 'server-only';
import { cookies } from 'next/headers';
import { parseSettings, type ArSettings } from '@/lib/ar/settings';

/**
 * Settings are remembered in a cookie in the user's browser: the database schema
 * is fixed, so there is no table to keep them in. Without the cookie (another
 * browser, or a reviewer), the brief's defaults apply.
 */
export const SETTINGS_COOKIE = 'ar-settings';
export const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year, in seconds

/** The settings for this request. A missing, damaged or invalid cookie gives the brief's defaults. */
export async function readSettings(): Promise<ArSettings> {
  return parseSettings((await cookies()).get(SETTINGS_COOKIE)?.value);
}
