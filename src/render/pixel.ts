/**
 * Canvas de pixel art con escalado entero.
 *
 * El búfer guarda píxeles lógicos y el CSS los amplía ×2, ×3… sin interpolar,
 * así que un píxel lógico siempre cae en un cuadrado exacto de pantalla.
 *
 * El factor de ampliación sale de la composición de referencia del GDD
 * (160×160 la zona, 256×160 el Rancho), pero el búfer se estira hasta llenar
 * la caja entera: así la escena cubre todo su hueco sin bordes muertos y sin
 * perder nitidez. La escena dibuja sobre `width` × `height`, que cambian con
 * el tamaño de la ventana.
 */
export interface PixelCanvas {
  readonly element: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Ancho lógico actual, en píxeles de pixel art. */
  readonly width: number;
  readonly height: number;
  /** Composición de referencia alrededor de la cual se centra la escena. */
  readonly baseWidth: number;
  readonly baseHeight: number;
  /** Factor de ampliación actual (entero ≥ 1). */
  readonly scale: number;
  /** Convierte coordenadas de puntero a coordenadas lógicas del canvas. */
  toLogical(clientX: number, clientY: number): { x: number; y: number };
  /** Avisa cuando cambia el tamaño lógico, para recolocar la escena. */
  onResize(listener: (width: number, height: number) => void): void;
  dispose(): void;
}

export interface PixelCanvasOptions {
  readonly maxScale?: number;
}

export function createPixelCanvas(
  element: HTMLCanvasElement,
  baseWidth: number,
  baseHeight: number,
  options: PixelCanvasOptions = {},
): PixelCanvas {
  const maxScale = options.maxScale ?? 6;
  const ctx = element.getContext('2d', { alpha: false });
  if (ctx === null) throw new Error('Canvas 2D no disponible');

  let scale = 1;
  let width = baseWidth;
  let height = baseHeight;
  const listeners: ((width: number, height: number) => void)[] = [];

  const apply = (): void => {
    const host = element.parentElement;
    const boxWidth = Math.max(baseWidth, Math.floor(host?.clientWidth ?? baseWidth));
    const boxHeight = Math.max(baseHeight, Math.floor(host?.clientHeight ?? baseHeight));

    const nextScale = Math.max(
      1,
      Math.min(maxScale, Math.floor(Math.min(boxWidth / baseWidth, boxHeight / baseHeight))),
    );
    const nextWidth = Math.floor(boxWidth / nextScale);
    const nextHeight = Math.floor(boxHeight / nextScale);
    if (nextScale === scale && nextWidth === width && nextHeight === height) return;

    scale = nextScale;
    width = nextWidth;
    height = nextHeight;

    element.width = width;
    element.height = height;
    element.style.width = `${width * scale}px`;
    element.style.height = `${height * scale}px`;
    // Cambiar el tamaño del búfer reinicia el contexto: hay que reafirmarlo.
    ctx.imageSmoothingEnabled = false;

    for (const listener of listeners) listener(width, height);
  };

  apply();

  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          apply();
        });
  if (observer !== null && element.parentElement !== null) {
    observer.observe(element.parentElement);
  }

  return {
    element,
    ctx,
    baseWidth,
    baseHeight,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get scale() {
      return scale;
    },
    toLogical(clientX, clientY) {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.floor(((clientX - rect.left) / rect.width) * width),
        y: Math.floor(((clientY - rect.top) / rect.height) * height),
      };
    },
    onResize(listener) {
      listeners.push(listener);
    },
    dispose() {
      observer?.disconnect();
      listeners.length = 0;
    },
  };
}
