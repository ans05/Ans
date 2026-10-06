import { LocalClient } from './local';
import type { NimbusClient } from './types';

export type { NimbusClient, UserState, WeekPayload } from './types';
export { emptyUserState } from './local';

const mode = process.env.NEXT_PUBLIC_NIMBUS_MODE === 'aws' ? 'aws' : 'local';

/** Phase 3 adds the HttpClient for aws mode; until then both modes run locally. */
export function createClient(): NimbusClient {
  if (mode === 'aws') {
    console.warn('[nimbus] aws mode is not wired yet; falling back to local data.');
  }
  return new LocalClient();
}
