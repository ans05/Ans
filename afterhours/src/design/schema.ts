/**
 * Validation for design documents coming from untrusted places (a JSON file,
 * localStorage). Produces either a clean `DesignState` plus any warnings about
 * values that were clamped, or a human-readable error.
 */

import { isHexColor, normalizeHex } from '../lib/color';
import { clamp01, isFiniteNumber } from '../lib/math';
import { clampTitlePosition, createId } from './reducer';
import {
  DESIGN_SCHEMA,
  DESIGN_VERSION,
  PRESET_IDS,
  TEXT_MAX_LENGTH,
  type DesignState,
  type PresetId,
} from './types';

export type ParseResult =
  | { ok: true; design: DesignState; warnings: string[] }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDesign(input: unknown): ParseResult {
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, error: 'The file is not a JSON object.' };
  }
  if (input.schema !== DESIGN_SCHEMA) {
    return {
      ok: false,
      error: `This is not an AFTERHOURS design (expected "schema": "${DESIGN_SCHEMA}").`,
    };
  }
  if (input.version !== DESIGN_VERSION) {
    return {
      ok: false,
      error: `Unsupported design version ${String(input.version)}. This app reads version ${DESIGN_VERSION}.`,
    };
  }

  const preset = input.preset;
  if (typeof preset !== 'string' || !PRESET_IDS.includes(preset as PresetId)) {
    return { ok: false, error: `Unknown preset "${String(preset)}". Expected one of: ${PRESET_IDS.join(', ')}.` };
  }

  if (!isRecord(input.text)) return { ok: false, error: 'Missing "text" section.' };
  const artist = readText(input.text.artist, 'text.artist', warnings);
  const title = readText(input.text.title, 'text.title', warnings);
  if (artist === null || title === null) {
    return { ok: false, error: '"text.artist" and "text.title" must be strings.' };
  }

  if (!isRecord(input.colors)) return { ok: false, error: 'Missing "colors" section.' };
  const background = readColor(input.colors.background, 'colors.background');
  const accent = readColor(input.colors.accent, 'colors.accent');
  if (typeof background !== 'string') return { ok: false, error: background.error };
  if (typeof accent !== 'string') return { ok: false, error: accent.error };

  if (!isRecord(input.motion)) return { ok: false, error: 'Missing "motion" section.' };
  const speed = readUnit(input.motion.speed, 'motion.speed', warnings);
  const intensity = readUnit(input.motion.intensity, 'motion.intensity', warnings);
  const texture = readUnit(input.motion.texture, 'motion.texture', warnings);
  if (speed === null || intensity === null || texture === null) {
    return { ok: false, error: '"motion.speed", "motion.intensity" and "motion.texture" must be numbers.' };
  }

  if (!isRecord(input.layout) || !isRecord(input.layout.titlePosition)) {
    return { ok: false, error: 'Missing "layout.titlePosition".' };
  }
  const tp = input.layout.titlePosition;
  if (!isFiniteNumber(tp.x) || !isFiniteNumber(tp.y)) {
    return { ok: false, error: '"layout.titlePosition" must have numeric x and y.' };
  }
  const titlePosition = clampTitlePosition({ x: tp.x, y: tp.y });
  if (titlePosition.x !== tp.x || titlePosition.y !== tp.y) {
    warnings.push('Title position was moved back inside the artwork.');
  }

  let seed: number;
  if (isFiniteNumber(input.seed)) {
    seed = Math.floor(Math.abs(input.seed)) >>> 0;
  } else {
    seed = 1;
    warnings.push('Missing or invalid seed; using 1.');
  }

  const id = typeof input.id === 'string' && input.id.length > 0 && input.id.length <= 128 ? input.id : createId();
  const revision = isFiniteNumber(input.revision) && input.revision >= 0 ? Math.floor(input.revision) : 0;
  const updatedAt =
    typeof input.updatedAt === 'string' && !Number.isNaN(Date.parse(input.updatedAt))
      ? input.updatedAt
      : new Date().toISOString();

  return {
    ok: true,
    warnings,
    design: {
      schema: DESIGN_SCHEMA,
      version: DESIGN_VERSION,
      id,
      revision,
      updatedAt,
      preset: preset as PresetId,
      text: { artist, title },
      colors: { background, accent },
      motion: { speed, intensity, texture },
      layout: { titlePosition },
      seed,
    },
  };
}

function readText(value: unknown, path: string, warnings: string[]): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > TEXT_MAX_LENGTH) {
    warnings.push(`${path} was trimmed to ${TEXT_MAX_LENGTH} characters.`);
    return value.slice(0, TEXT_MAX_LENGTH);
  }
  return value;
}

function readColor(value: unknown, path: string): string | { error: string } {
  if (typeof value !== 'string') return { error: `"${path}" must be a hex colour string like #c8ff3b.` };
  const hex = normalizeHex(value);
  if (!hex || !isHexColor(hex)) return { error: `"${path}" is not a valid hex colour: ${JSON.stringify(value)}.` };
  return hex;
}

function readUnit(value: unknown, path: string, warnings: string[]): number | null {
  if (!isFiniteNumber(value)) return null;
  const clamped = clamp01(value);
  if (clamped !== value) warnings.push(`${path} was clamped to the 0–1 range.`);
  return clamped;
}

/** Parse raw JSON text with a size guard and friendly messages. */
export function parseDesignJson(text: string, maxBytes = 1_000_000): ParseResult {
  if (text.length > maxBytes) {
    return { ok: false, error: 'That file is too large to be a design (over 1 MB).' };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  return parseDesign(data);
}
