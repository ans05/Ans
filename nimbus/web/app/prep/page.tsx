import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { Checklist } from "@/components/prep/Checklist";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { getApi } from "@/lib/server/api";

export const metadata: Metadata = { title: "Offline prep" };

export default async function PrepPage() {
  const view = await getApi().getPrep();
  const { checklist } = view;

  if (!checklist) {
    return (
      <>
        <PageHeader eyebrow="Before you fly" title="Offline prep" meta="No upcoming flights." />
        <EmptyState
          icon="checklist"
          title="Nothing to prepare"
          description="The checklist appears the evening before a flight, built from the tasks you planned for it."
        />
      </>
    );
  }

  const remaining = view.total - view.completed;

  return (
    <>
      <PageHeader
        eyebrow={`${checklist.flight.number} to ${checklist.flight.to.city} · ${view.departsLabel}`}
        title="Offline prep"
        meta={
          remaining === 0
            ? "Everything is on the device. You're ready to fly."
            : `${remaining} ${remaining === 1 ? "item" : "items"} to download before you go offline.`
        }
        aside={
          <Pill tone={remaining === 0 ? "accent" : "neutral"} className="tabular">
            {view.completed} of {view.total}
          </Pill>
        }
      />

      {!checklist.active ? (
        <p className="mb-5 rounded-xl border border-dashed border-line-2 px-4 py-3 text-[13px] text-ink-2">
          This list opens <span className="text-ink">{view.opensLabel}</span>, the evening before your
          flight. You can get ahead of it now.
        </p>
      ) : null}

      <Checklist items={checklist.items} groups={view.groups} />
    </>
  );
}
