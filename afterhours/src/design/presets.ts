/**
 * Preset definitions: the three visual styles, their default looks, and how
 * "Randomize" explores each one without leaving its character.
 */

import { createRng, type Rng } from '../lib/random';
import type { DesignColors, DesignMotion, PresetId, Vec2 } from './types';

export interface PresetDefinition {
  id: PresetId;
  name: string;
  tagline: string;
  description: string;
  defaults: {
    colors: DesignColors;
    motion: DesignMotion;
    titlePosition: Vec2;
  };
  /** Palettes "Randomize" draws from, so results stay on-style. */
  palette: {
    backgrounds: readonly string[];
    accents: readonly string[];
  };
  /** Ranges "Randomize" samples motion values from. */
  motionRanges: {
    speed: readonly [number, number];
    intensity: readonly [number, number];
    texture: readonly [number, number];
  };
  /** Candidate title anchors that suit the preset's typography. */
  titleAnchors: readonly Vec2[];
}

export const PRESETS: Record<PresetId, PresetDefinition> = {
  chrome: {
    id: 'chrome',
    name: 'CHROME',
    tagline: 'Metallic forms, sharp type',
    description: 'Liquid-metal ribbons and rings with a rotating reflection sweep.',
    defaults: {
      colors: { background: '#0c0c0e', accent: '#c8ff3b' },
      motion: { speed: 0.45, intensity: 0.6, texture: 0.3 },
      titlePosition: { x: 0.5, y: 0.78 },
    },
    palette: {
      backgrounds: ['#0c0c0e', '#101014', '#17171b', '#0d1117', '#14110f', '#1b1b1f'],
      accents: ['#c8ff3b', '#e9e9e9', '#8fd3ff', '#ff5ea8', '#ffd166', '#b9a5ff'],
    },
    motionRanges: { speed: [0.25, 0.7], intensity: [0.35, 0.9], texture: [0.1, 0.5] },
    titleAnchors: [
      { x: 0.5, y: 0.78 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.22 },
      { x: 0.5, y: 0.86 },
    ],
  },
  current: {
    id: 'current',
    name: 'CURRENT',
    tagline: 'Flowing shapes, watery distortion',
    description: 'Layered tidal forms refracted through a slow, moving water surface.',
    defaults: {
      colors: { background: '#04202a', accent: '#5ff2c9' },
      motion: { speed: 0.4, intensity: 0.65, texture: 0.25 },
      titlePosition: { x: 0.5, y: 0.52 },
    },
    palette: {
      backgrounds: ['#04202a', '#031418', '#061a2b', '#0b2a2f', '#001d1f', '#0a2436'],
      accents: ['#5ff2c9', '#3ad7ff', '#a0ffe6', '#7af0a6', '#00c2b2', '#c3fff2'],
    },
    motionRanges: { speed: [0.2, 0.65], intensity: [0.4, 0.95], texture: [0.05, 0.45] },
    titleAnchors: [
      { x: 0.5, y: 0.52 },
      { x: 0.5, y: 0.3 },
      { x: 0.5, y: 0.72 },
      { x: 0.5, y: 0.5 },
    ],
  },
  signal: {
    id: 'signal',
    name: 'SIGNAL',
    tagline: 'Waveforms, grain, poster type',
    description: 'Stacked oscilloscope traces and a spectrum strip under bold poster typography.',
    defaults: {
      colors: { background: '#0b0b0a', accent: '#c8ff3b' },
      motion: { speed: 0.5, intensity: 0.6, texture: 0.55 },
      titlePosition: { x: 0.08, y: 0.14 },
    },
    palette: {
      backgrounds: ['#0b0b0a', '#121212', '#1c1a17', '#f1ecdf', '#e8e2d2', '#0e1a12'],
      accents: ['#c8ff3b', '#ff4d2e', '#ffd23f', '#3b6cff', '#f1ecdf', '#ff7ab6'],
    },
    motionRanges: { speed: [0.3, 0.8], intensity: [0.35, 0.9], texture: [0.3, 0.8] },
    titleAnchors: [
      { x: 0.08, y: 0.14 },
      { x: 0.08, y: 0.62 },
      { x: 0.08, y: 0.08 },
      { x: 0.08, y: 0.5 },
    ],
  },
  tesseract: {
    id: 'tesseract',
    name: 'TESSERACT',
    tagline: 'Hypercube, depth, time',
    description: 'A four-dimensional cube rotating through the W axis, projected down to the sleeve.',
    defaults: {
      colors: { background: '#07070b', accent: '#c8ff3b' },
      motion: { speed: 0.4, intensity: 0.55, texture: 0.25 },
      titlePosition: { x: 0.5, y: 0.86 },
    },
    palette: {
      backgrounds: ['#07070b', '#0a0812', '#060a0e', '#0d0b0a', '#0b0f14', '#100a14'],
      accents: ['#c8ff3b', '#7af0ff', '#ff5ea8', '#ffd166', '#b9a5ff', '#f1ecdf'],
    },
    motionRanges: { speed: [0.2, 0.7], intensity: [0.3, 0.95], texture: [0.1, 0.5] },
    titleAnchors: [
      { x: 0.5, y: 0.86 },
      { x: 0.5, y: 0.12 },
      { x: 0.5, y: 0.9 },
      { x: 0.5, y: 0.5 },
    ],
  },
};

export const PRESET_LIST: readonly PresetDefinition[] = [
  PRESETS.chrome,
  PRESETS.current,
  PRESETS.signal,
  PRESETS.tesseract,
];

export interface RandomizedLook {
  colors: DesignColors;
  motion: DesignMotion;
  titlePosition: Vec2;
}

/**
 * Sample a new look inside the preset's style envelope. Deterministic for a
 * given seed so a design's `seed` fully explains its appearance.
 */
export function randomizeLook(preset: PresetId, seed: number, rng: Rng = createRng(seed ^ 0x5bd1e995)): RandomizedLook {
  const def = PRESETS[preset];
  const { backgrounds, accents } = def.palette;
  let background = rng.pick(backgrounds);
  let accent = rng.pick(accents);
  // Guard against an invisible accent (same colour as the background).
  if (accent === background) accent = accents[(accents.indexOf(accent) + 1) % accents.length];
  if (preset === 'signal' && (background === '#f1ecdf' || background === '#e8e2d2') && accent === '#f1ecdf') {
    accent = '#ff4d2e';
  }
  background = background.toLowerCase();
  const r = def.motionRanges;
  return {
    colors: { background, accent },
    motion: {
      speed: round2(rng.range(r.speed[0], r.speed[1])),
      intensity: round2(rng.range(r.intensity[0], r.intensity[1])),
      texture: round2(rng.range(r.texture[0], r.texture[1])),
    },
    titlePosition: rng.pick(def.titleAnchors),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
