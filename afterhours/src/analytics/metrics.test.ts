import { describe, expect, it } from 'vitest';
import type { AnalyticsEvent } from './events';
import { computeMetrics, eventsToCsv } from './metrics';

const ev = (session: string, name: AnalyticsEvent['name'], ts: number, prop?: string): AnalyticsEvent => ({
  session,
  name,
  ts,
  ...(prop ? { prop } : {}),
});

describe('computeMetrics', () => {
  it('returns zeros for no events', () => {
    const m = computeMetrics([]);
    expect(m.sessions).toBe(0);
    expect(m.funnel.exported).toBe(0);
    expect(m.medianTimeToFirstExportMs).toBeNull();
  });

  it('computes the funnel, time to first export and preset mix', () => {
    const m = computeMetrics([
      ev('a', 'session_start', 0),
      ev('a', 'preset_changed', 1000, 'signal'),
      ev('a', 'randomize', 2000),
      ev('a', 'export_png', 10000),
      ev('b', 'session_start', 0),
      ev('b', 'audio_loaded', 500),
      ev('b', 'preset_changed', 800, 'signal'),
      ev('c', 'session_start', 0),
      ev('c', 'edit_color', 100),
      ev('c', 'export_png', 30000),
      ev('d', 'session_start', 0),
    ]);
    expect(m.sessions).toBe(4);
    expect(m.funnel).toEqual({ edited: 0.75, audioLoaded: 0.25, exported: 0.5 });
    expect(m.medianTimeToFirstExportMs).toBe(20000);
    expect(m.presetMix).toEqual({ signal: 2 });
    expect(m.editsPerSession.exported).toBe(1.5);
    expect(m.editsPerSession.notExported).toBe(0.5);
  });
});

describe('eventsToCsv', () => {
  it('writes a header and one row per event', () => {
    const csv = eventsToCsv([ev('a', 'export_png', 0)]);
    expect(csv.split('\n')[0]).toBe('timestamp,session,event,prop');
    expect(csv).toContain('1970-01-01T00:00:00.000Z,a,export_png,');
  });
});
