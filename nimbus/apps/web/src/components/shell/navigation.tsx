'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { useHash } from '@/hooks/useHash';

export interface AppNavigation {
  mode: 'router' | 'preview';
  pathname: string;
  /** URL fragment without "#". */
  hash: string;
  navigate: (href: string) => void;
}

const NavigationContext = createContext<AppNavigation | null>(null);

/**
 * The app's view of "where am I". Pages normally answer with the Next.js router;
 * the single-page preview answers from local state so every screen lives in one
 * static file.
 */
export function useAppNavigation(): AppNavigation {
  const override = useContext(NavigationContext);
  const pathname = usePathname() ?? '/';
  const hash = useHash();
  const router = useRouter();
  const navigate = useCallback((href: string) => router.push(href), [router]);
  const fallback = useMemo<AppNavigation>(() => ({ mode: 'router', pathname, hash, navigate }), [pathname, hash, navigate]);
  return override ?? fallback;
}

function splitHref(href: string): { pathname: string; hash: string } {
  const [pathname = '/', hash = ''] = href.split('#');
  return { pathname: pathname || '/', hash };
}

export function PreviewNavigationProvider({ children, initial = '/' }: { children: ReactNode; initial?: string }) {
  const [location, setLocation] = useState(() => splitHref(initial));
  const navigate = useCallback((href: string) => {
    const next = splitHref(href);
    setLocation(next);
    if (!next.hash) window.scrollTo({ top: 0 });
  }, []);
  const value = useMemo<AppNavigation>(() => ({ mode: 'preview', ...location, navigate }), [location, navigate]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
}

/** A link that follows whichever navigation mode is active. */
export function AppLink({ href, children, onClick, ...rest }: AppLinkProps) {
  const nav = useAppNavigation();
  if (nav.mode === 'router') {
    return (
      <Link href={href} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        nav.navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
