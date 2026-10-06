import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatTime,
  localDate,
  localDayLengthMinutes,
  localToInstant,
  minutesIntoDay,
  offsetDifferenceHours,
  zoneAbbreviation,
  zoneOffsetMinutes,
} from '../src';

const LA = 'America/Los_Angeles';
const LONDON = 'Europe/London';

describe('time helpers', () => {
  it('converts local wall-clock time to an instant', () => {
    expect(localToInstant('2026-10-13', 16 * 60, LA)).toBe('2026-10-13T23:00:00Z');
    expect(localToInstant('2026-10-14', 13 * 60 + 40, LONDON)).toBe('2026-10-14T12:40:00Z');
  });

  it('reads local date and minutes in a zone', () => {
    expect(localDate('2026-10-14T02:05:00Z', LA)).toBe('2026-10-13');
    expect(localDate('2026-10-14T02:05:00Z', LONDON)).toBe('2026-10-14');
    expect(minutesIntoDay('2026-10-14T02:05:00Z', LA)).toBe(19 * 60 + 5);
  });

  it('knows offsets, differences and abbreviations', () => {
    expect(zoneOffsetMinutes('2026-10-14T12:00:00Z', LA)).toBe(-420);
    expect(zoneOffsetMinutes('2026-10-14T12:00:00Z', LONDON)).toBe(60);
    expect(offsetDifferenceHours(LA, LONDON, '2026-10-14T12:00:00Z')).toBe(8);
    expect(zoneAbbreviation('2026-10-14T12:00:00Z', LA)).toBe('PDT');
    expect(zoneAbbreviation('2026-10-14T12:00:00Z', LONDON)).toBe('BST');
  });

  it('handles DST transition days', () => {
    // US clocks fall back on 1 Nov 2026: a 25-hour day.
    expect(localDayLengthMinutes('2026-11-01', LA)).toBe(1500);
    expect(localDayLengthMinutes('2026-10-13', LA)).toBe(1440);
  });

  it('formats times and durations', () => {
    expect(formatTime('2026-10-14T02:05:00Z', LA)).toBe('7:05 PM');
    expect(formatTime('2026-10-14T07:00:00Z', LA)).toBe('12:00 AM');
    expect(formatDuration(635)).toBe('10h 35m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(45)).toBe('45m');
  });
});
