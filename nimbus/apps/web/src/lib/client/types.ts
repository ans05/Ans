import type { AnalyticsEvent, Phase1Fixtures, WeekData } from '@nimbus/core';

/** Everything the user has changed on top of the seed data. */
export interface UserState {
  version: 1;
  /** taskId → focus window id, or null when unplanned. */
  taskAssignments: Record<string, string | null>;
  /** prep item id → done. */
  checklistDone: Record<string, boolean>;
  /** flightId → door-to-airport minutes. */
  travelMinutes: Record<string, number>;
  /** meetingId → generated reschedule message. */
  rescheduleDrafts: Record<string, string>;
  dismissedAttention: string[];
  analytics: AnalyticsEvent[];
  /** A demo moment id, or "live" for the real clock. */
  demoMomentId: string;
}

export interface WeekPayload {
  week: WeekData;
  fixtures: Phase1Fixtures;
}

/**
 * The one seam between the UI and wherever data lives. Local mode keeps
 * everything in the browser; aws mode (phase 3) calls API Gateway.
 */
export interface NimbusClient {
  readonly mode: 'local' | 'aws';
  loadWeek(): Promise<WeekPayload>;
  loadUserState(): Promise<UserState | null>;
  saveUserState(state: UserState): Promise<void>;
}
