import { addDays, differenceInMinutes, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, getTimezoneOffset } from "date-fns-tz";

import type { DayKey, IsoDateTime, TimeInterval, Zone } from "./types";

export const MINUTES_PER_DAY = 24 * 60;

export const toDate = (value: IsoDateTime | Date): Date =>
  value instanceof Date ? value : parseISO(value);

export const toIso = (date: Date, zone: Zone): IsoDateTime =>
  formatInTimeZone(date, zone, "yyyy-MM-dd'T'HH:mm:ssXXX");

export const dayKeyOf = (value: IsoDateTime | Date, zone: Zone): DayKey =>
  formatInTimeZone(toDate(value), zone, "yyyy-MM-dd");

export const shiftDay = (day: DayKey, days: number): DayKey =>
  format(addDays(parseISO(day), days), "yyyy-MM-dd");

/** The instant at which `day` begins in `zone` (DST-safe). */
export const dayStart = (day: DayKey, zone: Zone): Date =>
  fromZonedTime(`${day}T00:00:00`, zone);

/** The instant at which `day` ends in `zone`, i.e. the next day's start. */
export const dayEnd = (day: DayKey, zone: Zone): Date =>
  dayStart(shiftDay(day, 1), zone);

/** Build an instant from a local wall-clock time in `zone`. */
export const atLocalTime = (day: DayKey, hhmm: string, zone: Zone): Date =>
  fromZonedTime(`${day}T${hhmm}:00`, zone);

export const minutesBetween = (
  from: IsoDateTime | Date,
  to: IsoDateTime | Date,
): number => differenceInMinutes(toDate(to), toDate(from));

export const addMinutes = (value: IsoDateTime | Date, minutes: number): Date =>
  new Date(toDate(value).getTime() + minutes * 60_000);

/** Minutes elapsed since local midnight of `day` in `zone`. May exceed a day or be negative. */
export const minutesIntoDay = (
  value: IsoDateTime | Date,
  day: DayKey,
  zone: Zone,
): number => (toDate(value).getTime() - dayStart(day, zone).getTime()) / 60_000;

export const localHour = (value: IsoDateTime | Date, zone: Zone): number =>
  Number(formatInTimeZone(toDate(value), zone, "H"));

/**
 * Minutes shown on a wall clock in `zone`: 9:30 am → 570. Unlike
 * `minutesIntoDay` this is unaffected by DST transitions earlier in the day,
 * which is what a calendar grid wants.
 */
export const wallClockMinutes = (value: IsoDateTime | Date, zone: Zone): number => {
  const date = toDate(value);
  return Number(formatInTimeZone(date, zone, "H")) * 60 + Number(formatInTimeZone(date, zone, "m"));
};

/** Real length of a calendar day in `zone`: 1440, or 1380 / 1500 across a DST change. */
export const dayLengthMinutes = (day: DayKey, zone: Zone): number =>
  (dayEnd(day, zone).getTime() - dayStart(day, zone).getTime()) / 60_000;

/** How many hours `toZone` is ahead of `fromZone` at a given instant (negative = behind). */
export const zoneOffsetDifferenceHours = (
  value: IsoDateTime | Date,
  fromZone: Zone,
  toZone: Zone,
): number => {
  const date = toDate(value);
  return (getTimezoneOffset(toZone, date) - getTimezoneOffset(fromZone, date)) / 3_600_000;
};

export const compareIso = (a: IsoDateTime, b: IsoDateTime): number =>
  toDate(a).getTime() - toDate(b).getTime();

export const isBefore = (a: IsoDateTime | Date, b: IsoDateTime | Date): boolean =>
  toDate(a).getTime() < toDate(b).getTime();

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "1:40 pm" */
export const formatTime = (value: IsoDateTime | Date, zone: Zone): string =>
  formatInTimeZone(toDate(value), zone, "h:mm a").toLowerCase();

/** "1:40 pm – 3:05 pm" */
export const formatRange = (
  start: IsoDateTime | Date,
  end: IsoDateTime | Date,
  zone: Zone,
): string => `${formatTime(start, zone)} – ${formatTime(end, zone)}`;

/** "Tuesday, October 13" */
export const formatDayLong = (day: DayKey): string =>
  format(parseISO(day), "EEEE, MMMM d");

/** "Tue" and "13" for compact day pickers. */
export const formatDayParts = (day: DayKey): { weekday: string; dayOfMonth: string } => {
  const date = parseISO(day);
  return { weekday: format(date, "EEE"), dayOfMonth: format(date, "d") };
};

/** "Oct 14 – 17" */
export const formatDayRange = (start: DayKey, end: DayKey): string => {
  const a = parseISO(start);
  const b = parseISO(end);
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${format(a, "MMM d")} – ${format(b, "d")}`
    : `${format(a, "MMM d")} – ${format(b, "MMM d")}`;
};

/** "4h 25m", "45m", "4h" */
export const formatDuration = (minutes: number): string => {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/** Axis label for a minute-of-day: "6 am", "noon", "11 pm". */
export const formatAxisHour = (minuteOfDay: number): string => {
  const hour = Math.floor(minuteOfDay / 60) % 24;
  if (hour === 0) return "12 am";
  if (hour === 12) return "noon";
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`;
};

const zoneNameFormatter = (locale: string, zone: Zone) =>
  new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "short" });

/**
 * Short zone name at an instant: "PDT", "BST". Falls back from the US locale
 * (which says "GMT+1" for London) to the UK locale, then to a UTC offset.
 */
export const zoneAbbreviation = (value: IsoDateTime | Date, zone: Zone): string => {
  const date = toDate(value);
  const pick = (locale: string) =>
    zoneNameFormatter(locale, zone)
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
  const us = pick("en-US");
  if (us && !/^GMT[+-]/.test(us)) return us;
  const gb = pick("en-GB");
  if (gb && !/^GMT[+-]/.test(gb)) return gb;
  return us ?? formatInTimeZone(date, zone, "XXX");
};

// ---------------------------------------------------------------------------
// Interval arithmetic
// ---------------------------------------------------------------------------

export const intervalMinutes = (interval: TimeInterval): number =>
  minutesBetween(interval.start, interval.end);

export const overlaps = (a: TimeInterval, b: TimeInterval): boolean =>
  isBefore(a.start, b.end) && isBefore(b.start, a.end);

export const overlapMinutes = (a: TimeInterval, b: TimeInterval): number => {
  const start = Math.max(toDate(a.start).getTime(), toDate(b.start).getTime());
  const end = Math.min(toDate(a.end).getTime(), toDate(b.end).getTime());
  return Math.max(0, (end - start) / 60_000);
};

/**
 * Remove `cuts` from `base`, returning the remaining sub-intervals in order.
 * Cuts may overlap each other or extend past the base.
 */
export const subtractIntervals = (
  base: TimeInterval,
  cuts: TimeInterval[],
): TimeInterval[] => {
  const sorted = cuts
    .filter((c) => overlaps(base, c))
    .sort((a, b) => compareIso(a.start, b.start));

  const result: TimeInterval[] = [];
  let cursor = toDate(base.start).getTime();
  const baseEnd = toDate(base.end).getTime();

  for (const cut of sorted) {
    const cutStart = toDate(cut.start).getTime();
    const cutEnd = toDate(cut.end).getTime();
    if (cutStart > cursor) {
      result.push({
        start: new Date(cursor).toISOString(),
        end: new Date(Math.min(cutStart, baseEnd)).toISOString(),
      });
    }
    cursor = Math.max(cursor, cutEnd);
    if (cursor >= baseEnd) break;
  }
  if (cursor < baseEnd) {
    result.push({
      start: new Date(cursor).toISOString(),
      end: new Date(baseEnd).toISOString(),
    });
  }
  return result;
};
