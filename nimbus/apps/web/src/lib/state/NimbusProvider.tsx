'use client';

import {
  PHASE1_FIXTURES,
  SAMPLE_WEEK,
  toIso,
  type AnalyticsEvent,
  type AnalyticsEventName,
  type Phase1Fixtures,
  type WeekData,
} from '@nimbus/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createClient, emptyUserState, type UserState } from '@/lib/client';
import { LIVE_CLOCK_ID, resolveNow } from '@/lib/clock';

const MAX_STORED_EVENTS = 2000;
const LIVE_TICK_MS = 30_000;

function subscribeToClock(onTick: () => void) {
  const timer = window.setInterval(onTick, LIVE_TICK_MS);
  return () => window.clearInterval(timer);
}

/** Wall-clock time in 30-second buckets, 0 on the server so markup matches. */
function useLiveTick(): number {
  return useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / LIVE_TICK_MS),
    () => 0,
  );
}

type Action =
  | { type: 'hydrate'; state: UserState }
  | { type: 'assignTask'; taskId: string; windowId: string | null }
  | { type: 'toggleChecklistItem'; itemId: string }
  | { type: 'setTravelMinutes'; flightId: string; minutes: number }
  | { type: 'saveRescheduleDraft'; meetingId: string; text: string }
  | { type: 'dismissAttention'; id: string }
  | { type: 'setDemoMoment'; id: string }
  | { type: 'track'; event: AnalyticsEvent }
  | { type: 'reset' };

function reducer(state: UserState, action: Action): UserState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'assignTask':
      return { ...state, taskAssignments: { ...state.taskAssignments, [action.taskId]: action.windowId } };
    case 'toggleChecklistItem':
      return { ...state, checklistDone: { ...state.checklistDone, [action.itemId]: !state.checklistDone[action.itemId] } };
    case 'setTravelMinutes':
      return { ...state, travelMinutes: { ...state.travelMinutes, [action.flightId]: action.minutes } };
    case 'saveRescheduleDraft':
      return { ...state, rescheduleDrafts: { ...state.rescheduleDrafts, [action.meetingId]: action.text } };
    case 'dismissAttention':
      return state.dismissedAttention.includes(action.id)
        ? state
        : { ...state, dismissedAttention: [...state.dismissedAttention, action.id] };
    case 'setDemoMoment':
      // Moving the clock is a new scene: bring dismissed nudges back.
      return { ...state, demoMomentId: action.id, dismissedAttention: [] };
    case 'track':
      return { ...state, analytics: [...state.analytics, action.event].slice(-MAX_STORED_EVENTS) };
    case 'reset':
      return emptyUserState();
  }
}

export interface NimbusActions {
  assignTask(taskId: string, windowId: string | null): void;
  toggleChecklistItem(itemId: string): void;
  setTravelMinutes(flightId: string, minutes: number): void;
  saveRescheduleDraft(meetingId: string, text: string): void;
  dismissAttention(id: string): void;
  setDemoMoment(id: string): void;
  track(name: AnalyticsEventName, props?: AnalyticsEvent['props']): void;
  reset(): void;
}

export interface NimbusContextValue {
  week: WeekData;
  fixtures: Phase1Fixtures;
  state: UserState;
  /** False until the saved state has been read from storage. */
  hydrated: boolean;
  /** The instant the app treats as the current time. */
  now: Date;
  actions: NimbusActions;
}

const NimbusContext = createContext<NimbusContextValue | null>(null);

function newEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function NimbusProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createClient(), []);
  const [week, setWeek] = useState<WeekData>(SAMPLE_WEEK);
  const [fixtures, setFixtures] = useState<Phase1Fixtures>(PHASE1_FIXTURES);
  const [state, dispatch] = useReducer(reducer, undefined, emptyUserState);
  const [hydrated, setHydrated] = useState(false);
  const liveTick = useLiveTick();

  useEffect(() => {
    let cancelled = false;
    Promise.all([client.loadWeek(), client.loadUserState()]).then(([payload, saved]) => {
      if (cancelled) return;
      setWeek(payload.week);
      setFixtures(payload.fixtures);
      if (saved) dispatch({ type: 'hydrate', state: saved });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (hydrated) void client.saveUserState(state);
  }, [client, state, hydrated]);

  const now = useMemo(() => {
    const live = state.demoMomentId === LIVE_CLOCK_ID;
    // Before mount the tick is 0; a pinned demo moment never needs it.
    const liveNow = live && liveTick > 0 ? new Date(liveTick * LIVE_TICK_MS) : new Date(0);
    return resolveNow(state.demoMomentId, liveNow);
  }, [state.demoMomentId, liveTick]);

  const track = useCallback(
    (name: AnalyticsEventName, props?: AnalyticsEvent['props']) => {
      const event: AnalyticsEvent = {
        id: newEventId(),
        name,
        at: toIso(new Date()),
        userId: week.user.id,
        tripId: week.trip.id,
        ...(props ? { props } : {}),
      };
      dispatch({ type: 'track', event });
    },
    [week.user.id, week.trip.id],
  );

  const actions = useMemo<NimbusActions>(
    () => ({
      assignTask: (taskId, windowId) => dispatch({ type: 'assignTask', taskId, windowId }),
      toggleChecklistItem: (itemId) => dispatch({ type: 'toggleChecklistItem', itemId }),
      setTravelMinutes: (flightId, minutes) => dispatch({ type: 'setTravelMinutes', flightId, minutes }),
      saveRescheduleDraft: (meetingId, text) => dispatch({ type: 'saveRescheduleDraft', meetingId, text }),
      dismissAttention: (id) => dispatch({ type: 'dismissAttention', id }),
      setDemoMoment: (id) => dispatch({ type: 'setDemoMoment', id }),
      track,
      reset: () => dispatch({ type: 'reset' }),
    }),
    [track],
  );

  const value = useMemo<NimbusContextValue>(
    () => ({ week, fixtures, state, hydrated, now, actions }),
    [week, fixtures, state, hydrated, now, actions],
  );

  return <NimbusContext.Provider value={value}>{children}</NimbusContext.Provider>;
}

export function useNimbus(): NimbusContextValue {
  const value = useContext(NimbusContext);
  if (!value) throw new Error('useNimbus must be used inside <NimbusProvider>');
  return value;
}
