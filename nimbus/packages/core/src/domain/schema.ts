import { z } from 'zod';

/**
 * Runtime schemas for every Nimbus entity. Types are inferred from these so the
 * JSON mock data, the API payloads and the DynamoDB items all share one source
 * of truth.
 *
 * Instants are ISO 8601 in UTC ("2026-10-14T02:05:00Z"). Zones are IANA ids.
 */

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const IsoInstantSchema = z.string().regex(INSTANT, 'expected an ISO instant in UTC');
export const IsoDateSchema = z.string().regex(DATE, 'expected YYYY-MM-DD');
export const TimeZoneIdSchema = z.string().min(1);

export const PlaceSchema = z.object({
  name: z.string(),
  code: z.string().optional(),
  timeZone: TimeZoneIdSchema,
});

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string(),
  homeTimeZone: TimeZoneIdSchema,
  /** Local hours the user is normally available, e.g. 9 to 18. */
  workday: z.object({ startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24) }),
});

export const TripSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  origin: PlaceSchema,
  destination: PlaceSchema,
  start: IsoInstantSchema,
  end: IsoInstantSchema,
});

/** Where the user is on a given calendar day and which zone that day is shown in. */
export const TripDaySchema = z.object({
  date: IsoDateSchema,
  timeZone: TimeZoneIdSchema,
  location: z.string(),
});

export const ConnectivitySchema = z.enum(['wifi', 'mobile', 'offline']);

const SegmentBase = {
  id: z.string(),
  tripId: z.string(),
  start: IsoInstantSchema,
  end: IsoInstantSchema,
  connectivity: ConnectivitySchema,
};

export const FlightSegmentSchema = z.object({
  ...SegmentBase,
  kind: z.literal('flight'),
  carrier: z.string(),
  flightNumber: z.string(),
  from: PlaceSchema,
  to: PlaceSchema,
  /** Recommended minutes at the airport before departure (check-in + security). */
  airportMinutesBefore: z.number().int().positive(),
});

export const AirportSegmentSchema = z.object({
  ...SegmentBase,
  kind: z.literal('airport'),
  place: PlaceSchema,
  phase: z.enum(['departure', 'arrival']),
  flightId: z.string(),
});

export const RideSegmentSchema = z.object({
  ...SegmentBase,
  kind: z.literal('ride'),
  from: z.string(),
  to: z.string(),
  mode: z.enum(['car', 'train']),
  timeZone: TimeZoneIdSchema,
});

export const TravelSegmentSchema = z.discriminatedUnion('kind', [
  FlightSegmentSchema,
  AirportSegmentSchema,
  RideSegmentSchema,
]);

export const MeetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: IsoInstantSchema,
  end: IsoInstantSchema,
  /** The zone the organizer scheduled it in; what the invite "says". */
  scheduledTimeZone: TimeZoneIdSchema,
  organizer: z.string(),
  location: z.string().optional(),
  recurring: z.boolean().optional(),
});

export const TaskModeSchema = z.enum(['deep', 'quick']);
export const PrioritySchema = z.enum(['high', 'medium', 'low']);

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().int().positive(),
  mode: TaskModeSchema,
  needsConnectivity: z.boolean(),
  priority: PrioritySchema,
  /** Things to download before going offline if this task is done on a flight. */
  offlinePrep: z.array(z.string()).optional(),
  assignedWindowId: z.string().nullable().optional(),
});

export const WindowContextSchema = z.enum(['flight', 'gate', 'ride']);

export const FocusWindowSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  segmentId: z.string(),
  context: WindowContextSchema,
  connectivity: ConnectivitySchema,
  mode: TaskModeSchema,
  start: IsoInstantSchema,
  end: IsoInstantSchema,
  durationMinutes: z.number().int().positive(),
  /** Zone the window is displayed in (where the user is when it starts). */
  timeZone: TimeZoneIdSchema,
  /** Human name of the travel moment, e.g. "BA 285 to London". */
  title: z.string(),
});

export const ShieldReasonSchema = z.enum(['late-night', 'overnight', 'early-morning']);

export const ShieldFlagSchema = z.object({
  meetingId: z.string(),
  /** The zone the user will actually be in when the meeting happens. */
  localTimeZone: TimeZoneIdSchema,
  reason: ShieldReasonSchema,
  suggestedStart: IsoInstantSchema,
  suggestedEnd: IsoInstantSchema,
});

export const WeekDataSchema = z.object({
  user: UserSchema,
  trip: TripSchema,
  days: z.array(TripDaySchema),
  segments: z.array(TravelSegmentSchema),
  meetings: z.array(MeetingSchema),
  tasks: z.array(TaskSchema),
});

/** Hand-authored results that phase 2 replaces with computed ones. */
export const Phase1FixturesSchema = z.object({
  focusWindows: z.array(FocusWindowSchema),
  shieldFlags: z.array(ShieldFlagSchema),
  standardPrepItems: z.array(z.string()),
});

export const ANALYTICS_EVENT_NAMES = [
  'timeline_viewed',
  'focus_window_viewed',
  'task_assigned_to_window',
  'reschedule_message_generated',
  'reschedule_message_copied',
  'checklist_item_completed',
] as const;

export const AnalyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);

export const AnalyticsEventSchema = z.object({
  id: z.string(),
  name: AnalyticsEventNameSchema,
  at: IsoInstantSchema,
  userId: z.string(),
  tripId: z.string().optional(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
