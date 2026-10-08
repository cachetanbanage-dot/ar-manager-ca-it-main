// Statement CSV download (section 4.12).
import { loadArData } from '@/lib/ar/load';
import { statement } from '@/lib/ar/statement';
import { parseAsOf } from '@/lib/asof';
import { csvResponse, toCsv } from '@/lib/csv';
import { statementRows } from '@/lib/exports';
import { statementOptions } from '@/lib/lists/statement';
import { readSettings } from '@/lib/settings-server';

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const data = await loadArData();
  const o = statementOptions(params, data, parseAsOf(params.asof));
  if (!o.customer || o.error) return new Response(o.error ?? 'Choose a customer.', { status: 400 });
  const settings = await readSettings();
  const s = statement(data, o.customer.id, o.from, o.to, settings);
  return csvResponse(`Statement_${o.customer.code}_${o.from}_to_${o.to}.csv`, toCsv(statementRows(s, settings)));
}
