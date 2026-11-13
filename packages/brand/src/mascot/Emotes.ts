/**
 * Comic symbols that float off the character: Z's while she sleeps, hearts,
 * a "!" when startled, dizzy stars circling her head. Positions are in body
 * radii relative to the head centre (y up), so they travel with her.
 */
export const EMOTE_SHAPES = ['z', 'heart', 'bang', 'question', 'sparkle', 'anger', 'sweat', 'star', 'note', 'idea', 'book', 'pencil'] as const;
export type EmoteShape = typeof EMOTE_SHAPES[number];
export const EMOTE_INDEX: Record<EmoteShape, number> = Object.fromEntries(EMOTE_SHAPES.map((s, i) => [s, i])) as Record<EmoteShape, number>;

type Particle = {
  shape: EmoteShape; x: number; y: number; vx: number; vy: number; age: number; life: number;
  size: number; rot: number; spin: number; sway: number; orbit?: { angle: number; speed: number };
  sustained?: boolean;
};
export type EmoteSprite = { shape: EmoteShape; x: number; y: number; size: number; rot: number; alpha: number; behind: boolean };

const MAX = 24;

export class Emotes {
  private readonly particles: Particle[] = [];
  private readonly random: () => number;
  private sustained = new Set<EmoteShape>();

  constructor(random: () => number) { this.random = random; }

  spawn(shape: EmoteShape, count = 1) {
    for (let i = 0; i < count && this.particles.length < MAX; i++) {
      const r = this.random, side = r() < 0.5 ? -1 : 1;
      const p: Particle = { shape, x: 0.6, y: 0.9, vx: 0, vy: 0, age: -i * 0.12, life: 1.4, size: 0.24, rot: 0, spin: 0, sway: r() * 6 };
      if (shape === 'z') Object.assign(p, { x: 0.5, y: 0.82, vx: 0.22, vy: 0.42, life: 2.6, size: 0.2, rot: -0.2 });
      else if (shape === 'heart') Object.assign(p, { x: (r() - 0.5) * 0.8, y: 0.95, vx: (r() - 0.5) * 0.3, vy: 0.7, life: 1.7, size: 0.2 + r() * 0.08 });
      else if (shape === 'bang' || shape === 'question') Object.assign(p, { x: 0.78 * side, y: 1.02, life: shape === 'bang' ? 0.95 : 1.8, size: 0.3, rot: 0.18 * side });
      else if (shape === 'sparkle') {
        const angle = r() * Math.PI * 2, distance = 1.15 + r() * 0.35;
        Object.assign(p, { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.9 + 0.2, life: 0.75 + r() * 0.3, size: 0.13 + r() * 0.1, spin: (r() - 0.5) * 4 });
      } else if (shape === 'sweat') Object.assign(p, { x: -0.74, y: 0.6, vy: -0.08, life: 1.6, size: 0.17 });
      else if (shape === 'star') Object.assign(p, { x: 0, y: 1.0, life: 2.9, size: 0.16, orbit: { angle: (i / count) * Math.PI * 2, speed: 4.2 }, spin: 3 });
      else if (shape === 'note') Object.assign(p, { x: 0.55 * side, y: 0.2, vx: 0.18 * side, vy: 0.5, life: 2, size: 0.18 });
      else if (shape === 'idea') Object.assign(p, { x: 0.62, y: 1.12, life: 1.4, size: 0.3, rot: -0.35 });
      this.particles.push(p);
    }
  }

  /** A held symbol (the anger mark, a bead of sweat, a book) that stays while its feeling does. */
  sustain(shape: EmoteShape, on: boolean) {
    if (on === this.sustained.has(shape)) return;
    if (on) {
      this.sustained.add(shape);
      const place: Partial<Record<EmoteShape, [number, number, number, number]>> = {
        anger: [0.64, 0.8, 0.22, 0], sweat: [-0.76, 0.6, 0.16, 0], question: [0.78, 1.02, 0.28, 0.15],
        idea: [0.62, 1.12, 0.3, -0.35], book: [0.05, -1.08, 0.5, 0], pencil: [0.72, -0.98, 0.36, 0.5],
      };
      const [x, y, size, rot] = place[shape] ?? [0.7, 0.9, 0.22, 0];
      this.particles.push({ shape, x, y, vx: 0, vy: 0, age: 0, life: Infinity, size, rot, spin: 0, sway: 0, sustained: true });
    } else {
      this.sustained.delete(shape);
      for (const p of this.particles) if (p.sustained && p.shape === shape) { p.sustained = false; p.life = p.age + 0.3; }
    }
  }

  clear() { this.particles.length = 0; this.sustained.clear(); }

  held(): ReadonlySet<EmoteShape> { return this.sustained; }

  update(dt: number, reducedMotion: boolean) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age > p.life) { this.particles.splice(i, 1); continue; }
      if (p.age < 0 || reducedMotion) continue;
      if (p.orbit) {
        p.orbit.angle += p.orbit.speed * dt;
        p.x = Math.cos(p.orbit.angle) * 0.82;
        p.y = 1.0 + Math.sin(p.orbit.angle) * 0.16;
      } else {
        p.x += (p.vx + Math.sin(p.age * 3 + p.sway) * (p.shape === 'z' || p.shape === 'note' ? 0.18 : 0)) * dt;
        p.y += p.vy * dt;
      }
      p.rot += p.spin * dt;
    }
  }

  sprites(): EmoteSprite[] {
    const out: EmoteSprite[] = [];
    for (const p of this.particles) {
      if (p.age < 0) continue;
      const t = p.life === Infinity ? 0.5 : p.age / p.life;
      // Pop in with a little overshoot, fade over the last third.
      const pop = Math.min(1, p.age / 0.16);
      const scale = (pop < 1 ? pop * (1.25 - 0.25 * pop) : 1) * (p.shape === 'z' ? 0.7 + 0.6 * t : 1)
        * (p.sustained ? 1 + 0.08 * Math.sin(p.age * 7) : 1) * (p.shape === 'sparkle' ? Math.sin(Math.PI * Math.min(1, t)) * 1.2 : 1);
      const alpha = p.life === Infinity ? 1 : 1 - Math.max(0, (t - 0.66) / 0.34);
      const behind = !!p.orbit && Math.sin(p.orbit.angle) > 0.15;
      out.push({ shape: p.shape, x: p.x, y: p.y, size: p.size * scale, rot: p.rot, alpha: alpha * (behind ? 0.55 : 1), behind });
    }
    return out;
  }
}
