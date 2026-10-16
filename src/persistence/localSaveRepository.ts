import { parseSaveFile } from './parse';
import type { SaveFile, SaveRepository } from './types';

const DEFAULT_KEY = 'orbclick:save:v1';

export interface LocalSaveRepositoryOptions {
  readonly key?: string;
  /** Inyectable para tests; por defecto `window.localStorage`. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Reloj y semilla para rellenar campos ausentes al parsear. */
  readonly now: () => number;
  readonly fallbackSeed: () => number;
}

/** `SaveRepository` sobre localStorage; el MVP no tiene nube (post-MVP). */
export class LocalSaveRepository implements SaveRepository {
  private readonly key: string;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  private readonly now: () => number;
  private readonly fallbackSeed: () => number;

  constructor(options: LocalSaveRepositoryOptions) {
    this.key = options.key ?? DEFAULT_KEY;
    this.storage = options.storage ?? localStorage;
    this.now = options.now;
    this.fallbackSeed = options.fallbackSeed;
  }

  load(): Promise<SaveFile | null> {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return Promise.resolve(null);
    try {
      return Promise.resolve(
        parseSaveFile(JSON.parse(raw) as unknown, this.now(), this.fallbackSeed()),
      );
    } catch (error) {
      console.warn('[orbclick] partida ilegible, se empieza de cero', error);
      return Promise.resolve(null);
    }
  }

  save(data: SaveFile): Promise<void> {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      // Cuota llena o almacenamiento bloqueado: el juego sigue, sin guardar.
      console.warn('[orbclick] no se pudo guardar', error);
    }
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.storage.removeItem(this.key);
    return Promise.resolve();
  }
}
