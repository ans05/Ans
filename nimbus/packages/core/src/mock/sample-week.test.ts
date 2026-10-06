import { describe, expect, it } from "vitest";

import { detectFocusWindows } from "../focusWindows";
import { dayKeyOf } from "../time";
import { findClashes } from "../timezoneShield";
import { sampleWeek } from "./index";

describe("sample week fixture", () => {
  const { trip, meetings, tasks, assignments } = sampleWeek;

  it("matches the brief: 2 flights, 1 time-zone change, ~10 meetings, ~8 tasks", () => {
    expect(trip.flights).toHaveLength(2);
    expect(trip.homeZone).not.toBe(trip.destinationZone);
    expect(meetings.filter((m) => m.kind === "meeting").length).toBeGreaterThanOrEqual(10);
    expect(tasks).toHaveLength(8);
  });

  it("keeps every travel block inside the trip and every flight tied to a block", () => {
    const tripDays = new Set(trip.days.map((d) => d.date));
    for (const block of trip.travelBlocks) {
      expect(new Date(block.start) < new Date(block.end), block.id).toBe(true);
      const startsOnTripDay =
        tripDays.has(dayKeyOf(block.start, trip.homeZone)) ||
        tripDays.has(dayKeyOf(block.start, trip.destinationZone));
      expect(startsOnTripDay, block.id).toBe(true);
    }
    for (const flight of trip.flights) {
      expect(trip.travelBlocks.some((b) => b.flightId === flight.id)).toBe(true);
    }
  });

  it("pre-assigns tasks only to windows that exist and tasks that fit", () => {
    const windows = detectFocusWindows(trip.travelBlocks, meetings);
    const byId = new Map(windows.map((w) => [w.id, w]));
    for (const a of assignments) {
      const window = byId.get(a.windowId);
      const task = tasks.find((t) => t.id === a.taskId);
      expect(window, a.windowId).toBeDefined();
      expect(task, a.taskId).toBeDefined();
      expect(task!.estimateMinutes).toBeLessThanOrEqual(window!.minutes);
    }
  });

  it("produces a few time-zone clashes to demo the shield", () => {
    const clashes = findClashes(meetings, trip);
    expect(clashes.length).toBeGreaterThanOrEqual(2);
    expect(clashes.map((c) => c.meeting.id)).toContain("m-metrics-review");
  });
});
