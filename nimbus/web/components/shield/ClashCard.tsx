import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import type { ClashView } from "@/lib/server/views";

import { RescheduleDraft } from "./RescheduleDraft";

interface ClashCardProps {
  view: ClashView;
}

export function ClashCard({ view }: ClashCardProps) {
  const { clash } = view;
  const { meeting } = clash;

  return (
    <Card as="li" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink">{meeting.title}</h2>
            <Pill tone="warn" icon="alert">
              {clash.reason === "late" ? "Late night" : "Early morning"}
            </Pill>
            {!meeting.movable ? <Pill>Not movable</Pill> : null}
          </div>
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-medium text-ink tabular">{view.dayLabel} · {view.localLabel}</span>
            <span className="text-ink-3"> — scheduled for {view.homeLabel}</span>
            {meeting.organizer ? <span className="text-ink-3"> by {meeting.organizer}</span> : null}
          </p>
        </div>
        {view.alternative ? (
          <p className="flex shrink-0 items-start gap-1.5 text-[13px] text-ink-2 sm:max-w-[16rem] sm:text-right">
            <Icon name="sparkle" size={13} className="mt-0.5 shrink-0 text-accent-ink" />
            <span>
              Both awake: <span className="text-ink tabular">{view.alternative.home}</span>
              <span className="text-ink-3"> · {view.alternative.destination}</span>
            </span>
          </p>
        ) : null}
      </div>

      <RescheduleDraft meetingId={meeting.id} movable={meeting.movable} initialDraft={view.draft} />
    </Card>
  );
}
