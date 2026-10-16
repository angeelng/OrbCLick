import { describe, expect, it } from 'vitest';
import { buyUpgrade } from '../src/core/engine';
import {
  clickBonuses,
  coinsPerClick,
  ownedCount,
  upgradeBundlePrice,
  upgradePrice,
} from '../src/core/economy';
import { availableUpgrades, isUpgradeUnlocked, nextUnlock } from '../src/core/progression';
import { createInitialState, type GameState } from '../src/core/state';
import { BALANCE } from '../src/data/balance';
import { UPGRADES, UPGRADE_LIST, getUpgrade, isUpgradeId } from '../src/data/items';
import { LEVEL_UNLOCKS } from '../src/data/unlocks';

const NOW = 1_000;
const base = createInitialState(NOW, 1);

function withState(overrides: Partial<GameState>): GameState {
  return { ...base, ...overrides };
}

describe('catálogo de mejoras', () => {
  it('los guantes suben de precio y de efecto a la vez', () => {
    let previousPrice = 0;
    let previousBonus = 0;
    for (const upgrade of UPGRADE_LIST) {
      expect(upgrade.basePrice).toBeGreaterThan(previousPrice);
      expect(upgrade.flatBonus).toBeGreaterThan(previousBonus);
      previousPrice = upgrade.basePrice;
      previousBonus = upgrade.flatBonus;
    }
  });

  it('el primer guante cuesta 100 monedas y da +1, como dice el GDD', () => {
    expect(UPGRADES['gloves-1'].basePrice).toBe(100);
    expect(UPGRADES['gloves-1'].flatBonus).toBe(1);
    expect(UPGRADES['gloves-1'].unlockLevel).toBe(1);
  });

  it('isUpgradeId reconoce solo los ids del catálogo', () => {
    expect(isUpgradeId('gloves-1')).toBe(true);
    expect(isUpgradeId('guantes')).toBe(false);
    expect(isUpgradeId(7)).toBe(false);
  });

  it('cada nivel de desbloqueo de la tienda está en la tabla del GDD', () => {
    const levels = new Set(LEVEL_UNLOCKS.map((unlock) => unlock.level));
    for (const upgrade of UPGRADE_LIST) {
      expect(levels.has(upgrade.unlockLevel)).toBe(true);
    }
  });
});

describe('upgradePrice', () => {
  it('la primera unidad vale el precio base', () => {
    expect(upgradePrice(getUpgrade('gloves-1'), 0)).toBe(100);
  });

  it('cada unidad sube un 15 % sobre la anterior', () => {
    const upgrade = getUpgrade('gloves-1');
    expect(upgradePrice(upgrade, 1)).toBe(Math.round(100 * BALANCE.shop.priceGrowth));
    expect(upgradePrice(upgrade, 2)).toBe(Math.round(100 * BALANCE.shop.priceGrowth ** 2));
    expect(upgradePrice(upgrade, 10)).toBe(Math.round(100 * BALANCE.shop.priceGrowth ** 10));
  });

  it('el precio de un lote es la suma de sus unidades', () => {
    const upgrade = getUpgrade('gloves-1');
    const manual = [0, 1, 2].reduce((sum, index) => sum + upgradePrice(upgrade, index), 0);
    expect(upgradeBundlePrice(upgrade, 0, 3)).toBe(manual);
  });

  it('un lote de cero no cuesta nada', () => {
    expect(upgradeBundlePrice(getUpgrade('gloves-1'), 0, 0)).toBe(0);
  });
});

describe('bonus de clic con mejoras', () => {
  it('sin mejoras el clic da el valor base', () => {
    expect(clickBonuses(base).flat).toBe(0);
    expect(coinsPerClick(base)).toBe(BALANCE.click.baseCoins);
  });

  it('cada guante suma su bonus plano por unidad', () => {
    const state = withState({ upgrades: { 'gloves-1': 3 } });
    expect(clickBonuses(state).flat).toBe(3);
    expect(coinsPerClick(state)).toBe(BALANCE.click.baseCoins * (1 + 3));
  });

  it('los bonus de guantes distintos se suman', () => {
    const state = withState({ upgrades: { 'gloves-1': 2, 'gloves-2': 1 } });
    expect(clickBonuses(state).flat).toBe(2 * 1 + 1 * 5);
  });

  it('ownedCount devuelve 0 para lo que no se ha comprado', () => {
    expect(ownedCount(base.upgrades, 'gloves-5')).toBe(0);
  });
});

describe('buyUpgrade', () => {
  it('cobra el precio y apunta la unidad', () => {
    const state = withState({ coins: 500 });
    const result = buyUpgrade(state, 'gloves-1', 1, NOW);
    expect(result.bought).toBe(true);
    expect(result.spent).toBe(100);
    expect(result.state.coins).toBe(400);
    expect(result.state.upgrades['gloves-1']).toBe(1);
  });

  it('la segunda unidad cuesta un 15 % más', () => {
    const first = buyUpgrade(withState({ coins: 500 }), 'gloves-1', 1, NOW);
    const second = buyUpgrade(first.state, 'gloves-1', 1, NOW);
    expect(second.spent).toBe(115);
    expect(second.state.upgrades['gloves-1']).toBe(2);
  });

  it('compra un lote entero por la suma de sus precios', () => {
    const result = buyUpgrade(withState({ coins: 1_000 }), 'gloves-1', 3, NOW);
    expect(result.quantity).toBe(3);
    expect(result.spent).toBe(100 + 115 + 132);
    expect(result.state.upgrades['gloves-1']).toBe(3);
  });

  it('rechaza el lote entero si no llega el dinero', () => {
    const state = withState({ coins: 150 });
    const result = buyUpgrade(state, 'gloves-1', 2, NOW);
    expect(result.bought).toBe(false);
    expect(result.failure).toBe('too-poor');
    expect(result.state).toBe(state);
  });

  it('no se puede comprar una mejora más de diez veces', () => {
    const max = BALANCE.shop.maxUpgradeOwned;
    const lleno = withState({ coins: 1e9, upgrades: { 'gloves-1': max } });

    const result = buyUpgrade(lleno, 'gloves-1', 1, NOW);
    expect(result.bought).toBe(false);
    expect(result.failure).toBe('maxed');
    expect(result.state).toBe(lleno);
  });

  it('un lote que se pasaría del tope no se compra a medias', () => {
    const max = BALANCE.shop.maxUpgradeOwned;
    const casi = withState({ coins: 1e9, upgrades: { 'gloves-1': max - 2 } });

    expect(buyUpgrade(casi, 'gloves-1', 3, NOW).failure).toBe('maxed');
    // Lo que sí cabe se compra entero y deja la mejora al tope.
    const justo = buyUpgrade(casi, 'gloves-1', 2, NOW);
    expect(justo.bought).toBe(true);
    expect(justo.state.upgrades['gloves-1']).toBe(max);
  });

  it('una partida vieja con más del tope no puede seguir comprando', () => {
    const vieja = withState({ coins: 1e9, upgrades: { 'gloves-1': 34 } });
    expect(buyUpgrade(vieja, 'gloves-1', 1, NOW).failure).toBe('maxed');
    // Pero no se le quita nada de lo que ya tenía.
    expect(vieja.upgrades['gloves-1']).toBe(34);
  });

  it('no deja comprar una mejora bloqueada por nivel', () => {
    const result = buyUpgrade(withState({ coins: 1e9 }), 'gloves-5', 1, NOW);
    expect(result.failure).toBe('locked');
    expect(result.state.coins).toBe(1e9);
  });

  it('rechaza cantidades que no son enteros positivos', () => {
    const state = withState({ coins: 1e6 });
    expect(buyUpgrade(state, 'gloves-1', 0, NOW).failure).toBe('invalid-amount');
    expect(buyUpgrade(state, 'gloves-1', -2, NOW).failure).toBe('invalid-amount');
    expect(buyUpgrade(state, 'gloves-1', 1.5, NOW).failure).toBe('invalid-amount');
  });

  it('no muta el estado anterior', () => {
    const state = withState({ coins: 500 });
    const snapshot = structuredClone(state);
    buyUpgrade(state, 'gloves-1', 1, NOW);
    expect(state).toEqual(snapshot);
  });

  it('la mejora comprada se nota en el siguiente clic', () => {
    const bought = buyUpgrade(withState({ coins: 100 }), 'gloves-1', 1, NOW).state;
    expect(coinsPerClick(bought)).toBe(coinsPerClick(base) * 2);
  });
});

describe('desbloqueos por nivel', () => {
  it('al nivel 1 solo están los primeros guantes', () => {
    expect(availableUpgrades(base).map((upgrade) => upgrade.id)).toEqual(['gloves-1']);
  });

  it('al nivel 7 entran los segundos', () => {
    const state = withState({ trainer: { level: 7, xp: 0 } });
    expect(availableUpgrades(state).map((upgrade) => upgrade.id)).toEqual(['gloves-1', 'gloves-2']);
  });

  it('al nivel máximo está todo el catálogo', () => {
    const state = withState({ trainer: { level: BALANCE.trainer.maxLevel, xp: 0 } });
    expect(availableUpgrades(state)).toHaveLength(UPGRADE_LIST.length);
    expect(isUpgradeUnlocked(state, getUpgrade('gloves-5'))).toBe(true);
  });

  it('anuncia el siguiente desbloqueo y se queda sin nada al final', () => {
    expect(nextUnlock(base)?.level).toBe(2);
    expect(nextUnlock(withState({ trainer: { level: 12, xp: 0 } }))?.level).toBe(15);
    expect(nextUnlock(withState({ trainer: { level: 15, xp: 0 } }))).toBeNull();
  });

  it('la tabla de niveles va en orden y sin repetidos', () => {
    const levels = LEVEL_UNLOCKS.map((unlock) => unlock.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(levels.length);
  });
});
