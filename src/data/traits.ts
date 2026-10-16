/** Rasgo aleatorio que recibe cada ejemplar al capturarlo (GDD · Criaturas). */
export const TRAIT_IDS = ['hardworking', 'lazy', 'brave', 'sturdy', 'greedy', 'lucky'] as const;

export type TraitId = (typeof TRAIT_IDS)[number];

export interface TraitDefinition {
  readonly id: TraitId;
  readonly name: string;
  readonly description: string;
  /** Multiplicador de producción en el Rancho (fase 4). */
  readonly production: number;
  /** Multiplicadores de combate (fase 5). */
  readonly attack: number;
  readonly health: number;
  /** Multiplicador de botín (fase 3). */
  readonly loot: number;
  /** Multiplicador de consumo de bayas (fase 4). */
  readonly berryUse: number;
}

function define(
  id: TraitId,
  name: string,
  description: string,
  effects: Partial<Omit<TraitDefinition, 'id' | 'name' | 'description'>>,
): TraitDefinition {
  return {
    id,
    name,
    description,
    production: 1,
    attack: 1,
    health: 1,
    loot: 1,
    berryUse: 1,
    ...effects,
  };
}

export const TRAITS: Readonly<Record<TraitId, TraitDefinition>> = {
  hardworking: define('hardworking', 'Laboriosa', '+10 % de producción', { production: 1.1 }),
  lazy: define('lazy', 'Perezosa', '−5 % de producción', { production: 0.95 }),
  brave: define('brave', 'Valiente', '+10 % de ataque', { attack: 1.1 }),
  sturdy: define('sturdy', 'Robusta', '+10 % de PV', { health: 1.1 }),
  greedy: define('greedy', 'Glotona', '+15 % de producción, gasta el doble de bayas', {
    production: 1.15,
    berryUse: 2,
  }),
  lucky: define('lucky', 'Afortunada', '+5 % de botín', { loot: 1.05 }),
};

export const TRAIT_LIST: readonly TraitDefinition[] = TRAIT_IDS.map((id) => TRAITS[id]);

export function getTrait(id: TraitId): TraitDefinition {
  return TRAITS[id];
}

export function isTraitId(value: unknown): value is TraitId {
  return typeof value === 'string' && (TRAIT_IDS as readonly string[]).includes(value);
}
