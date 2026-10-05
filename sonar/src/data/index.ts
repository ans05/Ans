import type { MusicDataProvider } from "./provider";
import { MockProvider } from "./mockProvider";

let instance: MusicDataProvider | null = null;

/**
 * Returns the active data provider. Only the mock provider exists today; to
 * add a real one, implement MusicDataProvider (see ./adapters for notes) and
 * select it here, e.g. via NEXT_PUBLIC_SONAR_PROVIDER. No API keys are needed
 * for the prototype.
 */
export function getProvider(): MusicDataProvider {
  if (!instance) instance = new MockProvider();
  return instance;
}

export type { MusicDataProvider } from "./provider";
