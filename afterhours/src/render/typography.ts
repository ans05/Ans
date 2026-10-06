/**
 * Typography for the three presets.
 *
 * Each style lays out the title + artist as a block anchored at
 * `design.layout.titlePosition` and reports the block's bounds so the canvas
 * can hit-test drags. Fonts are bundled (see /public/fonts) and referenced by
 * family name; the system fallbacks keep text readable before they load.
 */

import { darken, lighten, mix, rgba } from '../lib/color';
import { TAU, clamp } from '../lib/math';
import type { NormBounds, SceneContext } from './types';
import { addCyclicStops, hexToTuple, mixTuple } from './shared';

export const FONT_DISPLAY = '"Archivo Black", "Helvetica Neue", Arial, "Liberation Sans", sans-serif';
export const FONT_MONO = '"Space Mono", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';
export const FONT_SERIF = '"Instrument Serif", "Times New Roman", Georgia, serif';

/** Shrink `fontSize` until `text` fits `maxWidth` under the given horizontal scale. */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFor: (px: number) => string,
  fontSize: number,
  maxWidth: number,
  scaleX = 1,
  minSize = 8,
): number {
  let px = fontSize;
  for (let i = 0; i < 24; i++) {
    ctx.font = fontFor(px);
    const w = ctx.measureText(text).width * scaleX;
    if (w <= maxWidth || px <= minSize) break;
    px = Math.max(minSize, px * Math.min(0.92, maxWidth / w));
  }
  return px;
}

/** Greedy word wrap. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const trial = `${current} ${words[i]}`;
    if (ctx.measureText(trial).width <= maxWidth) current = trial;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function catalogNumber(seed: number): string {
  return `AH-${String((seed % 9000) + 1000).padStart(4, '0')}`;
}

function year(design: { updatedAt: string }): string {
  const y = new Date(design.updatedAt).getFullYear();
  return Number.isFinite(y) ? String(y) : '2026';
}

export function drawTypography(sc: SceneContext): NormBounds {
  switch (sc.design.preset) {
    case 'chrome':
      return drawChromeType(sc);
    case 'current':
      return drawCurrentType(sc);
    case 'signal':
      return drawSignalType(sc);
    case 'tesseract':
      return drawTesseractType(sc);
  }
}

/* --------------------------------------------------------------- TESSERACT */

function drawTesseractType(sc: SceneContext): NormBounds {
  const { ctx, size, design, frame } = sc;
  const title = design.text.title.toUpperCase();
  const artist = design.text.artist.toUpperCase();
  const maxWidth = size * 0.84;
  const titleFont = (px: number) => `400 ${px}px ${FONT_DISPLAY}`;
  const tracking = 0.08;
  const measure = (px: number, text: string) => {
    ctx.font = titleFont(px);
    ctx.letterSpacing = `${px * tracking}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = '0px';
    return w;
  };
  let titleSize = size * 0.1;
  for (let i = 0; i < 20; i++) {
    const w = measure(titleSize, title);
    if (w <= maxWidth || titleSize <= 8) break;
    titleSize = Math.max(8, titleSize * Math.min(0.92, maxWidth / w));
  }
  const artistSize = clamp(size * 0.02, 9, size * 0.026);
  const gap = titleSize * 0.5;
  const blockH = titleSize + gap + artistSize;
  const cx = design.layout.titlePosition.x * size;
  const cy = design.layout.titlePosition.y * size;
  const top = cy - blockH / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Title: wide-tracked, flat ink, with a projected "shadow" copy offset along the W axis.
  const depth = (frame.reducedMotion ? 0.3 : 1) * titleSize * 0.06 * (0.6 + frame.audio.bass);
  ctx.font = titleFont(titleSize);
  ctx.letterSpacing = `${titleSize * tracking}px`;
  const titleWidth = ctx.measureText(title).width;
  const baseline = top + titleSize * 0.85;
  ctx.fillStyle = rgba(design.colors.accent, 0.5);
  ctx.fillText(title, cx + depth, baseline - depth);
  ctx.fillStyle = sc.ink;
  ctx.fillText(title, cx, baseline);
  ctx.letterSpacing = '0px';

  // Artist with bracket rules, like an axis label.
  let artistWidth = 0;
  if (artist) {
    ctx.font = `700 ${artistSize}px ${FONT_MONO}`;
    ctx.letterSpacing = `${artistSize * 0.3}px`;
    artistWidth = ctx.measureText(artist).width;
    const y = top + titleSize + gap + artistSize * 0.8;
    ctx.fillStyle = design.colors.accent;
    ctx.fillText(artist, cx, y);
    ctx.letterSpacing = '0px';
    ctx.strokeStyle = rgba(sc.ink, 0.4);
    ctx.lineWidth = Math.max(1, size * 0.0012);
    const bx = artistWidth / 2 + artistSize;
    const bh = artistSize * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - bx + artistSize * 0.4, y - bh);
    ctx.lineTo(cx - bx, y - bh);
    ctx.lineTo(cx - bx, y + artistSize * 0.25);
    ctx.lineTo(cx - bx + artistSize * 0.4, y + artistSize * 0.25);
    ctx.moveTo(cx + bx - artistSize * 0.4, y - bh);
    ctx.lineTo(cx + bx, y - bh);
    ctx.lineTo(cx + bx, y + artistSize * 0.25);
    ctx.lineTo(cx + bx - artistSize * 0.4, y + artistSize * 0.25);
    ctx.stroke();
  }
  ctx.restore();
  const w = Math.max(titleWidth, artistWidth + artistSize * 2) / size;
  return { x: cx / size - w / 2, y: top / size, w, h: blockH / size };
}

/* ------------------------------------------------------------------ CHROME */

const CHROME_TYPE_PALETTE = [
  hexToTuple('#1c1c20'),
  hexToTuple('#f6f6f6'),
  hexToTuple('#9a9aa0'),
  hexToTuple('#ffffff'),
  hexToTuple('#2b2b30'),
  hexToTuple('#d6d6da'),
];

function drawChromeType(sc: SceneContext): NormBounds {
  const { ctx, size, design, frame } = sc;
  const title = design.text.title.toUpperCase();
  const artist = design.text.artist.toUpperCase();
  const scaleX = 0.84;
  const maxWidth = size * 0.86;
  const titleFont = (px: number) => `400 ${px}px ${FONT_DISPLAY}`;
  const titleSize = fitFontSize(ctx, title, titleFont, size * 0.17, maxWidth, scaleX);
  const artistSize = clamp(size * 0.024, 9, size * 0.03);
  const gap = titleSize * 0.42;
  const blockH = titleSize + (artist ? gap + artistSize : 0);
  const cx = design.layout.titlePosition.x * size;
  const cy = design.layout.titlePosition.y * size;
  const top = cy - blockH / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Artist line with fine rules either side.
  let artistWidth = 0;
  if (artist) {
    ctx.font = `700 ${artistSize}px ${FONT_MONO}`;
    ctx.letterSpacing = `${artistSize * 0.28}px`;
    artistWidth = ctx.measureText(artist).width;
    const y = top + artistSize;
    ctx.fillStyle = design.colors.accent;
    ctx.fillText(artist, cx, y);
    ctx.strokeStyle = rgba(sc.ink, 0.35);
    ctx.lineWidth = Math.max(1, size * 0.0012);
    const ruleGap = artistSize * 1.1;
    const ruleLen = Math.min(size * 0.12, (maxWidth - artistWidth) / 2 - ruleGap);
    if (ruleLen > 4) {
      ctx.beginPath();
      ctx.moveTo(cx - artistWidth / 2 - ruleGap, y - artistSize * 0.33);
      ctx.lineTo(cx - artistWidth / 2 - ruleGap - ruleLen, y - artistSize * 0.33);
      ctx.moveTo(cx + artistWidth / 2 + ruleGap, y - artistSize * 0.33);
      ctx.lineTo(cx + artistWidth / 2 + ruleGap + ruleLen, y - artistSize * 0.33);
      ctx.stroke();
    }
    ctx.letterSpacing = '0px';
  }

  // Title: condensed display face filled with a slowly sweeping metal gradient.
  const titleBaseline = top + (artist ? artistSize + gap : 0) + titleSize * 0.82;
  ctx.font = titleFont(titleSize);
  ctx.letterSpacing = `${-titleSize * 0.02}px`;
  const measured = ctx.measureText(title).width * scaleX;
  ctx.save();
  ctx.translate(cx, titleBaseline);
  ctx.scale(scaleX, 1);
  const phase = frame.reducedMotion ? 0.1 : frame.time * 0.08 + frame.audio.bass * 0.06;
  const g = ctx.createLinearGradient(0, -titleSize * 0.85, 0, titleSize * 0.15);
  const accent = hexToTuple(design.colors.accent);
  const palette = CHROME_TYPE_PALETTE.map((c, i) => (i === 5 ? mixTuple(c, accent, 0.45) : c));
  addCyclicStops(g, palette, phase, 10);
  ctx.fillStyle = g;
  ctx.fillText(title, 0, 0);
  ctx.lineWidth = Math.max(0.8, size * 0.0014);
  ctx.strokeStyle = rgba(design.colors.accent, 0.55);
  ctx.strokeText(title, 0, 0);
  ctx.restore();
  ctx.restore();

  const w = Math.max(measured, artistWidth) / size;
  return { x: cx / size - w / 2, y: top / size, w, h: blockH / size };
}

/* ----------------------------------------------------------------- CURRENT */

function drawCurrentType(sc: SceneContext): NormBounds {
  const { ctx, size, design, frame } = sc;
  const title = design.text.title;
  const artist = design.text.artist.toUpperCase();
  const maxWidth = size * 0.84;
  const titleFont = (px: number) => `italic 400 ${px}px ${FONT_SERIF}`;
  const titleSize = fitFontSize(ctx, title, titleFont, size * 0.2, maxWidth);
  const artistSize = clamp(size * 0.022, 9, size * 0.028);
  const gap = titleSize * 0.32;
  const blockH = titleSize * 0.9 + (artist ? gap + artistSize : 0);
  const cx = design.layout.titlePosition.x * size;
  const cy = design.layout.titlePosition.y * size;
  const top = cy - blockH / 2;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = titleFont(titleSize);
  const totalWidth = ctx.measureText(title).width;
  const baseline = top + titleSize * 0.78;
  const ink = sc.ink;
  const glow = lighten(design.colors.accent, 0.4);

  // Per-glyph vertical drift: each letter rides its own slow wave, offset by
  // index, so the title reads as if seen through moving water.
  const amp = frame.reducedMotion ? 0 : titleSize * 0.035 * (0.5 + frame.audio.mid * 0.9);
  let x = cx - totalWidth / 2;
  ctx.textAlign = 'left';
  for (let i = 0; i < title.length; i++) {
    const ch = title[i];
    const w = ctx.measureText(ch).width;
    const dy = Math.sin(frame.time * 1.4 + i * 0.55) * amp + Math.sin(frame.time * 0.6 + i * 1.3) * amp * 0.5;
    // Faint refracted copy beneath, then the solid glyph.
    ctx.fillStyle = rgba(glow, 0.28);
    ctx.fillText(ch, x + titleSize * 0.02, baseline + dy + titleSize * 0.03);
    ctx.fillStyle = ink;
    ctx.fillText(ch, x, baseline + dy);
    x += w;
  }

  let artistWidth = 0;
  if (artist) {
    ctx.font = `400 ${artistSize}px ${FONT_MONO}`;
    ctx.letterSpacing = `${artistSize * 0.32}px`;
    ctx.textAlign = 'center';
    artistWidth = ctx.measureText(artist).width;
    ctx.fillStyle = design.colors.accent;
    ctx.fillText(artist, cx, top + titleSize * 0.9 + gap + artistSize * 0.8);
    ctx.letterSpacing = '0px';
  }
  ctx.restore();

  const w = Math.max(totalWidth, artistWidth) / size;
  return { x: cx / size - w / 2, y: top / size, w, h: blockH / size };
}

/* ------------------------------------------------------------------ SIGNAL */

function drawSignalType(sc: SceneContext): NormBounds {
  const { ctx, size, design, frame } = sc;
  const title = design.text.title.toUpperCase();
  const artist = design.text.artist.toUpperCase();
  const left = design.layout.titlePosition.x * size;
  const top = design.layout.titlePosition.y * size;
  const maxWidth = size * 0.9 - left;
  const minWidth = size * 0.4;
  const usable = Math.max(minWidth, maxWidth);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  let y = top;
  const rule = Math.max(2, size * 0.004);
  const artistSize = clamp(size * 0.026, 10, size * 0.032);
  let widest = 0;

  if (artist) {
    ctx.fillStyle = design.colors.accent;
    ctx.fillRect(left, y, usable, rule);
    y += rule + artistSize * 0.9;
    ctx.font = `700 ${artistSize}px ${FONT_MONO}`;
    ctx.letterSpacing = `${artistSize * 0.18}px`;
    ctx.fillStyle = sc.ink;
    ctx.fillText(artist, left, y);
    widest = Math.max(widest, ctx.measureText(artist).width);
    ctx.letterSpacing = '0px';
    y += artistSize * 0.55;
  }

  // Stacked poster title. Wrap into lines; shrink until every line fits.
  const titleFont = (px: number) => `400 ${px}px ${FONT_DISPLAY}`;
  let titleSize = size * 0.15;
  let lines: string[] = [title];
  for (let i = 0; i < 12; i++) {
    ctx.font = titleFont(titleSize);
    lines = wrapLines(ctx, title, usable);
    const longest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (longest <= usable || titleSize <= 10) break;
    titleSize = Math.max(10, titleSize * Math.min(0.9, usable / longest));
  }
  const lineHeight = titleSize * 0.92;
  const pulse = frame.reducedMotion ? 0 : frame.audio.beat * 0.012 * titleSize;
  ctx.font = titleFont(titleSize);
  ctx.letterSpacing = `${-titleSize * 0.015}px`;
  for (let i = 0; i < lines.length; i++) {
    y += lineHeight;
    const text = lines[i];
    const isLast = i === lines.length - 1 && lines.length > 1;
    ctx.fillStyle = isLast ? design.colors.accent : sc.ink;
    ctx.fillText(text, left - pulse * 0.5, y);
    widest = Math.max(widest, ctx.measureText(text).width);
  }
  ctx.letterSpacing = '0px';
  y += titleSize * 0.22;
  ctx.fillStyle = sc.ink;
  ctx.fillRect(left, y, Math.min(usable, widest), rule * 0.5);
  y += rule * 0.5;

  // Side caption, rotated, publication style.
  ctx.save();
  const cap = `AFTERHOURS  ·  ${catalogNumber(design.seed)}  ·  ${year(design)}`;
  const capSize = clamp(size * 0.016, 8, size * 0.02);
  ctx.font = `400 ${capSize}px ${FONT_MONO}`;
  ctx.letterSpacing = `${capSize * 0.2}px`;
  ctx.fillStyle = rgba(sc.ink, 0.7);
  ctx.translate(size * 0.965, size * 0.955);
  ctx.rotate(-TAU / 4);
  ctx.fillText(cap, 0, 0);
  ctx.restore();

  ctx.restore();
  return { x: left / size, y: top / size, w: Math.min(usable, Math.max(widest, size * 0.3)) / size, h: (y - top) / size };
}

/* -------------------------------------------------------- small shared bits */

/** Thin publication marks shared by CHROME and CURRENT: catalogue number + year. */
export function drawMetaMarks(sc: SceneContext, color: string): void {
  const { ctx, size, design } = sc;
  const s = clamp(size * 0.015, 8, size * 0.02);
  ctx.save();
  ctx.font = `400 ${s}px ${FONT_MONO}`;
  ctx.letterSpacing = `${s * 0.18}px`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(catalogNumber(design.seed), size * 0.05, size * 0.065);
  ctx.textAlign = 'right';
  ctx.fillText(year(design), size * 0.95, size * 0.065);
  ctx.textAlign = 'left';
  ctx.fillText('AFTERHOURS', size * 0.05, size * 0.955);
  ctx.textAlign = 'right';
  ctx.fillText(sc.design.preset.toUpperCase(), size * 0.95, size * 0.955);
  ctx.restore();
}

export function metalInk(background: string, accent: string): string {
  return mix(darken(background, 0.3), accent, 0.08);
}
