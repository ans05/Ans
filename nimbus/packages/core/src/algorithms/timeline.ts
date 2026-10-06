import type { FocusWindow, IsoDate, Meeting, Task, TimeZoneId, TravelSegment } from '../domain/types';
import { formatDuration, formatTime, localDayLengthMinutes, minutesBetween, startOfLocalDay, zoneAbbreviation } from '../time';

export type TimelineLane = 'travel' | 'work';
export type TimelineBlockKind = 'flight' | 'airport' | 'ride' | 'meeting' | 'focus';

export interface TimelineBlock {
  id: string;
  /** Id of the underlying segment, meeting or focus window. */
  refId: string;
  kind: TimelineBlockKind;
  lane: TimelineLane;
  /** Minutes after local midnight, clipped to the day. */
  startMin: number;
  endMin: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  title: string;
  subtitle: string;
  /** Meeting that the time-zone shield flagged. */
  flagged?: boolean;
  /** Titles of tasks planned into a focus window. */
  taskTitles?: string[];
}

export interface DayTimeline {
  date: IsoDate;
  timeZone: TimeZoneId;
  dayLengthMin: number;
  /** Visible range, snapped to whole hours. */
  rangeStartMin: number;
  rangeEndMin: number;
  blocks: TimelineBlock[];
}

export interface BuildDayTimelineInput {
  date: IsoDate;
  timeZone: TimeZoneId;
  segments: TravelSegment[];
  meetings: Meeting[];
  focusWindows: FocusWindow[];
  tasks: Task[];
  flaggedMeetingIds?: ReadonlySet<string>;
  /**
   * Earliest instant this day may show. When the previous day was displayed in
   * another zone and ran past this day's local midnight, the day starts where
   * that one ended so no moment appears twice (flying east, the first day in
   * London starts at 8 AM: midnight Pacific).
   */
  notBefore?: string;
  /** Hours always shown even when the day is empty. */
  defaultRange?: { startHour: number; endHour: number };
}

interface Clipped {
  startMin: number;
  endMin: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

function clip(dayStart: string, windowStart: number, dayLength: number, start: string, end: string): Clipped | null {
  const s = minutesBetween(dayStart, start);
  const e = minutesBetween(dayStart, end);
  if (e <= windowStart || s >= dayLength) return null;
  return {
    startMin: Math.max(windowStart, s),
    endMin: Math.min(dayLength, e),
    continuesBefore: s < windowStart,
    continuesAfter: e > dayLength,
  };
}

function segmentCopy(segment: TravelSegment, timeZone: TimeZoneId): { title: string; subtitle: string } {
  switch (segment.kind) {
    case 'flight': {
      const depart = `${formatTime(segment.start, segment.from.timeZone)} ${zoneAbbreviation(segment.start, segment.from.timeZone)}`;
      const arrive = `${formatTime(segment.end, segment.to.timeZone)} ${zoneAbbreviation(segment.end, segment.to.timeZone)}`;
      return {
        title: `${segment.carrier} ${segment.flightNumber} · ${segment.from.code ?? segment.from.name} → ${segment.to.code ?? segment.to.name}`,
        subtitle: `${depart} → ${arrive} · ${formatDuration(minutesBetween(segment.start, segment.end))}`,
      };
    }
    case 'airport':
      return {
        title: `${segment.place.code ?? segment.place.name} · ${segment.phase === 'departure' ? 'Check-in and security' : 'Arrival'}`,
        subtitle: `${formatTime(segment.start, timeZone)} – ${formatTime(segment.end, timeZone)}`,
      };
    case 'ride':
      return {
        title: `${segment.from} → ${segment.to}`,
        subtitle: `${segment.mode === 'car' ? 'Car' : 'Train'} · ${formatDuration(minutesBetween(segment.start, segment.end))}`,
      };
  }
}

/** Merge travel segments, meetings and focus windows into one clipped, sorted day. */
export function buildDayTimeline(input: BuildDayTimelineInput): DayTimeline {
  const { date, timeZone, defaultRange = { startHour: 6, endHour: 22 } } = input;
  const flagged = input.flaggedMeetingIds ?? new Set<string>();
  const dayStart = startOfLocalDay(date, timeZone);
  const dayLength = localDayLengthMinutes(date, timeZone);
  const windowStart = input.notBefore ? Math.min(dayLength, Math.max(0, minutesBetween(dayStart, input.notBefore))) : 0;
  const blocks: TimelineBlock[] = [];

  for (const segment of input.segments) {
    const clipped = clip(dayStart, windowStart, dayLength, segment.start, segment.end);
    if (!clipped) continue;
    blocks.push({ id: `seg:${segment.id}`, refId: segment.id, kind: segment.kind, lane: 'travel', ...clipped, ...segmentCopy(segment, timeZone) });
  }

  for (const meeting of input.meetings) {
    const clipped = clip(dayStart, windowStart, dayLength, meeting.start, meeting.end);
    if (!clipped) continue;
    blocks.push({
      id: `mtg:${meeting.id}`,
      refId: meeting.id,
      kind: 'meeting',
      lane: 'work',
      ...clipped,
      title: meeting.title,
      subtitle: `${formatTime(meeting.start, timeZone)} – ${formatTime(meeting.end, timeZone)} · ${meeting.organizer}`,
      flagged: flagged.has(meeting.id),
    });
  }

  for (const window of input.focusWindows) {
    const clipped = clip(dayStart, windowStart, dayLength, window.start, window.end);
    if (!clipped) continue;
    const taskTitles = input.tasks.filter((task) => task.assignedWindowId === window.id).map((task) => task.title);
    blocks.push({
      id: `win:${window.id}`,
      refId: window.id,
      kind: 'focus',
      lane: 'work',
      ...clipped,
      title: 'Focus window',
      subtitle: `${formatDuration(window.durationMinutes)} · ${describeConnectivity(window.connectivity)} · ${window.mode === 'deep' ? 'deep work' : 'quick tasks'}`,
      taskTitles,
    });
  }

  blocks.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const earliest = blocks.reduce((min, block) => Math.min(min, block.startMin), defaultRange.startHour * 60);
  const latest = blocks.reduce((max, block) => Math.max(max, block.endMin), defaultRange.endHour * 60);
  const rangeStartMin = Math.max(Math.floor(windowStart / 60) * 60, Math.floor(earliest / 60) * 60);
  const rangeEndMin = Math.max(rangeStartMin + 60, Math.min(dayLength, Math.ceil(latest / 60) * 60));

  return { date, timeZone, dayLengthMin: dayLength, rangeStartMin, rangeEndMin, blocks };
}

export function describeConnectivity(connectivity: FocusWindow['connectivity']): string {
  switch (connectivity) {
    case 'wifi':
      return 'Wi-Fi';
    case 'mobile':
      return 'patchy signal';
    case 'offline':
      return 'offline';
  }
}

export function describeContext(context: FocusWindow['context']): string {
  switch (context) {
    case 'flight':
      return 'Flight';
    case 'gate':
      return 'Gate';
    case 'ride':
      return 'Ride';
  }
}
