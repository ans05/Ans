'use client';

import { formatDate, formatTime, localDate, weekdayName } from '@nimbus/core';
import { useSnapshot } from '@/hooks/useSnapshot';
import { selectShieldReport } from '@/lib/selectors';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { FlaggedMeetingCard } from './FlaggedMeetingCard';

export function ShieldView() {
  const snap = useSnapshot();
  const report = selectShieldReport(snap);
  const { trip } = snap.week;
  const destinationZone = trip.destination.timeZone;
  const tripDates = `${formatDate(localDate(trip.start, destinationZone), { weekday: 'none' })} – ${formatDate(localDate(trip.end, destinationZone), { weekday: 'none' })}`;
  const sign = report.hoursAhead >= 0 ? 'ahead' : 'behind';

  return (
    <>
      <PageHeader
        eyebrow="Time zone shield"
        title={`${trip.destination.name} is ${Math.abs(report.hoursAhead)} hours ${sign}`}
        meta={`${tripDates} · meetings between 10 PM and 7 AM local time get flagged`}
      />

      {report.flagged.length === 0 ? (
        <EmptyState title="Every meeting lands in daylight" detail="Nothing on your calendar falls between 10 PM and 7 AM while you are away." />
      ) : (
        <section className="flex flex-col gap-3" aria-label="Flagged meetings">
          <p className="text-sm text-ink-2">
            {report.flagged.length} {report.flagged.length === 1 ? 'meeting lands' : 'meetings land'} late at night for you.{' '}
            {report.okMeetings.length} {report.okMeetings.length === 1 ? 'other is' : 'others are'} fine.
          </p>
          {report.flagged.map((entry) => (
            <FlaggedMeetingCard key={entry.meeting.id} entry={entry} />
          ))}
        </section>
      )}

      {report.okMeetings.length > 0 && (
        <details className="group rounded-card border border-line">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:text-ink">
            <span className="inline-block transition-transform duration-150 ease-out group-open:rotate-90">›</span>
            <span className="ml-2">Meetings that are fine ({report.okMeetings.length})</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {report.okMeetings.map((meeting) => (
              <li key={meeting.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate text-sm text-ink">{meeting.title}</span>
                <span className="text-meta shrink-0 tabular-nums">
                  {weekdayName(localDate(meeting.start, destinationZone), 'short')} {formatTime(meeting.start, destinationZone)} local
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
