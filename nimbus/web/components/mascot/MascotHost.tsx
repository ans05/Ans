"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import type { Attention } from "@nimbus/core";

import { cn } from "../ui/cn";
import { Icon } from "../ui/Icon";
import { Nimbus } from "./Nimbus";

interface MascotHostProps {
  attention: Attention | null;
}

const DISMISS_EVENT = "nimbus:dismiss";
const dismissKey = (id: string) => `nimbus.dismissed.${id}`;

const subscribe = (onChange: () => void) => {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

const readDismissed = (id: string) => {
  try {
    return sessionStorage.getItem(dismissKey(id)) === "1";
  } catch {
    return false;
  }
};

const writeDismissed = (id: string) => {
  try {
    sessionStorage.setItem(dismissKey(id), "1");
  } catch {
    // Storage can be unavailable; the event below still hides it for this render.
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
};

/**
 * The single place the mascot can appear. It shows up only when something
 * needs attention, and steps aside on the page that handles it.
 */
export function MascotHost({ attention }: MascotHostProps) {
  const pathname = usePathname();
  const id = attention?.id ?? "";
  const dismissed = useSyncExternalStore(
    subscribe,
    () => (id ? readDismissed(id) : false),
    () => false,
  );

  if (!attention || dismissed || pathname === attention.href) return null;

  const warning = attention.tone === "warning";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[76px] z-30 flex justify-end px-4 md:bottom-6 md:px-6"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="pointer-events-auto flex max-w-[min(100%,380px)] items-end gap-2 motion-safe:animate-rise">
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "relative rounded-2xl border bg-surface px-4 py-3 shadow-md",
            warning ? "border-warn/50" : "border-line",
          )}
        >
          <button
            type="button"
            onClick={() => writeDismissed(attention.id)}
            aria-label="Dismiss"
            className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="x" size={12} />
          </button>
          <p className="pr-6 text-sm leading-5 text-ink">{attention.message}</p>
          <Link
            href={attention.href}
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-[13px] font-medium",
              warning ? "text-warn-ink" : "text-accent-ink",
            )}
          >
            {attention.cta}
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
        <Nimbus state={warning ? "warning" : "idle"} size={64} className="mb-1 shrink-0" />
      </div>
    </div>
  );
}
