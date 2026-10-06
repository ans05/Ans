import type { FlightSegment, FocusWindow, Task } from '../domain/types';

export interface PrepItem {
  id: string;
  label: string;
  source: 'task' | 'standard';
  taskId?: string;
  taskTitle?: string;
}

export interface BuildPrepChecklistInput {
  flight: FlightSegment;
  focusWindows: FocusWindow[];
  tasks: Task[];
  standardItems: string[];
}

/** Downloads needed for the tasks planned into a flight, then the standard items. */
export function buildPrepChecklist({ flight, focusWindows, tasks, standardItems }: BuildPrepChecklistInput): PrepItem[] {
  const flightWindowIds = new Set(focusWindows.filter((w) => w.segmentId === flight.id).map((w) => w.id));
  const items: PrepItem[] = [];
  for (const task of tasks) {
    if (!task.assignedWindowId || !flightWindowIds.has(task.assignedWindowId)) continue;
    (task.offlinePrep ?? []).forEach((label, index) => {
      items.push({ id: `${flight.id}:${task.id}:${index}`, label, source: 'task', taskId: task.id, taskTitle: task.title });
    });
  }
  standardItems.forEach((label, index) => {
    items.push({ id: `${flight.id}:std:${index}`, label, source: 'standard' });
  });
  return items;
}
