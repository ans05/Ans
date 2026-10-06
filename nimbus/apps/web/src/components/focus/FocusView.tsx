'use client';

import { formatDuration, localDate, weekdayName, formatDate } from '@nimbus/core';
import { useEffect, useMemo } from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';
import { useAppNavigation } from '@/components/shell/navigation';
import { selectWindows } from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { FocusWindowCard } from './FocusWindowCard';

export function FocusView() {
  const snap = useSnapshot();
  const { actions } = useNimbus();
  const windows = selectWindows(snap);
  // /focus#window-id opens with that window highlighted and scrolled into view.
  const { hash: highlighted } = useAppNavigation();

  useEffect(() => {
    if (!highlighted) return;
    actions.track('focus_window_viewed', { windowId: highlighted, via: 'link' });
    const frame = requestAnimationFrame(() => document.getElementById(highlighted)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [actions, highlighted]);

  const groups = useMemo(() => {
    const byDate = new Map<string, typeof windows>();
    for (const w of windows) {
      const date = localDate(w.start, w.timeZone);
      byDate.set(date, [...(byDate.get(date) ?? []), w]);
    }
    return [...byDate.entries()];
  }, [windows]);

  const totalMinutes = windows.reduce((sum, w) => sum + w.durationMinutes, 0);

  return (
    <>
      <PageHeader
        eyebrow="Focus windows"
        title="Time you can use"
        meta={`${windows.length} windows · ${formatDuration(totalMinutes)} across ${snap.week.trip.name}`}
      />
      {groups.map(([date, dayWindows]) => (
        <section key={date} className="flex flex-col gap-3">
          <SectionTitle>
            {weekdayName(date)} · {formatDate(date, { weekday: 'none' })}
          </SectionTitle>
          {dayWindows.map((w) => (
            <FocusWindowCard key={w.id} window={w} highlighted={highlighted === w.id} />
          ))}
        </section>
      ))}
    </>
  );
}
