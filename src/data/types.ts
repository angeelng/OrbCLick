/** Los 6 tipos de criatura del MVP (Luz y Sombra quedan para después). */
export const CREATURE_TYPES = ['plant', 'fire', 'water', 'rock', 'electric', 'air'] as const;

export type CreatureType = (typeof CREATURE_TYPES)[number];

/** Variable CSS con el color de cada tipo, definida en `styles/tokens.css`. */
export const TYPE_COLOR_VAR: Readonly<Record<CreatureType, string>> = {
  plant: '--type-plant',
  fire: '--type-fire',
  water: '--type-water',
  rock: '--type-rock',
  electric: '--type-electric',
  air: '--type-air',
};
