import { registerSprite, type SpriteDefinition } from './placeholders';

/**
 * Iconos del HUD en pixel art de 8×8. Van por `spriteId` como el resto del
 * arte, así que el día que haya iconos dibujados a mano entran sin tocar la
 * interfaz.
 *
 * Cada icono es un mapa de caracteres con su paleta: más corto de leer y de
 * retocar que una ristra de `fillRect`.
 */
interface IconDefinition {
  readonly palette: Readonly<Record<string, string>>;
  readonly map: readonly string[];
}

const ICONS: Readonly<Record<string, IconDefinition>> = {
  coin: {
    palette: { O: '#a3791f', B: '#e8b44c', L: '#f7dc9a', W: '#fff8e2' },
    map: [
      '..OOOO..',
      '.OLLLLO.',
      'OLLWWLLO',
      'OLWBBWLO',
      'OLWBBWLO',
      'OLLWWLLO',
      '.OLLLLO.',
      '..OOOO..',
    ],
  },
  orb: {
    palette: { O: '#5a4ca8', B: '#8777e5', L: '#cfc6f8', W: '#ffffff' },
    map: [
      '..OOOO..',
      '.OLLLLO.',
      'OLWLLLLO',
      'OLLLLLLO',
      'OBBBBBBO',
      'OBBBBBBO',
      '.OBBBBO.',
      '..OOOO..',
    ],
  },
  berry: {
    palette: { O: '#9b4256', B: '#e87f96', L: '#f8becb', A: '#6b9a58' },
    map: [
      '...A....',
      '..AA....',
      '..OOOO..',
      '.OLLLLO.',
      'OLLBBLLO',
      'OBBBBBBO',
      '.OBBBBO.',
      '..OOOO..',
    ],
  },
  cps: {
    palette: { O: '#2f7d5c', B: '#45b88a', L: '#a5e3c9' },
    map: [
      '....OO..',
      '...OLO..',
      '..OLLO..',
      '.OLLLOOO',
      'OOOLLLLO',
      '...OLLO.',
      '...OLO..',
      '...OO...',
    ],
  },
  click: {
    palette: { O: '#6b5a99', B: '#8777e5', L: '#cfc6f8' },
    map: [
      '..OO....',
      '.OLLO...',
      '.OLLO...',
      '.OLLOOO.',
      'OOLLLLLO',
      'OLLLLLLO',
      '.OLLLLO.',
      '..OOOO..',
    ],
  },
};

function createIconSprite(id: string, icon: IconDefinition): SpriteDefinition {
  const height = icon.map.length;
  const width = Math.max(...icon.map.map((row) => row.length));

  return {
    id: `icon/${id}`,
    width,
    height,
    paint(ctx) {
      for (let y = 0; y < height; y += 1) {
        const row = icon.map[y] ?? '';
        for (let x = 0; x < width; x += 1) {
          const color = icon.palette[row[x] ?? '.'];
          if (color === undefined) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
  };
}

let registered = false;

export function registerIconSprites(): void {
  if (registered) return;
  registered = true;
  for (const [id, icon] of Object.entries(ICONS)) {
    registerSprite(createIconSprite(id, icon));
  }
}

export function iconSpriteId(id: keyof typeof ICONS): string {
  return `icon/${id}`;
}
