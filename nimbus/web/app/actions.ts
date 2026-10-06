"use server";

import { revalidatePath } from "next/cache";

import { isAnalyticsEventName, type AnalyticsProps } from "@nimbus/core";

import { getApi } from "@/lib/server/api";

const refresh = () => revalidatePath("/", "layout");

export async function assignTaskAction(windowId: string, taskId: string) {
  const api = getApi();
  await api.assignTask(windowId, taskId);
  await api.track("task_assigned_to_window", { windowId, taskId });
  refresh();
}

export async function unassignTaskAction(windowId: string, taskId: string) {
  await getApi().unassignTask(windowId, taskId);
  refresh();
}

export async function draftRescheduleAction(meetingId: string): Promise<string> {
  const api = getApi();
  const draft = await api.draftReschedule(meetingId);
  await api.track("reschedule_message_generated", { meetingId });
  refresh();
  return draft;
}

export async function setChecklistItemAction(itemId: string, done: boolean) {
  const api = getApi();
  await api.setChecklistItem(itemId, done);
  if (done) await api.track("checklist_item_completed", { itemId });
  refresh();
}

export async function setTravelMinutesAction(formData: FormData) {
  const minutes = Number(formData.get("minutes"));
  if (!Number.isFinite(minutes)) return;
  await getApi().setTravelMinutes(minutes);
  refresh();
}

export async function trackAction(name: string, props?: AnalyticsProps) {
  if (!isAnalyticsEventName(name)) return;
  await getApi().track(name, props);
}
