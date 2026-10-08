# Testing the AR Manager

Two kinds of testing protect the figures:

1. **Automated tests** (`npm test`) check every calculation against the sample data in seconds, without the database.
2. **This checklist**: the clicks to make before every release, to see that the screens, the database and the calculations agree.

---

## 1. Before you start

1. **Reset the workspace**, so the figures are the original sample data. In Git Bash, from the project folder:
   ```bash
   set -a; . ./.env.local; set +a
   curl -X POST "$SUPABASE_URL/rest/v1/rpc/reset_workspace" -H "apikey: $SUPABASE_ANON_KEY" \
     -H "x-workspace: $AR_WORKSPACE_ID" -H "Content-Type: application/json" -d '{}'
   ```
2. **Run the automated tests:** `npm test`. Every test must pass.
3. **Open the app:** https://ar-manager-ca-it-main.vercel.app/, or `npm run dev` and http://localhost:3000.

### What the automated tests already cover

| Area | What is checked |
|---|---|
| Spot checks | All ten from the brief (Part 1), including the C002 statement line by line, both on screen and as CSV |
| Control check (R14) | Customer balances agree with the documents for **every day** from 01-Jan-2026 to 31-Oct-2026 |
| Statements | Every customer's closing balance equals the control balance, for several periods |
| GST and due dates | Recalculated for every sample invoice and compared with what the database stores |
| Boundaries | Ageing buckets on 0, 1, 30, 31 … 180, 181 days; "Due" on the due date and "Overdue" the day after; promises on and after the promise date |
| Dashboard | Summary figures worked out by hand for 31-Aug-2026; ageing totals equal the summary every week of the year |
| Forms | Every validation rule: required fields, unique code, GST slabs, TDS 0–100, credit notes not above what is open, allocations not above the receipt or the invoice, promise date and amount together |
| Formats and CSV | ₹ with Indian grouping, Dr/Cr, 31-Aug-2026 dates, "today" in India around midnight IST, CSV quoting and the Excel BOM |

---

## 2. The spot checks on screen

Set **As at** in the header to the date shown, then look where the table says.

| # | As at | Where | Expected |
|---|---|---|---|
| 1 | any | Invoices → BWA/26-27/0001 | CGST ₹6,750.00 + SGST ₹6,750.00, total ₹88,500.00, due 05-May-2026 |
| 2 | any | Invoices → BWA/26-27/0002 | IGST ₹63,000.00, total ₹4,13,000.00 |
| 3 | 31-Aug-2026 | Invoices → BWA/26-27/0003 | Outstanding ₹69,600.00, Overdue, part-paid, 90 days late, bucket 61-90 |
| 4 | 31-Aug / 06-Sep / 15-Sep-2026 | Invoices → BWA/26-27/0021 | Due ₹88,500.00 / Overdue 2 days, ₹88,500.00 / Paid |
| 5 | 31-Aug-2026 | Customers → C005 | Outstanding ₹1,88,800.00, unapplied ₹1,00,000.00, balance ₹88,800.00 Dr |
| 6 | 12-Jul-2026 | Customers → C005 | Balance ₹1,00,000.00 **Cr** |
| 7 | 31-Aug-2026 | Invoices → BWA/26-27/0007 | Outstanding ₹3,000.00 (credited ₹29,500.00; received ₹2,62,500.00) |
| 8 | — | Statement → C002, 01-Apr-2026 to 31-Aug-2026 | Opening ₹70,800.00 Dr, 7 lines, closing ₹2,23,000.00 Dr |
| 9 | 31-Aug-2026 | Customers → C002 → Notes; or home → Needs attention | The promise noted on 20-Jul-2026 is **Broken** |
| 10 | any | (automated) | `npm test` passes "no differences for any customer on any day" |

**Home screen, as at 31-Aug-2026:** outstanding ₹21,18,100.00 · unapplied ₹1,00,000.00 · net ₹20,18,100.00 Dr · overdue ₹12,86,200.00 (60.7%) · DSO 111 days · 11 overdue invoices. Needs attention: C003 over its limit, C002's broken promise, C005's unapplied credit.

---

## 3. Release walkthrough: a part-payment with TDS

This checks that one posting flows correctly to every screen. Use today's date, and reset afterwards.

1. **Home screen:** note **Outstanding on invoices** and **Net receivable**.
2. **Customers → C001:** note the balance. Invoice BWA/26-27/0024 (₹88,500.00, taxable ₹75,000.00) is open.
3. **Record payment:**
   - **Fill in:** customer C001, bank amount **40,500**.
   - **Check:** TDS pre-fills **3,750.00** (40,500 × 10 ÷ 108), the settlement value is **₹44,250.00**, and the suggestion puts ₹44,250.00 against 0024, leaving ₹0.00 unapplied.
   - **Then:** enter a reference and **Save payment**.
4. **Check that everything agrees:**
   - **Invoice 0024:** received ₹44,250.00, outstanding ₹44,250.00, labelled **part-paid**.
   - **Customer C001:** the balance has fallen by ₹44,250.00. The new receipt shows bank ₹40,500.00, TDS ₹3,750.00, allocated ₹44,250.00.
   - **Home screen:** outstanding and net receivable have both fallen by ₹44,250.00.
   - **Statement for C001** (1 April to today): two new lines, "Payment received ₹40,500.00" and "TDS deducted by you ₹3,750.00". The closing balance equals the customer page balance.
5. **Change As at to yesterday:** the payment disappears from every screen (R10).
6. **Corrections:** on invoice 0024, **Remove** the allocation, and the ₹44,250.00 becomes unapplied credit on C001. Then on C001, **Allocate it** again, or remove it and **Delete** the receipt.

---

## 4. The other actions

| Action | What to try | Expected |
|---|---|---|
| Add customer | Leave fields blank; code C001; email "abc"; TDS 101 | Plain-language errors next to each field; nothing saved |
| Deactivate | On any customer | "Inactive" notice; no New invoice button; not offered on the New invoice form |
| New invoice | Pick C003, taxable 10,000 | Preview: IGST ₹1,800.00, total ₹11,800.00, next number, and an amber **over credit limit** warning that does not stop saving |
| Credit note | On an invoice, a taxable value larger than what is open | Refused, saying how much is still open |
| Credit note | Dated before the invoice | Refused |
| Cancel | An invoice with a payment or credit note | Not allowed, with the reason; an invoice with nothing against it cancels after ticking the confirmation |
| Disputed | Mark, then clear | Amber "disputed" label appears and disappears; no amount changes |
| Payment | Allocate more than bank + TDS | Refused with the amounts |
| Note | Promise date without an amount | Refused: "A promise needs an amount as well as a date" |
| Follow-up | Mark done on the home screen | Disappears from Follow-ups due |

**Not testable by clicking:** if the database refuses a payment's allocations after our own checks have passed (for example two people allocating the same invoice at the same moment), the receipt is deleted again so nothing is half-saved. See `recordPayment` in `lib/actions/receipts.ts`.

---

## 5. Exports and printing

| What | Where | Expected |
|---|---|---|
| Statement CSV | Statement → Download CSV | File `Statement_C002_2026-04-01_to_2026-08-31.csv`; opens in Excel; amounts like `70800.00`; the same lines as the screen |
| Print | Statement → Print | One clean A4 page: Brightwater's name, the customer, the period, the table and the ageing footer; no menu or buttons |
| Invoice CSV | Invoices → filter → Download CSV | Only the filtered invoices, with the same totals row as the screen |
| Ageing CSV | Home → Ageing by customer → Download CSV | The same table with its totals; unapplied credit in its own column |
| Settings | Settings → set DSO to 60 and buckets ending 15 and 45 → Save | Amber "Custom settings in use" note; home as at 31-Aug-2026 shows Not due · 1-15 · 16-45 · Over 45, DSO 122 days, outstanding still ₹21,18,100.00; C003: 16-45 ₹82,600.00, Over 45 ₹3,64,000.00 |
| Settings: overlap | Type a bucket limit not bigger than the one before (e.g. 30, 60, 45) | Refused as you type and on Save: "must end after bucket …, or the two would overlap" |
| Settings: reset | Reset to standard | Standard columns and DSO 111 as at 31-Aug-2026 again; the amber note disappears. **Reset before checking the spot checks** |

---

## 6. Last full run

| Date | Where | Result |
|---|---|---|
| 09-Oct-2026 | Live site, straight after a reset (workspace compared with `tests/fixtures/sample.json`: all six tables identical) | Spot checks 1–9 pass on screen (spot check 4 at all three dates); home screen as at 31-Aug-2026 matches section 2; `npm test`: 135 tests pass, including spot check 10 |
| 09-Oct-2026 | Live site, after the Settings tab was deployed, on standard settings | Spot checks 1–9 and the home screen still pass; the Settings checks in section 5 pass (overlap refused, DSO 122 with 60 days and buckets 15/45, back to DSO 111 after reset); `npm test`: 151 tests pass |
