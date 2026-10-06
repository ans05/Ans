import type { Assignment, DayKey, IsoDateTime, Meeting, Task, Trip, UserProfile } from "../types";
import raw from "./sample-week.json";

export interface SampleWeek {
  demoNow: IsoDateTime;
  weekStart: DayKey;
  user: UserProfile;
  trip: Trip;
  meetings: Meeting[];
  tasks: Task[];
  assignments: Assignment[];
}

/** A realistic demo week: two flights, one time-zone change, a dozen meetings, eight tasks. */
export const sampleWeek = raw as SampleWeek;
