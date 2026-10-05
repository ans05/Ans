/** Small numeric helpers shared by the renderer, audio analysis and editor. */

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Linear interpolation between a and b by t in [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map `value` from [inMin, inMax] onto [outMin, outMax] (no clamping). */
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin || 1);
  return outMin + (outMax - outMin) * t;
}

/** Hermite smoothstep: 0 below edge0, 1 above edge1, smooth S-curve between. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}

/** Exponential approach: moves `current` toward `target` by a frame-rate independent factor. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

/** Gaussian bell, centred at `mu` with standard deviation `sigma`. */
export function gaussian(x: number, mu: number, sigma: number): number {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
