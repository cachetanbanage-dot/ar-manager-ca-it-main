'use server';
// Customer Master saves (section 4.8): validate with zod, check the business
// rules, write, then refresh the pages.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { asofParam, hrefWithAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import type { FieldErrors } from '@/lib/validation/common';
import { CUSTOMER_FIELDS, checkCustomer, type CustomerFormState } from '@/lib/validation/customer';

/** Add (customerId null) or edit a customer. On success, opens the customer page. */
export async function saveCustomer(
  customerId: number | null, prev: CustomerFormState, formData: FormData,
): Promise<CustomerFormState> {
  const values = Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, String(formData.get(f) ?? '')]));
  const failed = (errors: FieldErrors, message: string) => ({ values, errors, message, attempt: prev.attempt + 1 });

  // 1. Validate, and 2. check the business rules (unique code) against the current data
  const data = await loadArData();
  const checked = checkCustomer(values, data.customers, customerId ?? undefined);
  if (!checked.ok) return failed(checked.errors, 'Please correct the fields marked in red.');
  const c = checked.data;

  // 3. Write (amounts go to the database in rupees)
  const row = {
    code: c.code, name: c.name, city: c.city, state: c.state, contact_person: c.contactPerson, email: c.email,
    phone: c.phone, gstin: c.gstin, credit_days: c.creditDays, credit_limit: c.creditLimit / 100, tds_rate_pct: c.tdsRatePct,
  };
  const result = customerId === null
    ? await db.from('customers').insert({ ...row, is_active: true }).select('id').single()
    : await db.from('customers').update(row).eq('id', customerId).select('id').single();
  if (result.error) return failed({}, friendlyDbError(result.error.message));

  // 4. Refresh every page (they all show customer data), then open the customer
  revalidatePath('/', 'layout');
  redirect(hrefWithAsOf(`/customers/${result.data.id}`, asofParam(String(formData.get('asof') ?? ''))));
}

/** R9: deactivate or reactivate a customer. Customers are never deleted. */
export async function setCustomerActive(customerId: number, active: boolean): Promise<void> {
  const { error } = await db.from('customers').update({ is_active: active }).eq('id', customerId);
  if (error) throw new Error(friendlyDbError(error.message));
  revalidatePath('/', 'layout');
}
