import { formatDuration, formatTime, isBefore, leaveNowState, type AttentionItem } from '@nimbus/core';
import {
  isEveningBefore,
  selectLeaveNowPlan,
  selectNextDeparture,
  selectPrepChecklist,
  selectShieldReport,
  selectWindowTasks,
  selectWindows,
  type Snapshot,
} from './selectors';

/**
 * What Nimbus the mascot should say right now, most urgent first. The slot in the
 * shell renders only the first item, so there is never more than one mascot.
 *
 * Priority 1 is "do something in the next hour" (leave for the airport), 2 is
 * "tonight or right now" (prep the evening before, an unplanned live window),
 * 3 is a standing warning for the trip (late-night meetings).
 */
export function computeAttention(snap: Snapshot): AttentionItem[] {
  const items: AttentionItem[] = [];
  const nextFlight = selectNextDeparture(snap);

  if (nextFlight) {
    const plan = selectLeaveNowPlan(snap, nextFlight);
    const { status, minutesUntilLeave } = leaveNowState(plan, snap.now);
    const flightName = `${nextFlight.carrier} ${nextFlight.flightNumber}`;
    const airport = nextFlight.from.code ?? nextFlight.from.name;
    if (status === 'now') {
      items.push({
        id: `leave:${nextFlight.id}:now`,
        severity: 'warning',
        priority: 1,
        title: `Time to leave for ${airport}`,
        detail: `${flightName} departs ${formatTime(plan.departure, plan.timeZone)}. Leaving now keeps your ${formatDuration(plan.airportMinutes)} at the airport.`,
        href: '/',
        cta: 'See plan',
      });
    } else if (status === 'soon') {
      items.push({
        id: `leave:${nextFlight.id}:soon`,
        severity: 'warning',
        priority: 1,
        title: `Leave for ${airport} in ${formatDuration(minutesUntilLeave)}`,
        detail: `${flightName} departs ${formatTime(plan.departure, plan.timeZone)}.`,
        href: '/',
        cta: 'See plan',
      });
    }

    if (isEveningBefore(snap, nextFlight)) {
      const items_ = selectPrepChecklist(snap, nextFlight);
      const remaining = items_.filter((item) => !item.done).length;
      items.push({
        id: `prep:${nextFlight.id}`,
        severity: 'info',
        priority: 2,
        title: `${flightName} is tomorrow`,
        detail: remaining === 0 ? 'Your offline checklist is complete.' : `${remaining} ${remaining === 1 ? 'item' : 'items'} to download before you go offline.`,
        href: '/prep',
        cta: 'Open checklist',
      });
    }
  }

  const shield = selectShieldReport(snap);
  if (shield.upcomingCount > 0) {
    items.push({
      id: `shield:${shield.upcomingCount}`,
      severity: 'warning',
      priority: 3,
      title: `${shield.upcomingCount} ${shield.upcomingCount === 1 ? 'meeting lands' : 'meetings land'} between 10 PM and 7 AM in ${snap.week.trip.destination.name}`,
      detail: 'Nimbus can draft a polite note to move each one.',
      href: '/shield',
      cta: 'Review',
    });
  }

  const liveWindow = selectWindows(snap).find((w) => !isBefore(snap.now, w.start) && isBefore(snap.now, w.end));
  if (liveWindow && selectWindowTasks(snap, liveWindow.id).length === 0) {
    items.push({
      id: `focus:${liveWindow.id}`,
      severity: 'info',
      priority: 2,
      title: `${formatDuration(liveWindow.durationMinutes)} of ${liveWindow.connectivity === 'offline' ? 'offline' : 'connected'} time at ${liveWindow.title.toLowerCase()}`,
      detail: 'Nothing is planned for it yet.',
      href: `/focus#${liveWindow.id}`,
      cta: 'Plan it',
    });
  }

  return items
    .filter((item) => !snap.state.dismissedAttention.includes(item.id))
    .sort((a, b) => a.priority - b.priority || (a.severity === 'warning' ? -1 : 1));
}
