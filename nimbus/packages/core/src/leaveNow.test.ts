import { describe, expect, it } from "vitest";

import { flightsDepartingOn, leaveCardFlightFor, planLeave } from "./leaveNow";
import { flight, returnFlight, trip } from "./testing/fixtures";

describe("planLeave", () => {
  it("works back from departure: airport buffer, ride, contingency", () => {
    const plan = planLeave({ flight: flight(), travelMinutes: 45, now: "2026-10-13T08:45:00-07:00" });
    expect(plan.leaveAt).toBe("2026-10-13T10:40:00-07:00");
    expect(plan.bufferMinutes).toBe(120);
    expect(plan.minutesUntilLeave).toBe(115);
    expect(plan.status).toBe("later");
  });

  it("uses a shorter buffer for domestic flights and accepts overrides", () => {
    const domestic = planLeave({ flight: flight({ international: false }), travelMinutes: 30, now: "2026-10-13T08:00:00-07:00" });
    expect(domestic.leaveAt).toBe("2026-10-13T11:25:00-07:00");
    const custom = planLeave({ flight: flight(), travelMinutes: 30, now: "2026-10-13T08:00:00-07:00", bufferMinutes: 60, contingencyMinutes: 0 });
    expect(custom.leaveAt).toBe("2026-10-13T12:10:00-07:00");
  });

  it("moves everything later when the flight is delayed", () => {
    const plan = planLeave({ flight: flight({ delayMinutes: 40 }), travelMinutes: 45, now: "2026-10-13T08:45:00-07:00" });
    expect(plan.leaveAt).toBe("2026-10-13T11:20:00-07:00");
  });

  it("steps through later → soon → now → late → departed", () => {
    const at = (now: string) => planLeave({ flight: flight(), travelMinutes: 45, now }).status;
    expect(at("2026-10-13T09:09:00-07:00")).toBe("later"); // 91 min out
    expect(at("2026-10-13T09:10:00-07:00")).toBe("soon"); // 90
    expect(at("2026-10-13T10:24:00-07:00")).toBe("soon"); // 16
    expect(at("2026-10-13T10:25:00-07:00")).toBe("now"); // 15
    expect(at("2026-10-13T10:50:00-07:00")).toBe("now"); // -10
    expect(at("2026-10-13T10:51:00-07:00")).toBe("late");
    expect(at("2026-10-13T13:40:00-07:00")).toBe("departed");
  });
});

describe("picking the flight for a day", () => {
  const t = trip();

  it("uses the departure airport's calendar day", () => {
    expect(flightsDepartingOn(t, "2026-10-13").map((f) => f.id)).toEqual(["f-out"]);
    expect(flightsDepartingOn(t, "2026-10-17").map((f) => f.id)).toEqual(["f-back"]);
    expect(flightsDepartingOn(t, "2026-10-15")).toEqual([]);
  });

  it("prefers the next flight still to come, else the last one that day", () => {
    const two = trip({ flights: [flight({ id: "a", departs: "2026-10-13T08:00:00-07:00" }), flight({ id: "b", departs: "2026-10-13T18:00:00-07:00" }), returnFlight()] });
    expect(leaveCardFlightFor(two, "2026-10-13", "2026-10-13T06:00:00-07:00")?.id).toBe("a");
    expect(leaveCardFlightFor(two, "2026-10-13", "2026-10-13T09:00:00-07:00")?.id).toBe("b");
    expect(leaveCardFlightFor(two, "2026-10-13", "2026-10-13T20:00:00-07:00")?.id).toBe("b");
    expect(leaveCardFlightFor(two, "2026-10-14", "2026-10-13T20:00:00-07:00")).toBeNull();
  });
});
