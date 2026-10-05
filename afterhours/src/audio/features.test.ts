import { describe, expect, it } from 'vitest';
import {
  bandLevel,
  createBeatDetector,
  createEnvelope,
  downsampleWaveform,
  hzToBin,
  logSpectrum,
  rms,
} from './features';

const SR = 48000;
const FFT = 2048;

describe('frequency helpers', () => {
  it('maps Hz to bins across the Nyquist range', () => {
    expect(hzToBin(0, SR, FFT)).toBe(0);
    expect(hzToBin(SR / 2, SR, FFT)).toBe(FFT / 2);
    expect(hzToBin(1000, SR, FFT)).toBe(Math.round((1000 / 24000) * 1024));
  });

  it('bandLevel averages only the requested bins', () => {
    const data = new Uint8Array(FFT / 2);
    const lo = hzToBin(30, SR, FFT);
    const hi = hzToBin(160, SR, FFT);
    for (let i = lo; i <= hi; i++) data[i] = 255;
    expect(bandLevel(data, SR, FFT, 30, 160)).toBeCloseTo(1, 5);
    expect(bandLevel(data, SR, FFT, 2000, 10000)).toBe(0);
  });

  it('logSpectrum produces unit-range bins that follow energy', () => {
    const data = new Uint8Array(FFT / 2);
    data.fill(0, 0, 50);
    data.fill(200, 50, 1024);
    const out = logSpectrum(data, SR, FFT, new Float32Array(48));
    expect(out.length).toBe(48);
    for (const v of out) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of out) expect(v).toBeLessThanOrEqual(1);
    expect(out[47]).toBeCloseTo(200 / 255, 3);
  });
});

describe('time-domain helpers', () => {
  it('rms is 0 for silence and ~0.707 for a full-scale sine', () => {
    const silent = new Uint8Array(FFT).fill(128);
    expect(rms(silent)).toBe(0);
    const sine = new Uint8Array(FFT);
    for (let i = 0; i < FFT; i++) sine[i] = Math.round(128 + 127 * Math.sin((i / FFT) * Math.PI * 2 * 8));
    expect(rms(sine)).toBeCloseTo(0.7, 1);
  });

  it('downsampleWaveform centres bytes to -1..1', () => {
    const data = new Uint8Array(512);
    data.fill(255, 0, 256);
    data.fill(0, 256, 512);
    const out = downsampleWaveform(data, new Float32Array(4));
    expect(out[0]).toBeCloseTo(127 / 128, 5);
    expect(out[3]).toBe(-1);
  });
});

describe('envelope follower', () => {
  it('rises faster than it falls', () => {
    const env = createEnvelope(24, 5);
    const up = env.follow(1, 1 / 60);
    for (let i = 0; i < 30; i++) env.follow(1, 1 / 60);
    const peak = env.value;
    const down = env.follow(0, 1 / 60);
    expect(up).toBeGreaterThan(0.2);
    expect(peak).toBeGreaterThan(0.95);
    expect(peak - down).toBeLessThan(up);
  });
});

describe('beat detector', () => {
  it('fires on a loud transient after a quiet run and then decays', () => {
    const beat = createBeatDetector();
    const dt = 1 / 60;
    let max = 0;
    for (let i = 0; i < 60; i++) max = Math.max(max, beat.update(0.2 + 0.01 * Math.sin(i), dt));
    expect(max).toBe(0);
    const onset = beat.update(0.9, dt);
    expect(onset).toBe(1);
    let later = onset;
    for (let i = 0; i < 20; i++) later = beat.update(0.2, dt);
    expect(later).toBeLessThan(0.4);
    expect(later).toBeGreaterThan(0);
  });

  it('ignores a second hit inside the refractory window', () => {
    const beat = createBeatDetector({ refractory: 0.2 });
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) beat.update(0.2, dt);
    expect(beat.update(0.9, dt)).toBe(1);
    const v1 = beat.update(0.2, dt);
    const v2 = beat.update(0.95, dt); // too soon
    expect(v2).toBeLessThan(v1);
  });
});
