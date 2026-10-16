import { ES } from '../i18n/es';
import { SaveParseError } from '../persistence/parse';
import type { Game } from '../systems/game';
import { element, setText } from './dom';

/**
 * Exportar e importar la partida como texto. Vive en la barra superior y usa
 * un `<dialog>` nativo: nada de modales a mano.
 */
export function mountSaveMenu(host: HTMLElement, game: Game): void {
  const dialog = element('dialog', { className: 'dialog' });
  const dialogTitle = element('h2', { className: 'dialog-title' });
  const hint = element('p', { className: 'dialog-hint' });
  const field = element('textarea', {
    className: 'dialog-field',
    attrs: { rows: '5', spellcheck: 'false', 'aria-label': ES.save.menu },
  });
  const status = element('p', { className: 'dialog-status' });
  const actions = element('div', { className: 'dialog-actions' });
  const primary = element('button', {
    className: 'button button--accent',
    attrs: { type: 'button' },
  });
  const close = element('button', {
    className: 'button',
    text: ES.save.close,
    attrs: { type: 'button' },
  });

  close.addEventListener('click', () => {
    dialog.close();
  });
  actions.append(primary, close);
  dialog.append(dialogTitle, hint, field, status, actions);

  const openExport = (): void => {
    setText(dialogTitle, ES.save.exportTitle);
    setText(hint, ES.save.exportHint);
    setText(status, '');
    field.value = game.exportSave();
    field.readOnly = true;
    setText(primary, ES.save.copy);
    primary.onclick = () => {
      field.select();
      void navigator.clipboard
        .writeText(field.value)
        .then(() => {
          setText(status, ES.save.copied);
        })
        .catch(() => {
          // Sin permiso de portapapeles: el texto ya queda seleccionado.
          setText(status, '');
        });
    };
    dialog.showModal();
  };

  const openImport = (): void => {
    setText(dialogTitle, ES.save.importTitle);
    setText(hint, ES.save.importHint);
    setText(status, '');
    field.value = '';
    field.readOnly = false;
    setText(primary, ES.save.importAction);
    primary.onclick = () => {
      void game
        .importSave(field.value)
        .then(() => {
          setText(status, ES.save.imported);
        })
        .catch((error: unknown) => {
          const reason =
            error instanceof SaveParseError || error instanceof Error
              ? error.message
              : 'código ilegible';
          setText(status, ES.save.invalid + reason);
        });
    };
    dialog.showModal();
  };

  const exportButton = element('button', {
    className: 'button button--small',
    text: ES.save.export,
    attrs: { type: 'button' },
  });
  const importButton = element('button', {
    className: 'button button--small',
    text: ES.save.import,
    attrs: { type: 'button' },
  });
  exportButton.addEventListener('click', openExport);
  importButton.addEventListener('click', openImport);

  const group = element('div', { className: 'save-menu' });
  group.append(exportButton, importButton);
  host.append(group, dialog);
}
