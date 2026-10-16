import { orbCount } from '../core/capture';
import { coinsPerClick, format } from '../core/economy';
import { ranchProduction } from '../core/ranch';
import { isMaxLevel, levelProgress, nextUnlock, xpForNextLevel } from '../core/progression';
import type { GameState } from '../core/state';
import { ORB_IDS } from '../data/orbs';
import { ES } from '../i18n/es';
import { iconSpriteId, registerIconSprites } from '../render/iconSprites';
import type { Game } from '../systems/game';
import { element, setStyle, setText } from './dom';
import { spriteCanvas } from './spriteCanvas';

/**
 * HUD de recursos: icono pixelado, cifra y etiqueta, con el nivel y su barra
 * de XP a la derecha. Se suscribe al estado y reescribe solo los valores que
 * cambian: nada de reconstruir el DOM en cada tick.
 */
export function mountTopbar(host: HTMLElement, game: Game): void {
  registerIconSprites();

  const resource = (
    icon: Parameters<typeof iconSpriteId>[0],
    label: string,
    modifier: string,
  ): { root: HTMLElement; value: HTMLElement } => {
    const root = element('div', { className: `stat ${modifier}` });
    const iconBox = element('span', { className: 'stat-icon' });
    iconBox.append(spriteCanvas(iconSpriteId(icon), 2));

    const value = element('strong', { className: 'stat-value', text: '0' });
    const text = element('div', { className: 'stat-text' });
    text.append(value, element('small', { className: 'stat-label', text: label }));

    root.append(iconBox, text);
    return { root, value };
  };

  const coins = resource('coin', ES.topbar.coins, 'stat--coins');
  const orbs = resource('orb', ES.topbar.orbs, 'stat--orbs');
  const berries = resource('berry', ES.topbar.berries, 'stat--berries');
  const perClick = resource('click', ES.topbar.perClick, 'stat--click');
  const cps = resource('cps', ES.topbar.cps, 'stat--cps');

  const levelRoot = element('div', { className: 'stat stat--level' });
  const levelRow = element('div', { className: 'level-row' });
  const levelValue = element('strong', { text: 'Nivel 1' });
  const xpText = element('span');
  levelRow.append(levelValue, xpText);

  const track = element('div', { className: 'track' });
  const xpFill = element('i');
  track.append(xpFill);
  levelRoot.append(levelRow, track);

  const separator = (): HTMLElement =>
    element('div', { className: 'topbar-separator', attrs: { 'aria-hidden': 'true' } });

  const stats = element('div', { className: 'topbar-stats' });
  stats.append(
    coins.root,
    orbs.root,
    berries.root,
    separator(),
    perClick.root,
    cps.root,
    separator(),
    levelRoot,
  );

  const brand = element('div', { className: 'topbar-brand' });
  const mark = element('span', { className: 'topbar-mark', attrs: { 'aria-hidden': 'true' } });
  mark.append(spriteCanvas(iconSpriteId('orb'), 2));
  brand.append(mark, element('span', { text: ES.game.title }));

  const unlockHint = element('span', { className: 'topbar-hint' });
  const saveState = element('span', { className: 'save-state' });
  const aside = element('div', { className: 'topbar-aside' });
  aside.append(unlockHint, saveState);

  host.replaceChildren(brand, stats, aside);

  const timeFormat = new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' });

  const render = (state: GameState): void => {
    setText(coins.value, format(state.coins));
    setText(orbs.value, format(ORB_IDS.reduce((total, id) => total + orbCount(state, id), 0)));
    setText(berries.value, format(state.berries));
    setText(perClick.value, format(coinsPerClick(state)));
    setText(cps.value, format(ranchProduction(state).cps));

    setText(levelValue, `${ES.topbar.level} ${state.trainer.level}`);
    setStyle(xpFill, 'width', `${Math.round(levelProgress(state.trainer) * 100)}%`);
    setText(
      xpText,
      isMaxLevel(state.trainer)
        ? ES.topbar.maxLevel
        : ES.topbar.xpProgress(
            format(state.trainer.xp),
            format(xpForNextLevel(state.trainer.level)),
          ),
    );

    const upcoming = nextUnlock(state);
    setText(
      unlockHint,
      upcoming === null ? '' : ES.topbar.nextUnlock(upcoming.level, upcoming.description),
    );
  };

  game.events.on('state:changed', ({ state }) => {
    render(state);
  });
  game.events.on('game:saved', ({ at }) => {
    setText(saveState, ES.topbar.savedAt(timeFormat.format(new Date(at))));
  });

  render(game.getState());
}
