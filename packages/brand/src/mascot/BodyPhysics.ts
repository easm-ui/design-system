/**
 * The body as a soft ball: a point mass that hops, falls, bounces, rolls and
 * dangles, carrying a small deformation (a 2×2 strain plus a lean) that is a
 * damped spring of its own. Shape responds to what happens to the mass:
 *
 * - stretch along the velocity in flight, squash along the contact normal on
 *   impact, volume preserved (the depth axis takes 1/det);
 * - the bottom stays planted while she squashes on the floor (deformation
 *   about the contact point), the grabbed tuft stays under the pointer while
 *   she hangs (deformation about the grab point);
 * - a lean (shear) lags behind horizontal changes of speed, the soft-body
 *   follow-through of take-off and landing;
 * - held, she is an elastic pendulum: gravity, a spring to the grab point and
 *   damping, so she swings and stretches; let go, she keeps that velocity;
 * - on the floor she rolls without slipping, and rights herself when still.
 *
 * One gravity for everything she does (40 radii/s²): a hop, a fall after a
 * throw and her swing in the hand all come down at the same rate, and it
 * scales with her size so a hop takes the same time whether she is drawn
 * small in a corner or large on a stage. Until 2026-11-10 a hop used 15.5
 * radii/s² and a fall up to four times that (the world's height in 0.9 s), so
 * her own hops floated like the moon's while a throw dropped like a stone.
 * Only on a very tall screen is a fall hurried, so it never takes longer than
 * FALL_TIME from top to bottom. World units are CSS pixels with y down;
 * deformation output is y up, radius units.
 *
 * The ground is the world's floor (the bottom of the screen) and the ledges
 * on it (the chat button's top, the open panel's top, a heading, a swing's
 * seat), each with a left and a right end. She comes down on a ledge only
 * where she is over it and above it; anywhere else she falls to the floor.
 * One floor line across the whole width made her land on nothing beside the
 * chat button (2026-10-23).
 */
/** A surface she can stand on: its top (`y`) from `left` to `right`. */
export type Ledge = { left: number; right: number; y: number };
export type Bounds = { left: number; right: number; top: number; floor: number; hide: number; ledges?: Ledge[] };
export type BodyCues = {
  /** A held body pose from the expression: − squashed, + stretched. */
  pose: number;
  inflate: number; breathRate: number; shiver: number; giggle: number; stretch: number;
  rollOffset: number; hidden: boolean; reducedMotion: boolean;
};
export type BodyEvent =
  | { type: 'launch'; leap: boolean } | { type: 'land'; speed: number } | { type: 'bounce'; speed: number }
  | { type: 'wall'; speed: number } | { type: 'settled' } | { type: 'released'; speed: number }
  | { type: 'hang' } | { type: 'fall' };
export type BodyFrame = {
  /** Render origin (px): the undeformed centre, offset for a held grab. */
  x: number; y: number;
  /** Deformation pivot in radius units, y up, relative to the origin. */
  pivot: [number, number, number];
  /** Column-major 3×3 deformation, volume preserving. */
  deform: Float32Array;
  roll: number; scale: number; vx: number; vy: number;
  groundX: number; groundY: number; lift: number; hidden: number;
  mode: Mode;
};
type Mode = 'rest' | 'crouch' | 'air' | 'held' | 'free';

export const REST_HEIGHT = 1.12;
const GRAVITY = 40;
/** A fall from the top of the world to its floor takes no longer than this (s). */
const FALL_TIME = 1.2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Strain of a volume-preserving uniaxial stretch `a` along unit (dx, dy). */
function uniaxial(a: number, dx: number, dy: number): [number, number, number] {
  const p = 1 / Math.sqrt(a);
  return [(a - p) * dx * dx + p - 1, (a - p) * dy * dy + p - 1, (a - p) * dx * dy];
}

export class BodyPhysics {
  x = 0; y = 0; vx = 0; vy = 0;
  restX = 0; restY = 0;
  mode: Mode = 'rest';
  private r = 50;
  private bounds: Bounds = { left: 0, right: 0, top: 0, floor: 0, hide: 0 };
  private readonly strain = [0, 0, 0];
  private readonly strainVelocity = [0, 0, 0];
  private lean = 0;
  private leanVelocity = 0;
  private roll = 0;
  private spin = 0;
  private contact = 1;
  private breath = 0;
  private inflate = 0;
  private hide = 0;
  private clock = 0;
  private crouch: { tx: number; ty: number; time: number; duration: number; height: number; leap?: boolean; apex?: number } | null = null;
  /** A drop's moment at the top: she stops dead in the air over (x), then falls. */
  private hang: { x: number; left: number } | null = null;
  /** A leap's own gravity (radii-scaled gravity would float a long leap for ~2 s), until it lands. */
  private leapGravity = 0;
  /** Where the hop in the air lands, and a hop asked for while busy. */
  private hopTarget: { x: number; y: number } | null = null;
  private queued: { x: number; y: number } | null = null;
  /**
   * A leap or a drop asked for while she is in the air: it starts where she
   * comes down. Started at once it crouched on nothing and pushed off the air.
   */
  private pending: { x: number; y: number; apex?: number } | null = null;
  /** Grab point in body coordinates (radius units, y up) and the hand. */
  private held: { ax: number; ay: number; bx: number; by: number; length: number; avx: number; avy: number } | null = null;
  private readonly events: BodyEvent[] = [];

  get radius() { return this.r; }
  get busy() { return this.mode !== 'rest'; }
  get onFloor() { return this.mode === 'rest' || this.mode === 'crouch'; }
  get gravity() { return GRAVITY * this.r; }
  /** A fall's gravity: her own, or the world's height in FALL_TIME, whichever is stronger. */
  get fallGravity() { return Math.max(this.gravity, 2 * Math.max(0, this.bounds.floor - this.bounds.top) / FALL_TIME ** 2); }

  /**
   * The top of what her feet come down on at `x`, falling from feet height
   * `from`: the highest ledge under her that she is not below, else the floor.
   */
  surfaceUnder(x: number, from: number) {
    let y = this.bounds.floor;
    for (const ledge of this.bounds.ledges ?? []) {
      if (x >= ledge.left && x <= ledge.right && ledge.y >= from - 0.5 && ledge.y < y) y = ledge.y;
    }
    return y;
  }

  /** With `keepOnFloor`, a resting body grows or shrinks with her feet where they stand. */
  setRadius(r: number, keepOnFloor = false) {
    const feet = this.restY + REST_HEIGHT * this.r;
    this.r = Math.max(8, r);
    if (keepOnFloor && this.mode === 'rest') this.restY = this.y = feet - REST_HEIGHT * this.r;
  }

  /** A soft landing where she now stands, as if she had just dropped there. */
  thump(speed: number) {
    this.strainVelocity[1] -= speed * 0.34;
    this.strainVelocity[0] += speed * 0.17;
  }

  /** Lets go of a ledge that is no longer there: she falls to the floor. */
  drop() {
    if (this.mode === 'held') return;
    this.crouch = null; this.hang = null; this.hopTarget = null; this.leapGravity = 0; this.pending = null;
    this.vx = 0; this.vy = this.r * 2; this.spin = 0;
    this.mode = 'free';
  }
  setBounds(bounds: Bounds) { this.bounds = bounds; }

  /** Places her at rest without motion (first layout, resize, reduced motion). */
  place(x: number, y: number) {
    this.leapGravity = 0;
    this.x = this.restX = x; this.y = this.restY = y;
    this.vx = this.vy = 0; this.mode = 'rest'; this.crouch = null; this.hang = null; this.held = null; this.hopTarget = null; this.queued = null; this.pending = null;
    this.strain.fill(0); this.strainVelocity.fill(0); this.lean = this.leanVelocity = 0;
    this.roll = this.spin = 0; this.contact = 1;
  }

  /** Anticipation, then a ballistic hop that lands at rest on (x, y). */
  hopTo(x: number, y: number, height = 0.55, reducedMotion = false) {
    if (this.mode === 'held') return;
    if (reducedMotion) { this.place(x, y); return; }
    const distance = Math.hypot(x - this.x, y - this.y) / this.r;
    if (this.mode !== 'rest') { this.queued = { x, y }; return; }
    this.crouch = { tx: x, ty: y, time: 0, duration: 0.09 + 0.06 * clamp(distance / 3, 0, 1), height: Math.max(height, Math.min(1.4, distance * 0.28)) };
    this.mode = 'crouch';
  }

  /**
   * A long leap across the page (onto a heading, or back home): the same
   * anticipation and arc as a hop, under a stronger gravity so the flight
   * takes about 0.75 s however far it goes. A cartoon spring, not a float.
   */
  leapTo(x: number, y: number, reducedMotion = false) {
    if (this.mode === 'held') return;
    if (reducedMotion) { this.place(x, y); return; }
    if (this.mode === 'air' || this.mode === 'free') { this.pending = { x, y }; this.queued = null; return; }
    this.pending = null; this.queued = null;
    this.crouch = { tx: x, ty: y, time: 0, duration: 0.16, height: 1.1, leap: true };
    this.mode = 'crouch';
  }

  /**
   * Her drop (a click on an empty spot of the page): a jump that tops out at
   * (x, apexY), a moment's hang there, then straight down onto (x, floorY),
   * the first surface under the click. Cartoon physics: the sideways motion
   * stops dead at the top.
   */
  dropTo(x: number, apexY: number, floorY: number, reducedMotion = false) {
    if (this.mode === 'held') return;
    if (reducedMotion) { this.place(x, floorY); return; }
    if (this.mode === 'air' || this.mode === 'free') { this.pending = { x, y: floorY, apex: apexY }; this.queued = null; return; }
    this.pending = null; this.queued = null;
    this.crouch = { tx: x, ty: floorY, time: 0, duration: 0.14, height: 1, leap: true, apex: apexY };
    this.mode = 'crouch';
  }

  /** Where an aimed jump lands, changed on the way (her drop's surface, found while she rose). */
  retarget(y: number) {
    if (this.pending) this.pending.y = y;
    else if (this.crouch) this.crouch.ty = y;
    else if (this.mode === 'air' && this.hopTarget) this.hopTarget.y = Math.max(y, this.y);
  }

  /** The ledge she stands on moved (the page scrolled under it): she moves with it. */
  shift(dx: number, dy: number) {
    if (this.hopTarget) { this.hopTarget.x += dx; this.hopTarget.y += dy; }
    if (this.crouch) { this.crouch.tx += dx; this.crouch.ty += dy; }
    if (this.pending) { this.pending.x += dx; this.pending.y += dy; }
    if (this.mode === 'air' || this.mode === 'free' || this.mode === 'held') return;
    this.x += dx; this.y += dy; this.restX += dx; this.restY += dy;
  }

  /**
   * The same body in another frame of reference (the page scrolled under her
   * while she was attached to it, and she now counts from the screen or from
   * the new scroll): every position moves, in the air or held as much as at
   * rest, so she stays exactly where she is seen.
   */
  translate(dx: number, dy: number) {
    if (!dx && !dy) return;
    this.x += dx; this.y += dy; this.restX += dx; this.restY += dy;
    if (this.crouch) { this.crouch.tx += dx; this.crouch.ty += dy; if (this.crouch.apex !== undefined) this.crouch.apex += dy; }
    if (this.hang) this.hang.x += dx;
    if (this.hopTarget) { this.hopTarget.x += dx; this.hopTarget.y += dy; }
    if (this.queued) { this.queued.x += dx; this.queued.y += dy; }
    if (this.pending) { this.pending.x += dx; this.pending.y += dy; if (this.pending.apex !== undefined) this.pending.apex += dy; }
    if (this.held) { this.held.ax += dx; this.held.ay += dy; this.held.bx += dx; this.held.by += dy; }
  }

  /** A vertical jump in place of `height` radii (startle, celebrate). */
  jump(height: number, reducedMotion = false) {
    if (reducedMotion || this.mode === 'held') return;
    // A hop or leap gathering itself keeps its target (a greeting's bounce
    // used to turn a leap onto a heading into a jump in place).
    if (this.mode === 'crouch' && this.crouch && (this.crouch.leap || this.crouch.tx !== this.restX || this.crouch.ty !== this.restY)) return;
    if (this.mode === 'rest' || this.mode === 'crouch') {
      this.crouch = { tx: this.restX, ty: this.restY, time: 0, duration: height < 0.4 ? 0.05 : 0.1, height };
      this.mode = 'crouch';
    }
  }

  grab(px: number, py: number) {
    this.crouch = null; this.hang = null; this.hopTarget = null; this.queued = null; this.pending = null; this.leapGravity = 0;
    const gx = (px - this.x) / this.r, gy = -(py - this.y) / this.r;
    const c = Math.cos(-this.roll), s = Math.sin(-this.roll);
    this.held = { ax: px, ay: py, bx: gx * c - gy * s, by: gx * s + gy * c, length: Math.max(Math.hypot(px - this.x, py - this.y), this.r * 0.3), avx: 0, avy: 0 };
    this.mode = 'held';
  }

  drag(px: number, py: number, dt: number) {
    if (!this.held || dt <= 0) return;
    const a = 1 - Math.exp(-dt * 25);
    this.held.avx += ((px - this.held.ax) / dt - this.held.avx) * a;
    this.held.avy += ((py - this.held.ay) / dt - this.held.avy) * a;
    this.held.ax = px; this.held.ay = py;
  }

  /** Lets go; returns release speed in radii/s so a caller can react to a throw. */
  release(): number {
    if (!this.held) return 0;
    // A throw carries the pointer's momentum as well as the swing.
    this.vx = this.vx * 0.5 + this.held.avx * 0.5;
    this.vy = this.vy * 0.5 + this.held.avy * 0.5;
    const max = this.r * 32;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > max) { this.vx *= max / speed; this.vy *= max / speed; }
    this.spin = clamp(-this.vx / this.r * 0.35, -9, 9);
    this.held = null;
    this.mode = 'free';
    const released = Math.hypot(this.vx, this.vy) / this.r;
    this.events.push({ type: 'released', speed: released });
    return released;
  }

  /** Throw without a pointer (studio tests): velocity in radii/s. */
  toss(vx: number, vy: number) {
    if (this.mode === 'held') return;
    this.crouch = null; this.hang = null; this.hopTarget = null;
    this.vx = vx * this.r; this.vy = vy * this.r; this.spin = clamp(-vx * 0.35, -9, 9);
    this.mode = 'free';
  }

  /** Called as a hop or tumble ends so a queued destination still happens. */
  private continueHop() {
    if (this.pending) {
      const next = this.pending; this.pending = null;
      if (next.apex !== undefined) this.dropTo(next.x, next.apex, next.y);
      else this.leapTo(next.x, next.y);
      return;
    }
    if (!this.queued) return;
    const target = this.queued; this.queued = null;
    this.hopTo(target.x, target.y);
  }

  takeEvents(): BodyEvent[] { return this.events.splice(0); }

  update(dt: number, cues: BodyCues) {
    if (dt <= 0) return;
    this.clock += dt;
    this.inflate += (cues.inflate - this.inflate) * (1 - Math.exp(-dt * 4));
    this.breath += dt * Math.PI * 2 * cues.breathRate / 60;
    const hideTarget = cues.hidden ? 1 : 0;
    this.hide += clamp(hideTarget - this.hide, -dt * 1.6, dt * (cues.hidden ? 0.9 : 3));
    if (cues.reducedMotion) {
      this.strain.fill(0); this.strainVelocity.fill(0); this.lean = this.leanVelocity = 0; this.roll = this.spin = 0;
      if (this.mode !== 'held' && this.mode !== 'rest') this.place(this.crouch?.tx ?? this.hopTarget?.x ?? this.x, this.crouch?.ty ?? this.hopTarget?.y ?? this.restY);
      if (this.held) { this.x = this.held.ax - this.held.bx * this.r; this.y = this.held.ay + this.held.by * this.r; }
      return;
    }
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h, cues);
  }

  private step(h: number, cues: BodyCues) {
    const r = this.r, g = this.mode === 'air' && this.leapGravity ? this.leapGravity : this.mode === 'free' ? this.fallGravity : this.gravity;
    const feetBefore = this.y + REST_HEIGHT * r;
    const target = [0, 0, 0];
    let leanTarget = 0;
    let contactTarget = 0;

    if (this.mode === 'rest') {
      contactTarget = 1;
      this.x = this.restX; this.vx = this.vy = 0;
      this.y = this.restY;
      this.settleRoll(h, cues.rollOffset);
    } else if (this.mode === 'crouch' && this.crouch) {
      contactTarget = 1;
      const c = this.crouch;
      c.time += h;
      const k = Math.min(1, c.time / c.duration);
      // Anticipation: compress and lean toward where she is going.
      const squash = uniaxial(1 - 0.34 * Math.sin(k * Math.PI / 2) * clamp(c.height / 0.6, 0.5, 1.3), 0, 1);
      target[0] = squash[0]; target[1] = squash[1];
      leanTarget = clamp((c.tx - this.x) / (r * 12), -0.12, 0.12);
      this.settleRoll(h, cues.rollOffset);
      if (c.time >= c.duration) this.launch(c);
    } else if (this.mode === 'air' && this.hang && this.vy >= 0) {
      // Over the spot at the top of her drop: she stops dead, hangs, then falls.
      if (this.vx !== 0) { this.x = this.hang.x; this.vx = this.vy = 0; this.events.push({ type: 'hang' }); }
      this.hang.left -= h;
      leanTarget = 0;
      if (this.hang.left <= 0) { this.hang = null; this.events.push({ type: 'fall' }); }
    } else if (this.mode === 'air' || this.mode === 'free') {
      this.vy += g * h;
      if (this.mode === 'free') { const drag = Math.exp(-0.25 * h); this.vx *= drag; this.vy *= drag; }
      this.x += this.vx * h; this.y += this.vy * h;
      this.roll += this.spin * h;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 1) {
        const s = uniaxial(1 + clamp(speed / (r * 30), 0, 0.2), this.vx / speed, -this.vy / speed);
        target[0] = s[0]; target[1] = s[1]; target[2] = s[2];
      }
      this.collide(feetBefore, h);
    } else if (this.mode === 'held' && this.held) {
      const held = this.held;
      // Elastic pendulum about the grab point: static sag ≈ 0.16 r.
      const k = g / (0.16 * r), c = 2 * 0.22 * Math.sqrt(k);
      const dx = this.x - held.ax, dy = this.y - held.ay;
      const distance = Math.max(1e-3, Math.hypot(dx, dy));
      const extension = distance - held.length;
      const ax = -k * extension * dx / distance - c * this.vx;
      const ay = -k * extension * dy / distance - c * this.vy + g;
      this.vx += ax * h; this.vy += ay * h;
      this.x += this.vx * h; this.y += this.vy * h;
      // A string, not a rubber band: bound how far she can be pulled out.
      const nx = this.x - held.ax, ny = this.y - held.ay, length = Math.hypot(nx, ny), limit = held.length + r * 1.1;
      if (length > limit) { this.x = held.ax + nx / length * limit; this.y = held.ay + ny / length * limit; }
      const floorY = this.bounds.floor - REST_HEIGHT * r;
      if (this.y > floorY) { this.y = floorY; this.vy = Math.min(this.vy, 0); }
      const stretch = clamp(Math.hypot(this.x - held.ax, this.y - held.ay) / held.length, 0.8, 1.5);
      const ux = (this.x - held.ax) / Math.max(1e-3, length), uy = -(this.y - held.ay) / Math.max(1e-3, length);
      const s = uniaxial(1 + (stretch - 1) * 0.6, ux, uy);
      target[0] = s[0]; target[1] = s[1]; target[2] = s[2];
      // Turn so the grabbed point faces the hand (angles y up).
      const grabbed = Math.hypot(held.bx, held.by);
      const want = (Math.atan2(-uy, -ux) - Math.atan2(held.by, held.bx)) * clamp(grabbed, 0, 1);
      const wrapped = Math.atan2(Math.sin(want - this.roll), Math.cos(want - this.roll));
      this.spin += (wrapped * 90 - this.spin * 14) * h;
      this.roll += this.spin * h;
    }

    // A held pose (anticipation, landing, exhausted) on the floor or in the air.
    if (cues.pose) {
      const pose = uniaxial(clamp(1 + cues.pose, 0.5, 1.5), 0, 1);
      target[0] += pose[0]; target[1] += pose[1];
    }
    // Breathing, emotion and acts add to the strain target.
    const breath = Math.sin(this.breath) * 0.012;
    target[1] += breath + (cues.stretch || 0) + Math.sin(this.clock * Math.PI * 14) * 0.05 * cues.giggle;
    target[0] -= breath * 0.5;

    const omega = Math.PI * 2 * 3.2, zeta = 0.32;
    for (let i = 0; i < 3; i++) {
      this.strainVelocity[i] += ((target[i] - this.strain[i]) * omega * omega - this.strainVelocity[i] * 2 * zeta * omega) * h;
      this.strain[i] = clamp(this.strain[i] + this.strainVelocity[i] * h, -0.48, 0.55);
    }
    const leanOmega = Math.PI * 2 * 2.4, leanZeta = 0.35;
    this.leanVelocity += ((leanTarget - this.lean) * leanOmega * leanOmega - this.leanVelocity * 2 * leanZeta * leanOmega) * h;
    this.lean = clamp(this.lean + this.leanVelocity * h, -0.45, 0.45);
    this.contact += (contactTarget - this.contact) * (1 - Math.exp(-h * 22));
  }

  private launch(c: NonNullable<BodyPhysics['crouch']>) {
    if (c.apex !== undefined) {
      // A drop: up to the apex in ~0.4 s (never lower than a little hop), then the hang.
      const apex = clamp(Math.min(c.apex, this.y - 0.6 * this.r), this.bounds.top + this.r * 1.4, this.y);
      const rise = Math.max(1, this.y - apex), timeUp = 0.4;
      this.leapGravity = Math.max(this.gravity, 2 * rise / timeUp ** 2);
      this.vy = -this.leapGravity * timeUp;
      this.vx = (c.tx - this.x) / timeUp;
      this.hang = { x: c.tx, left: 0.24 };
      this.hopTarget = { x: c.tx, y: Math.max(c.ty, apex) };
      this.crouch = null;
      this.mode = 'air';
      this.strainVelocity[1] += 4.2;
      this.leanVelocity -= this.vx / this.r * 0.22;
      this.spin = 0;
      this.events.push({ type: 'launch', leap: true });
      return;
    }
    // The arc stays under the top of the screen: a ceiling bounce mid-leap
    // (leaving a heading near the top) cut it short, and the landing then
    // snapped her sideways onto the target. From above the top she just falls in.
    const ceiling = this.bounds.top + this.r * 1.25;
    const apex = Math.max(Math.min(this.y, c.ty) - c.height * this.r, Math.min(this.y, ceiling));
    // A leap picks the gravity that lands it in ~0.75 s (never weaker than usual).
    const rise = Math.sqrt(2 * Math.max(1, this.y - apex)) + Math.sqrt(2 * Math.max(1, c.ty - apex));
    this.leapGravity = c.leap ? Math.max(this.gravity, (rise / 0.75) ** 2) : 0;
    const g = this.leapGravity || this.gravity;
    const up = Math.sqrt(2 * g * Math.max(1, this.y - apex));
    const timeUp = up / g, timeDown = Math.sqrt(2 * Math.max(1, c.ty - apex) / g);
    this.vy = -up;
    this.vx = (c.tx - this.x) / (timeUp + timeDown);
    this.hopTarget = { x: c.tx, y: c.ty };
    this.crouch = null;
    this.mode = 'air';
    // Release of the crouch shoots the strain into a stretch; the top lags.
    this.strainVelocity[1] += 4.2 * Math.min(1.3, c.height / 0.6);
    this.leanVelocity -= this.vx / this.r * 0.22;
    this.spin = 0;
    this.events.push({ type: 'launch', leap: !!c.leap });
  }

  private collide(feetBefore: number, h: number) {
    const r = this.r, b = this.bounds;
    // An aimed hop lands where it was aimed; anything else on what is under her.
    const floorY = this.mode === 'air' && this.hopTarget ? this.hopTarget.y : this.surfaceUnder(this.x, feetBefore) - REST_HEIGHT * r;
    if (this.y >= floorY && this.vy > 0) {
      const speed = this.vy;
      this.y = floorY;
      if (speed > r * 0.6) {
        // Impact: squash along the floor normal, bulge sideways, the top
        // carries on in the direction of travel.
        this.strainVelocity[1] -= speed / r * 0.34;
        this.strainVelocity[0] += speed / r * 0.17;
        this.leanVelocity += this.vx / r * 0.3;
      }
      if (this.mode === 'air') {
        // On target, she lands on it; short of it (a wall, a ceiling), she lands
        // where she is and walks the rest, never a jump across the screen.
        const tx = this.hopTarget?.x;
        if (tx !== undefined && Math.abs(tx - this.x) < r * 0.8) this.x = tx;
        this.hopTarget = null; this.leapGravity = 0;
        this.restX = this.x; this.restY = this.y; this.vx = this.vy = 0;
        this.mode = 'rest';
        this.events.push({ type: 'land', speed: speed / r });
        this.continueHop();
        return;
      }
      if (speed > r * 2.6) {
        this.vy = -speed * 0.45;
        // The floor takes some of her sideways speed too, and turns her the way she travels.
        this.vx *= 0.8;
        this.spin += (-this.vx / r - this.spin) * 0.5;
        this.events.push({ type: 'bounce', speed: speed / r });
      } else this.vy = 0;
    }
    if (this.mode === 'free' && this.y >= floorY - 0.5 && this.vy === 0) {
      // Rolling without slipping: the face turns with the ground.
      this.vx *= Math.exp(-3.2 * h);
      this.spin = -this.vx / r;
      if (Math.abs(this.vx) < r * 0.35) {
        this.restX = this.x; this.restY = this.y; this.vx = 0;
        this.mode = 'rest';
        this.events.push({ type: 'settled' });
        this.continueHop();
        return;
      }
    }
    const left = b.left + r * 1.15, right = b.right - r * 1.15, top = b.top + r * 1.25;
    if (this.x < left || this.x > right) {
      const speed = Math.abs(this.vx);
      this.x = clamp(this.x, left, right);
      this.vx = -this.vx * 0.5;
      if (speed > r * 0.6) this.strainVelocity[0] -= speed / r * 0.3;
      this.spin *= -0.6;
      if (speed > r * 1.5) this.events.push({ type: 'wall', speed: speed / r });
    }
    // The ceiling stops a throw, not an aimed leap (planned under it, or falling in from above it).
    if (this.y < top && this.vy < 0 && !(this.mode === 'air' && this.hopTarget)) { this.y = top; this.vy = -this.vy * 0.4; }
  }

  private settleRoll(h: number, offset: number) {
    // Right herself along the shortest way round, with a wobble. The offset is
    // an act's lean or a whole turn (a twirl): the nearest upright is taken
    // without it, or a turn past half way would aim for the next one.
    const upright = Math.round((this.roll - offset) / (Math.PI * 2)) * Math.PI * 2 + offset;
    this.spin += ((upright - this.roll) * 64 - this.spin * 5.5) * h;
    this.roll += this.spin * h;
    if (Math.abs(this.roll - upright) < 1e-4 && Math.abs(this.spin) < 1e-3) this.roll = offset;
  }

  frame(shiver: number): BodyFrame {
    const r = this.r;
    const [exx, eyy, exy] = this.strain;
    // Shear (lean) about the pivot, then the strain.
    const a = 1 + exx, d = 1 + eyy, b = exy;
    const m00 = a + this.lean * b, m01 = b + this.lean * d, m10 = b, m11 = d;
    const z = 1 / Math.max(0.4, m00 * m11 - m01 * m10);
    const deform = new Float32Array([m00, m10, 0, m01, m11, 0, 0, 0, z]);
    const scale = 1 + Math.sin(this.breath) * 0.006 + this.inflate;
    const hideOffset = this.hide * Math.max(0, this.bounds.hide + r * 0.28 - this.restY);
    let x = this.x + (shiver ? Math.sin(this.clock * Math.PI * 34) * shiver * r * 0.03 : 0);
    let y = this.y + (this.mode === 'rest' || this.mode === 'crouch' ? hideOffset : 0);
    let pivot: [number, number, number] = [0, -REST_HEIGHT * this.contact, 0];
    if (this.held) {
      // Keep the grabbed point exactly under the pointer.
      const c = Math.cos(this.roll), s = Math.sin(this.roll);
      const px = this.held.bx * c - this.held.by * s, py = this.held.bx * s + this.held.by * c;
      pivot = [px, py, 0];
      x = this.held.ax - px * r; y = this.held.ay + py * r;
    }
    const groundY = this.mode === 'air' && this.hopTarget ? this.hopTarget.y + REST_HEIGHT * r
      : this.mode === 'free' || this.mode === 'held' ? this.surfaceUnder(this.x, this.y + REST_HEIGHT * r) : this.restY + REST_HEIGHT * r;
    return {
      x, y, pivot, deform, roll: this.roll, scale, vx: this.vx, vy: this.vy,
      groundX: this.x, groundY, lift: Math.max(0, groundY - REST_HEIGHT * r - this.y), hidden: this.hide, mode: this.mode,
    };
  }
}
