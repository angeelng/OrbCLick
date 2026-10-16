import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { createLoop } from '../src/systems/loop';
import { createEventBus } from '../src/systems/events';
import { createInitialState } from '../src/core/state';

/** Bucle controlado: el tiempo y los fotogramas se inyectan a mano. */
function createHarness() {
  let now = 0;
  const frames: ((time: number) => void)[] = [];
  const ticks: number[] = [];
  const renders: { frameMs: number; alpha: number }[] = [];

  const loop = createLoop({
    now: () => now,
    requestFrame: (callback) => frames.push(callback),
    cancelFrame: () => frames.splice(0, frames.length),
    onTick: (tickMs) => {
      ticks.push(tickMs);
    },
    onRender: (frameMs, alpha) => {
      renders.push({ frameMs, alpha });
    },
  });

  /** Avanza el reloj y ejecuta el fotograma pendiente. */
  const advance = (ms: number): void => {
    now += ms;
    const pending = frames.pop();
    pending?.(now);
  };

  return { loop, advance, ticks, renders };
}

describe('createLoop', () => {
  it('ejecuta un tick por cada tickMs acumulado', () => {
    const { loop, advance, ticks } = createHarness();
    loop.start();
    advance(BALANCE.loop.tickMs * 3);
    expect(ticks).toHaveLength(3);
  });

  it('no ejecuta ticks parciales y guarda el resto para el siguiente fotograma', () => {
    const { loop, advance, ticks } = createHarness();
    loop.start();
    advance(BALANCE.loop.tickMs * 0.6);
    expect(ticks).toHaveLength(0);
    advance(BALANCE.loop.tickMs * 0.6);
    expect(ticks).toHaveLength(1);
  });

  it('renderiza una vez por fotograma con el alpha del tick pendiente', () => {
    const { loop, advance, renders } = createHarness();
    loop.start();
    advance(BALANCE.loop.tickMs * 1.5);
    expect(renders).toHaveLength(1);
    expect(renders[0]?.alpha).toBeCloseTo(0.5, 5);
  });

  it('acota el salto al volver de una pestaña inactiva', () => {
    const { loop, advance, ticks } = createHarness();
    loop.start();
    advance(60 * 60 * 1000);
    expect(ticks).toHaveLength(BALANCE.loop.maxFrameMs / BALANCE.loop.tickMs);
  });

  it('start es idempotente y stop detiene el bucle', () => {
    const { loop, advance, ticks } = createHarness();
    loop.start();
    loop.start();
    advance(BALANCE.loop.tickMs);
    expect(ticks).toHaveLength(1);

    loop.stop();
    advance(BALANCE.loop.tickMs * 5);
    expect(ticks).toHaveLength(1);
  });
});

describe('createEventBus', () => {
  it('entrega el payload a los suscriptores', () => {
    const bus = createEventBus();
    const seen: number[] = [];
    bus.on('trainer:levelup', ({ level }) => {
      seen.push(level);
    });
    bus.emit('trainer:levelup', { level: 3 });
    expect(seen).toEqual([3]);
  });

  it('no avisa a quien ya se dio de baja', () => {
    const bus = createEventBus();
    const seen: number[] = [];
    const off = bus.on('trainer:levelup', ({ level }) => {
      seen.push(level);
    });
    off();
    bus.emit('trainer:levelup', { level: 2 });
    expect(seen).toEqual([]);
  });

  it('tolera emitir un evento sin suscriptores', () => {
    const bus = createEventBus();
    expect(() => {
      bus.emit('state:changed', { state: createInitialState(0, 1) });
    }).not.toThrow();
  });

  it('permite darse de baja durante la propia emisión', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    const off = bus.on('game:saved', () => {
      seen.push('primero');
      off();
    });
    bus.on('game:saved', () => {
      seen.push('segundo');
    });
    bus.emit('game:saved', { at: 1 });
    bus.emit('game:saved', { at: 2 });
    expect(seen).toEqual(['primero', 'segundo', 'segundo']);
  });
});
