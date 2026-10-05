import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { createDefaultDesign, designReducer } from './reducer';

describe('designReducer', () => {
  it('keeps the user\'s words when switching presets', () => {
    let d = createDefaultDesign('chrome');
    d = designReducer(d, { type: 'set-text', field: 'artist', value: 'Moss Collective' });
    d = designReducer(d, { type: 'set-text', field: 'title', value: 'Low Tide' });
    const next = designReducer(d, { type: 'set-preset', preset: 'current' });
    expect(next.preset).toBe('current');
    expect(next.text).toEqual({ artist: 'Moss Collective', title: 'Low Tide' });
    expect(next.colors).toEqual(PRESETS.current.defaults.colors);
    expect(next.revision).toBe(d.revision + 1);
  });

  it('randomizes within the preset palette and keeps text', () => {
    const d = designReducer(createDefaultDesign('signal'), { type: 'set-text', field: 'title', value: 'Static' });
    const r1 = designReducer(d, { type: 'randomize', seed: 42 });
    const r2 = designReducer(d, { type: 'randomize', seed: 42 });
    expect(r1.seed).toBe(42);
    expect(r1.text.title).toBe('Static');
    expect(PRESETS.signal.palette.backgrounds).toContain(r1.colors.background);
    expect(PRESETS.signal.palette.accents).toContain(r1.colors.accent);
    expect(r1.colors).toEqual(r2.colors); // deterministic per seed
    expect(r1.motion.speed).toBeGreaterThanOrEqual(PRESETS.signal.motionRanges.speed[0]);
    expect(r1.motion.speed).toBeLessThanOrEqual(PRESETS.signal.motionRanges.speed[1]);
  });

  it('normalises colours and ignores invalid ones', () => {
    const d = createDefaultDesign();
    const ok = designReducer(d, { type: 'set-color', field: 'accent', value: '#ABC' });
    expect(ok.colors.accent).toBe('#aabbcc');
    const bad = designReducer(d, { type: 'set-color', field: 'accent', value: 'lime' });
    expect(bad).toBe(d);
  });

  it('clamps motion values and title position', () => {
    const d = createDefaultDesign();
    expect(designReducer(d, { type: 'set-motion', field: 'speed', value: 4 }).motion.speed).toBe(1);
    const moved = designReducer(d, { type: 'set-title-position', position: { x: 2, y: -3 } });
    expect(moved.layout.titlePosition).toEqual({ x: 0.96, y: 0.04 });
    const nudged = designReducer(moved, { type: 'nudge-title', dx: -0.5, dy: 0.5 });
    expect(nudged.layout.titlePosition.x).toBeCloseTo(0.46, 10);
    expect(nudged.layout.titlePosition.y).toBeCloseTo(0.54, 10);
  });

  it('returns the same object for no-op edits', () => {
    const d = createDefaultDesign();
    expect(designReducer(d, { type: 'set-text', field: 'title', value: d.text.title })).toBe(d);
    expect(designReducer(d, { type: 'set-preset', preset: d.preset })).toBe(d);
  });
});
