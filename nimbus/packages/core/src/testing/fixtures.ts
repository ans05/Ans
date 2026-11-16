import type { Flight, Meeting, Task, TravelBlock, Trip, UserProfile } from "../types";

export const LA = "America/Los_Angeles";
export const LONDON = "Europe/London";
export const TOKYO = "Asia/Tokyo";
export const HONOLULU = "Pacific/Honolulu";
export const DUBAI = "Asia/Dubai";

let counter = 0;
const nextId = (prefix: string) => `${prefix}${++counter}`;

export const block = (
  overrides: Partial<TravelBlock> & Pick<TravelBlock, "start" | "end">,
): TravelBlock => ({
  id: nextId("block"),
  kind: "gate",
  title: "Gate",
  connectivity: "wifi",
  focusable: true,
  ...overrides,
});

export const meeting = (
  overrides: Partial<Meeting> & Pick<Meeting, "start" | "end">,
): Meeting => ({
  id: nextId("meeting"),
  title: "Meeting",
  zone: LA,
  kind: "meeting",
  movable: true,
  ...overrides,
});

export const task = (overrides: Partial<Task> = {}): Task => ({
  id: nextId("task"),
  title: "Task",
  estimateMinutes: 30,
  kind: "quick",
  needsConnectivity: false,
  offlineNeeds: [],
  priority: 2,
  done: false,
  ...overrides,
});

export const flight = (overrides: Partial<Flight> = {}): Flight => ({
  id: "f-out",
  carrier: "Test Air",
  number: "TA 1",
  from: { code: "SFO", city: "San Francisco", zone: LA },
  to: { code: "LHR", city: "London", zone: LONDON },
  departs: "2026-10-13T13:40:00-07:00",
  arrives: "2026-10-14T08:05:00+01:00",
  international: true,
  status: "scheduled",
  ...overrides,
});

export const returnFlight = (overrides: Partial<Flight> = {}): Flight =>
  flight({
    id: "f-back",
    number: "TA 2",
    from: { code: "LHR", city: "London", zone: LONDON },
    to: { code: "SFO", city: "San Francisco", zone: LA },
    departs: "2026-10-17T11:00:00+01:00",
    arrives: "2026-10-17T14:00:00-07:00",
    ...overrides,
  });

/** SF → London, Oct 13–17 2026 (both zones on summer time, 8 hours apart). */
export const trip = (overrides: Partial<Trip> = {}): Trip => ({
  id: "trip",
  title: "Trip",
  homeCity: "San Francisco",
  homeZone: LA,
  destinationCity: "London",
  destinationZone: LONDON,
  start: "2026-10-13",
  end: "2026-10-17",
  days: [
    { date: "2026-10-13", zone: LA, city: "San Francisco" },
    { date: "2026-10-14", zone: LONDON, city: "London" },
    { date: "2026-10-15", zone: LONDON, city: "London" },
    { date: "2026-10-16", zone: LONDON, city: "London" },
    { date: "2026-10-17", zone: LONDON, city: "London" },
  ],
  flights: [flight(), returnFlight()],
  travelBlocks: [],
  ...overrides,
});

export const user: UserProfile = {
  id: "u",
  name: "Alex",
  homeZone: LA,
  travelMinutesToAirport: 45,
};

/** Outbound travel blocks for the trip above. */
export const outboundBlocks = (): TravelBlock[] => [
  block({ id: "ride", kind: "ride", title: "Ride", connectivity: "cellular", start: "2026-10-13T10:40:00-07:00", end: "2026-10-13T11:25:00-07:00" }),
  block({ id: "security", kind: "security", title: "Security", connectivity: "cellular", focusable: false, start: "2026-10-13T11:25:00-07:00", end: "2026-10-13T11:55:00-07:00" }),
  block({ id: "gate", kind: "gate", title: "Gate", start: "2026-10-13T11:55:00-07:00", end: "2026-10-13T13:10:00-07:00" }),
  block({ id: "boarding", kind: "boarding", title: "Boarding", connectivity: "cellular", focusable: false, flightId: "f-out", start: "2026-10-13T13:10:00-07:00", end: "2026-10-13T13:40:00-07:00" }),
  block({ id: "flight", kind: "flight", title: "Flight", connectivity: "offline", flightId: "f-out", start: "2026-10-13T13:40:00-07:00", end: "2026-10-14T08:05:00+01:00" }),
];
