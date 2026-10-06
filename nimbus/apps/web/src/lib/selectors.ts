import {
  addDays,
  buildDayTimeline,
  buildPrepChecklist,
  countEvents,
  focusMinutesPerTrip,
  isBefore,
  localDate,
  offsetDifferenceHours,
  planLeaveNow,
  startOfLocalDay,
  suggestTasksForWindow,
  type DayTimeline,
  type EventCounts,
  type FlightSegment,
  type FocusWindow,
  type IsoDate,
  type LeaveNowPlan,
  type Meeting,
  type Phase1Fixtures,
  type PrepItem,
  type ShieldFlag,
  type Task,
  type TripDay,
  type TripFocusMinutes,
  type WeekData,
} from '@nimbus/core';
import type { UserState } from '@/lib/client';

/** Everything a selector needs. Built from the provider value. */
export interface Snapshot {
  week: WeekData;
  fixtures: Phase1Fixtures;
  state: UserState;
  now: Date;
}

export const FALLBACK_TRAVEL_MINUTES = 45;

export function selectTasks({ week, state }: Pick<Snapshot, 'week' | 'state'>): Task[] {
  return week.tasks.map((task) =>
    task.id in state.taskAssignments ? { ...task, assignedWindowId: state.taskAssignments[task.id] ?? null } : task,
  );
}

export function selectWindows({ fixtures }: Pick<Snapshot, 'fixtures'>): FocusWindow[] {
  return [...fixtures.focusWindows].sort((a, b) => a.start.localeCompare(b.start));
}

export function selectWindow(snap: Snapshot, windowId: string): FocusWindow | undefined {
  return snap.fixtures.focusWindows.find((w) => w.id === windowId);
}

export function selectWindowTasks(snap: Snapshot, windowId: string): Task[] {
  return selectTasks(snap).filter((task) => task.assignedWindowId === windowId);
}

export function selectSuggestions(snap: Snapshot, window: FocusWindow, limit = 3): Task[] {
  return suggestTasksForWindow(window, selectTasks(snap), limit);
}

export function selectFlights(week: WeekData): FlightSegment[] {
  return week.segments
    .filter((segment): segment is FlightSegment => segment.kind === 'flight')
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function selectFlight(week: WeekData, flightId: string): FlightSegment | undefined {
  return selectFlights(week).find((flight) => flight.id === flightId);
}

export function selectDay(week: WeekData, date: IsoDate): TripDay | undefined {
  return week.days.find((day) => day.date === date);
}

/** The sample-week day that contains "now", in that day's own zone. */
export function selectTodayDate(snap: Snapshot): IsoDate {
  const match = snap.week.days.find((day) => localDate(snap.now, day.timeZone) === day.date);
  return match?.date ?? snap.week.days[0]?.date ?? localDate(snap.now, snap.week.user.homeTimeZone);
}

/** The ride that leads into a flight, if the data has one; its length seeds the travel time. */
export function defaultTravelMinutes(week: WeekData, flight: FlightSegment): number {
  const airport = week.segments.find((s) => s.kind === 'airport' && s.phase === 'departure' && s.flightId === flight.id);
  const ride = airport && week.segments.find((s) => s.kind === 'ride' && s.end === airport.start);
  if (!ride) return FALLBACK_TRAVEL_MINUTES;
  return Math.round((new Date(ride.end).getTime() - new Date(ride.start).getTime()) / 60_000);
}

export function selectTravelMinutes(snap: Snapshot, flight: FlightSegment): number {
  return snap.state.travelMinutes[flight.id] ?? defaultTravelMinutes(snap.week, flight);
}

export function selectLeaveNowPlan(snap: Snapshot, flight: FlightSegment): LeaveNowPlan {
  return planLeaveNow({ flight, travelMinutes: selectTravelMinutes(snap, flight) });
}

/** Next flight that has not departed yet. */
export function selectNextDeparture(snap: Snapshot): FlightSegment | undefined {
  return selectFlights(snap.week).find((flight) => isBefore(snap.now, flight.start));
}

/** Next flight that has not landed yet (so a flight in progress still counts). */
export function selectCurrentOrNextFlight(snap: Snapshot): FlightSegment | undefined {
  return selectFlights(snap.week).find((flight) => isBefore(snap.now, flight.end));
}

/** A flight departing on a given calendar date, judged in the departure airport's zone. */
export function selectDepartureOn(week: WeekData, date: IsoDate): FlightSegment | undefined {
  return selectFlights(week).find((flight) => localDate(flight.start, flight.from.timeZone) === date);
}

export function selectFlightDates(week: WeekData): Set<IsoDate> {
  return new Set(selectFlights(week).map((flight) => localDate(flight.start, flight.from.timeZone)));
}

export function selectMeetingDates(week: WeekData): Set<IsoDate> {
  const dates = new Set<IsoDate>();
  for (const day of week.days) {
    if (week.meetings.some((m) => localDate(m.start, day.timeZone) === day.date)) dates.add(day.date);
  }
  return dates;
}

export interface PrepChecklistItem extends PrepItem {
  done: boolean;
}

export function selectPrepChecklist(snap: Snapshot, flight: FlightSegment): PrepChecklistItem[] {
  return buildPrepChecklist({
    flight,
    focusWindows: snap.fixtures.focusWindows,
    tasks: selectTasks(snap),
    standardItems: snap.fixtures.standardPrepItems,
  }).map((item) => ({ ...item, done: Boolean(snap.state.checklistDone[item.id]) }));
}

/** True on the evening before a flight, in the departure zone. */
export function isEveningBefore(snap: Snapshot, flight: FlightSegment, fromHour = 17): boolean {
  const zone = flight.from.timeZone;
  const today = localDate(snap.now, zone);
  const flightDate = localDate(flight.start, zone);
  if (addDays(today, 1) !== flightDate) return false;
  return new Date(snap.now).getTime() >= new Date(`${today}T00:00:00Z`).getTime() && hourIn(snap.now, zone) >= fromHour;
}

function hourIn(instant: Date, zone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(instant)
      .find((p) => p.type === 'hour')?.value ?? 0,
  ) % 24;
}

export interface FlaggedMeeting {
  flag: ShieldFlag;
  meeting: Meeting;
  /** Still in the future relative to the current time. */
  upcoming: boolean;
}

export interface ShieldReport {
  flagged: FlaggedMeeting[];
  upcomingCount: number;
  okMeetings: Meeting[];
  hoursAhead: number;
}

export function selectShieldReport(snap: Snapshot): ShieldReport {
  const flagged = snap.fixtures.shieldFlags
    .map((flag) => {
      const meeting = snap.week.meetings.find((m) => m.id === flag.meetingId);
      return meeting ? { flag, meeting, upcoming: isBefore(snap.now, meeting.start) } : null;
    })
    .filter((entry): entry is FlaggedMeeting => entry !== null)
    .sort((a, b) => a.meeting.start.localeCompare(b.meeting.start));
  const flaggedIds = new Set(flagged.map((f) => f.meeting.id));
  const tripStart = snap.week.trip.start;
  const tripEnd = snap.week.trip.end;
  const okMeetings = snap.week.meetings.filter(
    (m) => !flaggedIds.has(m.id) && m.start >= tripStart && m.start <= tripEnd,
  );
  return {
    flagged,
    upcomingCount: flagged.filter((f) => f.upcoming).length,
    okMeetings,
    hoursAhead: offsetDifferenceHours(snap.week.trip.origin.timeZone, snap.week.trip.destination.timeZone, tripStart),
  };
}

export function selectFlaggedMeetingIds(snap: Snapshot): Set<string> {
  return new Set(snap.fixtures.shieldFlags.map((flag) => flag.meetingId));
}

/** Where the previous day ended, when it was shown in a different zone. */
export function selectDayNotBefore(week: WeekData, date: IsoDate): string | undefined {
  const index = week.days.findIndex((day) => day.date === date);
  const day = week.days[index];
  const previous = index > 0 ? week.days[index - 1] : undefined;
  if (!day || !previous || previous.timeZone === day.timeZone) return undefined;
  return startOfLocalDay(addDays(previous.date, 1), previous.timeZone);
}

export function selectDayTimeline(snap: Snapshot, date: IsoDate): DayTimeline | undefined {
  const day = selectDay(snap.week, date);
  if (!day) return undefined;
  return buildDayTimeline({
    date,
    timeZone: day.timeZone,
    notBefore: selectDayNotBefore(snap.week, date),
    segments: snap.week.segments,
    meetings: snap.week.meetings,
    focusWindows: snap.fixtures.focusWindows,
    tasks: selectTasks(snap),
    flaggedMeetingIds: selectFlaggedMeetingIds(snap),
  });
}

export interface MetricsReport {
  counts: EventCounts;
  totalEvents: number;
  perTrip: TripFocusMinutes[];
  /** Average focus minutes planned per trip: the north star. */
  northStarMinutes: number;
}

export function selectMetrics(snap: Snapshot): MetricsReport {
  const perTrip = focusMinutesPerTrip([snap.week.trip], snap.fixtures.focusWindows, selectTasks(snap));
  const northStarMinutes = perTrip.length
    ? Math.round(perTrip.reduce((sum, trip) => sum + trip.plannedMinutes, 0) / perTrip.length)
    : 0;
  return {
    counts: countEvents(snap.state.analytics),
    totalEvents: snap.state.analytics.length,
    perTrip,
    northStarMinutes,
  };
}
