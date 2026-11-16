import { describe, expect, it } from "vitest";

import { classifyWindow, detectFocusWindows, plannedFocusMinutes } from "./focusWindows";
import { block, meeting, outboundBlocks } from "./testing/fixtures";

const gate = () => block({ id: "gate", start: "2026-10-13T11:55:00-07:00", end: "2026-10-13T13:10:00-07:00" });

describe("detectFocusWindows", () => {
  it("turns each focusable block into one window when nothing interrupts it", () => {
    const windows = detectFocusWindows(outboundBlocks(), []);
    expect(windows.map((w) => [w.id, w.minutes])).toEqual([
      ["ride@0", 45],
      ["gate@0", 75],
      ["flight@0", 625],
    ]);
  });

  it("ignores blocks that are not focusable", () => {
    const windows = detectFocusWindows(outboundBlocks(), []);
    expect(windows.some((w) => w.blockId === "security" || w.blockId === "boarding")).toBe(false);
  });

  it("splits a block around a meeting and keys the pieces by their offset", () => {
    const call = meeting({ start: "2026-10-13T12:20:00-07:00", end: "2026-10-13T12:40:00-07:00" });
    const windows = detectFocusWindows([gate()], [call]);
    expect(windows.map((w) => [w.id, w.minutes])).toEqual([
      ["gate@0", 25],
      ["gate@45", 30],
    ]);
  });

  it("keeps a gap of exactly 20 minutes and drops 19", () => {
    const keep = meeting({ start: "2026-10-13T12:15:00-07:00", end: "2026-10-13T13:10:00-07:00" });
    expect(detectFocusWindows([gate()], [keep]).map((w) => w.minutes)).toEqual([20]);
    const drop = meeting({ start: "2026-10-13T12:14:00-07:00", end: "2026-10-13T13:10:00-07:00" });
    expect(detectFocusWindows([gate()], [drop])).toEqual([]);
  });

  it("honours a custom minimum", () => {
    const call = meeting({ start: "2026-10-13T12:20:00-07:00", end: "2026-10-13T12:40:00-07:00" });
    expect(detectFocusWindows([gate()], [call], { minMinutes: 30 }).map((w) => w.id)).toEqual(["gate@45"]);
  });

  it("lets the user's own task blocks stay inside a window", () => {
    const own = meeting({ kind: "task-block", start: "2026-10-13T12:00:00-07:00", end: "2026-10-13T13:00:00-07:00" });
    expect(detectFocusWindows([gate()], [own]).map((w) => w.minutes)).toEqual([75]);
  });

  it("handles overlapping meetings and one that swallows the whole block", () => {
    const a = meeting({ start: "2026-10-13T12:00:00-07:00", end: "2026-10-13T12:30:00-07:00" });
    const b = meeting({ start: "2026-10-13T12:15:00-07:00", end: "2026-10-13T12:45:00-07:00" });
    expect(detectFocusWindows([gate()], [a, b]).map((w) => w.id)).toEqual(["gate@50"]);
    const all = meeting({ start: "2026-10-13T11:00:00-07:00", end: "2026-10-13T14:00:00-07:00" });
    expect(detectFocusWindows([gate()], [all])).toEqual([]);
  });

  it("offsets the first window when a meeting overlaps the block start", () => {
    const early = meeting({ start: "2026-10-13T11:30:00-07:00", end: "2026-10-13T12:10:00-07:00" });
    expect(detectFocusWindows([gate()], [early]).map((w) => w.id)).toEqual(["gate@15"]);
  });

  it("carries the block's connectivity into the window", () => {
    const [w] = detectFocusWindows([block({ connectivity: "offline", kind: "flight", start: "2026-10-13T13:40:00-07:00", end: "2026-10-14T00:05:00-07:00" })], []);
    expect(w?.connectivity).toBe("offline");
    expect(w?.workStyle).toBe("Deep work");
  });
});

describe("classifyWindow", () => {
  it("never suggests deep work in a car", () => {
    expect(classifyWindow("ride", 240).suitedFor[0]).toBe("light");
  });
  it("calls a long flight or train deep work", () => {
    expect(classifyWindow("flight", 120).workStyle).toBe("Deep work");
    expect(classifyWindow("train", 150).workStyle).toBe("Deep work");
    expect(classifyWindow("flight", 119).workStyle).toBe("Quick tasks");
  });
  it("calls gate waits quick or light by length", () => {
    expect(classifyWindow("gate", 45).workStyle).toBe("Quick tasks");
    expect(classifyWindow("gate", 44).workStyle).toBe("Light tasks");
    expect(classifyWindow("gate", 200).workStyle).toBe("Quick tasks");
  });
});

describe("plannedFocusMinutes", () => {
  it("sums only windows with something assigned", () => {
    const windows = detectFocusWindows(outboundBlocks(), []);
    expect(plannedFocusMinutes(windows, ["flight@0", "gate@0", "missing"])).toBe(700);
    expect(plannedFocusMinutes(windows, [])).toBe(0);
  });
});
