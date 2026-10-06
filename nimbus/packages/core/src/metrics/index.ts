import type { AnalyticsEvent, AnalyticsEventName, FocusWindow, Task, Trip } from '../domain/types';
import { ANALYTICS_EVENT_NAMES } from '../domain/schema';

/**
 * North star: focus minutes planned per trip.
 * For each focus window, count the smaller of the window length and the total
 * estimated minutes of tasks planned into it, then sum over the trip's windows.
 */
export function focusMinutesPlanned(windows: FocusWindow[], tasks: Task[]): number {
  return windows.reduce((sum, window) => {
    const planned = tasks
      .filter((task) => task.assignedWindowId === window.id)
      .reduce((minutes, task) => minutes + task.estimatedMinutes, 0);
    return sum + Math.min(window.durationMinutes, planned);
  }, 0);
}

export interface TripFocusMinutes {
  tripId: string;
  tripName: string;
  plannedMinutes: number;
  availableMinutes: number;
}

export function focusMinutesPerTrip(trips: Trip[], windows: FocusWindow[], tasks: Task[]): TripFocusMinutes[] {
  return trips.map((trip) => {
    const tripWindows = windows.filter((window) => window.tripId === trip.id);
    return {
      tripId: trip.id,
      tripName: trip.name,
      plannedMinutes: focusMinutesPlanned(tripWindows, tasks),
      availableMinutes: tripWindows.reduce((sum, window) => sum + window.durationMinutes, 0),
    };
  });
}

export type EventCounts = Record<AnalyticsEventName, number>;

export function countEvents(events: AnalyticsEvent[]): EventCounts {
  const counts = Object.fromEntries(ANALYTICS_EVENT_NAMES.map((name) => [name, 0])) as EventCounts;
  for (const event of events) counts[event.name] += 1;
  return counts;
}
