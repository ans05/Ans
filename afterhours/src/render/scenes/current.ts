/**
 * CURRENT — tidal forms seen through moving water.
 *
 * Shapes are drawn to an offscreen layer with screen blending so overlaps
 * glow rather than muddy. The layer is then copied to the canvas one thin row
 * at a time, each row shifted sideways by a sine + noise term: a cheap but
 * convincing refraction. Audio mids drive the displacement amplitude, bass
 * swells the forms, treble brightens the caustic threads.
 */

import { darken, lighten, mix, rgba, shiftHue } from '../../lib/color';
import { TAU, lerp } from '../../lib/math';
import { fbm3 } from '../../lib/noise';
import { blobPath, splinePath, type Point } from '../shared';
import { drawMetaMarks } from '../typography';
import type { SceneContext, SceneRenderer } from '../types';

interface Blob {
  cx: number;
  cy: number;
  r: number;
  tint: number;
  phase: number;
}

interface CurrentScene {
  blobs: Blob[];
  flowStarts: Point[];
  caustics: Point[][];
}

const sceneCache = new Map<number, CurrentScene>();
const layerCache = new Map<number, HTMLCanvasElement>();

function getLayer(size: number): HTMLCanvasElement {
  let layer = layerCache.get(size);
  if (!layer) {
    if (layerCache.size >= 3) layerCache.clear();
    layer = document.createElement('canvas');
    layer.width = layer.height = size;
    layerCache.set(size, layer);
  }
  return layer;
}

function buildScene(sc: SceneContext): CurrentScene {
  const cached = sceneCache.get(sc.design.seed);
  if (cached) return cached;
  const { rng } = sc;
  const blobs: Blob[] = [];
  for (let i = 0; i < 8; i++) {
    blobs.push({
      cx: rng.range(0.1, 0.9),
      cy: rng.range(0.1, 0.9),
      r: rng.range(0.16, 0.42),
      tint: rng.next(),
      phase: rng.range(0, 100),
    });
  }
  blobs.sort((a, b) => b.r - a.r);
  const flowStarts: Point[] = [];
  for (let i = 0; i < 70; i++) flowStarts.push({ x: rng.range(-0.1, 1.1), y: rng.range(-0.1, 1.1) });
  const caustics: Point[][] = [];
  for (let c = 0; c < 5; c++) {
    const pts: Point[] = [];
    const y = rng.range(0.1, 0.9);
    for (let i = 0; i < 7; i++) pts.push({ x: -0.1 + (i / 6) * 1.2, y: y + rng.range(-0.12, 0.12) });
    caustics.push(pts);
  }
  const scene = { blobs, flowStarts, caustics };
  if (sceneCache.size > 24) sceneCache.clear();
  sceneCache.set(sc.design.seed, scene);
  return scene;
}

function draw(sc: SceneContext): void {
  const { ctx, size, design, frame, noise } = sc;
  const scene = buildScene(sc);
  const { intensity } = design.motion;
  const { bass, mid, treble } = frame.audio;
  const t = frame.time;
  const motion = frame.reducedMotion ? 0.25 : 1;
  const bg = design.colors.background;
  const accent = design.colors.accent;
  const aqua = shiftHue(accent, -0.09); // lean toward blue
  const teal = shiftHue(accent, 0.06); // lean toward green
  const deep = darken(mix(bg, aqua, 0.35), 0.3);

  const layer = getLayer(size);
  const L = layer.getContext('2d');
  if (!L) return;
  L.setTransform(1, 0, 0, 1, 0, 0);
  L.globalCompositeOperation = 'source-over';
  L.globalAlpha = 1;

  // Depth gradient: lighter water at the top, darker below.
  const depth = L.createLinearGradient(0, 0, 0, size);
  depth.addColorStop(0, mix(bg, aqua, 0.22));
  depth.addColorStop(1, darken(bg, 0.45));
  L.fillStyle = depth;
  L.fillRect(0, 0, size, size);

  // Tidal forms.
  const shown = Math.max(3, Math.round(lerp(3, scene.blobs.length, intensity)));
  const wobble = 0.08 + 0.22 * intensity;
  L.globalCompositeOperation = 'screen';
  for (let i = 0; i < shown; i++) {
    const b = scene.blobs[i];
    const cx = (b.cx + noise(b.phase, t * 0.07 * motion, 0) * 0.06 * intensity) * size;
    const cy = (b.cy + noise(b.phase + 5, t * 0.07 * motion, 1) * 0.06 * intensity) * size;
    const r = b.r * size * (1 + 0.14 * bass * motion);
    const color = b.tint < 0.33 ? aqua : b.tint < 0.66 ? accent : teal;
    const g = L.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(lighten(color, 0.1), 0.72));
    g.addColorStop(0.55, rgba(color, 0.42));
    g.addColorStop(1, rgba(deep, 0));
    blobPath(L, cx, cy, r, noise, t * 0.18 * motion + b.phase, wobble, 1.3, b.phase);
    L.fillStyle = g;
    L.fill();
  }

  // Flow lines: short streamlines that follow the noise field.
  L.globalCompositeOperation = 'lighter';
  const lineCount = Math.round(lerp(18, scene.flowStarts.length, intensity));
  L.strokeStyle = rgba(lighten(accent, 0.35), 0.16 + 0.16 * mid);
  L.lineWidth = Math.max(1, size * 0.0014 * (0.6 + mid));
  L.lineCap = 'round';
  const step = size * 0.013;
  for (let i = 0; i < lineCount; i++) {
    const s = scene.flowStarts[i];
    let x = s.x * size;
    let y = s.y * size;
    L.beginPath();
    L.moveTo(x, y);
    for (let k = 0; k < 26; k++) {
      const a = fbm3(noise, x / size * 2.4, y / size * 2.4, t * 0.12 * motion, 2) * TAU * 1.4;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      L.lineTo(x, y);
    }
    L.stroke();
  }
  L.globalCompositeOperation = 'source-over';

  // Refraction pass: copy the layer row by row with a sideways wobble.
  const rowH = Math.max(2, Math.round(size / 220));
  const amp = size * 0.02 * (0.3 + intensity) * (0.5 + mid * 0.9) * (frame.reducedMotion ? 0.35 : 1);
  const stretch = amp * 1.2;
  for (let y = 0; y < size; y += rowH) {
    const u = y / size;
    const dx = amp * (Math.sin(u * TAU * 2.2 + t * 0.9 * motion) + 0.7 * noise(u * 4, t * 0.35 * motion, 11));
    ctx.drawImage(layer, 0, y, size, rowH, dx - stretch, y, size + stretch * 2, rowH);
  }

  // Caustic threads near the surface.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(lighten(accent, 0.55), 0.1 + 0.22 * treble);
  ctx.lineWidth = Math.max(1, size * 0.0022);
  const cAmp = size * 0.04 * (0.4 + intensity);
  for (let c = 0; c < scene.caustics.length; c++) {
    const pts = scene.caustics[c].map((p, k) => ({
      x: p.x * size,
      y: p.y * size + noise(k * 0.8 + c * 3, t * 0.2 * motion, 21) * cAmp,
    }));
    splinePath(ctx, pts);
    ctx.stroke();
  }
  ctx.restore();

  // Surface light from above.
  const light = ctx.createLinearGradient(0, 0, 0, size * 0.5);
  light.addColorStop(0, 'rgba(255,255,255,0.08)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);

  drawMetaMarks(sc, rgba(sc.ink, 0.6));
}

export const currentScene: SceneRenderer = { draw, grainOverType: false };
