import { describe, expect, it } from 'vitest';
import { BOSSES, BOSS_LIST, bossZoneOf, getBoss } from '../src/data/bosses';
import { getSpecies, wildRosterOf } from '../src/data/species';
import {
  STARTING_ZONE_ID,
  ZONE_IDS,
  ZONE_LIST,
  ZONE_ORDER,
  getZone,
  isZoneId,
  zoneUnlockedByBossOf,
} from '../src/data/zones';
import { getSprite } from '../src/render/placeholders';

describe('datos de zona', () => {
  it('las tres zonas del GDD son jugables y están en orden', () => {
    expect([...ZONE_IDS]).toEqual(['meadow', 'cave', 'lake']);
    expect(ZONE_LIST.map((zone) => ZONE_ORDER[zone.id])).toEqual([0, 1, 2]);
    expect(STARTING_ZONE_ID).toBe('meadow');
  });

  it('cada zona tiene su objeto clicable de 64×64 registrado', () => {
    for (const zone of ZONE_LIST) {
      const sprite = getSprite(zone.clickableSpriteId);
      expect(sprite.width, zone.id).toBe(64);
      expect(sprite.height, zone.id).toBe(64);
    }
  });

  it('la cadena de desbloqueos encadena las zonas de una en una', () => {
    expect(getZone('meadow').requiresBossOf).toBeNull();
    expect(getZone('cave').requiresBossOf).toBe('meadow');
    expect(getZone('lake').requiresBossOf).toBe('cave');
    // Niveles de la tabla de progresión del GDD.
    expect(ZONE_LIST.map((zone) => zone.unlockLevel)).toEqual([1, 5, 10]);
    expect(ZONE_LIST.map((zone) => zone.bossLevel)).toEqual([5, 10, 15]);
  });

  it('vencer a un jefe abre exactamente la zona siguiente', () => {
    expect(zoneUnlockedByBossOf('meadow')?.id).toBe('cave');
    expect(zoneUnlockedByBossOf('cave')?.id).toBe('lake');
    expect(zoneUnlockedByBossOf('lake')).toBeNull();
  });

  it('cada zona favorece un tipo distinto y tiene salvajes propias', () => {
    const favored = ZONE_LIST.map((zone) => zone.favoredType);
    expect(new Set(favored).size).toBe(favored.length);
    for (const zone of ZONE_LIST) {
      expect(wildRosterOf(zone.id).length, zone.id).toBeGreaterThan(0);
      // Las salvajes de la zona nunca incluyen a su jefe.
      expect(wildRosterOf(zone.id).some((species) => species.isBoss)).toBe(false);
    }
  });

  it('isZoneId solo acepta las zonas conocidas', () => {
    expect(isZoneId('cave')).toBe(true);
    expect(isZoneId('mountain')).toBe(false);
    expect(isZoneId(3)).toBe(false);
  });
});

describe('datos de jefe', () => {
  it('hay un jefe legendario por zona, y vive en ella', () => {
    expect(BOSS_LIST).toHaveLength(ZONE_IDS.length);
    for (const zoneId of ZONE_IDS) {
      const boss = getBoss(zoneId);
      const species = getSpecies(boss.speciesId);
      expect(species.isBoss, boss.speciesId).toBe(true);
      expect(species.rarity, boss.speciesId).toBe('legendary');
      expect(species.zoneId, boss.speciesId).toBe(zoneId);
      expect(getZone(zoneId).bossSpeciesId).toBe(boss.speciesId);
    }
  });

  it('cada jefe tiene su propia mecánica', () => {
    const mechanics = BOSS_LIST.map((boss) => boss.mechanic);
    expect(new Set(mechanics).size).toBe(mechanics.length);
    expect(BOSSES.meadow.mechanic).toBe('regrowth');
    expect(BOSSES.cave.mechanic).toBe('stoneShield');
    expect(BOSSES.lake.mechanic).toBe('tideWave');
  });

  it('bossZoneOf reconoce a los jefes y descarta al resto', () => {
    expect(bossZoneOf('geodron')).toBe('cave');
    expect(bossZoneOf('brotillo')).toBeNull();
  });
});
