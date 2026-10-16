/**
 * PRNG con semilla (mulberry32). Vive en `core/` para que los tests y un futuro
 * servidor de validación puedan reproducir cualquier partida: nada de
 * `Math.random()` en el juego.
 */

/** Avanza la semilla y devuelve un entero sin signo de 32 bits. */
export function nextUint32(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
  t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
  return (t ^ (t >>> 14)) >>> 0;
}

/** Paso puro: semilla → valor en [0, 1) y la semilla siguiente. */
export function nextFloat(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  return { value: nextUint32(seed) / 4_294_967_296, seed: next };
}

export interface Rng {
  /** Valor en [0, 1). */
  float(): number;
  /** Valor en [min, max). */
  range(min: number, max: number): number;
  /** Entero en [min, max]. */
  int(min: number, max: number): number;
  /** `true` con probabilidad `p` (0–1). */
  chance(p: number): boolean;
  /** Semilla actual, para guardarla en el estado y continuar la secuencia. */
  seed(): number;
}

/**
 * Cursor sobre la secuencia de una semilla. Es mutable a propósito —
 * las funciones de `core/` lo reciben como parámetro y devuelven la semilla
 * resultante en el nuevo estado, así siguen siendo deterministas.
 */
export function createRng(initialSeed: number): Rng {
  let seed = initialSeed >>> 0;
  const float = (): number => {
    const step = nextFloat(seed);
    seed = step.seed;
    return step.value;
  };
  return {
    float,
    range: (min, max) => min + float() * (max - min),
    int: (min, max) => min + Math.floor(float() * (max - min + 1)),
    chance: (p) => float() < p,
    seed: () => seed,
  };
}
