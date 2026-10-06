'use client';

import type { ReactNode } from 'react';
import { MascotSlot } from '@/components/mascot/MascotSlot';
import { ToastProvider } from '@/components/ui/Toast';
import { DemoClock } from './DemoClock';
import { Nav } from './Nav';
import { AppLink } from './navigation';
import { ThemeToggle } from './ThemeToggle';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-card"
      >
        Skip to content
      </a>
      <Nav />
      <div className="pb-24 md:pb-10 md:pl-[88px]">
        <div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <AppLink href="/" className="text-[15px] font-semibold tracking-[-0.02em] md:invisible">
              Nimbus
            </AppLink>
            <div className="flex items-center gap-1">
              <DemoClock />
              <ThemeToggle />
            </div>
          </div>
          <main id="main" className="flex flex-col gap-6 pt-3 pb-6 md:pt-6">
            <MascotSlot />
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
