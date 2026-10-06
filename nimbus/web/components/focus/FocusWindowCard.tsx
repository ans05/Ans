"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import type { TravelKind } from "@nimbus/core";

import { assignTaskAction, trackAction, unassignTaskAction } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import type { FocusWindowView } from "@/lib/server/views";

const kindIcon: Record<TravelKind, IconName> = {
  ride: "car",
  security: "security",
  gate: "gate",
  boarding: "boarding",
  flight: "plane",
  train: "train",
  hotel: "hotel",
};

const connectivityIcon: Record<string, IconName> = {
  wifi: "wifi",
  cellular: "signal",
  offline: "wifiOff",
};

interface FocusWindowCardProps {
  view: FocusWindowView;
  defaultOpen?: boolean;
}

export function FocusWindowCard({ view, defaultOpen = false }: FocusWindowCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const viewed = useRef(false);
  const panelId = useId();
  const ref = useRef<HTMLLIElement>(null);
  const { window: w } = view;

  useEffect(() => {
    if (!open || viewed.current) return;
    viewed.current = true;
    void trackAction("focus_window_viewed", { windowId: w.id, minutes: w.minutes, kind: w.kind });
  }, [open, w.id, w.minutes, w.kind]);

  useEffect(() => {
    if (defaultOpen) ref.current?.scrollIntoView({ block: "center" });
  }, [defaultOpen]);

  const assign = (taskId: string) =>
    startTransition(async () => {
      await assignTaskAction(w.id, taskId);
    });
  const unassign = (taskId: string) =>
    startTransition(async () => {
      await unassignTaskAction(w.id, taskId);
    });

  const count = view.assigned.length;

  return (
    <li
      ref={ref}
      id={`window-${w.id}`}
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-xs transition-[box-shadow,border-color] duration-200",
        open && "border-line-2 shadow-sm",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 rounded-2xl p-4 text-left sm:p-5"
      >
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <Icon name={kindIcon[w.kind]} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[15px] font-semibold text-ink">{view.blockTitle}</span>
            <span className="text-[13px] text-ink-3 tabular">{view.timeLabel}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
            <span className="font-medium text-ink">{view.durationLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Icon name={connectivityIcon[w.connectivity] ?? "signal"} size={12} />
              {view.connectivityLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>{w.workStyle}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {count > 0 ? (
            <Pill tone="accent">
              {count} {count === 1 ? "task" : "tasks"}
            </Pill>
          ) : (
            <Pill>Open</Pill>
          )}
          <Icon
            name="chevronDown"
            size={16}
            className={cn("text-ink-3 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>

      <div id={panelId} hidden={!open} className="border-t border-line px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className={cn("grid gap-6 sm:grid-cols-2", pending && "opacity-60")} aria-busy={pending}>
          <div>
            <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-3">Planned</h3>
            {view.assigned.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing planned yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {view.assigned.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 rounded-xl bg-accent-soft/70 px-3 py-2">
                    <Icon name="check" size={14} className="shrink-0 text-accent-ink" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
                    <span className="text-[12px] text-ink-3 tabular">{task.estimateMinutes}m</span>
                    <button
                      type="button"
                      onClick={() => unassign(task.id)}
                      aria-label={`Remove ${task.title} from this window`}
                      className="grid size-6 place-items-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface hover:text-ink"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-3">Fits this window</h3>
            {view.suggestions.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing on your list fits here.</p>
            ) : (
              <ul className="space-y-1.5">
                {view.suggestions.map(({ task, reason }) => (
                  <li key={task.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{task.title}</span>
                      <span className="block truncate text-[12px] text-ink-3">{reason}</span>
                    </span>
                    <Button size="sm" icon="plus" onClick={() => assign(task.id)} aria-label={`Add ${task.title} to this window`}>
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
