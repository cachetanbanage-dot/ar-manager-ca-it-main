// Invoice list CSV download: the same filters as the screen (section 4.12).
import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { csvResponse, toCsv } from '@/lib/csv';
import { invoiceListRowsCsv } from '@/lib/exports';
import { invoiceListOptions, invoiceListRows } from '@/lib/lists/invoices';
import { readSettings } from '@/lib/settings-server';

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const data = await loadArData();
  const asof = parseAsOf(params.asof);
  const settings = await readSettings();
  const { rows, totals } = invoiceListRows(data, asof, invoiceListOptions(params, settings), settings);
  return csvResponse(`Invoices_as_at_${asof}.csv`, toCsv(invoiceListRowsCsv(rows, totals)));
}
