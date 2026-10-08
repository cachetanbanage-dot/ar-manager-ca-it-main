'use client';
// The header on every page: navigation and the as-at date picker (Part 2).
// The as-at date lives in the URL (?asof=2026-08-31), so views can be
// bookmarked and shared, and every navigation link carries it along.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { hrefWithAsOf, isValidDate, parseAsOf, todayInIndia } from '@/lib/asof';

const NAV = [
  { href: '/', label: 'Overdue at a glance' },
  { href: '/customers', label: 'Customers' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/receipts/new', label: 'Record payment' },
  { href: '/statement', label: 'Statement' },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

export function NavLinks({ asof, pathname }: { asof: string | null; pathname: string }) {
  return (
    <nav className="flex flex-wrap gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={hrefWithAsOf(item.href, asof)}
          className={`rounded px-3 py-1.5 text-sm ${
            isActive(pathname, item.href) ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const asofParam = searchParams.get('asof');
  const asof = parseAsOf(asofParam);
  const today = todayInIndia();

  // Change only ?asof=, keeping any other filters in the URL
  function goTo(date: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (date) params.set('asof', date);
    else params.delete('asof');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <HeaderFrame>
      <NavLinks asof={asofParam && isValidDate(asofParam) ? asofParam : null} pathname={pathname} />
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium">As at</span>
        <input
          type="date"
          value={asof}
          onChange={(e) => isValidDate(e.target.value) && goTo(e.target.value)}
          className="rounded border border-slate-300 bg-white px-2 py-1"
        />
        {asof === today ? (
          <span className="text-slate-500">(today)</span>
        ) : (
          <button type="button" onClick={() => goTo(null)} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100">
            Today
          </button>
        )}
      </label>
    </HeaderFrame>
  );
}

export function HeaderFrame({ children }: { children: React.ReactNode }) {
  return (
    <header className="border-b border-slate-200 bg-slate-50 print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="text-lg font-semibold text-slate-900">AR Manager</Link>
        {children}
      </div>
    </header>
  );
}
