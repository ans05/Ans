import type { Flight, IsoDateTime, Meeting, Task, Trip, UserProfile } from "../types";

/**
 * Data sources are the seams where real integrations plug in later:
 * a Google Calendar source behind `CalendarSource`, a flight-status API behind
 * `FlightSource`. The app only ever depends on these interfaces.
 */

export interface TimeRange {
  from: IsoDateTime;
  to: IsoDateTime;
}

export interface CalendarSource {
  listMeetings(range: TimeRange): Promise<Meeting[]>;
}

export interface FlightSource {
  getFlight(flightId: string): Promise<Flight | null>;
  /** Re-fetch live status (delays, gate changes) for the given flights. */
  refreshStatus(flights: Flight[]): Promise<Flight[]>;
}

export interface TaskSource {
  listTasks(): Promise<Task[]>;
}

export interface TripSource {
  getCurrentTrip(): Promise<Trip>;
  getUser(): Promise<UserProfile>;
}

export interface DataSources {
  calendar: CalendarSource;
  flights: FlightSource;
  tasks: TaskSource;
  trips: TripSource;
}
