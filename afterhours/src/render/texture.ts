/**
 * Grain and vignette. Grain is a handful of pre-rendered noise tiles drawn
 * as a repeating pattern with soft-light blending, so it costs one fill per
 * frame instead of per-pixel work. Tiles are swapped slowly (never per frame)
 * and offset by a small drift so the grain feels alive but never flashes.
 */

import { createRng } from '../lib/random';

const TILE = 256;
const TILE_COUNT = 4;
let tiles: HTMLCanvasElement[] | null = null;

function buildTiles(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let n = 0; n < TILE_COUNT; n++) {
    const rng = createRng(0xa11ce + n * 7919);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE;
    const c = canvas.getContext('2d');
    if (!c) continue;
    const img = c.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // Mid-grey centred noise: soft-light leaves a 50% grey untouched, so only
      // the deviation from 128 shows up as texture.
      const v = 128 + (rng.next() - 0.5) * 220;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    out.push(canvas);
  }
  return out;
}

export function drawGrain(
  ctx: CanvasRenderingContext2D,
  size: number,
  strength: number,
  time: number,
  reducedMotion: boolean,
): void {
  if (strength <= 0.001) return;
  if (!tiles) tiles = buildTiles();
  if (tiles.length === 0) return;
  // Change tile every ~0.4 s; freeze entirely under reduced motion.
  const tileIndex = reducedMotion ? 0 : Math.floor(time * 2.5) % tiles.length;
  const tile = tiles[tileIndex];
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  const scale = Math.max(1, size / 1024);
  const drift = reducedMotion ? 0 : (time * 13) % TILE;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = Math.min(1, strength * 0.9);
  ctx.setTransform(scale, 0, 0, scale, -drift, drift * 0.5);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, -TILE, size / scale + TILE, size / scale + TILE * 2);
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, size: number, strength: number): void {
  if (strength <= 0.001) return;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${Math.min(0.6, strength)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}
