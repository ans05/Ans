"use client";

import { useState, useTransition } from "react";

import { draftRescheduleAction, trackAction } from "@/app/actions";
import { Button } from "@/components/ui/Button";

interface RescheduleDraftProps {
  meetingId: string;
  movable: boolean;
  initialDraft: string | null;
}

export function RescheduleDraft({ meetingId, movable, initialDraft }: RescheduleDraftProps) {
  const [draft, setDraft] = useState<string | null>(initialDraft);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      setDraft(await draftRescheduleAction(meetingId));
    });

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      void trackAction("reschedule_message_copied", { meetingId });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be unavailable; the text stays selectable.
    }
  };

  if (draft === null) {
    return (
      <div>
        <Button variant="primary" icon="sparkle" onClick={generate} disabled={pending}>
          {pending ? "Drafting…" : movable ? "Draft a reschedule note" : "Draft a heads-up"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`draft-${meetingId}`} className="sr-only">
        Reschedule note
      </label>
      <textarea
        id={`draft-${meetingId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.min(10, draft.split("\n").length + 1)}
        className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm leading-6 text-ink transition-colors duration-150 focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" icon={copied ? "check" : "copy"} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" onClick={generate} disabled={pending}>
          {pending ? "Drafting…" : "Redraft"}
        </Button>
      </div>
    </div>
  );
}
