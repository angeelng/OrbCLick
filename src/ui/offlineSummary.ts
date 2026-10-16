import { format } from '../core/economy';
import { BALANCE } from '../data/balance';
import { ES } from '../i18n/es';
import type { Game } from '../systems/game';
import { element } from './dom';
import { formatDuration } from './format';

/**
 * Resumen de lo que produjo el Rancho mientras la pestaña estaba cerrada
 * (GDD · Progreso offline). Se enseña una vez, al cargar la partida.
 */
export function mountOfflineSummary(host: HTMLElement, game: Game): void {
  const dialog = element('dialog', { className: 'dialog' });
  host.append(dialog);

  game.events.on('game:loaded', ({ offline }) => {
    if (offline === null) return;

    const rows: [string, string][] = [];
    if (offline.coins > 0) rows.push([ES.offline.coins, format(offline.coins)]);
    if (offline.berries > 0) rows.push([ES.offline.berries, format(offline.berries)]);
    if (offline.orbs > 0) rows.push([ES.offline.orbs, format(offline.orbs)]);
    if (offline.creatureXp > 0) rows.push([ES.offline.xp, format(offline.creatureXp)]);
    if (offline.berriesEaten > 0) rows.push([ES.offline.eaten, format(offline.berriesEaten)]);

    const facts = element('dl', { className: 'sheet-facts' });
    for (const [label, value] of rows) {
      const row = element('div');
      row.append(element('dt', { text: label }), element('dd', { text: value }));
      facts.append(row);
    }

    const close = element('button', {
      className: 'button button--accent',
      text: ES.offline.close,
      attrs: { type: 'button' },
    });
    close.addEventListener('click', () => {
      dialog.close();
    });
    const actions = element('div', { className: 'dialog-actions' });
    actions.append(close);

    dialog.replaceChildren(
      element('h2', { className: 'dialog-title', text: ES.offline.title }),
      element('p', {
        className: 'dialog-hint',
        text: ES.offline.away(formatDuration(offline.elapsedMs)),
      }),
      ...(offline.elapsedMs > BALANCE.ranch.offline.maxMs
        ? [element('p', { className: 'dialog-hint', text: ES.offline.capped })]
        : []),
      rows.length === 0
        ? element('p', { className: 'column-hint', text: ES.offline.nothing })
        : facts,
      actions,
    );
    dialog.showModal();
  });
}
