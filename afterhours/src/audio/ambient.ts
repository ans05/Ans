/**
 * Ambient mode: when no audio is loaded, the artwork still breathes.
 *
 * Instead of silence we synthesise a gentle set of features from slow
 * low-frequency oscillators and smooth noise. The values stay well inside the
 * range real music produces, and they change slowly — there are no sudden
 * jumps, so the scene drifts rather than flashes.
 */

import { TAU } from '../lib/math';
import { createNoise3 } from '../lib/noise';
import { createEmptyFeatures, type AudioFeatures } from './features';

const noise = createNoise3(1234);

export function createAmbientSource(): { features: AudioFeatures; update(time: number): AudioFeatures } {
  const features = createEmptyFeatures('ambient');
  const wf = features.waveform;
  const sp = features.spectrum;
  return {
    features,
    update(time) {
      const t = time;
      features.bass = 0.32 + 0.14 * Math.sin(t * 0.9) + 0.08 * noise(t * 0.3, 0, 0);
      features.mid = 0.3 + 0.12 * Math.sin(t * 0.61 + 1.2) + 0.08 * noise(t * 0.25, 5, 0);
      features.treble = 0.22 + 0.1 * Math.sin(t * 1.37 + 2.5) + 0.07 * noise(t * 0.4, 9, 0);
      features.energy = 0.28 + 0.1 * Math.sin(t * 0.5 + 0.4);
      // A soft, periodic swell instead of a beat; never a hard onset.
      features.beat = 0.25 * (0.5 + 0.5 * Math.sin(t * 2.1));

      const n = wf.length;
      for (let i = 0; i < n; i++) {
        const x = i / n;
        wf[i] =
          0.35 * Math.sin(x * TAU * 2 + t * 1.3) +
          0.2 * Math.sin(x * TAU * 5 - t * 0.9) +
          0.18 * noise(x * 6, t * 0.5, 3);
      }
      const m = sp.length;
      for (let b = 0; b < m; b++) {
        const f = b / m;
        const base = Math.exp(-f * 2.2) * 0.75;
        sp[b] = Math.max(0, Math.min(1, base * (0.6 + 0.4 * (0.5 + 0.5 * noise(b * 0.35, t * 0.45, 7)))));
      }
      return features;
    },
  };
}
