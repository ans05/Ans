import { addMinutes, dayKeyOf, minutesBetween, toDate, toIso } from "./time";
import type { DayKey, Flight, IsoDateTime, LeavePlan, LeaveStatus, Trip } from "./types";

export const DEFAULT_CONTINGENCY_MINUTES = 15;
export const AIRPORT_BUFFER_MINUTES = { domestic: 90, international: 120 } as const;

export interface LeavePlanInput {
  flight: Flight;
  travelMinutes: number;
  now: IsoDateTime | Date;
  bufferMinutes?: number;
  contingencyMinutes?: number;
}

export const airportBufferFor = (flight: Flight): number =>
  flight.international
    ? AIRPORT_BUFFER_MINUTES.international
    : AIRPORT_BUFFER_MINUTES.domestic;

const statusFor = (minutesUntilLeave: number, minutesUntilDeparture: number): LeaveStatus => {
  if (minutesUntilDeparture <= 0) return "departed";
  if (minutesUntilLeave > 90) return "later";
  if (minutesUntilLeave > 15) return "soon";
  if (minutesUntilLeave >= -10) return "now";
  return "late";
};

/**
 * When to leave: departure, minus time at the airport, minus the ride, minus
 * a small contingency. Delays reported on the flight push everything later.
 */
export const planLeave = ({
  flight,
  travelMinutes,
  now,
  bufferMinutes = airportBufferFor(flight),
  contingencyMinutes = DEFAULT_CONTINGENCY_MINUTES,
}: LeavePlanInput): LeavePlan => {
  const departs = addMinutes(flight.departs, flight.delayMinutes ?? 0);
  const leaveAtDate = addMinutes(departs, -(bufferMinutes + travelMinutes + contingencyMinutes));
  const minutesUntilLeave = minutesBetween(now, leaveAtDate);
  const minutesUntilDeparture = minutesBetween(now, departs);

  return {
    flight,
    leaveAt: toIso(leaveAtDate, flight.from.zone),
    travelMinutes,
    bufferMinutes,
    contingencyMinutes,
    minutesUntilLeave,
    status: statusFor(minutesUntilLeave, minutesUntilDeparture),
  };
};

/** Flights that depart on `day` (local to the departure airport). */
export const flightsDepartingOn = (trip: Trip, day: DayKey): Flight[] =>
  trip.flights.filter((f) => dayKeyOf(f.departs, f.from.zone) === day);

/** The soonest flight departing on `day` that has not left yet, else the last one that day. */
export const leaveCardFlightFor = (
  trip: Trip,
  day: DayKey,
  now: IsoDateTime | Date,
): Flight | null => {
  const flights = flightsDepartingOn(trip, day).sort((a, b) =>
    a.departs.localeCompare(b.departs),
  );
  const upcoming = flights.find((f) => toDate(f.departs).getTime() > toDate(now).getTime());
  return upcoming ?? flights.at(-1) ?? null;
};
