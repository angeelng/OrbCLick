import { describe, expect, it } from 'vitest';
import { buyUpgrade } from '../src/core/engine';
import { createInitialState } from '../src/core/state';
import { decodeSave, encodeSave } from '../src/persistence/codec';
import { SaveParseError } from '../src/persistence/parse';
import { SAVE_VERSION, toSaveFile } from '../src/persistence/types';

const NOW = 1_700_000_000_000;
const SEED = 99;

function sampleSave() {
  const state = buyUpgrade(
    { ...createInitialState(NOW, SEED), coins: 500 },
    'gloves-1',
    2,
    NOW,
  ).state;
  return toSaveFile(state, NOW);
}

describe('encodeSave / decodeSave', () => {
  it('da la vuelta completa a una partida', () => {
    const save = sampleSave();
    expect(decodeSave(encodeSave(save), NOW, SEED)).toEqual(save);
  });

  it('el código lleva el prefijo y la versión a la vista', () => {
    expect(encodeSave(sampleSave()).startsWith(`ORBCLICK${SAVE_VERSION}:`)).toBe(true);
  });

  it('sobrevive a los espacios y saltos de línea de copiar y pegar', () => {
    const code = encodeSave(sampleSave());
    const dirty = `  ${code.slice(0, 20)}\n${code.slice(20)}\t `;
    expect(decodeSave(dirty, NOW, SEED).state.upgrades['gloves-1']).toBe(2);
  });

  it('acepta un código sin prefijo', () => {
    const code = encodeSave(sampleSave());
    const body = code.slice(code.indexOf(':') + 1);
    expect(decodeSave(body, NOW, SEED).state.coins).toBe(285);
  });

  it('conserva monedas, nivel y mejoras', () => {
    const decoded = decodeSave(encodeSave(sampleSave()), NOW, SEED).state;
    expect(decoded.coins).toBe(500 - (100 + 115));
    expect(decoded.upgrades).toEqual({ 'gloves-1': 2 });
    expect(decoded.trainer).toEqual({ level: 1, xp: 0 });
  });

  it('rechaza un código vacío', () => {
    expect(() => decodeSave('   ', NOW, SEED)).toThrow(SaveParseError);
  });

  it('rechaza texto que no es Base64', () => {
    expect(() => decodeSave('ORBCLICK2:¡hola!', NOW, SEED)).toThrow(SaveParseError);
  });

  it('rechaza Base64 que no contiene JSON', () => {
    expect(() => decodeSave(btoa('esto no es json'), NOW, SEED)).toThrow(SaveParseError);
  });

  it('rechaza un código recortado a la mitad', () => {
    const code = encodeSave(sampleSave());
    expect(() => decodeSave(code.slice(0, Math.floor(code.length / 2)), NOW, SEED)).toThrow(
      SaveParseError,
    );
  });

  it('pasa por las mismas validaciones que una partida guardada', () => {
    const corrupt = btoa(
      JSON.stringify({ version: SAVE_VERSION, state: { coins: -5, upgrades: { falso: 9 } } }),
    );
    const decoded = decodeSave(corrupt, NOW, SEED).state;
    expect(decoded.coins).toBe(0);
    expect(decoded.upgrades).toEqual({});
  });
});
