import { BALANCE } from '../data/balance';
import { bossZoneOf, getBoss, type BossDefinition, type BossMechanicId } from '../data/bosses';
import { TYPE_CHART, type CombatStats } from '../data/combat';
import { getSpecies, type SpeciesId } from '../data/species';
import { getTrait } from '../data/traits';
import type { CreatureType } from '../data/types';
import { ZONE_ORDER, type ZoneId } from '../data/zones';
import { rollShiny } from './capture';
import { bossBlock } from './progression';
import type { Rng } from './rng';
import type { BattleState, Battler, CapturedCreature, GameState } from './state';

/**
 * Combate automático en tiempo real (GDD · Combate y jefes de zona).
 *
 * Todo es puro: el combate avanza con `advanceBattle(estado, ahora, rng)` y
 * el jugador interviene con acciones sueltas (clic, habilidad, baya).
 */

// --- tipos y daño -------------------------------------------------------------

/** ×1,5 contra quien es débil, ×0,67 contra quien resiste, ×1 en lo demás. */
export function typeMultiplier(attacker: CreatureType, defender: CreatureType): number {
  if (TYPE_CHART[attacker].includes(defender)) return BALANCE.combat.typeStrong;
  if (TYPE_CHART[defender].includes(attacker)) return BALANCE.combat.typeWeak;
  return 1;
}

/** Estadísticas al nivel L: base × (1 + 0,08 (L − 1)) (GDD). */
export function statsAtLevel(base: CombatStats, level: number): CombatStats {
  const factor = 1 + BALANCE.combat.statPerLevel * (level - 1);
  return {
    hp: Math.round(base.hp * factor),
    atk: Math.round(base.atk * factor),
    def: Math.round(base.def * factor),
    spd: Math.round(base.spd * factor),
  };
}

/** Estadísticas de un ejemplar, ya con el empujón de su rasgo. */
export function creatureStats(creature: CapturedCreature): CombatStats {
  const trait = getTrait(creature.traitId);
  const base = statsAtLevel(getSpecies(creature.speciesId).stats, creature.level);
  return {
    ...base,
    hp: Math.round(base.hp * trait.health),
    atk: Math.round(base.atk * trait.attack),
  };
}

/** `D = ATQ · ATQ/(ATQ + DEF) · t · v` (GDD · Fórmulas). */
export function damageOf(atk: number, def: number, typeFactor: number, variance: number): number {
  const raw = atk * (atk / (atk + def)) * typeFactor * variance;
  return Math.max(BALANCE.combat.minDamage, Math.round(raw));
}

export function rollVariance(rng: Rng): number {
  return rng.range(BALANCE.combat.damageVarianceMin, BALANCE.combat.damageVarianceMax);
}

/** Cada cuánto ataca una criatura: `2 / (1 + VEL/100)` segundos (GDD). */
export function attackIntervalMs(speed: number): number {
  return Math.round(BALANCE.combat.attackBaseMs / (1 + speed / 100));
}

// --- equipo --------------------------------------------------------------------

/** Plazas de equipo abiertas por nivel de entrenador (GDD · Progresión). */
export function teamSlots(state: GameState): number {
  return BALANCE.combat.teamUnlockLevels.filter((level) => state.trainer.level >= level).length;
}

export function isInTeam(state: GameState, uid: number): boolean {
  return state.team.includes(uid);
}

export function isExhausted(creature: CapturedCreature, now: number): boolean {
  return creature.exhaustedUntil > now;
}

export function teamCreatures(state: GameState): readonly CapturedCreature[] {
  return state.team
    .map((uid) => state.creatures.find((creature) => creature.uid === uid))
    .filter((creature): creature is CapturedCreature => creature !== undefined);
}

export type TeamFailure = 'unknown-creature' | 'team-full' | 'exhausted' | 'no-slots';

export interface TeamResult {
  readonly state: GameState;
  readonly changed: boolean;
  readonly failure: TeamFailure | null;
}

/**
 * Mete una criatura en el equipo. Mientras está ahí no ocupa puesto en el
 * Rancho (GDD): se queda sin trabajo asignado.
 */
export function addToTeam(state: GameState, uid: number, now: number): TeamResult {
  const creature = state.creatures.find((candidate) => candidate.uid === uid);
  if (creature === undefined) return { state, changed: false, failure: 'unknown-creature' };
  if (isInTeam(state, uid)) return { state, changed: false, failure: null };
  if (teamSlots(state) === 0) return { state, changed: false, failure: 'no-slots' };
  if (state.team.length >= teamSlots(state)) {
    return { state, changed: false, failure: 'team-full' };
  }
  if (isExhausted(creature, now)) return { state, changed: false, failure: 'exhausted' };

  return {
    state: {
      ...state,
      team: [...state.team, uid],
      creatures: state.creatures.map((candidate) =>
        candidate.uid === uid ? { ...candidate, postId: null } : candidate,
      ),
    },
    changed: true,
    failure: null,
  };
}

export function removeFromTeam(state: GameState, uid: number): TeamResult {
  if (!isInTeam(state, uid)) return { state, changed: false, failure: null };
  return {
    state: { ...state, team: state.team.filter((member) => member !== uid) },
    changed: true,
    failure: null,
  };
}

// --- combate ---------------------------------------------------------------------

function toBattler(creature: CapturedCreature, now: number): Battler {
  const stats = creatureStats(creature);
  return {
    uid: creature.uid,
    speciesId: creature.speciesId,
    hp: stats.hp,
    maxHp: stats.hp,
    nextAttackAt: now + attackIntervalMs(stats.spd),
    charge: 0,
    shieldUntil: 0,
  };
}

export type BattleStartFailure =
  | 'no-team'
  | 'no-encounter'
  | 'already-fighting'
  | 'weakened'
  /* Solo al retar a un jefe: la zona, el nivel o el enfriamiento lo impiden. */
  | 'zone-locked'
  | 'level'
  | 'cooldown';

export interface BattleStartResult {
  readonly state: GameState;
  readonly started: boolean;
  readonly failure: BattleStartFailure | null;
}

/**
 * Empieza el combate contra la salvaje que hay en la zona. Las criaturas
 * agotadas se quedan fuera.
 */
export function startBattle(state: GameState, now: number): BattleStartResult {
  if (state.battle !== null) return { state, started: false, failure: 'already-fighting' };
  if (state.encounter === null) return { state, started: false, failure: 'no-encounter' };
  // Una salvaje sin PV ya está lista para el orbe: pelear daría una victoria vacía.
  if (state.encounter.hp <= 0) return { state, started: false, failure: 'weakened' };

  const team = teamCreatures(state).filter((creature) => !isExhausted(creature, now));
  if (team.length === 0) return { state, started: false, failure: 'no-team' };

  const enemyStats = statsAtLevel(getSpecies(state.encounter.speciesId).stats, 1);
  const battle: BattleState = {
    enemySpeciesId: state.encounter.speciesId,
    enemyShiny: state.encounter.shiny,
    enemyHp: state.encounter.hp,
    enemyMaxHp: state.encounter.maxHp,
    enemyAtk: enemyStats.atk,
    enemyDef: enemyStats.def,
    enemyNextAttackAt: now + attackIntervalMs(enemyStats.spd),
    enemyAsleepUntil: 0,
    enemyShieldHits: 0,
    mechanicAt: 0,
    kind: 'wild',
    team: team.map((creature) => toBattler(creature, now)),
    berriesUsed: 0,
    startedAt: now,
    lastTickAt: now,
    endsAt: now + BALANCE.combat.maxBattleMs,
  };
  return { state: { ...state, battle }, started: true, failure: null };
}

// --- jefes de zona ---------------------------------------------------------------

/**
 * PV de un jefe: ×10 los de una salvaje común de su zona (GDD). No se usan
 * los PV que daría su rareza legendaria porque eso lo multiplicaría otra vez
 * por dieciséis y ningún equipo del MVP lo tumbaría.
 */
export function bossMaxHp(zoneId: ZoneId): number {
  const { baseWildHp, hpPerZone } = BALANCE.capture;
  return Math.round(
    baseWildHp * hpPerZone ** ZONE_ORDER[zoneId] * BALANCE.combat.boss.hpMultiplier,
  );
}

/** Cada cuánto se dispara la mecánica de un jefe. */
export function mechanicIntervalMs(boss: BossDefinition): number {
  return BALANCE.combat.boss[boss.mechanic].intervalMs;
}

/**
 * Reta al jefe de una zona. Pide lo mismo que un combate normal (equipo en
 * pie) más las condiciones del jefe: estar en su zona, tener el nivel y que
 * haya pasado el enfriamiento desde la última vez.
 */
export function startBossBattle(state: GameState, zoneId: ZoneId, now: number): BattleStartResult {
  if (state.battle !== null) return { state, started: false, failure: 'already-fighting' };

  const blocked = bossBlock(state, zoneId, now);
  if (blocked !== null) return { state, started: false, failure: blocked };

  const team = teamCreatures(state).filter((creature) => !isExhausted(creature, now));
  if (team.length === 0) return { state, started: false, failure: 'no-team' };

  const boss = getBoss(zoneId);
  const species = getSpecies(boss.speciesId);
  const stats = statsAtLevel(species.stats, 1);
  const hp = bossMaxHp(zoneId);

  const battle: BattleState = {
    kind: 'boss',
    enemySpeciesId: species.id,
    enemyShiny: false,
    enemyHp: hp,
    enemyMaxHp: hp,
    enemyAtk: stats.atk,
    enemyDef: stats.def,
    enemyNextAttackAt: now + bossAttackIntervalMs(stats.spd),
    enemyAsleepUntil: 0,
    enemyShieldHits: 0,
    mechanicAt: now + mechanicIntervalMs(boss),
    team: team.map((creature) => toBattler(creature, now)),
    berriesUsed: 0,
    startedAt: now,
    lastTickAt: now,
    endsAt: now + BALANCE.combat.boss.maxBattleMs,
  };
  return { state: { ...state, battle }, started: true, failure: null };
}

/** Un jefe pega más fuerte que una salvaje, así que pega más espaciado. */
function bossAttackIntervalMs(speed: number): number {
  return Math.round(attackIntervalMs(speed) * BALANCE.combat.boss.attackIntervalFactor);
}

/** El escudo de piedra solo cede a los clics: mientras aguante, nada le entra. */
export function isEnemyShielded(battle: BattleState): boolean {
  return battle.enemyShieldHits > 0;
}

export type BattleOutcome = 'won' | 'lost' | 'timeout';

export interface BattleStep {
  readonly state: GameState;
  /** Terminado solo cuando hay desenlace. */
  readonly outcome: BattleOutcome | null;
  /** Criaturas que han caído en este paso. */
  readonly fallen: readonly number[];
  /** Contra quién era el combate, para calcular el botín sin mirar el encuentro. */
  readonly enemySpeciesId: SpeciesId | null;
  readonly enemyMaxHp: number;
  /** Zona cuyo jefe acaba de caer, o `null` si no cayó ninguno. */
  readonly bossZoneId: ZoneId | null;
  /** Mecánicas de jefe que han saltado en este paso. */
  readonly mechanics: readonly BossMechanicId[];
}

function aliveTeam(battle: BattleState): readonly Battler[] {
  return battle.team.filter((battler) => battler.hp > 0);
}

/** Cierra el combate dejando el estado listo para lo que venga después. */
function finish(
  state: GameState,
  outcome: BattleOutcome,
  now: number,
  fallen: readonly number[],
  rng: Rng,
  mechanics: readonly BossMechanicId[],
): BattleStep {
  const battle = state.battle;
  // Quien cayó queda agotado dos minutos (GDD): ni trabaja ni combate.
  const creatures = state.creatures.map((creature) =>
    fallen.includes(creature.uid)
      ? { ...creature, exhaustedUntil: now + BALANCE.combat.exhaustionMs, postId: null }
      : creature,
  );

  const isBoss = battle?.kind === 'boss';
  const bossZoneId = isBoss && outcome === 'won' ? bossZoneOf(battle.enemySpeciesId) : null;

  /*
   * Al ganar, el rival se queda debilitado y a tiro del orbe: la salvaje a 0
   * PV y el jefe como un encuentro recién puesto en la zona, que es la forma
   * que tiene el GDD de dejar capturarlo (y ocupa el hueco de la salvaje que
   * hubiera, que para eso se fue el equipo a pelear con otra cosa).
   */
  const encounter =
    outcome !== 'won' || battle === null
      ? state.encounter
      : isBoss
        ? {
            speciesId: battle.enemySpeciesId,
            hp: 0,
            maxHp: battle.enemyMaxHp,
            shiny: rollShiny(rng),
            appearedAt: now,
            fleesAt: now + BALANCE.capture.encounterMs,
          }
        : state.encounter !== null
          ? { ...state.encounter, hp: 0 }
          : null;

  const bosses =
    bossZoneId === null
      ? state.bosses
      : {
          ...state.bosses,
          [bossZoneId]: {
            defeated: true,
            availableAt: now + BALANCE.combat.boss.retryCooldownMs,
          },
        };

  return {
    state: {
      ...state,
      creatures,
      team: state.team.filter((uid) => !fallen.includes(uid)),
      battle: null,
      encounter,
      bosses,
      rngSeed: rng.seed(),
    },
    outcome,
    fallen,
    enemySpeciesId: battle?.enemySpeciesId ?? null,
    enemyMaxHp: battle?.enemyMaxHp ?? 0,
    bossZoneId,
    mechanics,
  };
}

/**
 * Avanza el combate hasta `now`: cada criatura pega cuando le toca y el
 * enemigo responde contra una al azar.
 */
export function advanceBattle(state: GameState, now: number, rng: Rng): BattleStep {
  const battle = state.battle;
  if (battle === null) {
    return {
      state,
      outcome: null,
      fallen: [],
      enemySpeciesId: null,
      enemyMaxHp: 0,
      bossZoneId: null,
      mechanics: [],
    };
  }

  const species = getSpecies(battle.enemySpeciesId);
  let enemyHp = battle.enemyHp;
  const enemyAsleepUntil = battle.enemyAsleepUntil;
  let enemyNextAttackAt = battle.enemyNextAttackAt;
  let enemyShieldHits = battle.enemyShieldHits;
  let mechanicAt = battle.mechanicAt;
  const fallen: number[] = [];
  /** Mecánicas que han saltado en este paso, para que la interfaz las anuncie. */
  const mechanics: BossMechanicId[] = [];

  /*
   * Mecánica del jefe, antes de los golpes: se dispara tantas veces como
   * quepan desde el último paso, así una pestaña en segundo plano no se salta
   * ninguna cura ni ninguna oleada.
   */
  let mechanicTeam = battle.team;
  if (battle.kind === 'boss' && mechanicAt > 0) {
    const bossZoneId = bossZoneOf(battle.enemySpeciesId);
    const boss = bossZoneId === null ? null : getBoss(bossZoneId);
    const interval = boss === null ? 0 : mechanicIntervalMs(boss);

    while (boss !== null && interval > 0 && mechanicAt <= now && enemyHp > 0) {
      mechanics.push(boss.mechanic);
      switch (boss.mechanic) {
        case 'regrowth':
          // Cornavid rebrota: hay que meterle daño más rápido de lo que se cura.
          enemyHp = Math.min(
            battle.enemyMaxHp,
            enemyHp + Math.round(battle.enemyMaxHp * BALANCE.combat.boss.regrowth.percent),
          );
          break;
        case 'stoneShield':
          enemyShieldHits = BALANCE.combat.boss.stoneShield.hits;
          break;
        case 'tideWave': {
          // La oleada alcanza a todo el equipo en pie a la vez.
          const power = BALANCE.combat.boss.tideWave.power;
          mechanicTeam = mechanicTeam.map((battler) => {
            if (battler.hp <= 0) return battler;
            const defender = statsAtLevel(getSpecies(battler.speciesId).stats, 1);
            const factor = typeMultiplier(species.type, getSpecies(battler.speciesId).type);
            const hit = damageOf(battle.enemyAtk * power, defender.def, factor, rollVariance(rng));
            const hp = Math.max(0, battler.hp - hit);
            if (hp === 0) fallen.push(battler.uid);
            return { ...battler, hp };
          });
          break;
        }
      }
      mechanicAt += interval;
    }
  }

  const team = mechanicTeam.map((battler) => {
    if (battler.hp <= 0 || enemyHp <= 0) return battler;

    let next = battler;
    const stats = statsAtLevel(getSpecies(battler.speciesId).stats, 1);
    const interval = attackIntervalMs(stats.spd);

    // Golpes pendientes desde el último paso.
    while (next.nextAttackAt <= now && enemyHp > 0) {
      // Con el escudo en pie los golpes automáticos rebotan: solo valen los clics.
      if (enemyShieldHits <= 0) {
        const factor = typeMultiplier(getSpecies(next.speciesId).type, species.type);
        enemyHp = Math.max(
          0,
          enemyHp - damageOf(stats.atk, battle.enemyDef, factor, rollVariance(rng)),
        );
      }
      next = { ...next, nextAttackAt: next.nextAttackAt + interval };
    }
    return next;
  });

  // El enemigo responde si no está dormido.
  let damagedTeam = team;
  if (enemyHp > 0) {
    while (enemyNextAttackAt <= now) {
      if (enemyAsleepUntil > enemyNextAttackAt) {
        enemyNextAttackAt = enemyAsleepUntil;
        continue;
      }
      const targets = damagedTeam.filter((battler) => battler.hp > 0);
      if (targets.length === 0) break;

      const target = targets[rng.int(0, targets.length - 1)];
      if (target === undefined) break;

      const defender = statsAtLevel(getSpecies(target.speciesId).stats, 1);
      const factor = typeMultiplier(species.type, getSpecies(target.speciesId).type);
      const shielded = target.shieldUntil > enemyNextAttackAt;
      const hit = Math.round(
        damageOf(battle.enemyAtk, defender.def, factor, rollVariance(rng)) * (shielded ? 0.4 : 1),
      );

      damagedTeam = damagedTeam.map((battler) =>
        battler.uid === target.uid ? { ...battler, hp: Math.max(0, battler.hp - hit) } : battler,
      );
      if ((damagedTeam.find((b) => b.uid === target.uid)?.hp ?? 0) === 0) fallen.push(target.uid);

      const enemySpeed = statsAtLevel(species.stats, 1).spd;
      enemyNextAttackAt +=
        battle.kind === 'boss' ? bossAttackIntervalMs(enemySpeed) : attackIntervalMs(enemySpeed);
    }
  }

  // La carga de habilidad sube con el tiempo; los clics la empujan aparte.
  const elapsed = Math.max(0, now - battle.lastTickAt);
  const charged: BattleState = {
    ...battle,
    enemyHp,
    enemyAsleepUntil,
    enemyNextAttackAt,
    enemyShieldHits,
    mechanicAt,
    lastTickAt: now,
    team: damagedTeam.map((battler) => ({
      ...battler,
      charge:
        battler.hp <= 0
          ? battler.charge
          : Math.min(1, battler.charge + elapsed / getSpecies(battler.speciesId).ability.chargeMs),
    })),
  };

  const withBattle: GameState = { ...state, battle: charged };

  if (enemyHp <= 0) return finish(withBattle, 'won', now, fallen, rng, mechanics);
  if (aliveTeam(charged).length === 0)
    return finish(withBattle, 'lost', now, fallen, rng, mechanics);
  if (now >= battle.endsAt) return finish(withBattle, 'timeout', now, fallen, rng, mechanics);

  return {
    state: withBattle,
    outcome: null,
    fallen,
    enemySpeciesId: battle.enemySpeciesId,
    enemyMaxHp: battle.enemyMaxHp,
    bossZoneId: null,
    mechanics,
  };
}

// --- intervenciones del jugador --------------------------------------------------

/**
 * Un clic sobre el enemigo: su daño de clic y un empujón a la barra (GDD).
 * Si el jefe tiene el escudo de piedra en pie, el clic no le quita PV: le
 * quita un golpe al escudo, que es lo único que lo rompe.
 */
export function clickEnemy(state: GameState, damage: number): GameState {
  const battle = state.battle;
  if (battle === null || battle.enemyHp <= 0) return state;

  const shielded = isEnemyShielded(battle);
  return {
    ...state,
    battle: {
      ...battle,
      enemyShieldHits: shielded ? battle.enemyShieldHits - 1 : 0,
      enemyHp: shielded
        ? battle.enemyHp
        : Math.max(0, battle.enemyHp - Math.max(1, Math.round(damage))),
      team: battle.team.map((battler) =>
        battler.hp <= 0
          ? battler
          : { ...battler, charge: Math.min(1, battler.charge + BALANCE.combat.clickChargePercent) },
      ),
    },
  };
}

export type AbilityFailure =
  | 'no-battle'
  | 'unknown-battler'
  | 'not-charged'
  | 'fainted'
  /** El escudo de piedra está en pie: hay que romperlo a clics antes. */
  | 'shielded';

export interface AbilityResult {
  readonly state: GameState;
  readonly used: boolean;
  readonly failure: AbilityFailure | null;
}

/** Lanza la habilidad activa de una criatura del equipo. */
export function useAbility(state: GameState, uid: number, now: number, rng: Rng): AbilityResult {
  const battle = state.battle;
  if (battle === null) return { state, used: false, failure: 'no-battle' };

  const battler = battle.team.find((candidate) => candidate.uid === uid);
  if (battler === undefined) return { state, used: false, failure: 'unknown-battler' };
  if (battler.hp <= 0) return { state, used: false, failure: 'fainted' };
  if (battler.charge < 1) return { state, used: false, failure: 'not-charged' };
  // Con el escudo en pie la habilidad no se gasta: se guarda para cuando caiga.
  if (isEnemyShielded(battle)) return { state, used: false, failure: 'shielded' };

  const species = getSpecies(battler.speciesId);
  const ability = species.ability;
  const stats = statsAtLevel(species.stats, 1);

  let enemyHp = battle.enemyHp;
  let enemyAsleepUntil = battle.enemyAsleepUntil;
  let team = battle.team;

  switch (ability.kind) {
    case 'damage': {
      const factor = typeMultiplier(species.type, getSpecies(battle.enemySpeciesId).type);
      const hit = damageOf(stats.atk * ability.power, battle.enemyDef, factor, rollVariance(rng));
      enemyHp = Math.max(0, enemyHp - hit);
      break;
    }
    case 'heal':
      // Cura a todo el equipo en pie, en fracción de sus PV máximos.
      team = team.map((candidate) =>
        candidate.hp <= 0
          ? candidate
          : {
              ...candidate,
              hp: Math.min(
                candidate.maxHp,
                candidate.hp + Math.round(candidate.maxHp * ability.power),
              ),
            },
      );
      break;
    case 'shield':
      team = team.map((candidate) =>
        candidate.hp <= 0
          ? candidate
          : { ...candidate, shieldUntil: now + BALANCE.combat.shieldMs },
      );
      break;
    case 'sleep':
      enemyAsleepUntil = now + ability.power * 1000;
      break;
  }

  return {
    state: {
      ...state,
      battle: {
        ...battle,
        enemyHp,
        enemyAsleepUntil,
        team: team.map((candidate) =>
          candidate.uid === uid ? { ...candidate, charge: 0 } : candidate,
        ),
      },
    },
    used: true,
    failure: null,
  };
}

export type BerryFailure = 'no-battle' | 'no-berries' | 'limit' | 'unknown-battler';

export interface BerryResult {
  readonly state: GameState;
  readonly used: boolean;
  readonly failure: BerryFailure | null;
}

/** Una baya cura el 30 % de los PV; como mucho tres por combate (GDD). */
export function useBerry(state: GameState, uid: number): BerryResult {
  const battle = state.battle;
  if (battle === null) return { state, used: false, failure: 'no-battle' };
  if (battle.berriesUsed >= BALANCE.combat.maxBerriesPerBattle) {
    return { state, used: false, failure: 'limit' };
  }
  if (state.berries < 1) return { state, used: false, failure: 'no-berries' };

  const battler = battle.team.find((candidate) => candidate.uid === uid);
  if (battler === undefined || battler.hp <= 0) {
    return { state, used: false, failure: 'unknown-battler' };
  }

  return {
    state: {
      ...state,
      berries: state.berries - 1,
      battle: {
        ...battle,
        berriesUsed: battle.berriesUsed + 1,
        team: battle.team.map((candidate) =>
          candidate.uid === uid
            ? {
                ...candidate,
                hp: Math.min(
                  candidate.maxHp,
                  candidate.hp + Math.round(candidate.maxHp * BALANCE.combat.berryHealPercent),
                ),
              }
            : candidate,
        ),
      },
    },
    used: true,
    failure: null,
  };
}

/** Abandonar: la salvaje se queda como estaba y el equipo se retira. */
export function fleeBattle(state: GameState): GameState {
  return state.battle === null ? state : { ...state, battle: null };
}
