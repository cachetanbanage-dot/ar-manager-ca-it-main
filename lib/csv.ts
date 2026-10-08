// CSV files (section 4.12): a UTF-8 BOM so Excel reads ₹ and other characters
// correctly, amounts as plain numbers, and quotes around any field that needs them.

/** One field. Quoted when it contains a comma, a quote or a line break; quotes inside are doubled. */
export function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole file: BOM, then one line per row, Windows line endings for Excel. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** The download response for a CSV file. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
