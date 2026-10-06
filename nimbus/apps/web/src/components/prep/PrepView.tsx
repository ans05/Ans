'use client';

import { addDays, formatDate, formatTime, localDate, zoneAbbreviation, type FlightSegment } from '@nimbus/core';
import { useState } from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';
import { cn } from '@/lib/cn';
import { selectFlights, selectNextDeparture, selectPrepChecklist } from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Meter } from '@/components/ui/Meter';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';

function relativeDay(flight: FlightSegment, now: Date): string {
  const zone = flight.from.timeZone;
  const today = localDate(now, zone);
  const flightDate = localDate(flight.start, zone);
  if (flightDate === today) return 'today';
  if (flightDate === addDays(today, 1)) return 'tomorrow';
  if (flightDate < today) return 'departed';
  return formatDate(flightDate);
}

export function PrepView() {
  const snap = useSnapshot();
  const { actions } = useNimbus();
  const flights = selectFlights(snap.week);
  const next = selectNextDeparture(snap) ?? flights[flights.length - 1];
  // A manual pick is kept only while the upcoming flight stays the same.
  const [pick, setPick] = useState<{ nextId: string | undefined; flightId: string } | null>(null);
  const flight = (pick?.nextId === next?.id ? flights.find((f) => f.id === pick?.flightId) : undefined) ?? next;
  const setFlightId = (flightId: string) => setPick({ nextId: next?.id, flightId });
  if (!flight) return <EmptyState title="No flights this week" />;

  const items = selectPrepChecklist(snap, flight);
  const fromTasks = items.filter((item) => item.source === 'task');
  const standard = items.filter((item) => item.source === 'standard');
  const done = items.filter((item) => item.done).length;
  const when = relativeDay(flight, snap.now);

  const toggle = (id: string, checked: boolean) => {
    actions.toggleChecklistItem(id);
    if (checked) actions.track('checklist_item_completed', { itemId: id, flightId: flight.id });
  };

  return (
    <>
      <PageHeader
        eyebrow="Offline prep"
        title={`Before ${flight.carrier} ${flight.flightNumber}`}
        meta={`Departs ${when} at ${formatTime(flight.start, flight.from.timeZone)} ${zoneAbbreviation(flight.start, flight.from.timeZone)} · ${flight.from.code} → ${flight.to.code}`}
      />

      {flights.length > 1 && (
        <div role="group" aria-label="Choose a flight" className="flex flex-wrap gap-1.5">
          {flights.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === flight.id}
              onClick={() => setFlightId(f.id)}
              className={cn(
                'h-8 rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-out',
                f.id === flight.id ? 'bg-ink text-canvas' : 'border border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              {f.carrier} {f.flightNumber} · {formatDate(localDate(f.start, f.from.timeZone))}
            </button>
          ))}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-2">
            <span className="text-2xl font-semibold tracking-[-0.02em] text-ink">{done}</span> of {items.length} ready
          </p>
          <Meter value={done} max={items.length} label="Checklist progress" className="max-w-40" />
        </div>

        <section className="mt-5">
          <SectionTitle>For the work you planned on board</SectionTitle>
          {fromTasks.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="Nothing planned for this flight yet"
                detail="Plan tasks into the flight window and the downloads they need show up here."
                action={
                  <LinkButton href="/focus" size="sm">
                    Plan the flight
                  </LinkButton>
                }
              />
            </div>
          ) : (
            <ul className="mt-2 flex flex-col">
              {fromTasks.map((item) => (
                <li key={item.id}>
                  <Checkbox id={item.id} checked={item.done} onChange={(checked) => toggle(item.id, checked)} label={item.label} description={item.taskTitle} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <SectionTitle>Always</SectionTitle>
          <ul className="mt-2 flex flex-col">
            {standard.map((item) => (
              <li key={item.id}>
                <Checkbox id={item.id} checked={item.done} onChange={(checked) => toggle(item.id, checked)} label={item.label} />
              </li>
            ))}
          </ul>
        </section>
      </Card>
    </>
  );
}
