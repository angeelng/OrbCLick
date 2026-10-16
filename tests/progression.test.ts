import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import {
  grantTrainerXp,
  isMaxLevel,
  isZoneUnlocked,
  levelProgress,
  xpForNextLevel,
} from '../src/core/progression';
import { createInitialState } from '../src/core/state';

describe('xpForNextLevel', () => {
  it('sigue la curva XP(n) = 100 · 1,5^(n-1)', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(150);
    expect(xpForNextLevel(3)).toBe(225);
  });

  it('es infinita al nivel máximo: no hay nivel siguiente', () => {
    expect(xpForNextLevel(BALANCE.trainer.maxLevel)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('grantTrainerXp', () => {
  it('acumula XP sin subir de nivel si no llega', () => {
    const result = grantTrainerXp({ level: 1, xp: 0 }, 40);
    expect(result).toEqual({ trainer: { level: 1, xp: 40 }, levelsGained: 0 });
  });

  it('sube de nivel y conserva el resto', () => {
    const result = grantTrainerXp({ level: 1, xp: 90 }, 20);
    expect(result.trainer).toEqual({ level: 2, xp: 10 });
    expect(result.levelsGained).toBe(1);
  });

  it('resuelve varias subidas de golpe', () => {
    const result = grantTrainerXp({ level: 1, xp: 0 }, 100 + 150 + 10);
    expect(result.trainer).toEqual({ level: 3, xp: 10 });
    expect(result.levelsGained).toBe(2);
  });

  it('ignora cantidades no positivas', () => {
    const trainer = { level: 2, xp: 30 };
    expect(grantTrainerXp(trainer, 0).trainer).toBe(trainer);
    expect(grantTrainerXp(trainer, -50).trainer).toBe(trainer);
  });

  it('no pasa del nivel máximo y descarta la XP sobrante', () => {
    const result = grantTrainerXp({ level: 1, xp: 0 }, 1e12);
    expect(result.trainer).toEqual({ level: BALANCE.trainer.maxLevel, xp: 0 });
    expect(isMaxLevel(result.trainer)).toBe(true);
    expect(grantTrainerXp(result.trainer, 500).levelsGained).toBe(0);
  });

  it('no muta el entrenador que recibe', () => {
    const trainer = { level: 1, xp: 99 };
    grantTrainerXp(trainer, 10);
    expect(trainer).toEqual({ level: 1, xp: 99 });
  });
});

describe('levelProgress', () => {
  it('va de 0 a 1 dentro del nivel', () => {
    expect(levelProgress({ level: 1, xp: 0 })).toBe(0);
    expect(levelProgress({ level: 1, xp: 50 })).toBe(0.5);
    expect(levelProgress({ level: 1, xp: 100 })).toBe(1);
  });

  it('está completo al nivel máximo', () => {
    expect(levelProgress({ level: BALANCE.trainer.maxLevel, xp: 0 })).toBe(1);
  });
});

describe('zonas desbloqueadas', () => {
  it('la Pradera está disponible desde el principio', () => {
    expect(isZoneUnlocked(createInitialState(0, 1), 'meadow')).toBe(true);
  });
});
