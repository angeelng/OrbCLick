import { describe, expect, it } from 'vitest';
import {
  addCapturedCreature,
  captureChance,
  clearEncounter,
  damageEncounter,
  hasEncounterExpired,
  isSpawnDue,
  orbCount,
  pickWildSpecies,
  rollShiny,
  rollSpawnDelay,
  rollTrait,
  spawnEncounter,
  throwOrb,
  wildHp,
} from '../src/core/capture';
import { creaturesInRanch, creaturesInReserve, ranchSlots } from '../src/core/ranch';
import { createRng, type Rng } from '../src/core/rng';
import { createInitialState, type GameState, type WildEncounter } from '../src/core/state';
import { BALANCE } from '../src/data/balance';
import { ORBS } from '../src/data/orbs';
import { getSpecies, SPECIES_LIST, wildRosterOf } from '../src/data/species';
import { TRAIT_IDS } from '../src/data/traits';

const NOW = 100_000;
const base = createInitialState(NOW, 1);

function withState(overrides: Partial<GameState>): GameState {
  return { ...base, ...overrides };
}

function encounterOf(speciesId: Parameters<typeof getSpecies>[0], hp?: number): WildEncounter {
  const species = getSpecies(speciesId);
  const maxHp = wildHp(species);
  return {
    speciesId,
    hp: hp ?? maxHp,
    maxHp,
    shiny: false,
    appearedAt: NOW,
    fleesAt: NOW + BALANCE.capture.encounterMs,
  };
}

/** PRNG de mentira para forzar éxitos y fracasos concretos. */
function fakeRng(values: readonly number[]): Rng {
  let index = 0;
  const next = (): number => values[index++ % values.length] ?? 0;
  return {
    float: next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    seed: () => 7,
  };
}

describe('PV de las salvajes', () => {
  it('una común de la Pradera tiene los PV base del GDD', () => {
    expect(wildHp(getSpecies('brotillo'))).toBe(BALANCE.capture.baseWildHp);
  });

  it('cada escalón de rareza dobla los PV', () => {
    expect(wildHp(getSpecies('ascuin'))).toBe(BALANCE.capture.baseWildHp * 2);
    expect(wildHp(getSpecies('chispin'))).toBe(BALANCE.capture.baseWildHp * 4);
  });

  it('cada zona más adentro multiplica por 1,8', () => {
    expect(wildHp(getSpecies('pedrusco'))).toBe(Math.round(BALANCE.capture.baseWildHp * 1.8));
    expect(wildHp(getSpecies('goton'))).toBe(Math.round(BALANCE.capture.baseWildHp * 1.8 ** 2));
  });
});

describe('apariciones', () => {
  it('solo elige salvajes de la zona, nunca al jefe', () => {
    const rng = createRng(42);
    const names = new Set<string>();
    for (let i = 0; i < 400; i += 1) names.add(pickWildSpecies('meadow', rng)?.id ?? '');
    expect([...names].sort()).toEqual(['ascuin', 'brotillo', 'chispin', 'pelusin']);
  });

  it('respeta el peso de rareza: las comunes salen mucho más', () => {
    const rng = createRng(2024);
    let commons = 0;
    let rares = 0;
    for (let i = 0; i < 4_000; i += 1) {
      const species = pickWildSpecies('meadow', rng);
      if (species?.rarity === 'common') commons += 1;
      if (species?.rarity === 'rare') rares += 1;
    }
    expect(commons).toBeGreaterThan(rares * 5);
  });

  it('la espera entre apariciones cae entre 45 y 90 s', () => {
    const rng = createRng(7);
    for (let i = 0; i < 300; i += 1) {
      const delay = rollSpawnDelay(base, rng);
      expect(delay).toBeGreaterThanOrEqual(BALANCE.capture.spawnMinMs);
      expect(delay).toBeLessThanOrEqual(BALANCE.capture.spawnMaxMs);
    }
  });

  it('spawnEncounter deja una salvaje con los PV llenos y su reloj de huida', () => {
    const state = spawnEncounter(base, NOW, createRng(5));
    expect(state.encounter).not.toBeNull();
    expect(state.encounter?.hp).toBe(state.encounter?.maxHp);
    expect(state.encounter?.fleesAt).toBe(NOW + BALANCE.capture.encounterMs);
  });

  it('solo toca aparición si no hay nadie y se cumplió la espera', () => {
    expect(isSpawnDue(withState({ nextSpawnAt: NOW }), NOW)).toBe(true);
    expect(isSpawnDue(withState({ nextSpawnAt: NOW + 1 }), NOW)).toBe(false);
    expect(isSpawnDue(withState({ nextSpawnAt: 0, encounter: encounterOf('brotillo') }), NOW)).toBe(
      false,
    );
  });

  it('la salvaje huye cuando se le acaba el tiempo', () => {
    const state = withState({ encounter: encounterOf('brotillo') });
    expect(hasEncounterExpired(state, NOW)).toBe(false);
    expect(hasEncounterExpired(state, NOW + BALANCE.capture.encounterMs)).toBe(true);
  });

  it('al limpiar la aparición se programa la siguiente', () => {
    const state = clearEncounter(
      withState({ encounter: encounterOf('brotillo') }),
      NOW,
      createRng(3),
    );
    expect(state.encounter).toBeNull();
    expect(state.nextSpawnAt).toBeGreaterThanOrEqual(NOW + BALANCE.capture.spawnMinMs);
  });

  it('la variocolor sale 1 de cada 500', () => {
    const rng = createRng(11);
    let shinies = 0;
    for (let i = 0; i < 20_000; i += 1) if (rollShiny(rng)) shinies += 1;
    expect(shinies).toBeGreaterThan(10);
    expect(shinies).toBeLessThan(70);
  });

  it('el rasgo sale del catálogo y puede ser cualquiera', () => {
    const rng = createRng(13);
    const seen = new Set(Array.from({ length: 300 }, () => rollTrait(rng)));
    expect([...seen].sort()).toEqual([...TRAIT_IDS].sort());
  });
});

describe('debilitar a clics', () => {
  it('cada golpe quita PV', () => {
    const state = withState({ encounter: encounterOf('brotillo') });
    expect(damageEncounter(state, 4).encounter?.hp).toBe(11);
  });

  it('nunca baja de cero', () => {
    const state = withState({ encounter: encounterOf('brotillo') });
    expect(damageEncounter(state, 999).encounter?.hp).toBe(0);
  });

  it('sin salvaje o sin daño no cambia nada', () => {
    expect(damageEncounter(base, 5)).toBe(base);
    const state = withState({ encounter: encounterOf('brotillo') });
    expect(damageEncounter(state, 0)).toBe(state);
  });
});

describe('probabilidad de captura', () => {
  it('a PV llenos es la base de la rareza por el orbe', () => {
    expect(captureChance(encounterOf('brotillo'), 'basic')).toBeCloseTo(0.4, 5);
    expect(captureChance(encounterOf('ascuin'), 'basic')).toBeCloseTo(0.25, 5);
  });

  it('debilitar la sube hasta 2,5 veces', () => {
    // Con una poco común no llega al tope, así que se ve la fórmula entera.
    const full = captureChance(encounterOf('ascuin'), 'basic');
    const drained = captureChance(encounterOf('ascuin', 0), 'basic');
    expect(drained).toBeCloseTo(full * (1 + BALANCE.capture.weakenWeight), 5);
    expect(drained).toBeCloseTo(0.625, 5);
  });

  it('a media vida la subida es proporcional al daño hecho', () => {
    const species = getSpecies('ascuin');
    const half = captureChance(encounterOf('ascuin', wildHp(species) / 2), 'basic');
    expect(half).toBeCloseTo(0.25 * (1 + BALANCE.capture.weakenWeight * 0.5), 5);
  });

  it('el orbe de red vale el doble contra las de Agua', () => {
    const against = captureChance(encounterOf('goton'), 'net');
    const normal = captureChance(encounterOf('musgolito'), 'net');
    expect(against / BALANCE.rarity.common.captureBase).toBeCloseTo(
      ORBS.net.againstType?.multiplier ?? 0,
      5,
    );
    expect(normal / BALANCE.rarity.common.captureBase).toBeCloseTo(ORBS.net.multiplier, 5);
  });

  it('nunca pasa del 95 %', () => {
    expect(captureChance(encounterOf('brotillo', 0), 'lunar')).toBe(
      BALANCE.capture.maxCaptureChance,
    );
  });
});

describe('lanzar el orbe', () => {
  const ready = withState({ encounter: encounterOf('brotillo'), orbs: { basic: 3 } });

  it('captura cuando el azar acompaña', () => {
    const result = throwOrb(ready, 'basic', NOW, fakeRng([0]));
    expect(result.captured).toBe(true);
    expect(result.creature?.speciesId).toBe('brotillo');
    expect(result.state.encounter).toBeNull();
    expect(orbCount(result.state, 'basic')).toBe(2);
    expect(result.xpGained).toBe(BALANCE.rarity.common.captureXp);
  });

  it('gasta el orbe también cuando falla', () => {
    const result = throwOrb(ready, 'basic', NOW, fakeRng([0.99]));
    expect(result.captured).toBe(false);
    expect(orbCount(result.state, 'basic')).toBe(2);
  });

  it('tras fallar, la criatura puede quedarse o huir', () => {
    const stays = throwOrb(ready, 'basic', NOW, fakeRng([0.99, 0.99]));
    expect(stays.fled).toBe(false);
    expect(stays.state.encounter).not.toBeNull();

    const flees = throwOrb(ready, 'basic', NOW, fakeRng([0.99, 0]));
    expect(flees.fled).toBe(true);
    expect(flees.state.encounter).toBeNull();
  });

  it('no se puede lanzar sin salvaje, sin orbes o con un orbe bloqueado', () => {
    expect(throwOrb(withState({ orbs: { basic: 1 } }), 'basic', NOW, createRng(1)).failure).toBe(
      'no-encounter',
    );
    expect(
      throwOrb(withState({ encounter: encounterOf('brotillo') }), 'basic', NOW, createRng(1))
        .failure,
    ).toBe('no-orbs');
    expect(
      throwOrb(
        withState({ encounter: encounterOf('brotillo'), orbs: { lunar: 1 } }),
        'lunar',
        NOW,
        createRng(1),
      ).failure,
    ).toBe('locked');
  });

  it('un intento fallido no toca el estado anterior', () => {
    const snapshot = structuredClone(ready);
    throwOrb(ready, 'basic', NOW, fakeRng([0.99, 0.99]));
    expect(ready).toEqual(snapshot);
  });

  it('es determinista con la misma semilla', () => {
    const first = throwOrb(ready, 'basic', NOW, createRng(99));
    const second = throwOrb(ready, 'basic', NOW, createRng(99));
    expect(first.captured).toBe(second.captured);
    expect(first.state).toEqual(second.state);
  });
});

describe('Rancho y Reserva', () => {
  it('los primeros ejemplares ocupan las plazas del Rancho', () => {
    let state: GameState = base;
    for (let i = 0; i < BALANCE.ranch.startingSlots; i += 1) {
      state = addCapturedCreature(state, 'brotillo', false, NOW, createRng(i)).state;
    }
    expect(creaturesInRanch(state)).toHaveLength(BALANCE.ranch.startingSlots);
    expect(creaturesInReserve(state)).toHaveLength(0);
  });

  it('cuando el Rancho se llena, el resto va a la Reserva', () => {
    let state: GameState = base;
    for (let i = 0; i < ranchSlots(base) + 3; i += 1) {
      state = addCapturedCreature(state, 'pelusin', false, NOW, createRng(i)).state;
    }
    expect(creaturesInRanch(state)).toHaveLength(ranchSlots(base));
    expect(creaturesInReserve(state)).toHaveLength(3);
  });

  it('cada ejemplar nace a nivel 1, saciado y con uid propio', () => {
    const first = addCapturedCreature(base, 'brotillo', true, NOW, createRng(1));
    const second = addCapturedCreature(first.state, 'pelusin', false, NOW, createRng(2));
    expect(first.creature.level).toBe(1);
    expect(first.creature.satiety).toBe(100);
    expect(first.creature.shiny).toBe(true);
    expect(second.creature.uid).not.toBe(first.creature.uid);
  });
});

describe('catálogo de criaturas', () => {
  it('tiene 12 capturables y 3 jefes', () => {
    expect(SPECIES_LIST.filter((species) => !species.isBoss)).toHaveLength(12);
    expect(SPECIES_LIST.filter((species) => species.isBoss)).toHaveLength(3);
  });

  it('cada zona tiene cuatro salvajes', () => {
    expect(wildRosterOf('meadow')).toHaveLength(4);
    expect(wildRosterOf('cave')).toHaveLength(4);
    expect(wildRosterOf('lake')).toHaveLength(4);
  });

  it('todas tienen entre una y tres aptitudes, de 1 a 3 puntos', () => {
    for (const species of SPECIES_LIST) {
      const values = Object.values(species.skills);
      expect(values.length).toBeGreaterThanOrEqual(1);
      expect(values.length).toBeLessThanOrEqual(3);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(3);
      }
    }
  });

  it('los jefes son legendarios y no aparecen como salvajes', () => {
    for (const species of SPECIES_LIST.filter((candidate) => candidate.isBoss)) {
      expect(species.rarity).toBe('legendary');
      expect(BALANCE.rarity.legendary.spawnWeight).toBe(0);
    }
  });
});
