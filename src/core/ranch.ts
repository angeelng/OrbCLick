import { BALANCE } from '../data/balance';
import { getPost, POST_LIST, type PostId } from '../data/posts';
import { getSpecies } from '../data/species';
import { getTrait } from '../data/traits';
import { getZone } from '../data/zones';
import type { CreatureType } from '../data/types';
import type { CapturedCreature, GameState } from './state';

/**
 * Rancho: quién trabaja dónde y cuánto rinde (GDD · Rancho y trabajo).
 * Todo es puro; el tiempo entra como parámetro en milisegundos.
 */

const MINUTE = 60_000;

// --- plazas y asignación ----------------------------------------------------

export function ranchSlots(state: GameState): number {
  return Math.min(
    BALANCE.ranch.maxSlots,
    BALANCE.ranch.startingSlots + Math.max(0, state.extraRanchSlots),
  );
}

export function creaturesInRanch(state: GameState): readonly CapturedCreature[] {
  return state.creatures.filter((creature) => creature.location === 'ranch');
}

export function creaturesInReserve(state: GameState): readonly CapturedCreature[] {
  return state.creatures.filter((creature) => creature.location === 'reserve');
}

export function creaturesAtPost(state: GameState, postId: PostId): readonly CapturedCreature[] {
  return state.creatures.filter(
    (creature) => creature.location === 'ranch' && creature.postId === postId,
  );
}

export function findCreature(state: GameState, uid: number): CapturedCreature | null {
  return state.creatures.find((creature) => creature.uid === uid) ?? null;
}

export function isPostUnlocked(state: GameState, postId: PostId): boolean {
  return state.trainer.level >= getPost(postId).unlockLevel;
}

export function unlockedPosts(state: GameState): readonly PostId[] {
  return POST_LIST.filter((post) => isPostUnlocked(state, post.id)).map((post) => post.id);
}

/** Precio de la siguiente plaza de Rancho: 500 · 2^k (GDD). */
export function ranchSlotPrice(state: GameState): number {
  const { slotBasePrice, slotPriceGrowth } = BALANCE.ranch;
  return Math.round(slotBasePrice * slotPriceGrowth ** Math.max(0, state.extraRanchSlots));
}

export function postUpgradeLevel(state: GameState, postId: PostId): number {
  return state.postUpgrades[postId] ?? 0;
}

/** Precio de la siguiente mejora de un puesto; dobla con cada nivel. */
export function postUpgradePrice(state: GameState, postId: PostId): number {
  const level = postUpgradeLevel(state, postId);
  return Math.round(getPost(postId).upgradeBasePrice * 2 ** level);
}

export type AssignFailure = 'unknown-creature' | 'locked-post' | 'ranch-full';

export interface AssignResult {
  readonly state: GameState;
  readonly assigned: boolean;
  readonly failure: AssignFailure | null;
}

function replaceCreature(state: GameState, next: CapturedCreature): GameState {
  return {
    ...state,
    creatures: state.creatures.map((creature) => (creature.uid === next.uid ? next : creature)),
  };
}

/**
 * Pone a una criatura en un puesto. Si estaba en la Reserva entra al Rancho,
 * siempre que queden plazas. Con `postId` a `null` se queda sin trabajar.
 */
export function assignToPost(state: GameState, uid: number, postId: PostId | null): AssignResult {
  const creature = findCreature(state, uid);
  if (creature === null) return { state, assigned: false, failure: 'unknown-creature' };
  if (postId !== null && !isPostUnlocked(state, postId)) {
    return { state, assigned: false, failure: 'locked-post' };
  }
  if (creature.location === 'reserve' && creaturesInRanch(state).length >= ranchSlots(state)) {
    return { state, assigned: false, failure: 'ranch-full' };
  }

  return {
    state: replaceCreature(state, { ...creature, location: 'ranch', postId }),
    assigned: true,
    failure: null,
  };
}

/** Manda una criatura a la Reserva: deja su plaza y su puesto. */
export function sendToReserve(state: GameState, uid: number): AssignResult {
  const creature = findCreature(state, uid);
  if (creature === null) return { state, assigned: false, failure: 'unknown-creature' };
  return {
    state: replaceCreature(state, { ...creature, location: 'reserve', postId: null }),
    assigned: true,
    failure: null,
  };
}

// --- rendimiento de cada criatura -------------------------------------------

/** Factor de saciedad del GDD: 1 por encima del umbral, 0,6 hasta 1 y 0 en seco. */
export function satietyFactor(satiety: number): number {
  if (satiety <= 0) return 0;
  return satiety > BALANCE.ranch.satietyThreshold ? 1 : BALANCE.ranch.satietyLowFactor;
}

/** Puntos de aptitud que aporta la criatura en su puesto (0 si no le va). */
export function skillAt(creature: CapturedCreature, postId: PostId): number {
  return getSpecies(creature.speciesId).skills[postId] ?? 0;
}

/**
 * Aportación efectiva de una criatura a su puesto:
 * `A · (1 + 0,05 (L − 1)) · rasgo · saciedad · tipo de zona`, por el doble si
 * es variocolor (GDD · Fórmulas).
 */
export function creatureOutput(
  state: GameState,
  creature: CapturedCreature,
  postId: PostId,
): number {
  const skill = skillAt(creature, postId);
  if (skill === 0) return 0;

  const level = 1 + BALANCE.ranch.levelProductionBonus * (creature.level - 1);
  const trait = getTrait(creature.traitId).production;
  const satiety = satietyFactor(creature.satiety);
  const zone = zoneTypeBonus(state, getSpecies(creature.speciesId).type);
  const shiny = creature.shiny ? BALANCE.ranch.shinyProductionBonus : 1;

  return skill * level * trait * satiety * zone * shiny;
}

/** +25 % a las criaturas del tipo favorecido de la zona activa (GDD). */
export function zoneTypeBonus(state: GameState, type: CreatureType): number {
  return getZone(state.activeZoneId).favoredType === type ? BALANCE.zone.favoredTypeMultiplier : 1;
}

/** Suma de aportaciones de un puesto, ya con su mejora comprada aplicada. */
export function postOutput(state: GameState, postId: PostId): number {
  if (!isPostUnlocked(state, postId)) return 0;
  const raw = creaturesAtPost(state, postId).reduce(
    (sum, creature) => sum + creatureOutput(state, creature, postId),
    0,
  );
  const upgrade = 1 + BALANCE.ranch.postUpgradeBonus * postUpgradeLevel(state, postId);
  return raw * upgrade;
}

// --- sinergias ---------------------------------------------------------------

export type SynergyEffect = 'berries' | 'mining' | 'cps';

export interface ActiveSynergy {
  readonly types: readonly [CreatureType, CreatureType];
  readonly effect: SynergyEffect;
  readonly bonus: number;
}

/** Pares de tipos presentes en el Rancho; cada par cuenta una vez (GDD). */
export function activeSynergies(state: GameState): readonly ActiveSynergy[] {
  const present = new Set(
    creaturesInRanch(state).map((creature) => getSpecies(creature.speciesId).type),
  );
  return BALANCE.ranch.synergies
    .filter((synergy) => synergy.types.every((type) => present.has(type)))
    .map((synergy) => ({
      types: synergy.types,
      effect: synergy.effect,
      bonus: synergy.bonus,
    }));
}

function synergyMultiplier(state: GameState, effect: SynergyEffect): number {
  return activeSynergies(state)
    .filter((synergy) => synergy.effect === effect)
    .reduce((factor, synergy) => factor * (1 + synergy.bonus), 1);
}

// --- producción del Rancho ---------------------------------------------------

export interface RanchProduction {
  /** Clics automáticos por segundo. */
  readonly cps: number;
  /** Bonus de minería que entra en la fórmula de monedas por clic. */
  readonly miningBonus: number;
  readonly berriesPerMinute: number;
  readonly orbsPerMinute: number;
  /** Descuento en los orbes de la tienda, de 0 a `maxOrbDiscount`. */
  readonly orbDiscount: number;
  /** Cuánto se acorta la espera entre apariciones, de 0 a `maxSpawnSpeed`. */
  readonly spawnSpeedBonus: number;
  /** XP por minuto que la Guardería reparte entre las criaturas del Rancho. */
  readonly nurseryXpPerMinute: number;
}

export function ranchProduction(state: GameState): RanchProduction {
  const { output } = BALANCE.ranch;
  const craft = postOutput(state, 'craft');
  const explore = postOutput(state, 'explore');

  return {
    cps: postOutput(state, 'gather') * output.cpsPerSkill * synergyMultiplier(state, 'cps'),
    miningBonus:
      postOutput(state, 'mine') * output.miningPerSkill * synergyMultiplier(state, 'mining'),
    berriesPerMinute:
      postOutput(state, 'farm') *
      output.berriesPerSkillPerMinute *
      synergyMultiplier(state, 'berries'),
    orbsPerMinute: craft * output.orbsPerSkillPerMinute,
    orbDiscount: Math.min(output.maxOrbDiscount, craft * output.orbDiscountPerSkill),
    spawnSpeedBonus: Math.min(output.maxSpawnSpeed, explore * output.spawnSpeedPerSkill),
    nurseryXpPerMinute: postOutput(state, 'care') * output.nurseryXpPerSkillPerMinute,
  };
}

// --- niveles de criatura ------------------------------------------------------

/** XP que necesita una criatura para pasar de nivel: 50 · 1,4^(L−1) (GDD). */
export function creatureXpForNextLevel(level: number): number {
  if (level >= BALANCE.ranch.maxCreatureLevel) return Number.POSITIVE_INFINITY;
  return Math.round(BALANCE.ranch.creatureXpBase * BALANCE.ranch.creatureXpGrowth ** (level - 1));
}

export interface CreatureXpResult {
  readonly creature: CapturedCreature;
  readonly levelsGained: number;
}

export function grantCreatureXp(creature: CapturedCreature, amount: number): CreatureXpResult {
  if (amount <= 0 || creature.level >= BALANCE.ranch.maxCreatureLevel) {
    return { creature, levelsGained: 0 };
  }
  let level = creature.level;
  let xp = creature.xp + amount;
  let levelsGained = 0;

  while (level < BALANCE.ranch.maxCreatureLevel) {
    const needed = creatureXpForNextLevel(level);
    if (xp < needed) break;
    xp -= needed;
    level += 1;
    levelsGained += 1;
  }
  if (level >= BALANCE.ranch.maxCreatureLevel) xp = 0;

  return { creature: { ...creature, level, xp }, levelsGained };
}

// --- avance del tiempo --------------------------------------------------------

export interface RanchGains {
  readonly coins: number;
  readonly berries: number;
  readonly orbs: number;
  readonly creatureXp: number;
  readonly levelUps: number;
  /** Bayas que el comedero repartió para que nadie se quedara a cero. */
  readonly berriesEaten: number;
  readonly elapsedMs: number;
}

export const NO_GAINS: RanchGains = {
  coins: 0,
  berries: 0,
  orbs: 0,
  creatureXp: 0,
  levelUps: 0,
  berriesEaten: 0,
  elapsedMs: 0,
};

export interface RanchStep {
  readonly state: GameState;
  readonly gains: RanchGains;
}

/**
 * Hace correr el Rancho `elapsedMs` milisegundos: produce, gasta saciedad,
 * reparte bayas desde el comedero y entrega la XP de la Guardería.
 *
 * `factor` permite aplicar el mismo cálculo al progreso offline, que rinde la
 * mitad (GDD). La producción de monedas la calcula quien llama, porque
 * depende de las monedas por clic (`economy`).
 */
export function advanceRanch(
  state: GameState,
  elapsedMs: number,
  coinsPerClickValue: number,
  factor = 1,
): RanchStep {
  if (elapsedMs <= 0 || factor <= 0) return { state, gains: NO_GAINS };

  const minutes = (elapsedMs / MINUTE) * factor;
  const seconds = (elapsedMs / 1000) * factor;
  const production = ranchProduction(state);

  const coins = production.cps * seconds * coinsPerClickValue;
  const berriesGrown = production.berriesPerMinute * minutes;
  const orbProgress = state.orbProgress + production.orbsPerMinute * minutes;
  const orbs = Math.floor(orbProgress);
  const xpEach = production.nurseryXpPerMinute * minutes;

  // Saciedad: solo gasta quien está trabajando de verdad en un puesto.
  const drain = BALANCE.ranch.satietyDrainPerMinute * (elapsedMs / MINUTE);
  let berries = state.berries + berriesGrown;
  let berriesEaten = 0;
  let creatureXp = 0;
  let levelUps = 0;

  const creatures = state.creatures.map((creature) => {
    if (creature.location !== 'ranch') return creature;

    let next = creature;
    if (creature.postId !== null && skillAt(creature, creature.postId) > 0) {
      const appetite = getTrait(creature.traitId).berryUse;
      let satiety = Math.max(0, creature.satiety - drain * appetite);

      // El comedero reparte solas las bayas que haya (GDD).
      while (satiety < BALANCE.ranch.feederThreshold && berries >= 1) {
        berries -= 1;
        berriesEaten += 1;
        satiety = Math.min(100, satiety + BALANCE.ranch.berryRestore);
      }
      next = { ...next, satiety };
    }

    if (xpEach > 0) {
      const result = grantCreatureXp(next, xpEach);
      next = result.creature;
      creatureXp += xpEach;
      levelUps += result.levelsGained;
    }
    return next;
  });

  return {
    state: {
      ...state,
      coins: state.coins + coins,
      berries,
      orbs: orbs > 0 ? { ...state.orbs, basic: (state.orbs.basic ?? 0) + orbs } : state.orbs,
      orbProgress: orbProgress - orbs,
      creatures,
      stats: { ...state.stats, totalCoinsEarned: state.stats.totalCoinsEarned + coins },
    },
    gains: {
      coins,
      berries: berriesGrown,
      orbs,
      creatureXp,
      levelUps,
      berriesEaten,
      elapsedMs,
    },
  };
}

/**
 * Progreso de la ausencia: la mitad de la producción y como mucho 8 horas
 * (GDD). Devuelve `null` si el jugador apenas se ha ido.
 */
export function offlineProgress(
  state: GameState,
  now: number,
  coinsPerClickValue: number,
): RanchStep | null {
  const away = now - state.lastSeenAt;
  if (away < BALANCE.ranch.offline.minMs) return null;

  const counted = Math.min(away, BALANCE.ranch.offline.maxMs);
  const step = advanceRanch(state, counted, coinsPerClickValue, BALANCE.ranch.offline.factor);
  return {
    state: { ...step.state, lastSeenAt: now },
    gains: { ...step.gains, elapsedMs: away },
  };
}
