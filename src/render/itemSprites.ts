import { registerSprite, type SpriteDefinition } from './placeholders';

/**
 * Objetos de la tienda en pixel art de 16×16, el doble que los iconos del HUD
 * porque aquí el objeto es el protagonista de la fila y no una viñeta.
 *
 * Regla de la dirección visual: contorno de 1 px en un tono oscuro del propio
 * color (nunca negro), dos tonos de cuerpo y un brillo. Los consumibles llevan
 * además una sombra de apoyo (`S`) bajo la base: es lo que los distingue de un
 * vistazo de lo permanente, que se apoya en el fondo sin proyectar.
 */
interface ItemDefinition {
  readonly palette: Readonly<Record<string, string>>;
  readonly map: readonly string[];
}

/** Sombra de apoyo común a todos los consumibles. */
const SUPPORT_SHADOW = 'rgba(59, 44, 71, 0.14)';

/**
 * Pinta píxeles sueltos sobre un mapa base. Las variantes de una familia
 * comparten silueta y solo cambian de material, así la mejora se lee en el
 * objeto sin leer el nombre (dirección visual · objetos de la tienda).
 */
function overlay(map: readonly string[], cells: readonly (readonly [number, number, string])[]) {
  const rows = map.map((row) => Array.from({ length: 16 }, (_, i) => row[i] ?? '.'));
  for (const [x, y, key] of cells) {
    const row = rows[y];
    if (row === undefined || row[x] === undefined) continue;
    row[x] = key;
  }
  return rows.map((row) => row.join(''));
}

/** Silueta común de los cinco guantes: dedos, palma y puño. */
const GLOVE: readonly string[] = [
  '................',
  '...OOO.OOO.OOO..',
  '...OLO.OLO.OLO..',
  '...OLO.OLO.OLO..',
  '..OOLOOOLOOOLOO.',
  '..OLLLLLLLLLLLO.',
  '.OOLLLLLLLLLLLO.',
  'OLLLLLLLLLLLLLO.',
  'OLLLLLLLLLLLLLO.',
  'OLLLLLLLLLLLLLO.',
  '.OOLLLLLLLLLLLO.',
  '..OAAAAAAAAAAAO.',
  '..OAaaaaaaaaaAO.',
  '..OAAAAAAAAAAAO.',
  '...OOOOOOOOOOO..',
  '................',
];

/** Tachuelas, placa y gema: lo que distingue a los guantes III, IV y V. */
const STUDS = [
  [5, 8, 'M'],
  [8, 8, 'M'],
  [11, 8, 'M'],
] as const;
const PLATE = [
  [4, 7, 'M'],
  [5, 7, 'M'],
  [6, 7, 'M'],
  [7, 7, 'M'],
  [8, 7, 'M'],
  [9, 7, 'M'],
  [10, 7, 'M'],
  [11, 7, 'M'],
  [12, 7, 'M'],
] as const;
const GEM = [
  [7, 12, 'G'],
  [8, 12, 'G'],
] as const;

const ITEMS: Readonly<Record<string, ItemDefinition>> = {
  /*
   * Mejoras de clic: cinco guantes que suben de material —tela, cuero, cuero
   * con tachuelas, placas de acero y oro con gema—, siempre con la misma
   * silueta para que la progresión se lea en la mano.
   */
  glove1: {
    palette: { O: '#6e5f4c', L: '#ddcdac', A: '#8a7458', a: '#a68c68' },
    map: GLOVE,
  },
  glove2: {
    palette: { O: '#4e3b2c', L: '#b2875c', A: '#6b4b32', a: '#86613f' },
    map: GLOVE,
  },
  glove3: {
    palette: { O: '#4e3b2c', L: '#b2875c', A: '#6b4b32', a: '#86613f', M: '#c9ceda' },
    map: overlay(GLOVE, STUDS),
  },
  glove4: {
    palette: { O: '#3e3448', L: '#a3aab9', A: '#5b4c72', a: '#6e6478', M: '#d9e0ec' },
    map: overlay(GLOVE, [...PLATE, ...STUDS]),
  },
  glove5: {
    palette: {
      O: '#8a6a1f',
      L: '#efd489',
      A: '#a3791f',
      a: '#c79a3a',
      M: '#fff8e2',
      G: '#8777e5',
    },
    map: overlay(GLOVE, [...PLATE, ...STUDS, ...GEM]),
  },

  /** Plaza de Rancho: estaca con cartel plantada en la hierba. */
  plot: {
    palette: {
      O: '#5f4633',
      L: '#dcc9a4',
      B: '#946f52',
      A: '#8cbf7a',
      a: '#e06a7c',
      S: SUPPORT_SHADOW,
    },
    map: [
      '................',
      '....OOOOOOO.....',
      '....OLLLLLO.....',
      '....OLaaaLO.....',
      '....OLLLLLO.....',
      '....OOOOOOO.....',
      '......OBO.......',
      '......OBO.......',
      '......OBO.......',
      '......OBO.......',
      '..AA..OBO..AA...',
      '.AAAA.OBO.AAAA..',
      'AAAAAAOBOAAAAAA.',
      '.OOOOOOOOOOOOO..',
      '..SSSSSSSSSSS...',
      '................',
    ],
  },

  /** Mejora de puesto: maza de obra y tres barras de nivel. */
  upgrade: {
    palette: {
      O: '#4e4258',
      L: '#c9ceda',
      B: '#946f52',
      A: '#8777e5',
      a: '#5f4633',
      M: '#9aa0ae',
    },
    map: [
      '................',
      '.........OOOO...',
      '........OLLLLO..',
      '........OLLLLO..',
      '.......OOLLLLO..',
      '......OOOOOOO...',
      '.....OBaO.......',
      '....OBaO........',
      '...OBaO.........',
      '..OBaO..........',
      '..OBO...........',
      '..OO....AA..AAA.',
      '....AA..AA..AAA.',
      '....AA..AA..AAA.',
      '....OO..OO..OOO.',
      '................',
    ],
  },

  /** Baya: la del comedero y la que cura en combate. */
  berry: {
    palette: {
      O: '#9b4256',
      L: '#f2a2b2',
      B: '#e06a7c',
      A: '#6b9a58',
      W: '#fff8e2',
      S: SUPPORT_SHADOW,
    },
    map: [
      '................',
      '.........A......',
      '........AAA.....',
      '.......AAA......',
      '......OOOO......',
      '....OOLLLLOO....',
      '...OLLLLWLLLO...',
      '..OLLLLLLLLLLO..',
      '..OLBBBBBBBBLO..',
      '..OBBBBBBBBBBO..',
      '..OBBBBBBBBBBO..',
      '...OBBBBBBBBO...',
      '....OBBBBBBO....',
      '.....OOOOOO.....',
      '....SSSSSSSS....',
      '................',
    ],
  },

  /** Poción de prisa: frasco con tapón de corcho y burbujas. */
  potion: {
    palette: {
      O: '#6e6020',
      L: '#f4e79a',
      B: '#d9bf52',
      a: '#a07c5c',
      W: '#fffdf7',
      S: SUPPORT_SHADOW,
    },
    map: [
      '.......W........',
      '....W..OOOO.....',
      '......OaaaaO....',
      '......OaaaaO....',
      '......OLLLLO....',
      '.....OLLLLLLO...',
      '....OLLLLLLLLO..',
      '...OLLWLLLLLLO..',
      '...OLBBBBBBBLO..',
      '...OBBBBBBBBBO..',
      '...OBBWBBBBBBO..',
      '...OBBBBBBBBBO..',
      '....OBBBBBBBO...',
      '.....OOOOOOO....',
      '....SSSSSSSS....',
      '................',
    ],
  },

  /** Ración de huerto: saco atado que llena el comedero. */
  sack: {
    palette: {
      O: '#5f4633',
      L: '#dcc9a4',
      B: '#6b9a58',
      a: '#a07c5c',
      S: SUPPORT_SHADOW,
    },
    map: [
      '................',
      '.....OOOOO......',
      '....OaaaaaO.....',
      '.....OOOOO......',
      '....OLLLLLO.....',
      '...OLLLLLLLO....',
      '..OLLLLLLLLLO...',
      '..OLLLLLLLLLO...',
      '.OLLLLLLLLLLLO..',
      '.OLLLBBBBBLLLO..',
      '.OLLBBBBBBBLLO..',
      '.OLLLBBBBBLLLO..',
      '..OLLLLLLLLLO...',
      '...OOOOOOOOO....',
      '..SSSSSSSSSSS...',
      '................',
    ],
  },
};

export type ItemSpriteId = keyof typeof ITEMS;

function createItemSprite(id: string, item: ItemDefinition): SpriteDefinition {
  const height = item.map.length;
  const width = Math.max(...item.map.map((row) => row.length));

  return {
    id: `item/${id}`,
    width,
    height,
    paint(ctx) {
      for (let y = 0; y < height; y += 1) {
        const row = item.map[y] ?? '';
        for (let x = 0; x < width; x += 1) {
          const color = item.palette[row[x] ?? '.'];
          if (color === undefined) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    },
  };
}

let registered = false;

export function registerItemSprites(): void {
  if (registered) return;
  registered = true;
  for (const [id, item] of Object.entries(ITEMS)) {
    registerSprite(createItemSprite(id, item));
  }
}

export function itemSpriteId(id: ItemSpriteId): string {
  return `item/${id}`;
}
