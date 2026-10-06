'use client';

import {
  formatDate,
  isBefore,
  localDate,
  minutesIntoDay,
  weekdayName,
  zoneAbbreviation,
} from '@nimbus/core';
import { useEffect, useState } from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';
import {
  selectDay,
  selectDayTimeline,
  selectDepartureOn,
  selectFlightDates,
  selectMeetingDates,
  selectTodayDate,
} from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { LeaveNowCard } from '@/components/leave-now/LeaveNowCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { DayPicker } from './DayPicker';
import { Timeline } from './Timeline';

export function TodayView() {
  const snap = useSnapshot();
  const { actions } = useNimbus();
  const todayDate = selectTodayDate(snap);
  // A pick is only kept while "today" stays the same, so moving the demo clock resets the view.
  const [pick, setPick] = useState<{ today: string; date: string } | null>(null);
  const selected = pick?.today === todayDate ? pick.date : todayDate;
  const setSelected = (date: string) => setPick({ today: todayDate, date });

  useEffect(() => {
    actions.track('timeline_viewed', { date: selected });
  }, [actions, selected]);

  const day = selectDay(snap.week, selected) ?? snap.week.days[0];
  const timeline = day ? selectDayTimeline(snap, day.date) : undefined;
  if (!day || !timeline) return null;

  const isToday = day.date === todayDate;
  const nowMin = isToday && localDate(snap.now, day.timeZone) === day.date ? minutesIntoDay(snap.now, day.timeZone) : null;
  const departure = selectDepartureOn(snap.week, day.date);
  const showLeaveNow = departure && isBefore(snap.now, departure.start) && localDate(snap.now, departure.from.timeZone) <= day.date;

  return (
    <>
      <PageHeader
        eyebrow={isToday ? 'Today' : 'This week'}
        title={weekdayName(day.date)}
        meta={`${formatDate(day.date, { weekday: 'none', month: 'long' })} · ${day.location} · ${zoneAbbreviation(snap.now, day.timeZone)}`}
      />
      <DayPicker
        days={snap.week.days}
        selected={selected}
        today={todayDate}
        flightDates={selectFlightDates(snap.week)}
        meetingDates={selectMeetingDates(snap.week)}
        onSelect={setSelected}
      />
      {showLeaveNow && <LeaveNowCard flight={departure} />}
      <Timeline timeline={timeline} nowMin={nowMin} />
    </>
  );
}
