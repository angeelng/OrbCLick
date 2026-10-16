import { drawSprite, getSprite } from '../render/placeholders';
import { element } from './dom';

/**
 * Pinta un sprite en un `<canvas>` suelto para usarlo como icono del DOM.
 * El búfer guarda el tamaño lógico y el CSS lo amplía a escala entera, igual
 * que en las escenas, para que no se emborrone.
 */
export function spriteCanvas(spriteId: string, scale: number, frame = 0): HTMLCanvasElement {
  const sprite = getSprite(spriteId);
  const canvas = element('canvas', { className: 'portrait' });
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  canvas.style.width = `${sprite.width * scale}px`;
  canvas.style.height = `${sprite.height * scale}px`;

  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    ctx.imageSmoothingEnabled = false;
    drawSprite(ctx, spriteId, 0, 0, frame);
  }
  return canvas;
}
