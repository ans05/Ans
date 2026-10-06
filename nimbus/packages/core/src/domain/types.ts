import type { z } from 'zod';
import type {
  AirportSegmentSchema,
  AnalyticsEventNameSchema,
  AnalyticsEventSchema,
  ConnectivitySchema,
  FlightSegmentSchema,
  FocusWindowSchema,
  MeetingSchema,
  Phase1FixturesSchema,
  PlaceSchema,
  PrioritySchema,
  RideSegmentSchema,
  ShieldFlagSchema,
  ShieldReasonSchema,
  TaskModeSchema,
  TaskSchema,
  TravelSegmentSchema,
  TripDaySchema,
  TripSchema,
  UserSchema,
  WeekDataSchema,
  WindowContextSchema,
} from './schema';

export type IsoInstant = string;
export type IsoDate = string;
export type TimeZoneId = string;

export type Place = z.infer<typeof PlaceSchema>;
export type User = z.infer<typeof UserSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type TripDay = z.infer<typeof TripDaySchema>;
export type Connectivity = z.infer<typeof ConnectivitySchema>;
export type FlightSegment = z.infer<typeof FlightSegmentSchema>;
export type AirportSegment = z.infer<typeof AirportSegmentSchema>;
export type RideSegment = z.infer<typeof RideSegmentSchema>;
export type TravelSegment = z.infer<typeof TravelSegmentSchema>;
export type Meeting = z.infer<typeof MeetingSchema>;
export type TaskMode = z.infer<typeof TaskModeSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type Task = z.infer<typeof TaskSchema>;
export type WindowContext = z.infer<typeof WindowContextSchema>;
export type FocusWindow = z.infer<typeof FocusWindowSchema>;
export type ShieldReason = z.infer<typeof ShieldReasonSchema>;
export type ShieldFlag = z.infer<typeof ShieldFlagSchema>;
export type WeekData = z.infer<typeof WeekDataSchema>;
export type Phase1Fixtures = z.infer<typeof Phase1FixturesSchema>;
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

/** Something Nimbus (the mascot) should surface. At most one is shown at a time. */
export interface AttentionItem {
  id: string;
  severity: 'info' | 'warning';
  /** Lower is more urgent. */
  priority: number;
  title: string;
  detail?: string;
  href?: string;
  cta?: string;
}
