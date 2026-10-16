import type { SpeciesId } from './species';
import { ZONE_LIST, type ZoneId } from './zones';

/**
 * Los tres jefes del MVP (GDD · Combate y jefes de zona). Aquí vive lo
 * descriptivo: a qué zona pertenece cada uno y cuál es su mecánica. Los
 * números de la mecánica están en `balance.ts`.
 */
export const BOSS_MECHANIC_IDS = ['regrowth', 'stoneShield', 'tideWave'] as const;

export type BossMechanicId = (typeof BOSS_MECHANIC_IDS)[number];

export interface BossDefinition {
  readonly zoneId: ZoneId;
  readonly speciesId: SpeciesId;
  readonly mechanic: BossMechanicId;
  readonly mechanicName: string;
  /** Qué hace la mecánica, en una línea, para avisar antes de retarlo. */
  readonly mechanicHint: string;
}

export const BOSSES: Readonly<Record<ZoneId, BossDefinition>> = {
  meadow: {
    zoneId: 'meadow',
    speciesId: 'cornavid',
    mechanic: 'regrowth',
    mechanicName: 'Rebrote',
    mechanicHint: 'Se cura cada pocos segundos: hay que meterle daño rápido.',
  },
  cave: {
    zoneId: 'cave',
    speciesId: 'geodron',
    mechanic: 'stoneShield',
    mechanicName: 'Escudo de piedra',
    mechanicHint: 'Levanta un escudo que solo rompen tus clics.',
  },
  lake: {
    zoneId: 'lake',
    speciesId: 'marealis',
    mechanic: 'tideWave',
    mechanicName: 'Oleada',
    mechanicHint: 'Cada poco golpea a todo el equipo a la vez.',
  },
};

export const BOSS_LIST: readonly BossDefinition[] = ZONE_LIST.map((zone) => BOSSES[zone.id]);

export function getBoss(zoneId: ZoneId): BossDefinition {
  return BOSSES[zoneId];
}

/** Zona que defiende un jefe, o `null` si la especie no es un jefe. */
export function bossZoneOf(speciesId: SpeciesId): ZoneId | null {
  return BOSS_LIST.find((boss) => boss.speciesId === speciesId)?.zoneId ?? null;
}
