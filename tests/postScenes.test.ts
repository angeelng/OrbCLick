import { describe, expect, it } from 'vitest';
import { POST_IDS } from '../src/data/posts';
import { POST_SCENES, getPostScene, type SceneBrush } from '../src/render/postScenes';

/** Pincel de mentira: apunta lo que se pinta en vez de pintarlo. */
function recordingBrush(w: number, h: number): SceneBrush & { readonly strokes: string[] } {
  const strokes: string[] = [];
  return {
    w,
    h,
    strokes,
    px(x, y, width, height, color) {
      strokes.push(`px ${x} ${y} ${width} ${height} ${color}`);
    },
    dither(x, y, width, height, color, step) {
      strokes.push(`dither ${x} ${y} ${width} ${height} ${color} ${step}`);
    },
    v: (fraction) => Math.round(h * fraction),
  };
}

describe('escenarios de los puestos', () => {
  it('hay escena para los seis puestos, y ninguna de sobra', () => {
    expect(Object.keys(POST_SCENES).sort()).toEqual([...POST_IDS].sort());
  });

  it('el suelo de cada escena cae en la mitad de abajo de la parcela', () => {
    for (const postId of POST_IDS) {
      const { ground } = getPostScene(postId);
      expect(ground, postId).toBeGreaterThan(0.5);
      expect(ground, postId).toBeLessThanOrEqual(1);
    }
  });

  it('se pintan a cualquier tamaño de parcela sin salirse ni romperse', () => {
    // Parcelas posibles: desde una ventana estrecha hasta una pantalla ancha.
    for (const [w, h] of [
      [48, 40],
      [91, 85],
      [160, 120],
    ] as const) {
      for (const postId of POST_IDS) {
        const brush = recordingBrush(w, h);
        expect(() => {
          getPostScene(postId).paint(brush);
        }, `${postId} ${w}×${h}`).not.toThrow();
        // Cada escena pinta algo: nunca se queda en una caja vacía.
        expect(brush.strokes.length, `${postId} ${w}×${h}`).toBeGreaterThan(10);
      }
    }
  });

  it('cada escena empieza llenando su caja entera, sin huecos', () => {
    for (const postId of POST_IDS) {
      const brush = recordingBrush(91, 85);
      getPostScene(postId).paint(brush);
      expect(brush.strokes[0], postId).toMatch(/^px 0 0 91 85 #/);
    }
  });
});
