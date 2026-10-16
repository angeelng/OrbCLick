import { BALANCE } from '../data/balance';
import type { Rng } from '../core/rng';

/** Partículas del feedback de clic: 4–6 chispas que caen y se apagan. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Vida restante en ms. */
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface ParticleField {
  burst(x: number, y: number, colors: readonly string[], rng: Rng): void;
  update(frameMs: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  readonly count: number;
}

export function createParticleField(capacity = 160): ParticleField {
  const particles: Particle[] = [];
  const { particlesMin, particlesMax, particleLifeMs, particleSpeed, particleGravity } =
    BALANCE.feedback;

  return {
    burst(x, y, colors, rng) {
      const amount = rng.int(particlesMin, particlesMax);
      for (let i = 0; i < amount; i += 1) {
        if (particles.length >= capacity) break;
        const angle = rng.range(-Math.PI * 0.85, -Math.PI * 0.15);
        const speed = rng.range(particleSpeed * 0.6, particleSpeed * 1.4);
        const life = rng.range(particleLifeMs * 0.7, particleLifeMs);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life,
          size: rng.int(1, 2),
          color: colors[rng.int(0, colors.length - 1)] ?? '#ffffff',
        });
      }
    },

    update(frameMs) {
      const seconds = frameMs / 1000;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        if (particle === undefined) continue;
        particle.life -= frameMs;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        particle.vy += particleGravity * seconds;
        particle.x += particle.vx * seconds;
        particle.y += particle.vy * seconds;
      }
    },

    draw(ctx) {
      for (const particle of particles) {
        // Se apaga en tres escalones: nada de alpha suave, que esto es pixel art.
        const remaining = particle.life / particle.maxLife;
        if (remaining < 0.25 && Math.floor(particle.life / 60) % 2 === 0) continue;
        ctx.fillStyle = particle.color;
        ctx.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
      }
    },

    get count() {
      return particles.length;
    },
  };
}
