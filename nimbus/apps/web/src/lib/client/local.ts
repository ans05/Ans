import { DEFAULT_DEMO_MOMENT_ID, PHASE1_FIXTURES, SAMPLE_WEEK } from '@nimbus/core';
import type { NimbusClient, UserState, WeekPayload } from './types';

const STORAGE_KEY = 'nimbus:state:v1';

export function emptyUserState(): UserState {
  return {
    version: 1,
    taskAssignments: {},
    checklistDone: {},
    travelMinutes: {},
    rescheduleDrafts: {},
    dismissedAttention: [],
    analytics: [],
    demoMomentId: DEFAULT_DEMO_MOMENT_ID,
  };
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** In-browser client: seed JSON plus a localStorage overlay. No network. */
export class LocalClient implements NimbusClient {
  readonly mode = 'local' as const;

  async loadWeek(): Promise<WeekPayload> {
    return { week: SAMPLE_WEEK, fixtures: PHASE1_FIXTURES };
  }

  async loadUserState(): Promise<UserState | null> {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<UserState>;
      if (parsed.version !== 1) return null;
      return { ...emptyUserState(), ...parsed };
    } catch {
      return null;
    }
  }

  async saveUserState(state: UserState): Promise<void> {
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or full storage: the session still works, it just won't persist.
    }
  }
}
