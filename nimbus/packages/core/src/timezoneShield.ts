import { atLocalTime, dayKeyOf, formatDayRange, formatTime, localHour, zoneAbbreviation } from "./time";
import type { Clash, Meeting, Trip, UserProfile, Zone } from "./types";

/** Meetings starting at or after `start`, or before `end`, local time, are clashes. */
export const QUIET_HOURS = { start: 22, end: 7 } as const;

export const WORKING_HOURS = { start: 9, end: 18 } as const;

export const isQuietHour = (hour: number): boolean =>
  hour >= QUIET_HOURS.start || hour < QUIET_HOURS.end;

/** The days of a trip on which the user is in the destination zone. */
export const destinationDays = (trip: Trip): Set<string> =>
  new Set(trip.days.filter((d) => d.zone === trip.destinationZone).map((d) => d.date));

/**
 * Find meetings that land in the quiet hours of the destination zone while
 * the user is there. Task blocks are the user's own and never clash.
 */
export const findClashes = (meetings: Meeting[], trip: Trip): Clash[] => {
  const zone = trip.destinationZone;
  const there = destinationDays(trip);

  return meetings
    .filter((m) => m.kind === "meeting")
    .flatMap((meeting) => {
      const localDay = dayKeyOf(meeting.start, zone);
      if (!there.has(localDay)) return [];
      const hour = localHour(meeting.start, zone);
      if (!isQuietHour(hour)) return [];
      return [
        {
          meeting,
          zone,
          localDay,
          localStart: formatTime(meeting.start, zone),
          localEnd: formatTime(meeting.end, zone),
          reason: hour >= QUIET_HOURS.start ? "late" : "early",
        } satisfies Clash,
      ];
    })
    .sort((a, b) => a.meeting.start.localeCompare(b.meeting.start));
};

export interface AlternativeSlot {
  /** "5:00 pm – 6:00 pm BST" */
  destination: string;
  /** "9:00 am – 10:00 am PDT" */
  home: string;
  startIso: string;
}

/**
 * The first hour of the clash's local day that is inside working hours in
 * both zones, if any. Returned as a human-friendly suggestion.
 */
export const suggestAlternativeSlot = (
  clash: Clash,
  homeZone: Zone,
): AlternativeSlot | null => {
  const { localDay, zone } = clash;
  for (let hour = WORKING_HOURS.start; hour < WORKING_HOURS.end; hour++) {
    const start = atLocalTime(localDay, `${String(hour).padStart(2, "0")}:00`, zone);
    const homeHour = localHour(start, homeZone);
    if (homeHour >= WORKING_HOURS.start && homeHour < WORKING_HOURS.end - 1) {
      const end = new Date(start.getTime() + 60 * 60_000);
      return {
        destination: `${formatTime(start, zone)} – ${formatTime(end, zone)} ${zoneAbbreviation(start, zone)}`,
        home: `${formatTime(start, homeZone)} – ${formatTime(end, homeZone)} ${zoneAbbreviation(start, homeZone)}`,
        startIso: start.toISOString(),
      };
    }
  }
  return null;
};

/**
 * Deterministic reschedule note used in local mock mode. The deployed app
 * replaces this with a Claude-written message that follows the same brief.
 */
export const draftRescheduleTemplate = (
  clash: Clash,
  trip: Trip,
  user: UserProfile,
): string => {
  const greeting = clash.meeting.organizer ? `Hi ${clash.meeting.organizer},` : "Hi all,";
  const when = `${formatTime(clash.meeting.start, trip.homeZone)} ${zoneAbbreviation(clash.meeting.start, trip.homeZone)}`;
  const local = `${clash.localStart} ${zoneAbbreviation(clash.meeting.start, clash.zone)}`;
  const dates = formatDayRange(trip.start, trip.end);
  const slot = suggestAlternativeSlot(clash, trip.homeZone);

  if (!clash.meeting.movable) {
    return [
      greeting,
      "",
      `I'll be in ${trip.destinationCity} ${dates}, so ${clash.meeting.title} at ${when} lands at ${local} for me. I'll catch the recording and follow up on anything that needs me.`,
      "",
      `Thanks,\n${user.name}`,
    ].join("\n");
  }

  const ask = slot
    ? `Could we move it to ${slot.home}? That's ${slot.destination} for me and still inside your day.`
    : "Could we find a slot that works in both time zones?";

  return [
    greeting,
    "",
    `I'll be in ${trip.destinationCity} ${dates}, so our ${clash.meeting.title} at ${when} would be ${local} for me. ${ask}`,
    "",
    `Thanks,\n${user.name}`,
  ].join("\n");
};
