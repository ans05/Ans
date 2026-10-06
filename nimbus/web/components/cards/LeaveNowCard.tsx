"use client";

import { useRef } from "react";

import { setTravelMinutesAction } from "@/app/actions";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";
import type { LeavePlanView } from "@/lib/server/views";

interface LeaveNowCardProps {
  view: LeavePlanView;
}

const hours = (minutes: number) =>
  minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export function LeaveNowCard({ view }: LeaveNowCardProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { plan } = view;
  const urgent = plan.status === "now" || plan.status === "late";
  const soon = plan.status === "soon";

  const headline =
    plan.status === "late"
      ? `You should be on your way to ${view.airportCode}`
      : plan.status === "now"
        ? `Leave for ${view.airportCode} now`
        : `Leave for ${view.airportCode}`;

  return (
    <Card tone={urgent ? "warn" : "default"} as="section" aria-labelledby="leave-now-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p id="leave-now-title" className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <Icon name="clock" size={13} className={urgent ? "text-warn-ink" : soon ? "text-accent-ink" : undefined} />
            {headline}
          </p>
          <p className={cn("mt-1 text-[32px] font-semibold tracking-[-0.02em] tabular", urgent ? "text-warn-ink" : "text-ink")}>
            {view.leaveAtLabel}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            <span className={cn("font-medium", soon && "text-accent-ink", urgent && "text-warn-ink")}>
              {view.relativeLabel}
            </span>
            {" · "}
            {view.flightLabel} departs {view.departsLabel}
          </p>
        </div>

        <form
          ref={formRef}
          action={setTravelMinutesAction}
          className="flex items-center gap-2 sm:flex-col sm:items-end"
        >
          <label htmlFor="travel-minutes" className="text-[12px] text-ink-3">
            Ride to the airport
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="travel-minutes"
              name="minutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={300}
              step={5}
              defaultValue={plan.travelMinutes}
              onBlur={() => formRef.current?.requestSubmit()}
              className="h-9 w-20 rounded-lg border border-line bg-surface px-2.5 text-right text-sm text-ink tabular transition-colors duration-150 hover:border-line-2 focus:border-accent"
            />
            <span className="text-sm text-ink-2">min</span>
          </div>
        </form>
      </div>

      <p className="mt-4 text-[12px] text-ink-3 tabular">
        {plan.travelMinutes} min ride · {hours(plan.bufferMinutes)} at the airport · {plan.contingencyMinutes} min buffer
      </p>
    </Card>
  );
}
