/**
 * Tabla de desbloqueos por nivel de entrenador (GDD · Progresión).
 * Es contenido descriptivo: dice qué abre cada nivel para poder anunciarlo al
 * jugador. Lo que de verdad está jugable lo decide cada fase.
 */
export interface LevelUnlock {
  readonly level: number;
  readonly description: string;
  /** Fase del plan en la que ese contenido entra en el juego. */
  readonly phase: number;
}

export const LEVEL_UNLOCKS: readonly LevelUnlock[] = [
  { level: 1, description: 'Pradera, Orbe básico y 4 plazas de Rancho', phase: 1 },
  { level: 2, description: 'Bayas en la tienda y el Huerto', phase: 4 },
  { level: 3, description: 'Equipo de combate (1 plaza) y la Guardería', phase: 5 },
  { level: 4, description: 'Orbe de red y la Mina', phase: 3 },
  { level: 5, description: 'Jefe de la Pradera; la Cueva tras vencerlo', phase: 6 },
  { level: 6, description: 'Equipo de 2 y el Taller', phase: 5 },
  { level: 7, description: 'Guantes de entrenador II', phase: 2 },
  { level: 8, description: 'Puesto de exploración y equipo de 3', phase: 4 },
  { level: 9, description: 'Orbe lunar', phase: 3 },
  { level: 10, description: 'Jefe de la Cueva; el Lago tras vencerlo', phase: 6 },
  { level: 12, description: 'Amuletos de tipo', phase: 7 },
  { level: 15, description: 'Jefe del Lago (fin del contenido del MVP)', phase: 6 },
];

/** Siguiente desbloqueo por encima del nivel dado, o `null` si no queda nada. */
export function nextUnlockAfter(level: number): LevelUnlock | null {
  return LEVEL_UNLOCKS.find((unlock) => unlock.level > level) ?? null;
}
