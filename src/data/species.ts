import type { AbilityDefinition, CombatStats } from './combat';
import type { CreatureType } from './types';
import type { ZoneId } from './zones';

/** Rarezas del MVP; la legendaria es exclusiva de los jefes. */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

export type Rarity = (typeof RARITIES)[number];

export const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
};

/** Las seis aptitudes de trabajo del Rancho (GDD · Rancho y trabajo). */
export const WORK_SKILLS = ['gather', 'mine', 'farm', 'explore', 'craft', 'care'] as const;

export type WorkSkill = (typeof WORK_SKILLS)[number];

export const WORK_SKILL_NAMES: Readonly<Record<WorkSkill, string>> = {
  gather: 'Recolectar',
  mine: 'Minar',
  farm: 'Cultivar',
  explore: 'Explorar',
  craft: 'Artesanía',
  care: 'Cuidar',
};

export interface SpeciesDefinition {
  readonly id: SpeciesId;
  readonly name: string;
  readonly type: CreatureType;
  readonly rarity: Rarity;
  /** Zona donde aparece; para los jefes, la zona que defienden. */
  readonly zoneId: ZoneId;
  /** Aptitudes de trabajo, de 1 a 3 (GDD). */
  readonly skills: Readonly<Partial<Record<WorkSkill, number>>>;
  /** Habilidad pasiva de Rancho; su efecto se implementa en la fase 4. */
  readonly passive: string;
  /**
   * Estadísticas base de combate. El GDD pide PV, ATQ, DEF y VEL pero no da
   * cifras: estas son un punto de partida construido por rareza (común,
   * poco común, rara y legendaria suben de escalón) y por carácter de la
   * criatura, que inclina el reparto hacia aguante, pegada o velocidad.
   */
  readonly stats: CombatStats;
  /** Habilidad activa de combate. */
  readonly ability: AbilityDefinition;
  /** El dibujo vive en `render/creatureMaps.ts`, indexado por este id. */
  readonly spriteId: string;
  readonly isBoss: boolean;
}

export const SPECIES_IDS = [
  'brotillo',
  'pelusin',
  'ascuin',
  'chispin',
  'pedrusco',
  'musgolito',
  'brasacol',
  'cuarzin',
  'goton',
  'ranaflor',
  'anguilux',
  'nenufrel',
  'cornavid',
  'geodron',
  'marealis',
] as const;

export type SpeciesId = (typeof SPECIES_IDS)[number];

type SpeciesSeed = Omit<SpeciesDefinition, 'spriteId' | 'isBoss'> & { readonly isBoss?: boolean };

function define(seed: SpeciesSeed): SpeciesDefinition {
  return { ...seed, spriteId: `creature/${seed.id}`, isBoss: seed.isBoss ?? false };
}

/** Roster del MVP: 12 capturables y 3 jefes (GDD · Criaturas). */
export const SPECIES: Readonly<Record<SpeciesId, SpeciesDefinition>> = {
  brotillo: define({
    id: 'brotillo',
    name: 'Brotillo',
    type: 'plant',
    rarity: 'common',
    zoneId: 'meadow',
    skills: { farm: 2 },
    passive: '+5 % de bayas por cada Brotillo',
    stats: { hp: 36, atk: 9, def: 13, spd: 7 },
    ability: { name: 'Látigo de hoja', kind: 'damage', power: 1.6, chargeMs: 11_000 },
  }),
  pelusin: define({
    id: 'pelusin',
    name: 'Pelusín',
    type: 'air',
    rarity: 'common',
    zoneId: 'meadow',
    skills: { gather: 1, explore: 1 },
    passive: '+10 % de apariciones de salvajes',
    stats: { hp: 30, atk: 10, def: 8, spd: 16 },
    ability: { name: 'Ráfaga', kind: 'damage', power: 1.4, chargeMs: 10_000 },
  }),
  ascuin: define({
    id: 'ascuin',
    name: 'Ascuín',
    type: 'fire',
    rarity: 'uncommon',
    zoneId: 'meadow',
    skills: { mine: 1 },
    passive: 'El 3 % de los clics valen ×5',
    stats: { hp: 40, atk: 16, def: 11, spd: 14 },
    ability: { name: 'Chispazo ardiente', kind: 'damage', power: 1.9, chargeMs: 13_000 },
  }),
  chispin: define({
    id: 'chispin',
    name: 'Chispín',
    type: 'electric',
    rarity: 'rare',
    zoneId: 'meadow',
    skills: { gather: 2 },
    passive: 'CPS ×2 durante 10 s cada 60 s',
    stats: { hp: 52, atk: 20, def: 15, spd: 20 },
    ability: { name: 'Descarga', kind: 'damage', power: 2.2, chargeMs: 14_000 },
  }),
  pedrusco: define({
    id: 'pedrusco',
    name: 'Pedrusco',
    type: 'rock',
    rarity: 'common',
    zoneId: 'cave',
    skills: { mine: 2 },
    passive: '+1 moneda plana por clic',
    stats: { hp: 38, atk: 10, def: 15, spd: 6 },
    ability: { name: 'Placaje rocoso', kind: 'damage', power: 1.7, chargeMs: 12_000 },
  }),
  musgolito: define({
    id: 'musgolito',
    name: 'Musgolito',
    type: 'plant',
    rarity: 'common',
    zoneId: 'cave',
    skills: { farm: 1, care: 1 },
    passive: 'Las bayas sacian un 20 % más',
    stats: { hp: 34, atk: 8, def: 14, spd: 8 },
    ability: { name: 'Esporas', kind: 'sleep', power: 3, chargeMs: 16_000 },
  }),
  brasacol: define({
    id: 'brasacol',
    name: 'Brasacol',
    type: 'fire',
    rarity: 'uncommon',
    zoneId: 'cave',
    skills: { mine: 2, craft: 1 },
    passive: 'Orbes un 10 % más baratos',
    stats: { hp: 44, atk: 15, def: 14, spd: 11 },
    ability: { name: 'Llamarada', kind: 'damage', power: 2, chargeMs: 14_000 },
  }),
  cuarzin: define({
    id: 'cuarzin',
    name: 'Cuarzín',
    type: 'rock',
    rarity: 'rare',
    zoneId: 'cave',
    skills: { mine: 3 },
    passive: '+15 % de monedas por clic en la Cueva',
    stats: { hp: 60, atk: 17, def: 22, spd: 12 },
    ability: { name: 'Escudo de cristal', kind: 'shield', power: 0.35, chargeMs: 15_000 },
  }),
  goton: define({
    id: 'goton',
    name: 'Gotón',
    type: 'water',
    rarity: 'common',
    zoneId: 'lake',
    skills: { gather: 1 },
    passive: '+10 % de producción de las criaturas Planta',
    stats: { hp: 34, atk: 10, def: 11, spd: 10 },
    ability: { name: 'Burbuja', kind: 'damage', power: 1.5, chargeMs: 11_000 },
  }),
  ranaflor: define({
    id: 'ranaflor',
    name: 'Ranaflor',
    type: 'plant',
    rarity: 'uncommon',
    zoneId: 'lake',
    skills: { farm: 2, gather: 1 },
    passive: '+1 baya extra por cosecha',
    stats: { hp: 42, atk: 13, def: 13, spd: 13 },
    ability: { name: 'Drenaje', kind: 'heal', power: 0.25, chargeMs: 15_000 },
  }),
  anguilux: define({
    id: 'anguilux',
    name: 'Anguilux',
    type: 'electric',
    rarity: 'uncommon',
    zoneId: 'lake',
    skills: { gather: 2, explore: 1 },
    passive: 'Las salvajes raras aparecen un 15 % más',
    stats: { hp: 40, atk: 15, def: 11, spd: 18 },
    ability: { name: 'Electroespiral', kind: 'damage', power: 1.8, chargeMs: 12_000 },
  }),
  nenufrel: define({
    id: 'nenufrel',
    name: 'Nenúfrel',
    type: 'water',
    rarity: 'rare',
    zoneId: 'lake',
    skills: { care: 2, craft: 2 },
    passive: '10 % de no gastar el orbe',
    stats: { hp: 56, atk: 16, def: 20, spd: 14 },
    ability: { name: 'Marea curativa', kind: 'heal', power: 0.35, chargeMs: 17_000 },
  }),
  cornavid: define({
    id: 'cornavid',
    name: 'Cornavid',
    type: 'plant',
    rarity: 'legendary',
    zoneId: 'meadow',
    skills: { farm: 3, gather: 2 },
    passive: '×1,5 de producción en la Pradera',
    stats: { hp: 95, atk: 26, def: 26, spd: 16 },
    ability: { name: 'Raíz ancestral', kind: 'heal', power: 0.3, chargeMs: 18_000 },
    isBoss: true,
  }),
  geodron: define({
    id: 'geodron',
    name: 'Geodrón',
    type: 'rock',
    rarity: 'legendary',
    zoneId: 'cave',
    skills: { mine: 3, craft: 2 },
    passive: '×1,5 de producción en la Cueva',
    stats: { hp: 110, atk: 28, def: 30, spd: 12 },
    ability: { name: 'Terremoto', kind: 'damage', power: 2.4, chargeMs: 20_000 },
    isBoss: true,
  }),
  marealis: define({
    id: 'marealis',
    name: 'Marealis',
    type: 'water',
    rarity: 'legendary',
    zoneId: 'lake',
    skills: { gather: 3, care: 2 },
    passive: '×1,5 de producción en el Lago',
    stats: { hp: 100, atk: 27, def: 24, spd: 20 },
    ability: { name: 'Gran marea', kind: 'damage', power: 2.3, chargeMs: 19_000 },
    isBoss: true,
  }),
};

export const SPECIES_LIST: readonly SpeciesDefinition[] = SPECIES_IDS.map((id) => SPECIES[id]);

export function getSpecies(id: SpeciesId): SpeciesDefinition {
  return SPECIES[id];
}

export function isSpeciesId(value: unknown): value is SpeciesId {
  return typeof value === 'string' && (SPECIES_IDS as readonly string[]).includes(value);
}

/** Salvajes que pueden aparecer en una zona (los jefes se retan aparte). */
export function wildRosterOf(zoneId: ZoneId): readonly SpeciesDefinition[] {
  return SPECIES_LIST.filter((species) => species.zoneId === zoneId && !species.isBoss);
}
