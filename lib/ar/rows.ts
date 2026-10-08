// Converts rows as the database returns them (snake_case, amounts in rupees)
// into ArData (camelCase, amounts in whole paise). This is the only place
// rupees become paise when reading. Used by the loader and by the tests.
import type {
  Allocation, ArData, CreditNote, Customer, Invoice, Note, NoteType, Paise, Receipt, ReceiptMode,
} from './types';

/** Rupees (e.g. 885.5 or "885.50") to whole paise. Math.round removes float noise like 28.999999999999996. */
export const paise = (rupees: number | string): Paise => Math.round(Number(rupees) * 100);

export interface DbCustomer {
  id: number; code: string; name: string; city: string; state: string;
  contact_person: string; email: string; phone: string | null; gstin: string | null;
  credit_days: number; credit_limit: number; tds_rate_pct: number; is_active: boolean;
}
export interface DbInvoice {
  id: number; invoice_no: string; customer_id: number; invoice_date: string; due_date: string;
  description: string; taxable_value: number; gst_rate_pct: number;
  cgst: number; sgst: number; igst: number; total: number; is_cancelled: boolean; is_disputed: boolean;
}
export interface DbCreditNote {
  id: number; credit_note_no: string; invoice_id: number; credit_note_date: string;
  taxable_value: number; cgst: number; sgst: number; igst: number; total: number; reason: string;
}
export interface DbReceipt {
  id: number; receipt_no: string; customer_id: number; receipt_date: string;
  bank_amount: number; tds_amount: number; mode: string; reference: string;
}
export interface DbAllocation { id: number; receipt_id: number; invoice_id: number; allocation_date: string; amount: number }
export interface DbNote {
  id: number; customer_id: number; invoice_id: number | null; note_date: string; note_type: string; body: string;
  follow_up_date: string | null; follow_up_done: boolean; promise_date: string | null; promise_amount: number | null;
}

export interface DbRows {
  customers: DbCustomer[];
  invoices: DbInvoice[];
  credit_notes: DbCreditNote[];
  receipts: DbReceipt[];
  allocations: DbAllocation[];
  notes: DbNote[];
}

export function toArData(rows: DbRows): ArData {
  return {
    customers: rows.customers.map((r): Customer => ({
      id: r.id, code: r.code, name: r.name, city: r.city, state: r.state,
      contactPerson: r.contact_person, email: r.email, phone: r.phone, gstin: r.gstin,
      creditDays: r.credit_days, creditLimit: paise(r.credit_limit), tdsRatePct: Number(r.tds_rate_pct),
      isActive: r.is_active,
    })),
    invoices: rows.invoices.map((r): Invoice => ({
      id: r.id, invoiceNo: r.invoice_no, customerId: r.customer_id,
      invoiceDate: r.invoice_date, dueDate: r.due_date, description: r.description,
      taxableValue: paise(r.taxable_value), gstRatePct: Number(r.gst_rate_pct),
      cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst), total: paise(r.total),
      isCancelled: r.is_cancelled, isDisputed: r.is_disputed,
    })),
    creditNotes: rows.credit_notes.map((r): CreditNote => ({
      id: r.id, creditNoteNo: r.credit_note_no, invoiceId: r.invoice_id, creditNoteDate: r.credit_note_date,
      taxableValue: paise(r.taxable_value), cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst),
      total: paise(r.total), reason: r.reason,
    })),
    receipts: rows.receipts.map((r): Receipt => ({
      id: r.id, receiptNo: r.receipt_no, customerId: r.customer_id, receiptDate: r.receipt_date,
      bankAmount: paise(r.bank_amount), tdsAmount: paise(r.tds_amount),
      mode: r.mode as ReceiptMode, reference: r.reference,
    })),
    allocations: rows.allocations.map((r): Allocation => ({
      id: r.id, receiptId: r.receipt_id, invoiceId: r.invoice_id,
      allocationDate: r.allocation_date, amount: paise(r.amount),
    })),
    notes: rows.notes.map((r): Note => ({
      id: r.id, customerId: r.customer_id, invoiceId: r.invoice_id, noteDate: r.note_date,
      noteType: r.note_type as NoteType, body: r.body,
      followUpDate: r.follow_up_date, followUpDone: r.follow_up_done,
      promiseDate: r.promise_date, promiseAmount: r.promise_amount === null ? null : paise(r.promise_amount),
    })),
  };
}
