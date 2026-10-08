import 'server-only';
import { connection } from 'next/server';
import { db } from '@/lib/db';
import { toArData, type DbRows } from './rows';
import type { ArData } from './types';

/**
 * Loads all six tables and converts them to ArData (section 4.5).
 * The data set is small, so every request loads everything and
 * lib/ar calculates in memory.
 */
export async function loadArData(): Promise<ArData> {
  await connection(); // always load at request time, never while Next.js prebuilds a page
  const [customers, invoices, creditNotes, receipts, allocations, notes] = await Promise.all([
    db.from('customers').select('*'),
    db.from('invoices').select('*'),
    db.from('credit_notes').select('*'),
    db.from('receipts').select('*'),
    db.from('allocations').select('*'),
    db.from('notes').select('*'),
  ]);
  for (const r of [customers, invoices, creditNotes, receipts, allocations, notes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const rows: DbRows = {
    customers: customers.data!,
    invoices: invoices.data!,
    credit_notes: creditNotes.data!,
    receipts: receipts.data!,
    allocations: allocations.data!,
    notes: notes.data!,
  };
  return toArData(rows);
}
