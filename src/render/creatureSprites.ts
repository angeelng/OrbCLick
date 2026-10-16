import { SPECIES_LIST, type SpeciesDefinition } from '../data/species';
import {
  CREATURE_ART,
  CREATURE_SPRITE_SIZE,
  SHARED_COLORS,
  SHINY_PALETTE,
  type CreaturePalette,
} from './creatureMaps';
import { registerSprite, type SpriteDefinition } from './placeholders';

/**
 * Sprites de criatura: se pintan desde los mapas de `creatureMaps.ts`, que
 * están dibujados píxel a píxel. Siguen pidiéndose por `spriteId`, así que
 * cambiar a una hoja de sprites no toca ni la lógica ni las escenas.
 */

/** Resuelve el color de una celda del mapa. */
function colorFor(key: string, palette: CreaturePalette): string | null {
  switch (key) {
    case 'O':
      return palette.O;
    case 'B':
      return palette.B;
    case 'L':
      return palette.L;
    case 'D':
      return palette.D;
    case 'A':
      return palette.A;
    case 'a':
      return palette.a;
    case 'W':
      return SHARED_COLORS.W;
    case 'E':
      return SHARED_COLORS.E;
    case 'S':
      return SHARED_COLORS.S;
    default:
      return null;
  }
}

function createCreatureSprite(species: SpeciesDefinition, shiny: boolean): SpriteDefinition {
  const { map, palette } = CREATURE_ART[species.id];
  const colors = shiny ? SHINY_PALETTE : palette;

  return {
    id: shiny ? `${species.spriteId}/shiny` : species.spriteId,
    width: CREATURE_SPRITE_SIZE,
    height: CREATURE_SPRITE_SIZE,
    paint(ctx, frame) {
      // Dos fotogramas de respiración: el cuerpo flota un píxel y la sombra
      // del suelo se queda donde está.
      const bob = frame % 2 === 0 ? 0 : -1;

      for (let y = 0; y < map.length; y += 1) {
        const row = map[y] ?? '';
        for (let x = 0; x < row.length; x += 1) {
          const key = row[x] ?? '.';
          const color = colorFor(key, colors);
          if (color === null) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x, key === 'S' ? y : y + bob, 1, 1);
        }
      }
    },
  };
}

/** Id del sprite de una especie, teniendo en cuenta si es variocolor. */
export function creatureSpriteId(species: SpeciesDefinition, shiny: boolean): string {
  return shiny ? `${species.spriteId}/shiny` : species.spriteId;
}

let registered = false;

/** Registra los sprites de las 15 especies (normal y variocolor). */
export function registerCreatureSprites(): void {
  if (registered) return;
  registered = true;
  for (const species of SPECIES_LIST) {
    registerSprite(createCreatureSprite(species, false));
    registerSprite(createCreatureSprite(species, true));
  }
}
