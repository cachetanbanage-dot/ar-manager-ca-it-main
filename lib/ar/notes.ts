// R16: follow-ups due and promises to pay, as at a date.
import type { ArData, Customer, Note, Paise } from './types';

export interface FollowUp { note: Note; customer: Customer }

/** R16: open follow-ups dated on or before asOf, from notes that exist at asOf. Earliest first. */
export function followUpsDue(data: ArData, asOf: string): FollowUp[] {
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  return data.notes
    .filter((n) => n.noteDate <= asOf && n.followUpDate !== null && n.followUpDate <= asOf && !n.followUpDone)
    .sort((a, b) => (a.followUpDate! < b.followUpDate! ? -1 : a.followUpDate! > b.followUpDate! ? 1 : a.id - b.id))
    .map((note) => ({ note, customer: customers.get(note.customerId)! }));
}

export type PromiseStatus = 'Kept' | 'Broken' | 'Pending';

export interface PromiseToPay {
  note: Note;
  customer: Customer;
  promiseDate: string;
  promiseAmount: Paise;
  received: Paise; // settlement values received from the note date to min(promise date, asOf)
  status: PromiseStatus;
}

/**
 * R16: every promise to pay noted on or before asOf.
 * Kept    — the customer's receipts (bank + TDS) dated from the note date to the
 *           earlier of the promise date and asOf, both included, reach the promised amount.
 * Broken  — not kept, and the promise date is before asOf.
 * Pending — otherwise.
 */
export function promiseStatuses(data: ArData, asOf: string): PromiseToPay[] {
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  return data.notes
    .filter((n) => n.noteDate <= asOf && n.promiseDate !== null && n.promiseAmount !== null)
    .map((note) => {
      const promiseDate = note.promiseDate!;
      const promiseAmount = note.promiseAmount!;
      const until = promiseDate < asOf ? promiseDate : asOf;
      let received = 0;
      for (const r of data.receipts) {
        if (r.customerId === note.customerId && r.receiptDate >= note.noteDate && r.receiptDate <= until) {
          received += r.bankAmount + r.tdsAmount;
        }
      }
      const status: PromiseStatus =
        received >= promiseAmount ? 'Kept' : promiseDate < asOf ? 'Broken' : 'Pending';
      return { note, customer: customers.get(note.customerId)!, promiseDate, promiseAmount, received, status };
    });
}
