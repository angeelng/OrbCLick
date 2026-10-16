import { creatureStats, isExhausted, teamCreatures, teamSlots } from '../core/combat';
import { format } from '../core/economy';
import { bossProgress, bossBlock, isBossDefeated } from '../core/progression';
import type { BattleState, GameState } from '../core/state';
import { bossZoneOf, getBoss } from '../data/bosses';
import { ABILITY_KIND_NAMES } from '../data/combat';
import { getSpecies } from '../data/species';
import { getZone, type ZoneId } from '../data/zones';
import { ES } from '../i18n/es';
import { creatureSpriteId } from '../render/creatureSprites';
import type { Game } from '../systems/game';
import { element, setStyle, setText } from './dom';
import { formatCountdown } from './format';
import { spriteCanvas } from './spriteCanvas';

export interface BattlePanel {
  /** Repinta barras y cargas; lo llama el bucle de render. */
  refresh(now: number): void;
}

interface BattlerRow {
  readonly root: HTMLElement;
  readonly hp: HTMLElement;
  readonly hpFill: HTMLElement;
  readonly chargeFill: HTMLElement;
  readonly ability: HTMLButtonElement;
  readonly berry: HTMLButtonElement;
}

/**
 * Panel de combate: el enemigo arriba con su barra y, debajo, el equipo con
 * sus PV, su carga de habilidad y la baya. Solo aparece mientras hay pelea;
 * el resto del tiempo deja un botón para retar a la salvaje.
 */
export function mountBattlePanel(host: HTMLElement, game: Game): BattlePanel {
  const root = element('div', { className: 'battle' });
  host.append(root);

  // --- antes del combate ----------------------------------------------------
  const challenge = element('button', {
    className: 'button button--accent battle-challenge',
    text: ES.battle.challenge,
    attrs: { type: 'button' },
  });
  challenge.addEventListener('click', () => {
    game.startBattle();
  });
  const challengeNote = element('p', { className: 'column-hint' });

  /*
   * Tarjeta del jefe de la zona activa: su retrato, su mecánica y el botón de
   * retarlo. El jefe no aparece como salvaje, así que esta tarjeta es la
   * única puerta al combate contra él (GDD · Jefes de zona).
   */
  const bossCard = element('article', { className: 'boss-card' });
  const bossPortrait = element('div', { className: 'boss-portrait' });
  const bossName = element('strong', { className: 'boss-name' });
  const bossBadge = element('span', { className: 'chip chip--done', text: ES.boss.defeated });
  const bossHead = element('div', { className: 'boss-head' });
  const bossTitles = element('div', { className: 'boss-titles' });
  const bossMechanic = element('span', { className: 'boss-mechanic' });
  bossTitles.append(bossName, bossMechanic);
  bossHead.append(bossPortrait, bossTitles, bossBadge);

  const bossHint = element('p', { className: 'column-hint' });
  const bossButton = element('button', {
    className: 'button button--accent boss-challenge',
    attrs: { type: 'button' },
  });
  bossButton.addEventListener('click', () => {
    game.challengeBoss(game.getState().activeZoneId);
  });
  bossCard.append(
    element('h3', { className: 'boss-title', text: ES.boss.title }),
    bossHead,
    bossHint,
    bossButton,
  );

  /** Retrato del jefe: se repinta solo al cambiar de zona. */
  let portraitZoneId: ZoneId | null = null;

  // --- durante el combate ---------------------------------------------------
  const enemyBox = element('div', { className: 'battle-enemy' });
  const enemyName = element('h3', { className: 'battle-enemy-name' });
  const enemyBar = element('div', { className: 'track' });
  const enemyFill = element('i');
  enemyBar.append(enemyFill);
  const enemyHp = element('span', { className: 'battle-hp' });
  const enemyNote = element('span', { className: 'battle-enemy-note' });
  const enemySide = element('div', { className: 'battle-enemy-side' });
  enemySide.append(enemyName, enemyBar, enemyHp, enemyNote);

  const teamBox = element('div', { className: 'battle-team' });
  const message = element('p', { className: 'battle-message' });
  const flee = element('button', {
    className: 'button button--small',
    text: ES.battle.flee,
    attrs: { type: 'button' },
  });
  flee.addEventListener('click', () => {
    game.fleeBattle();
  });

  const rows = new Map<number, BattlerRow>();
  let renderedBattle = '';
  // El agotamiento caduca con el reloj real, así que el bucle de render refresca
  // esta marca cada fotograma: `render` no recibe el tiempo desde los eventos.
  let clockNow = game.getState().lastSeenAt;

  const buildRow = (uid: number, speciesId: Parameters<typeof getSpecies>[0]): BattlerRow => {
    const species = getSpecies(speciesId);
    const row = element('article', { className: 'battler' });

    const head = element('div', { className: 'battler-head' });
    head.append(
      spriteCanvas(creatureSpriteId(species, false), 2),
      element('strong', { className: 'battler-name', text: species.name }),
    );

    const hpBar = element('div', { className: 'track' });
    const hpFill = element('i');
    hpBar.append(hpFill);
    const hp = element('span', { className: 'battle-hp' });

    const chargeBar = element('div', { className: 'track track--charge' });
    const chargeFill = element('i');
    chargeBar.append(chargeFill);

    const ability = element('button', {
      className: 'button button--small battler-ability',
      text: species.ability.name,
      attrs: {
        type: 'button',
        title: `${ES.battle.ability(species.ability.name)} · ${ABILITY_KIND_NAMES[species.ability.kind]}`,
      },
    });
    ability.addEventListener('click', () => {
      game.useAbility(uid);
    });

    const berry = element('button', {
      className: 'button button--small',
      text: ES.battle.berry,
      attrs: { type: 'button' },
    });
    berry.addEventListener('click', () => {
      game.useBerry(uid);
    });

    const actions = element('div', { className: 'battler-actions' });
    actions.append(ability, berry);

    row.append(head, hpBar, hp, chargeBar, actions);
    return { root: row, hp, hpFill, chargeFill, ability, berry };
  };

  const renderBattle = (battle: BattleState, state: GameState): void => {
    const enemy = getSpecies(battle.enemySpeciesId);
    setText(enemyName, enemy.name);

    /*
     * El escudo de piedra manda sobre el resto del aviso: mientras esté en
     * pie, lo único que se puede hacer es clicar al jefe para romperlo.
     */
    const shielded = battle.enemyShieldHits > 0;
    enemyNote.hidden = battle.kind !== 'boss';
    enemyNote.classList.toggle('battle-enemy-note--alert', shielded);
    const bossZoneId = bossZoneOf(battle.enemySpeciesId);
    if (battle.kind === 'boss' && bossZoneId !== null) {
      setText(
        enemyNote,
        shielded
          ? `${ES.boss.shielded} (${battle.enemyShieldHits})`
          : getBoss(bossZoneId).mechanicName,
      );
    }
    setStyle(enemyFill, 'width', `${Math.round((battle.enemyHp / battle.enemyMaxHp) * 100)}%`);
    setText(enemyHp, `${format(battle.enemyHp)} / ${format(battle.enemyMaxHp)} PV`);

    const signature = battle.team.map((battler) => battler.uid).join(',');
    if (signature !== renderedBattle) {
      renderedBattle = signature;
      rows.clear();
      teamBox.replaceChildren();
      for (const battler of battle.team) {
        const row = buildRow(battler.uid, battler.speciesId);
        rows.set(battler.uid, row);
        teamBox.append(row.root);
      }
    }

    for (const battler of battle.team) {
      const row = rows.get(battler.uid);
      if (row === undefined) continue;
      const fainted = battler.hp <= 0;
      row.root.classList.toggle('battler--fainted', fainted);
      setStyle(row.hpFill, 'width', `${Math.round((battler.hp / battler.maxHp) * 100)}%`);
      setText(
        row.hp,
        fainted ? ES.battle.fainted : `${format(battler.hp)} / ${format(battler.maxHp)} PV`,
      );
      setStyle(row.chargeFill, 'width', `${Math.round(battler.charge * 100)}%`);
      // Con el escudo en pie las habilidades no entran: se guardan.
      row.ability.disabled = fainted || battler.charge < 1 || battle.enemyShieldHits > 0;
      row.berry.disabled =
        fainted || state.berries < 1 || battle.berriesUsed >= 3 || battler.hp >= battler.maxHp;
    }
  };

  /**
   * Motivo por el que ahora no se puede retar, o `null` si se puede. Repite las
   * mismas condiciones que `startBattle` para que el botón nunca esté activo
   * cuando el clic no haría nada.
   */
  const challengeBlock = (state: GameState, now: number): string | null => {
    if (teamSlots(state) === 0) return ES.team.locked;
    const team = teamCreatures(state);
    if (team.length === 0) return ES.battle.noTeam;
    if (team.every((creature) => isExhausted(creature, now))) return ES.battle.allExhausted;
    if (state.encounter === null) return ES.battle.noWild;
    if (state.encounter.hp <= 0) return ES.battle.alreadyWeak;
    return null;
  };

  /**
   * Por qué no se puede retar al jefe ahora mismo, o `null` si sí. Repite las
   * condiciones de `startBossBattle` para que el botón no mienta: las del
   * jefe (zona, nivel, enfriamiento) y las del equipo.
   */
  const bossChallengeBlock = (state: GameState, now: number): string | null => {
    const zoneId = state.activeZoneId;
    const blocked = bossBlock(state, zoneId, now);
    if (blocked === 'zone-locked') return ES.boss.zoneLocked;
    if (blocked === 'level') return ES.boss.needsLevel(getZone(zoneId).bossLevel);
    if (blocked === 'cooldown') {
      const left = bossProgress(state, zoneId).availableAt - now;
      return ES.boss.cooldown(formatCountdown(left));
    }

    if (teamSlots(state) === 0) return ES.team.locked;
    const team = teamCreatures(state);
    if (team.length === 0) return ES.battle.noTeam;
    if (team.every((creature) => isExhausted(creature, now))) return ES.battle.allExhausted;
    return null;
  };

  const updateBossCard = (state: GameState, now: number): void => {
    const zoneId = state.activeZoneId;
    const boss = getBoss(zoneId);
    const species = getSpecies(boss.speciesId);

    if (portraitZoneId !== zoneId) {
      portraitZoneId = zoneId;
      bossPortrait.replaceChildren(spriteCanvas(creatureSpriteId(species, false), 2));
    }

    setText(bossName, species.name);
    setText(bossMechanic, boss.mechanicName);
    setText(bossButton, ES.boss.challenge(species.name));

    const blocked = bossChallengeBlock(state, now);
    bossButton.disabled = blocked !== null;
    setText(bossHint, blocked ?? boss.mechanicHint);
    bossBadge.hidden = !isBossDefeated(state, zoneId);
  };

  const updateChallenge = (state: GameState, now: number): void => {
    const blocked = challengeBlock(state, now);
    challenge.disabled = blocked !== null;
    setText(challengeNote, blocked ?? ES.team.slots(teamCreatures(state).length, teamSlots(state)));
  };

  const render = (state: GameState): void => {
    const { battle } = state;
    root.classList.toggle('battle--fighting', battle !== null);

    if (battle === null) {
      renderedBattle = '';
      updateChallenge(state, clockNow);
      updateBossCard(state, clockNow);
      root.replaceChildren(challenge, challengeNote, bossCard, message);
      return;
    }

    root.replaceChildren(enemyBox, teamBox, flee, message);
    if (!enemyBox.contains(enemySide)) {
      enemyBox.replaceChildren(
        spriteCanvas(creatureSpriteId(getSpecies(battle.enemySpeciesId), battle.enemyShiny), 3),
        enemySide,
      );
    }
    renderBattle(battle, state);
  };

  game.events.on('battle:started', ({ state }) => {
    setText(message, ES.battle.hint);
    message.className = 'battle-message';
    // El enemigo cambia de especie entre combates: se repinta su retrato.
    enemyBox.replaceChildren();
    render(state);
  });

  game.events.on('battle:ended', ({ state, outcome, coins, xp }) => {
    setText(
      message,
      outcome === 'won'
        ? `${ES.battle.won(format(coins), format(xp))} ${ES.battle.weakened}`
        : outcome === 'lost'
          ? `${ES.battle.lost} ${ES.battle.exhausted}`
          : ES.battle.timeout,
    );
    message.className = `battle-message battle-message--${outcome === 'won' ? 'good' : 'bad'}`;
    render(state);
  });

  game.events.on('state:changed', ({ state }) => {
    render(state);
  });

  render(game.getState());

  return {
    refresh(now) {
      clockNow = now;
      const state = game.getState();
      if (state.battle !== null) renderBattle(state.battle, state);
      else {
        // El enfriamiento del jefe baja con el reloj: se repinta por fotograma.
        updateChallenge(state, now);
        updateBossCard(state, now);
      }
    },
  };
}

/** Estadísticas en texto para la ficha de criatura. */
export function statsLine(creature: Parameters<typeof creatureStats>[0]): string {
  const stats = creatureStats(creature);
  return `${stats.hp} PV · ${stats.atk} ATQ · ${stats.def} DEF · ${stats.spd} VEL`;
}
