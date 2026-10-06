"use client";

import { useEffect, useRef } from "react";

import type { AnalyticsEventName, AnalyticsProps } from "@nimbus/core";

import { trackAction } from "@/app/actions";

interface TrackProps {
  event: AnalyticsEventName;
  props?: AnalyticsProps;
}

/** Fires one analytics event when it mounts (once per key). Renders nothing. */
export function Track({ event, props }: TrackProps) {
  const key = `${event}:${JSON.stringify(props ?? {})}`;
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === key) return;
    sent.current = key;
    void trackAction(event, props);
  }, [key, event, props]);
  return null;
}
