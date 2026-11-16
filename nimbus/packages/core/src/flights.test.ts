import { describe, expect, it } from "vitest";

import { applyFlightDelays, effectiveDeparture } from "./flights";
import { flight, outboundBlocks, trip } from "./testing/fixtures";

describe("applyFlightDelays", () => {
  const base = trip({ travelBlocks: outboundBlocks() });

  it("returns the same trip when nothing is delayed", () => {
    expect(applyFlightDelays(base)).toBe(base);
  });

  it("shifts boarding and the flight, stretches the gate wait, leaves the rest alone", () => {
    const delayed = applyFlightDelays(trip({ ...base, flights: [flight({ delayMinutes: 40 }), base.flights[1]!] }));
    const byId = Object.fromEntries(delayed.travelBlocks.map((b) => [b.id, b]));
    expect(byId.boarding).toMatchObject({ start: "2026-10-13T13:50:00-07:00", end: "2026-10-13T14:20:00-07:00" });
    expect(byId.flight).toMatchObject({ start: "2026-10-13T14:20:00-07:00", end: "2026-10-14T08:45:00+01:00" });
    expect(byId.gate).toMatchObject({ start: "2026-10-13T11:55:00-07:00", end: "2026-10-13T13:50:00-07:00" });
    expect(byId.ride).toEqual(base.travelBlocks[0]);
    expect(byId.security).toEqual(base.travelBlocks[1]);
  });

  it("does not mutate its input", () => {
    const input = trip({ ...base, flights: [flight({ delayMinutes: 15 }), base.flights[1]!] });
    const before = JSON.stringify(input);
    applyFlightDelays(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("effectiveDeparture", () => {
  it("adds the delay", () => {
    expect(effectiveDeparture(flight()).toISOString()).toBe("2026-10-13T20:40:00.000Z");
    expect(effectiveDeparture(flight({ delayMinutes: 20 })).toISOString()).toBe("2026-10-13T21:00:00.000Z");
  });
});
