import { ORB_LIST, type OrbId } from '../data/orbs';
import { registerSprite, type SpriteDefinition } from './placeholders';

/**
 * Placeholders de los orbes (12×12). Igual que las criaturas, se piden por
 * `spriteId`, así que el arte real entra sin tocar la animación.
 *
 * El dibujo es una esfera partida: casquete de color arriba, base clara
 * abajo, ecuador oscuro y botón en el centro. A ×3 en la interfaz se lee de
 * un vistazo qué orbe es por su color.
 */
interface OrbPalette {
  /** Casquete superior. */
  readonly top: string;
  /** Base, siempre más clara para que la esfera tenga volumen. */
  readonly bottom: string;
  /** Botón central y detalles. */
  readonly accent: string;
}

const ORB_COLORS: Readonly<Record<OrbId, OrbPalette>> = {
  basic: { top: '#c2593f', bottom: '#d6d9e0', accent: '#e8e2d0' },
  net: { top: '#4a86b8', bottom: '#cfdfd2', accent: '#7fa36b' },
  lunar: { top: '#8f7fc4', bottom: '#e6e0f5', accent: '#e0a24a' },
};

const OUTLINE = '#161a22';
const SIZE = 12;
const CENTER = 5;
const RADIUS = 5;

/** Mitad de disco pixelado: `fromDy`–`toDy` son filas respecto al centro. */
function discRows(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  fromDy: number,
  toDy: number,
): void {
  ctx.fillStyle = color;
  for (let dy = fromDy; dy <= toDy; dy += 1) {
    const span = Math.floor(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
    ctx.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
  }
}

function createOrbSprite(orbId: OrbId): SpriteDefinition {
  const palette = ORB_COLORS[orbId];

  return {
    id: `orb/${orbId}`,
    width: SIZE,
    height: SIZE,
    paint(ctx, frame) {
      // Silueta y volumen.
      discRows(ctx, CENTER, CENTER, RADIUS, OUTLINE, -RADIUS, RADIUS);
      discRows(ctx, CENTER, CENTER, RADIUS - 1, palette.top, -(RADIUS - 1), -1);
      discRows(ctx, CENTER, CENTER, RADIUS - 1, palette.bottom, 1, RADIUS - 1);

      // Ecuador y botón central.
      discRows(ctx, CENTER, CENTER, RADIUS - 1, OUTLINE, 0, 0);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(CENTER - 1, CENTER - 1, 3, 3);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(CENTER, CENTER, 1, 1);

      // El brillo cambia de sitio entre fotogramas: el orbe parece girar.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(frame % 2 === 0 ? CENTER - 2 : CENTER + 1, CENTER - 3, 1, 1);
    },
  };
}

let registered = false;

export function registerOrbSprites(): void {
  if (registered) return;
  registered = true;
  for (const orb of ORB_LIST) registerSprite(createOrbSprite(orb.id));
}

export function orbSpriteId(orbId: OrbId): string {
  return `orb/${orbId}`;
}
