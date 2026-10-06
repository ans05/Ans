import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { NimbusProvider } from '@/lib/state/NimbusProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Nimbus', template: '%s · Nimbus' },
  description: 'Stay productive while you travel. One timeline for your trip and your calendar.',
  applicationName: 'Nimbus',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1220' },
  ],
};

/** Applies a saved theme before first paint so dark mode never flashes. */
const themeInit = `(function(){try{var t=localStorage.getItem('nimbus:theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <NimbusProvider>{children}</NimbusProvider>
      </body>
    </html>
  );
}
