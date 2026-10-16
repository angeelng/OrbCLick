/**
 * Artículos de la tienda. Las categorías de captura, Rancho y consumibles
 * llegan con sus fases (3, 4 y 5); aquí solo viven las mejoras de clic.
 */
export const UPGRADE_IDS = ['gloves-1', 'gloves-2', 'gloves-3', 'gloves-4', 'gloves-5'] as const;

export type UpgradeId = (typeof UPGRADE_IDS)[number];

export const SHOP_CATEGORIES = ['click', 'capture', 'ranch', 'consumable'] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly name: string;
  readonly description: string;
  readonly category: ShopCategory;
  /** Precio de la primera unidad; las siguientes van a base · 1,15^cantidad. */
  readonly basePrice: number;
  /** Monedas planas que suma al clic por cada unidad comprada. */
  readonly flatBonus: number;
  /**
   * XP de entrenador que suma al clic por cada unidad comprada, en tanto por
   * uno sobre la XP base. Los guantes no solo pegan más fuerte: también
   * enseñan más, y son el único acelerador de nivel que depende del jugador.
   */
  readonly xpBonus: number;
  /** Nivel de entrenador que la pone a la venta. */
  readonly unlockLevel: number;
}

/**
 * Guantes de entrenador I–V: cinco escalones repetibles de bonus plano y de
 * XP por clic. El GDD solo fija el primero (100 monedas, +1); el resto sigue
 * su curva de desbloqueo por nivel. La XP sube bastante por unidad para que
 * comprar guantes se note también en la barra de nivel y no solo en las
 * monedas: con los diez primeros el clic ya da el triple de XP, y con los
 * cinco al tope, quince veces la base.
 */
export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDefinition>> = {
  'gloves-1': {
    id: 'gloves-1',
    name: 'Guantes de entrenador I',
    description: 'Unos guantes gastados que agarran mejor la corteza.',
    category: 'click',
    basePrice: 100,
    flatBonus: 1,
    xpBonus: 0.2,
    unlockLevel: 1,
  },
  'gloves-2': {
    id: 'gloves-2',
    name: 'Guantes de entrenador II',
    description: 'Cuero reforzado: cada golpe suelta mucho más.',
    category: 'click',
    basePrice: 1_000,
    flatBonus: 5,
    xpBonus: 0.25,
    unlockLevel: 7,
  },
  'gloves-3': {
    id: 'gloves-3',
    name: 'Guantes de entrenador III',
    description: 'Con placas de cristal de la Cueva en los nudillos.',
    category: 'click',
    basePrice: 10_000,
    flatBonus: 25,
    xpBonus: 0.3,
    unlockLevel: 10,
  },
  'gloves-4': {
    id: 'gloves-4',
    name: 'Guantes de entrenador IV',
    description: 'Tejidos con fibra de manantial, ligeros y durísimos.',
    category: 'click',
    basePrice: 100_000,
    flatBonus: 120,
    xpBonus: 0.35,
    unlockLevel: 12,
  },
  'gloves-5': {
    id: 'gloves-5',
    name: 'Guantes de entrenador V',
    description: 'La obra maestra del taller: un golpe vale por cien.',
    category: 'click',
    basePrice: 1_000_000,
    flatBonus: 600,
    xpBonus: 0.4,
    unlockLevel: 15,
  },
};

export const UPGRADE_LIST: readonly UpgradeDefinition[] = UPGRADE_IDS.map((id) => UPGRADES[id]);

export function getUpgrade(id: UpgradeId): UpgradeDefinition {
  return UPGRADES[id];
}

export function isUpgradeId(value: unknown): value is UpgradeId {
  return typeof value === 'string' && (UPGRADE_IDS as readonly string[]).includes(value);
}
