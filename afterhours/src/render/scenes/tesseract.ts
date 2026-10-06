/**
 * TESSERACT — a four-dimensional hypercube, projected down to the sleeve.
 *
 * The 16 vertices live at (±1, ±1, ±1, ±1). Each frame they are rotated in
 * the planes that involve the fourth axis (XW, YW, ZW), which is the motion
 * no 3D object can make: the inner cube turns itself inside out and becomes
 * the outer one. A perspective projection 4D → 3D (dividing by distance
 * along W) and then 3D → 2D gives the familiar nested-cube drawing.
 * Audio: bass breathes the scale, mids tilt the 3D view, the beat nudges
 * W-rotation, and the spectrum rings the figure with 48 ticks.
 */

import { darken, lighten, mix, rgba } from '../../lib/color';
import { TAU, lerp } from '../../lib/math';
import { drawMetaMarks } from '../typography';
import type { SceneContext, SceneRenderer } from '../types';

type V4 = [number, number, number, number];

const VERTS: V4[] = [];
for (let i = 0; i < 16; i++) {
  VERTS.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
}
const EDGES: Array<[number, number]> = [];
for (let a = 0; a < 16; a++) {
  for (let b = a + 1; b < 16; b++) {
    const diff = a ^ b;
    if ((diff & (diff - 1)) === 0) EDGES.push([a, b]); // differ in exactly one coordinate
  }
}

function rotate(v: V4, i: number, j: number, angle: number): V4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const out: V4 = [v[0], v[1], v[2], v[3]];
  out[i] = v[i] * c - v[j] * s;
  out[j] = v[i] * s + v[j] * c;
  return out;
}

interface TesseractScene {
  phases: number[];
  spins: number[];
  layers: number;
  orbit: { x: number; y: number };
}

const sceneCache = new Map<number, TesseractScene>();

function buildScene(sc: SceneContext): TesseractScene {
  const cached = sceneCache.get(sc.design.seed);
  if (cached) return cached;
  const { rng } = sc;
  const scene: TesseractScene = {
    phases: [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)],
    spins: [rng.range(0.25, 0.5) * rng.sign(), rng.range(0.15, 0.35) * rng.sign(), rng.range(0.1, 0.3) * rng.sign()],
    layers: rng.int(1, 3),
    orbit: { x: rng.range(0.42, 0.58), y: rng.range(0.4, 0.52) },
  };
  if (sceneCache.size > 24) sceneCache.clear();
  sceneCache.set(sc.design.seed, scene);
  return scene;
}

function draw(sc: SceneContext): void {
  const { ctx, size, design, frame } = sc;
  const scene = buildScene(sc);
  const { intensity } = design.motion;
  const { bass, mid, treble, beat, spectrum } = frame.audio;
  const t = frame.time;
  const motion = frame.reducedMotion ? 0.2 : 1;
  const accent = design.colors.accent;
  const bg = design.colors.background;
  const cx = scene.orbit.x * size;
  const cy = scene.orbit.y * size;

  // Deep-space backdrop with a faint accent core.
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.7);
  core.addColorStop(0, mix(bg, accent, 0.14 + 0.06 * bass));
  core.addColorStop(0.5, bg);
  core.addColorStop(1, darken(bg, 0.5));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // Perspective floor grid, receding toward the horizon behind the figure.
  ctx.save();
  ctx.strokeStyle = rgba(sc.ink, 0.1);
  ctx.lineWidth = Math.max(1, size * 0.0008);
  const horizon = cy + size * 0.12;
  const scroll = (t * 0.08 * motion) % 1;
  for (let i = 0; i < 14; i++) {
    const u = ((i + scroll) / 14) ** 2.2;
    const y = horizon + u * (size - horizon);
    ctx.globalAlpha = 0.25 + 0.75 * u;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * size * 0.06, horizon);
    ctx.lineTo(cx + i * size * 0.4, size * 1.2);
    ctx.stroke();
  }
  ctx.restore();

  // Spectrum ring: 48 ticks around the figure.
  const ringR = size * (0.36 + 0.02 * bass);
  ctx.save();
  ctx.lineCap = 'round';
  for (let b = 0; b < spectrum.length; b++) {
    const a = (b / spectrum.length) * TAU - TAU / 4 + t * 0.05 * motion;
    const len = size * (0.006 + 0.05 * spectrum[b] * (0.4 + intensity));
    ctx.strokeStyle = rgba(accent, 0.25 + 0.6 * spectrum[b]);
    ctx.lineWidth = Math.max(1, size * 0.002);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
    ctx.lineTo(cx + Math.cos(a) * (ringR + len), cy + Math.sin(a) * (ringR + len));
    ctx.stroke();
  }
  ctx.restore();

  // Hypercube(s). Each layer is the same figure at a different W-phase and scale.
  const layers = Math.max(1, Math.round(lerp(1, scene.layers + 1, intensity)));
  const wAngle = t * scene.spins[0] * motion + scene.phases[0] + beat * 0.25 * motion;
  const tilt = scene.phases[1] + Math.sin(t * 0.17 * motion) * 0.35 + (mid - 0.3) * 0.3;
  const yaw = t * scene.spins[1] * motion + scene.phases[2];
  const d4 = 2.4;
  const d3 = 6.5;
  const radius = size * (0.14 + 0.02 * bass) * (0.85 + 0.15 * intensity);

  for (let layer = layers - 1; layer >= 0; layer--) {
    const k = layer / Math.max(1, layers - 1);
    const scale = radius * (1 - 0.28 * layer);
    const phase = wAngle + layer * 0.9;
    const pts2d: Array<{ x: number; y: number; z: number; w: number }> = [];
    for (const v of VERTS) {
      let p = rotate(v, 0, 3, phase);
      p = rotate(p, 1, 3, phase * 0.6 + scene.phases[3]);
      p = rotate(p, 2, 3, t * scene.spins[2] * motion);
      // 4D → 3D
      const s4 = d4 / (d4 - p[3]);
      let x = p[0] * s4, y = p[1] * s4, z = p[2] * s4;
      // 3D rotation (yaw about Y, tilt about X)
      const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
      [x, z] = [x * cyaw - z * syaw, x * syaw + z * cyaw];
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      [y, z] = [y * ct - z * st, y * st + z * ct];
      // 3D → 2D
      const s3 = d3 / (d3 - z);
      pts2d.push({ x: cx + x * s3 * scale, y: cy + y * s3 * scale, z, w: p[3] });
    }
    // Edges sorted back to front so nearer lines paint over farther ones.
    const order = EDGES.map((e, i) => ({ i, z: pts2d[e[0]].z + pts2d[e[1]].z })).sort((a, b) => a.z - b.z);
    ctx.save();
    ctx.lineCap = 'round';
    for (const { i } of order) {
      const [a, b] = EDGES[i];
      const pa = pts2d[a], pb = pts2d[b];
      const depth = (pa.z + pb.z) / 2; // -~1.7..1.7
      const near = (depth + 1.8) / 3.6;
      const wMix = ((pa.w + pb.w) / 2 + 1) / 2; // which cube: inner/outer along W
      const col = mix(lighten(accent, 0.45), accent, wMix);
      ctx.strokeStyle = rgba(wMix > 0.5 ? col : sc.ink, (0.25 + 0.7 * near) * (1 - 0.35 * k));
      ctx.lineWidth = Math.max(1, size * (0.0012 + 0.0035 * near) * (1 - 0.3 * k));
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    // Vertices as nodes; the W-positive set glows with the accent.
    for (const p of pts2d) {
      const near = (p.z + 1.8) / 3.6;
      const r = Math.max(1.2, size * (0.003 + 0.006 * near + 0.004 * treble));
      ctx.fillStyle = p.w > 0 ? accent : sc.ink;
      ctx.globalAlpha = (0.5 + 0.5 * near) * (1 - 0.35 * k);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Axis readout: which way W is turning, as a publication-style caption.
  ctx.save();
  ctx.font = `400 ${Math.max(8, size * 0.014)}px "Space Mono", ui-monospace, monospace`;
  ctx.letterSpacing = `${size * 0.002}px`;
  ctx.fillStyle = rgba(sc.ink, 0.6);
  ctx.textAlign = 'left';
  const deg = Math.round((((wAngle % TAU) + TAU) % TAU) * (360 / TAU));
  ctx.fillText(`W-ROTATION ${String(deg).padStart(3, '0')}°  ·  XW YW ZW`, size * 0.05, size * 0.11);
  ctx.restore();

  drawMetaMarks(sc, rgba(mix(sc.ink, accent, 0.3), 0.75));
}

export const tesseractScene: SceneRenderer = { draw, grainOverType: false };
