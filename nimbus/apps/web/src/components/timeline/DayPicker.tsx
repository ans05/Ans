'use client';

import { dateWeekday, type IsoDate, type TripDay } from '@nimbus/core';
import { cn } from '@/lib/cn';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface DayPickerProps {
  days: TripDay[];
  selected: IsoDate;
  today: IsoDate;
  flightDates: Set<IsoDate>;
  meetingDates: Set<IsoDate>;
  onSelect: (date: IsoDate) => void;
}

export function DayPicker({ days, selected, today, flightDates, meetingDates, onSelect }: DayPickerProps) {
  return (
    <div role="group" aria-label="Pick a day" className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const isSelected = day.date === selected;
        const isToday = day.date === today;
        const dayNumber = Number(day.date.slice(-2));
        return (
          <button
            key={day.date}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${day.date}${isToday ? ', today' : ''}`}
            onClick={() => onSelect(day.date)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-control py-2 transition-colors duration-150 ease-out',
              isSelected ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-surface-2',
              isToday && !isSelected && 'ring-1 ring-accent ring-inset',
            )}
          >
            <span className={cn('text-[11px] font-medium', isSelected ? 'text-canvas/70' : 'text-ink-3')}>{LETTERS[dateWeekday(day.date)]}</span>
            <span className="text-sm font-semibold tabular-nums">{dayNumber}</span>
            <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
              {flightDates.has(day.date) && <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-accent' : 'bg-accent')} />}
              {meetingDates.has(day.date) && <span className={cn('size-1.5 rounded-full', isSelected ? 'bg-canvas/60' : 'bg-ink-3/60')} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
