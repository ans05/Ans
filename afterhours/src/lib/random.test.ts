import { describe, expect, it } from 'vitest';
import { createNoise3 } from './noise';
import { createRng, hashString } from './random';

describe('createRng', () => {
  it('is deterministic for a seed and uniform-ish', () => {
    const a = createRng(7);
    const b = createRng(7);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    const r = createRng(99);
    let sum = 0;
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 5000).toBeGreaterThan(0.45);
    expect(sum / 5000).toBeLessThan(0.55);
  });

  it('int() covers the inclusive range', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('hashString is stable', () => {
    expect(hashString('afterhours')).toBe(hashString('afterhours'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('createNoise3', () => {
  it('stays within [-1, 1] and is continuous', () => {
    const n = createNoise3(5);
    let prev = n(0, 0, 0);
    for (let i = 1; i < 2000; i++) {
      const v = n(i * 0.01, 0.3, 0.7);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(Math.abs(v - prev)).toBeLessThan(0.2);
      prev = v;
    }
  });
});
