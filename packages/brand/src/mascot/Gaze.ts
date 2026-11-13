/**
 * Eyes that move like eyes. Real gaze is not a smooth follow: the eyes jump
 * between fixations in saccades whose duration grows with their size (the
 * "main sequence", about 21 ms + 2.2 ms per degree), track a slowly moving
 * target with smooth pursuit, drift and correct in tiny microsaccades while
 * fixating, and lead the head, which then catches up while the eyes counter-
 * rotate to stay on target (the vestibulo-ocular reflex). Big gaze shifts
 * often come with a blink. A target close to the face makes the eyes
 * converge. When the page scrolls under her, the eyes follow the moving
 * content and snap back (optokinetic nystagmus).
 *
 * Angles are radians. Positive yaw looks to the screen's right, positive
 * pitch looks up. Targets are in body radii relative to the head centre.
 */
export type GazeInput = {
  target: { x: number; y: number } | null;
  /** Act or activity direction for the eyes, in head angles. */
  override?: { yaw: number; pitch: number; weight: number } | null;
  /** Extra head turn requested by expression (hmph, shy). */
  headTurn: number;
  headNod: number;
  /** Content speed under her in radii/s, + when the page content moves up. */
  scroll: number;
  /** Spontaneous blinks per minute. */
  blinkRate: number;
  /** Multiplies blink duration: sleepy blinks are slow. */
  blinkSlowness: number;
  roll: number;
  reducedMotion: boolean;
};
export type EyeAngles = { yaw: number; pitch: number };
export type GazeState = {
  headYaw: number; headPitch: number;
  eyes: [EyeAngles, EyeAngles];
  /** 0 open, 1 closed. */
  blink: number;
  saccading: boolean;
  mode: 'fixating' | 'pursuit' | 'saccade' | 'idle' | 'scrolling';
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const minimumJerk = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
const SCREEN_DEPTH = 2.2;
const EYE_HALF_SPAN = 0.34;
const EYE_HEIGHT = 0.18;

type Saccade = { fromYaw: number; fromPitch: number; toYaw: number; toPitch: number; time: number; duration: number };

export class Gaze {
  private readonly random: () => number;
  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private velocityYaw = 0;
  private velocityPitch = 0;
  private headYaw = 0;
  private headPitch = 0;
  private headVelocityYaw = 0;
  private headVelocityPitch = 0;
  private vergence = 0;
  private saccade: Saccade | null = null;
  private pendingAt = -1;
  private clock = 0;
  private microAt = 1;
  private idleAt = 0;
  private idleYaw = 0;
  private idlePitch = 0;
  private scrollPitch = 0;
  private blinkPhase = -1;
  private blinkDuration = 0.25;
  private nextBlink = 2.5;
  private doubleBlink = false;
  private hadTarget = false;
  private mode: GazeState['mode'] = 'idle';

  constructor(random: () => number) { this.random = random; }

  blink(slowness = 1) {
    if (this.blinkPhase >= 0) return;
    this.blinkPhase = 0;
    this.blinkDuration = 0.25 * slowness;
  }

  update(dt: number, input: GazeInput): GazeState {
    this.clock += dt;
    const previousYaw = this.targetYaw, previousPitch = this.targetPitch;
    let near = 0;

    if (Math.abs(input.scroll) > 0.4) {
      // Slow phase follows the moving content; a fast reset saccade fires
      // once the eyes have travelled far enough (see below).
      this.mode = 'scrolling';
      this.scrollPitch = clamp(this.scrollPitch + input.scroll * 0.55 * dt, -0.5, 0.5);
      this.targetYaw = this.yaw;
      this.targetPitch = this.scrollPitch;
      this.hadTarget = false;
    } else if (input.target) {
      // Bring the target into the head's frame when she is rolled over.
      const c = Math.cos(-input.roll), s = Math.sin(-input.roll);
      const x = input.target.x * c - input.target.y * s;
      const y = input.target.x * s + input.target.y * c;
      this.targetYaw = clamp(Math.atan2(x, SCREEN_DEPTH), -1, 1);
      this.targetPitch = clamp(Math.atan2(y - EYE_HEIGHT, SCREEN_DEPTH), -0.85, 0.85);
      near = 1 - clamp((Math.hypot(x, y - EYE_HEIGHT) - 0.25) / 1.35, 0, 1);
      if (!this.hadTarget) this.pendingAt = this.clock + 0.06;
      this.hadTarget = true;
      this.scrollPitch = this.pitch;
      if (this.mode === 'scrolling' || this.mode === 'idle') this.mode = 'fixating';
    } else {
      // Nobody to look at: wander between the visitor and the page.
      this.hadTarget = false;
      this.scrollPitch = this.pitch;
      if (this.clock >= this.idleAt) {
        const pick = this.random();
        this.idleYaw = pick < 0.55 ? 0 : pick < 0.85 ? (this.random() - 0.5) * 1.0 : (this.random() - 0.5) * 0.6;
        this.idlePitch = pick < 0.55 ? 0 : pick < 0.85 ? (this.random() - 0.5) * 0.4 : -0.25 - this.random() * 0.15;
        this.idleAt = this.clock + 1.2 + this.random() * 2.6;
      }
      this.targetYaw = this.idleYaw;
      this.targetPitch = this.idlePitch;
      this.mode = this.saccade ? 'saccade' : 'idle';
    }

    // Target velocity, filtered, drives pursuit and saccade prediction.
    if (dt > 0) {
      const a = 1 - Math.exp(-dt * 18);
      this.velocityYaw += ((this.targetYaw - previousYaw) / dt - this.velocityYaw) * a;
      this.velocityPitch += ((this.targetPitch - previousPitch) / dt - this.velocityPitch) * a;
    }
    this.vergence += (Math.atan2(EYE_HALF_SPAN, 0.55 + (1 - near) * 6) - this.vergence) * (1 - Math.exp(-dt * 10));

    if (this.saccade) {
      const s = this.saccade;
      s.time += dt;
      const t = minimumJerk(clamp(s.time / s.duration, 0, 1));
      this.yaw = s.fromYaw + (s.toYaw - s.fromYaw) * t;
      this.pitch = s.fromPitch + (s.toPitch - s.fromPitch) * t;
      if (s.time >= s.duration) { this.saccade = null; this.microAt = this.clock + 0.6 + this.random() * 1.4; }
    } else {
      const errorYaw = this.targetYaw - this.yaw, errorPitch = this.targetPitch - this.pitch;
      const error = Math.hypot(errorYaw, errorPitch);
      const speed = Math.hypot(this.velocityYaw, this.velocityPitch);
      if (this.mode === 'scrolling') {
        this.yaw += errorYaw * Math.min(1, dt * 6);
        this.pitch += errorPitch * Math.min(1, dt * 8);
        if (Math.abs(this.pitch) > 0.3) {
          this.startSaccade(this.yaw, -Math.sign(this.pitch) * 0.12, input);
          this.scrollPitch = -Math.sign(this.pitch) * 0.12;
        }
      } else if (input.reducedMotion) {
        this.yaw = this.targetYaw; this.pitch = this.targetPitch;
      } else if (error > 0.075 && this.pendingAt < 0) {
        // Saccadic latency: the eyes commit about a tenth of a second later.
        this.pendingAt = this.clock + 0.07 + this.random() * 0.06;
      } else if (this.pendingAt >= 0 && this.clock >= this.pendingAt) {
        this.pendingAt = -1;
        const lead = 0.06;
        this.startSaccade(this.targetYaw + this.velocityYaw * lead, this.targetPitch + this.velocityPitch * lead, input);
      } else if (this.pendingAt < 0 && speed > 0.05 && speed < 2.4) {
        // Smooth pursuit runs a little below target speed; catch-up
        // saccades cover the slip when it builds up. A jump is not motion:
        // while a saccade is pending the eyes hold still.
        this.mode = 'pursuit';
        this.yaw += (this.velocityYaw * 0.88 + errorYaw * 2.2) * dt;
        this.pitch += (this.velocityPitch * 0.88 + errorPitch * 2.2) * dt;
      } else {
        if (this.mode !== 'idle') this.mode = 'fixating';
        this.yaw += errorYaw * Math.min(1, dt * 1.6);
        this.pitch += errorPitch * Math.min(1, dt * 1.6);
        if (this.clock >= this.microAt) {
          const angle = this.random() * Math.PI * 2, size = 0.012 + this.random() * 0.018;
          this.startSaccade(this.yaw + Math.cos(angle) * size, this.pitch + Math.sin(angle) * size, input, true);
        }
      }
    }

    // The head follows where the eyes went, lagging behind them.
    const headTargetYaw = input.reducedMotion ? 0 : clamp(this.yaw * 0.55, -0.42, 0.42) + input.headTurn;
    const headTargetPitch = input.reducedMotion ? 0 : clamp(this.pitch * 0.45, -0.3, 0.3) - input.headNod;
    const omega = 6.5, zeta = 0.85;
    this.headVelocityYaw += ((headTargetYaw - this.headYaw) * omega * omega - this.headVelocityYaw * 2 * zeta * omega) * dt;
    this.headVelocityPitch += ((headTargetPitch - this.headPitch) * omega * omega - this.headVelocityPitch * 2 * zeta * omega) * dt;
    this.headYaw += this.headVelocityYaw * dt;
    this.headPitch += this.headVelocityPitch * dt;

    let eyeYaw = clamp(this.yaw - this.headYaw, -0.62, 0.62);
    let eyePitch = clamp(this.pitch - this.headPitch, -0.5, 0.5);
    if (input.override && input.override.weight > 0) {
      const w = Math.min(1, input.override.weight);
      eyeYaw += (input.override.yaw - eyeYaw) * w;
      eyePitch += (input.override.pitch - eyePitch) * w;
    }
    const vergence = this.mode === 'scrolling' ? 0 : this.vergence;

    return {
      headYaw: this.headYaw, headPitch: this.headPitch,
      eyes: [{ yaw: eyeYaw + vergence, pitch: eyePitch }, { yaw: eyeYaw - vergence, pitch: eyePitch }],
      blink: this.updateBlink(dt, input),
      saccading: !!this.saccade,
      mode: this.saccade ? 'saccade' : this.mode,
    };
  }

  private startSaccade(toYaw: number, toPitch: number, input: GazeInput, micro = false) {
    const amplitude = Math.hypot(toYaw - this.yaw, toPitch - this.pitch);
    const degrees = amplitude * 57.2958;
    this.saccade = {
      fromYaw: this.yaw, fromPitch: this.pitch,
      toYaw: clamp(toYaw, -1.05, 1.05), toPitch: clamp(toPitch, -0.9, 0.9),
      time: 0, duration: clamp(0.021 + 0.0022 * degrees, micro ? 0.02 : 0.03, 0.12),
    };
    // Large gaze shifts are often accompanied by a blink.
    if (!micro && degrees > 22 && this.random() < 0.55) this.blink(input.blinkSlowness);
  }

  private updateBlink(dt: number, input: GazeInput) {
    if (this.blinkPhase < 0 && this.clock >= this.nextBlink) this.blink(input.blinkSlowness);
    if (this.blinkPhase < 0) return 0;
    this.blinkPhase += dt / this.blinkDuration;
    // A lid closes in about 30% of the blink and reopens more slowly.
    const p = this.blinkPhase;
    const value = p < 0.3 ? Math.sin((p / 0.3) * Math.PI / 2) ** 2 : p < 0.42 ? 1 : 1 - minimumJerk(clamp((p - 0.42) / 0.58, 0, 1));
    if (p >= 1) {
      this.blinkPhase = -1;
      if (this.doubleBlink) { this.doubleBlink = false; this.nextBlink = this.clock + 0.09; }
      else {
        const mean = 60 / Math.max(2, input.blinkRate);
        this.nextBlink = this.clock + clamp(-Math.log(1 - this.random()) * mean, 0.9, 10);
        this.doubleBlink = this.random() < 0.12;
      }
    }
    return value;
  }
}
