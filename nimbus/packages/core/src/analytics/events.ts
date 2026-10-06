import type { IsoDateTime } from "../types";

export const ANALYTICS_EVENT_NAMES = [
  "timeline_viewed",
  "focus_window_viewed",
  "task_assigned_to_window",
  "reschedule_message_generated",
  "reschedule_message_copied",
  "checklist_item_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsProps = Record<string, string | number | boolean>;

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  at: IsoDateTime;
  userId: string;
  tripId?: string;
  props?: AnalyticsProps;
}

export const isAnalyticsEventName = (value: string): value is AnalyticsEventName =>
  (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);

/** Human labels for the metrics page. */
export const ANALYTICS_EVENT_LABELS: Record<AnalyticsEventName, string> = {
  timeline_viewed: "Timeline viewed",
  focus_window_viewed: "Focus window viewed",
  task_assigned_to_window: "Task assigned to window",
  reschedule_message_generated: "Reschedule message generated",
  reschedule_message_copied: "Reschedule message copied",
  checklist_item_completed: "Checklist item completed",
};
