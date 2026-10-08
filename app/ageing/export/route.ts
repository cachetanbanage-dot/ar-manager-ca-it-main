// Ageing by customer CSV download (section 4.12).
import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { csvResponse, toCsv } from '@/lib/csv';
import { ageingRowsCsv } from '@/lib/exports';
import { dashboard } from '@/lib/lists/dashboard';

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const data = await loadArData();
  const asof = parseAsOf(params.asof);
  const d = dashboard(data, asof);
  return csvResponse(`Ageing_as_at_${asof}.csv`, toCsv(ageingRowsCsv(d.ageing, d.ageingTotals)));
}
