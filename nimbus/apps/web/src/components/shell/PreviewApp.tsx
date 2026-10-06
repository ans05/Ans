'use client';

import { FocusView } from '@/components/focus/FocusView';
import { MetricsView } from '@/components/metrics/MetricsView';
import { PrepView } from '@/components/prep/PrepView';
import { ShieldView } from '@/components/shield/ShieldView';
import { TodayView } from '@/components/timeline/TodayView';
import { AppShell } from './AppShell';
import { PreviewNavigationProvider, useAppNavigation } from './navigation';

function PreviewScreen() {
  const { pathname } = useAppNavigation();
  switch (pathname) {
    case '/focus':
      return <FocusView />;
    case '/shield':
      return <ShieldView />;
    case '/prep':
      return <PrepView />;
    case '/metrics':
      return <MetricsView />;
    default:
      return <TodayView />;
  }
}

/**
 * Every screen in one static file, switched in memory. Used to host a demo
 * where only a single page can be served.
 */
export function PreviewApp() {
  return (
    <PreviewNavigationProvider>
      <AppShell>
        <PreviewScreen />
      </AppShell>
    </PreviewNavigationProvider>
  );
}
