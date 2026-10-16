import type { PostId } from '../data/posts';

/**
 * Escenarios de los seis puestos del Rancho (dirección visual · Rancho).
 *
 * Cada puesto se lee de un vistazo por su escenario, no por su etiqueta: el
 * Campo es exterior y abierto, la Mina interior y oscura, el Huerto tierra
 * labrada, la Exploración mira al horizonte al atardecer, el Taller es madera
 * y herramientas y la Guardería es la única habitación cálida de la casa.
 *
 * Las parcelas cambian de tamaño con la ventana, así que las escenas se pintan
 * en proporciones de su caja: las bandas (cielo, suelo, pared) cruzan todo el
 * ancho y los objetos se anclan a un borde o al centro. Los degradados son
 * tramados en diagonal, nunca interpolados.
 */

export interface SceneBrush {
  /** Rectángulo en píxeles lógicos de la parcela. */
  readonly px: (x: number, y: number, w: number, h: number, color: string) => void;
  /** Tramado en diagonal: pinta un píxel de cada `step` en diagonal. */
  readonly dither: (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    step: number,
  ) => void;
  /** Ancho y alto de la parcela. */
  readonly w: number;
  readonly h: number;
  /** Fracción del alto → píxeles, para portar las alturas del diseño. */
  readonly v: (fraction: number) => number;
}

export interface PostScene {
  /** Dónde apoyan los pies de las criaturas, en fracción del alto. */
  readonly ground: number;
  paint(brush: SceneBrush): void;
}

export function createBrush(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  w: number,
  h: number,
): SceneBrush {
  const px = (x: number, y: number, width: number, height: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(originX + x, originY + y, width, height);
  };

  return {
    w,
    h,
    px,
    dither: (x, y, width, height, color, step) => {
      ctx.fillStyle = color;
      for (let j = 0; j < height; j += 1) {
        for (let i = 0; i < width; i += 1) {
          if ((i + j) % step !== 0) continue;
          ctx.fillRect(originX + x + i, originY + y + j, 1, 1);
        }
      }
    },
    v: (fraction) => Math.round(h * fraction),
  };
}

/* Paletas compartidas: la madera, la roca y el verde son los mismos en todo
 * el Rancho para que las seis escenas se lean como un mismo sitio. */
const WOOD = { dark: '#5f4633', mid: '#7a5b43', light: '#946f52', pale: '#dcc9a4' } as const;
const STONE = { dark: '#6b5a45', mid: '#8e795c', light: '#bca383' } as const;
const LEAF = { dark: '#5f8b4c', mid: '#7fb06c', light: '#a9d493', grass: '#8cbf7a' } as const;
const CAVE = { air: '#2f2740', mist: '#3c3253', roof: '#241d33', floor: '#3a3050' } as const;
const GOLD = { deep: '#a3791f', mid: '#d9a33f', light: '#f7dc9a', glow: '#fff8e2' } as const;
const BERRY = { body: '#e06a7c', light: '#f49ca8' } as const;

/** Mata de bayas: un bulto de hoja con cuatro frutos. */
function berryBush(brush: SceneBrush, x: number, y: number, w: number, h: number): void {
  brush.px(x, y, w, h, LEAF.dark);
  brush.px(x + 2, y - 2, w - 5, 4, LEAF.mid);
  brush.dither(x, y, w, h, LEAF.light, 3);
  const spots: readonly [number, number][] = [
    [3, 2],
    [9, 1],
    [6, 6],
    [12, 5],
  ];
  for (const [dx, dy] of spots) {
    if (dx + 2 > w || dy + 2 > h) continue;
    brush.px(x + dx, y + dy, 2, 2, BERRY.body);
    brush.px(x + dx, y + dy, 1, 1, BERRY.light);
  }
}

/** Farol encendido: el punto más brillante de las escenas interiores. */
function lantern(brush: SceneBrush, x: number, y: number): void {
  brush.px(x + 2, y - 4, 2, 4, '#5b4c72');
  brush.px(x, y, 6, 5, GOLD.mid);
  brush.px(x + 1, y + 1, 4, 3, GOLD.glow);
  brush.dither(x - 8, y - 3, 22, 16, '#e8c98a', 5);
}

export const POST_SCENES: Readonly<Record<PostId, PostScene>> = {
  /** Campo de recolección: pradera abierta con un sendero que se recorre. */
  gather: {
    ground: 0.84,
    paint(brush) {
      const { w, h, px, dither, v } = brush;
      const horizon = v(0.47);

      px(0, 0, w, h, '#d3e8f3');
      dither(0, 0, w, horizon, '#e8f3f8', 3);

      // Seto del fondo, recortado contra la línea del horizonte.
      for (let i = 0; i < w; i += 10) {
        px(i, horizon - 9, 9, 9, LEAF.dark);
        px(i + 2, horizon - 12, 5, 3, '#6b9a58');
      }
      px(0, horizon - 3, w, 3, '#6b9a58');
      px(0, horizon, w, h - horizon, LEAF.grass);
      dither(0, horizon + 2, w, h - horizon - 2, LEAF.light, 4);
      px(0, v(0.75), w, 2, LEAF.mid);

      /*
       * Sendero: una cinta continua que se ensancha al acercarse. Los tramos
       * se tocan para que se lea como un camino y no como escalones.
       */
      const bands = 5;
      const pathTop = v(0.52);
      for (let i = 0; i < bands; i += 1) {
        const t = i / (bands - 1);
        const y = pathTop + Math.round(((h - pathTop) * i) / bands);
        const band = Math.ceil((h - pathTop) / bands) + 1;
        const width = Math.round(w * (0.08 + t * 0.2));
        // El eje se desvía a la izquierda según se acerca: da perspectiva.
        const center = w * (0.46 - t * 0.12);
        px(Math.round(center - width / 2), y, width, band, WOOD.pale);
        dither(Math.round(center - width / 2), y, width, band, '#c9b48c', 3);
      }

      berryBush(brush, 6, horizon - 2, 16, 10);

      // Tocón con un hueco por registrar, apoyado en la hierba.
      const stumpX = w - 28;
      const stumpY = v(0.66);
      px(stumpX - 1, stumpY + 8, 14, 1, '#6b9a58');
      px(stumpX, stumpY, 12, 8, WOOD.mid);
      px(stumpX, stumpY, 12, 2, WOOD.light);
      px(stumpX + 4, stumpY + 3, 4, 3, '#3b2c47');

      // Setas junto al sendero.
      for (const [fx, fy] of [
        [0.43, 0.83],
        [0.49, 0.9],
      ] as const) {
        const x = Math.round(w * fx);
        const y = v(fy);
        px(x, y, 5, 3, '#e87f96');
        px(x + 1, y - 1, 3, 1, '#f8becb');
        px(x + 1, y + 3, 3, 2, GOLD.glow);
      }

      // Cesta de lo recolectado: crece con el nivel del puesto.
      const basketX = w - 17;
      px(basketX, v(0.75), 13, 9, '#c9a071');
      dither(basketX, v(0.75), 13, 9, '#a6845a', 2);
      px(basketX, v(0.75) - 2, 13, 2, WOOD.pale);
      px(basketX + 2, v(0.75) - 4, 3, 2, BERRY.body);
      px(basketX + 7, v(0.75) - 4, 3, 2, '#6b9a58');

      // Destellos: aquí hay algo que investigar.
      for (const [fx, fy] of [
        [0.19, 0.37],
        [0.73, 0.54],
        [0.57, 0.8],
      ] as const) {
        const x = Math.round(w * fx);
        const y = v(fy);
        px(x, y - 2, 1, 5, GOLD.glow);
        px(x - 2, y, 5, 1, GOLD.glow);
      }
    },
  },

  /** Mina: interior con entibación, farol, vagoneta y vetas de oro. */
  mine: {
    ground: 0.88,
    paint(brush) {
      const { w, h, px, dither, v } = brush;
      const floor = v(0.7);

      px(0, 0, w, h, CAVE.air);
      dither(0, 0, w, h, CAVE.mist, 3);
      px(0, 0, w, v(0.11), CAVE.roof);

      // Estalactitas del techo.
      for (const [fx, len] of [
        [0.08, 5],
        [0.36, 4],
        [0.69, 6],
        [0.9, 4],
      ] as const) {
        const x = Math.round(w * fx);
        for (let i = 0; i < len; i += 1) {
          px(x, v(0.11) + i, Math.max(1, 3 - Math.floor(i / 2)), 1, '#4c4162');
        }
      }

      // Vetas de oro: el único color cálido de la escena.
      for (const [fx, fy] of [
        [0.06, 0.25],
        [0.48, 0.2],
        [0.84, 0.32],
      ] as const) {
        const x = Math.round(w * fx);
        const y = v(fy);
        for (let i = 0; i < 6; i += 1) {
          px(x + i, y + i, 3, 1, GOLD.mid);
          px(x + i, y + i, 1, 1, GOLD.light);
        }
      }

      px(0, floor, w, h - floor, CAVE.floor);
      px(0, floor, w, 2, '#574873');
      dither(0, floor + 2, w, h - floor - 2, '#473a5f', 4);

      // Entibación de madera y farol colgado.
      const postY = v(0.25);
      px(14, postY, 4, floor - postY, WOOD.mid);
      px(14, postY, 2, floor - postY, WOOD.light);
      px(34, postY, 4, floor - postY, WOOD.mid);
      px(34, postY, 2, floor - postY, WOOD.light);
      px(10, postY - 6, 32, 4, WOOD.light);
      dither(10, postY - 6, 32, 4, WOOD.mid, 2);
      lantern(brush, 22, postY + 6);

      // Vía y vagoneta cargada.
      const railX = Math.round(w * 0.46);
      px(railX, floor + 6, w - railX, 2, STONE.mid);
      px(railX, floor + 11, w - railX, 2, STONE.mid);
      for (let i = railX; i < w; i += 6) px(i, floor + 7, 2, 5, STONE.dark);

      const cartX = Math.round(w * 0.6);
      px(cartX, floor - 12, 18, 12, WOOD.mid);
      px(cartX, floor - 12, 18, 3, WOOD.light);
      dither(cartX, floor - 9, 18, 9, WOOD.dark, 3);
      px(cartX + 2, floor - 16, 14, 4, STONE.light);
      px(cartX + 4, floor - 17, 4, 2, GOLD.mid);
      px(cartX + 10, floor - 17, 3, 2, GOLD.light);

      // Mineral apilado y pico apoyado.
      px(w - 16, floor - 6, 12, 6, STONE.light);
      px(w - 14, floor - 9, 7, 3, '#c3ab8b');
      px(w - 12, floor - 8, 2, 2, GOLD.mid);
      px(48, floor - 16, 2, 12, WOOD.light);
      px(44, floor - 18, 8, 2, '#9aa0ae');
    },
  },

  /** Huerto: surcos de tierra labrada que ganan altura al acercarse. */
  farm: {
    ground: 0.9,
    paint(brush) {
      const { w, h, px, dither, v } = brush;

      px(0, 0, w, h, '#dceef6');
      dither(0, 0, w, v(0.25), '#f2fafd', 3);
      px(w - 18, v(0.06), 4, 4, '#fbf6e4');
      px(w - 19, v(0.08), 6, 2, '#fbf6e4');

      // Valla del fondo.
      px(0, v(0.28), w, 2, WOOD.light);
      px(0, v(0.38), w, 2, WOOD.light);
      for (let i = 4; i < w; i += 12) px(i, v(0.22), 3, v(0.22), WOOD.mid);

      px(0, v(0.44), w, 4, LEAF.grass);
      dither(0, v(0.44), w, 4, LEAF.light, 3);

      // Cinco surcos, cada uno más alto que el anterior.
      let y = v(0.5);
      [4, 5, 6, 7, 8].forEach((band, index) => {
        if (y >= h) return;
        const height = Math.min(band, h - y);
        px(0, y, w, height, index % 2 === 0 ? '#8a6a4e' : WOOD.mid);
        dither(0, y, w, height, '#a07c5c', 3);
        px(0, y, w, 1, WOOD.dark);

        for (let x = 5 + index * 3; x < w - 2; x += 14) {
          px(x, y - 3, 2, 4, LEAF.dark);
          px(x - 2, y - 4, 6, 2, LEAF.mid);
          px(x - 1, y - 6, 2, 2, LEAF.light);
          // Las filas impares ya tienen fruto; las pares, brotes.
          if (index % 2 === 1) px(x + 1, y - 5, 2, 2, BERRY.body);
        }
        y += height;
      });

      // Emparrado de la derecha.
      const trellisX = w - 18;
      px(trellisX + 8, v(0.3), 2, v(0.35), WOOD.mid);
      px(trellisX, v(0.3), 2, v(0.35), WOOD.mid);
      px(trellisX, v(0.3), 10, 2, WOOD.light);
      dither(trellisX, v(0.33), 10, v(0.3), '#6b9a58', 2);
      for (const [dx, fy] of [
        [2, 0.42],
        [6, 0.52],
        [3, 0.6],
      ] as const) {
        px(trellisX + dx, v(fy), 2, 2, BERRY.body);
        px(trellisX + dx, v(fy), 1, 1, BERRY.light);
      }

      // Regadera en primer plano: da escala y dice que el puesto está atendido.
      px(5, h - 12, 10, 7, '#9ec2d6');
      px(5, h - 14, 7, 2, '#c3e2f3');
      px(15, h - 11, 4, 2, '#9ec2d6');
      px(14, h - 14, 2, 3, '#c3e2f3');
    },
  },

  /** Puesto de exploración: campamento al atardecer mirando al horizonte. */
  explore: {
    ground: 0.86,
    paint(brush) {
      const { w, h, px, dither, v } = brush;
      const horizon = v(0.47);

      px(0, 0, w, h, '#d6ccea');
      dither(0, 0, w, v(0.22), '#eadff2', 3);
      px(0, v(0.19), w, v(0.12), '#f3d8df');
      px(10, v(0.06), 2, 2, '#fffdf7');
      px(Math.round(w * 0.7), v(0.05), 1, 1, '#fffdf7');

      // Montes lejanos: el único puesto que mira al horizonte.
      for (let i = 0; i < w; i += 22) {
        px(i, horizon - 10, 18, 10, '#9c8fbe');
        px(i + 4, horizon - 12, 10, 2, '#afa2cf');
      }
      px(0, horizon - 2, w, 2, '#7f7aa6');
      px(0, horizon, w, h - horizon, LEAF.grass);
      dither(0, horizon + 2, w, h - horizon - 2, LEAF.light, 4);
      px(0, v(0.72), w, 2, LEAF.mid);

      // Torre de vigía con escalera, farol y catalejo.
      const towerX = Math.round(w * 0.58);
      px(towerX, v(0.22), 3, v(0.4), WOOD.mid);
      px(towerX + 18, v(0.22), 3, v(0.4), WOOD.mid);
      px(towerX - 4, v(0.16), 28, 4, WOOD.light);
      dither(towerX - 4, v(0.16), 28, 4, WOOD.mid, 2);
      px(towerX - 4, v(0.08), 2, v(0.09), WOOD.mid);
      px(towerX + 22, v(0.08), 2, v(0.09), WOOD.mid);
      px(towerX - 4, v(0.06), 28, 2, WOOD.light);
      for (let i = v(0.28); i < v(0.62); i += 5) px(towerX + 4, i, 12, 2, WOOD.mid);
      lantern(brush, towerX + 25, v(0.11));
      px(towerX - 1, v(0.11), 8, 2, '#9aa0ae');
      px(towerX + 6, v(0.09), 3, 3, '#c9ceda');

      // Mesa de mapas con chinchetas en las zonas descubiertas.
      px(6, v(0.66), 22, 3, WOOD.light);
      px(7, v(0.71), 2, v(0.14), WOOD.mid);
      px(25, v(0.71), 2, v(0.14), WOOD.mid);
      px(8, v(0.59), 18, 4, WOOD.pale);
      dither(8, v(0.59), 18, 4, '#c9b48c', 3);
      px(12, v(0.61), 2, 2, BERRY.body);
      px(20, v(0.62), 2, 1, '#8777e5');

      // Poste que señala las tres zonas.
      const signX = Math.round(w * 0.4);
      px(signX, v(0.53), 2, v(0.25), WOOD.mid);
      px(signX - 9, v(0.53), 12, 3, WOOD.light);
      px(signX + 1, v(0.61), 12, 3, WOOD.light);
      px(signX - 7, v(0.69), 10, 3, WOOD.light);

      // Mochila y saco de dormir.
      px(10, h - 9, 10, 6, '#8a6a4e');
      px(12, h - 11, 6, 3, '#a07c5c');
      px(23, h - 7, 17, 4, '#9ed6be');
      px(23, h - 7, 17, 1, '#c3e2f3');
    },
  },

  /** Taller: madera, banco de trabajo, yunque y orbes en el estante. */
  craft: {
    ground: 0.88,
    paint(brush) {
      const { w, h, px, dither, v } = brush;
      const floor = v(0.64);

      // Pared de sillares y suelo de tablas: textura de líneas de 1 px.
      px(0, 0, w, h, '#a89783');
      dither(0, 0, w, floor, STONE.light, 3);
      for (let y = 3; y < floor; y += 6) px(0, y, w, 1, STONE.mid);
      px(0, floor, w, 2, STONE.dark);
      px(0, floor + 2, w, h - floor - 2, WOOD.mid);
      for (let y = floor + 7; y < h; y += 6) px(0, y, w, 1, WOOD.dark);

      // Estante de orbes acabados: el único periwinkle de la escena.
      const shelfX = w - 40;
      px(shelfX, v(0.22), 36, 3, WOOD.light);
      for (let i = 0; i < 3; i += 1) {
        const ox = shelfX + 4 + i * 12;
        px(ox, v(0.12), 6, 6, '#8777e5');
        px(ox, v(0.12), 6, 1, '#a596f2');
        px(ox + 1, v(0.13), 2, 2, '#cfc6f8');
      }

      // Lámpara de trabajo colgada sobre el banco.
      px(30, 0, 2, v(0.13), '#5b4c72');
      px(26, v(0.13), 10, 4, GOLD.mid);
      px(28, v(0.15), 6, 2, GOLD.glow);
      dither(20, v(0.12), 22, v(0.28), '#e8c98a', 5);

      // Banco de trabajo con molde, orbe a medias y herramienta.
      px(10, v(0.5), 44, 4, WOOD.light);
      dither(10, v(0.5), 44, 4, WOOD.mid, 3);
      px(12, v(0.56), 3, v(0.14), WOOD.mid);
      px(49, v(0.56), 3, v(0.14), WOOD.mid);
      px(16, v(0.44), 8, 4, STONE.mid);
      px(17, v(0.42), 6, 2, STONE.light);
      px(30, v(0.41), 6, 6, '#8777e5');
      px(31, v(0.42), 2, 2, '#cfc6f8');
      px(40, v(0.44), 8, 4, '#9aa0ae');
      px(41, v(0.39), 2, 4, '#c9ceda');

      // Yunque y cajas apiladas.
      px(w - 34, v(0.53), 14, 4, '#6e6478');
      px(w - 34, v(0.52), 14, 1, '#9aa0ae');
      px(w - 30, v(0.59), 6, 6, '#5a5164');
      px(w - 18, h - 14, 16, 12, '#8a6a4e');
      px(w - 18, h - 14, 16, 2, '#a07c5c');
      dither(w - 18, h - 12, 16, 10, WOOD.mid, 3);
      px(w - 14, h - 9, 8, 1, STONE.dark);
    },
  },

  /** Guardería: la única habitación interior y cálida de la casa. */
  care: {
    ground: 0.92,
    paint(brush) {
      const { w, h, px, dither, v } = brush;
      const skirting = v(0.56);

      px(0, 0, w, h, '#ede4f6');
      dither(0, 0, w, skirting, '#f6f0fb', 3);
      px(0, skirting, w, 3, '#c9b6d8');
      px(0, skirting + 3, w, h - skirting - 3, '#c2a07a');
      dither(0, skirting + 3, w, h - skirting - 3, '#ae8e68', 4);
      for (let y = skirting + 9; y < h; y += 7) px(0, y, w, 1, '#9b7d5a');

      // Ventana con luz.
      px(8, v(0.09), 24, v(0.31), '#fffdf7');
      px(10, v(0.12), 20, v(0.25), '#cfe6f2');
      dither(10, v(0.12), 20, v(0.25), '#e8f3f8', 3);
      px(19, v(0.12), 2, v(0.25), '#fffdf7');
      px(10, v(0.23), 20, 2, '#fffdf7');
      px(12, v(0.16), 4, 4, '#fbf6e4');

      // Móvil colgante.
      const mobileX = Math.round(w * 0.55);
      px(mobileX, 0, 1, v(0.09), '#c9b6d8');
      px(mobileX - 7, v(0.09), 15, 1, '#c9b6d8');
      px(mobileX - 7, v(0.11), 3, 3, '#f6d96b');
      px(mobileX, v(0.11), 2, 4, '#9cc8ea');
      px(mobileX + 6, v(0.11), 3, 3, '#a8d49b');

      // Estante de tarros de bayas.
      const shelfX = w - 22;
      px(shelfX, v(0.19), 20, 3, '#c2a07a');
      for (let i = 0; i < 3; i += 1) {
        const jx = shelfX + 2 + i * 7;
        px(jx, v(0.09), 5, 6, '#cfe6f2');
        px(jx + 1, v(0.12), 3, 3, '#e87f96');
        px(jx, v(0.09), 5, 1, '#fffdf7');
      }

      // Cuna de mimbre con una cría asomando: el foco de la escena.
      const cribX = Math.round(w * 0.42);
      px(cribX, v(0.44), 20, 10, WOOD.pale);
      dither(cribX, v(0.44), 20, 10, '#c9a071', 2);
      px(cribX, v(0.41), 20, 2, '#e8d9b8');
      px(cribX + 4, v(0.47), 12, 4, LEAF.light);
      px(cribX + 6, v(0.33), 8, 5, '#c3e2f3');
      px(cribX + 6, v(0.33), 8, 1, '#eaf6fd');
      px(cribX + 7, v(0.36), 2, 2, '#3b2c47');
      px(cribX + 11, v(0.36), 2, 2, '#3b2c47');

      // Alfombra que separa la zona de juego de las camitas.
      px(Math.round(w * 0.3), v(0.75), Math.round(w * 0.42), v(0.19), '#f3d8df');
      dither(Math.round(w * 0.3), v(0.75), Math.round(w * 0.42), v(0.19), '#e9c7d2', 3);
      px(Math.round(w * 0.3), v(0.75), Math.round(w * 0.42), 1, '#e9a9c2');

      // Camitas y juguetes.
      px(5, v(0.69), 18, 8, '#9ed6be');
      px(5, v(0.69), 18, 2, '#c3e2f3');
      px(7, v(0.72), 6, 4, '#fffdf7');
      px(w - 20, v(0.66), 18, 8, '#b9d4e2');
      px(w - 20, v(0.66), 18, 2, '#dceef6');
      px(w - 10, v(0.69), 6, 4, '#fffdf7');
      px(Math.round(w * 0.36), h - 7, 6, 6, '#e87f96');
      px(Math.round(w * 0.36), h - 5, 6, 1, '#fffdf7');
      px(Math.round(w * 0.46), h - 5, 5, 4, '#f6d96b');
      px(Math.round(w * 0.54), h - 6, 4, 5, '#9cc8ea');
    },
  },
};

export function getPostScene(postId: PostId): PostScene {
  return POST_SCENES[postId];
}
