'use client';

import { useMemo } from 'react';
import { useNimbus } from '@/lib/state/NimbusProvider';
import type { Snapshot } from '@/lib/selectors';

/** The provider value shaped for selectors. */
export function useSnapshot(): Snapshot {
  const { week, fixtures, state, now } = useNimbus();
  return useMemo(() => ({ week, fixtures, state, now }), [week, fixtures, state, now]);
}
