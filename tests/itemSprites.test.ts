import { describe, expect, it } from 'vitest';
import { UPGRADE_IDS } from '../src/data/items';
import { getSprite } from '../src/render/placeholders';
import { itemSpriteId, registerItemSprites, type ItemSpriteId } from '../src/render/itemSprites';

const CONSUMABLES: readonly ItemSpriteId[] = ['berry', 'potion', 'sack'];
const GLOVES: readonly ItemSpriteId[] = ['glove1', 'glove2', 'glove3', 'glove4', 'glove5'];
const RANCH: readonly ItemSpriteId[] = ['plot', 'upgrade'];

describe('sprites de objeto', () => {
  it('los consumibles se registran como sprites de 16×16', () => {
    registerItemSprites();
    for (const id of CONSUMABLES) {
      const sprite = getSprite(itemSpriteId(id));
      expect(sprite.width, id).toBe(16);
      expect(sprite.height, id).toBe(16);
    }
  });

  it('los guantes y los objetos del Rancho también miden 16×16', () => {
    registerItemSprites();
    for (const id of [...GLOVES, ...RANCH]) {
      const sprite = getSprite(itemSpriteId(id));
      expect(sprite.width, id).toBe(16);
      expect(sprite.height, id).toBe(16);
    }
  });

  it('los cinco guantes comparten silueta y solo cambian de material', () => {
    registerItemSprites();
    // Mismo alto y ancho, y uno por cada mejora de clic del juego.
    expect(GLOVES).toHaveLength(UPGRADE_IDS.length);
  });

  it('registrar dos veces no duplica ni rompe nada', () => {
    registerItemSprites();
    registerItemSprites();
    expect(getSprite(itemSpriteId('potion')).id).toBe('item/potion');
  });

  it('van por un id propio, separado de los iconos del HUD', () => {
    expect(itemSpriteId('berry')).toBe('item/berry');
    expect(itemSpriteId('berry')).not.toBe('icon/berry');
  });
});
