import { describe, expect, it } from 'vitest';
import {
  advanceBattle,
  bossMaxHp,
  clickEnemy,
  isEnemyShielded,
  startBattle,
  startBossBattle,
  useAbility,
} from '../src/core/combat';
import { captureChance } from '../src/core/capture';
import { hitWild, tick, useOrb } from '../src/core/engine';
import { bossProgress, isBossDefeated, isZoneUnlocked } from '../src/core/progression';
import { createRng, type Rng } from '../src/core/rng';
import { createInitialState, type CapturedCreature, type GameState } from '../src/core/state';
import { BALANCE } from '../src/data/balance';
import { getBoss } from '../src/data/bosses';
import { getSpecies, type SpeciesId } from '../src/data/species';
import { ZONE_ORDER, type ZoneId } from '../src/data/zones';

const NOW = 1_700_000_000_000;

function creature(speciesId: SpeciesId, uid: number): CapturedCreature {
  return {
    uid,
    speciesId,
    level: 1,
    xp: 0,
    traitId: 'hardworking',
    shiny: false,
    satiety: 100,
    location: 'ranch',
    exhaustedUntil: 0,
    postId: null,
    capturedAt: NOW,
  };
}

/** Partida lista para retar al jefe de una zona: nivel, zona abierta y equipo. */
function readyFor(zoneId: ZoneId, team: readonly CapturedCreature[] = []): GameState {
  const squad = team.length > 0 ? team : [creature('chispin', 1)];
  const unlocked: ZoneId[] = zoneId === 'meadow' ? ['meadow'] : ['meadow', zoneId];
  return {
    ...createInitialState(NOW, 7),
    trainer: { level: 15, xp: 0 },
    creatures: [...squad],
    team: squad.map((member) => member.uid),
    activeZoneId: zoneId,
    unlockedZoneIds: unlocked,
  };
}

const rng = (): Rng => createRng(11);

/**
 * Combate contra un jefe con el estado del rival retocado. Las mecánicas se
 * prueban dejándolas a punto de saltar (`mechanicAt` a 100 ms) y avanzando un
 * paso corto: así se mide la mecánica sola, sin los golpes del equipo ni los
 * del jefe por medio.
 */
function bossBattleAt(
  zoneId: ZoneId,
  patch: Partial<GameState['battle'] & object> = {},
  team: readonly CapturedCreature[] = [],
): GameState {
  const start = startBossBattle(readyFor(zoneId, team), zoneId, NOW).state;
  const battle = start.battle;
  if (battle === null) throw new Error('el jefe no arrancó');
  return { ...start, battle: { ...battle, mechanicAt: NOW + 100, ...patch } };
}

/** Paso cortísimo: solo cabe la mecánica. */
const MECHANIC_STEP = NOW + 150;

describe('retar a un jefe', () => {
  it('los PV son ×10 los de una salvaje común de la zona', () => {
    for (const zoneId of ['meadow', 'cave', 'lake'] as const) {
      const expected = Math.round(
        BALANCE.capture.baseWildHp *
          BALANCE.capture.hpPerZone ** ZONE_ORDER[zoneId] *
          BALANCE.combat.boss.hpMultiplier,
      );
      expect(bossMaxHp(zoneId), zoneId).toBe(expected);
    }
  });

  it('arranca con el jefe a tope y su mecánica programada', () => {
    const result = startBossBattle(readyFor('meadow'), 'meadow', NOW);
    expect(result.started).toBe(true);
    const battle = result.state.battle;
    expect(battle?.kind).toBe('boss');
    expect(battle?.enemySpeciesId).toBe('cornavid');
    expect(battle?.enemyHp).toBe(bossMaxHp('meadow'));
    expect(battle?.mechanicAt).toBe(NOW + BALANCE.combat.boss.regrowth.intervalMs);
    // Un jefe aguanta más tiempo en pie que una salvaje.
    expect(battle?.endsAt).toBe(NOW + BALANCE.combat.boss.maxBattleMs);
  });

  it('hace falta estar en la zona, tener el nivel y un equipo en pie', () => {
    const fuera = { ...readyFor('meadow'), unlockedZoneIds: ['meadow' as const] };
    expect(startBossBattle(fuera, 'cave', NOW).failure).toBe('zone-locked');

    const sinNivel = { ...readyFor('meadow'), trainer: { level: 4, xp: 0 } };
    expect(startBossBattle(sinNivel, 'meadow', NOW).failure).toBe('level');

    const sinEquipo = { ...readyFor('meadow'), team: [] };
    expect(startBossBattle(sinEquipo, 'meadow', NOW).failure).toBe('no-team');

    const agotado = readyFor('meadow', [
      { ...creature('chispin', 1), exhaustedUntil: NOW + 10_000 },
    ]);
    expect(startBossBattle(agotado, 'meadow', NOW).failure).toBe('no-team');
  });

  it('no se puede retar dos veces seguidas: hay media hora de espera', () => {
    const state = {
      ...readyFor('meadow'),
      bosses: { meadow: { defeated: true, availableAt: NOW + 60_000 } },
    };
    expect(startBossBattle(state, 'meadow', NOW).failure).toBe('cooldown');
    // Pasado el enfriamiento se puede volver a farmear.
    expect(startBossBattle(state, 'meadow', NOW + 60_000).started).toBe(true);
  });

  it('con un combate en marcha no se reta a nadie', () => {
    const fighting = startBossBattle(readyFor('meadow'), 'meadow', NOW).state;
    expect(startBossBattle(fighting, 'meadow', NOW).failure).toBe('already-fighting');
  });
});

describe('mecánicas de jefe', () => {
  it('Cornavid rebrota un 5 % cada diez segundos', () => {
    const maxHp = bossMaxHp('meadow');
    const half = Math.round(maxHp / 2);
    const step = advanceBattle(bossBattleAt('meadow', { enemyHp: half }), MECHANIC_STEP, rng());

    expect(step.mechanics).toEqual(['regrowth']);
    expect(step.state.battle?.enemyHp).toBe(
      half + Math.round(maxHp * BALANCE.combat.boss.regrowth.percent),
    );
  });

  it('el rebrote nunca pasa de los PV máximos', () => {
    const step = advanceBattle(bossBattleAt('meadow'), MECHANIC_STEP, rng());
    expect(step.state.battle?.enemyHp).toBe(bossMaxHp('meadow'));
  });

  it('Geodrón levanta un escudo que los golpes automáticos no rompen', () => {
    const step = advanceBattle(bossBattleAt('cave'), MECHANIC_STEP, rng());

    expect(step.mechanics).toEqual(['stoneShield']);
    const shielded = step.state.battle;
    if (shielded === null) throw new Error('el combate no debería haber acabado');
    expect(shielded.enemyShieldHits).toBe(BALANCE.combat.boss.stoneShield.hits);
    expect(isEnemyShielded(shielded)).toBe(true);

    /*
     * Con el escudo en pie el equipo pega y los PV no bajan. El paso llega
     * justo detrás del primer golpe automático y antes del primero del jefe,
     * para que el combate no se decida por el camino.
     */
    const hp = shielded.enemyHp;
    const later = advanceBattle(step.state, NOW + 2000, rng());
    expect(later.state.battle?.enemyShieldHits).toBe(BALANCE.combat.boss.stoneShield.hits);
    expect(later.state.battle?.enemyHp).toBe(hp);
  });

  it('el escudo solo cae a clics, y entonces vuelve a entrar el daño', () => {
    const step = advanceBattle(bossBattleAt('cave'), MECHANIC_STEP, rng());
    let state = step.state;
    const hp = state.battle?.enemyHp ?? 0;

    // Cada clic se come un golpe del escudo, sin tocarle los PV.
    for (let i = 0; i < BALANCE.combat.boss.stoneShield.hits; i += 1) {
      state = clickEnemy(state, 5);
      expect(state.battle?.enemyHp, `clic ${i + 1}`).toBe(hp);
    }
    expect(state.battle?.enemyShieldHits).toBe(0);

    // Roto el escudo, el clic vuelve a doler.
    state = clickEnemy(state, 5);
    expect(state.battle?.enemyHp).toBe(hp - 5);
  });

  it('con el escudo en pie la habilidad se guarda en vez de gastarse', () => {
    const step = advanceBattle(bossBattleAt('cave'), MECHANIC_STEP, rng());
    const battle = step.state.battle;
    const cargado: GameState = {
      ...step.state,
      battle:
        battle === null
          ? null
          : { ...battle, team: battle.team.map((member) => ({ ...member, charge: 1 })) },
    };
    const result = useAbility(cargado, 1, NOW, rng());
    expect(result.used).toBe(false);
    expect(result.failure).toBe('shielded');
  });

  it('la oleada de Marealis golpea a todo el equipo a la vez', () => {
    const team = [creature('chispin', 1), creature('nenufrel', 2), creature('goton', 3)];
    const start = bossBattleAt('lake', {}, team);
    const before = start.battle?.team.map((member) => member.hp) ?? [];

    const step = advanceBattle(start, MECHANIC_STEP, rng());
    expect(step.mechanics).toEqual(['tideWave']);

    const after = step.state.battle?.team.map((member) => member.hp) ?? [];
    expect(after).toHaveLength(before.length);
    for (const [index, hp] of after.entries()) {
      expect(hp, `criatura ${index}`).toBeLessThan(before[index] ?? 0);
    }
  });

  it('un paso largo no se salta ninguna mecánica: salta todas las pendientes', () => {
    const interval = BALANCE.combat.boss.tideWave.intervalMs;
    // Un jefe inmortal: así el equipo no lo tumba antes de la tercera oleada.
    const start = bossBattleAt('lake', { enemyHp: 1_000_000, enemyMaxHp: 1_000_000 });
    const step = advanceBattle(start, NOW + 100 + interval * 2, rng());
    expect(step.mechanics).toEqual(['tideWave', 'tideWave', 'tideWave']);
  });

  it('una salvaje no trae mecánica: solo los jefes la tienen', () => {
    const boss = startBossBattle(readyFor('meadow'), 'meadow', NOW).state;
    expect(boss.battle?.kind).toBe('boss');
    expect(boss.battle?.mechanicAt).toBeGreaterThan(0);

    const wild = startBattle(
      {
        ...readyFor('meadow'),
        encounter: {
          speciesId: 'brotillo',
          hp: 15,
          maxHp: 15,
          shiny: false,
          appearedAt: NOW,
          fleesAt: NOW + 20_000,
        },
      },
      NOW,
    ).state;
    expect(wild.battle?.kind).toBe('wild');
    expect(wild.battle?.mechanicAt).toBe(0);
    expect(advanceBattle(wild, NOW + 30_000, rng()).mechanics).toEqual([]);
  });
});

describe('vencer a un jefe', () => {
  /** Lleva el combate hasta el final dejando al jefe sin PV de un clic. */
  function winBossBattle(zoneId: ZoneId): GameState {
    const start = startBossBattle(readyFor(zoneId), zoneId, NOW).state;
    const battle = start.battle;
    const almost: GameState = {
      ...start,
      battle: battle === null ? null : { ...battle, enemyHp: 1, enemyShieldHits: 0 },
    };
    const hit = clickEnemy(almost, 10);
    return tick(hit, NOW + 100, rng()).state;
  }

  it('queda marcado como vencido y con su enfriamiento', () => {
    const state = winBossBattle('meadow');
    expect(isBossDefeated(state, 'meadow')).toBe(true);
    expect(bossProgress(state, 'meadow').availableAt).toBe(
      NOW + 100 + BALANCE.combat.boss.retryCooldownMs,
    );
    expect(state.battle).toBeNull();
  });

  it('abre la zona siguiente en el mismo tick', () => {
    const state = winBossBattle('meadow');
    expect(isZoneUnlocked(state, 'cave')).toBe(true);
    // El Lago sigue cerrado: le falta su propio jefe.
    expect(isZoneUnlocked(state, 'lake')).toBe(false);
  });

  it('se queda debilitado en la zona para poder capturarlo', () => {
    const { encounter } = winBossBattle('meadow');
    if (encounter === null) throw new Error('el jefe debería quedarse a tiro del orbe');

    expect(encounter.speciesId).toBe('cornavid');
    expect(encounter.hp).toBe(0);
    expect(encounter.maxHp).toBe(bossMaxHp('meadow'));
    // Con el Orbe lunar la captura es segura (GDD).
    expect(captureChance(encounter, 'lunar')).toBe(1);
    // Con uno peor no lo es.
    expect(captureChance(encounter, 'basic')).toBeLessThan(1);
  });

  it('paga el doble que una salvaje de sus PV', () => {
    const start = startBossBattle(readyFor('meadow'), 'meadow', NOW).state;
    const battle = start.battle;
    const almost: GameState = {
      ...start,
      battle: battle === null ? null : { ...battle, enemyHp: 1 },
    };
    const result = tick(clickEnemy(almost, 10), NOW + 100, rng());

    expect(result.battleOutcome).toBe('won');
    expect(result.bossDefeatedZoneId).toBe('meadow');
    const expectedXp = Math.round(
      BALANCE.rarity.legendary.captureXp *
        BALANCE.combat.victoryXpShare *
        BALANCE.combat.boss.rewardMultiplier,
    );
    expect(result.battleReward?.xp).toBe(expectedXp);
    expect(result.battleReward?.coins).toBeGreaterThan(0);
  });

  it('el botín sale del jefe, no de la salvaje que hubiera en la zona', () => {
    const start = startBossBattle(readyFor('meadow'), 'meadow', NOW).state;
    const battle = start.battle;
    const conSalvaje: GameState = {
      ...start,
      battle: battle === null ? null : { ...battle, enemyHp: 1 },
      encounter: {
        speciesId: 'brotillo',
        hp: 15,
        maxHp: 15,
        shiny: false,
        appearedAt: NOW,
        fleesAt: NOW + 20_000,
      },
    };
    const result = tick(clickEnemy(conSalvaje, 10), NOW + 100, rng());
    const brotilloXp = Math.round(BALANCE.rarity.common.captureXp * BALANCE.combat.victoryXpShare);
    expect(result.battleReward?.xp).not.toBe(brotilloXp);
    expect(result.state.encounter?.speciesId).toBe('cornavid');
  });

  it('perder contra el jefe no lo marca como vencido', () => {
    /*
     * Un jefe que no se puede tumbar y una criatura a un PV: en cuanto el
     * jefe pega una vez, el equipo está fuera y el combate se pierde.
     */
    const start = bossBattleAt('meadow', {
      enemyHp: 1_000_000,
      enemyMaxHp: 1_000_000,
      mechanicAt: 0,
    });
    const battle = start.battle;
    const perdiendo: GameState = {
      ...start,
      battle:
        battle === null
          ? null
          : { ...battle, team: battle.team.map((member) => ({ ...member, hp: 1 })) },
    };
    const at = NOW + 5000;
    const step = advanceBattle(perdiendo, at, rng());

    expect(step.outcome).toBe('lost');
    expect(isBossDefeated(step.state, 'meadow')).toBe(false);
    expect(step.state.encounter).toBeNull();
    // Quien cayó queda agotado dos minutos (GDD).
    expect(step.state.creatures[0]?.exhaustedUntil).toBe(at + BALANCE.combat.exhaustionMs);
  });

  it('clicar al jefe ya vencido pide el orbe, no otro combate', () => {
    const state = winBossBattle('meadow');
    const result = hitWild(state, NOW + 200, rng());

    expect(result.needsOrb).toBe(true);
    expect(result.needsBattle).toBe(false);
    expect(result.speciesId).toBe('cornavid');
    // No le pasa nada: sigue a 0 PV esperando el orbe.
    expect(result.state).toBe(state);
  });

  it('se puede capturar al jefe con el Orbe lunar y entra en la Reserva o el Rancho', () => {
    const won = winBossBattle('meadow');
    const state = { ...won, orbs: { lunar: 1 } };
    const result = useOrb(state, 'lunar', NOW + 300, rng());

    expect(result.captured).toBe(true);
    expect(result.creature?.speciesId).toBe('cornavid');
    expect(result.state.creatures.some((c) => c.speciesId === 'cornavid')).toBe(true);
    // El jefe sigue marcado como vencido: capturarlo no deshace el desbloqueo.
    expect(isBossDefeated(result.state, 'meadow')).toBe(true);
    expect(isZoneUnlocked(result.state, 'cave')).toBe(true);
  });

  it('el jefe legendario del Lago cierra el contenido del MVP', () => {
    const species = getSpecies(getBoss('lake').speciesId);
    expect(species.name).toBe('Marealis');
    expect(species.rarity).toBe('legendary');
  });
});
