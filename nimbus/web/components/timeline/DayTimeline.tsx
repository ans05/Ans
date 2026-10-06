import Link from "next/link";

import {
  formatAxisHour,
  formatDayLong,
  type FocusWindow,
  type Meeting,
  type Positioned,
  type TravelBlock,
  type TravelKind,
} from "@nimbus/core";

import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { DayView } from "@/lib/server/views";

const PX_PER_MINUTE = 1.4;
const MIN_ITEM_HEIGHT = 24;
/** Items at least this tall show their time range. */
const DETAIL_HEIGHT = 40;
/** Hour labels this close to the "now" marker step aside for it. */
const NOW_LABEL_CLEARANCE = 15;

const travelIcon: Record<TravelKind, IconName> = {
  ride: "car",
  security: "security",
  gate: "gate",
  boarding: "boarding",
  flight: "plane",
  train: "train",
  hotel: "hotel",
};

interface DayTimelineProps {
  view: DayView;
}

export function DayTimeline({ view }: DayTimelineProps) {
  const { timeline, labels, nowLabel, clashIds } = view;
  const clashes = new Set(clashIds);
  const { axisStart, axisEnd, nowMinute } = timeline;
  const height = (axisEnd - axisStart) * PX_PER_MINUTE;
  const top = (minute: number) => (minute - axisStart) * PX_PER_MINUTE;

  const hours: number[] = [];
  for (let m = axisStart; m <= axisEnd; m += 60) hours.push(m);

  const showNow = nowMinute !== null && nowMinute >= axisStart && nowMinute <= axisEnd;
  const empty = timeline.travel.length + timeline.work.length === 0;

  return (
    <section aria-label={`Timeline for ${formatDayLong(timeline.date)}`}>
      <div className="mb-2 grid grid-cols-[3rem_1fr_1fr] gap-x-2 sm:grid-cols-[3.5rem_1fr_1fr] sm:gap-x-4">
        <span />
        <LaneHeader icon="plane">Travel</LaneHeader>
        <LaneHeader icon="timeline">Work</LaneHeader>
      </div>

      <div className="relative" style={{ height }}>
        {hours.map((m) => (
          <div
            key={m}
            aria-hidden="true"
            className="absolute inset-x-0 flex items-start"
            style={{ top: top(m) }}
          >
            <span className="w-12 shrink-0 -translate-y-1/2 pr-2 text-right text-[11px] text-ink-3 tabular sm:w-14">
              {showNow && Math.abs(nowMinute - m) < NOW_LABEL_CLEARANCE ? "" : formatAxisHour(m)}
            </span>
            <div className="flex-1 border-t border-line" />
          </div>
        ))}

        <div className="absolute inset-y-0 left-12 right-0 grid grid-cols-2 gap-x-2 sm:left-14 sm:gap-x-4">
          <ol className="relative" aria-label="Travel">
            {timeline.travel.map((p) => (
              <TravelItem key={p.item.id} positioned={p} label={labels[p.item.id]} top={top} />
            ))}
          </ol>
          <ol className="relative" aria-label="Work">
            {timeline.work.map((p) => (
              <WorkItem key={p.item.id} positioned={p} label={labels[p.item.id]} top={top} clash={clashes.has(p.item.id)} />
            ))}
            {timeline.focus.map((p) => (
              <FocusItem key={p.item.id} positioned={p} label={labels[p.item.id]} top={top} />
            ))}
          </ol>
        </div>

        {showNow ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: top(nowMinute) }}
            aria-label={`Now, ${nowLabel}`}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-[11px] font-semibold text-accent-ink tabular sm:w-14">
              {nowLabel}
            </span>
            <div className="relative flex-1 border-t-2 border-accent">
              <span className="absolute -left-0.5 -top-[5px] size-2 rounded-full bg-accent" />
            </div>
          </div>
        ) : null}

        {empty ? (
          <p className="absolute inset-x-12 top-1/2 -translate-y-1/2 text-center text-sm text-ink-3 sm:inset-x-14">
            A clear day. Nothing scheduled.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function LaneHeader({ icon, children }: { icon: IconName; children: string }) {
  return (
    <h2 className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-3">
      <Icon name={icon} size={12} />
      {children}
    </h2>
  );
}

interface ItemProps<T extends { start: string; end: string }> {
  positioned: Positioned<T>;
  label: { time: string; duration: string } | undefined;
  top: (minute: number) => number;
}

const itemStyle = <T extends { start: string; end: string }>(
  p: Positioned<T>,
  top: (m: number) => number,
) => ({
  top: top(p.startMinute),
  height: Math.max(MIN_ITEM_HEIGHT, (p.endMinute - p.startMinute) * PX_PER_MINUTE),
});

const clipClasses = <T extends { start: string; end: string }>(p: Positioned<T>) =>
  cn(p.continuesFromPrevious && "rounded-t-none border-t-0", p.continuesToNext && "rounded-b-none border-b-0");

function TravelItem({ positioned: p, label, top }: ItemProps<TravelBlock>) {
  const style = itemStyle(p, top);
  const detailed = style.height >= DETAIL_HEIGHT;
  return (
    <li className="absolute inset-x-0 px-px" style={style}>
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border border-accent/30 bg-accent-soft px-2 py-0.5 text-ink sm:px-2.5",
          clipClasses(p),
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon name={travelIcon[p.item.kind]} size={13} className="shrink-0 text-accent-ink" />
          <span className="truncate text-[12px] font-medium leading-5 sm:text-[13px]">{p.item.title}</span>
        </div>
        {detailed ? (
          <>
            <span className="truncate text-[11px] text-ink-2 tabular">{label?.time}</span>
            {p.item.subtitle && style.height >= DETAIL_HEIGHT + 16 ? (
              <span className="truncate text-[11px] text-ink-3">{p.item.subtitle}</span>
            ) : null}
          </>
        ) : null}
        {p.continuesToNext ? (
          <span className="mt-auto text-[11px] text-ink-3">continues tomorrow</span>
        ) : null}
      </div>
    </li>
  );
}

function WorkItem({ positioned: p, label, top, clash }: ItemProps<Meeting> & { clash: boolean }) {
  const style = itemStyle(p, top);
  const detailed = style.height >= DETAIL_HEIGHT;
  const isTaskBlock = p.item.kind === "task-block";
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium leading-5 sm:text-[13px]">
        {clash ? <Icon name="alert" size={12} className="shrink-0 text-warn-ink" /> : null}
        <span className="truncate">{p.item.title}</span>
      </span>
      {detailed ? (
        <span className="truncate text-[11px] text-ink-2 tabular">
          {label?.time}
          {p.item.organizer && style.height >= DETAIL_HEIGHT + 16 ? (
            <span className="text-ink-3"> · {p.item.organizer}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );
  const classes = cn(
    "flex h-full flex-col overflow-hidden rounded-xl border px-2 py-0.5 sm:px-2.5",
    clash
      ? "border-warn/60 bg-warn-soft text-ink"
      : isTaskBlock
        ? "border-line bg-surface-2 text-ink-2"
        : "border-line bg-surface text-ink shadow-xs",
    clipClasses(p),
  );
  return (
    <li className="absolute inset-x-0 px-px" style={style}>
      {clash ? (
        <Link href="/shield" className={cn(classes, "transition-colors duration-150 hover:bg-warn-soft/70")} aria-label={`${p.item.title}, lands overnight. Open the time zone shield.`}>
          {body}
        </Link>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </li>
  );
}

function FocusItem({ positioned: p, label, top }: ItemProps<FocusWindow>) {
  const style = itemStyle(p, top);
  const detailed = style.height >= DETAIL_HEIGHT;
  return (
    <li className="absolute inset-x-0 px-px" style={style}>
      <Link
        href={`/focus?window=${encodeURIComponent(p.item.id)}`}
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-accent/70 px-2 py-0.5 text-ink transition-colors duration-150 hover:bg-accent-soft/60 sm:px-2.5",
          clipClasses(p),
        )}
      >
        <span className="flex items-center gap-1.5 text-[12px] font-medium leading-5 text-accent-ink sm:text-[13px]">
          <Icon name="focus" size={13} className="shrink-0" />
          <span className="truncate">Focus · {label?.duration}</span>
        </span>
        {detailed ? (
          <span className="truncate text-[11px] text-ink-2">
            {p.item.workStyle} · {p.item.connectivity === "wifi" ? "Wi‑Fi" : p.item.connectivity}
          </span>
        ) : null}
        {p.continuesToNext ? (
          <span className="mt-auto text-[11px] text-ink-3">continues tomorrow</span>
        ) : null}
      </Link>
    </li>
  );
}
