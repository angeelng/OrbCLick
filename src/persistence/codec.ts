import { parseSaveFile, SaveParseError } from './parse';
import type { SaveFile } from './types';

/**
 * Exportar e importar partidas como texto. Se usa Base64 sobre el JSON para
 * que el jugador pueda copiar la partida en un mensaje sin que el texto se
 * rompa por el camino.
 */

const PREFIX = 'ORBCLICK';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Texto que el jugador copia: `ORBCLICK1:<base64>`, con la versión a la vista. */
export function encodeSave(save: SaveFile): string {
  return `${PREFIX}${save.version}:${toBase64(JSON.stringify(save))}`;
}

/**
 * Lee un código exportado. Acepta espacios y saltos de línea de copiar y pegar,
 * y pasa por las mismas migraciones y validaciones que una partida guardada.
 */
export function decodeSave(code: string, now: number, fallbackSeed: number): SaveFile {
  const cleaned = code.replace(/\s/g, '');
  if (cleaned === '') throw new SaveParseError('El código está vacío.');

  const separator = cleaned.indexOf(':');
  const body =
    cleaned.startsWith(PREFIX) && separator >= 0 ? cleaned.slice(separator + 1) : cleaned;

  let json: string;
  try {
    json = fromBase64(body);
  } catch {
    throw new SaveParseError('El código no es una partida de Orbclick.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SaveParseError('El código está incompleto o corrupto.');
  }

  return parseSaveFile(raw, now, fallbackSeed);
}
