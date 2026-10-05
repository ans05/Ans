/**
 * CHROME — liquid-metal ribbons, mercury blobs and a torus ring.
 *
 * The metallic look is a gradient trick: a cyclic palette of dark → bright →
 * mid → white → dark bands sampled along the form. Rotating the palette's
 * phase each frame makes the "reflection" sweep across the surface, which is
 * what reads as chrome. Audio bass swells the forms; treble brightens rims.
 */

import { darken, lighten, mix, rgba } from '../../lib/color';
import { TAU, lerp } from '../../lib/math';
import { addCyclicStops, blobPath, hexToTuple, mixTuple, splinePath, type Point } from '../shared';
import { drawMetaMarks } from '../typography';
import type { SceneContext, SceneRenderer } from '../types';

type Kind = 'ribbon' | 'blob' | 'ring';

interface Form {
  kind: Kind;
  cx: number;
  cy: number;
  r: number;
  angle: number;
  spin: number;
  phase: number;
  thickness: number;
  pts: Point[];
}

interface ChromeScene {
  forms: Form[];
  glow: Point;
  lineY: number;
  lineX: number;
}

const BASE_PALETTE = [
  hexToTuple('#141417'),
  hexToTuple('#f4f4f5'),
  hexToTuple('#77777e'),
  hexToTuple('#ffffff'),
  hexToTuple('#202024'),
  hexToTuple('#d2d2d7'),
  hexToTuple('#e6e6ea'),
  hexToTuple('#0f0f12'),
];

const sceneCache = new Map<number, ChromeScene>();

function buildScene(sc: SceneContext): ChromeScene {
  const cached = sceneCache.get(sc.design.seed);
  if (cached) return cached;
  const { rng } = sc;
  const forms: Form[] = [];
  const kinds: Kind[] = ['ribbon', 'blob', 'ring', 'blob', 'ribbon', 'blob', 'ring'];
  for (const kind of kinds) {
    const cx = rng.range(0.15, 0.85);
    const cy = rng.range(0.15, 0.85);
    const pts: Point[] = [];
    if (kind === 'ribbon') {
      const a = rng.range(0, TAU);
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      for (let i = 0; i < 6; i++) {
        const u = (i / 5 - 0.5) * 1.6;
        pts.push({ x: cx + dx * u + rng.range(-0.08, 0.08), y: cy + dy * u + rng.range(-0.08, 0.08) });
      }
    }
    forms.push({
      kind,
      cx,
      cy,
      r: kind === 'ring' ? rng.range(0.18, 0.34) : rng.range(0.1, 0.26),
      angle: rng.range(0, TAU),
      spin: rng.range(0.2, 0.6) * rng.sign(),
      phase: rng.range(0, 100),
      thickness: kind === 'ring' ? rng.range(0.035, 0.07) : rng.range(0.05, 0.12),
      pts,
    });
  }
  forms.sort((a, b) => b.r - a.r);
  const scene: ChromeScene = {
    forms,
    glow: { x: rng.range(0.2, 0.8), y: rng.range(0.2, 0.8) },
    lineY: rng.range(0.12, 0.88),
    lineX: rng.range(0.12, 0.88),
  };
  if (sceneCache.size > 24) sceneCache.clear();
  sceneCache.set(sc.design.seed, scene);
  return scene;
}

function draw(sc: SceneContext): void {
  const { ctx, size, design, frame, noise } = sc;
  const scene = buildScene(sc);
  const { intensity } = design.motion;
  const { bass, treble, beat } = frame.audio;
  const t = frame.time;
  const motion = frame.reducedMotion ? 0.25 : 1;
  const accent = hexToTuple(design.colors.accent);
  const palette = BASE_PALETTE.map((c, i) => (i === 5 || i === 6 ? mixTuple(c, accent, i === 5 ? 0.5 : 0.25) : c));

  // Backdrop: a soft diagonal lift plus a faint accent glow.
  const bg = design.colors.background;
  const lift = ctx.createLinearGradient(0, 0, size, size);
  lift.addColorStop(0, lighten(bg, 0.07));
  lift.addColorStop(0.55, bg);
  lift.addColorStop(1, darken(bg, 0.25));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, size, size);

  const glowR = size * (0.35 + 0.1 * bass * motion);
  const glow = ctx.createRadialGradient(
    scene.glow.x * size, scene.glow.y * size, 0,
    scene.glow.x * size, scene.glow.y * size, glowR,
  );
  glow.addColorStop(0, rgba(design.colors.accent, 0.16 + 0.08 * bass));
  glow.addColorStop(1, rgba(design.colors.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Fine structural lines.
  ctx.strokeStyle = rgba(sc.ink, 0.14);
  ctx.lineWidth = Math.max(1, size * 0.0009);
  ctx.beginPath();
  ctx.moveTo(0, scene.lineY * size);
  ctx.lineTo(size, scene.lineY * size);
  ctx.moveTo(scene.lineX * size, 0);
  ctx.lineTo(scene.lineX * size, size);
  ctx.stroke();

  const shown = Math.max(3, Math.round(lerp(3, scene.forms.length, intensity)));
  const pulse = 1 + 0.12 * bass * (0.4 + intensity) * motion;
  const sweep = t * 0.14 * motion + bass * 0.05;

  for (let i = 0; i < shown; i++) {
    const f = scene.forms[i];
    const driftX = noise(f.phase, t * 0.08 * motion, 1) * 0.04 * size * intensity;
    const driftY = noise(f.phase + 7, t * 0.08 * motion, 2) * 0.04 * size * intensity;
    const cx = f.cx * size + driftX;
    const cy = f.cy * size + driftY;
    const rot = f.angle + t * f.spin * 0.25 * motion;
    const phase = sweep + f.phase * 0.1;

    ctx.save();
    if (f.kind === 'blob') {
      const r = f.r * size * pulse;
      const wobble = 0.06 + 0.16 * intensity;
      blobPath(ctx, cx, cy, r, noise, t * 0.22 * motion + f.phase, wobble, 1.5, f.phase);
      const gx = Math.cos(rot) * r;
      const gy = Math.sin(rot) * r;
      const g = ctx.createLinearGradient(cx - gx, cy - gy, cx + gx, cy + gy);
      addCyclicStops(g, palette, phase, 16);
      ctx.fillStyle = g;
      ctx.fill();
      // Rim light along the edge and a soft specular on the upper-left.
      ctx.lineWidth = Math.max(1, size * 0.0025);
      ctx.strokeStyle = rgba('#ffffff', 0.45 + 0.3 * treble);
      ctx.stroke();
      const spec = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.7);
      spec.addColorStop(0, `rgba(255,255,255,${0.55 + 0.2 * treble})`);
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.fill();
    } else if (f.kind === 'ribbon') {
      const amp = size * (0.03 + 0.06 * intensity);
      const pts = f.pts.map((p, k) => ({
        x: p.x * size + noise(k * 0.9 + f.phase, t * 0.15 * motion, 3) * amp,
        y: p.y * size + noise(k * 0.9 + f.phase + 11, t * 0.15 * motion, 4) * amp,
      }));
      const lw = f.thickness * size * pulse;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const g = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
      addCyclicStops(g, palette, phase, 20);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      splinePath(ctx, pts);
      ctx.lineWidth = lw;
      ctx.strokeStyle = g;
      ctx.stroke();
      // Specular edge above, shadow edge below: cheap tube shading.
      ctx.translate(0, -lw * 0.3);
      ctx.lineWidth = lw * 0.09;
      ctx.strokeStyle = rgba('#ffffff', 0.35 + 0.25 * treble);
      ctx.stroke();
      ctx.translate(0, lw * 0.62);
      ctx.lineWidth = lw * 0.12;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
    } else {
      const rx = f.r * size * pulse;
      const ry = rx * 0.58;
      const lw = f.thickness * size;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      const g: CanvasGradient =
        typeof ctx.createConicGradient === 'function'
          ? ctx.createConicGradient(phase * TAU, 0, 0)
          : ctx.createLinearGradient(-rx, 0, rx, 0);
      addCyclicStops(g, palette, phase, 24);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.lineWidth = lw;
      ctx.strokeStyle = g;
      ctx.stroke();
      ctx.lineWidth = Math.max(1, size * 0.002);
      ctx.strokeStyle = rgba('#ffffff', 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + lw / 2, ry + lw / 2, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(design.colors.accent, 0.6 + 0.3 * beat * motion);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, rx - lw / 2), Math.max(1, ry - lw / 2), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Corner registration ticks.
  ctx.strokeStyle = rgba(sc.ink, 0.4);
  ctx.lineWidth = Math.max(1, size * 0.001);
  const m = size * 0.035;
  const tick = size * 0.012;
  for (const [x, y] of [[m, m], [size - m, m], [m, size - m], [size - m, size - m]]) {
    ctx.beginPath();
    ctx.moveTo(x - tick, y);
    ctx.lineTo(x + tick, y);
    ctx.moveTo(x, y - tick);
    ctx.lineTo(x, y + tick);
    ctx.stroke();
  }
  drawMetaMarks(sc, rgba(mix(sc.ink, design.colors.accent, 0.3), 0.75));
}

export const chromeScene: SceneRenderer = { draw, grainOverType: false };
