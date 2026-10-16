import type { CreatureType } from './types';

/** Orbes de captura del MVP; el Orbe maestro queda fuera (GDD · Captura). */
export const ORB_IDS = ['basic', 'net', 'lunar'] as const;

export type OrbId = (typeof ORB_IDS)[number];

export interface OrbDefinition {
  readonly id: OrbId;
  readonly name: string;
  readonly description: string;
  /** Multiplicador sobre la probabilidad base de la rareza. */
  readonly multiplier: number;
  /** Multiplicador alternativo contra un tipo concreto (Orbe de red). */
  readonly againstType: { readonly type: CreatureType; readonly multiplier: number } | null;
  /**
   * Asegura la captura de un jefe debilitado (GDD: «con Orbe lunar o
   * superior»). Con los orbes corrientes un jefe sigue siendo una lotería.
   */
  readonly guaranteesBoss: boolean;
  readonly price: number;
  readonly unlockLevel: number;
}

export const ORBS: Readonly<Record<OrbId, OrbDefinition>> = {
  basic: {
    id: 'basic',
    name: 'Orbe básico',
    description: 'El orbe de siempre. Barato y honesto.',
    multiplier: 1,
    againstType: null,
    guaranteesBoss: false,
    price: 50,
    unlockLevel: 1,
  },
  net: {
    id: 'net',
    name: 'Orbe de red',
    description: 'Se abre en una malla fina; las criaturas de Agua no escapan.',
    multiplier: 1.5,
    againstType: { type: 'water', multiplier: 2 },
    guaranteesBoss: false,
    price: 250,
    unlockLevel: 4,
  },
  lunar: {
    id: 'lunar',
    name: 'Orbe lunar',
    description: 'Brilla aunque no haya luna. Caro por algo.',
    multiplier: 2.5,
    againstType: null,
    guaranteesBoss: true,
    price: 1_500,
    unlockLevel: 9,
  },
};

export const ORB_LIST: readonly OrbDefinition[] = ORB_IDS.map((id) => ORBS[id]);

export function getOrb(id: OrbId): OrbDefinition {
  return ORBS[id];
}

export function isOrbId(value: unknown): value is OrbId {
  return typeof value === 'string' && (ORB_IDS as readonly string[]).includes(value);
}

/** Multiplicador del orbe frente a una criatura de un tipo dado. */
export function orbMultiplierAgainst(orb: OrbDefinition, type: CreatureType): number {
  return orb.againstType !== null && orb.againstType.type === type
    ? orb.againstType.multiplier
    : orb.multiplier;
}
