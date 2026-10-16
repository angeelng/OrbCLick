import type { SpeciesId } from './species';
import type { CreatureType } from './types';

/**
 * Las tres zonas del MVP (GDD · Zonas del MVP). Desde la fase 6 las tres son
 * jugables: cada una tiene su objeto clicable, su tipo favorecido, su roster y
 * el jefe que abre la siguiente.
 */
export const ZONE_IDS = ['meadow', 'cave', 'lake'] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

export interface ZoneDefinition {
  readonly id: ZoneId;
  readonly name: string;
  /** Tipo favorecido: sus criaturas producen más mientras la zona está activa. */
  readonly favoredType: CreatureType;
  /** Sprite del objeto clicable (64×64 lógicos). */
  readonly clickableSpriteId: string;
  readonly clickableName: string;
  /** Qué se clica, en una línea, para el texto de ayuda de la columna. */
  readonly clickHint: string;
  /**
   * Colores de fondo del canvas de zona: `sky` arriba, `ground` abajo,
   * `accent` la línea del horizonte, `far` el relieve del fondo y `detail`
   * las motas del suelo.
   */
  readonly palette: {
    readonly sky: string;
    readonly ground: string;
    readonly accent: string;
    readonly far: string;
    readonly detail: string;
  };
  /**
   * Cómo se arma el fondo: `open` cuelga nubes del cielo y colinas del
   * horizonte; `cavern` cambia las nubes por estalactitas del techo.
   */
  readonly backdrop: 'open' | 'cavern';
  /** Nivel de entrenador mínimo para poner un pie en la zona. */
  readonly unlockLevel: number;
  /**
   * Jefe que hay que haber vencido antes de entrar, o `null` si no hace falta.
   * Con el nivel es la otra mitad del desbloqueo (GDD: nivel + jefe).
   */
  readonly requiresBossOf: ZoneId | null;
  readonly bossSpeciesId: SpeciesId;
  /** Nivel al que el jefe de la zona se deja retar. */
  readonly bossLevel: number;
}

export const ZONES: Readonly<Record<ZoneId, ZoneDefinition>> = {
  meadow: {
    id: 'meadow',
    name: 'Pradera',
    favoredType: 'plant',
    clickableSpriteId: 'clickable/berry-tree',
    clickableName: 'Árbol de bayas gigante',
    clickHint: 'Clica el árbol para ganar monedas y XP',
    palette: {
      sky: '#cfe6f2',
      ground: '#8cbf7a',
      accent: '#6b9a58',
      far: '#a8d49b',
      detail: '#6b9a58',
    },
    backdrop: 'open',
    unlockLevel: 1,
    requiresBossOf: null,
    bossSpeciesId: 'cornavid',
    bossLevel: 5,
  },
  cave: {
    id: 'cave',
    name: 'Cueva',
    favoredType: 'rock',
    clickableSpriteId: 'clickable/crystal-vein',
    clickableName: 'Veta de cristal',
    clickHint: 'Clica la veta para ganar monedas y XP',
    palette: {
      sky: '#564d75',
      ground: '#8a7f9e',
      accent: '#6b6281',
      far: '#6e648c',
      detail: '#a79cbd',
    },
    backdrop: 'cavern',
    unlockLevel: 5,
    requiresBossOf: 'meadow',
    bossSpeciesId: 'geodron',
    bossLevel: 10,
  },
  lake: {
    id: 'lake',
    name: 'Lago',
    favoredType: 'water',
    clickableSpriteId: 'clickable/spring',
    clickableName: 'Manantial burbujeante',
    clickHint: 'Clica el manantial para ganar monedas y XP',
    palette: {
      sky: '#bfe0ef',
      ground: '#74aedc',
      accent: '#5b94c4',
      far: '#9ccde8',
      detail: '#b2d8f0',
    },
    backdrop: 'open',
    unlockLevel: 10,
    requiresBossOf: 'cave',
    bossSpeciesId: 'marealis',
    bossLevel: 15,
  },
};

export const ZONE_LIST: readonly ZoneDefinition[] = ZONE_IDS.map((id) => ZONES[id]);

/** Nombre de cada zona, para los textos que solo tienen el id a mano. */
export const ZONE_NAMES: Readonly<Record<ZoneId, string>> = {
  meadow: ZONES.meadow.name,
  cave: ZONES.cave.name,
  lake: ZONES.lake.name,
};

/** Orden de las zonas: los PV de las salvajes suben ×1,8 por escalón (GDD). */
export const ZONE_ORDER: Readonly<Record<ZoneId, number>> = {
  meadow: 0,
  cave: 1,
  lake: 2,
};

export const STARTING_ZONE_ID: ZoneId = 'meadow';

export function getZone(id: ZoneId): ZoneDefinition {
  return ZONES[id];
}

export function isZoneId(value: unknown): value is ZoneId {
  return typeof value === 'string' && (ZONE_IDS as readonly string[]).includes(value);
}

/** La zona a la que abre paso vencer al jefe de `zoneId`, si hay alguna. */
export function zoneUnlockedByBossOf(zoneId: ZoneId): ZoneDefinition | null {
  return ZONE_LIST.find((zone) => zone.requiresBossOf === zoneId) ?? null;
}
