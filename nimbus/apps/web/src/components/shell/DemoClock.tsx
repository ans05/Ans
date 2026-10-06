'use client';

import { DEMO_MOMENTS, formatDate, formatTime, localDate, zoneAbbreviation } from '@nimbus/core';
import { Clock } from 'lucide-react';
import { useId } from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';
import { LIVE_CLOCK_ID } from '@/lib/clock';
import { selectTodayDate } from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';

/**
 * Pins "now" to a moment in the sample week so every feature can be seen without
 * waiting for the real clock. A native select: accessible and great on phones.
 */
export function DemoClock() {
  const { state, actions, hydrated } = useNimbus();
  const snap = useSnapshot();
  const id = useId();
  const date = selectTodayDate(snap);
  const zone = snap.week.days.find((d) => d.date === date)?.timeZone ?? snap.week.user.homeTimeZone;
  const live = state.demoMomentId === LIVE_CLOCK_ID;
  const stamp = live && !hydrated ? '' : `${formatDate(localDate(snap.now, zone))} · ${formatTime(snap.now, zone)} ${zoneAbbreviation(snap.now, zone)}`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-meta hidden tabular-nums sm:inline" aria-live="polite">
        {stamp}
      </span>
      <label htmlFor={id} className="sr-only">
        Demo clock
      </label>
      <div className="relative">
        <Clock aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
        <select
          id={id}
          value={state.demoMomentId}
          onChange={(event) => actions.setDemoMoment(event.target.value)}
          className="h-8 max-w-[11rem] appearance-none rounded-full border border-line bg-surface pr-7 pl-8 text-xs font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2 focus-visible:outline-2"
        >
          {DEMO_MOMENTS.map((moment) => (
            <option key={moment.id} value={moment.id}>
              {moment.label}
            </option>
          ))}
          <option value={LIVE_CLOCK_ID}>Live clock</option>
        </select>
        <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-ink-3">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
