/**
 * Generador de placeholders: todo sprite se pide por `spriteId`, así que
 * cambiar a arte real es sustituir este registro por una hoja de sprites sin
 * tocar la lógica ni las escenas.
 */
export interface SpriteDefinition {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Dibuja en coordenadas locales (0,0 arriba a la izquierda del sprite). */
  readonly paint: (ctx: CanvasRenderingContext2D, frame: number) => void;
}

/** Rectángulo en píxeles lógicos: el pincel básico del pixel art. */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Disco pixelado por filas; evita los bordes suaves de `arc()`. */
function disc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  for (let dy = -radius; dy <= radius; dy += 1) {
    const span = Math.floor(Math.sqrt(radius * radius - dy * dy));
    ctx.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
  }
}

/* Paleta pastel: contorno en un tono oscuro del propio verde, nunca negro. */
const TREE = {
  outline: '#3f5c35',
  leafDark: '#5f8b4c',
  leaf: '#7fb06c',
  leafLight: '#a9d493',
  trunk: '#7a5b43',
  trunkDark: '#5f4633',
  berry: '#e06a7c',
  berryLight: '#f49ca8',
} as const;

/** Árbol de bayas gigante de la Pradera (64×64, 2 frames de balanceo). */
const berryTree: SpriteDefinition = {
  id: 'clickable/berry-tree',
  width: 64,
  height: 64,
  paint(ctx, frame) {
    const sway = frame % 2 === 0 ? 0 : 1;

    // Tronco y raíces.
    px(ctx, 28, 40, 8, 20, TREE.trunk);
    px(ctx, 28, 40, 2, 20, TREE.trunkDark);
    px(ctx, 24, 56, 16, 4, TREE.trunkDark);
    px(ctx, 22, 58, 20, 2, TREE.outline);

    // Copa: tres discos solapados con el borde oscuro.
    disc(ctx, 32 + sway, 26, 20, TREE.outline);
    disc(ctx, 18 + sway, 32, 12, TREE.outline);
    disc(ctx, 46 + sway, 32, 12, TREE.outline);
    disc(ctx, 32 + sway, 26, 18, TREE.leafDark);
    disc(ctx, 18 + sway, 32, 10, TREE.leafDark);
    disc(ctx, 46 + sway, 32, 10, TREE.leafDark);
    disc(ctx, 30 + sway, 24, 14, TREE.leaf);
    disc(ctx, 26 + sway, 18, 7, TREE.leafLight);

    // Bayas.
    const berries: readonly [number, number][] = [
      [22, 28],
      [40, 22],
      [34, 34],
      [46, 31],
      [16, 34],
    ];
    for (const [bx, by] of berries) {
      px(ctx, bx + sway, by, 3, 3, TREE.berry);
      px(ctx, bx + sway, by, 1, 1, TREE.berryLight);
    }
  },
};

/* Cueva: morados fríos y un brillo que late con el frame. */
const CRYSTAL = {
  outline: '#473a63',
  rockDark: '#6a5f82',
  rock: '#857a9e',
  rockLight: '#a79cbd',
  gemDark: '#7a62c6',
  gem: '#a596f2',
  gemLight: '#d6cdfb',
} as const;

/** Veta de cristal de la Cueva (64×64, 2 frames de brillo). */
const crystalVein: SpriteDefinition = {
  id: 'clickable/crystal-vein',
  width: 64,
  height: 64,
  paint(ctx, frame) {
    const glow = frame % 2 === 0;

    // Bloque de roca: tres escalones para que no parezca un ladrillo.
    px(ctx, 12, 34, 40, 26, CRYSTAL.outline);
    px(ctx, 14, 36, 36, 22, CRYSTAL.rockDark);
    px(ctx, 16, 38, 30, 16, CRYSTAL.rock);
    px(ctx, 18, 40, 12, 6, CRYSTAL.rockLight);
    px(ctx, 10, 58, 44, 2, CRYSTAL.outline);

    /**
     * Cada cristal es un rombo: se pinta por filas con un ancho que crece
     * hasta la mitad y decrece después, así los bordes quedan en escalera.
     */
    const shard = (cx: number, baseY: number, height: number, half: number): void => {
      for (let i = 0; i < height; i += 1) {
        const t = i / (height - 1);
        const width = Math.max(1, Math.round(half * (t < 0.45 ? t / 0.45 : (1 - t) / 0.55)));
        const y = baseY - i;
        px(ctx, cx - width - 1, y, width * 2 + 3, 1, CRYSTAL.outline);
        px(ctx, cx - width, y, width * 2 + 1, 1, i % 3 === 0 ? CRYSTAL.gemDark : CRYSTAL.gem);
      }
      px(ctx, cx - 1, baseY - height + 3, 2, Math.max(2, height - 8), CRYSTAL.gemLight);
    };

    shard(32, 38, 30, 6);
    shard(20, 44, 20, 4);
    shard(45, 42, 24, 5);

    if (glow) {
      px(ctx, 31, 12, 3, 3, CRYSTAL.gemLight);
      px(ctx, 19, 27, 2, 2, CRYSTAL.gemLight);
      px(ctx, 45, 22, 2, 2, CRYSTAL.gemLight);
    }
  },
};

/* Lago: azules y una espuma que sube un píxel con el frame. */
const SPRING = {
  outline: '#3f6f93',
  stoneDark: '#6f8aa3',
  stone: '#93a8bd',
  waterDark: '#5b94c4',
  water: '#74aedc',
  waterLight: '#b2d8f0',
  foam: '#f1fbff',
} as const;

/** Manantial burbujeante del Lago (64×64, 2 frames de burbujeo). */
const spring: SpriteDefinition = {
  id: 'clickable/spring',
  width: 64,
  height: 64,
  paint(ctx, frame) {
    const lift = frame % 2 === 0 ? 0 : 1;

    // Brocal de piedra.
    px(ctx, 10, 44, 44, 16, SPRING.outline);
    px(ctx, 12, 46, 40, 12, SPRING.stoneDark);
    px(ctx, 14, 46, 36, 4, SPRING.stone);
    px(ctx, 8, 58, 48, 2, SPRING.outline);

    // Lámina de agua dentro del brocal.
    px(ctx, 16, 48, 32, 10, SPRING.waterDark);
    px(ctx, 18, 50, 28, 6, SPRING.water);
    px(ctx, 20, 50, 10, 2, SPRING.waterLight);

    // Chorro central: se estrecha al subir.
    for (let i = 0; i < 26; i += 1) {
      const y = 48 - i;
      const half = Math.max(1, Math.round(5 - i / 6));
      px(ctx, 32 - half - 1, y, half * 2 + 3, 1, SPRING.outline);
      px(ctx, 32 - half, y, half * 2 + 1, 1, i % 4 === 0 ? SPRING.waterLight : SPRING.water);
    }

    // Burbujas: suben un píxel en el segundo frame.
    const bubbles: readonly [number, number, number][] = [
      [24, 30, 3],
      [40, 24, 2],
      [30, 16, 2],
      [36, 36, 2],
    ];
    for (const [bx, by, size] of bubbles) {
      px(ctx, bx, by - lift, size, size, SPRING.foam);
    }
    px(ctx, 28, 12 - lift, 8, 2, SPRING.foam);
  },
};

const SPRITES = new Map<string, SpriteDefinition>(
  [berryTree, crystalVein, spring].map((sprite) => [sprite.id, sprite]),
);

export function getSprite(spriteId: string): SpriteDefinition {
  const sprite = SPRITES.get(spriteId);
  if (sprite === undefined) throw new Error(`Sprite desconocido: ${spriteId}`);
  return sprite;
}

export function registerSprite(sprite: SpriteDefinition): void {
  SPRITES.set(sprite.id, sprite);
  BOUNDS.delete(sprite.id);
}

/** Recuadro que ocupan de verdad los píxeles pintados de un sprite. */
export interface SpriteBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  /** Primera fila libre bajo el sprite: donde apoya en el suelo. */
  readonly bottom: number;
  readonly width: number;
}

const BOUNDS = new Map<string, SpriteBounds>();

/**
 * Mide dónde están los píxeles del sprite pintándolo una vez en un canvas
 * aparte. Hace falta porque un sprite suele dejar hueco libre por abajo: si se
 * coloca por el borde de su recuadro, la criatura o el árbol parecen flotar.
 * El resultado se cachea; con arte real seguirá funcionando igual.
 */
export function spriteBounds(spriteId: string): SpriteBounds {
  const cached = BOUNDS.get(spriteId);
  if (cached !== undefined) return cached;

  const sprite = getSprite(spriteId);
  const empty: SpriteBounds = {
    left: 0,
    right: sprite.width,
    top: 0,
    bottom: sprite.height,
    width: sprite.width,
  };

  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) return empty;

  ctx.imageSmoothingEnabled = false;
  sprite.paint(ctx, 0);
  const { data } = ctx.getImageData(0, 0, sprite.width, sprite.height);

  let left = sprite.width;
  let right = 0;
  let top = sprite.height;
  let bottom = 0;
  let painted = false;

  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      if ((data[(y * sprite.width + x) * 4 + 3] ?? 0) === 0) continue;
      painted = true;
      if (x < left) left = x;
      if (x >= right) right = x + 1;
      if (y < top) top = y;
      if (y >= bottom) bottom = y + 1;
    }
  }

  const bounds: SpriteBounds = painted ? { left, right, top, bottom, width: right - left } : empty;
  BOUNDS.set(spriteId, bounds);
  return bounds;
}

/**
 * Dibuja un sprite con su esquina superior izquierda en (x, y).
 * `scale` debe ser entero para no romper la nitidez.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteId: string,
  x: number,
  y: number,
  frame = 0,
  scale = 1,
): void {
  const sprite = getSprite(spriteId);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (scale !== 1) ctx.scale(scale, scale);
  sprite.paint(ctx, frame);
  ctx.restore();
}
