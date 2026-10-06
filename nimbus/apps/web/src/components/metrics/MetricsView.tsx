'use client';

import { ANALYTICS_EVENT_NAMES, formatDuration, type AnalyticsEventName } from '@nimbus/core';
import { RotateCcw } from 'lucide-react';
import { useSnapshot } from '@/hooks/useSnapshot';
import { selectMetrics } from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Meter';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useToast } from '@/components/ui/Toast';
import { StatTile } from './StatTile';

const LABELS: Record<AnalyticsEventName, string> = {
  timeline_viewed: 'Timeline views',
  focus_window_viewed: 'Focus windows opened',
  task_assigned_to_window: 'Tasks planned into windows',
  reschedule_message_generated: 'Reschedule notes drafted',
  reschedule_message_copied: 'Reschedule notes copied',
  checklist_item_completed: 'Checklist items completed',
};

export function MetricsView() {
  const snap = useSnapshot();
  const { actions } = useNimbus();
  const { toast } = useToast();
  const metrics = selectMetrics(snap);
  const trip = metrics.perTrip[0];

  return (
    <>
      <PageHeader eyebrow="Metrics" title="Is Nimbus earning its keep?" meta="Product events recorded in this browser while you use the demo." />

      <Card className="p-5 md:p-6">
        <SectionTitle>North star · focus minutes planned per trip</SectionTitle>
        <p className="mt-3 text-[52px] leading-none font-semibold tracking-[-0.03em] md:text-[64px]">
          {metrics.northStarMinutes}
          <span className="ml-2 text-lg font-normal tracking-normal text-ink-3">min</span>
        </p>
        {trip && (
          <>
            <p className="mt-2 text-sm text-ink-2">
              {formatDuration(trip.plannedMinutes)} planned of {formatDuration(trip.availableMinutes)} available on {trip.tripName}.
            </p>
            <Meter value={trip.plannedMinutes} max={trip.availableMinutes} label="Share of focus time planned" className="mt-4" />
          </>
        )}
      </Card>

      <section>
        <SectionTitle>Events</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
          {ANALYTICS_EVENT_NAMES.map((name) => (
            <StatTile key={name} label={LABELS[name]} value={metrics.counts[name]} />
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <p className="text-meta">
          {metrics.totalEvents} {metrics.totalEvents === 1 ? 'event' : 'events'} recorded locally.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            actions.reset();
            toast('Demo data reset');
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset demo data
        </Button>
      </div>
    </>
  );
}
