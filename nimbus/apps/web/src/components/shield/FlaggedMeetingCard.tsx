'use client';

import { TemplateAiProvider, formatTime, localDate, weekdayName, zoneAbbreviation } from '@nimbus/core';
import { Check, Copy, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';
import type { FlaggedMeeting } from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';

const ai = new TemplateAiProvider();

export function FlaggedMeetingCard({ entry }: { entry: FlaggedMeeting }) {
  const { meeting, flag, upcoming } = entry;
  const snap = useSnapshot();
  const { state, actions } = useNimbus();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const draft = state.rescheduleDrafts[meeting.id];

  const localZone = flag.localTimeZone;
  const inviteZone = meeting.scheduledTimeZone;
  const localWeekday = weekdayName(localDate(meeting.start, localZone), 'short');
  const inviteWeekday = weekdayName(localDate(meeting.start, inviteZone), 'short');

  const generate = async () => {
    setBusy(true);
    try {
      const text = await ai.draftRescheduleMessage({ meeting, flag, trip: snap.week.trip, user: snap.week.user });
      actions.saveRescheduleDraft(meeting.id, text);
      actions.track('reschedule_message_generated', { meetingId: meeting.id, provider: 'template' });
      setCopied(false);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      toast('Message copied');
      actions.track('reschedule_message_copied', { meetingId: meeting.id });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Copy failed. Select the text to copy it.');
    }
  };

  return (
    <article className="surface-card border-l-[3px] border-l-warn p-4 md:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-[-0.01em]">{meeting.title}</h3>
          <p className="text-meta mt-0.5">
            {inviteWeekday} {formatTime(meeting.start, inviteZone)} {zoneAbbreviation(meeting.start, inviteZone)} on the invite · {meeting.organizer}
          </p>
        </div>
        {!upcoming && <Chip>Past</Chip>}
      </header>

      <p className="mt-4 text-[26px] leading-none font-semibold tracking-[-0.02em]">
        {formatTime(meeting.start, localZone)}
        <span className="ml-2 text-sm font-normal tracking-normal text-ink-2">
          {localWeekday}, your time in {snap.week.trip.destination.name}
        </span>
      </p>
      <p className="mt-2 text-sm text-ink-2">
        Suggested: {weekdayName(localDate(flag.suggestedStart, inviteZone), 'short')} {formatTime(flag.suggestedStart, inviteZone)}{' '}
        {zoneAbbreviation(flag.suggestedStart, inviteZone)}, which is {formatTime(flag.suggestedStart, localZone)} for you.
      </p>

      {draft ? (
        <div className="mt-4">
          <pre className="rounded-control bg-surface-2 p-4 font-sans text-sm leading-6 whitespace-pre-wrap text-ink">{draft}</pre>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={copy}>
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy message'}
            </Button>
            <Button variant="ghost" size="sm" onClick={generate} disabled={busy}>
              <RotateCcw className="size-3.5" aria-hidden />
              Redraft
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={generate} disabled={busy}>
            <Sparkles className="size-3.5" aria-hidden />
            {busy ? 'Drafting…' : 'Draft a reschedule note'}
          </Button>
        </div>
      )}
    </article>
  );
}
