import type { Metadata } from "next";

import { formatDuration } from "@nimbus/core";

import { FocusWindowCard } from "@/components/focus/FocusWindowCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApi } from "@/lib/server/api";
import type { FocusWindowView } from "@/lib/server/views";

export const metadata: Metadata = { title: "Focus windows" };

interface PageProps {
  searchParams: Promise<{ window?: string }>;
}

const groupByDay = (windows: FocusWindowView[]) => {
  const groups = new Map<string, { label: string; windows: FocusWindowView[] }>();
  for (const w of windows) {
    const group = groups.get(w.day) ?? { label: w.dayLabel, windows: [] };
    group.windows.push(w);
    groups.set(w.day, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};

export default async function FocusPage({ searchParams }: PageProps) {
  const { window: openId } = await searchParams;
  const view = await getApi().getFocus();
  const groups = groupByDay(view.windows);

  return (
    <>
      <PageHeader
        eyebrow="Usable time while travelling"
        title="Focus windows"
        meta={
          view.windows.length
            ? `${view.windows.length} windows · ${formatDuration(view.totalMinutes)} usable · ${formatDuration(view.plannedMinutes)} planned across ${view.tasksPlanned} ${view.tasksPlanned === 1 ? "task" : "tasks"}`
            : "No travel on this trip yet."
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon="focus"
          title="No focus windows"
          description="Once a trip has rides, gate waits or flights, the usable gaps show up here."
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([day, group]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2
                id={`day-${day}`}
                className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-3"
              >
                {group.label}
              </h2>
              <ul className="space-y-3">
                {group.windows.map((w) => (
                  <FocusWindowCard
                    key={w.window.id}
                    view={w}
                    defaultOpen={w.window.id === openId}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
