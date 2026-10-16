import { captureChance, orbCount, requiresBattle } from '../core/capture';
import { clickDamage, format } from '../core/economy';
import type { GameState } from '../core/state';
import { ORB_LIST } from '../data/orbs';
import { getSpecies, RARITY_NAMES } from '../data/species';
import { ES } from '../i18n/es';
import { TYPE_NAMES } from '../i18n/names';
import { orbSpriteId, registerOrbSprites } from '../render/orbSprites';
import { spriteCanvas } from './spriteCanvas';
import type { Game } from '../systems/game';
import { element, setText } from './dom';

export interface EncounterPanel {
  /** Repinta el reloj de huida; lo llama el bucle de render. */
  refresh(now: number): void;
}

/**
 * Controles de la aparición: quién es, cuánta vida le queda, cuánto tarda en
 * huir y con qué orbe intentarlo. El dibujo de la criatura lo hace el canvas;
 * aquí solo va lo que se lee y se pulsa.
 */
export function mountEncounterPanel(host: HTMLElement, game: Game): EncounterPanel {
  const root = element('div', { className: 'encounter' });

  const headline = element('p', { className: 'encounter-headline' });
  const title = element('h3', { className: 'encounter-name' });
  const tags = element('div', { className: 'encounter-tags' });
  const hp = element('span', { className: 'encounter-hp' });
  const flees = element('span', { className: 'encounter-flees' });
  const orbs = element('div', { className: 'encounter-orbs' });
  // Lo que ocurre se anuncia en el cartel de la zona, no aquí abajo.
  const hint = element('p', { className: 'encounter-hint' });

  root.append(headline, title, tags, hp, flees, orbs, hint);
  host.append(root);

  registerOrbSprites();

  // Cada orbe es su propio dibujo, con el nombre encima y el estado debajo.
  const orbButtons = ORB_LIST.map((orb) => {
    const button = element('button', {
      className: 'orb-button',
      attrs: { type: 'button', title: orb.description },
    });
    const detail = element('span', { className: 'orb-detail' });
    button.append(
      element('span', { className: 'orb-name', text: orb.name }),
      spriteCanvas(orbSpriteId(orb.id), 3),
      detail,
    );
    button.addEventListener('click', () => {
      game.throwOrb(orb.id);
    });
    orbs.append(button);
    return { orb, button, detail };
  });

  const renderOrbs = (state: GameState): void => {
    for (const { orb, button, detail } of orbButtons) {
      const held = orbCount(state, orb.id);
      const unlocked = state.trainer.level >= orb.unlockLevel;
      button.hidden = !unlocked;
      if (!unlocked) continue;

      const chance =
        state.encounter === null ? null : Math.round(captureChance(state.encounter, orb.id) * 100);
      setText(
        detail,
        held === 0
          ? ES.encounter.noOrbs
          : `×${held}${chance === null ? '' : ` · ${ES.encounter.chance(String(chance))}`}`,
      );
      button.disabled = held === 0 || state.encounter === null;
    }
  };

  const render = (state: GameState, now: number): void => {
    const { encounter } = state;
    root.classList.toggle('encounter--empty', encounter === null);

    if (encounter === null) {
      root.classList.remove('encounter--critical');
      setText(headline, ES.encounter.none);
      const waitMs = Math.max(0, state.nextSpawnAt - now);
      setText(title, '');
      setText(hp, ES.encounter.waiting(Math.ceil(waitMs / 1000)));
      setText(flees, '');
      setText(hint, '');
      tags.replaceChildren();
      renderOrbs(state);
      return;
    }

    const species = getSpecies(encounter.speciesId);
    setText(headline, species.isBoss ? ES.encounter.bossTitle : ES.encounter.title);
    setText(title, species.name);
    setText(hp, ES.encounter.hp(format(encounter.hp), format(encounter.maxHp)));
    setText(flees, ES.encounter.flees(Math.max(0, Math.ceil((encounter.fleesAt - now) / 1000))));
    // A un golpe de caer, conviene recordar que rematarla la pierde.
    root.classList.toggle('encounter--critical', encounter.hp <= clickDamage(state));

    const chips = [
      element('span', { className: `chip chip--${species.type}`, text: TYPE_NAMES[species.type] }),
      element('span', { className: 'chip', text: RARITY_NAMES[species.rarity] }),
    ];
    if (encounter.shiny) {
      chips.push(element('span', { className: 'chip chip--shiny', text: ES.encounter.shiny }));
    }
    tags.replaceChildren(...chips);

    /*
     * Qué toca hacer ahora: quien ya cayó solo espera el orbe, quien exige
     * combate no se deja clicar y el resto se debilita a golpes.
     */
    setText(
      hint,
      encounter.hp <= 0
        ? ES.encounter.readyForOrb(species.name)
        : requiresBattle(encounter)
          ? ES.battle.needsBattle(species.name)
          : ES.encounter.weaken,
    );
    renderOrbs(state);
  };

  return {
    refresh(now) {
      render(game.getState(), now);
    },
  };
}
