import { useEffect, useMemo, useReducer, useState } from 'react';
import { createDefaultDesign, designReducer, type DesignAction } from '../design/reducer';
import { createLocalDesignStore, type DesignStore } from '../design/storage';
import type { DesignState } from '../design/types';

export interface DesignHandle {
  design: DesignState;
  dispatch: (action: DesignAction) => void;
  /** True when the initial design came from a previous session. */
  restored: boolean;
  store: DesignStore;
}

const SAVE_DEBOUNCE_MS = 250;

/**
 * Owns the design document: restores the latest one on mount and persists
 * every change (debounced) through the DesignStore boundary.
 */
export function useDesign(): DesignHandle {
  const store = useMemo(() => createLocalDesignStore(), []);
  const [initial] = useState(() => {
    const saved = store.load();
    return { design: saved ?? createDefaultDesign(), restored: saved !== null };
  });
  const [design, dispatch] = useReducer(designReducer, initial.design);

  useEffect(() => {
    const handle = window.setTimeout(() => store.save(design), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [design, store]);

  return { design, dispatch, restored: initial.restored, store };
}
