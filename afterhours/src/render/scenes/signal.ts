/**
 * SIGNAL — stacked oscilloscope traces and a spectrum strip.
 *
 * Each row is a line whose height is a bell-shaped envelope times a signal.
 * In ambient mode the signal is smooth noise; with audio it blends in the
 * real time-domain waveform from the analyser. Rows are painted back to
 * front with an opaque fill beneath each line, so nearer traces occlude the
 * ones behind them — the classic pulsar-plot look.
 */

import { rgba } from '../../lib/color';
import { TAU, gaussian, lerp } from '../../lib/math';
import { fbm3 } from '../../lib/noise';
import type { SceneContext, SceneRenderer } from '../types';

interface Row {
  center: number;
  width: number;
  freq: number;
  phase: number;
}

interface SignalScene {
  rows: Row[];
  top: number;
  bottom: number;
  left: number;
  right: number;
  accentEvery: number;
  accentOffset: number;
}

const MAX_ROWS = 40;
const POINTS = 150;
const sceneCache = new Map<number, SignalScene>();

function buildScene(sc: SceneContext): SignalScene {
  const cached = sceneCache.get(sc.design.seed);
  if (cached) return cached;
  const { rng } = sc;
  const rows: Row[] = [];
  const centerBias = rng.range(0.38, 0.62);
  for (let i = 0; i < MAX_ROWS; i++) {
    rows.push({
      center: centerBias + rng.range(-0.14, 0.14),
      width: rng.range(0.1, 0.24),
      freq: rng.range(1.6, 4.2),
      phase: rng.range(0, 100),
    });
  }
  const scene: SignalScene = {
    rows,
    top: rng.range(0.3, 0.4),
    bottom: rng.range(0.82, 0.88),
    left: 0.08,
    right: 0.92,
    accentEvery: rng.int(5, 9),
    accentOffset: rng.int(0, 4),
  };
  if (sceneCache.size > 24) sceneCache.clear();
  sceneCache.set(sc.design.seed, scene);
  return scene;
}

function draw(sc: SceneContext): void {
  const { ctx, size, design, frame, noise } = sc;
  const scene = buildScene(sc);
  const { intensity } = design.motion;
  const { bass, energy, beat, waveform, spectrum, source } = frame.audio;
  const t = frame.time;
  const motion = frame.reducedMotion ? 0.3 : 1;
  const bg = design.colors.background;
  const accent = design.colors.accent;

  const rowCount = Math.round(lerp(10, 36, intensity));
  const left = scene.left * size;
  const right = scene.right * size;
  const width = right - left;
  const gap = ((scene.bottom - scene.top) * size) / (rowCount - 1);
  const ampBase = gap * (2.2 + 4.2 * intensity);
  const loud = 0.5 + 0.9 * energy;
  const audioMix = source === 'audio' ? 0.75 : 0;
  const wfLen = waveform.length;

  ctx.save();
  ctx.lineJoin = 'round';
  const baseLine = Math.max(1, size * 0.0016);

  const xs = new Float32Array(POINTS + 1);
  const ys = new Float32Array(POINTS + 1);
  for (let i = 0; i < rowCount; i++) {
    const row = scene.rows[i];
    const baseY = scene.top * size + i * gap;
    const center = row.center + 0.05 * Math.sin(t * 0.3 * motion + row.phase);
    for (let j = 0; j <= POINTS; j++) {
      const u = j / POINTS;
      const env = gaussian(u, center, row.width);
      const sig = fbm3(noise, u * row.freq + row.phase, i * 0.37, t * 0.5 * motion, 3);
      const ridge = (0.3 + 0.7 * Math.abs(sig)) * (1 - audioMix * 0.5);
      const sample = waveform[Math.min(wfLen - 1, Math.floor(u * (wfLen - 1)))];
      const wave = sample * (0.7 + bass) * audioMix;
      const v = env * ampBase * loud * (ridge + wave * 1.4);
      xs[j] = left + width * u;
      ys[j] = baseY - Math.max(-gap * 0.35, v);
    }
    // Occlusion: an opaque fill beneath the trace hides the rows behind it.
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let j = 1; j <= POINTS; j++) ctx.lineTo(xs[j], ys[j]);
    ctx.lineTo(right, baseY + gap * 1.5);
    ctx.lineTo(left, baseY + gap * 1.5);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    // The visible trace: an open polyline, so no edges get stroked.
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let j = 1; j <= POINTS; j++) ctx.lineTo(xs[j], ys[j]);
    const isAccent = (i + scene.accentOffset) % scene.accentEvery === 0;
    ctx.strokeStyle = isAccent ? accent : rgba(sc.ink, 0.92);
    ctx.lineWidth = baseLine * (1 + 0.35 * beat * motion) * (isAccent ? 1.3 : 1);
    ctx.stroke();
  }

  // Spectrum strip along the bottom edge.
  const stripTop = size * 0.905;
  const stripH = size * 0.05;
  const bins = spectrum.length;
  const barW = width / bins;
  ctx.fillStyle = accent;
  for (let b = 0; b < bins; b++) {
    const h = Math.max(1, spectrum[b] * stripH * (0.5 + 0.5 * intensity));
    ctx.fillRect(left + b * barW + barW * 0.15, stripTop + stripH - h, barW * 0.7, h);
  }
  ctx.fillStyle = rgba(sc.ink, 0.5);
  ctx.fillRect(left, stripTop + stripH, width, Math.max(1, size * 0.001));

  // Print registration marks.
  ctx.strokeStyle = rgba(sc.ink, 0.45);
  ctx.lineWidth = Math.max(1, size * 0.001);
  const m = size * 0.035;
  const r = size * 0.009;
  for (const [x, y] of [[m, m], [size - m, m], [m, size - m], [size - m, size - m]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.moveTo(x - r * 1.8, y);
    ctx.lineTo(x + r * 1.8, y);
    ctx.moveTo(x, y - r * 1.8);
    ctx.lineTo(x, y + r * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

export const signalScene: SceneRenderer = { draw, grainOverType: true };
