import { describe, expect, it } from "vitest";

import { detectFocusWindows } from "./focusWindows";
import { suggestTasksForWindow, taskFitsWindow } from "./taskFit";
import { block, task } from "./testing/fixtures";

const flightWindow = () =>
  detectFocusWindows([block({ id: "flight", kind: "flight", connectivity: "offline", start: "2026-10-13T13:40:00-07:00", end: "2026-10-13T23:40:00-07:00" })], [])[0]!;
const gateWindow = () =>
  detectFocusWindows([block({ id: "gate", kind: "gate", connectivity: "wifi", start: "2026-10-13T11:55:00-07:00", end: "2026-10-13T12:40:00-07:00" })], [])[0]!;

describe("taskFitsWindow", () => {
  it("rejects tasks that are too long", () => {
    expect(taskFitsWindow(task({ estimateMinutes: 46 }), gateWindow())).toBe(false);
    expect(taskFitsWindow(task({ estimateMinutes: 45 }), gateWindow())).toBe(true);
  });
  it("rejects online tasks in an offline window, but not in a Wi‑Fi one", () => {
    expect(taskFitsWindow(task({ needsConnectivity: true }), flightWindow())).toBe(false);
    expect(taskFitsWindow(task({ needsConnectivity: true }), gateWindow())).toBe(true);
  });
});

describe("suggestTasksForWindow", () => {
  it("skips done tasks and tasks already placed in another window", () => {
    const done = task({ id: "done", done: true });
    const placed = task({ id: "placed" });
    const open = task({ id: "open" });
    const out = suggestTasksForWindow(gateWindow(), [done, placed, open], [{ windowId: "elsewhere", taskId: "placed" }]);
    expect(out.map((s) => s.task.id)).toEqual(["open"]);
  });

  it("ranks the window's preferred kind first, then priority", () => {
    const tasks = [
      task({ id: "quick-p1", kind: "quick", priority: 1, estimateMinutes: 30 }),
      task({ id: "deep-p3", kind: "deep", priority: 3, estimateMinutes: 90 }),
      task({ id: "deep-p1", kind: "deep", priority: 1, estimateMinutes: 120 }),
      task({ id: "light-p1", kind: "light", priority: 1, estimateMinutes: 10 }),
    ];
    const out = suggestTasksForWindow(flightWindow(), tasks, [], { limit: 10 });
    expect(out.map((s) => s.task.id)).toEqual(["deep-p1", "deep-p3", "quick-p1", "light-p1"]);
  });

  it("limits the list and explains each fit", () => {
    const tasks = [task({ estimateMinutes: 10 }), task({ estimateMinutes: 20 }), task({ estimateMinutes: 30 })];
    const out = suggestTasksForWindow(flightWindow(), tasks, [], { limit: 2 });
    expect(out).toHaveLength(2);
    expect(out[0]?.reason).toContain("works offline");
    const wifi = suggestTasksForWindow(gateWindow(), [task({ needsConnectivity: true, estimateMinutes: 15 })], []);
    expect(wifi[0]?.reason).toBe("15m of 45m · needs Wi‑Fi");
  });
});
