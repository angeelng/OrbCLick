import type { SpeciesId } from '../data/species';

/**
 * Sprites de criatura dibujados píxel a píxel, 16×16, en el formato de la
 * dirección visual: un mapa de caracteres y su paleta.
 *
 * Claves del mapa:
 * - `O` contorno (un tono oscuro del propio color, nunca negro)
 * - `B` cuerpo · `L` luz · `D` sombra
 * - `A` acento y `a` acento secundario (cuernos, brasas, pétalos…)
 * - `E` pupila · `W` brillo del ojo · `S` sombra en el suelo
 * - `.` transparente
 */
export interface CreaturePalette {
  readonly O: string;
  readonly B: string;
  readonly L: string;
  readonly D: string;
  readonly A: string;
  readonly a: string;
}

export interface CreatureArt {
  readonly palette: CreaturePalette;
  readonly map: readonly string[];
}

/** Tonos compartidos: los ojos y la sombra son iguales en todo el roster. */
export const SHARED_COLORS = {
  W: '#fffdf7',
  E: '#3b2c47',
  S: 'rgba(59, 44, 71, 0.14)',
} as const;

/** Lado del lienzo de cada sprite. */
export const CREATURE_SPRITE_SIZE = 16;

function art(palette: CreaturePalette, map: readonly string[]): CreatureArt {
  return { palette, map };
}

export const CREATURE_ART: Readonly<Record<SpeciesId, CreatureArt>> = {
  brotillo: art(
    { O: '#4c6b3f', B: '#8cbf7a', L: '#b6dca2', D: '#6b9a58', A: '#a8d49b', a: '#d9a8c0' },
    [
      '................',
      '.......A........',
      '......AAA.......',
      '.....AAAAA......',
      '...AA.aOa.AA....',
      '..AAAAOOOAAAA...',
      '....OOOOOOO.....',
      '...OLLLLLLLO....',
      '..OLLLLLLLLLO...',
      '..OLEWLLLWELO...',
      '..OBBBBBBBBBO...',
      '..OBBBaaaBBBO...',
      '...OBBBBBBBO....',
      '....OOOOOOO.....',
      '....SS...SS.....',
      '................',
    ],
  ),

  pelusin: art(
    { O: '#6e8795', B: '#b9d4e2', L: '#dceef6', D: '#95b7c9', A: '#cfe3ee', a: '#e9c7d2' },
    [
      '................',
      '....OO....OO....',
      '...OLLO..OLLO...',
      '...OLLLOOLLLO...',
      '..OOLLLLLLLLOO..',
      '.OLLLLLLLLLLLLO.',
      'OLLLLLLLLLLLLLLO',
      'OLLEWLLLLLWELLLO',
      'OLLLLLLLLLLLLLLO',
      'OLLLaaLLLaaLLLLO',
      '.OLLLLLLLLLLLLO.',
      '..OBBLLLLLLBBO..',
      '...OBBOOOOBBO...',
      '....OO....OO....',
      '...SS......SS...',
      '................',
    ],
  ),

  ascuin: art(
    { O: '#8a4a2e', B: '#e08b55', L: '#fbd9a8', D: '#c06b3c', A: '#f4a878', a: '#d9603f' },
    [
      '........O.......',
      '.......OAO......',
      '......OAAAO.....',
      '.....OAAAAAO....',
      '....OAAALAAAO...',
      '...OAALLLLLAAO..',
      '...OALEWLWELAO..',
      '...OALLLLLLLAO..',
      '..OAALLaaaLLAAO.',
      '..OAALLLLLLLAAO.',
      '..OAAAALLLAAAAO.',
      '...OAAAAAAAAAO..',
      '....OOAAAAAOO...',
      '......OOOOO.....',
      '....SSSSSSS.....',
      '................',
    ],
  ),

  chispin: art(
    { O: '#7a6a2c', B: '#e3cb63', L: '#f7ebae', D: '#c4a93f', A: '#f0dc86', a: '#8fb6d6' },
    [
      '................',
      '.......OO.......',
      '......OLLO......',
      '.....OLLLLO.....',
      '....OLLLLLLO....',
      '...OLEWLLWELO...',
      '...OLLLLLLLLO...',
      '..OLLLaaaaLLLO..',
      '..OBBBBBBBBBBO..',
      '...OBBBBBBBBO.A.',
      '....OBBBBBO.AA..',
      '.....OBBBO.AA...',
      '......OBO.AA....',
      '.......O.A......',
      '.....SSSSS......',
      '................',
    ],
  ),

  pedrusco: art(
    { O: '#6b5a45', B: '#b49a79', L: '#d8c4a4', D: '#8e795c', A: '#cdb79a', a: '#7e6b52' },
    [
      '................',
      '....OOOOOOOO....',
      '...OLLLLLLLLO...',
      '..OLLLLLLLLLLO..',
      '..OLLEWLLWELLO..',
      '..OLLLLLLLLLLO..',
      '..OLLLaaaaLLLO..',
      '..OBBBBBBBBBBO..',
      '..OBBDDBBDDBBO..',
      '..OBBBBBBBBBBO..',
      '..OBDBBBBBBDBO..',
      '..OBBBBBBBBBBO..',
      '...OOOOOOOOOO...',
      '....O......O....',
      '...SSSSSSSSSS...',
      '................',
    ],
  ),

  musgolito: art(
    { O: '#3e5a34', B: '#6e9b56', L: '#a9d493', D: '#55763f', A: '#8cbf7a', a: '#d9c27a' },
    [
      '................',
      '......AAAA......',
      '....AAAAAAAA....',
      '..OAAAAAAAAAAO..',
      '..OLLLLLLLLLLO..',
      '..OLLLLLLLLLLO..',
      '..OLLEWLLWELLO..',
      '..OLLLLLLLLLLO..',
      '..OBBBaaaaBBBO..',
      '..OBBABBBBABBO..',
      '..OBBBBBBBBBBO..',
      '...OBBABBABBO...',
      '....OOOOOOOO....',
      '....SSSSSSSS....',
      '................',
      '................',
    ],
  ),

  brasacol: art(
    { O: '#6b3420', B: '#d0703a', L: '#f0a868', D: '#9c4a26', A: '#ffd08a', a: '#ffe3a8' },
    [
      '................',
      '................',
      '....OOOOOOOO....',
      '..OOLLLLLLLLOO..',
      '..OLLLLLLLLLLO..',
      '..OLLEWLLWELLO..',
      '..OLLLLLLLLLLO..',
      '..OBBaaaaaaBBO..',
      '..OBBBBBBBBBBO..',
      '..ODBBBBBBBBDO..',
      '..ODDBBBBBBDDO..',
      '...ODDDDDDDDO...',
      '....OOOOOOOO....',
      '.....A....A.....',
      '....SSSSSSSS....',
      '................',
    ],
  ),

  cuarzin: art(
    { O: '#5b4c72', B: '#a892c4', L: '#d6c8e8', D: '#7c6796', A: '#bfa9dc', a: '#8fd3ae' },
    [
      '................',
      '....O......O....',
      '...OAO....OAO...',
      '...OAO.O..OAO...',
      '..OALO.AO.OLAO..',
      '..OALOOAAOOLAO..',
      '..OALLLLLLLLAO..',
      '..OALEWLLWELAO..',
      '..OALLLLLLLLAO..',
      '..OABBBaaBBBAO..',
      '..OABBBBBBBBAO..',
      '...OABBBBBBAO...',
      '....OAAAAAAO....',
      '.....OOOOOO.....',
      '....SSSSSSSS....',
      '................',
    ],
  ),

  goton: art(
    { O: '#3e6480', B: '#7fafd4', L: '#c3e2f3', D: '#5b8cb0', A: '#9cc8ea', a: '#4e7fa3' },
    [
      '................',
      '.......OO.......',
      '......OLLO......',
      '.....OLLLLO.....',
      '....OLLLLLLO....',
      '...OLLLLLLLLO...',
      '..OLLEWLLWELLO..',
      '..OLLLLLLLLLLO..',
      '.OBLLLaaaaLLLBO.',
      '.OBBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBBO.',
      '..OBBBBBBBBBBO..',
      '...OBBBBBBBBO...',
      '....OOOOOOOO....',
      '....SSSSSSSS....',
      '................',
    ],
  ),

  ranaflor: art(
    { O: '#44633a', B: '#7fb06c', L: '#a9d493', D: '#5f8b4c', A: '#e9a9c2', a: '#f6d96b' },
    [
      '................',
      '......AAA.......',
      '.....AaaaA......',
      '......AAA.......',
      '.......O........',
      '..OO..OOO..OO...',
      '.OLLO.OOO.OLLO..',
      '.OLELO...OLELO..',
      '.OOLLOOOOOLLOO..',
      '..OLLLLLLLLLLO..',
      '.OLLLLLLLLLLLLO.',
      '.OBBLLaaaaLLBBO.',
      '.OBBBBBBBBBBBBO.',
      '..OOBBOOOOBBOO..',
      '...SSSSSSSSSS...',
      '................',
    ],
  ),

  anguilux: art(
    { O: '#6c5a24', B: '#d8c04a', L: '#f3e394', D: '#a8902f', A: '#9ec2d6', a: '#fffbe0' },
    [
      '................',
      '....OOOO.....A..',
      '...OLLLLO.......',
      '...OLEWLLO......',
      '...OLLLLLLO.....',
      '....OBBBBBO.....',
      '.....OBBBBBO..A.',
      '......OBBBBO....',
      '.......OBBBBO...',
      '......OBBBBBO.A.',
      '.....OBBBBBO....',
      '....OBBBBO......',
      '...OBBBO........',
      '...OOO..........',
      '..SSSS..........',
      '................',
    ],
  ),

  nenufrel: art(
    { O: '#2f5a74', B: '#7fafd4', L: '#c3e2f3', D: '#5f8b4c', A: '#e9a9c2', a: '#f6d96b' },
    [
      '................',
      '.......AA.......',
      '......AaaA......',
      '.......AA.......',
      '......OOOO......',
      '.....OLLLLO.....',
      '....OLEWWELO....',
      '....OLLLLLLO....',
      '...OBBBaaBBBO...',
      '...OBBBBBBBBO...',
      '..ODDDDDDDDDDO..',
      '.ODDDDDDDDDDDDO.',
      '..OOOOOOOOOOOO..',
      '...SSSSSSSSSS...',
      '................',
      '................',
    ],
  ),

  cornavid: art(
    { O: '#3c5531', B: '#7fa85f', L: '#a9cc86', D: '#5c7f44', A: '#efc25e', a: '#c9992f' },
    [
      '..A.........A...',
      '..A.A.....A.A...',
      '..AAA.....AAA...',
      '...A.A...A.A....',
      '....AA...AA.....',
      '.....OOOOO......',
      '....OLLLLLO.....',
      '....OLEWWELO....',
      '....OLLLLLLO....',
      '....OLLaaLLO....',
      '.....OOOOOO.....',
      '...OOBBBBBBOO...',
      '..OBBBDDDDBBBO..',
      '..OBBBBBBBBBBO..',
      '..O.OBBBBBBO.O..',
      '....O.O..O.O....',
    ],
  ),

  geodron: art(
    { O: '#5a4a38', B: '#a8906e', L: '#cdb79a', D: '#80694f', A: '#bfa9dc', a: '#d9c9a0' },
    [
      '..A..........A..',
      '..AA........AA..',
      '...A........A...',
      '....OOOOOOOO....',
      '...OLLLLLLLLO...',
      '..OLLEWLLWELLO..',
      '..OLLLLLLLLLLO..',
      '..OBBBaaaaBBBO..',
      '.OBBBBBBBBBBBBO.',
      '.OBBDDBBBBDDBBO.',
      '.OBBBBBBBBBBBBO.',
      '.OBDBBBBBBBBDBO.',
      '..OOOOOOOOOOOO..',
      '..O.O......O.O..',
      '..SSSSSSSSSSSS..',
      '................',
    ],
  ),

  marealis: art(
    { O: '#2a5a78', B: '#5b8cb0', L: '#9cc8ea', D: '#3e6480', A: '#eaf6fd', a: '#c3e2f3' },
    [
      '..........AA....',
      '.........AaaA...',
      '....A...AaaaaA..',
      '...AaA..OOOOOO..',
      '....A..OLLLLLLO.',
      '......OLLEWWELLO',
      '.....OLLLLLLLLLO',
      '....OLLLaaaaLLLO',
      '...OBBBBBBBBBBBO',
      '..OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO..',
      '.OBBBBBBBBBBO...',
      '..OBBBBBBBBO....',
      '...OOOOOOOO.....',
      '...SSSSSSSS.....',
      '................',
    ],
  ),
};

/** Paleta alternativa de las variocolor: el mismo dibujo, otro tinte (GDD). */
export const SHINY_PALETTE: CreaturePalette = {
  O: '#5b4c72',
  B: '#a892c4',
  L: '#d6c8e8',
  D: '#7c6796',
  A: '#efc25e',
  a: '#f6d96b',
};
