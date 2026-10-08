// Small display pieces shared by the screens. They only show values; they never calculate.
import Link from 'next/link';
import type { InvoiceStatus } from '@/lib/ar/positions';

const STATUS_STYLES: Record<InvoiceStatus | 'Active' | 'Inactive', string> = {
  Paid: 'bg-green-100 text-green-800',
  Due: 'bg-slate-100 text-slate-700',
  Overdue: 'bg-red-100 text-red-800',
  Cancelled: 'bg-slate-200 text-slate-500 line-through',
  Active: 'bg-green-100 text-green-800',
  Inactive: 'bg-slate-200 text-slate-600',
};

export function StatusBadge({ status }: { status: keyof typeof STATUS_STYLES }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{status}</span>;
}

export function Label({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'blue' }) {
  const style = tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';
  return <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${style}`}>{children}</span>;
}

/** An invoice status with its part-paid and disputed labels (R11). */
export function InvoiceStatusCell({ status, isPartPaid, isDisputed }: { status: InvoiceStatus; isPartPaid: boolean; isDisputed: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <StatusBadge status={status} />
      {isPartPaid && <Label tone="blue">part-paid</Label>}
      {isDisputed && <Label tone="amber">disputed</Label>}
    </span>
  );
}

export function ButtonLink({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-block rounded px-3 py-1.5 text-sm ${primary ? 'bg-slate-800 text-white hover:bg-slate-700' : 'border border-slate-300 bg-white hover:bg-slate-100'}`}
    >
      {children}
    </Link>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-8 text-lg font-semibold">{children}</h2>;
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`border-b border-slate-300 px-2 py-2 font-medium ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

export function Td({ children, right, className = '' }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-2 py-1.5 ${right ? 'text-right tabular-nums whitespace-nowrap' : ''} ${className}`}>{children}</td>;
}

/** A column heading that sorts the list when clicked; clicking again reverses the order. */
export function SortTh({ label, sortKey, current, dir, href, right }: {
  label: string; sortKey: string; current: string; dir: 'asc' | 'desc'; href: (sort: string, dir: 'asc' | 'desc') => string; right?: boolean;
}) {
  const active = sortKey === current;
  const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
  return (
    <Th right={right}>
      <Link href={href(sortKey, nextDir)} className="hover:underline">
        {label}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
      </Link>
    </Th>
  );
}
