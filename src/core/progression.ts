import { BALANCE } from '../data/balance';
import { UPGRADE_LIST, type UpgradeDefinition } from '../data/items';
import { nextUnlockAfter, type LevelUnlock } from '../data/unlocks';
import { ZONE_LIST, getZone, type ZoneDefinition, type ZoneId } from '../data/zones';
import type { BossProgress, GameState, TrainerState } from './state';

/** XP necesaria para pasar del nivel `level` al siguiente: base · growth^(n-1). */
export function xpForNextLevel(level: number): number {
  if (level >= BALANCE.trainer.maxLevel) return Number.POSITIVE_INFINITY;
  const { xpBase, xpGrowth } = BALANCE.trainer;
  return Math.round(xpBase * Math.pow(xpGrowth, level - 1));
}

export function isMaxLevel(trainer: TrainerState): boolean {
  return trainer.level >= BALANCE.trainer.maxLevel;
}

/** Progreso dentro del nivel actual, de 0 a 1. Al nivel máximo, 1. */
export function levelProgress(trainer: TrainerState): number {
  if (isMaxLevel(trainer)) return 1;
  const needed = xpForNextLevel(trainer.level);
  return Math.min(1, trainer.xp / needed);
}

export interface TrainerXpResult {
  readonly trainer: TrainerState;
  readonly levelsGained: number;
}

/** Suma XP y resuelve todas las subidas de nivel que correspondan. */
export function grantTrainerXp(trainer: TrainerState, amount: number): TrainerXpResult {
  if (amount <= 0 || isMaxLevel(trainer)) {
    return { trainer, levelsGained: 0 };
  }
  let level = trainer.level;
  let xp = trainer.xp + amount;
  let levelsGained = 0;

  while (level < BALANCE.trainer.maxLevel) {
    const needed = xpForNextLevel(level);
    if (xp < needed) break;
    xp -= needed;
    level += 1;
    levelsGained += 1;
  }
  // Al tocar el máximo la XP sobrante se descarta: no hay nada que desbloquear.
  if (level >= BALANCE.trainer.maxLevel) xp = 0;

  return { trainer: { level, xp }, levelsGained };
}

/** ¿Ha llegado el jugador al nivel que pone esta mejora a la venta? */
export function isUpgradeUnlocked(state: GameState, upgrade: UpgradeDefinition): boolean {
  return state.trainer.level >= upgrade.unlockLevel;
}

/** Mejoras visibles en la tienda, en el orden en que se desbloquean. */
export function availableUpgrades(state: GameState): readonly UpgradeDefinition[] {
  return UPGRADE_LIST.filter((upgrade) => isUpgradeUnlocked(state, upgrade));
}

/** Próximo desbloqueo por nivel, para anunciarlo en la interfaz. */
export function nextUnlock(state: GameState): LevelUnlock | null {
  return nextUnlockAfter(state.trainer.level);
}

// --- zonas y jefes -------------------------------------------------------------

/** ¿Está la zona ya en la lista de desbloqueadas de la partida? */
export function isZoneUnlocked(state: GameState, zoneId: ZoneId): boolean {
  return state.unlockedZoneIds.includes(zoneId);
}

export function bossProgress(state: GameState, zoneId: ZoneId): BossProgress {
  return state.bosses[zoneId] ?? { defeated: false, availableAt: 0 };
}

export function isBossDefeated(state: GameState, zoneId: ZoneId): boolean {
  return bossProgress(state, zoneId).defeated;
}

/** El jefe de la zona se deja retar a partir del nivel que dice el GDD. */
export function isBossAvailableByLevel(state: GameState, zoneId: ZoneId): boolean {
  return state.trainer.level >= getZone(zoneId).bossLevel;
}

/**
 * Por qué no se puede retar al jefe ahora mismo, o `null` si sí se puede.
 * Vencerlo no lo retira: pasado el enfriamiento vuelve a estar disponible
 * para farmear (GDD).
 */
export type BossBlock = 'zone-locked' | 'level' | 'cooldown';

export function bossBlock(state: GameState, zoneId: ZoneId, now: number): BossBlock | null {
  if (!isZoneUnlocked(state, zoneId)) return 'zone-locked';
  if (!isBossAvailableByLevel(state, zoneId)) return 'level';
  if (now < bossProgress(state, zoneId).availableAt) return 'cooldown';
  return null;
}

/** Lo que falta para entrar en la zona, o `null` si ya se cumple todo. */
export type ZoneBlock = 'level' | 'boss';

export function zoneBlock(state: GameState, zoneId: ZoneId): ZoneBlock | null {
  const zone = getZone(zoneId);
  if (state.trainer.level < zone.unlockLevel) return 'level';
  if (zone.requiresBossOf !== null && !isBossDefeated(state, zone.requiresBossOf)) return 'boss';
  return null;
}

/** ¿Cumple la partida las dos condiciones del GDD (nivel + jefe anterior)? */
export function canEnterZone(state: GameState, zoneId: ZoneId): boolean {
  return zoneBlock(state, zoneId) === null;
}

/**
 * Apunta como desbloqueada toda zona cuyas condiciones ya se cumplan. Se
 * llama en cada tick, así da igual el orden en que lleguen el nivel y el
 * jefe: en cuanto están los dos, la zona entra en la lista y se queda.
 */
export function refreshZoneUnlocks(state: GameState): GameState {
  const unlocked = ZONE_LIST.filter(
    (zone) => isZoneUnlocked(state, zone.id) || canEnterZone(state, zone.id),
  ).map((zone) => zone.id);

  const same =
    unlocked.length === state.unlockedZoneIds.length &&
    unlocked.every((zoneId, index) => state.unlockedZoneIds[index] === zoneId);
  if (same) return state;
  return { ...state, unlockedZoneIds: unlocked };
}

/** Zonas que el jugador puede visitar hoy, en orden de profundidad. */
export function unlockedZones(state: GameState): readonly ZoneDefinition[] {
  return ZONE_LIST.filter((zone) => isZoneUnlocked(state, zone.id));
}
