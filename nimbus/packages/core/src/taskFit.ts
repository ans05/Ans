import { connectivityLabel } from "./focusWindows";
import { formatDuration } from "./time";
import type { Assignment, FocusWindow, Task } from "./types";

export interface TaskSuggestion {
  task: Task;
  score: number;
  reason: string;
}

export interface SuggestOptions {
  limit?: number;
}

/** A task fits a window if it is short enough and the connectivity allows it. */
export const taskFitsWindow = (task: Task, window: FocusWindow): boolean => {
  if (task.estimateMinutes > window.minutes) return false;
  if (task.needsConnectivity && window.connectivity === "offline") return false;
  return true;
};

const fitReason = (task: Task, window: FocusWindow): string => {
  const parts = [`${formatDuration(task.estimateMinutes)} of ${formatDuration(window.minutes)}`];
  if (window.connectivity === "offline") parts.push("works offline");
  else if (task.needsConnectivity) parts.push(`needs ${connectivityLabel(window.connectivity)}`);
  return parts.join(" · ");
};

/**
 * Rank the user's open tasks for a window. Tasks already placed in another
 * window are excluded; tasks already in this window are excluded too, since
 * the caller renders those separately.
 */
export const suggestTasksForWindow = (
  window: FocusWindow,
  tasks: Task[],
  assignments: Assignment[],
  { limit = 4 }: SuggestOptions = {},
): TaskSuggestion[] => {
  const placed = new Set(assignments.map((a) => a.taskId));

  return tasks
    .filter((task) => !task.done && !placed.has(task.id) && taskFitsWindow(task, window))
    .map((task) => {
      const kindRank = window.suitedFor.indexOf(task.kind);
      const kindScore = kindRank === -1 ? 0 : 3 - kindRank;
      const priorityScore = 4 - task.priority;
      // Prefer tasks that use the window well, without dominating the ranking.
      const utilisation = task.estimateMinutes / window.minutes;
      return {
        task,
        score: kindScore * 10 + priorityScore * 3 + utilisation,
        reason: fitReason(task, window),
      };
    })
    .sort((a, b) => b.score - a.score || b.task.estimateMinutes - a.task.estimateMinutes)
    .slice(0, limit);
};
