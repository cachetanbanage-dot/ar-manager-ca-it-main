import 'server-only';
import { connection } from 'next/server';
import { asofParam, parseAsOf } from './asof';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * R10: the as-at date for a page, read at request time (today in India when
 * ?asof= is missing). Also returns the URL value to keep on links (undefined
 * when there is none, so links keep defaulting to today) and all the params.
 */
export async function readAsOf(searchParams: SearchParams) {
  const params = await searchParams;
  await connection(); // "today" must be worked out per request, never when Next.js prebuilds the page
  return { asof: parseAsOf(params.asof), keepAsof: asofParam(params.asof), params };
}
