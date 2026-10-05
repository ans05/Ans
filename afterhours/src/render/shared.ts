/** Geometry helpers shared by the scenes. */

import { TAU } from '../lib/math';
import type { Noise3 } from '../lib/noise';

export interface Point {
  x: number;
  y: number;
}

/**
 * Trace a smooth closed "blob": a circle whose radius is modulated by noise
 * sampled around the circumference. `time` moves the noise so the outline
 * flows instead of being static.
 */
export function blobPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  noise: Noise3,
  time: number,
  wobble: number,
  frequency = 1.6,
  offset = 0,
  points = 72,
): void {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU;
    const nx = Math.cos(a) * frequency + offset;
    const ny = Math.sin(a) * frequency + offset * 0.37;
    const n = noise(nx, ny, time);
    const r = radius * (1 + wobble * n);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Catmull–Rom spline through `pts`, emitted as cubic Béziers. */
export function splinePath(ctx: CanvasRenderingContext2D, pts: Point[], closed = false, tension = 0.5): void {
  const n = pts.length;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i % n];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + ((p2.x - p0.x) * tension) / 3;
    const c1y = p1.y + ((p2.y - p0.y) * tension) / 3;
    const c2x = p2.x - ((p3.x - p1.x) * tension) / 3;
    const c2y = p2.y - ((p3.y - p1.y) * tension) / 3;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
  if (closed) ctx.closePath();
}

/**
 * Sample a cyclic palette at u in [0, 1): colours are evenly spaced and
 * linearly blended, wrapping at the end. Returns an `rgb()` string.
 */
export function cyclicPalette(colors: ReadonlyArray<readonly [number, number, number]>, u: number): string {
  const n = colors.length;
  const t = ((u % 1) + 1) % 1;
  const scaled = t * n;
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = colors[i % n];
  const b = colors[(i + 1) % n];
  const r = a[0] + (b[0] - a[0]) * f;
  const g = a[1] + (b[1] - a[1]) * f;
  const bl = a[2] + (b[2] - a[2]) * f;
  return `rgb(${r | 0}, ${g | 0}, ${bl | 0})`;
}

/** Fill a gradient with `stops` samples of a cyclic palette offset by `phase`. */
export function addCyclicStops(
  gradient: CanvasGradient,
  colors: ReadonlyArray<readonly [number, number, number]>,
  phase: number,
  stops = 24,
): void {
  for (let i = 0; i <= stops; i++) {
    const pos = i / stops;
    gradient.addColorStop(pos, cyclicPalette(colors, pos + phase));
  }
}

export function hexToTuple(hex: string): readonly [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function mixTuple(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
