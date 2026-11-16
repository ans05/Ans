import { describe, expect, it } from "vitest";

import { detectFocusWindows } from "./focusWindows";
import { buildChecklist, isPrepWindowOpen, nextFlight } from "./offlinePrep";
import { flight, outboundBlocks, task, trip } from "./testing/fixtures";

const t = trip({ travelBlocks: outboundBlocks() });
const windows = detectFocusWindows(t.travelBlocks, []);
const tasks = [
  task({ id: "narrative", title: "Write the narrative", offlineNeeds: ["Metrics export (CSV)", "Dashboard screenshots"] }),
  task({ id: "outline", title: "Draft the outline", offlineNeeds: [] }),
  task({ id: "pr", title: "Review the PR", offlineNeeds: ["Diff"] }),
];
const assignments = [
  { windowId: "flight@0", taskId: "narrative" },
  { windowId: "flight@0", taskId: "outline" },
  { windowId: "gate@0", taskId: "pr" },
];

describe("nextFlight", () => {
  it("picks the first flight that has not departed", () => {
    expect(nextFlight(t, "2026-10-13T08:00:00-07:00")?.id).toBe("f-out");
    expect(nextFlight(t, "2026-10-13T13:40:00-07:00")?.id).toBe("f-out");
    expect(nextFlight(t, "2026-10-13T13:41:00-07:00")?.id).toBe("f-back");
    expect(nextFlight(t, "2026-10-18T00:00:00-07:00")).toBeNull();
  });
});

describe("isPrepWindowOpen", () => {
  it("opens at 5 pm the evening before, in the departure zone, and closes at departure", () => {
    expect(isPrepWindowOpen(flight(), "2026-10-12T16:59:00-07:00")).toBe(false);
    expect(isPrepWindowOpen(flight(), "2026-10-12T17:00:00-07:00")).toBe(true);
    expect(isPrepWindowOpen(flight(), "2026-10-13T13:39:00-07:00")).toBe(true);
    expect(isPrepWindowOpen(flight(), "2026-10-13T13:40:00-07:00")).toBe(false);
  });
});

describe("buildChecklist", () => {
  const build = (now: string, completed: string[] = []) =>
    buildChecklist({ trip: t, tasks, assignments, focusWindows: windows, completedItemIds: completed, now });

  it("lists the downloads for tasks planned on the flight, then the boarding pass", () => {
    const list = build("2026-10-12T20:00:00-07:00")!;
    expect(list.flight.id).toBe("f-out");
    expect(list.active).toBe(true);
    expect(list.items.map((i) => i.label)).toEqual([
      "Metrics export (CSV)",
      "Dashboard screenshots",
      "Sync notes for “Draft the outline”",
      "Save the Test Air TA 1 boarding pass offline",
    ]);
  });

  it("leaves out tasks planned for other windows, like the gate", () => {
    const list = build("2026-10-12T20:00:00-07:00")!;
    expect(list.items.some((i) => i.taskId === "pr")).toBe(false);
  });

  it("marks completed items and reports whether the window is open", () => {
    const early = build("2026-10-11T09:00:00-07:00", ["f-out:task:narrative:metrics-export-csv"])!;
    expect(early.active).toBe(false);
    expect(early.items.filter((i) => i.done).map((i) => i.label)).toEqual(["Metrics export (CSV)"]);
  });

  it("returns null once there is nothing left to fly", () => {
    expect(build("2026-10-18T00:00:00-07:00")).toBeNull();
  });
});
