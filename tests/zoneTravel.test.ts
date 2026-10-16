import { describe, expect, it } from 'vitest';
import { startBattle } from '../src/core/combat';
import { travelToZone } from '../src/core/engine';
import {
  bossProgress,
  canEnterZone,
  isZoneUnlocked,
  refreshZoneUnlocks,
  unlockedZones,
  zoneBlock,
} from '../src/core/progression';
import { zoneTypeBonus } from '../src/core/ranch';
import { createRng } from '../src/core/rng';
import { createInitialState, type GameState } from '../src/core/state';
import { BALANCE } from '../src/data/balance';

const NOW = 1_700_000_000_000;

function withState(patch: Partial<GameState>): GameState {
  return { ...createInitialState(NOW, 99), ...patch };
}

/** Partida con la Pradera superada: nivel suficiente y Cornavid vencido. */
function afterMeadowBoss(level = 5): GameState {
  return refreshZoneUnlocks(
    withState({
      trainer: { level, xp: 0 },
      bosses: { meadow: { defeated: true, availableAt: 0 } },
    }),
  );
}

describe('desbloqueo de zonas', () => {
  it('una partida nueva solo tiene la Pradera', () => {
    const state = createInitialState(NOW, 1);
    expect(state.unlockedZoneIds).toEqual(['meadow']);
    expect(unlockedZones(state).map((zone) => zone.id)).toEqual(['meadow']);
  });

  it('el nivel sin el jefe no abre la Cueva, y el jefe sin el nivel tampoco', () => {
    const soloNivel = withState({ trainer: { level: 9, xp: 0 } });
    expect(zoneBlock(soloNivel, 'cave')).toBe('boss');
    expect(canEnterZone(soloNivel, 'cave')).toBe(false);

    const soloJefe = withState({ bosses: { meadow: { defeated: true, availableAt: 0 } } });
    expect(zoneBlock(soloJefe, 'cave')).toBe('level');
    expect(canEnterZone(soloJefe, 'cave')).toBe(false);
  });

  it('con nivel 5 y Cornavid vencido la Cueva entra en la lista', () => {
    const state = afterMeadowBoss();
    expect(isZoneUnlocked(state, 'cave')).toBe(true);
    expect(state.unlockedZoneIds).toEqual(['meadow', 'cave']);
    // El Lago sigue cerrado: le falta el nivel 10 y el jefe de la Cueva.
    expect(isZoneUnlocked(state, 'lake')).toBe(false);
  });

  it('refreshZoneUnlocks no toca el estado si no hay nada nuevo', () => {
    const state = afterMeadowBoss();
    expect(refreshZoneUnlocks(state)).toBe(state);
  });

  it('una zona desbloqueada no se cierra al bajar de nivel', () => {
    const state = afterMeadowBoss();
    const bajada = refreshZoneUnlocks({ ...state, trainer: { level: 1, xp: 0 } });
    expect(isZoneUnlocked(bajada, 'cave')).toBe(true);
  });

  it('el Lago pide el nivel 10 y al jefe de la Cueva', () => {
    const state = refreshZoneUnlocks(
      withState({
        trainer: { level: 10, xp: 0 },
        bosses: {
          meadow: { defeated: true, availableAt: 0 },
          cave: { defeated: true, availableAt: 0 },
        },
      }),
    );
    expect(state.unlockedZoneIds).toEqual(['meadow', 'cave', 'lake']);
  });

  it('bossProgress rellena los huecos de una partida sin jefes', () => {
    expect(bossProgress(createInitialState(NOW, 1), 'lake')).toEqual({
      defeated: false,
      availableAt: 0,
    });
  });
});

describe('viajar entre zonas', () => {
  const rng = (): ReturnType<typeof createRng> => createRng(5);

  it('no se puede viajar a una zona cerrada', () => {
    const result = travelToZone(createInitialState(NOW, 1), 'cave', NOW, rng());
    expect(result.moved).toBe(false);
    expect(result.failure).toBe('locked');
  });

  it('viajar cambia la zona activa y deja atrás a la salvaje', () => {
    const state = {
      ...afterMeadowBoss(),
      encounter: {
        speciesId: 'brotillo' as const,
        hp: 5,
        maxHp: 15,
        shiny: false,
        appearedAt: NOW,
        fleesAt: NOW + 20_000,
      },
    };
    const result = travelToZone(state, 'cave', NOW, rng());
    expect(result.moved).toBe(true);
    expect(result.state.activeZoneId).toBe('cave');
    expect(result.state.encounter).toBeNull();
    // La siguiente aparición se reprograma: viajar no acorta la espera.
    expect(result.state.nextSpawnAt).toBeGreaterThanOrEqual(NOW + BALANCE.capture.spawnMinMs * 0.5);
  });

  it('viajar a la zona en la que ya estás no cambia nada', () => {
    const state = afterMeadowBoss();
    const result = travelToZone(state, 'meadow', NOW, rng());
    expect(result.moved).toBe(false);
    expect(result.failure).toBeNull();
    expect(result.state).toBe(state);
  });

  it('en medio de un combate no se viaja', () => {
    const creature = {
      uid: 1,
      speciesId: 'chispin' as const,
      level: 1,
      xp: 0,
      traitId: 'hardworking' as const,
      shiny: false,
      satiety: 100,
      location: 'ranch' as const,
      exhaustedUntil: 0,
      postId: null,
      capturedAt: NOW,
    };
    const ready = {
      ...afterMeadowBoss(8),
      creatures: [creature],
      team: [creature.uid],
      encounter: {
        speciesId: 'brotillo' as const,
        hp: 15,
        maxHp: 15,
        shiny: false,
        appearedAt: NOW,
        fleesAt: NOW + 20_000,
      },
    };
    const fighting = startBattle(ready, NOW);
    expect(fighting.started).toBe(true);
    expect(travelToZone(fighting.state, 'cave', NOW, rng()).failure).toBe('in-battle');
  });
});

describe('tipo favorecido de la zona activa', () => {
  it('cada zona favorece a su tipo y deja igual al resto', () => {
    const meadow = createInitialState(NOW, 1);
    expect(zoneTypeBonus(meadow, 'plant')).toBe(BALANCE.zone.favoredTypeMultiplier);
    expect(zoneTypeBonus(meadow, 'rock')).toBe(1);

    const cave = { ...meadow, activeZoneId: 'cave' as const };
    expect(zoneTypeBonus(cave, 'rock')).toBe(BALANCE.zone.favoredTypeMultiplier);
    expect(zoneTypeBonus(cave, 'plant')).toBe(1);

    const lake = { ...meadow, activeZoneId: 'lake' as const };
    expect(zoneTypeBonus(lake, 'water')).toBe(BALANCE.zone.favoredTypeMultiplier);
  });
});
