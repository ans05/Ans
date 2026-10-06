'use client';

import { CalendarDays, ChartColumn, ListChecks, Shield, Timer } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/cn';
import { AppLink, useAppNavigation } from './navigation';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Today', icon: CalendarDays },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/shield', label: 'Shield', icon: Shield },
  { href: '/prep', label: 'Prep', icon: ListChecks },
  { href: '/metrics', label: 'Metrics', icon: ChartColumn },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Left rail on desktop, bottom tab bar on phones. One component, two layouts. */
export function Nav() {
  const { pathname } = useAppNavigation();

  return (
    <>
      <nav aria-label="Primary" className="fixed inset-y-0 left-0 z-40 hidden w-[88px] flex-col items-center border-r border-line bg-canvas py-5 md:flex">
        <AppLink href="/" className="mb-6 rounded-control px-2 py-1 text-[15px] font-semibold tracking-[-0.02em]">
          Nimbus
        </AppLink>
        <ul className="flex w-full flex-col items-stretch gap-1 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <AppLink
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-control py-2.5 text-[11px] font-medium transition-colors duration-150 ease-out',
                    active ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  {label}
                </AppLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80 md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <AppLink
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150 ease-out',
                    active ? 'text-ink' : 'text-ink-3',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  {label}
                </AppLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
