import { describe, expect, it } from "vitest";

import { deriveAttention } from "./attention";
import { planLeave } from "./leaveNow";
import { findClashes } from "./timezoneShield";
import { flight, meeting, trip } from "./testing/fixtures";
import type { Checklist } from "./types";

const clashes = findClashes([meeting({ start: "2026-10-15T15:00:00-07:00", end: "2026-10-15T16:00:00-07:00" })], trip());
const checklist = (remaining: number, active = true): Checklist => ({
  flight: flight(),
  active,
  items: Array.from({ length: remaining + 1 }, (_, i) => ({ id: `i${i}`, label: `Item ${i}`, source: "task", done: i === 0 })),
});
const leave = (now: string, delayMinutes?: number) =>
  planLeave({ flight: flight(delayMinutes ? { delayMinutes } : {}), travelMinutes: 45, now });

describe("deriveAttention", () => {
  it("stays quiet when nothing needs attention", () => {
    expect(deriveAttention({ leavePlan: leave("2026-10-13T06:00:00-07:00"), clashes: [], checklist: checklist(0), destinationCity: "London" })).toBeNull();
  });

  it("puts leaving ahead of everything once it is close", () => {
    const a = deriveAttention({ leavePlan: leave("2026-10-13T10:00:00-07:00"), clashes, checklist: checklist(3), destinationCity: "London" });
    expect(a).toMatchObject({ tone: "warning", href: "/", message: "Leave for SFO by 10:40 am." });
    expect(deriveAttention({ leavePlan: leave("2026-10-13T10:40:00-07:00"), clashes, checklist: null, destinationCity: "London" })?.message).toBe("Time to leave for SFO.");
    expect(deriveAttention({ leavePlan: leave("2026-10-13T11:30:00-07:00"), clashes, checklist: null, destinationCity: "London" })?.message).toBe("You should be on your way to SFO.");
  });

  it("mentions a delay in the leave message", () => {
    const a = deriveAttention({ leavePlan: leave("2026-10-13T10:30:00-07:00", 40), clashes: [], checklist: null, destinationCity: "London" });
    expect(a?.message).toBe("TA 1 is delayed 40m. Leave for SFO by 11:20 am.");
  });

  it("points at clashes when leaving is not yet pressing", () => {
    const a = deriveAttention({ leavePlan: leave("2026-10-13T08:00:00-07:00"), clashes, checklist: checklist(3), destinationCity: "London" });
    expect(a).toMatchObject({ tone: "warning", href: "/shield", message: "1 meeting lands overnight in London." });
    expect(deriveAttention({ leavePlan: null, clashes: [...clashes, ...clashes], checklist: null, destinationCity: "London" })?.message).toBe("2 meetings land overnight in London.");
  });

  it("falls back to the checklist, only while it is open and unfinished", () => {
    expect(deriveAttention({ leavePlan: null, clashes: [], checklist: checklist(2), destinationCity: "London" })).toMatchObject({ tone: "info", href: "/prep", message: "2 items to download before you fly." });
    expect(deriveAttention({ leavePlan: null, clashes: [], checklist: checklist(1), destinationCity: "London" })?.message).toBe("1 item to download before you fly.");
    expect(deriveAttention({ leavePlan: null, clashes: [], checklist: checklist(2, false), destinationCity: "London" })).toBeNull();
    expect(deriveAttention({ leavePlan: null, clashes: [], checklist: checklist(0), destinationCity: "London" })).toBeNull();
  });
});
