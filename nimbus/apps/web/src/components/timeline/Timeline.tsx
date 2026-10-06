'use client';

import type { DayTimeline } from '@nimbus/core';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { TimelineBlockView } from './TimelineBlockView';

const PPM_MOBILE = 1.25;
const PPM_DESKTOP = 1.5;

function hourLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export interface TimelineProps {
  timeline: DayTimeline;
  /** Minutes after midnight for the current time, when it falls on this day. */
  nowMin: number | null;
}

/**
 * One day, two lanes. Travel on the left, work on the right, a shared time axis.
 * Blocks are positioned in minutes and scaled by the --ppm custom property so the
 * same markup fits a phone and a laptop.
 */
export function Timeline({ timeline, nowMin }: TimelineProps) {
  const ppm = useMediaQuery('(min-width: 48rem)') ? PPM_DESKTOP : PPM_MOBILE;

  const { rangeStartMin, rangeEndMin, blocks } = timeline;
  const hours: number[] = [];
  for (let minute = rangeStartMin; minute <= rangeEndMin; minute += 60) hours.push(minute);
  const travel = blocks.filter((block) => block.lane === 'travel');
  const work = blocks.filter((block) => block.lane === 'work');
  const showNow = nowMin !== null && nowMin >= rangeStartMin && nowMin <= rangeEndMin;

  return (
    <section aria-label="Timeline" className="[--ppm:1.25] md:[--ppm:1.5]">
      <div className="grid grid-cols-[44px_minmax(0,0.9fr)_minmax(0,1.1fr)] gap-x-2 pb-2 md:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.2fr)]">
        <span />
        <h2 className="text-meta font-medium uppercase tracking-[0.08em]">Travel</h2>
        <h2 className="text-meta font-medium uppercase tracking-[0.08em]">Work</h2>
      </div>

      <div className="relative" style={{ height: `calc(${rangeEndMin - rangeStartMin} * var(--ppm) * 1px + 1px)` }}>
        {hours.map((minute) => (
          <div
            key={minute}
            aria-hidden
            className="absolute inset-x-0 border-t border-line"
            style={{ top: `calc(${minute - rangeStartMin} * var(--ppm) * 1px)` }}
          >
            <span className="text-meta absolute -top-2.5 left-0 w-[44px] bg-canvas pr-1 tabular-nums md:w-[56px]">{hourLabel(minute)}</span>
          </div>
        ))}

        <div className="absolute inset-y-0 right-0 left-[52px] grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-x-2 md:left-[64px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="relative" aria-label="Travel">
            {travel.map((block) => (
              <TimelineBlockView key={block.id} block={block} rangeStartMin={rangeStartMin} ppm={ppm} />
            ))}
          </div>
          <div className="relative" aria-label="Work">
            {work.map((block) => (
              <TimelineBlockView key={block.id} block={block} rangeStartMin={rangeStartMin} ppm={ppm} />
            ))}
          </div>
        </div>

        {showNow && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-10"
            style={{ top: `calc(${(nowMin as number) - rangeStartMin} * var(--ppm) * 1px)` }}
          >
            <div className="absolute top-[-3.5px] left-[40px] size-2 rounded-full bg-accent md:left-[52px]" />
            <div className="absolute inset-x-[44px] top-0 h-px bg-accent md:left-[56px]" />
          </div>
        )}
      </div>
    </section>
  );
}
