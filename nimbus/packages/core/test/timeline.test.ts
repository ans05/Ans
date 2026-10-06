import { describe, expect, it } from 'vitest';
import { PHASE1_FIXTURES, SAMPLE_WEEK, addDays, buildDayTimeline, startOfLocalDay } from '../src';

function dayTimeline(date: string) {
  const index = SAMPLE_WEEK.days.findIndex((d) => d.date === date);
  const day = SAMPLE_WEEK.days[index];
  const previous = SAMPLE_WEEK.days[index - 1];
  if (!day) throw new Error(`no day ${date}`);
  const notBefore =
    previous && previous.timeZone !== day.timeZone ? startOfLocalDay(addDays(previous.date, 1), previous.timeZone) : undefined;
  return buildDayTimeline({
    date,
    timeZone: day.timeZone,
    notBefore,
    segments: SAMPLE_WEEK.segments,
    meetings: SAMPLE_WEEK.meetings,
    focusWindows: PHASE1_FIXTURES.focusWindows,
    tasks: SAMPLE_WEEK.tasks,
  });
}

describe('buildDayTimeline', () => {
  it('clips an overnight flight to the departure day and marks it as continuing', () => {
    const flight = dayTimeline('2026-10-13').blocks.find((b) => b.refId === 'ba285');
    expect(flight).toBeDefined();
    expect(flight?.startMin).toBe(19 * 60 + 5);
    expect(flight?.endMin).toBe(1440);
    expect(flight?.continuesAfter).toBe(true);
  });

  it('starts the arrival day where the departure day ended so nothing shows twice', () => {
    const wednesday = dayTimeline('2026-10-14');
    const flight = wednesday.blocks.find((b) => b.refId === 'ba285');
    expect(wednesday.timeZone).toBe('Europe/London');
    // Tuesday ran until midnight Pacific, which is 8 AM in London.
    expect(wednesday.rangeStartMin).toBe(8 * 60);
    expect(flight?.continuesBefore).toBe(true);
    expect(flight?.startMin).toBe(8 * 60);
    expect(flight?.endMin).toBe(13 * 60 + 40);
    // The ride to SFO happened on Tuesday; it must not reappear at midnight London time.
    expect(wednesday.blocks.find((b) => b.refId === 'ride-out')).toBeUndefined();
  });

  it('does not trim a day when the zone stays the same', () => {
    expect(dayTimeline('2026-10-15').rangeStartMin).toBe(6 * 60);
  });

  it('keeps a quiet default range and extends it for late blocks', () => {
    expect(dayTimeline('2026-10-12').rangeStartMin).toBe(6 * 60);
    expect(dayTimeline('2026-10-13').rangeEndMin).toBe(1440);
  });
});
