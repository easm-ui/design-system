/**
 * A small, deterministic position-based guide-hair model. The renderer can
 * interpolate many soft ribbon followers from these sparse, groomed guides.
 *
 * This is a reduced model: inextensible strands, approximate bend constraints,
 * elastic groom memory and frictionless spherical skin contact. It is not a
 * full rod, hair-to-hair contact or fluid solver. Coordinates are body-local;
 * the undeformed skin radius is one, +Y is up and +Z faces the visitor.
 */
export type FurVector = [number, number, number];

export type FurGuide = {
  readonly root: FurVector;
  /** Both arrays contain (segments + 1) XYZ nodes, including the fixed root. */
  readonly rest: Float32Array;
  readonly positions: Float32Array;
  readonly length: number;
};

export type FurForces = {
  /** Body-center acceleration, already transformed into character-local space. */
  acceleration: FurVector;
  /** Gravity and wind are local accelerations, in body-radius units / s². */
  gravity: FurVector;
  wind?: FurVector;
  /** Body-local angular velocity in radians/s, with the right-hand convention. */
  angularVelocity?: FurVector;
  /** Body-local angular acceleration in radians/s². */
  angularAcceleration?: FurVector;
  reducedMotion?: boolean;
  /** A surface contact point; strength is zero to one for normal interaction. */
  pet?: { point: FurVector; strength: number };
};

export type FurDynamicsSnapshot = {
  maxRootError: number;
  maxLengthError: number;
  maxPenetration: number;
  /** Mean ½v² over dynamic nodes; unit mass is spread across the entire coat. */
  kineticEnergy: number;
  guideCount: number;
  segments: number;
};

type GuideState = {
  previous: Float32Array;
  segmentLengths: Float32Array;
  bendLengths: Float32Array;
  brush: FurVector;
  /** Multiplies groom memory: the long crown tuft is springier than the coat. */
  stiffness: number;
};

const H = 1 / 120;
const H2 = H * H;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const EPSILON = 1e-9;
const SKIN_RADIUS = 1;
const ITERATIONS = 7;
/** Fixed steps a frame at most (4 × 1/120 s: real time down to 30 fps). */
export const MAX_STEPS = 4;
const VELOCITY_DECAY = Math.exp(-8.5 * H);

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finite = (n: number, fallback = 0) => Number.isFinite(n) ? n : fallback;
const dot = (a: FurVector, b: FurVector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: Float32Array, ai: number, bi: number) => Math.hypot(a[ai] - a[bi], a[ai + 1] - a[bi + 1], a[ai + 2] - a[bi + 2]);

function unit(x: number, y: number, z: number, fallback: FurVector = [0, 1, 0]): FurVector {
  const length = Math.hypot(x, y, z);
  return length > EPSILON && Number.isFinite(length)
    ? [x / length, y / length, z / length]
    : [...fallback];
}

function cross(a: FurVector, b: FurVector): FurVector {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function seededRandom(initial: number) {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function fibonacciPoint(index: number, count: number, phase = 0): FurVector {
  const y = 1 - 2 * (index + 0.5) / count;
  const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * GOLDEN_ANGLE + phase;
  return [Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius];
}

export class FurDynamics {
  readonly guides: FurGuide[] = [];
  readonly segments: number;
  private readonly states: GuideState[] = [];
  private accumulator = 0;
  private quietSteps = 0;
  private sleeping = false;
  private wasReduced = false;
  private previousForces = new Float64Array(15);
  private forcesInitialized = false;

  /**
   * `coat` covers the sphere in short combed locks. `tuft` grows a few long,
   * soft guides from a small cap on the crown that sweep over to one side.
   */
  constructor(options: { guideCount?: number; segments?: number; seed?: number; layout?: 'coat' | 'tuft' } = {}) {
    const count = Math.round(clamp(finite(options.guideCount ?? 240, 240), options.layout === 'tuft' ? 3 : 12, 1000));
    this.segments = Math.round(clamp(finite(options.segments ?? 5, 5), 3, 12));
    const random = seededRandom(finite(options.seed ?? 9417, 9417));
    if (options.layout === 'tuft') { this.growTuft(count, random); return; }
    // Nearby fibers share a comb direction, making soft locks instead of a
    // uniformly radial sea-urchin silhouette. The variation is static grooming.
    const clumps = Array.from({ length: 32 }, (_, i) => ({
      normal: fibonacciPoint(i, 32, 0.83),
      phase: random() * Math.PI * 2,
      length: 0.11 + random() * 0.11,
      turn: (random() - 0.5) * 1.25,
    }));

    for (let i = 0; i < count; i++) {
      const root = fibonacciPoint(i, count);
      let clump = clumps[0];
      let closest = -Infinity;
      for (const candidate of clumps) {
        const similarity = dot(root, candidate.normal);
        if (similarity > closest) { closest = similarity; clump = candidate; }
      }
      const downDot = -root[1];
      const down = unit(-root[0] * downDot, -1 - root[1] * downDot, -root[2] * downDot, [0, 0, 1]);
      const across = unit(...cross(root, down), [1, 0, 0]);
      const comb = unit(
        down[0] * Math.cos(clump.turn) + across[0] * Math.sin(clump.turn),
        down[1] * Math.cos(clump.turn) + across[1] * Math.sin(clump.turn),
        down[2] * Math.cos(clump.turn) + across[2] * Math.sin(clump.turn),
      );
      const side = unit(...cross(root, comb));
      const length = clamp(clump.length * (0.92 + random() * 0.17), 0.10, 0.23);
      const rest = new Float32Array((this.segments + 1) * 3);
      rest.set(root);
      const phase = clump.phase + (random() - 0.5) * 0.6;
      const curl = 0.20 + random() * 0.16;
      const segmentLength = length / this.segments;
      for (let node = 1; node <= this.segments; node++) {
        const t = (node - 0.5) / this.segments;
        // A normal-emerging root bends gradually into a loose tangential curl.
        // This retains an airy undercoat while laying the tips in small locks.
        const outward = 0.96 - t * 0.63;
        const lay = 0.24 + t * 0.76;
        const curlAngle = phase + t * Math.PI * 1.35;
        const direction = unit(
          root[0] * outward + comb[0] * lay + side[0] * Math.sin(curlAngle) * curl,
          root[1] * outward + comb[1] * lay + side[1] * Math.sin(curlAngle) * curl,
          root[2] * outward + comb[2] * lay + side[2] * Math.sin(curlAngle) * curl,
        );
        const p = node * 3;
        rest[p] = rest[p - 3] + direction[0] * segmentLength;
        rest[p + 1] = rest[p - 2] + direction[1] * segmentLength;
        rest[p + 2] = rest[p - 1] + direction[2] * segmentLength;
      }
      const segmentLengths = new Float32Array(this.segments);
      const bendLengths = new Float32Array(this.segments - 1);
      for (let node = 0; node < this.segments; node++) segmentLengths[node] = distance(rest, node * 3, (node + 1) * 3);
      for (let node = 0; node < this.segments - 1; node++) bendLengths[node] = distance(rest, node * 3, (node + 2) * 3);
      this.guides.push({ root, rest, positions: rest.slice(), length });
      this.states.push({ previous: rest.slice(), segmentLengths, bendLengths, brush: comb, stiffness: 1 });
    }
  }

  private growTuft(count: number, random: () => number) {
    const crown = unit(0.06, 1, 0.16);
    const sweep = unit(0.62, 0.05, -0.32);
    for (let i = 0; i < count; i++) {
      // Roots on a small cap, a golden-angle spiral inside 0.3 rad of the crown.
      const angle = i * GOLDEN_ANGLE, spread = 0.42 * Math.sqrt((i + 0.5) / count);
      const tangentA = unit(...cross(crown, [0, 0, 1]));
      const tangentB = unit(...cross(crown, tangentA));
      const root = unit(
        crown[0] + (tangentA[0] * Math.cos(angle) + tangentB[0] * Math.sin(angle)) * spread,
        crown[1] + (tangentA[1] * Math.cos(angle) + tangentB[1] * Math.sin(angle)) * spread,
        crown[2] + (tangentA[2] * Math.cos(angle) + tangentB[2] * Math.sin(angle)) * spread,
      );
      const length = 0.5 + random() * 0.32;
      // Each lock sweeps a little differently, so the tuft has volume.
      const turn = (random() - 0.5) * 1.2;
      const across = unit(...cross(root, sweep));
      const own = unit(
        sweep[0] * Math.cos(turn) + across[0] * Math.sin(turn),
        sweep[1] * Math.cos(turn) + across[1] * Math.sin(turn),
        sweep[2] * Math.cos(turn) + across[2] * Math.sin(turn),
      );
      const side = unit(...cross(root, own));
      const phase = random() * Math.PI * 2;
      const rest = new Float32Array((this.segments + 1) * 3);
      rest.set(root);
      const segmentLength = length / this.segments;
      for (let node = 1; node <= this.segments; node++) {
        const t = (node - 0.5) / this.segments;
        // Up out of the crown, then over to one side in a loose curl.
        const curl = Math.sin(phase + t * 4) * 0.22;
        const direction = unit(
          root[0] * (1.3 - 0.9 * t) + own[0] * (0.05 + 1.05 * t) + side[0] * curl,
          root[1] * (1.3 - 0.9 * t) + own[1] * (0.05 + 1.05 * t) + side[1] * curl,
          root[2] * (1.3 - 0.9 * t) + own[2] * (0.05 + 1.05 * t) + side[2] * curl,
        );
        const p = node * 3;
        rest[p] = rest[p - 3] + direction[0] * segmentLength;
        rest[p + 1] = rest[p - 2] + direction[1] * segmentLength;
        rest[p + 2] = rest[p - 1] + direction[2] * segmentLength;
      }
      const segmentLengths = new Float32Array(this.segments);
      const bendLengths = new Float32Array(this.segments - 1);
      for (let node = 0; node < this.segments; node++) segmentLengths[node] = distance(rest, node * 3, (node + 1) * 3);
      for (let node = 0; node < this.segments - 1; node++) bendLengths[node] = distance(rest, node * 3, (node + 2) * 3);
      this.guides.push({ root, rest, positions: rest.slice(), length });
      this.states.push({ previous: rest.slice(), segmentLengths, bendLengths, brush: own, stiffness: 0.32 });
    }
  }

  reset() {
    this.accumulator = 0;
    this.quietSteps = 0;
    this.sleeping = false;
    this.forcesInitialized = false;
    for (let i = 0; i < this.guides.length; i++) {
      this.guides[i].positions.set(this.guides[i].rest);
      this.states[i].previous.set(this.guides[i].rest);
    }
  }

  /** `budgetMs`: stop stepping once this frame has spent that long (the renderer's; checks run without one). */
  update(dt: number, input: FurForces, budgetMs = Infinity) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (input.reducedMotion) {
      if (!this.wasReduced) this.reset();
      this.wasReduced = true;
      return;
    }
    if (this.wasReduced) { this.wasReduced = false; this.reset(); }

    const acceleration = input.acceleration ?? [0, 0, 0];
    const gravity = input.gravity ?? [0, -2.8, 0];
    const wind = input.wind ?? [0, 0, 0];
    const angularVelocity = input.angularVelocity ?? [0, 0, 0];
    const angularAcceleration = input.angularAcceleration ?? [0, 0, 0];
    const force = new Float64Array(15);
    let change = 0;
    for (let axis = 0; axis < 3; axis++) {
      force[axis] = clamp(finite(acceleration[axis]), -240, 240);
      force[axis + 3] = clamp(finite(gravity[axis]), -240, 240);
      force[axis + 6] = clamp(finite(wind[axis]), -240, 240);
      force[axis + 9] = clamp(finite(angularVelocity[axis]), -14, 14);
      force[axis + 12] = clamp(finite(angularAcceleration[axis]), -180, 180);
    }
    // Bound vector magnitudes as well as individual components. A maximum of
    // 14 rad/s keeps the explicit Coriolis update inside this integrator's
    // damping/stability envelope even for discontinuous pointer input.
    const spinMagnitude = Math.hypot(force[9], force[10], force[11]);
    const angularAccelerationMagnitude = Math.hypot(force[12], force[13], force[14]);
    for (let axis = 0; axis < 3; axis++) {
      if (spinMagnitude > 14) force[axis + 9] *= 14 / spinMagnitude;
      if (angularAccelerationMagnitude > 180) force[axis + 12] *= 180 / angularAccelerationMagnitude;
    }
    for (let axis = 0; axis < force.length; axis++) change += Math.abs(force[axis] - this.previousForces[axis]);
    const brushStrength = clamp(finite(input.pet?.strength ?? 0), 0, 2);
    if (!this.forcesInitialized || change > 0.001 || brushStrength > 0) {
      this.sleeping = false;
      this.quietSteps = 0;
    }
    // While asleep, compare to the forces at the last solved equilibrium so
    // many tiny changes can accumulate enough to wake a slowly turning coat.
    if (!this.sleeping) this.previousForces.set(force);
    this.forcesInitialized = true;
    if (this.sleeping) return;

    // At most MAX_STEPS fixed 120 Hz steps a frame: wall time is kept down to
    // 30 fps, and on a slower frame the coat falls a little behind instead of
    // catching up. A 24-step catch-up made a slow frame slower still, and her
    // leaps stuttered (profiled 2026-10-23: after a click the coat was most
    // of the work). The controller should reset its frame clock after a
    // hidden tab. There is no idle noise force.
    this.accumulator = Math.min(this.accumulator + Math.min(dt, 0.2), H * MAX_STEPS);
    const started = performance.now();
    while (this.accumulator + 1e-10 >= H) {
      this.simulate(force, input.pet?.point, brushStrength);
      this.accumulator -= H;
      // Out of time for this frame (a slow phone): the coat falls a little behind instead of holding the frame up.
      if (performance.now() - started > budgetMs) { this.accumulator = 0; break; }
    }
  }

  private simulate(force: Float64Array, contact: FurVector | undefined, brushStrength: number) {
    const externalX = force[3] + force[6] - force[0];
    const externalY = force[4] + force[7] - force[1];
    const externalZ = force[5] + force[8] - force[2];
    const wx = force[9], wy = force[10], wz = force[11];
    const ax = force[12], ay = force[13], az = force[14];
    let energy = 0;

    for (let index = 0; index < this.guides.length; index++) {
      const guide = this.guides[index];
      const state = this.states[index];
      const p = guide.positions;
      const previous = state.previous;
      const rest = guide.rest;
      let contactWeight = 0;
      let brushX = 0, brushY = 0, brushZ = 0;
      if (contact && brushStrength > 0 && contact.every(Number.isFinite)) {
        const dx = guide.root[0] - contact[0];
        const dy = guide.root[1] - contact[1];
        const dz = guide.root[2] - contact[2];
        const separation = Math.hypot(dx, dy, dz);
        const falloff = Math.max(0, 1 - separation / 0.39);
        contactWeight = falloff * falloff * brushStrength;
        const normalProjection = dx * guide.root[0] + dy * guide.root[1] + dz * guide.root[2];
        const tangent = unit(dx - guide.root[0] * normalProjection, dy - guide.root[1] * normalProjection, dz - guide.root[2] * normalProjection, state.brush);
        brushX = tangent[0] * 145 - guide.root[0] * 35;
        brushY = tangent[1] * 145 - guide.root[1] * 35;
        brushZ = tangent[2] * 145 - guide.root[2] * 35;
      }

      this.anchor(guide, state);
      for (let node = 1; node <= this.segments; node++) {
        const k = node * 3;
        const t = node / this.segments;
        // Coarser rooted fibers resist bending; lighter tips have more freedom.
        // Elastic groom memory supplies a stable rest shape instead of noise.
        const stiffness = (210 + 480 * (1 - t) * (1 - t)) * state.stiffness;
        const contactScale = contactWeight * t * t;
        const px = p[k], py = p[k + 1], pz = p[k + 2];
        const localVX = (px - previous[k]) / H;
        const localVY = (py - previous[k + 1]) / H;
        const localVZ = (pz - previous[k + 2]) / H;
        const vx = localVX * H * VELOCITY_DECAY;
        const vy = localVY * H * VELOCITY_DECAY;
        const vz = localVZ * H * VELOCITY_DECAY;
        const spinPX = wy * pz - wz * py;
        const spinPY = wz * px - wx * pz;
        const spinPZ = wx * py - wy * px;
        // Rotating-frame inertial acceleration, evaluated per node rather
        // than faked with a global breeze: Euler + centrifugal + Coriolis.
        // a_local = ... - α×p - ω×(ω×p) - 2ω×v_local.
        const rotatingX = -(ay * pz - az * py) - (wy * spinPZ - wz * spinPY) - 2 * (wy * localVZ - wz * localVY);
        const rotatingY = -(az * px - ax * pz) - (wz * spinPX - wx * spinPZ) - 2 * (wz * localVX - wx * localVZ);
        const rotatingZ = -(ax * py - ay * px) - (wx * spinPY - wy * spinPX) - 2 * (wx * localVY - wy * localVX);
        previous[k] = p[k]; previous[k + 1] = p[k + 1]; previous[k + 2] = p[k + 2];
        p[k] += vx + (externalX + rotatingX + (rest[k] - px) * stiffness + brushX * contactScale) * H2;
        p[k + 1] += vy + (externalY + rotatingY + (rest[k + 1] - py) * stiffness + brushY * contactScale) * H2;
        p[k + 2] += vz + (externalZ + rotatingZ + (rest[k + 2] - pz) * stiffness + brushZ * contactScale) * H2;
      }

      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        // Two-neighbor chord constraints approximate bending resistance without
        // a brittle per-frame orientation. Stretch is solved last and stiffly.
        for (let node = 0; node < this.segments - 1; node++) {
          this.constrainDistance(p, node, node + 2, state.bendLengths[node], 0.25);
        }
        for (let node = this.segments - 1; node >= 0; node--) {
          this.constrainDistance(p, node, node + 1, state.segmentLengths[node], 1);
        }
        for (let node = 0; node < this.segments; node++) {
          this.constrainDistance(p, node, node + 1, state.segmentLengths[node], 1);
        }
        this.collideWithSkin(guide, state, false);
      }
      this.anchor(guide, state);
      this.collideWithSkin(guide, state, true);

      for (let k = 3; k < p.length; k += 3) {
        if (!Number.isFinite(p[k] + p[k + 1] + p[k + 2])) {
          p.set(rest); previous.set(rest);
          break;
        }
        const vx = (p[k] - previous[k]) / H;
        const vy = (p[k + 1] - previous[k + 1]) / H;
        const vz = (p[k + 2] - previous[k + 2]) / H;
        energy += 0.5 * (vx * vx + vy * vy + vz * vz);
      }
    }

    energy /= this.guides.length * this.segments;
    if (energy < 2e-7 && brushStrength === 0) this.quietSteps++;
    else this.quietSteps = 0;
    if (this.quietSteps > 80) {
      this.sleeping = true;
      for (let i = 0; i < this.guides.length; i++) this.states[i].previous.set(this.guides[i].positions);
    }
  }

  private anchor(guide: FurGuide, state: GuideState) {
    guide.positions.set(guide.root, 0);
    state.previous.set(guide.root, 0);
  }

  private constrainDistance(p: Float32Array, first: number, second: number, restLength: number, stiffness: number) {
    const a = first * 3, b = second * 3;
    const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
    // Math.sqrt, not Math.hypot: this runs ~23,000 times a step, and V8's hypot is several times slower.
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length < EPSILON || !Number.isFinite(length)) return;
    const correction = (length - restLength) / length * stiffness;
    const firstWeight = first === 0 ? 0 : 0.5;
    const secondWeight = first === 0 ? 1 : 0.5;
    p[a] += dx * correction * firstWeight;
    p[a + 1] += dy * correction * firstWeight;
    p[a + 2] += dz * correction * firstWeight;
    p[b] -= dx * correction * secondWeight;
    p[b + 1] -= dy * correction * secondWeight;
    p[b + 2] -= dz * correction * secondWeight;
  }

  private collideWithSkin(guide: FurGuide, state: GuideState, removeInwardVelocity: boolean) {
    const p = guide.positions;
    const previous = state.previous;
    for (let k = 3; k < p.length; k += 3) {
      const radius = Math.sqrt(p[k] * p[k] + p[k + 1] * p[k + 1] + p[k + 2] * p[k + 2]);
      if (radius >= SKIN_RADIUS || !Number.isFinite(radius)) continue;
      const inside = radius > EPSILON;
      const nx = inside ? p[k] / radius : guide.root[0], ny = inside ? p[k + 1] / radius : guide.root[1], nz = inside ? p[k + 2] / radius : guide.root[2];
      const separation = SKIN_RADIUS - radius + 1e-6;
      p[k] += nx * separation; p[k + 1] += ny * separation; p[k + 2] += nz * separation;
      if (removeInwardVelocity) {
        const inward = (p[k] - previous[k]) * nx + (p[k + 1] - previous[k + 1]) * ny + (p[k + 2] - previous[k + 2]) * nz;
        if (inward < 0) {
          previous[k] += inward * nx; previous[k + 1] += inward * ny; previous[k + 2] += inward * nz;
        }
      }
    }
  }

  getSnapshot(): FurDynamicsSnapshot {
    let maxRootError = 0, maxLengthError = 0, maxPenetration = 0, kineticEnergy = 0;
    for (let index = 0; index < this.guides.length; index++) {
      const guide = this.guides[index];
      const state = this.states[index];
      const p = guide.positions;
      maxRootError = Math.max(maxRootError, Math.hypot(p[0] - guide.root[0], p[1] - guide.root[1], p[2] - guide.root[2]));
      for (let node = 1; node <= this.segments; node++) {
        const k = node * 3;
        maxLengthError = Math.max(maxLengthError, Math.abs(distance(p, k - 3, k) - state.segmentLengths[node - 1]));
        maxPenetration = Math.max(maxPenetration, SKIN_RADIUS - Math.hypot(p[k], p[k + 1], p[k + 2]));
        const vx = (p[k] - state.previous[k]) / H;
        const vy = (p[k + 1] - state.previous[k + 1]) / H;
        const vz = (p[k + 2] - state.previous[k + 2]) / H;
        kineticEnergy += 0.5 * (vx * vx + vy * vy + vz * vz);
      }
    }
    return { maxRootError, maxLengthError, maxPenetration, kineticEnergy: kineticEnergy / (this.guides.length * this.segments), guideCount: this.guides.length, segments: this.segments };
  }
}
