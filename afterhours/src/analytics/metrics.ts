import type { AnalyticsEvent } from './events';

export interface Metrics {
  sessions: number;
  /** Share of sessions that reached each step (0..1). */
  funnel: { edited: number; audioLoaded: number; exported: number };
  /** Median ms from session_start to first export_png, over sessions that exported. */
  medianTimeToFirstExportMs: number | null;
  /** Preset usage as counts of preset_changed events. */
  presetMix: Record<string, number>;
  /** Mean number of edit/randomize actions in sessions that exported vs those that did not. */
  editsPerSession: { exported: number; notExported: number };
}

const EDIT_EVENTS = new Set(['edit_text', 'edit_color', 'edit_motion', 'randomize', 'preset_changed']);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function computeMetrics(events: readonly AnalyticsEvent[]): Metrics {
  const bySession = new Map<string, AnalyticsEvent[]>();
  for (const e of events) {
    const list = bySession.get(e.session);
    if (list) list.push(e);
    else bySession.set(e.session, [e]);
  }

  const presetMix: Record<string, number> = {};
  const toFirstExport: number[] = [];
  const editsExported: number[] = [];
  const editsOther: number[] = [];
  let edited = 0;
  let audioLoaded = 0;
  let exported = 0;

  for (const list of bySession.values()) {
    const start = list.find((e) => e.name === 'session_start')?.ts ?? Math.min(...list.map((e) => e.ts));
    const firstExport = list.find((e) => e.name === 'export_png');
    const edits = list.filter((e) => EDIT_EVENTS.has(e.name)).length;

    if (edits > 0) edited++;
    if (list.some((e) => e.name === 'audio_loaded')) audioLoaded++;
    if (firstExport) {
      exported++;
      toFirstExport.push(Math.max(0, firstExport.ts - start));
      editsExported.push(edits);
    } else {
      editsOther.push(edits);
    }
    for (const e of list) {
      if (e.name === 'preset_changed' && e.prop) presetMix[e.prop] = (presetMix[e.prop] ?? 0) + 1;
    }
  }

  const n = bySession.size;
  const rate = (k: number) => (n ? k / n : 0);
  return {
    sessions: n,
    funnel: { edited: rate(edited), audioLoaded: rate(audioLoaded), exported: rate(exported) },
    medianTimeToFirstExportMs: median(toFirstExport),
    presetMix,
    editsPerSession: { exported: mean(editsExported), notExported: mean(editsOther) },
  };
}

/** One row per event, ready for pandas / SQL / a spreadsheet. */
export function eventsToCsv(events: readonly AnalyticsEvent[]): string {
  const rows = events.map((e) => [new Date(e.ts).toISOString(), e.session, e.name, e.prop ?? ''].join(','));
  return ['timestamp,session,event,prop', ...rows].join('\n') + '\n';
}
