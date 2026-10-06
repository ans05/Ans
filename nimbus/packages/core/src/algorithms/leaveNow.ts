import type { FlightSegment, IsoInstant, TimeZoneId } from '../domain/types';
import { addMinutes, minutesBetween, toDate } from '../time';

export const DEFAULT_BUFFER_MINUTES = 15;

export interface LeaveNowInput {
  flight: FlightSegment;
  /** Door-to-airport travel time, entered by the user. */
  travelMinutes: number;
  /** Slack on top of travel and airport time. */
  bufferMinutes?: number;
}

export interface LeaveNowPlan {
  flightId: string;
  departure: IsoInstant;
  leaveBy: IsoInstant;
  travelMinutes: number;
  airportMinutes: number;
  bufferMinutes: number;
  totalMinutes: number;
  timeZone: TimeZoneId;
}

/** leaveBy = departure − (travel + time at airport + buffer). */
export function planLeaveNow({ flight, travelMinutes, bufferMinutes = DEFAULT_BUFFER_MINUTES }: LeaveNowInput): LeaveNowPlan {
  const airportMinutes = flight.airportMinutesBefore;
  const totalMinutes = Math.max(0, travelMinutes) + airportMinutes + Math.max(0, bufferMinutes);
  return {
    flightId: flight.id,
    departure: flight.start,
    leaveBy: addMinutes(flight.start, -totalMinutes),
    travelMinutes,
    airportMinutes,
    bufferMinutes,
    totalMinutes,
    timeZone: flight.from.timeZone,
  };
}

export type LeaveNowStatus = 'later' | 'soon' | 'now' | 'departed';

export interface LeaveNowState {
  status: LeaveNowStatus;
  /** Minutes until leaveBy; negative once it has passed. */
  minutesUntilLeave: number;
}

export function leaveNowState(plan: LeaveNowPlan, now: Date | IsoInstant, soonWithinMinutes = 60): LeaveNowState {
  const minutesUntilLeave = Math.round(minutesBetween(toDate(now), plan.leaveBy));
  if (toDate(now).getTime() >= toDate(plan.departure).getTime()) {
    return { status: 'departed', minutesUntilLeave };
  }
  if (minutesUntilLeave <= 0) return { status: 'now', minutesUntilLeave };
  if (minutesUntilLeave <= soonWithinMinutes) return { status: 'soon', minutesUntilLeave };
  return { status: 'later', minutesUntilLeave };
}
