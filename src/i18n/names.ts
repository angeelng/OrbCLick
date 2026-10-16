import type { CreatureType } from '../data/types';

/** Nombres en español de los tipos de criatura (GDD). */
export const TYPE_NAMES: Readonly<Record<CreatureType, string>> = {
  plant: 'Planta',
  fire: 'Fuego',
  water: 'Agua',
  rock: 'Roca',
  electric: 'Eléctrico',
  air: 'Aire',
};
