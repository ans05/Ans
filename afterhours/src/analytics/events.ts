/**
 * Product analytics events.
 *
 * Privacy: events never contain artist/title text, colours or file names, only
 * which feature was used. Everything stays in this browser unless a deployer
 * opts in to a remote endpoint (see tracker.ts).
 */
export type AnalyticsEventName =
  | 'session_start'
  | 'preset_changed'
  | 'randomize'
  | 'edit_text'
  | 'edit_color'
  | 'edit_motion'
  | 'audio_loaded'
  | 'audio_play'
  | 'export_png'
  | 'save_design'
  | 'load_design';

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  /** Milliseconds since the Unix epoch. */
  ts: number;
  /** Random per-page-load id; not linked to a person. */
  session: string;
  /** Small, non-identifying detail such as the preset id. */
  prop?: string;
}
