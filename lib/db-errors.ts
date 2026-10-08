// Turns database refusals (section 3.4) into plain language (section 4.6).
// Messages the database already writes for people, such as
// "Invoice BWA/26-27/0007 has only 3000.00 outstanding.", are shown as they are.

const TRANSLATIONS: [RegExp, string][] = [
  [/duplicate key|already exists|unique/i, 'That number or code is already used. Please try again — a new one will be worked out.'],
  [/total_equals_taxable_plus_gst/i, 'The total does not equal the taxable value plus GST. Nothing was saved.'],
  [/permission denied/i, 'This record cannot be deleted. Customers can be deactivated and invoices cancelled instead.'],
  [/violates check constraint "?([a-z_]+)"?/i, 'The database refused the values entered ($1). Nothing was saved.'],
  [/violates foreign key/i, 'A linked record is missing or still in use. Nothing was saved.'],
  [/Missing x-workspace header|Unknown workspace/i, 'The app is not connected to its workspace. Check AR_WORKSPACE_ID.'],
  [/fetch failed|timed? ?out|ECONN/i, 'The database could not be reached. Please try again in a moment.'],
];

export function friendlyDbError(message: string): string {
  for (const [pattern, text] of TRANSLATIONS) {
    const m = message.match(pattern);
    if (m) return text.replace('$1', (m[1] ?? '').replace(/_/g, ' '));
  }
  return message;
}
