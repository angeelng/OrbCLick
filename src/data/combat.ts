import type { CreatureType } from './types';

/**
 * Tabla de tipos del GDD: ×1,5 al tipo débil, ×0,67 al que resiste.
 * Se lee «atacante → a quién pega fuerte».
 */
export const TYPE_CHART: Readonly<Record<CreatureType, readonly CreatureType[]>> = {
  plant: ['water', 'rock'],
  fire: ['plant'],
  water: ['fire', 'rock'],
  rock: ['fire', 'air', 'electric'],
  electric: ['water', 'air'],
  air: ['plant'],
};

/** Efectos que puede tener una habilidad activa en el MVP (GDD · Combate). */
export const ABILITY_KINDS = ['damage', 'heal', 'shield', 'sleep'] as const;

export type AbilityKind = (typeof ABILITY_KINDS)[number];

export interface AbilityDefinition {
  readonly name: string;
  readonly kind: AbilityKind;
  /**
   * Qué tan fuerte es, en la unidad de su efecto: multiplicador de ataque
   * para el daño, fracción de PV para la cura y el escudo, y segundos de
   * sueño para adormecer.
   */
  readonly power: number;
  /** Cuánto tarda en cargarse, entre 10 y 20 s (GDD). */
  readonly chargeMs: number;
}

export const ABILITY_KIND_NAMES: Readonly<Record<AbilityKind, string>> = {
  damage: 'Daño',
  heal: 'Curación',
  shield: 'Escudo',
  sleep: 'Adormecer',
};

/** Estadísticas base de combate de una especie (GDD · Ficha de especie). */
export interface CombatStats {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly spd: number;
}
