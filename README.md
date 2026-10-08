# AR Manager

A working accounts receivable tool for **Brightwater Advisory Pvt. Ltd.**, built for the Verve Advisory assignment
(the brief is in [docs/BRIEF.md](docs/BRIEF.md)). It shows who owes the firm money, how late each payment is, and
what to do about it, correct to the paisa **as at any date** the user picks.

**Live:** https://ar-manager-ca-it-main.vercel.app/

## What it does

| Area | Screens |
|---|---|
| **Overdue at a glance** (`/`) | Summary figures (outstanding, unapplied credit, net receivable, overdue and its share, DSO, overdue count); ageing by customer with unapplied credit in its own column and every amount clicking through to the invoices behind it; overdue invoices longest-late first; needs attention (over limit, broken promises, follow-ups due, unapplied credit); ageing CSV |
| **Customers** (`/customers`) | Searchable, filterable, sortable list with balance, overdue and limit used; add and edit with validation; deactivate and reactivate; customer page with profile, one-line ageing, over-limit warning, invoices, receipts, notes timeline and quick actions |
| **Invoices** (`/invoices`) | List with status, part-paid and disputed labels, filters (customer, status incl. Cancelled, ageing bucket, disputed, date range), search, sort, totals row and CSV; create with a live preview of tax, total, due date, number and credit-limit warning; invoice page with tax breakdown, allocations, credit notes and notes; raise credit note, disputed flag, cancel |
| **Actions** | Record a payment with TDS pre-fill and an editable oldest-first allocation; allocate unapplied credit; add notes, follow-ups and promises to pay, and mark follow-ups done; statement of account on screen, printed on A4 and as CSV; corrections (remove an allocation, delete a receipt with no allocations, cancel an invoice) |

An **As at** date in the header (kept in the URL as `?asof=2026-08-31`) drives every screen. It defaults to today in India.

## How it is built

```
Browser ──► Next.js (Vercel) ───────────────────────────────► Supabase (shared, my workspace only)
            app/        pages: load the data, show what lib/ar returns
            lib/ar/     EVERY financial calculation, as plain functions in whole paise
            lib/actions server actions: validate (zod) → check rules (lib/ar) → write → refresh
```

- **One rule:** every figure comes from `lib/ar/`. Each function names the brief's rule it implements (R2–R17), and
  screens only display what it returns. Amounts are whole paise (integers), so additions are exact. They are converted from
  rupees once, in `lib/ar/rows.ts`, and back only to display or save.
- **No stored balances:** all six tables are loaded on each request (`lib/ar/load.ts`) and every position is
  calculated from the documents as at the chosen date.
- **The control check (R14)** is built in: `balanceCheck` compares each customer's balance from invoice positions with
  invoices − credit notes − receipts. The tests require it to be empty for every day of 2026 up to 31 October.
- **Saving** follows section 4.8. Every form is checked on the server before anything is written, and database refusals
  are shown in plain language. Recording a payment deletes the receipt again if its allocations cannot be saved, and
  document numbers are worked out again (with one retry) if another tab took the same number.
- The Supabase client (`lib/db.ts`) is server-only, so the workspace id never reaches the browser.

| Folder | Contents |
|---|---|
| `lib/ar/` | Types, loader and calculations: positions, ageing, control check, statement, promises, DSO, GST, numbering, previews, allocation rules |
| `lib/validation/` | zod form checks, shared by the server actions and tests |
| `lib/actions/` | Server actions, one file per area |
| `lib/lists/` | Assemble each screen's rows from `lib/ar` (filter, search, sort) |
| `app/` | Pages, plus CSV routes (`statement/export`, `invoices/export`, `ageing/export`) |
| `components/` | Forms and display pieces (the few parts that run in the browser) |
| `tests/` | Vitest tests and the sample-data fixture |

## Running it

Requires Node.js 22.18 or later (developed on 24 LTS).

1. `npm install`
2. Create `.env.local` in the project root with the three variables from the brief (section 4.4):
   ```dotenv
   SUPABASE_URL=https://jxllwhrinqlzvydzrscs.supabase.co
   SUPABASE_ANON_KEY=<the anon key from the brief>
   AR_WORKSPACE_ID=<your workspace id>
   ```
3. `npm run dev`, then open http://localhost:3000.

On Vercel, set the same three variables under Settings → Environment Variables and redeploy.

> Windows PowerShell may refuse `npm` ("running scripts is disabled"). Use `npm.cmd`, run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Git Bash.

## Tests

- `npm test` runs every test (Vitest) against `tests/fixtures/sample.json`, offline. They cover:
  - all ten spot checks;
  - the control check for every day from 01-Jan to 31-Oct-2026;
  - every statement's closing balance against the control balance;
  - bucket and status boundaries, GST, due dates and numbering;
  - the dashboard figures worked out by hand;
  - every form rule;
  - the formatting and CSV helpers.
- **Refreshing the fixture:** reset the workspace (brief section 3.2), then
  `node --env-file=.env.local scripts/snapshot.ts`. The script removes the `workspace_id` column before saving.
- **Manual checks** before a release: [docs/TESTING.md](docs/TESTING.md).

## Assumptions

Where the brief left a choice open, I decided as follows.

1. **Limits look at every record, whatever its date.** Screens show positions as at the chosen date. But what an invoice
   can still take (allocations, credit notes), what a receipt can still give, and whether an invoice can be cancelled use
   *all* records, because that is what the database enforces. The invoice page notes any records dated after the as-at date.
2. **TDS pre-fill** = bank × TDS rate ÷ (100 + 18 − TDS rate). This grosses the bank amount up to the taxable value it
   settles (bank = taxable × (1 + GST − TDS)), so ₹81,000 at 10% gives ₹7,500, matching the sample data. It is only a
   suggestion; the amount actually deducted is saved.
3. **New records default to today** in India. A record dated after the as-at date being viewed does not appear until the
   date is moved forward (R10), and the invoice page says so.
4. **Numbering:** the next number is the highest already used in that financial year's series + 1, so cancelled numbers are
   never reused. Invoices may be dated in FY 2025-26; they continue that series (`BWA/25-26/0172`).
5. **GST rate** is chosen from the standard slabs (0, 5, 12, 18, 28, 40%), defaulting to 18%. Customers' states come from
   a list of Indian states and union territories, so a misspelt "Maharashtra" cannot silently switch an invoice to IGST.
6. **Credit-limit warning** compares the customer's balance across all records, plus the new invoice, with the limit. It
   warns but never blocks (R9).
7. **Dates the brief does not restrict:** a credit note cannot be dated before its invoice. Follow-up and promise dates cannot
   be before their note. When recording a payment, allocations are dated the receipt date, so only invoices dated on or before
   it are offered.
8. **Oldest-first suggestion** includes disputed invoices, as the brief describes; they carry a "disputed" label and the
   user can change the amounts.
9. **Promises:** receipts dated from the note date to the earlier of the promise date and the as-at date count, both days
   included. A promise is Pending on its promise date and Broken from the next day if not kept.
10. **DSO** shows "—" when the 90-day sales figure is zero or negative.
11. **Display:** % of limit used is rounded to whole percent; it is 0% for a credit balance and "—" when the limit is zero.
    A zero balance shows without Dr or Cr. The statement defaults to 1 April of the as-at date's financial year up to the
    as-at date.
12. **Exports:** the invoice CSV contains exactly the filtered list on screen. Dates in CSVs use the screen format
    (31-Aug-2026) and amounts are plain numbers.
13. **Notes are not edited or deleted.** They are the record of what was said; only a follow-up can be marked done.

## Known gaps

- **"Follow-up done" has no date** (the schema has only a flag), so marking a follow-up done hides it at every as-at date,
  including earlier ones.
- **No transactions across requests** (a limit of the API). If the database refuses a payment's allocations after our
  checks pass, for example two people allocating the same invoice at the same moment, the receipt is deleted again. If that
  delete itself failed, an unallocated receipt would remain, visible as unapplied credit and deletable from the customer page.
- **There is no "edit receipt".** A wrong receipt is corrected as the brief allows: remove its allocations, delete it and
  record it again.
- No login, by design of the brief: the workspace id keeps the data private.

## What I would do next

- Show "sent" and "acknowledged" dates on statements and keep a history of statements issued.
- Add automated browser tests of the main flows (the manual checklist in `docs/TESTING.md` covers them today).
- Let a follow-up be rescheduled rather than only marked done.
- Add a customer-wise collection forecast from open promises and due dates.

## AI assistance

Built with Claude Code (an AI coding assistant), one step of the brief's build order at a time: a plain-English plan,
approval, code and tests, then a commit. The conversations are in [ai-logs/](ai-logs/).
