import type { WorkSkill } from './species';

/**
 * Puestos del Rancho (GDD · Rancho y trabajo). Cada puesto usa una aptitud,
 * así que hay uno por aptitud y el identificador es el mismo.
 */
export type PostId = WorkSkill;

export const POST_IDS = ['gather', 'mine', 'farm', 'explore', 'craft', 'care'] as const;

export interface PostDefinition {
  readonly id: PostId;
  readonly name: string;
  /** Qué produce, en una línea, para la interfaz. */
  readonly output: string;
  readonly description: string;
  /** Nivel de entrenador que abre el puesto (GDD · Progresión). */
  readonly unlockLevel: number;
  /** Precio de la primera mejora; las siguientes doblan. */
  readonly upgradeBasePrice: number;
}

export const POSTS: Readonly<Record<PostId, PostDefinition>> = {
  gather: {
    id: 'gather',
    name: 'Campo de recolección',
    output: 'Clics automáticos por segundo',
    description: 'Tus criaturas sacuden el objeto de la zona mientras no miras.',
    unlockLevel: 1,
    upgradeBasePrice: 750,
  },
  farm: {
    id: 'farm',
    name: 'Huerto',
    output: 'Bayas por minuto',
    description: 'Un bancal de bayas para llenar el comedero.',
    unlockLevel: 2,
    upgradeBasePrice: 1_200,
  },
  mine: {
    id: 'mine',
    name: 'Mina',
    output: 'Multiplicador de monedas por clic',
    description: 'Picos, carretillas y mucho polvo: cada clic rinde más.',
    unlockLevel: 4,
    upgradeBasePrice: 2_500,
  },
  craft: {
    id: 'craft',
    name: 'Taller',
    output: 'Orbes básicos por minuto y descuento',
    description: 'Aquí se montan orbes y se regatea con el proveedor.',
    unlockLevel: 6,
    upgradeBasePrice: 5_000,
  },
  explore: {
    id: 'explore',
    name: 'Puesto de exploración',
    output: 'Apariciones más frecuentes',
    description: 'Rastrean la zona para que las salvajes tarden menos en salir.',
    unlockLevel: 8,
    upgradeBasePrice: 9_000,
  },
  care: {
    id: 'care',
    name: 'Guardería',
    output: 'XP pasiva para el Rancho',
    description: 'Quien cuida del resto hace que todos aprendan más rápido.',
    unlockLevel: 3,
    upgradeBasePrice: 1_800,
  },
};

export const POST_LIST: readonly PostDefinition[] = POST_IDS.map((id) => POSTS[id]);

export function getPost(id: PostId): PostDefinition {
  return POSTS[id];
}

export function isPostId(value: unknown): value is PostId {
  return typeof value === 'string' && (POST_IDS as readonly string[]).includes(value);
}
