/**
 * Pure state transitions for the design document.
 *
 * Every edit in the editor becomes a `DesignAction`. Keeping edits as plain
 * data (rather than ad-hoc setState calls) means they can be logged, undone,
 * replayed, or sent over the wire for collaborative editing later.
 */

import { clamp01 } from '../lib/math';
import { normalizeHex } from '../lib/color';
import { randomSeed } from '../lib/random';
import { PRESETS, randomizeLook } from './presets';
import {
  DESIGN_SCHEMA,
  DESIGN_VERSION,
  TEXT_MAX_LENGTH,
  type DesignMotion,
  type DesignState,
  type PresetId,
  type Vec2,
} from './types';

export type DesignAction =
  | { type: 'set-text'; field: 'artist' | 'title'; value: string }
  | { type: 'set-preset'; preset: PresetId }
  | { type: 'set-color'; field: 'background' | 'accent'; value: string }
  | { type: 'set-motion'; field: keyof DesignMotion; value: number }
  | { type: 'set-title-position'; position: Vec2 }
  | { type: 'nudge-title'; dx: number; dy: number }
  | { type: 'randomize'; seed?: number }
  | { type: 'replace'; design: DesignState }
  | { type: 'reset' };

export const TITLE_POSITION_MIN = 0.04;
export const TITLE_POSITION_MAX = 0.96;

export function clampTitlePosition(p: Vec2): Vec2 {
  const c = (v: number) => Math.min(TITLE_POSITION_MAX, Math.max(TITLE_POSITION_MIN, v));
  return { x: c(p.x), y: c(p.y) };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultDesign(preset: PresetId = 'chrome', now: () => string = isoNow): DesignState {
  const def = PRESETS[preset];
  return {
    schema: DESIGN_SCHEMA,
    version: DESIGN_VERSION,
    id: createId(),
    revision: 0,
    updatedAt: now(),
    preset,
    text: { artist: 'LATE NIGHT RADIO', title: 'AFTERHOURS' },
    colors: { ...def.defaults.colors },
    motion: { ...def.defaults.motion },
    layout: { titlePosition: { ...def.defaults.titlePosition } },
    seed: 20240607,
  };
}

function isoNow(): string {
  return new Date().toISOString();
}

function touch(state: DesignState, patch: Partial<DesignState>): DesignState {
  return { ...state, ...patch, revision: state.revision + 1, updatedAt: isoNow() };
}

export function designReducer(state: DesignState, action: DesignAction): DesignState {
  switch (action.type) {
    case 'set-text': {
      const value = action.value.slice(0, TEXT_MAX_LENGTH);
      if (state.text[action.field] === value) return state;
      return touch(state, { text: { ...state.text, [action.field]: value } });
    }
    case 'set-preset': {
      if (state.preset === action.preset) return state;
      const def = PRESETS[action.preset];
      // Switching presets keeps the user's words; the look follows the preset.
      return touch(state, {
        preset: action.preset,
        colors: { ...def.defaults.colors },
        motion: { ...def.defaults.motion },
        layout: { titlePosition: { ...def.defaults.titlePosition } },
      });
    }
    case 'set-color': {
      const hex = normalizeHex(action.value);
      if (!hex || state.colors[action.field] === hex) return state;
      return touch(state, { colors: { ...state.colors, [action.field]: hex } });
    }
    case 'set-motion': {
      const value = clamp01(Number.isFinite(action.value) ? action.value : 0);
      if (state.motion[action.field] === value) return state;
      return touch(state, { motion: { ...state.motion, [action.field]: value } });
    }
    case 'set-title-position': {
      const position = clampTitlePosition(action.position);
      const cur = state.layout.titlePosition;
      if (cur.x === position.x && cur.y === position.y) return state;
      return touch(state, { layout: { ...state.layout, titlePosition: position } });
    }
    case 'nudge-title': {
      const cur = state.layout.titlePosition;
      return designReducer(state, {
        type: 'set-title-position',
        position: { x: cur.x + action.dx, y: cur.y + action.dy },
      });
    }
    case 'randomize': {
      const seed = (action.seed ?? randomSeed()) >>> 0;
      const look = randomizeLook(state.preset, seed);
      return touch(state, {
        seed,
        colors: look.colors,
        motion: look.motion,
        layout: { ...state.layout, titlePosition: look.titlePosition },
      });
    }
    case 'replace': {
      // A loaded document replaces everything, including id/revision.
      return { ...action.design };
    }
    case 'reset': {
      // Back to the preset's default look; the user's words stay.
      const fresh = createDefaultDesign(state.preset);
      return { ...fresh, text: { ...state.text }, id: state.id, revision: state.revision + 1 };
    }
    default:
      return state;
  }
}
