import type { AudioFeatures } from '../audio/features';
import type { DesignState } from '../design/types';
import type { Noise3 } from '../lib/noise';
import type { Rng } from '../lib/random';

/** Everything that changes from frame to frame. */
export interface FrameInput {
  /** Scene clock in seconds. Already scaled by motion.speed and audio energy. */
  time: number;
  /** Seconds since the previous frame (clamped). */
  dt: number;
  audio: AudioFeatures;
  /** When true the renderer avoids large movements and keeps grain still. */
  reducedMotion: boolean;
}

/** Axis-aligned box in normalised artwork coordinates (0..1). */
export interface NormBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderOutput {
  titleBounds: NormBounds;
}

/** What a preset scene receives. `size` is the canvas edge in device pixels. */
export interface SceneContext {
  ctx: CanvasRenderingContext2D;
  size: number;
  design: DesignState;
  frame: FrameInput;
  /** Off-white or near-black, whichever reads on the background. */
  ink: string;
  /** Seeded generator for building the scene; `noise` is seeded too. */
  rng: Rng;
  noise: Noise3;
}

export interface SceneRenderer {
  /** Draw the background and procedural forms. Typography is drawn afterwards. */
  draw(sc: SceneContext): void;
  /** Whether the grain should sit on top of the title (print look) or beneath it. */
  grainOverType: boolean;
}
