import type { AudioStatus } from './AudioEngine';

export type AudioMode = 'ambient' | 'reactive' | 'paused';

/** Which label the stage shows for the current audio status. */
export function audioMode(status: AudioStatus): AudioMode {
  if (status === 'playing') return 'reactive';
  if (status === 'ready' || status === 'paused') return 'paused';
  return 'ambient';
}
