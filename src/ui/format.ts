/** Formatos de tiempo para la interfaz; el estado siempre guarda ms. */

/** «3 h 20 min» · «12 min» · «45 s». */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Cuenta atrás de un enfriamiento: por debajo del minuto baja de segundo en
 * segundo («0:48») y por encima se queda en minutos, que es lo que importa
 * cuando faltan veinte.
 */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
  return `${seconds} s`;
}
