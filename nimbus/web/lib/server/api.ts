import "server-only";

import type { AnalyticsEventName, AnalyticsProps, Attention, DayKey } from "@nimbus/core";

import { localApi } from "./local";
import type {
  DayView,
  FocusView,
  MetricsView,
  PrepView,
  ShieldView,
  WeekView,
} from "./views";

/**
 * The one contract the UI depends on. `local` runs in-process from the sample
 * week; `aws` (Phase 3) will forward to the API Gateway stack with the API key
 * kept on the server.
 */
export interface NimbusApi {
  getWeek(): Promise<WeekView>;
  getDay(day: DayKey): Promise<DayView>;
  getFocus(): Promise<FocusView>;
  assignTask(windowId: string, taskId: string): Promise<void>;
  unassignTask(windowId: string, taskId: string): Promise<void>;
  getShield(): Promise<ShieldView>;
  draftReschedule(meetingId: string): Promise<string>;
  getPrep(): Promise<PrepView>;
  setChecklistItem(itemId: string, done: boolean): Promise<void>;
  setTravelMinutes(minutes: number): Promise<void>;
  getAttention(): Promise<Attention | null>;
  track(name: AnalyticsEventName, props?: AnalyticsProps): Promise<void>;
  getMetrics(): Promise<MetricsView>;
}

export type NimbusMode = "mock" | "aws";

export const getMode = (): NimbusMode =>
  process.env.NIMBUS_MODE === "aws" ? "aws" : "mock";

export const getApi = (): NimbusApi => {
  if (getMode() === "aws") {
    throw new Error(
      "NIMBUS_MODE=aws is not wired up yet (Phase 3). Set NIMBUS_MODE=mock to run locally.",
    );
  }
  return localApi;
};
