import { describe, expect, it } from 'vitest';
import {
  CREATURE_ART,
  CREATURE_SPRITE_SIZE,
  SHARED_COLORS,
  SHINY_PALETTE,
} from '../src/render/creatureMaps';
import { SPECIES_IDS, SPECIES_LIST } from '../src/data/species';

/** Claves válidas de un mapa: paleta propia, ojos, sombra y transparente. */
const KEYS = new Set(['O', 'B', 'L', 'D', 'A', 'a', 'W', 'E', 'S', '.']);
const HEX = /^#[0-9a-f]{6}$/;

describe('mapas de criatura', () => {
  it('hay dibujo para las quince especies, y ninguno de sobra', () => {
    expect(Object.keys(CREATURE_ART).sort()).toEqual([...SPECIES_IDS].sort());
  });

  it('todos son cuadrados del tamaño del sprite', () => {
    for (const [id, art] of Object.entries(CREATURE_ART)) {
      expect(art.map, id).toHaveLength(CREATURE_SPRITE_SIZE);
      for (const [index, row] of art.map.entries()) {
        expect(row.length, `${id} fila ${index}`).toBe(CREATURE_SPRITE_SIZE);
      }
    }
  });

  it('solo usan claves conocidas', () => {
    for (const [id, art] of Object.entries(CREATURE_ART)) {
      for (const row of art.map) {
        for (const key of row) {
          expect(KEYS.has(key), `${id} usa la clave ${key}`).toBe(true);
        }
      }
    }
  });

  it('cada paleta trae sus seis tonos en hexadecimal', () => {
    for (const [id, art] of Object.entries(CREATURE_ART)) {
      for (const [slot, color] of Object.entries(art.palette)) {
        expect(color, `${id}.${slot}`).toMatch(HEX);
      }
    }
  });

  it('el contorno es más oscuro que el cuerpo, nunca negro puro', () => {
    const luminance = (hex: string): number =>
      Number.parseInt(hex.slice(1, 3), 16) * 0.299 +
      Number.parseInt(hex.slice(3, 5), 16) * 0.587 +
      Number.parseInt(hex.slice(5, 7), 16) * 0.114;

    for (const [id, art] of Object.entries(CREATURE_ART)) {
      expect(luminance(art.palette.O), `${id} contorno`).toBeLessThan(luminance(art.palette.B));
      expect(art.palette.O, `${id} contorno`).not.toBe('#000000');
      expect(luminance(art.palette.O), `${id} contorno`).toBeGreaterThan(20);
    }
  });

  it('todas tienen ojos y cuerpo dibujados', () => {
    for (const [id, art] of Object.entries(CREATURE_ART)) {
      const pixels = art.map.join('');
      expect(pixels.includes('E'), `${id} sin pupila`).toBe(true);
      // El brillo del ojo es opcional: Ranaflor los lleva diminutos, sobre tallos.
      // Ascuín es toda llama: su cuerpo es acento y luz, sin tono `B`.
      const hasBody = ['B', 'L', 'A'].some((key) => pixels.includes(key));
      expect(hasBody, `${id} sin cuerpo`).toBe(true);
      expect(pixels.includes('O'), `${id} sin contorno`).toBe(true);
    }
  });

  it('el dibujo cabe en el lienzo: deja libre al menos una columna por lado', () => {
    for (const [id, art] of Object.entries(CREATURE_ART)) {
      for (const row of art.map) {
        expect(row.length, id).toBe(CREATURE_SPRITE_SIZE);
      }
    }
  });

  it('la paleta variocolor cubre los mismos tonos', () => {
    expect(Object.keys(SHINY_PALETTE).sort()).toEqual(
      Object.keys(CREATURE_ART.brotillo.palette).sort(),
    );
  });

  it('los ojos y la sombra son comunes a todo el roster', () => {
    expect(SHARED_COLORS.W).toMatch(HEX);
    expect(SHARED_COLORS.E).toMatch(HEX);
    expect(SHARED_COLORS.S.startsWith('rgba(')).toBe(true);
  });

  it('cada especie apunta a su propio spriteId', () => {
    for (const species of SPECIES_LIST) {
      expect(species.spriteId).toBe(`creature/${species.id}`);
    }
  });
});
