import "server-only";

import {
  ANALYTICS_EVENT_NAMES,
  applyFlightDelays,
  atLocalTime,
  buildChecklist,
  buildDayTimeline,
  connectivityLabel,
  dayKeyOf,
  deriveAttention,
  detectFocusWindows,
  draftRescheduleTemplate,
  findClashes,
  formatDayLong,
  formatDayParts,
  formatDayRange,
  formatDuration,
  formatRange,
  formatTime,
  leaveCardFlightFor,
  minutesBetween,
  planLeave,
  plannedFocusMinutes,
  shiftDay,
  suggestAlternativeSlot,
  suggestTasksForWindow,
  travelKindLabel,
  zoneAbbreviation,
  zoneOffsetDifferenceHours,
  type AnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsProps,
  type Assignment,
  type Attention,
  type DayKey,
  type FocusWindow,
  type Meeting,
  type Task,
  type Trip,
  type TripDay,
  type UserProfile,
} from "@nimbus/core";
import { sampleWeek } from "@nimbus/core/mock";

import type { NimbusApi } from "./api";
import type {
  ClashView,
  DayView,
  FocusView,
  FocusWindowView,
  LeavePlanView,
  MetricsView,
  PrepView,
  ShieldView,
  WeekDayView,
  WeekView,
} from "./views";

/** Everything that can change while the demo runs. */
interface LocalState {
  user: UserProfile;
  trip: Trip;
  meetings: Meeting[];
  tasks: Task[];
  assignments: Assignment[];
  completedChecklistItems: Set<string>;
  drafts: Map<string, string>;
  events: AnalyticsEvent[];
}

const freshState = (): LocalState => ({
  user: { ...sampleWeek.user },
  trip: structuredClone(sampleWeek.trip),
  meetings: structuredClone(sampleWeek.meetings),
  tasks: structuredClone(sampleWeek.tasks),
  assignments: structuredClone(sampleWeek.assignments),
  completedChecklistItems: new Set<string>(),
  drafts: new Map<string, string>(),
  events: [],
});

// Survive Next.js dev-server module reloads.
const globalStore = globalThis as unknown as { __nimbusLocalState?: LocalState };
const state = (): LocalState => (globalStore.__nimbusLocalState ??= freshState());

const now = (): Date => {
  const configured = process.env.NIMBUS_DEMO_NOW;
  if (configured === "real") return new Date();
  return new Date(configured || sampleWeek.demoNow);
};

const weekDays = (trip: Trip, today: DayKey): WeekDayView[] => {
  const byDate = new Map(trip.days.map((d) => [d.date, d]));
  const travelDays = new Set(
    trip.flights.map((f) => dayKeyOf(f.departs, f.from.zone)),
  );
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(sampleWeek.weekStart, i);
    const tripDay: TripDay = byDate.get(date) ?? {
      date,
      zone: trip.homeZone,
      city: trip.homeCity,
    };
    return {
      ...tripDay,
      isToday: date === today,
      isTravelDay: travelDays.has(date),
      inTrip: byDate.has(date),
    };
  });
};

const todayKey = (trip: Trip): DayKey => {
  const t = now();
  // "Today" is the date where the user currently is: destination zone if the trip has started there.
  const inDestination = trip.days.find(
    (d) => d.zone === trip.destinationZone && d.date === dayKeyOf(t, trip.destinationZone),
  );
  return inDestination ? inDestination.date : dayKeyOf(t, trip.homeZone);
};

/** The trip as it stands today: reported flight delays push travel blocks later. */
const currentTrip = (s: LocalState): Trip => applyFlightDelays(s.trip);

const focusWindows = (s: LocalState): FocusWindow[] =>
  detectFocusWindows(currentTrip(s).travelBlocks, s.meetings);

const relativeLabel = (minutes: number): string => {
  if (Math.abs(minutes) < 1) return "now";
  if (minutes > 24 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return `in ${days} ${days === 1 ? "day" : "days"}`;
  }
  const text = formatDuration(Math.abs(minutes));
  return minutes > 0 ? `in ${text}` : `${text} ago`;
};

/**
 * A time range for display. Flights end in a different zone, so their arrival
 * is shown in the destination's local time: "1:40 pm → 8:05 am BST".
 */
const rangeLabel = (s: LocalState, start: string, end: string, zone: string, flightId?: string) => {
  const flight = flightId ? s.trip.flights.find((f) => f.id === flightId) : undefined;
  if (!flight) return formatRange(start, end, zone);
  const arrivalZone = flight.to.zone;
  return `${formatTime(start, zone)} → ${formatTime(end, arrivalZone)} ${zoneAbbreviation(end, arrivalZone)}`;
};

const leavePlanView = (s: LocalState, day: DayKey): LeavePlanView | null => {
  const flight = leaveCardFlightFor(s.trip, day, now());
  if (!flight) return null;
  const plan = planLeave({ flight, travelMinutes: s.user.travelMinutesToAirport, now: now() });
  if (plan.status === "departed") return null;
  const zone = flight.from.zone;
  return {
    plan,
    leaveAtLabel: formatTime(plan.leaveAt, zone),
    departsLabel: formatTime(flight.departs, zone),
    flightLabel: `${flight.number} to ${flight.to.city}`,
    airportCode: flight.from.code,
    relativeLabel: relativeLabel(plan.minutesUntilLeave),
  };
};

const dayLabelFor = (day: DayKey): string => {
  const { weekday } = formatDayParts(day);
  return `${weekday} ${formatDayLong(day).split(", ")[1]}`;
};

const focusWindowView = (s: LocalState, w: FocusWindow): FocusWindowView => {
  const block = currentTrip(s).travelBlocks.find((b) => b.id === w.blockId);
  const zone =
    s.trip.days.find((d) => d.date === dayKeyOf(w.start, d.zone))?.zone ?? s.trip.homeZone;
  const day = dayKeyOf(w.start, zone);
  const assignedIds = new Set(s.assignments.filter((a) => a.windowId === w.id).map((a) => a.taskId));
  return {
    window: w,
    blockTitle: block?.title ?? travelKindLabel(w.kind),
    day,
    dayLabel: dayLabelFor(day),
    zone,
    timeLabel: block?.flightId
      ? rangeLabel(s, w.start, w.end, zone, block.flightId)
      : `${formatRange(w.start, w.end, zone)} ${zoneAbbreviation(w.start, zone)}`,
    durationLabel: formatDuration(w.minutes),
    kindLabel: travelKindLabel(w.kind),
    connectivityLabel: connectivityLabel(w.connectivity),
    assigned: s.tasks.filter((t) => assignedIds.has(t.id)),
    suggestions: suggestTasksForWindow(w, s.tasks, s.assignments),
  };
};

const clashView = (s: LocalState, clash: ReturnType<typeof findClashes>[number]): ClashView => {
  const home = s.trip.homeZone;
  const alt = suggestAlternativeSlot(clash, home);
  return {
    clash,
    dayLabel: dayLabelFor(clash.localDay),
    localLabel: `${clash.localStart} – ${clash.localEnd} ${zoneAbbreviation(clash.meeting.start, clash.zone)}`,
    homeLabel: `${formatTime(clash.meeting.start, home)} ${zoneAbbreviation(clash.meeting.start, home)}`,
    alternative: alt ? { destination: alt.destination, home: alt.home } : null,
    draft: s.drafts.get(clash.meeting.id) ?? null,
  };
};

class LocalNimbusApi implements NimbusApi {
  async getWeek(): Promise<WeekView> {
    const s = state();
    const today = todayKey(s.trip);
    const { id, title, destinationCity, homeCity, start, end } = s.trip;
    return { days: weekDays(s.trip, today), today, trip: { id, title, destinationCity, homeCity, start, end } };
  }

  async getDay(day: DayKey): Promise<DayView> {
    const s = state();
    const week = await this.getWeek();
    const dayView = week.days.find((d) => d.date === day) ?? week.days[0]!;
    const zone = dayView.zone;
    const windows = focusWindows(s);
    const timeline = buildDayTimeline({
      date: dayView.date,
      zone,
      travelBlocks: currentTrip(s).travelBlocks,
      meetings: s.meetings,
      focusWindows: windows,
      now: now(),
    });

    const labels: DayView["labels"] = {};
    const label = (id: string, start: string, end: string, flightId?: string) => {
      labels[id] = {
        time: rangeLabel(s, start, end, zone, flightId),
        duration: formatDuration(minutesBetween(start, end)),
      };
    };
    for (const p of timeline.travel) label(p.item.id, p.item.start, p.item.end, p.item.flightId);
    for (const p of timeline.work) label(p.item.id, p.item.start, p.item.end);
    for (const p of timeline.focus) {
      const block = currentTrip(s).travelBlocks.find((b) => b.id === p.item.blockId);
      label(p.item.id, p.item.start, p.item.end, block?.flightId);
    }
    const clashIds = findClashes(s.meetings, s.trip).map((c) => c.meeting.id);

    return {
      day: dayView,
      zoneAbbreviation: zoneAbbreviation(atLocalTime(dayView.date, "12:00", zone), zone),
      timeline,
      leavePlan: leavePlanView(s, dayView.date),
      labels,
      clashIds,
      nowLabel: timeline.nowMinute === null ? null : formatTime(now(), zone),
    };
  }

  async getFocus(): Promise<FocusView> {
    const s = state();
    const windows = focusWindows(s);
    const views = windows.map((w) => focusWindowView(s, w));
    return {
      windows: views,
      totalMinutes: windows.reduce((sum, w) => sum + w.minutes, 0),
      plannedMinutes: plannedFocusMinutes(windows, s.assignments.map((a) => a.windowId)),
      tasksPlanned: new Set(s.assignments.map((a) => a.taskId)).size,
    };
  }

  async assignTask(windowId: string, taskId: string): Promise<void> {
    const s = state();
    s.assignments = s.assignments.filter((a) => a.taskId !== taskId);
    s.assignments.push({ windowId, taskId });
  }

  async unassignTask(windowId: string, taskId: string): Promise<void> {
    const s = state();
    s.assignments = s.assignments.filter((a) => !(a.windowId === windowId && a.taskId === taskId));
  }

  async getShield(): Promise<ShieldView> {
    const s = state();
    const clashes = findClashes(s.meetings, s.trip);
    const probe = atLocalTime(s.trip.days[1]?.date ?? s.trip.start, "12:00", s.trip.destinationZone);
    const offsetHours = zoneOffsetDifferenceHours(probe, s.trip.homeZone, s.trip.destinationZone);
    const ahead = offsetHours >= 0;
    return {
      clashes: clashes.map((c) => clashView(s, c)),
      destinationCity: s.trip.destinationCity,
      homeCity: s.trip.homeCity,
      offsetLabel: `${Math.abs(offsetHours)} hours ${ahead ? "ahead of" : "behind"} ${s.trip.homeCity}`,
      tripDatesLabel: formatDayRange(s.trip.start, s.trip.end),
    };
  }

  async draftReschedule(meetingId: string): Promise<string> {
    const s = state();
    const clash = findClashes(s.meetings, s.trip).find((c) => c.meeting.id === meetingId);
    if (!clash) throw new Error(`No clash for meeting ${meetingId}`);
    const draft = draftRescheduleTemplate(clash, s.trip, s.user);
    s.drafts.set(meetingId, draft);
    return draft;
  }

  async getPrep(): Promise<PrepView> {
    const s = state();
    const checklist = buildChecklist({
      trip: currentTrip(s),
      tasks: s.tasks,
      assignments: s.assignments,
      focusWindows: focusWindows(s),
      completedItemIds: s.completedChecklistItems,
      now: now(),
    });
    if (!checklist) {
      return { checklist: null, departsLabel: null, opensLabel: null, completed: 0, total: 0, groups: [] };
    }
    const zone = checklist.flight.from.zone;
    const departureDay = dayKeyOf(checklist.flight.departs, zone);
    const groups: PrepView["groups"] = [];
    for (const item of checklist.items) {
      const title = item.taskId
        ? (s.tasks.find((t) => t.id === item.taskId)?.title ?? "Task")
        : "Flight";
      const group = groups.find((g) => g.title === title);
      if (group) group.itemIds.push(item.id);
      else groups.push({ title, itemIds: [item.id] });
    }
    return {
      checklist,
      departsLabel: `${dayLabelFor(departureDay)} · ${formatTime(checklist.flight.departs, zone)} ${zoneAbbreviation(checklist.flight.departs, zone)}`,
      opensLabel: `${dayLabelFor(shiftDay(departureDay, -1))} · 5:00 pm`,
      completed: checklist.items.filter((i) => i.done).length,
      total: checklist.items.length,
      groups,
    };
  }

  async setChecklistItem(itemId: string, done: boolean): Promise<void> {
    const s = state();
    if (done) s.completedChecklistItems.add(itemId);
    else s.completedChecklistItems.delete(itemId);
  }

  async setTravelMinutes(minutes: number): Promise<void> {
    const s = state();
    s.user.travelMinutesToAirport = Math.min(300, Math.max(5, Math.round(minutes)));
  }

  async getAttention(): Promise<Attention | null> {
    const s = state();
    const today = todayKey(s.trip);
    const windows = focusWindows(s);
    const leave = leavePlanView(s, today);
    return deriveAttention({
      leavePlan: leave?.plan ?? null,
      clashes: findClashes(s.meetings, s.trip),
      checklist: buildChecklist({
        trip: currentTrip(s),
        tasks: s.tasks,
        assignments: s.assignments,
        focusWindows: windows,
        completedItemIds: s.completedChecklistItems,
        now: now(),
      }),
      destinationCity: s.trip.destinationCity,
    });
  }

  async track(name: AnalyticsEventName, props?: AnalyticsProps): Promise<void> {
    const s = state();
    s.events.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      at: new Date().toISOString(),
      userId: s.user.id,
      tripId: s.trip.id,
      ...(props ? { props } : {}),
    });
  }

  async getMetrics(): Promise<MetricsView> {
    const s = state();
    const counts = Object.fromEntries(
      ANALYTICS_EVENT_NAMES.map((n) => [n, s.events.filter((e) => e.name === n).length]),
    ) as MetricsView["counts"];
    const minutes = plannedFocusMinutes(focusWindows(s), s.assignments.map((a) => a.windowId));
    return {
      counts,
      totalEvents: s.events.length,
      northStar: {
        label: "Focus minutes planned per trip",
        minutes,
        perTrip: [{ tripId: s.trip.id, title: s.trip.title, minutes }],
      },
    };
  }
}

export const localApi: NimbusApi = new LocalNimbusApi();
