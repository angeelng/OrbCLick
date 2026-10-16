import { BALANCE } from '../data/balance';

export interface LoopOptions {
  /** Un tick lógico de duración fija (`BALANCE.loop.tickMs`). */
  readonly onTick: (tickMs: number, now: number) => void;
  /** Render por fotograma; `alpha` es la fracción de tick pendiente. */
  readonly onRender: (frameMs: number, alpha: number) => void;
  readonly now?: () => number;
  readonly requestFrame?: (callback: (time: number) => void) => number;
  readonly cancelFrame?: (handle: number) => void;
}

export interface Loop {
  start(): void;
  stop(): void;
}

/**
 * `requestAnimationFrame` para el render y un acumulador para los ticks
 * lógicos de 100 ms, así la simulación no depende de los FPS.
 */
export function createLoop(options: LoopOptions): Loop {
  const now = options.now ?? (() => performance.now());
  const requestFrame = options.requestFrame ?? requestAnimationFrame.bind(globalThis);
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame.bind(globalThis);
  const { tickMs, maxFrameMs } = BALANCE.loop;

  let handle: number | null = null;
  let previous = 0;
  let accumulator = 0;

  const frame = (): void => {
    const current = now();
    const frameMs = Math.min(maxFrameMs, current - previous);
    previous = current;
    accumulator += frameMs;

    while (accumulator >= tickMs) {
      accumulator -= tickMs;
      options.onTick(tickMs, current);
    }
    options.onRender(frameMs, accumulator / tickMs);
    handle = requestFrame(frame);
  };

  return {
    start() {
      if (handle !== null) return;
      previous = now();
      accumulator = 0;
      handle = requestFrame(frame);
    },
    stop() {
      if (handle === null) return;
      cancelFrame(handle);
      handle = null;
    },
  };
}
