import type { Rng } from '../core/rng';
import type { WildEncounter } from '../core/state';
import { BALANCE } from '../data/balance';
import type { OrbId } from '../data/orbs';
import { getSpecies } from '../data/species';
import type { ZoneDefinition } from '../data/zones';
import { creatureSpriteId } from './creatureSprites';
import { orbSpriteId, registerOrbSprites } from './orbSprites';
import { createParticleField } from './particles';
import type { PixelCanvas } from './pixel';
import { drawSprite, getSprite, spriteBounds } from './placeholders';

/** Composición de referencia de la zona (GDD · Pixel art y escalado). */
export const ZONE_CANVAS = { width: 160, height: 160 } as const;

/**
 * Lo que de verdad enmarca la cámara. Es más pequeño que la composición de
 * referencia a propósito: el escalado es entero, así que encuadrar menos
 * píxeles lógicos sube un escalón la ampliación y el árbol y las criaturas se
 * ven más cerca. La escena sigue dibujándose sobre el tamaño lógico real, que
 * es el que llena la caja.
 */
export const ZONE_CAMERA = { width: 112, height: 112 } as const;

/** Altura del suelo dentro de la composición de referencia. */
const GROUND_RATIO = 112 / ZONE_CANVAS.height;
const SWAY_MS = 420;
const PARTICLE_COLORS = ['#d9a33f', '#f7dc9a', '#fffdf7', '#7fb06c'] as const;
const CAPTURE_COLORS = ['#fffdf7', '#d9a33f', '#8777e5'] as const;
const ESCAPE_COLORS = ['#e06a7c', '#fffdf7'] as const;

export interface ZoneScene {
  /** Avanza animaciones y repinta. Lo llama el bucle en cada fotograma. */
  render(frameMs: number): void;
  /** La salvaje que hay que pintar ahora mismo, o `null` si no hay ninguna. */
  setEncounter(encounter: WildEncounter | null, now: number): void;
  /** Cambia la zona que se pinta sin tirar el canvas. */
  setZone(zone: ZoneDefinition): void;
  /** ¿El punto lógico (x, y) cae sobre el objeto clicable? */
  hitTest(x: number, y: number): boolean;
  /** ¿El punto lógico cae sobre la salvaje? */
  hitTestWild(x: number, y: number): boolean;
  /** Centro de la salvaje, para colocar el feedback encima. */
  readonly wildCenter: { readonly x: number; readonly y: number } | null;
  /** Centro del objeto clicable, para el feedback cuando se clica con teclado. */
  readonly center: { readonly x: number; readonly y: number };
  /** Reacción al clic: aplastado + chispas. */
  punch(x: number, y: number): void;
  /** Lanza la animación del orbe sobre la salvaje que hay en escena. */
  playOrbThrow(orbId: OrbId, captured: boolean, fled: boolean): void;
  dispose(): void;
}

interface Layout {
  readonly groundY: number;
  readonly objectX: number;
  readonly objectY: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly hills: readonly { x: number; width: number; height: number }[];
  readonly clouds: readonly { x: number; y: number; width: number }[];
  readonly tufts: readonly { x: number; y: number; width: number }[];
}

/** Tramos de la animación de captura, en el orden en que ocurren. */
interface OrbAnimation {
  readonly encounter: WildEncounter;
  readonly orbId: OrbId;
  readonly captured: boolean;
  readonly fled: boolean;
  elapsed: number;
  /** Para no repetir el estallido en cada fotograma del tramo final. */
  burst: boolean;
}

interface WildBox {
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  /** Primera fila pintada del sprite: las barras se cuelgan de ahí. */
  readonly top: number;
}

const { orbFlightMs, orbAbsorbMs, orbShakeMs, orbResultMs } = BALANCE.feedback;
const ORB_TOTAL_MS = orbFlightMs + orbAbsorbMs + orbShakeMs + orbResultMs;

export function createZoneScene(
  canvas: PixelCanvas,
  initialZone: ZoneDefinition,
  rng: Rng,
): ZoneScene {
  const { ctx } = canvas;
  registerOrbSprites();

  // La zona activa se puede cambiar en caliente: el canvas y el campo de
  // partículas se reutilizan y solo se rehace lo que depende de la zona.
  let zone = initialZone;
  let sprite = getSprite(zone.clickableSpriteId);
  let treeBounds = spriteBounds(zone.clickableSpriteId);
  const particles = createParticleField();

  /**
   * La escena se recoloca con la caja: el objeto queda centrado y el fondo
   * llena todo el ancho, haya el ancho que haya. El objeto se coloca por su
   * base pintada, no por el borde del sprite, para que apoye en el suelo.
   */
  const measure = (width: number, height: number): Layout => {
    const groundY = Math.round(height * GROUND_RATIO);
    const objectX = Math.round((width - sprite.width) / 2);
    const objectY = groundY - treeBounds.bottom;

    const hillCount = Math.max(3, Math.round(width / 56));
    const hills = Array.from({ length: hillCount }, (_, index) => ({
      x: Math.round((index * width) / hillCount) + rng.int(-6, 6),
      width: rng.int(38, 52),
      height: rng.int(9, 16),
    }));

    const cloudCount = Math.max(2, Math.round(width / 70));
    const clouds = Array.from({ length: cloudCount }, (_, index) => ({
      x: Math.round((index * width) / cloudCount) + rng.int(0, 12),
      y: rng.int(8, Math.max(10, Math.round(groundY * 0.4))),
      width: rng.int(10, 16),
    }));

    const tuftCount = Math.round((width * (height - groundY)) / 640);
    const tufts = Array.from({ length: tuftCount }, () => ({
      x: rng.int(1, Math.max(2, width - 3)),
      y: rng.int(groundY + 2, Math.max(groundY + 3, height - 2)),
      width: rng.int(1, 3),
    }));

    return {
      groundY,
      objectX,
      objectY,
      centerX: objectX + (treeBounds.left + treeBounds.right) / 2,
      centerY: objectY + (treeBounds.top + treeBounds.bottom) / 2,
      hills,
      clouds,
      tufts,
    };
  };

  let layout = measure(canvas.width, canvas.height);
  canvas.onResize((width, height) => {
    layout = measure(width, height);
  });

  const setZone = (next: ZoneDefinition): void => {
    if (next.id === zone.id) return;
    zone = next;
    sprite = getSprite(zone.clickableSpriteId);
    treeBounds = spriteBounds(zone.clickableSpriteId);
    // El relieve del fondo se vuelve a sortear: otra zona, otro paisaje.
    layout = measure(canvas.width, canvas.height);
  };

  let elapsed = 0;
  let squashMs = 0;
  let wildSquashMs = 0;
  let encounter: WildEncounter | null = null;
  let encounterNow = 0;
  let orbAnimation: OrbAnimation | null = null;

  /** La salvaje en escena: la del estado o la que retiene la animación. */
  const shownEncounter = (): WildEncounter | null => orbAnimation?.encounter ?? encounter;

  /** Caja de la salvaje, apoyada en el suelo por su base pintada. */
  const wildBox = (): WildBox | null => {
    const shown = shownEncounter();
    if (shown === null) return null;
    const species = getSpecies(shown.speciesId);
    const spriteId = creatureSpriteId(species, shown.shiny);
    const wildSprite = getSprite(spriteId);
    const bounds = spriteBounds(spriteId);

    const drift = orbAnimation === null ? Math.sin(elapsed / 900) * 2 : 0;
    const x = Math.round(
      Math.min(layout.objectX + 70 + drift, canvas.width - wildSprite.width - 2),
    );
    const y = layout.groundY - bounds.bottom;
    return {
      x,
      y,
      cx: x + (bounds.left + bounds.right) / 2,
      cy: y + (bounds.top + bounds.bottom) / 2,
      size: bounds.width,
      top: y + bounds.top,
    };
  };

  const shadow = (centerX: number, width: number): void => {
    ctx.fillStyle = 'rgba(59, 44, 71, 0.13)';
    ctx.fillRect(Math.round(centerX - width / 2), layout.groundY, Math.round(width), 2);
  };

  const drawBackground = (): void => {
    const { width, height } = canvas;
    const { groundY } = layout;

    ctx.fillStyle = zone.palette.sky;
    ctx.fillRect(0, 0, width, groundY);
    ctx.fillStyle = zone.palette.ground;
    ctx.fillRect(0, groundY, width, height - groundY);

    if (zone.backdrop === 'cavern') {
      // Bajo tierra no hay nubes: del techo cuelgan estalactitas.
      ctx.fillStyle = zone.palette.far;
      for (const cloud of layout.clouds) {
        const length = cloud.width;
        for (let i = 0; i < length; i += 1) {
          const half = Math.max(0, Math.round(((length - i) / length) * 2));
          ctx.fillRect(cloud.x - half, i, half * 2 + 1, 1);
        }
      }
    } else {
      // Nubes bajas, para que el cielo claro no quede vacío.
      ctx.fillStyle = '#fffdf7';
      for (const cloud of layout.clouds) {
        ctx.fillRect(cloud.x, cloud.y, cloud.width, 3);
        ctx.fillRect(cloud.x + 2, cloud.y - 2, cloud.width - 5, 2);
      }
    }

    // Relieve de fondo, recortado contra la línea del horizonte.
    ctx.fillStyle = zone.palette.far;
    for (const hill of layout.hills) {
      for (let dx = 0; dx < hill.width; dx += 1) {
        const dome = Math.round(Math.sin((dx / hill.width) * Math.PI) * hill.height);
        if (dome > 0) ctx.fillRect(hill.x + dx, groundY - dome, 1, dome);
      }
    }

    ctx.fillStyle = zone.palette.accent;
    ctx.fillRect(0, groundY - 1, width, 1);

    ctx.fillStyle = zone.palette.detail;
    for (const tuft of layout.tufts) {
      ctx.fillRect(tuft.x, tuft.y, tuft.width, 1);
    }
  };

  const drawClickable = (): void => {
    const { groundY, objectX, objectY, centerX } = layout;
    const progress = squashMs <= 0 ? 1 : 1 - squashMs / BALANCE.feedback.squashMs;
    const scale =
      BALANCE.feedback.squashScale + (1 - BALANCE.feedback.squashScale) * Math.min(1, progress);

    shadow(centerX, treeBounds.width - 18);

    ctx.save();
    // Se aplasta desde la base, como si el árbol se asentara en el suelo.
    ctx.translate(centerX, groundY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -groundY);
    drawSprite(ctx, zone.clickableSpriteId, objectX, objectY, Math.floor(elapsed / SWAY_MS) % 2);
    ctx.restore();
  };

  /** Pinta a la salvaje encogida hacia un punto (para que entre en el orbe). */
  const drawWildSprite = (
    box: WildBox,
    shown: WildEncounter,
    scale: number,
    towards?: { x: number; y: number },
  ): void => {
    const species = getSpecies(shown.speciesId);
    const spriteId = creatureSpriteId(species, shown.shiny);
    const pivot = towards ?? { x: box.cx, y: layout.groundY };

    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.scale(scale, scale);
    ctx.translate(-pivot.x, -pivot.y);
    drawSprite(ctx, spriteId, box.x, box.y, Math.floor(elapsed / 320) % 2);
    ctx.restore();
  };

  const drawWildBars = (box: WildBox, shown: WildEncounter): void => {
    const barWidth = Math.max(18, box.size + 4);
    const barX = Math.round(box.cx - barWidth / 2);
    const barY = box.top - 5;

    ctx.fillStyle = 'rgba(43, 36, 54, 0.45)';
    ctx.fillRect(barX, barY, barWidth, 3);
    ctx.fillStyle = '#e06a7c';
    ctx.fillRect(barX, barY, Math.round((shown.hp / shown.maxHp) * barWidth), 3);

    const total = shown.fleesAt - shown.appearedAt;
    const left = Math.max(0, shown.fleesAt - encounterNow);
    ctx.fillStyle = 'rgba(43, 36, 54, 0.45)';
    ctx.fillRect(barX, barY - 4, barWidth, 2);
    ctx.fillStyle = '#d9a33f';
    ctx.fillRect(barX, barY - 4, Math.round((left / total) * barWidth), 2);

    if (shown.shiny) {
      ctx.fillStyle = '#fffdf7';
      ctx.fillRect(Math.round(box.cx + box.size / 2 - 2), box.y - 1, 2, 2);
      ctx.fillRect(box.x + 1, box.y + 3, 1, 1);
    }
  };

  const drawWild = (): void => {
    const box = wildBox();
    const shown = shownEncounter();
    if (box === null || shown === null || orbAnimation !== null) return;

    const progress = wildSquashMs <= 0 ? 1 : 1 - wildSquashMs / BALANCE.feedback.squashMs;
    const squash =
      BALANCE.feedback.squashScale + (1 - BALANCE.feedback.squashScale) * Math.min(1, progress);

    // La sombra la trae el propio sprite de la criatura.
    drawWildSprite(box, shown, squash);
    drawWildBars(box, shown);
  };

  /**
   * Animación de captura: el orbe vuela en arco, absorbe a la criatura,
   * tambalea en el suelo y acaba en destello (capturada) o en estallido con
   * la criatura de vuelta (se escapó).
   */
  const drawOrbAnimation = (): void => {
    const animation = orbAnimation;
    const box = wildBox();
    if (animation === null || box === null) return;

    const spriteId = orbSpriteId(animation.orbId);
    const orbSprite = getSprite(spriteId);
    const half = orbSprite.width / 2;
    const frame = Math.floor(animation.elapsed / 90) % 2;
    const restX = box.cx;
    const restY = layout.groundY - 8;

    const drawOrb = (x: number, y: number): void => {
      drawSprite(ctx, spriteId, Math.round(x - half), Math.round(y - half), frame);
    };

    let time = animation.elapsed;

    // 1. Vuelo en arco desde la mano del jugador.
    if (time < orbFlightMs) {
      const t = time / orbFlightMs;
      const fromX = layout.objectX + 8;
      const fromY = canvas.height - 6;
      drawWildSprite(box, animation.encounter, 1);
      drawWildBars(box, animation.encounter);
      drawOrb(
        fromX + (restX - fromX) * t,
        fromY + (restY - fromY) * t - Math.sin(t * Math.PI) * 22,
      );
      return;
    }
    time -= orbFlightMs;

    // 2. La criatura se encoge hacia el orbe.
    if (time < orbAbsorbMs) {
      const t = time / orbAbsorbMs;
      drawWildSprite(box, animation.encounter, Math.max(0, 1 - t), { x: restX, y: restY });
      drawOrb(restX, restY);
      return;
    }
    time -= orbAbsorbMs;

    // 3. Tambaleo: tres vaivenes con el orbe ya en el suelo.
    if (time < orbShakeMs) {
      const wobble = Math.sin((time / orbShakeMs) * Math.PI * 6);
      shadow(box.cx, 10);
      drawOrb(restX + wobble * 2, restY + Math.abs(wobble));
      return;
    }
    time -= orbShakeMs;

    // 4. Resultado.
    const t = Math.min(1, time / orbResultMs);
    if (!animation.burst) {
      animation.burst = true;
      particles.burst(restX, restY, animation.captured ? CAPTURE_COLORS : ESCAPE_COLORS, rng);
    }

    if (animation.captured) {
      // Destello en cruz que se abre desde el orbe y se apaga.
      const radius = Math.round(4 + t * 12);
      if (t < 0.7) {
        ctx.fillStyle = '#fffdf7';
        ctx.fillRect(restX - radius, restY, radius * 2, 1);
        ctx.fillRect(restX, restY - radius, 1, radius * 2);
      }
      shadow(box.cx, 10);
      drawOrb(restX, restY - Math.round(t * 4));
      return;
    }

    // Se escapó: vuelve a salir del orbe; si además huye, se va del cuadro.
    const escape = animation.fled ? Math.round(t * 26) : 0;
    ctx.save();
    ctx.translate(escape, 0);
    drawWildSprite(box, animation.encounter, Math.min(1, t * 1.6));
    ctx.restore();
  };

  return {
    get center() {
      return { x: layout.centerX, y: layout.centerY };
    },

    render(frameMs) {
      elapsed += frameMs;
      if (squashMs > 0) squashMs = Math.max(0, squashMs - frameMs);
      if (wildSquashMs > 0) wildSquashMs = Math.max(0, wildSquashMs - frameMs);
      if (orbAnimation !== null) {
        orbAnimation.elapsed += frameMs;
        if (orbAnimation.elapsed >= ORB_TOTAL_MS) orbAnimation = null;
      }
      particles.update(frameMs);

      drawBackground();
      drawClickable();
      drawWild();
      drawOrbAnimation();
      particles.draw(ctx);
    },

    setEncounter(next, now) {
      if (next !== null && encounter !== null && next.hp < encounter.hp) {
        wildSquashMs = BALANCE.feedback.squashMs;
      }
      encounter = next;
      encounterNow = now;
    },

    playOrbThrow(orbId, captured, fled) {
      const target = encounter ?? orbAnimation?.encounter ?? null;
      if (target === null) return;
      orbAnimation = { encounter: target, orbId, captured, fled, elapsed: 0, burst: false };
    },

    get wildCenter() {
      const box = wildBox();
      return box === null ? null : { x: box.cx, y: box.cy };
    },

    hitTestWild(x, y) {
      // Durante la animación la criatura no está disponible para más golpes.
      if (orbAnimation !== null || encounter === null) return false;
      const box = wildBox();
      if (box === null) return false;
      const half = box.size / 2;
      return x >= box.cx - half && x < box.cx + half && y >= box.y && y <= layout.groundY;
    },

    hitTest(x, y) {
      const { objectX, objectY } = layout;
      return (
        x >= objectX + treeBounds.left &&
        x < objectX + treeBounds.right &&
        y >= objectY + treeBounds.top &&
        y < objectY + treeBounds.bottom
      );
    },

    punch(x, y) {
      squashMs = BALANCE.feedback.squashMs;
      particles.burst(x, y, PARTICLE_COLORS, rng);
    },

    setZone,
    dispose() {
      canvas.dispose();
    },
  };
}
