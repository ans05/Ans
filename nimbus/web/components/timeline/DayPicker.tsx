import Link from "next/link";

import { formatDayParts } from "@nimbus/core";

import { cn } from "@/components/ui/cn";
import type { WeekDayView } from "@/lib/server/views";

interface DayPickerProps {
  days: WeekDayView[];
  selected: string;
}

export function DayPicker({ days, selected }: DayPickerProps) {
  return (
    <nav aria-label="Days">
      <ol className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {days.map((day) => {
          const { weekday, dayOfMonth } = formatDayParts(day.date);
          const active = day.date === selected;
          return (
            <li key={day.date} className="shrink-0">
              <Link
                href={day.date === days.find((d) => d.isToday)?.date ? "/" : `/?day=${day.date}`}
                aria-current={active ? "date" : undefined}
                aria-label={`${weekday} ${dayOfMonth}${day.isToday ? ", today" : ""}${day.isTravelDay ? ", travel day" : ""}`}
                className={cn(
                  "flex w-12 flex-col items-center rounded-xl py-2 transition-colors duration-150 sm:w-14",
                  active
                    ? "bg-ink text-canvas"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                  {weekday}
                </span>
                <span className={cn("mt-0.5 text-[15px] font-semibold tabular", day.isToday && !active && "text-accent-ink")}>
                  {dayOfMonth}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 size-1 rounded-full",
                    day.isTravelDay ? (active ? "bg-canvas/80" : "bg-accent") : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
