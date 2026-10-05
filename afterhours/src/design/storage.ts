/**
 * Persistence boundary.
 *
 * `DesignStore` is the only thing the app talks to when it wants to remember
 * or recall a design. Today it is backed by localStorage; a shared-editing
 * version would implement the same interface over a server or a CRDT.
 */

import { parseDesignJson } from './schema';
import type { DesignState } from './types';

export interface DesignStore {
  load(): DesignState | null;
  save(design: DesignState): void;
  clear(): void;
}

export const STORAGE_KEY = 'afterhours:design:v1';
export const PREFS_KEY = 'afterhours:prefs:v1';

export function createLocalDesignStore(storage: Storage | null = safeLocalStorage()): DesignStore {
  return {
    load() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const result = parseDesignJson(raw);
        return result.ok ? result.design : null;
      } catch {
        return null;
      }
    },
    save(design) {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(design));
      } catch {
        // Quota exceeded or private mode: persistence is best-effort.
      }
    },
    clear() {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  };
}

export interface UiPrefs {
  reduceMotion: boolean | null; // null = follow the OS setting
  animating: boolean;
}

export const DEFAULT_PREFS: UiPrefs = { reduceMotion: null, animating: true };

export function loadPrefs(storage: Storage | null = safeLocalStorage()): UiPrefs {
  if (!storage) return DEFAULT_PREFS;
  try {
    const raw = storage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return DEFAULT_PREFS;
    const d = data as Record<string, unknown>;
    return {
      reduceMotion: typeof d.reduceMotion === 'boolean' ? d.reduceMotion : null,
      animating: typeof d.animating === 'boolean' ? d.animating : true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: UiPrefs, storage: Storage | null = safeLocalStorage()): void {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = window.localStorage;
    const probe = '__afterhours_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
