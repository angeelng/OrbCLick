import { describe, expect, it } from 'vitest';
import {
  addToTeam,
  advanceBattle,
  attackIntervalMs,
  clickEnemy,
  creatureStats,
  damageOf,
  fleeBattle,
  isExhausted,
  removeFromTeam,
  startBattle,
  statsAtLevel,
  teamCreatures,
  teamSlots,
  typeMultiplier,
  useAbility,
  useBerry,
} from '../src/core/combat';
import { createRng, type Rng } from '../src/core/rng';
import { createInitialState, type CapturedCreature, type GameState } from '../src/core/state';
import { BALANCE } from '../src/data/balance';
import { SPECIES_LIST, getSpecies, type SpeciesId } from '../src/data/species';
import { wildHp } from '../src/core/capture';

/** Saca el valor o revienta el test: evita el operador `!`, prohibido aquí. */
function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('faltaba un valor en el test');
  return value;
}

const NOW = 1_000_000;
const base = createInitialState(NOW, 1);

function withState(overrides: Partial<GameState>): GameState {
  return { ...base, ...overrides };
}

let nextUid = 1;

function creature(
  speciesId: SpeciesId,
  overrides: Partial<CapturedCreature> = {},
): CapturedCreature {
  return {
    uid: nextUid++,
    speciesId,
    level: 1,
    xp: 0,
    traitId: 'brave',
    shiny: false,
    satiety: 100,
    location: 'ranch',
    postId: null,
    exhaustedUntil: 0,
    capturedAt: NOW,
    ...overrides,
  };
}

/**
 * Enemigo de saco: muchos PV y sin pegada, para que el combate no se acabe
 * mientras se prueban las habilidades.
 */
function tough(state: GameState): GameState {
  return {
    ...state,
    battle: { ...must(state.battle), enemyHp: 99_999, enemyMaxHp: 99_999, enemyAtk: 0 },
  };
}

/** Entrenador de nivel alto: las tres plazas de equipo abiertas. */
function ready(creatures: readonly CapturedCreature[], encounter = true): GameState {
  const species = 'brotillo';
  const hp = wildHp(getSpecies(species));
  return withState({
    trainer: { level: 15, xp: 0 },
    creatures,
    team: creatures.map((c) => c.uid),
    encounter: encounter
      ? {
          speciesId: species,
          hp,
          maxHp: hp,
          shiny: false,
          appearedAt: NOW,
          fleesAt: NOW + 600_000,
        }
      : null,
  });
}

describe('tabla de tipos', () => {
  it('sigue el GDD: Planta pega fuerte a Agua y Roca', () => {
    expect(typeMultiplier('plant', 'water')).toBe(BALANCE.combat.typeStrong);
    expect(typeMultiplier('plant', 'rock')).toBe(BALANCE.combat.typeStrong);
  });

  it('el reverso resiste', () => {
    expect(typeMultiplier('water', 'plant')).toBe(BALANCE.combat.typeWeak);
    expect(typeMultiplier('fire', 'water')).toBe(BALANCE.combat.typeWeak);
  });

  it('entre tipos sin relación el daño es normal', () => {
    expect(typeMultiplier('plant', 'electric')).toBe(1);
    expect(typeMultiplier('air', 'water')).toBe(1);
  });

  it('ningún tipo es fuerte contra sí mismo', () => {
    for (const species of SPECIES_LIST) {
      expect(typeMultiplier(species.type, species.type)).toBe(1);
    }
  });
});

describe('estadísticas y daño', () => {
  it('cada nivel suma un 8 % a las bases', () => {
    const level5 = statsAtLevel({ hp: 100, atk: 100, def: 100, spd: 100 }, 5);
    expect(level5.atk).toBe(Math.round(100 * (1 + BALANCE.combat.statPerLevel * 4)));
  });

  it('el rasgo Valiente pega más y Robusta aguanta más', () => {
    const valiente = creatureStats(creature('chispin', { traitId: 'brave' }));
    const robusta = creatureStats(creature('chispin', { traitId: 'sturdy' }));
    const neutral = creatureStats(creature('chispin', { traitId: 'lazy' }));
    expect(valiente.atk).toBeGreaterThan(neutral.atk);
    expect(robusta.hp).toBeGreaterThan(neutral.hp);
  });

  it('el daño sigue D = ATQ · ATQ/(ATQ+DEF) · t · v', () => {
    expect(damageOf(20, 20, 1, 1)).toBe(10);
    expect(damageOf(20, 20, BALANCE.combat.typeStrong, 1)).toBe(15);
  });

  it('nunca baja de uno, por mucha defensa que haya', () => {
    expect(damageOf(1, 10_000, BALANCE.combat.typeWeak, 0.9)).toBe(BALANCE.combat.minDamage);
  });

  it('el ritmo de ataque es 2 / (1 + VEL/100) segundos', () => {
    expect(attackIntervalMs(0)).toBe(BALANCE.combat.attackBaseMs);
    expect(attackIntervalMs(100)).toBe(BALANCE.combat.attackBaseMs / 2);
  });

  it('todas las especies traen sus cuatro estadísticas y su habilidad', () => {
    for (const species of SPECIES_LIST) {
      for (const value of Object.values(species.stats)) {
        expect(value, species.id).toBeGreaterThan(0);
      }
      expect(species.ability.chargeMs, species.id).toBeGreaterThanOrEqual(10_000);
      expect(species.ability.chargeMs, species.id).toBeLessThanOrEqual(20_000);
    }
  });

  it('las legendarias son más fuertes que las comunes', () => {
    const comun = getSpecies('brotillo').stats;
    const legendaria = getSpecies('cornavid').stats;
    expect(legendaria.hp).toBeGreaterThan(comun.hp * 2);
    expect(legendaria.atk).toBeGreaterThan(comun.atk * 2);
  });
});

describe('equipo', () => {
  it('las plazas se abren a los niveles del GDD', () => {
    expect(teamSlots(base)).toBe(0);
    expect(teamSlots(withState({ trainer: { level: 3, xp: 0 } }))).toBe(1);
    expect(teamSlots(withState({ trainer: { level: 6, xp: 0 } }))).toBe(2);
    expect(teamSlots(withState({ trainer: { level: 8, xp: 0 } }))).toBe(3);
  });

  it('entrar al equipo deja el puesto del Rancho', () => {
    const bicho = creature('chispin', { postId: 'gather' });
    const state = withState({ trainer: { level: 8, xp: 0 }, creatures: [bicho] });
    const result = addToTeam(state, bicho.uid, NOW);
    expect(result.changed).toBe(true);
    expect(result.state.creatures[0]?.postId).toBeNull();
    expect(teamCreatures(result.state)).toHaveLength(1);
  });

  it('no caben más de las plazas abiertas', () => {
    const bichos = [creature('chispin'), creature('goton')];
    let state = withState({ trainer: { level: 3, xp: 0 }, creatures: bichos });
    state = addToTeam(state, must(bichos[0]).uid, NOW).state;
    expect(addToTeam(state, must(bichos[1]).uid, NOW).failure).toBe('team-full');
  });

  it('sin nivel 3 no hay equipo', () => {
    const bicho = creature('chispin');
    expect(addToTeam(withState({ creatures: [bicho] }), bicho.uid, NOW).failure).toBe('no-slots');
  });

  it('una criatura agotada no entra', () => {
    const bicho = creature('chispin', { exhaustedUntil: NOW + 10_000 });
    const state = withState({ trainer: { level: 8, xp: 0 }, creatures: [bicho] });
    expect(addToTeam(state, bicho.uid, NOW).failure).toBe('exhausted');
    expect(isExhausted(bicho, NOW)).toBe(true);
    expect(isExhausted(bicho, NOW + 20_000)).toBe(false);
  });

  it('salir del equipo lo deja libre', () => {
    const bicho = creature('chispin');
    const state = addToTeam(
      withState({ trainer: { level: 8, xp: 0 }, creatures: [bicho] }),
      bicho.uid,
      NOW,
    ).state;
    expect(removeFromTeam(state, bicho.uid).state.team).toHaveLength(0);
  });
});

describe('combate', () => {
  const rng = (): Rng => createRng(7);

  it('no empieza sin equipo ni sin salvaje', () => {
    expect(startBattle(ready([]), NOW).failure).toBe('no-team');
    expect(startBattle(ready([creature('chispin')], false), NOW).failure).toBe('no-encounter');
  });

  it('no empieza si la salvaje ya está debilitada ni con el equipo agotado', () => {
    const base = ready([creature('chispin')]);
    const debilitada = {
      ...base,
      encounter: base.encounter === null ? null : { ...base.encounter, hp: 0 },
    };
    expect(startBattle(debilitada, NOW).failure).toBe('weakened');
    expect(
      startBattle(ready([creature('chispin', { exhaustedUntil: NOW + 10_000 })]), NOW).failure,
    ).toBe('no-team');
  });

  it('arranca con el equipo a tope de PV y el enemigo con los suyos', () => {
    const bicho = creature('chispin');
    const result = startBattle(ready([bicho]), NOW);
    expect(result.started).toBe(true);
    const battle = result.state.battle;
    expect(battle?.team[0]?.hp).toBe(creatureStats(bicho).hp);
    expect(battle?.enemyHp).toBe(wildHp(getSpecies('brotillo')));
  });

  it('el equipo pega solo según pasa el tiempo', () => {
    const state = startBattle(ready([creature('chispin')]), NOW).state;
    const antes = state.battle?.enemyHp ?? 0;
    const step = advanceBattle(state, NOW + 5000, rng());
    expect(step.state.battle?.enemyHp ?? 0).toBeLessThan(antes);
  });

  it('ganar deja a la salvaje debilitada para el orbe', () => {
    let state = startBattle(ready([creature('chispin'), creature('cuarzin')]), NOW).state;
    let outcome = null;
    for (let i = 1; i <= 60 && outcome === null; i += 1) {
      const step = advanceBattle(state, NOW + i * 1000, rng());
      state = step.state;
      outcome = step.outcome;
    }
    expect(outcome).toBe('won');
    expect(state.battle).toBeNull();
    expect(state.encounter?.hp).toBe(0);
  });

  it('quien cae queda agotado dos minutos y sale del equipo', () => {
    // Un Pelusín de nivel 1 contra un enemigo con mucha pegada.
    const debil = creature('pelusin');
    let state = startBattle(ready([debil]), NOW).state;
    state = {
      ...state,
      battle: { ...must(state.battle), enemyAtk: 400, enemyHp: 9999, enemyMaxHp: 9999 },
    };
    let outcome = null;
    for (let i = 1; i <= 60 && outcome === null; i += 1) {
      const step = advanceBattle(state, NOW + i * 1000, rng());
      state = step.state;
      outcome = step.outcome;
    }
    expect(outcome).toBe('lost');
    expect(state.team).toHaveLength(0);
    // Dos minutos contados desde que cayó, no desde que empezó el combate.
    expect(state.creatures[0]?.exhaustedUntil).toBeGreaterThanOrEqual(
      NOW + BALANCE.combat.exhaustionMs,
    );
    expect(isExhausted(must(state.creatures[0]), NOW)).toBe(true);
  });

  it('el clic del jugador hace daño y carga la barra', () => {
    const state = startBattle(ready([creature('chispin')]), NOW).state;
    const next = clickEnemy(state, 5);
    expect(next.battle?.enemyHp).toBe((state.battle?.enemyHp ?? 0) - 5);
    expect(next.battle?.team[0]?.charge).toBeCloseTo(BALANCE.combat.clickChargePercent, 5);
  });

  it('la barra se llena sola con el tiempo', () => {
    const state = tough(startBattle(ready([creature('chispin')]), NOW).state);
    const charge = getSpecies('chispin').ability.chargeMs;
    const step = advanceBattle(state, NOW + charge, rng());
    expect(step.state.battle?.team[0]?.charge).toBe(1);
  });

  it('la habilidad exige la barra llena y la vacía al usarla', () => {
    let state = tough(startBattle(ready([creature('chispin')]), NOW).state);
    const uid = must(must(state.battle).team[0]).uid;
    expect(useAbility(state, uid, NOW, rng()).failure).toBe('not-charged');

    state = advanceBattle(state, NOW + 20_000, rng()).state;
    const antes = state.battle?.enemyHp ?? 0;
    const result = useAbility(state, uid, NOW + 20_000, rng());
    expect(result.used).toBe(true);
    expect(result.state.battle?.enemyHp ?? 0).toBeLessThan(antes);
    expect(result.state.battle?.team[0]?.charge).toBe(0);
  });

  it('las habilidades de cura y escudo tocan al equipo, no al enemigo', () => {
    let state = tough(startBattle(ready([creature('nenufrel'), creature('cuarzin')]), NOW).state);
    state = advanceBattle(state, NOW + 20_000, rng()).state;
    const herido = must(state.battle).team.map((b) => ({ ...b, hp: 1 }));
    state = { ...state, battle: { ...must(state.battle), team: herido } };

    const curado = useAbility(state, must(herido[0]).uid, NOW + 20_000, rng());
    expect(curado.state.battle?.team[0]?.hp ?? 0).toBeGreaterThan(1);

    const escudado = useAbility(state, must(herido[1]).uid, NOW + 20_000, rng());
    expect(escudado.state.battle?.team[1]?.shieldUntil ?? 0).toBeGreaterThan(NOW);
  });

  it('adormecer retrasa el golpe del enemigo', () => {
    let state = tough(startBattle(ready([creature('musgolito')]), NOW).state);
    state = advanceBattle(state, NOW + 20_000, rng()).state;
    const result = useAbility(state, must(must(state.battle).team[0]).uid, NOW + 20_000, rng());
    expect(result.state.battle?.enemyAsleepUntil ?? 0).toBeGreaterThan(NOW + 20_000);
  });

  it('las bayas curan el 30 %, gastan una y no pasan de tres', () => {
    const state0 = startBattle(ready([creature('cuarzin')]), NOW).state;
    const uid = must(must(state0.battle).team[0]).uid;
    let state: GameState = {
      ...state0,
      berries: 10,
      battle: { ...must(state0.battle), team: [{ ...must(must(state0.battle).team[0]), hp: 1 }] },
    };

    const result = useBerry(state, uid);
    expect(result.used).toBe(true);
    expect(result.state.berries).toBe(9);
    expect(result.state.battle?.team[0]?.hp ?? 0).toBeGreaterThan(1);

    state = result.state;
    state = useBerry(state, uid).state;
    state = useBerry(state, uid).state;
    expect(useBerry(state, uid).failure).toBe('limit');
  });

  it('sin bayas no se puede curar', () => {
    const state = { ...startBattle(ready([creature('cuarzin')]), NOW).state, berries: 0 };
    expect(useBerry(state, must(must(state.battle).team[0]).uid).failure).toBe('no-berries');
  });

  it('huir cierra el combate y deja la salvaje donde estaba', () => {
    const state = startBattle(ready([creature('chispin')]), NOW).state;
    const next = fleeBattle(state);
    expect(next.battle).toBeNull();
    expect(next.encounter).not.toBeNull();
  });

  it('es determinista con la misma semilla', () => {
    const state = startBattle(ready([creature('chispin')]), NOW).state;
    const a = advanceBattle(state, NOW + 7000, createRng(99));
    const b = advanceBattle(state, NOW + 7000, createRng(99));
    expect(a.state.battle).toEqual(b.state.battle);
  });

  it('no muta el estado anterior', () => {
    const state = startBattle(ready([creature('chispin')]), NOW).state;
    const snapshot = structuredClone(state);
    advanceBattle(state, NOW + 9000, rng());
    expect(state).toEqual(snapshot);
  });
});
