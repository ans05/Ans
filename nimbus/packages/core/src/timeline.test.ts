import { describe, expect, it } from "vitest";

import { buildDayTimeline, clipToDay } from "./timeline";
import { block, LA, LONDON, meeting } from "./testing/fixtures";

const now = "2026-10-13T08:45:00-07:00";

describe("clipToDay", () => {
  const flight = block({ id: "flight", kind: "flight", start: "2026-10-13T13:40:00-07:00", end: "2026-10-14T08:05:00+01:00" });

  it("clips an overnight flight at midnight on the departure day", () => {
    const [p] = clipToDay([flight], "2026-10-13", LA);
    expect(p).toMatchObject({ startMinute: 820, endMinute: 1440, continuesFromPrevious: false, continuesToNext: true });
  });

  it("starts the same flight at midnight on the arrival day, in the arrival zone", () => {
    const [p] = clipToDay([flight], "2026-10-14", LONDON);
    expect(p).toMatchObject({ startMinute: 0, endMinute: 485, continuesFromPrevious: true, continuesToNext: false });
  });

  it("treats an item ending exactly at midnight as ending on this day", () => {
    const [p] = clipToDay([meeting({ start: "2026-10-13T23:00:00-07:00", end: "2026-10-14T00:00:00-07:00" })], "2026-10-13", LA);
    expect(p).toMatchObject({ endMinute: 1440, continuesToNext: false });
  });

  it("drops items outside the day and zero-length items", () => {
    const items = [
      meeting({ start: "2026-10-12T09:00:00-07:00", end: "2026-10-12T10:00:00-07:00" }),
      meeting({ start: "2026-10-13T09:00:00-07:00", end: "2026-10-13T09:00:00-07:00" }),
      meeting({ start: "2026-10-14T00:00:00-07:00", end: "2026-10-14T01:00:00-07:00" }),
    ];
    expect(clipToDay(items, "2026-10-13", LA)).toEqual([]);
  });

  it("positions by wall clock on a 25-hour day", () => {
    const [p] = clipToDay([meeting({ start: "2026-11-01T09:00:00-08:00", end: "2026-11-01T10:00:00-08:00" })], "2026-11-01", LA);
    expect(p).toMatchObject({ startMinute: 540, endMinute: 600 });
  });

  it("sorts by start, longest first on ties", () => {
    const items = [
      meeting({ id: "b", start: "2026-10-13T10:00:00-07:00", end: "2026-10-13T10:30:00-07:00" }),
      meeting({ id: "a", start: "2026-10-13T09:00:00-07:00", end: "2026-10-13T09:30:00-07:00" }),
      meeting({ id: "c", start: "2026-10-13T10:00:00-07:00", end: "2026-10-13T11:00:00-07:00" }),
    ];
    expect(clipToDay(items, "2026-10-13", LA).map((p) => p.item.id)).toEqual(["a", "c", "b"]);
  });
});

describe("buildDayTimeline", () => {
  it("shows a default working-hours axis on an empty day", () => {
    const t = buildDayTimeline({ date: "2026-10-13", zone: LA, travelBlocks: [], meetings: [], focusWindows: [], now });
    expect(t.axisStart).toBe(7 * 60);
    expect(t.axisEnd).toBe(20 * 60);
    expect(t.nowMinute).toBe(525);
  });

  it("widens the axis to whole hours around early and late items", () => {
    const t = buildDayTimeline({
      date: "2026-10-13",
      zone: LA,
      travelBlocks: [],
      meetings: [
        meeting({ start: "2026-10-13T06:15:00-07:00", end: "2026-10-13T06:45:00-07:00" }),
        meeting({ start: "2026-10-13T21:30:00-07:00", end: "2026-10-13T22:30:00-07:00" }),
      ],
      focusWindows: [],
      now,
    });
    expect(t.axisStart).toBe(6 * 60);
    expect(t.axisEnd).toBe(23 * 60);
  });

  it("never extends past midnight and leaves now empty on another day", () => {
    const t = buildDayTimeline({
      date: "2026-10-14",
      zone: LONDON,
      travelBlocks: [block({ start: "2026-10-13T13:40:00-07:00", end: "2026-10-14T08:05:00+01:00" })],
      meetings: [meeting({ start: "2026-10-14T23:30:00+01:00", end: "2026-10-15T00:30:00+01:00" })],
      focusWindows: [],
      now,
    });
    expect(t.axisStart).toBe(0);
    expect(t.axisEnd).toBe(1440);
    expect(t.nowMinute).toBeNull();
  });
});
