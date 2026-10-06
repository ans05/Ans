'use client';

import { ChevronRight, X } from 'lucide-react';
import { useMemo } from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';
import { computeAttention } from '@/lib/attention';
import { cn } from '@/lib/cn';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { AppLink, useAppNavigation } from '@/components/shell/navigation';
import { IconButton } from '@/components/ui/Button';
import { Nimbus } from './Nimbus';

/** The single place the mascot can appear. Shows the most urgent attention item. */
export function MascotSlot() {
  const snap = useSnapshot();
  const { hydrated, actions } = useNimbus();
  const { pathname } = useAppNavigation();
  const sameRoute = (href?: string) => Boolean(href && href.split('#')[0] === pathname);
  // A standing nudge is skipped on the page it points to; an urgent one still shows.
  const item = useMemo(
    () => computeAttention(snap).find((candidate) => candidate.priority === 1 || !sameRoute(candidate.href)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap, pathname],
  );

  if (!hydrated || !item) return null;
  const alert = item.severity === 'warning';
  const showLink = item.href && !sameRoute(item.href);

  return (
    <section
      aria-label="Nimbus has something for you"
      className={cn(
        'surface-card animate-fade-up flex items-center gap-3 py-3 pr-2 pl-4',
        alert && 'border-l-[3px] border-l-warn',
      )}
    >
      <Nimbus mood={alert ? 'alert' : 'calm'} size={40} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 font-medium text-ink">{item.title}</p>
        {item.detail && <p className="text-meta mt-0.5">{item.detail}</p>}
      </div>
      {showLink && (
        <AppLink
          href={item.href as string}
          className="hidden shrink-0 items-center gap-0.5 rounded-control px-2 py-1.5 text-sm font-medium text-accent-text transition-colors duration-150 ease-out hover:bg-accent-soft sm:inline-flex"
        >
          {item.cta ?? 'Open'}
          <ChevronRight className="size-4" />
        </AppLink>
      )}
      <IconButton label="Dismiss" onClick={() => actions.dismissAttention(item.id)} className="shrink-0">
        <X className="size-4" />
      </IconButton>
    </section>
  );
}
