import './styles/base.css';
import './styles/layout.css';

import { LocalSaveRepository } from './persistence/localSaveRepository';
import { createLoop } from './systems/loop';
import { createGame } from './systems/game';
import { element, mustFind } from './ui/dom';
import { mountOfflineSummary } from './ui/offlineSummary';
import { mountRanchPanel } from './ui/ranchPanel';
import { mountBattlePanel } from './ui/battlePanel';
import { mountEncounterPanel } from './ui/encounterPanel';
import { mountSaveMenu } from './ui/saveMenu';
import { mountThemeToggle } from './ui/themeToggle';
import { mountShopPanel } from './ui/shopPanel';
import { mountTopbar } from './ui/topbar';
import { mountZonePanel } from './ui/zonePanel';

/** Semilla inicial del PRNG: lo único que entra del exterior sin determinismo. */
function freshSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? Date.now() >>> 0;
}

const clock = (): number => Date.now();

const repository = new LocalSaveRepository({ now: clock, fallbackSeed: freshSeed });
const game = createGame({ repository, clock, seed: freshSeed });

const topbar = mustFind('topbar');
mountTopbar(topbar, game);
mountSaveMenu(topbar, game);
mountThemeToggle(topbar.querySelector('.save-menu') ?? topbar);
const zoneColumn = mustFind('zone-column');
const zonePanel = mountZonePanel(zoneColumn, game);

/*
 * El lienzo se queda fijo arriba y lo que hay debajo —la salvaje de turno y el
 * combate con su jefe— se desplaza si no cabe. Sin esto, cuando coinciden una
 * aparición y un jefe a tiro, las tarjetas se salen de la columna.
 */
const zoneBody = element('div', { className: 'column-body' });
zoneColumn.append(zoneBody);
const encounterPanel = mountEncounterPanel(zoneBody, game);
const battlePanel = mountBattlePanel(zoneBody, game);
const ranchPanel = mountRanchPanel(mustFind('ranch-column'), game);
mountOfflineSummary(document.body, game);
mountShopPanel(mustFind('shop-column'), game);

const loop = createLoop({
  onTick: () => {
    game.tick();
  },
  onRender: (frameMs) => {
    const now = clock();
    zonePanel.render(frameMs, now);
    ranchPanel.render(frameMs);
    encounterPanel.refresh(now);
    battlePanel.refresh(now);
  },
});

// Guardar al salir o al pasar la pestaña a segundo plano (regla de arquitectura 5).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void game.save();
});
window.addEventListener('pagehide', () => {
  void game.save();
});

void game.load().then(() => {
  loop.start();
});
