import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { ClashCard } from "@/components/shield/ClashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApi } from "@/lib/server/api";

export const metadata: Metadata = { title: "Time zone shield" };

export default async function ShieldPage() {
  const view = await getApi().getShield();
  const n = view.clashes.length;

  return (
    <>
      <PageHeader
        eyebrow={`${view.destinationCity} · ${view.tripDatesLabel}`}
        title="Time zone shield"
        meta={`${view.destinationCity} is ${view.offsetLabel}. ${
          n === 0
            ? "Nothing on your calendar lands overnight."
            : `${n} ${n === 1 ? "meeting lands" : "meetings land"} between 10 pm and 7 am while you're there.`
        }`}
      />

      {n === 0 ? (
        <EmptyState
          icon="shield"
          title="All clear"
          description="No meetings fall between 10 pm and 7 am local time. Sleep well."
        />
      ) : (
        <ul className="space-y-3">
          {view.clashes.map((c) => (
            <ClashCard key={c.clash.meeting.id} view={c} />
          ))}
        </ul>
      )}
    </>
  );
}
