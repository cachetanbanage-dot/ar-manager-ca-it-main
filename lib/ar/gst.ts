// R3 and R7: GST on invoices and credit notes, in whole paise.
import type { Invoice, Paise } from './types';

export const SELLER_STATE = 'Maharashtra';
export const DEFAULT_GST_RATE_PCT = 18;

export interface GstSplit { cgst: Paise; sgst: Paise; igst: Paise }
export interface GstAmounts extends GstSplit { total: Paise }

/** True when the customer is in the seller's state, so CGST + SGST apply instead of IGST. */
export function isIntraState(state: string): boolean {
  return state.trim().toLowerCase() === SELLER_STATE.toLowerCase();
}

/**
 * R3: Maharashtra customers pay CGST and SGST at half the rate each; everyone
 * else pays IGST at the full rate. Each component is rounded to the paisa,
 * halves up (Math.round rounds .5 up for positive amounts).
 */
export function gstSplit(state: string, taxable: Paise, ratePct: number): GstSplit {
  if (isIntraState(state)) {
    const half = Math.round((taxable * ratePct) / 200);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: Math.round((taxable * ratePct) / 100) };
}

/** R3: the GST split plus the invoice total (taxable value + GST). */
export function invoiceAmounts(state: string, taxable: Paise, ratePct: number): GstAmounts {
  const gst = gstSplit(state, taxable, ratePct);
  return { ...gst, total: taxable + gst.cgst + gst.sgst + gst.igst };
}

/**
 * R7: a credit note uses its invoice's GST rate and split (CGST + SGST or IGST),
 * whatever the customer's state is today.
 */
export function creditNoteAmounts(invoice: Invoice, taxable: Paise): GstAmounts {
  const chargedIgst = invoice.igst > 0;
  return invoiceAmounts(chargedIgst ? 'other' : SELLER_STATE, taxable, invoice.gstRatePct);
}
