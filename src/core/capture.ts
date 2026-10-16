import { BALANCE } from '../data/balance';
import { getOrb, orbMultiplierAgainst, type OrbId } from '../data/orbs';
import {
  getSpecies,
  wildRosterOf,
  type Rarity,
  type SpeciesDefinition,
  type SpeciesId,
} from '../data/species';
import { TRAIT_LIST, type TraitId } from '../data/traits';
import { ZONE_ORDER, type ZoneId } from '../data/zones';
import { coinsPerClick } from './economy';
import { creaturesInRanch, ranchProduction, ranchSlots } from './ranch';
import type { Rng } from './rng';
import type { CapturedCreature, GameState, WildEncounter } from './state';

/**
 * Apariciones, debilitamiento y captura (GDD · Captura). Todo es puro: el
 * tiempo y el azar entran como parámetros y la semilla resultante vuelve al
 * estado, así una partida se puede reproducir entera.
 */

/** PV de una salvaje: 15 en la Pradera, ×1,8 por zona y ×2 por escalón de rareza. */
export function wildHp(species: SpeciesDefinition): number {
  const { baseWildHp, hpPerZone, hpPerRarityStep } = BALANCE.capture;
  const zoneStep = ZONE_ORDER[species.zoneId];
  const rarityStep = rarityIndex(species.rarity);
  return Math.round(baseWildHp * hpPerZone ** zoneStep * hpPerRarityStep ** rarityStep);
}

const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export function rarityIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function spawnWeightOf(rarity: Rarity): number {
  return BALANCE.rarity[rarity].spawnWeight;
}

export function captureXpOf(rarity: Rarity): number {
  return BALANCE.rarity[rarity].captureXp;
}

/** Elige una salvaje de la zona por peso de rareza; `null` si la zona no tiene. */
export function pickWildSpecies(zoneId: ZoneId, rng: Rng): SpeciesDefinition | null {
  const roster = wildRosterOf(zoneId).filter((species) => spawnWeightOf(species.rarity) > 0);
  const total = roster.reduce((sum, species) => sum + spawnWeightOf(species.rarity), 0);
  if (total <= 0) return null;

  let ticket = rng.float() * total;
  for (const species of roster) {
    ticket -= spawnWeightOf(species.rarity);
    if (ticket < 0) return species;
  }
  return roster[roster.length - 1] ?? null;
}

/**
 * Espera hasta la siguiente aparición, entre 45 y 90 s. El Puesto de
 * exploración la acorta (GDD).
 */
export function rollSpawnDelay(state: GameState, rng: Rng): number {
  const base = rng.range(BALANCE.capture.spawnMinMs, BALANCE.capture.spawnMaxMs);
  return Math.round(base * (1 - ranchProduction(state).spawnSpeedBonus));
}

export function rollTrait(rng: Rng): TraitId {
  const trait = TRAIT_LIST[rng.int(0, TRAIT_LIST.length - 1)];
  return trait?.id ?? 'hardworking';
}

export function rollShiny(rng: Rng): boolean {
  return rng.int(1, BALANCE.capture.shinyOdds) === 1;
}

export function isSpawnDue(state: GameState, now: number): boolean {
  return state.encounter === null && now >= state.nextSpawnAt;
}

/** Hace aparecer una salvaje en la zona activa. */
export function spawnEncounter(state: GameState, now: number, rng: Rng): GameState {
  const species = pickWildSpecies(state.activeZoneId, rng);
  if (species === null) {
    return { ...state, nextSpawnAt: now + rollSpawnDelay(state, rng), rngSeed: rng.seed() };
  }

  const hp = wildHp(species);
  const encounter: WildEncounter = {
    speciesId: species.id,
    hp,
    maxHp: hp,
    shiny: rollShiny(rng),
    appearedAt: now,
    fleesAt: now + BALANCE.capture.encounterMs,
  };
  return { ...state, encounter, rngSeed: rng.seed() };
}

/** Quita la salvaje y programa la siguiente aparición. */
export function clearEncounter(state: GameState, now: number, rng: Rng): GameState {
  return {
    ...state,
    encounter: null,
    nextSpawnAt: now + rollSpawnDelay(state, rng),
    rngSeed: rng.seed(),
  };
}

export function hasEncounterExpired(state: GameState, now: number): boolean {
  return state.encounter !== null && now >= state.encounter.fleesAt;
}

/**
 * Las raras o mejores no se dejan debilitar a clics: hay que vencerlas con el
 * equipo antes de lanzarles el orbe (GDD · Captura).
 */
export function requiresBattle(encounter: WildEncounter): boolean {
  return rarityIndex(getSpecies(encounter.speciesId).rarity) >= BALANCE.combat.battleRarityStep;
}

/** Un clic sobre la salvaje le quita PV; nunca baja de 0. */
export function damageEncounter(state: GameState, damage: number): GameState {
  const { encounter } = state;
  if (encounter === null || damage <= 0) return state;
  const hp = Math.max(0, encounter.hp - damage);
  if (hp === encounter.hp) return state;
  return { ...state, encounter: { ...encounter, hp } };
}

/**
 * XP por quitarle PV: la parte proporcional de `weakenXpShare` según el daño
 * hecho. Se reparte golpe a golpe, así que debilitar paga aunque la criatura
 * acabe huyendo.
 */
export function weakenXp(encounter: WildEncounter, damage: number): number {
  if (damage <= 0) return 0;
  const species = getSpecies(encounter.speciesId);
  const share = Math.min(1, damage / encounter.maxHp);
  return captureXpOf(species.rarity) * BALANCE.capture.weakenXpShare * share;
}

/** XP extra por el golpe que la derriba. */
export function defeatXp(encounter: WildEncounter): number {
  const species = getSpecies(encounter.speciesId);
  return captureXpOf(species.rarity) * BALANCE.capture.defeatXpShare;
}

/**
 * Monedas por rematar a una salvaje: `PV_max · M_clic · bonus_rareza`.
 * Al morir se pierde la criatura, así que es el premio de consolación de
 * quien prefiere el dinero rápido a llenar el Rancho.
 */
export function defeatReward(state: GameState, encounter: WildEncounter): number {
  const species = getSpecies(encounter.speciesId);
  const bonus = BALANCE.defeat.rarityBonus[species.rarity];
  return Math.round(encounter.maxHp * coinsPerClick(state) * bonus);
}

/**
 * Probabilidad de captura (GDD):
 * `p = min(0,95; b_rareza · m_orbe · (1 + 1,5 · (1 − PV/PV_max)))`.
 */
export function captureChance(encounter: WildEncounter, orbId: OrbId): number {
  const species = getSpecies(encounter.speciesId);
  /*
   * Un jefe solo llega al orbe tras caer en combate, y para entonces el GDD
   * promete captura garantizada con el Orbe lunar o mejor: tumbarlo ya ha
   * sido la prueba, así que no se juega otra tirada encima.
   */
  if (species.isBoss && getOrb(orbId).guaranteesBoss) return 1;

  const base = BALANCE.rarity[species.rarity].captureBase;
  const orb = orbMultiplierAgainst(getOrb(orbId), species.type);
  const weakened = 1 - encounter.hp / encounter.maxHp;
  const chance = base * orb * (1 + BALANCE.capture.weakenWeight * weakened);
  return Math.min(BALANCE.capture.maxCaptureChance, chance);
}

export function orbCount(state: GameState, orbId: OrbId): number {
  return state.orbs[orbId] ?? 0;
}

/** Añade un ejemplar recién capturado; va a la Reserva si el Rancho está lleno. */
export function addCapturedCreature(
  state: GameState,
  speciesId: SpeciesId,
  shiny: boolean,
  now: number,
  rng: Rng,
): { state: GameState; creature: CapturedCreature } {
  const toReserve = creaturesInRanch(state).length >= ranchSlots(state);
  const creature: CapturedCreature = {
    uid: state.nextCreatureUid,
    speciesId,
    level: 1,
    xp: 0,
    traitId: rollTrait(rng),
    shiny,
    satiety: 100,
    location: toReserve ? 'reserve' : 'ranch',
    postId: null,
    exhaustedUntil: 0,
    capturedAt: now,
  };
  return {
    state: {
      ...state,
      creatures: [...state.creatures, creature],
      nextCreatureUid: state.nextCreatureUid + 1,
      rngSeed: rng.seed(),
    },
    creature,
  };
}

export type ThrowFailure = 'no-encounter' | 'no-orbs' | 'locked';

export interface ThrowResult {
  readonly state: GameState;
  /** A quién se le lanzó el orbe; sirve para los mensajes aunque ya no esté. */
  readonly speciesId: SpeciesId | null;
  readonly captured: boolean;
  /** La criatura huyó tras fallar el orbe. */
  readonly fled: boolean;
  readonly chance: number;
  readonly creature: CapturedCreature | null;
  readonly xpGained: number;
  readonly failure: ThrowFailure | null;
}

/**
 * Lanza un orbe a la salvaje. Gasta el orbe pase lo que pase; si falla, la
 * criatura tiene un 50 % de huir.
 */
export function throwOrb(state: GameState, orbId: OrbId, now: number, rng: Rng): ThrowResult {
  const refuse = (failure: ThrowFailure): ThrowResult => ({
    state,
    speciesId: null,
    captured: false,
    fled: false,
    chance: 0,
    creature: null,
    xpGained: 0,
    failure,
  });

  const { encounter } = state;
  if (encounter === null) return refuse('no-encounter');
  if (orbCount(state, orbId) < 1) return refuse('no-orbs');
  if (state.trainer.level < getOrb(orbId).unlockLevel) return refuse('locked');

  const chance = captureChance(encounter, orbId);
  const spent: GameState = {
    ...state,
    orbs: { ...state.orbs, [orbId]: orbCount(state, orbId) - 1 },
  };

  if (rng.chance(chance)) {
    const species = getSpecies(encounter.speciesId);
    const added = addCapturedCreature(spent, species.id, encounter.shiny, now, rng);
    return {
      state: clearEncounter(added.state, now, rng),
      speciesId: species.id,
      captured: true,
      fled: false,
      chance,
      creature: added.creature,
      xpGained: captureXpOf(species.rarity),
      failure: null,
    };
  }

  const fled = rng.chance(BALANCE.capture.fleeAfterFailChance);
  return {
    state: fled ? clearEncounter(spent, now, rng) : { ...spent, rngSeed: rng.seed() },
    speciesId: encounter.speciesId,
    captured: false,
    fled,
    chance,
    creature: null,
    xpGained: 0,
    failure: null,
  };
}
