import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextUint32 } from '../src/core/rng';

describe('rng', () => {
  it('es determinista para la misma semilla', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const sequenceA = Array.from({ length: 8 }, () => a.float());
    const sequenceB = Array.from({ length: 8 }, () => b.float());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('da secuencias distintas para semillas distintas', () => {
    expect(createRng(1).float()).not.toBe(createRng(2).float());
  });

  it('devuelve floats en [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.float();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int respeta los extremos inclusive', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(rng.int(4, 6));
    expect([...seen].sort((x, y) => x - y)).toEqual([4, 5, 6]);
  });

  it('range se queda dentro del intervalo', () => {
    const rng = createRng(21);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.range(-3, 3);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(3);
    }
  });

  it('chance(0) nunca y chance(1) siempre', () => {
    const rng = createRng(5);
    expect(Array.from({ length: 50 }, () => rng.chance(0))).not.toContain(true);
    expect(Array.from({ length: 50 }, () => rng.chance(1))).not.toContain(false);
  });

  it('la semilla se puede guardar y continuar la secuencia', () => {
    const first = createRng(2024);
    first.float();
    first.float();
    const saved = first.seed();

    const resumed = createRng(saved);
    expect(resumed.float()).toBe(createRng(saved).float());
    expect(first.float()).toBe(createRng(saved).float());
  });

  it('nextFloat y nextUint32 son funciones puras', () => {
    expect(nextUint32(42)).toBe(nextUint32(42));
    expect(nextFloat(42).value).toBe(nextFloat(42).value);
    expect(nextFloat(42).seed).not.toBe(42);
  });
});
