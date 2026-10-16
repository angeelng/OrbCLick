import { describe, expect, it } from 'vitest';
import {
  activeSynergies,
  advanceRanch,
  assignToPost,
  creatureOutput,
  creatureXpForNextLevel,
  creaturesAtPost,
  creaturesInRanch,
  grantCreatureXp,
  isPostUnlocked,
  offlineProgress,
  postOutput,
  postUpgradePrice,
  ranchProduction,
  ranchSlotPrice,
  ranchSlots,
  satietyFactor,
  sendToReserve,
  skillAt,
  zoneTypeBonus,
} from '../src/core/ranch';
import { coinsPerClick } from '../src/core/economy';
import { tick } from '../src/core/engine';
import { createRng } from '../src/core/rng';
import { createInitialState, type CapturedCreature, type GameState } from '../src/core/state';
import { BALANCE } from '../src/data/balance';
import { POST_LIST } from '../src/data/posts';
import type { SpeciesId } from '../src/data/species';

const NOW = 1_000_000;
const MINUTE = 60_000;
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

/** Entrenador de nivel alto: así todos los puestos están abiertos. */
function veteran(creatures: readonly CapturedCreature[]): GameState {
  return withState({ trainer: { level: 15, xp: 0 }, creatures });
}

describe('plazas del Rancho', () => {
  it('empieza con las plazas del GDD y crece con las compradas', () => {
    expect(ranchSlots(base)).toBe(BALANCE.ranch.startingSlots);
    expect(ranchSlots(withState({ extraRanchSlots: 3 }))).toBe(BALANCE.ranch.startingSlots + 3);
  });

  it('no pasa del tope de 16', () => {
    expect(ranchSlots(withState({ extraRanchSlots: 99 }))).toBe(BALANCE.ranch.maxSlots);
  });

  it('cada plaza extra cuesta 500 · 2^k', () => {
    expect(ranchSlotPrice(base)).toBe(500);
    expect(ranchSlotPrice(withState({ extraRanchSlots: 1 }))).toBe(1_000);
    expect(ranchSlotPrice(withState({ extraRanchSlots: 3 }))).toBe(4_000);
  });
});

describe('puestos y asignación', () => {
  it('cada puesto abre al nivel que dice el GDD', () => {
    expect(isPostUnlocked(base, 'gather')).toBe(true);
    expect(isPostUnlocked(base, 'farm')).toBe(false);
    expect(isPostUnlocked(withState({ trainer: { level: 2, xp: 0 } }), 'farm')).toBe(true);
    expect(isPostUnlocked(withState({ trainer: { level: 9, xp: 0 } }), 'care')).toBe(true);
  });

  it('asigna una criatura a un puesto abierto', () => {
    const bicho = creature('pelusin');
    const result = assignToPost(withState({ creatures: [bicho] }), bicho.uid, 'gather');
    expect(result.assigned).toBe(true);
    expect(creaturesAtPost(result.state, 'gather')).toHaveLength(1);
  });

  it('no asigna a un puesto que aún no está abierto', () => {
    const bicho = creature('brotillo');
    const result = assignToPost(withState({ creatures: [bicho] }), bicho.uid, 'farm');
    expect(result.failure).toBe('locked-post');
  });

  it('una criatura de la Reserva entra al Rancho si queda sitio', () => {
    const bicho = creature('pelusin', { location: 'reserve' });
    const result = assignToPost(withState({ creatures: [bicho] }), bicho.uid, 'gather');
    expect(result.assigned).toBe(true);
    expect(result.state.creatures[0]?.location).toBe('ranch');
  });

  it('con el Rancho lleno, la de la Reserva se queda fuera', () => {
    const dentro = Array.from({ length: BALANCE.ranch.startingSlots }, () => creature('pelusin'));
    const fuera = creature('pelusin', { location: 'reserve' });
    const result = assignToPost(withState({ creatures: [...dentro, fuera] }), fuera.uid, 'gather');
    expect(result.failure).toBe('ranch-full');
  });

  it('mandar a la Reserva libera plaza y puesto', () => {
    const bicho = creature('pelusin', { postId: 'gather' });
    const result = sendToReserve(withState({ creatures: [bicho] }), bicho.uid);
    expect(result.state.creatures[0]).toMatchObject({ location: 'reserve', postId: null });
    expect(creaturesInRanch(result.state)).toHaveLength(0);
  });

  it('avisa si la criatura no existe', () => {
    expect(assignToPost(base, 999, 'gather').failure).toBe('unknown-creature');
    expect(sendToReserve(base, 999).failure).toBe('unknown-creature');
  });

  it('cada mejora de puesto dobla su precio, hasta tres niveles', () => {
    const state = veteran([]);
    expect(postUpgradePrice(state, 'gather')).toBe(750);
    expect(postUpgradePrice({ ...state, postUpgrades: { gather: 1 } }, 'gather')).toBe(1_500);
    expect(postUpgradePrice({ ...state, postUpgrades: { gather: 2 } }, 'gather')).toBe(3_000);
  });
});

describe('rendimiento de una criatura', () => {
  it('solo aporta en el puesto que encaja con su aptitud', () => {
    const chispin = creature('chispin');
    expect(skillAt(chispin, 'gather')).toBe(2);
    expect(skillAt(chispin, 'mine')).toBe(0);
    expect(creatureOutput(base, chispin, 'mine')).toBe(0);
  });

  it('la saciedad sigue los tramos del GDD', () => {
    expect(satietyFactor(100)).toBe(1);
    expect(satietyFactor(51)).toBe(1);
    expect(satietyFactor(50)).toBe(BALANCE.ranch.satietyLowFactor);
    expect(satietyFactor(1)).toBe(BALANCE.ranch.satietyLowFactor);
    expect(satietyFactor(0)).toBe(0);
  });

  it('una criatura en ayunas no produce nada', () => {
    const hambrienta = creature('chispin', { satiety: 0 });
    expect(creatureOutput(base, hambrienta, 'gather')).toBe(0);
  });

  it('cada nivel suma un 5 %', () => {
    const nivel1 = creature('chispin');
    const nivel5 = creature('chispin', { level: 5 });
    expect(
      creatureOutput(base, nivel5, 'gather') / creatureOutput(base, nivel1, 'gather'),
    ).toBeCloseTo(1 + BALANCE.ranch.levelProductionBonus * 4, 6);
  });

  it('el rasgo y el variocolor multiplican', () => {
    const normal = creature('chispin', { traitId: 'brave' });
    const laboriosa = creature('chispin', { traitId: 'hardworking' });
    const perezosa = creature('chispin', { traitId: 'lazy' });
    const variocolor = creature('chispin', { shiny: true });
    const referencia = creatureOutput(base, normal, 'gather');

    expect(creatureOutput(base, laboriosa, 'gather')).toBeCloseTo(referencia * 1.1, 6);
    expect(creatureOutput(base, perezosa, 'gather')).toBeCloseTo(referencia * 0.95, 6);
    expect(creatureOutput(base, variocolor, 'gather')).toBeCloseTo(referencia * 2, 6);
  });

  it('el tipo favorecido de la zona da +25 %', () => {
    expect(zoneTypeBonus(base, 'plant')).toBe(BALANCE.zone.favoredTypeMultiplier);
    expect(zoneTypeBonus(base, 'fire')).toBe(1);
  });

  it('la mejora de puesto suma +25 % por nivel', () => {
    const state = veteran([creature('chispin', { postId: 'gather' })]);
    const sinMejora = postOutput(state, 'gather');
    const conMejora = postOutput({ ...state, postUpgrades: { gather: 2 } }, 'gather');
    expect(conMejora / sinMejora).toBeCloseTo(1 + BALANCE.ranch.postUpgradeBonus * 2, 6);
  });
});

describe('producción del Rancho', () => {
  it('el CPS sigue la fórmula del GDD: 0,5 por punto de aptitud', () => {
    const state = veteran([creature('chispin', { postId: 'gather' })]);
    expect(ranchProduction(state).cps).toBeCloseTo(2 * BALANCE.ranch.output.cpsPerSkill, 6);
  });

  it('un Rancho vacío no produce nada', () => {
    const production = ranchProduction(base);
    expect(production.cps).toBe(0);
    expect(production.berriesPerMinute).toBe(0);
    expect(production.miningBonus).toBe(0);
  });

  it('la Mina sube el bonus de minería y el Huerto da bayas', () => {
    const state = veteran([
      creature('pedrusco', { postId: 'mine' }),
      creature('brotillo', { postId: 'farm' }),
    ]);
    const production = ranchProduction(state);
    expect(production.miningBonus).toBeGreaterThan(0);
    expect(production.berriesPerMinute).toBeGreaterThan(0);
  });

  it('el Taller descuenta orbes, con tope', () => {
    const uno = veteran([creature('nenufrel', { postId: 'craft' })]);
    expect(ranchProduction(uno).orbDiscount).toBeGreaterThan(0);

    const muchos = veteran(
      Array.from({ length: 10 }, () => creature('nenufrel', { postId: 'craft' })),
    );
    expect(ranchProduction(muchos).orbDiscount).toBe(BALANCE.ranch.output.maxOrbDiscount);
  });

  it('la exploración acorta la espera, con tope', () => {
    const muchos = veteran(
      Array.from({ length: 40 }, () => creature('pelusin', { postId: 'explore' })),
    );
    expect(ranchProduction(muchos).spawnSpeedBonus).toBe(BALANCE.ranch.output.maxSpawnSpeed);
  });

  it('un puesto cerrado no produce aunque haya alguien dentro', () => {
    const state = withState({ creatures: [creature('brotillo', { postId: 'farm' })] });
    expect(postOutput(state, 'farm')).toBe(0);
  });
});

describe('sinergias', () => {
  it('Agua + Planta dan bayas, y cada par cuenta una vez', () => {
    const state = veteran([creature('goton'), creature('brotillo'), creature('ranaflor')]);
    const synergies = activeSynergies(state);
    expect(synergies).toHaveLength(1);
    expect(synergies[0]?.effect).toBe('berries');
  });

  it('Fuego + Roca mejoran la minería y Eléctrico + Aire el CPS', () => {
    const state = veteran([
      creature('ascuin'),
      creature('pedrusco'),
      creature('chispin'),
      creature('pelusin'),
    ]);
    const effects = activeSynergies(state).map((synergy) => synergy.effect);
    expect(effects).toContain('mining');
    expect(effects).toContain('cps');
  });

  it('la sinergia se nota en la producción', () => {
    const solos = veteran([creature('chispin', { postId: 'gather' })]);
    const conPareja = veteran([
      creature('chispin', { postId: 'gather' }),
      creature('pelusin', { postId: 'gather' }),
    ]);
    const esperado = (ranchProduction(solos).cps + 1 * BALANCE.ranch.output.cpsPerSkill) * 1.1;
    expect(ranchProduction(conPareja).cps).toBeCloseTo(esperado, 5);
  });

  it('las de la Reserva no cuentan para la sinergia', () => {
    const state = veteran([creature('goton', { location: 'reserve' }), creature('brotillo')]);
    expect(activeSynergies(state)).toHaveLength(0);
  });
});

describe('niveles de criatura', () => {
  it('la curva es 50 · 1,4^(L−1)', () => {
    expect(creatureXpForNextLevel(1)).toBe(50);
    expect(creatureXpForNextLevel(2)).toBe(70);
    expect(creatureXpForNextLevel(3)).toBe(98);
  });

  it('sube de nivel y guarda el resto', () => {
    const result = grantCreatureXp(creature('brotillo'), 60);
    expect(result.levelsGained).toBe(1);
    expect(result.creature.level).toBe(2);
    expect(result.creature.xp).toBe(10);
  });

  it('se para en el nivel máximo', () => {
    const result = grantCreatureXp(creature('brotillo'), 1e9);
    expect(result.creature.level).toBe(BALANCE.ranch.maxCreatureLevel);
    expect(grantCreatureXp(result.creature, 1_000).levelsGained).toBe(0);
  });
});

describe('avance del Rancho', () => {
  const trabajando = (): GameState =>
    veteran([creature('chispin', { postId: 'gather' }), creature('brotillo', { postId: 'farm' })]);

  it('produce monedas según CPS × monedas por clic', () => {
    const state = trabajando();
    const { cps } = ranchProduction(state);
    const step = advanceRanch(state, 10_000, 3);
    expect(step.gains.coins).toBeCloseTo(cps * 10 * 3, 6);
    expect(step.state.coins).toBeCloseTo(cps * 10 * 3, 6);
  });

  it('cosecha bayas en el Huerto', () => {
    const state = trabajando();
    const step = advanceRanch(state, MINUTE, 1);
    expect(step.gains.berries).toBeCloseTo(ranchProduction(state).berriesPerMinute, 6);
  });

  it('la saciedad baja un punto por minuto trabajando', () => {
    const state = veteran([creature('chispin', { postId: 'gather' })]);
    const step = advanceRanch(state, 10 * MINUTE, 1);
    // Sin bayas en el almacén nadie come, así que se ve la bajada limpia.
    expect(step.state.creatures[0]?.satiety).toBeCloseTo(90, 6);
  });

  it('quien no tiene puesto no gasta saciedad', () => {
    const state = veteran([creature('chispin')]);
    const step = advanceRanch(state, 30 * MINUTE, 1);
    expect(step.state.creatures[0]?.satiety).toBe(100);
  });

  it('el comedero reparte bayas en cuanto alguien baja del umbral', () => {
    const state = veteran([creature('chispin', { postId: 'gather', satiety: 51 })]);
    const step = advanceRanch({ ...state, berries: 5 }, 2 * MINUTE, 1);
    expect(step.gains.berriesEaten).toBe(1);
    expect(step.state.berries).toBe(4);
    expect(step.state.creatures[0]?.satiety).toBeGreaterThan(50);
  });

  it('la Glotona gasta el doble de saciedad', () => {
    const normal = veteran([creature('chispin', { postId: 'gather', traitId: 'brave' })]);
    const glotona = veteran([creature('chispin', { postId: 'gather', traitId: 'greedy' })]);
    const a = advanceRanch(normal, 10 * MINUTE, 1).state.creatures[0]?.satiety ?? 0;
    const b = advanceRanch(glotona, 10 * MINUTE, 1).state.creatures[0]?.satiety ?? 0;
    expect(100 - b).toBeCloseTo((100 - a) * 2, 6);
  });

  it('la Guardería reparte XP y puede subir niveles', () => {
    const state = veteran([
      creature('nenufrel', { postId: 'care' }),
      creature('chispin', { postId: 'gather' }),
    ]);
    const step = advanceRanch(state, 60 * MINUTE, 1);
    expect(step.gains.creatureXp).toBeGreaterThan(0);
    expect(step.state.creatures[1]?.level).toBeGreaterThan(1);
  });

  it('el Taller fabrica orbes enteros y guarda la fracción pendiente', () => {
    const state = veteran([creature('nenufrel', { postId: 'craft' })]);
    const corto = advanceRanch(state, MINUTE, 1);
    expect(corto.gains.orbs).toBe(0);
    expect(corto.state.orbProgress).toBeGreaterThan(0);

    const largo = advanceRanch(state, 60 * MINUTE, 1);
    expect(largo.gains.orbs).toBeGreaterThan(0);
    expect(largo.state.orbs.basic).toBe(largo.gains.orbs);
  });

  it('sin tiempo no pasa nada', () => {
    const state = trabajando();
    expect(advanceRanch(state, 0, 1).state).toBe(state);
  });

  it('no muta el estado anterior', () => {
    const state = trabajando();
    const snapshot = structuredClone(state);
    advanceRanch(state, 5 * MINUTE, 2);
    expect(state).toEqual(snapshot);
  });
});

describe('progreso offline', () => {
  const trabajando = (): GameState => veteran([creature('chispin', { postId: 'gather' })]);

  it('una ausencia corta no cuenta', () => {
    const state = { ...trabajando(), lastSeenAt: NOW - 10_000 };
    expect(offlineProgress(state, NOW, 1)).toBeNull();
  });

  it('rinde la mitad que estando delante', () => {
    const away = 2 * 60 * MINUTE;
    const state = { ...trabajando(), lastSeenAt: NOW - away };
    const offline = offlineProgress(state, NOW, 1);
    const online = advanceRanch(state, away, 1);
    expect(offline?.gains.coins).toBeCloseTo(online.gains.coins * BALANCE.ranch.offline.factor, 5);
  });

  it('no paga más de 8 horas aunque te vayas un día', () => {
    const state = { ...trabajando(), lastSeenAt: NOW - 24 * 60 * MINUTE };
    const offline = offlineProgress(state, NOW, 1);
    const tope = advanceRanch(state, BALANCE.ranch.offline.maxMs, 1, BALANCE.ranch.offline.factor);
    expect(offline?.gains.coins).toBeCloseTo(tope.gains.coins, 5);
  });

  it('deja el reloj al día y cuenta la ausencia real en el resumen', () => {
    const away = 10 * 60 * MINUTE;
    const state = { ...trabajando(), lastSeenAt: NOW - away };
    const offline = offlineProgress(state, NOW, 1);
    expect(offline?.state.lastSeenAt).toBe(NOW);
    expect(offline?.gains.elapsedMs).toBe(away);
  });

  it('las bayas se gastan igual que estando delante', () => {
    const state = {
      ...veteran([creature('chispin', { postId: 'gather', satiety: 20 })]),
      berries: 3,
      lastSeenAt: NOW - 60 * MINUTE,
    };
    const offline = offlineProgress(state, NOW, 1);
    expect(offline?.gains.berriesEaten).toBeGreaterThan(0);
    expect(offline?.state.berries).toBeLessThan(3);
  });
});

describe('catálogo de puestos', () => {
  it('hay un puesto por aptitud y todos tienen precio de mejora', () => {
    expect(POST_LIST).toHaveLength(6);
    for (const post of POST_LIST) {
      expect(post.upgradeBasePrice).toBeGreaterThan(0);
      expect(post.unlockLevel).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('huecos largos entre ticks', () => {
  it('un tick con horas acumuladas paga con las reglas del offline, no al 100 %', () => {
    const away = 3 * 60 * MINUTE;
    const state = {
      ...veteran([creature('chispin', { postId: 'gather' })]),
      lastSeenAt: NOW - away,
    };
    const result = tick(state, NOW, createRng(1));
    const completo = advanceRanch(state, away, coinsPerClick(state));
    expect(result.gains.coins).toBeCloseTo(completo.gains.coins * BALANCE.ranch.offline.factor, 5);
  });

  it('tampoco paga más de 8 horas de golpe', () => {
    const state = {
      ...veteran([creature('chispin', { postId: 'gather' })]),
      lastSeenAt: NOW - 48 * 60 * MINUTE,
    };
    const result = tick(state, NOW, createRng(1));
    const tope = advanceRanch(
      state,
      BALANCE.ranch.offline.maxMs,
      coinsPerClick(state),
      BALANCE.ranch.offline.factor,
    );
    expect(result.gains.coins).toBeCloseTo(tope.gains.coins, 5);
  });

  it('un tick normal sí paga al 100 %', () => {
    const state = {
      ...veteran([creature('chispin', { postId: 'gather' })]),
      lastSeenAt: NOW - 100,
    };
    const result = tick(state, NOW, createRng(1));
    const completo = advanceRanch(state, 100, coinsPerClick(state));
    expect(result.gains.coins).toBeCloseTo(completo.gains.coins, 8);
  });
});
