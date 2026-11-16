import { addMinutes, toIso } from "./time";
import type { Flight, Trip } from "./types";

/**
 * Push a trip's travel blocks around to match reported flight delays. The
 * flight and its boarding move later; the gate wait that leads into boarding
 * stretches to fill the gap. Flights without a delay are untouched.
 *
 * Returns a new trip; the input is not mutated.
 */
export const applyFlightDelays = (trip: Trip): Trip => {
  const delayed = trip.flights.filter((f) => (f.delayMinutes ?? 0) > 0);
  if (delayed.length === 0) return trip;

  const blocks = trip.travelBlocks.map((b) => ({ ...b }));

  for (const flight of delayed) {
    const delay = flight.delayMinutes ?? 0;
    const zone = flight.from.zone;
    const own = blocks.filter((b) => b.flightId === flight.id);
    const boarding = own.find((b) => b.kind === "boarding");
    const leg = own.find((b) => b.kind === "flight");
    const originalBoardingStart = boarding?.start;

    for (const b of own) {
      if (b.kind === "boarding" || b.kind === "flight") {
        b.start = toIso(addMinutes(b.start, delay), zone);
        b.end = toIso(addMinutes(b.end, delay), b.kind === "flight" ? flight.to.zone : zone);
      }
    }

    // The gate wait that ended when boarding began now lasts until the new boarding time.
    const leadIn = blocks.find(
      (b) =>
        b.kind === "gate" &&
        b.flightId === undefined &&
        originalBoardingStart !== undefined &&
        b.end === originalBoardingStart,
    );
    if (leadIn && boarding) leadIn.end = boarding.start;
    else if (leadIn && leg && !boarding) leadIn.end = leg.start;
  }

  return {
    ...trip,
    flights: trip.flights.map((f) => ({ ...f })),
    travelBlocks: blocks,
  };
};

/** Effective departure, including any reported delay. */
export const effectiveDeparture = (flight: Flight): Date =>
  addMinutes(flight.departs, flight.delayMinutes ?? 0);
