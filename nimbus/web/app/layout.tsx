import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { getApi } from "@/lib/server/api";
import { themeInitScript } from "@/lib/theme";

import { inter } from "./fonts";
import "./globals.css";

/** Pages read mutable demo state, so render them per request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Nimbus", template: "%s · Nimbus" },
  description: "A calm travel-and-productivity companion: one timeline, usable focus windows, and a shield against time-zone clashes.",
  applicationName: "Nimbus",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1424" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const attention = await getApi().getAttention();

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        >
          Skip to content
        </a>
        <AppShell attention={attention}>{children}</AppShell>
      </body>
    </html>
  );
}
