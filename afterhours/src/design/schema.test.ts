import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from './reducer';
import { parseDesign, parseDesignJson } from './schema';

describe('parseDesign', () => {
  it('accepts a freshly created design unchanged', () => {
    const design = createDefaultDesign('signal');
    const result = parseDesign(JSON.parse(JSON.stringify(design)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.design).toEqual(design);
      expect(result.warnings).toEqual([]);
    }
  });

  it('rejects non-objects and foreign schemas with readable errors', () => {
    expect(parseDesign(null)).toMatchObject({ ok: false, error: expect.stringContaining('not a JSON object') });
    expect(parseDesign({ schema: 'other' })).toMatchObject({ ok: false, error: expect.stringContaining('not an AFTERHOURS design') });
    expect(parseDesign({ schema: 'afterhours.design', version: 99 })).toMatchObject({
      ok: false,
      error: expect.stringContaining('Unsupported design version'),
    });
  });

  it('rejects unknown presets and bad colours', () => {
    const base = JSON.parse(JSON.stringify(createDefaultDesign()));
    expect(parseDesign({ ...base, preset: 'neon' })).toMatchObject({ ok: false, error: expect.stringContaining('Unknown preset') });
    expect(parseDesign({ ...base, colors: { background: 'red', accent: '#c8ff3b' } })).toMatchObject({
      ok: false,
      error: expect.stringContaining('colors.background'),
    });
  });

  it('clamps out-of-range values and reports warnings', () => {
    const base = JSON.parse(JSON.stringify(createDefaultDesign()));
    const result = parseDesign({
      ...base,
      motion: { speed: 7, intensity: -2, texture: 0.5 },
      layout: { titlePosition: { x: 5, y: -1 } },
      text: { artist: 'x'.repeat(200), title: 'ok' },
      colors: { background: '#ABC', accent: '#C8FF3B' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.motion).toEqual({ speed: 1, intensity: 0, texture: 0.5 });
    expect(result.design.layout.titlePosition.x).toBeLessThanOrEqual(0.96);
    expect(result.design.layout.titlePosition.y).toBeGreaterThanOrEqual(0.04);
    expect(result.design.text.artist.length).toBe(80);
    expect(result.design.colors).toEqual({ background: '#aabbcc', accent: '#c8ff3b' });
    expect(result.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('parses JSON text and rejects garbage or oversized input', () => {
    expect(parseDesignJson('{not json')).toMatchObject({ ok: false, error: expect.stringContaining('not valid JSON') });
    expect(parseDesignJson('x'.repeat(2_000_000))).toMatchObject({ ok: false, error: expect.stringContaining('too large') });
    const ok = parseDesignJson(JSON.stringify(createDefaultDesign('current')));
    expect(ok.ok).toBe(true);
  });
});
