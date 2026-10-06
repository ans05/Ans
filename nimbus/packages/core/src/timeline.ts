import { dayEnd, dayKeyOf, dayStart, MINUTES_PER_DAY, minutesIntoDay, toDate } from "./time";
import type {
  DayKey,
  FocusWindow,
  IsoDateTime,
  Meeting,
  TimeInterval,
  TravelBlock,
  Zone,
} from "./types";

/** An item placed on a day's vertical axis, in minutes from local midnight. */
export interface Positioned<T extends TimeInterval> {
  item: T;
  startMinute: number;
  endMinute: number;
  /** True when the item began before this day (it continues from yesterday). */
  continuesFromPrevious: boolean;
  /** True when the item ends after this day (it continues into tomorrow). */
  continuesToNext: boolean;
}

export interface DayTimeline {
  date: DayKey;
  zone: Zone;
  /** First and last minute shown on the axis, aligned to whole hours. */
  axisStart: number;
  axisEnd: number;
  travel: Positioned<TravelBlock>[];
  work: Positioned<Meeting>[];
  focus: Positioned<FocusWindow>[];
  /** Position of "now" on this day's axis, or null if now is a different day. */
  nowMinute: number | null;
}

export interface BuildDayTimelineInput {
  date: DayKey;
  zone: Zone;
  travelBlocks: TravelBlock[];
  meetings: Meeting[];
  focusWindows: FocusWindow[];
  now: IsoDateTime | Date;
  /** Earliest hour always shown, even on an empty day. */
  minStartHour?: number;
  /** Latest hour always shown, even on an empty day. */
  minEndHour?: number;
}

const clipToDay = <T extends TimeInterval>(
  items: T[],
  date: DayKey,
  zone: Zone,
): Positioned<T>[] => {
  const start = dayStart(date, zone).getTime();
  const end = dayEnd(date, zone).getTime();

  return items
    .filter((item) => {
      const s = toDate(item.start).getTime();
      const e = toDate(item.end).getTime();
      return s < end && e > start;
    })
    .map((item) => {
      const startMinute = Math.max(0, minutesIntoDay(item.start, date, zone));
      const rawEnd = minutesIntoDay(item.end, date, zone);
      const dayLength = (end - start) / 60_000;
      return {
        item,
        startMinute,
        endMinute: Math.min(dayLength, rawEnd),
        continuesFromPrevious: toDate(item.start).getTime() < start,
        continuesToNext: toDate(item.end).getTime() > end,
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute);
};

/** Merge travel and work into one day with a shared axis. */
export const buildDayTimeline = ({
  date,
  zone,
  travelBlocks,
  meetings,
  focusWindows,
  now,
  minStartHour = 7,
  minEndHour = 20,
}: BuildDayTimelineInput): DayTimeline => {
  const travel = clipToDay(travelBlocks, date, zone);
  const work = clipToDay(meetings, date, zone);
  const focus = clipToDay(focusWindows, date, zone);

  const all = [...travel, ...work, ...focus];
  const earliest = Math.min(minStartHour * 60, ...all.map((p) => p.startMinute));
  const latest = Math.max(minEndHour * 60, ...all.map((p) => p.endMinute));

  const axisStart = Math.max(0, Math.floor(earliest / 60) * 60);
  const axisEnd = Math.min(MINUTES_PER_DAY, Math.ceil(latest / 60) * 60);

  const nowMinute =
    dayKeyOf(now, zone) === date ? minutesIntoDay(now, date, zone) : null;

  return { date, zone, axisStart, axisEnd, travel, work, focus, nowMinute };
};
