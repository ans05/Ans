import { overlaps } from "../time";
import type { Flight, Meeting, Task, Trip, UserProfile } from "../types";
import type { CalendarSource, DataSources, FlightSource, TaskSource, TimeRange, TripSource } from "./types";

export interface MockDataset {
  user: UserProfile;
  trip: Trip;
  meetings: Meeting[];
  tasks: Task[];
}

export class MockCalendarSource implements CalendarSource {
  constructor(private readonly meetings: Meeting[]) {}
  async listMeetings(range: TimeRange): Promise<Meeting[]> {
    return this.meetings.filter((m) => overlaps(m, { start: range.from, end: range.to }));
  }
}

export class MockFlightSource implements FlightSource {
  constructor(private readonly flights: Flight[]) {}
  async getFlight(flightId: string): Promise<Flight | null> {
    return this.flights.find((f) => f.id === flightId) ?? null;
  }
  async refreshStatus(flights: Flight[]): Promise<Flight[]> {
    return flights;
  }
}

export class MockTaskSource implements TaskSource {
  constructor(private readonly tasks: Task[]) {}
  async listTasks(): Promise<Task[]> {
    return this.tasks;
  }
}

export class MockTripSource implements TripSource {
  constructor(
    private readonly trip: Trip,
    private readonly user: UserProfile,
  ) {}
  async getCurrentTrip(): Promise<Trip> {
    return this.trip;
  }
  async getUser(): Promise<UserProfile> {
    return this.user;
  }
}

export const createMockSources = (data: MockDataset): DataSources => ({
  calendar: new MockCalendarSource(data.meetings),
  flights: new MockFlightSource(data.trip.flights),
  tasks: new MockTaskSource(data.tasks),
  trips: new MockTripSource(data.trip, data.user),
});
