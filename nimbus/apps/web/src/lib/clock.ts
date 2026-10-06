import { DEMO_MOMENTS } from '@nimbus/core';

export const LIVE_CLOCK_ID = 'live';

export function isDemoMoment(id: string): boolean {
  return DEMO_MOMENTS.some((moment) => moment.id === id);
}

/** The instant the app treats as "now": a pinned demo moment or the real clock. */
export function resolveNow(demoMomentId: string, liveNow: Date): Date {
  const moment = DEMO_MOMENTS.find((m) => m.id === demoMomentId);
  return moment ? new Date(moment.at) : liveNow;
}
