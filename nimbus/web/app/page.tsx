import type { Metadata } from "next";

import { formatDayLong, formatDayParts } from "@nimbus/core";

import { LeaveNowCard } from "@/components/cards/LeaveNowCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { DayPicker } from "@/components/timeline/DayPicker";
import { DayTimeline } from "@/components/timeline/DayTimeline";
import { Track } from "@/components/Track";
import { getApi } from "@/lib/server/api";

export const metadata: Metadata = { title: "Timeline" };

interface PageProps {
  searchParams: Promise<{ day?: string }>;
}

export default async function TimelinePage({ searchParams }: PageProps) {
  const api = getApi();
  const { day: requested } = await searchParams;
  const week = await api.getWeek();
  const selected = week.days.find((d) => d.date === requested)?.date ?? week.today;
  const view = await api.getDay(selected);

  const { weekday } = formatDayParts(view.day.date);
  const dateLabel = formatDayLong(view.day.date).split(", ")[1];
  const meta = [dateLabel, view.day.city, view.zoneAbbreviation, view.day.label]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Track event="timeline_viewed" props={{ day: selected }} />
      <PageHeader
        eyebrow={view.day.isToday ? "Today" : week.trip.title}
        title={weekday}
        meta={meta}
      />
      <DayPicker days={week.days} selected={selected} />
      <div className="mt-6 space-y-6 sm:mt-8">
        {view.leavePlan ? <LeaveNowCard view={view.leavePlan} /> : null}
        <DayTimeline view={view} />
      </div>
    </>
  );
}
