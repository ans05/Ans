/**
 * Pure audio-feature extraction.
 *
 * Input is what the Web Audio AnalyserNode hands us each frame:
 *  - frequency data: magnitude per FFT bin (0..255), bins are linearly spaced
 *    from 0 Hz to sampleRate / 2, so bin k covers k * sampleRate / fftSize Hz.
 *  - time-domain data: the raw waveform (0..255 centred on 128).
 *
 * Output is a small, stable set of numbers the renderer can map onto motion.
 * Nothing in here touches the DOM, so it is unit-testable.
 */

export const WAVEFORM_POINTS = 256;
export const SPECTRUM_BINS = 48;

export interface AudioFeatures {
  /** 'audio' when driven by an analysed file, 'ambient' when synthesised. */
  source: 'audio' | 'ambient';
  /** Smoothed band levels in 0..1. */
  bass: number;
  mid: number;
  treble: number;
  /** Smoothed overall loudness (RMS) in 0..1. */
  energy: number;
  /** Beat envelope: jumps toward 1 on an onset, then decays. */
  beat: number;
  /** Downsampled waveform, values in -1..1. */
  waveform: Float32Array;
  /** Log-spaced spectrum, values in 0..1. */
  spectrum: Float32Array;
}

export function createEmptyFeatures(source: AudioFeatures['source'] = 'ambient'): AudioFeatures {
  return {
    source,
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    beat: 0,
    waveform: new Float32Array(WAVEFORM_POINTS),
    spectrum: new Float32Array(SPECTRUM_BINS),
  };
}

/** Frequency (Hz) → FFT bin index. */
export function hzToBin(hz: number, sampleRate: number, fftSize: number): number {
  return Math.round((hz / (sampleRate / 2)) * (fftSize / 2));
}

/** Mean magnitude (0..1) of the bins spanning [lowHz, highHz]. */
export function bandLevel(
  freqData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  lowHz: number,
  highHz: number,
): number {
  const lo = Math.max(0, hzToBin(lowHz, sampleRate, fftSize));
  const hi = Math.min(freqData.length - 1, hzToBin(highHz, sampleRate, fftSize));
  if (hi < lo) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += freqData[i];
  return sum / ((hi - lo + 1) * 255);
}

/** Root-mean-square of the time-domain signal, 0..1. */
export function rms(timeData: Uint8Array): number {
  if (timeData.length === 0) return 0;
  let acc = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    acc += v * v;
  }
  return Math.sqrt(acc / timeData.length);
}

/**
 * Collapse the linear FFT into `out.length` log-spaced bands between minHz
 * and maxHz, taking the peak of each band. Log spacing matches how we hear
 * pitch, so bass and treble get similar visual weight.
 */
export function logSpectrum(
  freqData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  out: Float32Array,
  minHz = 40,
  maxHz = 12000,
): Float32Array {
  const bins = out.length;
  const ratio = Math.log(maxHz / minHz);
  for (let b = 0; b < bins; b++) {
    const f0 = minHz * Math.exp((ratio * b) / bins);
    const f1 = minHz * Math.exp((ratio * (b + 1)) / bins);
    const lo = Math.max(0, hzToBin(f0, sampleRate, fftSize));
    const hi = Math.min(freqData.length - 1, Math.max(lo, hzToBin(f1, sampleRate, fftSize)));
    let peak = 0;
    for (let i = lo; i <= hi; i++) if (freqData[i] > peak) peak = freqData[i];
    out[b] = peak / 255;
  }
  return out;
}

/** Resample the byte waveform into `out` as floats in -1..1. */
export function downsampleWaveform(timeData: Uint8Array, out: Float32Array): Float32Array {
  const n = out.length;
  const step = timeData.length / n;
  for (let i = 0; i < n; i++) {
    const idx = Math.min(timeData.length - 1, Math.floor(i * step));
    out[i] = (timeData[idx] - 128) / 128;
  }
  return out;
}

/**
 * Envelope follower: rises quickly toward louder targets and falls slowly,
 * so visuals react to transients but never jitter. Rates are per second.
 */
export interface Envelope {
  value: number;
  follow(target: number, dt: number): number;
  reset(): void;
}

export function createEnvelope(attackRate = 24, releaseRate = 5): Envelope {
  const env: Envelope = {
    value: 0,
    follow(target, dt) {
      const rate = target > env.value ? attackRate : releaseRate;
      const k = 1 - Math.exp(-rate * Math.max(0, dt));
      env.value += (target - env.value) * k;
      return env.value;
    },
    reset() {
      env.value = 0;
    },
  };
  return env;
}

export interface BeatDetector {
  /** Feed the instantaneous bass energy; returns the current beat envelope (0..1). */
  update(instant: number, dt: number): number;
  reset(): void;
}

export interface BeatDetectorOptions {
  /** Roughly one second of frames at 60 fps. */
  historySize?: number;
  /** How far above the local average an onset must be (multiplier). */
  sensitivity?: number;
  /** Ignore energies below this floor (silence). */
  floor?: number;
  /** Minimum time between onsets, seconds. */
  refractory?: number;
  /** Envelope decay time constant, seconds. */
  release?: number;
}

/**
 * Energy-based onset detection: an onset is an instantaneous energy that
 * stands out from the recent average by more than the recent variance
 * suggests is normal. Simple, robust for percussive music, no FFT needed.
 */
export function createBeatDetector(options: BeatDetectorOptions = {}): BeatDetector {
  const size = options.historySize ?? 43;
  const sensitivity = options.sensitivity ?? 1.35;
  const floor = options.floor ?? 0.04;
  const refractory = options.refractory ?? 0.16;
  const release = options.release ?? 0.28;

  const history = new Float32Array(size);
  let filled = 0;
  let cursor = 0;
  let sinceLast = Infinity;
  let envelope = 0;

  return {
    update(instant, dt) {
      sinceLast += dt;
      envelope *= Math.exp(-dt / release);

      let mean = 0;
      for (let i = 0; i < filled; i++) mean += history[i];
      mean = filled > 0 ? mean / filled : 0;
      let variance = 0;
      for (let i = 0; i < filled; i++) {
        const d = history[i] - mean;
        variance += d * d;
      }
      variance = filled > 0 ? variance / filled : 0;

      // Higher variance (busy signal) demands a bigger jump before we call it a beat.
      const threshold = mean * (sensitivity + Math.min(0.6, variance * 12));
      const isOnset =
        filled >= Math.min(size, 10) && instant > floor && instant > threshold && sinceLast >= refractory;
      if (isOnset) {
        sinceLast = 0;
        envelope = 1;
      }

      history[cursor] = instant;
      cursor = (cursor + 1) % size;
      if (filled < size) filled++;
      return envelope;
    },
    reset() {
      history.fill(0);
      filled = 0;
      cursor = 0;
      sinceLast = Infinity;
      envelope = 0;
    },
  };
}

export interface FeatureExtractor {
  features: AudioFeatures;
  /** Compute features for this frame from raw analyser buffers. */
  update(freqData: Uint8Array, timeData: Uint8Array, sampleRate: number, fftSize: number, dt: number): AudioFeatures;
  /** Let the smoothed values settle back toward silence (e.g. when paused). */
  relax(dt: number): AudioFeatures;
  reset(): void;
}

/** Stateful wrapper that smooths band levels and runs beat detection. */
export function createFeatureExtractor(): FeatureExtractor {
  const features = createEmptyFeatures('audio');
  const bass = createEnvelope(30, 6);
  const mid = createEnvelope(26, 6);
  const treble = createEnvelope(26, 7);
  const energy = createEnvelope(20, 4);
  const beat = createBeatDetector();

  return {
    features,
    update(freqData, timeData, sampleRate, fftSize, dt) {
      const bassNow = bandLevel(freqData, sampleRate, fftSize, 30, 160);
      const midNow = bandLevel(freqData, sampleRate, fftSize, 160, 2000);
      const trebleNow = bandLevel(freqData, sampleRate, fftSize, 2000, 10000);
      // Treble bins are naturally quieter; lift them so they matter visually.
      features.bass = bass.follow(bassNow, dt);
      features.mid = mid.follow(Math.min(1, midNow * 1.25), dt);
      features.treble = treble.follow(Math.min(1, trebleNow * 1.8), dt);
      features.energy = energy.follow(Math.min(1, rms(timeData) * 2.2), dt);
      features.beat = beat.update(bassNow, dt);
      downsampleWaveform(timeData, features.waveform);
      logSpectrum(freqData, sampleRate, fftSize, features.spectrum);
      features.source = 'audio';
      return features;
    },
    relax(dt) {
      features.bass = bass.follow(0, dt);
      features.mid = mid.follow(0, dt);
      features.treble = treble.follow(0, dt);
      features.energy = energy.follow(0, dt);
      features.beat = beat.update(0, dt);
      const k = Math.exp(-dt * 6);
      for (let i = 0; i < features.waveform.length; i++) features.waveform[i] *= k;
      for (let i = 0; i < features.spectrum.length; i++) features.spectrum[i] *= k;
      return features;
    },
    reset() {
      bass.reset();
      mid.reset();
      treble.reset();
      energy.reset();
      beat.reset();
      features.waveform.fill(0);
      features.spectrum.fill(0);
      features.bass = features.mid = features.treble = features.energy = features.beat = 0;
    },
  };
}
