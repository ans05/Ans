'use client';

import {
  describeConnectivity,
  describeContext,
  formatDuration,
  formatTimeRange,
  localDate,
  weekdayName,
  zoneAbbreviation,
  type FocusWindow,
} from '@nimbus/core';
import { Armchair, Car, Plane, Plus, X } from 'lucide-react';
import { useSnapshot } from '@/hooks/useSnapshot';
import { cn } from '@/lib/cn';
import { selectSuggestions, selectWindowTasks } from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { Button, IconButton } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Meter } from '@/components/ui/Meter';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useToast } from '@/components/ui/Toast';
import { TaskRow } from './TaskRow';

const CONTEXT_ICON = { flight: Plane, gate: Armchair, ride: Car } as const;

export function FocusWindowCard({ window, highlighted }: { window: FocusWindow; highlighted: boolean }) {
  const snap = useSnapshot();
  const { actions } = useNimbus();
  const { toast } = useToast();
  const planned = selectWindowTasks(snap, window.id);
  const suggestions = selectSuggestions(snap, window, 3);
  const plannedMinutes = planned.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const Icon = CONTEXT_ICON[window.context];
  const dayLabel = weekdayName(localDate(window.start, window.timeZone), 'short');

  const add = (taskId: string) => {
    actions.assignTask(taskId, window.id);
    actions.track('task_assigned_to_window', { taskId, windowId: window.id, windowMinutes: window.durationMinutes });
    toast('Added to this window');
  };

  return (
    <article
      id={window.id}
      className={cn('surface-card scroll-mt-24 p-4 transition-shadow duration-200 ease-out md:p-5', highlighted && 'ring-2 ring-accent')}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-[-0.01em]">{window.title}</h3>
          <p className="text-meta mt-0.5">
            {dayLabel} · {formatTimeRange(window.start, window.end, window.timeZone)} {zoneAbbreviation(window.start, window.timeZone)}
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          <Icon className="size-4" aria-hidden />
        </span>
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip tone={window.context === 'flight' ? 'night' : 'neutral'}>{describeContext(window.context)}</Chip>
        <Chip>{formatDuration(window.durationMinutes)}</Chip>
        <Chip>{describeConnectivity(window.connectivity)}</Chip>
        <Chip tone="accent">{window.mode === 'deep' ? 'deep work' : 'quick tasks'}</Chip>
      </div>

      {planned.length > 0 && (
        <section className="mt-5">
          <SectionTitle>Planned</SectionTitle>
          <ul className="mt-1 divide-y divide-line">
            {planned.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                action={
                  <IconButton label={`Remove ${task.title} from this window`} onClick={() => actions.assignTask(task.id, null)} className="size-8">
                    <X className="size-4" />
                  </IconButton>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <SectionTitle>Suggested</SectionTitle>
        {suggestions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">{planned.length ? 'Nothing else fits this window.' : 'No unplanned task fits this window.'}</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {suggestions.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                action={
                  <Button variant="primary" size="sm" onClick={() => add(task.id)}>
                    <Plus className="size-3.5" aria-hidden />
                    Add
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-5 flex items-center gap-3">
        <Meter value={plannedMinutes} max={window.durationMinutes} label="Planned time" className="flex-1" />
        <span className="text-meta shrink-0 tabular-nums">
          {formatDuration(Math.min(plannedMinutes, window.durationMinutes))} of {formatDuration(window.durationMinutes)} planned
        </span>
      </footer>
    </article>
  );
}
