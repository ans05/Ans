/**
 * Domain types shared by the web app, the local mock API and the AWS Lambdas.
 *
 * Conventions
 * - Instants are ISO-8601 strings that carry a UTC offset ("2026-10-13T13:40:00-07:00").
 * - Zones are IANA identifiers ("America/Los_Angeles"). A day is identified by
 *   its calendar date in a given zone ("2026-10-13").
 */

export type Zone = string;
export type IsoDateTime = string;
export type DayKey = string;

export type Connectivity = "wifi" | "cellular" | "offline";

export type TravelKind =
  | "ride"
  | "security"
  | "gate"
  | "boarding"
  | "flight"
  | "train"
  | "hotel";

export type FlightStatus = "scheduled" | "on-time" | "delayed" | "landed";

export interface Airport {
  code: string;
  city: string;
  zone: Zone;
}

export interface Flight {
  id: string;
  carrier: string;
  number: string;
  from: Airport;
  to: Airport;
  departs: IsoDateTime;
  arrives: IsoDateTime;
  international: boolean;
  status: FlightStatus;
  delayMinutes?: number;
}

/** A block of time spent travelling (or waiting to travel). */
export interface TravelBlock {
  id: string;
  kind: TravelKind;
  title: string;
  subtitle?: string;
  start: IsoDateTime;
  end: IsoDateTime;
  connectivity: Connectivity;
  /** Whether the user could realistically work during this block. */
  focusable: boolean;
  flightId?: string;
}

export type CalendarKind = "meeting" | "task-block";

export interface Meeting {
  id: string;
  title: string;
  start: IsoDateTime;
  end: IsoDateTime;
  /** The zone the meeting was scheduled in (usually the organiser's). */
  zone: Zone;
  kind: CalendarKind;
  organizer?: string;
  attendees?: string[];
  /** False for things like an offsite session the user cannot move. */
  movable: boolean;
}

export type TaskKind = "deep" | "quick" | "light";
export type Priority = 1 | 2 | 3;

export interface Task {
  id: string;
  title: string;
  estimateMinutes: number;
  kind: TaskKind;
  needsConnectivity: boolean;
  /** Files or data that must be on the device before going offline. */
  offlineNeeds: string[];
  priority: Priority;
  project?: string;
  done: boolean;
}

export interface TripDay {
  date: DayKey;
  /** The zone the user wakes up in on this day; the timeline renders in it. */
  zone: Zone;
  city: string;
  label?: string;
}

export interface Trip {
  id: string;
  title: string;
  homeCity: string;
  homeZone: Zone;
  destinationCity: string;
  destinationZone: Zone;
  start: DayKey;
  end: DayKey;
  days: TripDay[];
  flights: Flight[];
  travelBlocks: TravelBlock[];
}

export interface UserProfile {
  id: string;
  name: string;
  homeZone: Zone;
  travelMinutesToAirport: number;
}

/** A gap of 20+ minutes during travel that can be used for work. */
export interface FocusWindow {
  id: string;
  blockId: string;
  kind: TravelKind;
  start: IsoDateTime;
  end: IsoDateTime;
  minutes: number;
  connectivity: Connectivity;
  /** Which kinds of tasks suit this window, best first. */
  suitedFor: TaskKind[];
  /** Short human label, e.g. "Deep work". */
  workStyle: string;
}

export interface Assignment {
  windowId: string;
  taskId: string;
}

export type ClashReason = "late" | "early";

export interface Clash {
  meeting: Meeting;
  zone: Zone;
  /** Local start/end in the destination zone, e.g. "11:00 pm". */
  localStart: string;
  localEnd: string;
  localDay: DayKey;
  reason: ClashReason;
}

export interface ChecklistItem {
  id: string;
  label: string;
  source: "task" | "flight";
  taskId?: string;
  done: boolean;
}

export interface Checklist {
  flight: Flight;
  /** Whether we are inside the "evening before → departure" window. */
  active: boolean;
  items: ChecklistItem[];
}

export type LeaveStatus = "later" | "soon" | "now" | "late" | "departed";

export interface LeavePlan {
  flight: Flight;
  leaveAt: IsoDateTime;
  travelMinutes: number;
  bufferMinutes: number;
  contingencyMinutes: number;
  minutesUntilLeave: number;
  status: LeaveStatus;
}

export type AttentionTone = "info" | "warning";

export interface Attention {
  id: string;
  tone: AttentionTone;
  message: string;
  href: string;
  cta: string;
}

export interface TimeInterval {
  start: IsoDateTime;
  end: IsoDateTime;
}
