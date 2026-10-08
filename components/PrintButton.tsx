'use client';
// Opens the browser's print dialog; the print stylesheet gives a clean A4 page.
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700">
      Print
    </button>
  );
}
