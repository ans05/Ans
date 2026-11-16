import { describe, expect, it } from "vitest";

import {
  dayKeyOf,
  dayLengthMinutes,
  formatAxisHour,
  formatDuration,
  minutesIntoDay,
  overlapMinutes,
  subtractIntervals,
  wallClockMinutes,
  zoneAbbreviation,
  zoneOffsetDifferenceHours,
} from "./time";
import { LA, LONDON } from "./testing/fixtures";

describe("day boundaries", () => {
  it("knows how long a day really is across DST changes", () => {
    expect(dayLengthMinutes("2026-10-13", LA)).toBe(1440);
    expect(dayLengthMinutes("2026-11-01", LA)).toBe(1500); // clocks go back
    expect(dayLengthMinutes("2026-03-08", LA)).toBe(1380); // clocks go forward
    expect(dayLengthMinutes("2026-10-25", LONDON)).toBe(1500);
  });

  it("maps an instant to the calendar day in each zone", () => {
    const instant = "2026-10-14T16:30:00-07:00";
    expect(dayKeyOf(instant, LA)).toBe("2026-10-14");
    expect(dayKeyOf(instant, LONDON)).toBe("2026-10-15");
  });
});

describe("wall clock vs elapsed minutes", () => {
  it("agree on an ordinary day", () => {
    const t = "2026-10-13T09:30:00-07:00";
    expect(wallClockMinutes(t, LA)).toBe(570);
    expect(minutesIntoDay(t, "2026-10-13", LA)).toBe(570);
  });

  it("diverge after the clocks go back, and the wall clock is what a grid wants", () => {
    const t = "2026-11-01T09:00:00-08:00"; // 9 am PST, after the 25th hour
    expect(wallClockMinutes(t, LA)).toBe(540);
    expect(minutesIntoDay(t, "2026-11-01", LA)).toBe(600);
  });
});

describe("zone names and offsets", () => {
  it("gives short names in both summer and winter time", () => {
    expect(zoneAbbreviation("2026-10-13T12:00:00-07:00", LA)).toBe("PDT");
    expect(zoneAbbreviation("2026-11-05T12:00:00-08:00", LA)).toBe("PST");
    expect(zoneAbbreviation("2026-10-13T12:00:00+01:00", LONDON)).toBe("BST");
    expect(zoneAbbreviation("2026-11-05T12:00:00Z", LONDON)).toBe("GMT");
  });

  it("tracks the offset between zones as each changes its clocks", () => {
    expect(zoneOffsetDifferenceHours("2026-10-13T12:00:00Z", LA, LONDON)).toBe(8);
    // UK back to GMT on Oct 25, US still on PDT until Nov 1.
    expect(zoneOffsetDifferenceHours("2026-10-28T12:00:00Z", LA, LONDON)).toBe(7);
    expect(zoneOffsetDifferenceHours("2026-11-05T12:00:00Z", LA, LONDON)).toBe(8);
    expect(zoneOffsetDifferenceHours("2026-10-13T12:00:00Z", LONDON, LA)).toBe(-8);
  });
});

describe("formatting", () => {
  it("formats durations compactly", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(265)).toBe("4h 25m");
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(-5)).toBe("0m");
  });

  it("labels axis hours the way people read them", () => {
    expect(formatAxisHour(0)).toBe("12 am");
    expect(formatAxisHour(6 * 60)).toBe("6 am");
    expect(formatAxisHour(12 * 60)).toBe("noon");
    expect(formatAxisHour(23 * 60)).toBe("11 pm");
    expect(formatAxisHour(24 * 60)).toBe("12 am");
  });
});

describe("interval arithmetic", () => {
  const base = { start: "2026-10-13T10:00:00Z", end: "2026-10-13T12:00:00Z" };
  const minutes = (i: { start: string; end: string }) =>
    (new Date(i.end).getTime() - new Date(i.start).getTime()) / 60_000;

  it("returns the base untouched when nothing cuts it", () => {
    const [only] = subtractIntervals(base, []);
    expect(minutes(only!)).toBe(120);
    expect(subtractIntervals(base, [{ start: "2026-10-13T13:00:00Z", end: "2026-10-13T14:00:00Z" }])).toHaveLength(1);
  });

  it("splits around a cut in the middle", () => {
    const parts = subtractIntervals(base, [{ start: "2026-10-13T10:30:00Z", end: "2026-10-13T11:00:00Z" }]);
    expect(parts.map(minutes)).toEqual([30, 60]);
  });

  it("merges overlapping and touching cuts without emitting empty gaps", () => {
    const parts = subtractIntervals(base, [
      { start: "2026-10-13T10:30:00Z", end: "2026-10-13T11:00:00Z" },
      { start: "2026-10-13T10:45:00Z", end: "2026-10-13T11:15:00Z" },
      { start: "2026-10-13T11:15:00Z", end: "2026-10-13T11:30:00Z" },
    ]);
    expect(parts.map(minutes)).toEqual([30, 30]);
  });

  it("handles cuts that hang over either edge, or cover everything", () => {
    expect(subtractIntervals(base, [{ start: "2026-10-13T09:00:00Z", end: "2026-10-13T10:30:00Z" }]).map(minutes)).toEqual([90]);
    expect(subtractIntervals(base, [{ start: "2026-10-13T11:30:00Z", end: "2026-10-13T13:00:00Z" }]).map(minutes)).toEqual([90]);
    expect(subtractIntervals(base, [{ start: "2026-10-13T09:00:00Z", end: "2026-10-13T13:00:00Z" }])).toEqual([]);
  });

  it("measures overlap", () => {
    expect(overlapMinutes(base, { start: "2026-10-13T11:30:00Z", end: "2026-10-13T13:00:00Z" })).toBe(30);
    expect(overlapMinutes(base, { start: "2026-10-13T12:00:00Z", end: "2026-10-13T13:00:00Z" })).toBe(0);
  });
});
