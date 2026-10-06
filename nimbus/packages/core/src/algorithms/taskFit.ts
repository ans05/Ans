import type { FocusWindow, Task } from '../domain/types';

/**
 * First-pass ranking of tasks for a focus window. Phase 2 adds tests and refines
 * the scoring; phase 4 lets Claude re-rank and explain the top picks.
 */

export interface TaskFit {
  fits: boolean;
  reason?: 'too-long' | 'needs-connectivity' | 'already-planned';
}

export function taskFitsWindow(task: Task, window: FocusWindow): TaskFit {
  if (task.assignedWindowId && task.assignedWindowId !== window.id) return { fits: false, reason: 'already-planned' };
  if (task.estimatedMinutes > window.durationMinutes) return { fits: false, reason: 'too-long' };
  if (window.connectivity === 'offline' && task.needsConnectivity) return { fits: false, reason: 'needs-connectivity' };
  return { fits: true };
}

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

export function scoreTaskForWindow(task: Task, window: FocusWindow): number {
  const modeMatch = task.mode === window.mode ? 2 : 0;
  const fill = Math.min(1, task.estimatedMinutes / window.durationMinutes);
  // Deep windows reward tasks that use the time; quick windows reward short ones.
  const fillBonus = window.mode === 'deep' ? fill : 1 - fill;
  return modeMatch + PRIORITY_WEIGHT[task.priority] + fillBonus * 0.75;
}

export function suggestTasksForWindow(window: FocusWindow, tasks: Task[], limit = 3): Task[] {
  return tasks
    .filter((task) => !task.assignedWindowId && taskFitsWindow(task, window).fits)
    .map((task) => ({ task, score: scoreTaskForWindow(task, window) }))
    .sort((a, b) => b.score - a.score || a.task.title.localeCompare(b.task.title))
    .slice(0, limit)
    .map(({ task }) => task);
}
