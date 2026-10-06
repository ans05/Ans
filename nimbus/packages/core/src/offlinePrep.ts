import { atLocalTime, dayKeyOf, isBefore, shiftDay, toDate } from "./time";
import type {
  Assignment,
  Checklist,
  ChecklistItem,
  Flight,
  FocusWindow,
  IsoDateTime,
  Task,
  Trip,
} from "./types";

/** The checklist becomes active at this local hour the evening before departure. */
export const PREP_OPENS_AT = "17:00";

export interface ChecklistInput {
  trip: Trip;
  tasks: Task[];
  assignments: Assignment[];
  focusWindows: FocusWindow[];
  completedItemIds: Iterable<string>;
  now: IsoDateTime | Date;
}

/** The next flight that has not departed yet. */
export const nextFlight = (trip: Trip, now: IsoDateTime | Date): Flight | null => {
  const upcoming = trip.flights
    .filter((f) => !isBefore(f.departs, now))
    .sort((a, b) => a.departs.localeCompare(b.departs));
  return upcoming[0] ?? null;
};

export const isPrepWindowOpen = (flight: Flight, now: IsoDateTime | Date): boolean => {
  const departureDay = dayKeyOf(flight.departs, flight.from.zone);
  const opens = atLocalTime(shiftDay(departureDay, -1), PREP_OPENS_AT, flight.from.zone);
  const t = toDate(now).getTime();
  return t >= opens.getTime() && t < toDate(flight.departs).getTime();
};

/** Tasks the user has placed in focus windows that happen during this flight. */
export const tasksDuringFlight = (
  flight: Flight,
  trip: Trip,
  focusWindows: FocusWindow[],
  assignments: Assignment[],
  tasks: Task[],
): Task[] => {
  const flightBlockIds = new Set(
    trip.travelBlocks.filter((b) => b.flightId === flight.id).map((b) => b.id),
  );
  const windowIds = new Set(
    focusWindows.filter((w) => flightBlockIds.has(w.blockId)).map((w) => w.id),
  );
  const taskIds = new Set(
    assignments.filter((a) => windowIds.has(a.windowId)).map((a) => a.taskId),
  );
  return tasks.filter((t) => taskIds.has(t.id));
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * Build the offline checklist for the next flight. Returns null when no
 * flight is ahead. Items come from the tasks planned for the flight.
 */
export const buildChecklist = ({
  trip,
  tasks,
  assignments,
  focusWindows,
  completedItemIds,
  now,
}: ChecklistInput): Checklist | null => {
  const flight = nextFlight(trip, now);
  if (!flight) return null;

  const done = new Set(completedItemIds);
  const items: ChecklistItem[] = [];
  const seen = new Set<string>();

  const push = (item: Omit<ChecklistItem, "done">) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push({ ...item, done: done.has(item.id) });
  };

  for (const task of tasksDuringFlight(flight, trip, focusWindows, assignments, tasks)) {
    if (task.offlineNeeds.length === 0) {
      push({
        id: `${flight.id}:task:${task.id}:notes`,
        label: `Sync notes for “${task.title}”`,
        source: "task",
        taskId: task.id,
      });
      continue;
    }
    for (const need of task.offlineNeeds) {
      push({
        id: `${flight.id}:task:${task.id}:${slug(need)}`,
        label: need,
        source: "task",
        taskId: task.id,
      });
    }
  }

  push({
    id: `${flight.id}:flight:boarding-pass`,
    label: `Save the ${flight.carrier} ${flight.number} boarding pass offline`,
    source: "flight",
  });

  return { flight, active: isPrepWindowOpen(flight, now), items };
};
