import type { AiProvider, RescheduleDraftInput, TaskSuggestion } from '../ports/ai';
import type { FocusWindow, Task } from '../domain/types';
import { suggestTasksForWindow } from '../algorithms/taskFit';
import { formatTime, localDate, weekdayName, zoneAbbreviation } from '../time';

/** Deterministic drafts. Also the fallback when the model is unavailable. */
export function draftRescheduleMessage({ meeting, flag, trip, user }: RescheduleDraftInput): string {
  const organizerFirstName = meeting.organizer.split(' ')[0] ?? meeting.organizer;
  const localStart = formatTime(meeting.start, flag.localTimeZone);
  const weekday = weekdayName(localDate(meeting.start, flag.localTimeZone));
  const organizerZone = meeting.scheduledTimeZone;
  const suggestedDay = weekdayName(localDate(flag.suggestedStart, organizerZone));
  const suggestedForOrganizer = `${suggestedDay} at ${formatTime(flag.suggestedStart, organizerZone)} ${zoneAbbreviation(flag.suggestedStart, organizerZone)}`;
  const suggestedForUser = `${formatTime(flag.suggestedStart, flag.localTimeZone)} ${zoneAbbreviation(flag.suggestedStart, flag.localTimeZone)}`;

  return [
    `Hi ${organizerFirstName},`,
    '',
    `I'll be in ${trip.destination.name} that week, so our ${meeting.title} on ${weekday} would land at ${localStart} my time. ` +
      `Could we move it to ${suggestedForOrganizer}? That's ${suggestedForUser} for me. ` +
      `If that doesn't work, I'm happy to find another time that suits you.`,
    '',
    'Thanks,',
    user.firstName,
  ].join('\n');
}

const REASONS: Record<Task['mode'], string> = {
  deep: 'Long, uninterrupted stretch suits deep work',
  quick: 'Short enough to finish before boarding',
};

export class TemplateAiProvider implements AiProvider {
  async draftRescheduleMessage(input: RescheduleDraftInput): Promise<string> {
    return draftRescheduleMessage(input);
  }

  async suggestTasks(window: FocusWindow, candidates: Task[]): Promise<TaskSuggestion[]> {
    return suggestTasksForWindow(window, candidates).map((task) => ({
      taskId: task.id,
      reason: task.needsConnectivity ? 'Needs a connection, and this window has one' : REASONS[window.mode],
    }));
  }
}
