import type { AnalyticsEvent, AnalyticsEventName } from './events';

const STORAGE_KEY = 'afterhours.analytics.v1';
const MAX_EVENTS = 5000;

export interface Tracker {
  track(name: AnalyticsEventName, prop?: string): void;
  events(): AnalyticsEvent[];
  clear(): void;
}

function newSessionId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readStored(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function writeStored(events: AnalyticsEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Storage may be full or blocked; analytics must never break the app.
  }
}

/**
 * Local-first tracker. If VITE_ANALYTICS_ENDPOINT is set at build time, each
 * event is also POSTed there with sendBeacon (fire and forget).
 */
export function createTracker(endpoint: string | undefined = import.meta.env.VITE_ANALYTICS_ENDPOINT): Tracker {
  const session = newSessionId();
  let cache = readStored();
  return {
    track(name, prop) {
      const event: AnalyticsEvent = { name, ts: Date.now(), session, ...(prop ? { prop } : {}) };
      cache = [...cache, event];
      writeStored(cache);
      if (endpoint && typeof navigator.sendBeacon === 'function') {
        try {
          navigator.sendBeacon(endpoint, JSON.stringify(event));
        } catch {
          /* ignore */
        }
      }
    },
    events: () => cache,
    clear() {
      cache = [];
      writeStored(cache);
    },
  };
}
