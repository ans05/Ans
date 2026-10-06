import type { IsoDate, IsoInstant, TimeZoneId } from '../domain/types';

/**
 * Time-zone helpers built on Intl only. No date library: the app needs a handful
 * of operations (local date, minutes into the day, local-to-UTC) and Intl covers
 * them with correct DST handling in every modern runtime.
 */

export const MINUTES_PER_DAY = 1440;
const MS_PER_MINUTE = 60_000;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const partsFormatters = new Map<TimeZoneId, Intl.DateTimeFormat>();

function partsFormatter(timeZone: TimeZoneId): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export type InstantLike = IsoInstant | Date | number;

export function toDate(instant: InstantLike): Date {
  if (instant instanceof Date) return instant;
  return new Date(instant);
}

/** ISO instant in UTC without milliseconds, the canonical form used in data. */
export function toIso(instant: InstantLike): IsoInstant {
  return toDate(instant).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function zonedParts(instant: InstantLike, timeZone: TimeZoneId): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(toDate(instant));
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')) % 24,
    minute: Number(read('minute')),
    second: Number(read('second')),
    weekday: WEEKDAY_SHORT.indexOf(read('weekday') as (typeof WEEKDAY_SHORT)[number]),
  };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Calendar date of an instant in a zone. */
export function localDate(instant: InstantLike, timeZone: TimeZoneId): IsoDate {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Minutes since local midnight for an instant in a zone. */
export function minutesIntoDay(instant: InstantLike, timeZone: TimeZoneId): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

/** Local hour (0-23) of an instant in a zone. */
export function localHour(instant: InstantLike, timeZone: TimeZoneId): number {
  return zonedParts(instant, timeZone).hour;
}

/** Offset of a zone from UTC at a given instant, in minutes (PDT = -420). */
export function zoneOffsetMinutes(instant: InstantLike, timeZone: TimeZoneId): number {
  const date = toDate(instant);
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - wholeSeconds) / MS_PER_MINUTE);
}

/**
 * Instant for a local wall-clock time. `minutes` is minutes after local midnight
 * and may exceed 1440 to express "tomorrow 01:30" on a given date.
 */
export function localToInstant(date: IsoDate, minutes: number, timeZone: TimeZoneId): IsoInstant {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(year, month - 1, day) + minutes * MS_PER_MINUTE;
  const firstOffset = zoneOffsetMinutes(guess, timeZone);
  let result = guess - firstOffset * MS_PER_MINUTE;
  const secondOffset = zoneOffsetMinutes(result, timeZone);
  if (secondOffset !== firstOffset) result = guess - secondOffset * MS_PER_MINUTE;
  return toIso(result);
}

export function startOfLocalDay(date: IsoDate, timeZone: TimeZoneId): IsoInstant {
  return localToInstant(date, 0, timeZone);
}

/** Length of a local day in minutes: 1440 except on DST transition days. */
export function localDayLengthMinutes(date: IsoDate, timeZone: TimeZoneId): number {
  return minutesBetween(startOfLocalDay(date, timeZone), startOfLocalDay(addDays(date, 1), timeZone));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function dateWeekday(date: IsoDate): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minutesBetween(from: InstantLike, to: InstantLike): number {
  return (toDate(to).getTime() - toDate(from).getTime()) / MS_PER_MINUTE;
}

export function addMinutes(instant: InstantLike, minutes: number): IsoInstant {
  return toIso(toDate(instant).getTime() + minutes * MS_PER_MINUTE);
}

export function isBefore(a: InstantLike, b: InstantLike): boolean {
  return toDate(a).getTime() < toDate(b).getTime();
}

/** Hours `toZone` is ahead of `fromZone` at an instant (London vs. SF in October: 8). */
export function offsetDifferenceHours(fromZone: TimeZoneId, toZone: TimeZoneId, at: InstantLike): number {
  return (zoneOffsetMinutes(at, toZone) - zoneOffsetMinutes(at, fromZone)) / 60;
}

// ---------------------------------------------------------------- formatting

export function formatTime(instant: InstantLike, timeZone: TimeZoneId): string {
  const p = zonedParts(instant, timeZone);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const suffix = p.hour < 12 ? 'AM' : 'PM';
  return `${hour12}:${pad2(p.minute)} ${suffix}`;
}

export function formatTimeRange(start: InstantLike, end: InstantLike, timeZone: TimeZoneId): string {
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`;
}

export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export interface FormatDateOptions {
  weekday?: 'short' | 'long' | 'none';
  month?: 'short' | 'long';
  year?: boolean;
}

/** "Tue 13 Oct", "Tuesday 13 October", "13 Oct 2026". */
export function formatDate(date: IsoDate, options: FormatDateOptions = {}): string {
  const { weekday = 'short', month = 'short', year = false } = options;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = dateWeekday(date);
  const weekdayText = weekday === 'none' ? '' : weekday === 'short' ? WEEKDAY_SHORT[wd] : WEEKDAY_LONG[wd];
  const monthText = month === 'short' ? MONTH_SHORT[m - 1] : MONTH_LONG[m - 1];
  const core = `${d} ${monthText}${year ? ` ${y}` : ''}`;
  return weekdayText ? `${weekdayText} ${core}` : core;
}

export function weekdayName(date: IsoDate, style: 'short' | 'long' = 'long'): string {
  const wd = dateWeekday(date);
  return style === 'short' ? WEEKDAY_SHORT[wd]! : WEEKDAY_LONG[wd]!;
}

const abbreviationCache = new Map<string, string>();

/** "PDT", "BST". Falls back to "GMT+1" style when no name exists. */
export function zoneAbbreviation(instant: InstantLike, timeZone: TimeZoneId): string {
  const date = toDate(instant);
  const key = `${timeZone}|${zoneOffsetMinutes(date, timeZone)}`;
  const cached = abbreviationCache.get(key);
  if (cached) return cached;
  const read = (locale: string): string =>
    new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';
  let name = read('en-US');
  if (/^GMT[+\-−]/.test(name) || name === 'GMT' || name === 'UTC') {
    const british = read('en-GB');
    if (british && !/^GMT[+\-−]/.test(british)) name = british;
  }
  abbreviationCache.set(key, name);
  return name;
}

/** "GMT+1" style offset label as a last resort, e.g. "UTC+1". */
export function offsetLabel(instant: InstantLike, timeZone: TimeZoneId): string {
  const offset = zoneOffsetMinutes(instant, timeZone);
  const sign = offset >= 0 ? '+' : '−';
  const abs = Math.abs(offset);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `UTC${sign}${hours}${mins ? `:${pad2(mins)}` : ''}`;
}
