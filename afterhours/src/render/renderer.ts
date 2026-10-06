/**
 * Top-level renderer: given a canvas context, the design and the frame
 * input, paints one complete artwork. Pure with respect to React — it is
 * used by both the live canvas and the PNG exporter.
 */

import { inkFor } from '../lib/color';
import { createNoise3 } from '../lib/noise';
import { createRng } from '../lib/random';
import type { DesignState } from '../design/types';
import { chromeScene } from './scenes/chrome';
import { currentScene } from './scenes/current';
import { signalScene } from './scenes/signal';
import { tesseractScene } from './scenes/tesseract';
import { drawGrain } from './texture';
import { drawTypography } from './typography';
import type { FrameInput, RenderOutput, SceneContext, SceneRenderer } from './types';

const SCENES: Record<DesignState['preset'], SceneRenderer> = {
  chrome: chromeScene,
  current: currentScene,
  signal: signalScene,
  tesseract: tesseractScene,
};

const noiseCache = new Map<number, ReturnType<typeof createNoise3>>();
function noiseFor(seed: number) {
  let n = noiseCache.get(seed);
  if (!n) {
    if (noiseCache.size > 32) noiseCache.clear();
    n = createNoise3(seed);
    noiseCache.set(seed, n);
  }
  return n;
}

export function renderArtwork(
  ctx: CanvasRenderingContext2D,
  size: number,
  design: DesignState,
  frame: FrameInput,
): RenderOutput {
  const scene = SCENES[design.preset];
  const sc: SceneContext = {
    ctx,
    size,
    design,
    frame,
    ink: inkFor(design.colors.background),
    rng: createRng(design.seed),
    noise: noiseFor(design.seed),
  };

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = design.colors.background;
  ctx.fillRect(0, 0, size, size);

  scene.draw(sc);

  if (!scene.grainOverType) drawGrain(ctx, size, design.motion.texture, frame.time, frame.reducedMotion);
  const titleBounds = drawTypography(sc);
  if (scene.grainOverType) drawGrain(ctx, size, design.motion.texture, frame.time, frame.reducedMotion);

  ctx.restore();
  return { titleBounds };
}
