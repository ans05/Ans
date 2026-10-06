import Link from "next/link";
import type { ReactNode } from "react";

import type { Attention } from "@nimbus/core";

import { MascotHost } from "../mascot/MascotHost";
import { BottomNav, TopNav } from "./Nav";
import { ThemeToggle } from "./ThemeToggle";

interface AppShellProps {
  attention: Attention | null;
  children: ReactNode;
}

export function AppShell({ attention, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg text-[15px] font-semibold tracking-tight text-ink"
          >
            <span aria-hidden="true" className="grid size-6 place-items-center">
              <svg viewBox="0 0 64 48" width="22" height="17">
                <path
                  d="M18 40h32a10 10 0 0 0 1.4-19.9A14 14 0 0 0 25 14.6 11 11 0 0 0 7 25a10 10 0 0 0 11 15z"
                  fill="var(--accent)"
                />
              </svg>
            </span>
            Nimbus
          </Link>
          <div className="flex items-center gap-2">
            <TopNav />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-10 md:pb-16"
      >
        {children}
      </main>

      <BottomNav />
      <MascotHost attention={attention} />
    </div>
  );
}
