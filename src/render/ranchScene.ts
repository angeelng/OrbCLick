import { creaturesAtPost, isPostUnlocked } from '../core/ranch';
import type { CapturedCreature, GameState } from '../core/state';
import { POST_IDS, getPost, type PostId } from '../data/posts';
import { getSpecies } from '../data/species';
import { creatureSpriteId } from './creatureSprites';
import { createBrush, getPostScene } from './postScenes';
import type { PixelCanvas } from './pixel';
import { drawSprite, getSprite, spriteBounds } from './placeholders';

/** Canvas lógico del Rancho (GDD · Pixel art y escalado). */
export const RANCH_CANVAS = { width: 256, height: 160 } as const;

/** Rejilla de puestos: tres columnas y dos filas sobre el ancho de referencia. */
const COLUMNS = 3;
const ROWS = 2;

const COLORS = {
  ground: '#eae3f3',
  /* Filete neutro: sobre una cueva o un taller, un borde verde desentona. */
  border: 'rgba(43, 36, 54, 0.22)',
  borderLocked: '#ded4ec',
  label: '#847a96',
  /* Velo sobre un puesto cerrado: se ve lo que habrá, pero apagado. */
  lockedVeil: 'rgba(230, 224, 240, 0.68)',
} as const;

export interface RanchScene {
  render(frameMs: number, state: GameState): void;
  /** Puesto que hay bajo el punto lógico, si hay alguno. */
  postAt(x: number, y: number): PostId | null;
  dispose(): void;
}

interface Plot {
  readonly postId: PostId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function createRanchScene(canvas: PixelCanvas): RanchScene {
  const { ctx } = canvas;
  let plots: readonly Plot[] = [];
  let elapsed = 0;

  const measure = (width: number, height: number): readonly Plot[] => {
    const gap = 3;
    const plotWidth = Math.floor((width - gap * (COLUMNS + 1)) / COLUMNS);
    const plotHeight = Math.floor((height - gap * (ROWS + 1)) / ROWS);

    return POST_IDS.map((postId, index) => ({
      postId,
      x: gap + (index % COLUMNS) * (plotWidth + gap),
      y: gap + Math.floor(index / COLUMNS) * (plotHeight + gap),
      width: plotWidth,
      height: plotHeight,
    }));
  };

  plots = measure(canvas.width, canvas.height);
  canvas.onResize((width, height) => {
    plots = measure(width, height);
  });

  /** Las criaturas pasean por su parcela a un paso lento y reproducible. */
  const walkOffset = (creature: CapturedCreature, span: number): number => {
    const phase = (creature.uid % 7) / 7;
    return Math.round(((Math.sin(elapsed / 1400 + phase * Math.PI * 2) + 1) / 2) * span);
  };

  const drawPlot = (plot: Plot, state: GameState): void => {
    const unlocked = isPostUnlocked(state, plot.postId);
    const scene = getPostScene(plot.postId);

    /*
     * Cada puesto pinta su propio escenario, que es lo que lo identifica de un
     * vistazo. La escena se recorta a la parcela para que nada se salga a la
     * de al lado.
     */
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, plot.width, plot.height);
    ctx.clip();
    scene.paint(createBrush(ctx, plot.x, plot.y, plot.width, plot.height));
    ctx.restore();

    if (!unlocked) {
      // Cerrado: se ve el escenario, pero apagado y con su candado.
      ctx.fillStyle = COLORS.lockedVeil;
      ctx.fillRect(plot.x, plot.y, plot.width, plot.height);
    }

    ctx.fillStyle = unlocked ? COLORS.border : COLORS.borderLocked;
    ctx.fillRect(plot.x, plot.y, plot.width, 1);
    ctx.fillRect(plot.x, plot.y + plot.height - 1, plot.width, 1);
    ctx.fillRect(plot.x, plot.y, 1, plot.height);
    ctx.fillRect(plot.x + plot.width - 1, plot.y, 1, plot.height);

    if (!unlocked) {
      // Candado de 5×6 píxeles en el centro de la parcela cerrada.
      const cx = plot.x + Math.round(plot.width / 2) - 2;
      const cy = plot.y + Math.round(plot.height / 2) - 3;
      ctx.fillStyle = COLORS.label;
      ctx.fillRect(cx, cy + 2, 5, 4);
      ctx.fillRect(cx + 1, cy, 3, 1);
      ctx.fillRect(cx, cy + 1, 1, 1);
      ctx.fillRect(cx + 4, cy + 1, 1, 1);
      return;
    }

    const workers = creaturesAtPost(state, plot.postId);
    // Las criaturas pisan el suelo que marca su escenario, no el borde.
    const floor = plot.y + Math.round(plot.height * scene.ground);

    workers.slice(0, 4).forEach((worker, index) => {
      const species = getSpecies(worker.speciesId);
      const spriteId = creatureSpriteId(species, worker.shiny);
      const sprite = getSprite(spriteId);
      const bounds = spriteBounds(spriteId);

      const lane = Math.min(plot.width - sprite.width - 2, 2 + index * 17);
      const x = lane + walkOffset(worker, Math.max(0, plot.width - sprite.width - lane - 2));
      const y = floor - bounds.bottom;

      // El sprite ya trae su sombra; aquí solo se le da el paseo.
      drawSprite(ctx, spriteId, plot.x + x, y, Math.floor(elapsed / 360) % 2);

      if (worker.satiety <= 0) {
        // Marca de criatura parada por hambre.
        ctx.fillStyle = '#e06a7c';
        ctx.fillRect(plot.x + x + bounds.left, y - 3, bounds.width, 1);
      }
    });
  };

  return {
    render(frameMs, state) {
      elapsed += frameMs;
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const plot of plots) drawPlot(plot, state);
    },

    postAt(x, y) {
      const plot = plots.find(
        (candidate) =>
          x >= candidate.x &&
          x < candidate.x + candidate.width &&
          y >= candidate.y &&
          y < candidate.y + candidate.height,
      );
      return plot?.postId ?? null;
    },

    dispose() {
      canvas.dispose();
    },
  };
}

/** Nombre del puesto, para los rótulos de la interfaz. */
export function postName(postId: PostId): string {
  return getPost(postId).name;
}
