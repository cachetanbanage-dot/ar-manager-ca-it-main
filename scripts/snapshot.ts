// Saves the six tables of the workspace to tests/fixtures/sample.json, so the
// tests run offline against a frozen copy of the sample data (section 4.14).
//
// Reset the workspace first (section 3.2), then run:
//   node --env-file=.env.local scripts/snapshot.ts
//
// The workspace_id column is removed from every row: the workspace id is
// private and must never be committed.
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const TABLES = ['customers', 'invoices', 'credit_notes', 'receipts', 'allocations', 'notes'] as const;

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
  global: { headers: { 'x-workspace': process.env.AR_WORKSPACE_ID! } },
});

const snapshot: Record<string, unknown[]> = {};
for (const table of TABLES) {
  const { data, error } = await db.from(table).select('*').order('id');
  if (error) throw new Error(`${table}: ${error.message}`);
  snapshot[table] = data.map((row) => {
    delete row.workspace_id;
    return row;
  });
  console.log(`${table}: ${data.length} rows`);
}

writeFileSync('tests/fixtures/sample.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log('Saved tests/fixtures/sample.json');
