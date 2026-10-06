/**
 * View models returned by the NimbusApi. They are plain, serialisable objects
 * with display strings already formatted on the server, so client components
 * never need time-zone logic.
 */
import type {
  Attention,
  Checklist,
  Clash,
  DayKey,
  DayTimeline,
  FocusWindow,
  LeavePlan,
  Task,
  TaskSuggestion,
  Trip,
  TripDay,
  Zone,
} from "@nimbus/core";
import type { AnalyticsEventName } from "@nimbus/core";

export interface WeekDayView extends TripDay {
  isToday: boolean;
  isTravelDay: boolean;
  inTrip: boolean;
}

export interface WeekView {
  days: WeekDayView[];
  today: DayKey;
  trip: Pick<Trip, "id" | "title" | "destinationCity" | "homeCity" | "start" | "end">;
}

export interface LeavePlanView {
  plan: LeavePlan;
  leaveAtLabel: string;
  departsLabel: string;
  flightLabel: string;
  airportCode: string;
  /** "in 1h 55m", "now", "35m ago" */
  relativeLabel: string;
}

export interface DayView {
  day: WeekDayView;
  zoneAbbreviation: string;
  timeline: DayTimeline;
  leavePlan: LeavePlanView | null;
  /** Pre-formatted labels keyed by item id. */
  labels: Record<string, { time: string; duration: string }>;
  /** Meetings on this day that the time-zone shield flags. */
  clashIds: string[];
  nowLabel: string | null;
}

export interface FocusWindowView {
  window: FocusWindow;
  blockTitle: string;
  day: DayKey;
  dayLabel: string;
  zone: Zone;
  timeLabel: string;
  durationLabel: string;
  kindLabel: string;
  connectivityLabel: string;
  assigned: Task[];
  suggestions: TaskSuggestion[];
}

export interface FocusView {
  windows: FocusWindowView[];
  totalMinutes: number;
  plannedMinutes: number;
  tasksPlanned: number;
}

export interface ClashView {
  clash: Clash;
  dayLabel: string;
  localLabel: string;
  homeLabel: string;
  alternative: { destination: string; home: string } | null;
  draft: string | null;
}

export interface ShieldView {
  clashes: ClashView[];
  destinationCity: string;
  homeCity: string;
  offsetLabel: string;
  tripDatesLabel: string;
}

export interface PrepView {
  checklist: Checklist | null;
  departsLabel: string | null;
  opensLabel: string | null;
  completed: number;
  total: number;
  /** Checklist items grouped under the task they come from. */
  groups: Array<{ title: string; itemIds: string[] }>;
}

export interface MetricsView {
  counts: Record<AnalyticsEventName, number>;
  totalEvents: number;
  northStar: { label: string; minutes: number; perTrip: Array<{ tripId: string; title: string; minutes: number }> };
}

export type { Attention };
