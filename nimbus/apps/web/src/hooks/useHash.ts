'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current URL fragment without the leading "#". Empty on the server. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => '',
  );
}
