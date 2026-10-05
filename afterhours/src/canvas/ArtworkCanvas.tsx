/**
 * The live artwork. Owns the requestAnimationFrame loop, sizes the canvas to
 * its container (device-pixel aware), feeds audio or ambient features into
 * the renderer, and lets the user drag or nudge the title.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import { createAmbientSource } from '../audio/ambient';
import { createEmptyFeatures, type AudioFeatures } from '../audio/features';
import type { DesignState, Vec2 } from '../design/types';
import { clamp, lerp } from '../lib/math';
import { renderArtwork } from '../render/renderer';
import type { FrameInput, NormBounds } from '../render/types';

export interface ArtworkCanvasHandle {
  /** A copy of the most recent frame input, safe to hand to the exporter. */
  getFrame(): FrameInput;
}

interface Props {
  design: DesignState;
  animating: boolean;
  reducedMotion: boolean;
  engine: AudioEngine;
  onMoveTitle(position: Vec2): void;
  onNudgeTitle(dx: number, dy: number): void;
  onToggleAnimating(): void;
}

const MAX_PIXELS = 1600;
const HIT_PADDING = 0.02;
const EDGE_MARGIN = 0.02;

/**
 * Keep the whole title block inside the artwork. The renderer reports the
 * block's bounds and we know the anchor it was laid out from, so we know how
 * far the anchor may travel in each direction. If the block is bigger than
 * the artwork on an axis, that axis is left alone.
 */
function keepInside(p: Vec2, b: NormBounds, anchor: Vec2): Vec2 {
  if (b.w <= 0 || b.h <= 0) return p;
  const minX = EDGE_MARGIN + (anchor.x - b.x);
  const maxX = 1 - EDGE_MARGIN - (b.x + b.w - anchor.x);
  const minY = EDGE_MARGIN + (anchor.y - b.y);
  const maxY = 1 - EDGE_MARGIN - (b.y + b.h - anchor.y);
  return {
    x: minX <= maxX ? clamp(p.x, minX, maxX) : p.x,
    y: minY <= maxY ? clamp(p.y, minY, maxY) : p.y,
  };
}

function blendFeatures(a: AudioFeatures, b: AudioFeatures, t: number, out: AudioFeatures): AudioFeatures {
  out.bass = lerp(a.bass, b.bass, t);
  out.mid = lerp(a.mid, b.mid, t);
  out.treble = lerp(a.treble, b.treble, t);
  out.energy = lerp(a.energy, b.energy, t);
  out.beat = lerp(a.beat, b.beat, t);
  for (let i = 0; i < out.waveform.length; i++) out.waveform[i] = lerp(a.waveform[i], b.waveform[i], t);
  for (let i = 0; i < out.spectrum.length; i++) out.spectrum[i] = lerp(a.spectrum[i], b.spectrum[i], t);
  out.source = t > 0.5 ? b.source : a.source;
  return out;
}

export const ArtworkCanvas = forwardRef<ArtworkCanvasHandle, Props>(function ArtworkCanvas(
  { design, animating, reducedMotion, engine, onMoveTitle, onNudgeTitle, onToggleAnimating },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  // Latest props, readable from inside the animation loop without restarting it.
  const designRef = useRef(design);
  const engineRef = useRef(engine);
  const reducedRef = useRef(reducedMotion);
  useLayoutEffect(() => {
    designRef.current = design;
    engineRef.current = engine;
    reducedRef.current = reducedMotion;
  });

  const phaseRef = useRef(0);
  const frameRef = useRef<FrameInput>({ time: 0, dt: 0, audio: createEmptyFeatures(), reducedMotion });
  const boundsRef = useRef<NormBounds>({ x: 0, y: 0, w: 0, h: 0 });
  const anchorRef = useRef<Vec2>(design.layout.titlePosition);
  const mixRef = useRef(0);
  const ambientRef = useRef(createAmbientSource());
  const blendedRef = useRef(createEmptyFeatures());
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origin: Vec2; size: number } | null>(null);

  const onMoveTitleRef = useRef(onMoveTitle);
  useLayoutEffect(() => {
    onMoveTitleRef.current = onMoveTitle;
  });

  const renderFrame = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    const d = designRef.current;
    const reduced = reducedRef.current;
    const eng = engineRef.current;

    const ambient = ambientRef.current.update(phaseRef.current);
    const live = eng && eng.isPlaying;
    const audio = eng ? eng.analyse(dt) : null;
    // Cross-fade between ambient and analysed features so toggling playback never jumps.
    const target = live && audio ? 1 : 0;
    mixRef.current = clamp(mixRef.current + (target - mixRef.current) * Math.min(1, dt * 4), 0, 1);
    const features =
      audio && mixRef.current > 0.001 ? blendFeatures(ambient, audio, mixRef.current, blendedRef.current) : ambient;

    const speed = lerp(0.12, 1.7, d.motion.speed) * (reduced ? 0.18 : 1) * (0.75 + 0.5 * features.energy);
    phaseRef.current += dt * speed;

    const frame = frameRef.current;
    frame.time = phaseRef.current;
    frame.dt = dt;
    frame.audio = features;
    frame.reducedMotion = reduced;

    const out = renderArtwork(ctx, canvas.width, d, frame);
    boundsRef.current = out.titleBounds;
    anchorRef.current = d.layout.titlePosition;

    // A loaded file or a preset change can leave the title block partly
    // outside the artwork; snap the stored position back inside once.
    if (!dragRef.current) {
      const fixed = keepInside(d.layout.titlePosition, out.titleBounds, d.layout.titlePosition);
      if (Math.abs(fixed.x - d.layout.titlePosition.x) > 1e-4 || Math.abs(fixed.y - d.layout.titlePosition.y) > 1e-4) {
        onMoveTitleRef.current(fixed);
      }
    }
    const h = handleRef.current;
    if (h) {
      const b = out.titleBounds;
      h.style.left = `${(b.x - HIT_PADDING) * 100}%`;
      h.style.top = `${(b.y - HIT_PADDING) * 100}%`;
      h.style.width = `${(b.w + HIT_PADDING * 2) * 100}%`;
      h.style.height = `${(b.h + HIT_PADDING * 2) * 100}%`;
    }
  }, []);

  // Size the canvas to its container; cap the backing store for performance.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const css = wrap.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.max(256, Math.min(MAX_PIXELS, Math.round(css * dpr)));
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
        renderFrame(0);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderFrame]);

  // The animation loop.
  useEffect(() => {
    if (!animating) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      renderFrame(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animating, renderFrame]);

  // While paused, still reflect edits with a single render.
  useEffect(() => {
    if (!animating) renderFrame(0);
  }, [animating, design, reducedMotion, renderFrame]);

  // Canvas text doesn't wait for web fonts; repaint once they arrive.
  useEffect(() => {
    if (!('fonts' in document)) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) renderFrame(0);
    });
    return () => {
      cancelled = true;
    };
  }, [renderFrame]);

  const getFrame = useCallback((): FrameInput => {
    const f = frameRef.current;
    const audio = createEmptyFeatures(f.audio.source);
    audio.bass = f.audio.bass;
    audio.mid = f.audio.mid;
    audio.treble = f.audio.treble;
    audio.energy = f.audio.energy;
    audio.beat = f.audio.beat;
    audio.waveform.set(f.audio.waveform);
    audio.spectrum.set(f.audio.spectrum);
    return { time: f.time, dt: f.dt, audio, reducedMotion: f.reducedMotion };
  }, []);

  useImperativeHandle(ref, () => ({ getFrame }), [getFrame]);

  // Development aid: lets browser automation inspect the live frame.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __afterhoursDebug?: { getFrame(): FrameInput } };
    w.__afterhoursDebug = { getFrame };
    return () => {
      delete w.__afterhoursDebug;
    };
  }, [getFrame]);

  const keepInsideNow = (p: Vec2): Vec2 => keepInside(p, boundsRef.current, anchorRef.current);

  const toNorm = (e: PointerEvent<HTMLElement>): Vec2 | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const hitsTitle = (p: Vec2): boolean => {
    const b = boundsRef.current;
    return (
      p.x >= b.x - HIT_PADDING && p.x <= b.x + b.w + HIT_PADDING && p.y >= b.y - HIT_PADDING && p.y <= b.y + b.h + HIT_PADDING
    );
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const p = toNorm(e);
    if (!p || !hitsTitle(p)) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...designRef.current.layout.titlePosition },
      size: wrap.clientWidth,
    };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = (e.clientX - drag.startX) / drag.size;
      const dy = (e.clientY - drag.startY) / drag.size;
      onMoveTitle(keepInsideNow({ x: drag.origin.x + dx, y: drag.origin.y + dy }));
      return;
    }
    const p = toNorm(e);
    const over = !!p && hitsTitle(p);
    if (over !== hover) setHover(over);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    const wrap = wrapRef.current;
    if (wrap && wrap.hasPointerCapture(e.pointerId)) wrap.releasePointerCapture(e.pointerId);
  };

  const nudge = (dx: number, dy: number) => {
    const a = anchorRef.current;
    const target = keepInsideNow({ x: a.x + dx, y: a.y + dy });
    onNudgeTitle(target.x - a.x, target.y - a.y);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    switch (e.key) {
      case 'ArrowLeft':
        nudge(-step, 0);
        break;
      case 'ArrowRight':
        nudge(step, 0);
        break;
      case 'ArrowUp':
        nudge(0, -step);
        break;
      case 'ArrowDown':
        nudge(0, step);
        break;
      case ' ':
        onToggleAnimating();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const label = `Artwork preview: ${design.text.title || 'untitled'} by ${design.text.artist || 'unknown artist'}, ${design.preset} preset. Use the arrow keys to move the title, Shift for larger steps, Space to play or pause the animation.`;

  return (
    <div
      ref={wrapRef}
      className={`artwork${dragging ? ' is-dragging' : hover ? ' is-hover' : ''}`}
      role="application"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => hover && setHover(false)}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} className="artwork__canvas" aria-hidden="true" />
      <div ref={handleRef} className="artwork__title-handle" aria-hidden="true" />
    </div>
  );
});
