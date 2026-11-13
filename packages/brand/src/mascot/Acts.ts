/**
 * Short performed moments that borrow the face, the eyes and the body for a
 * second or two: a raspberry, an eye roll, a yawn. Each act is a function of
 * normalised time with an envelope, so it always enters and leaves smoothly
 * from whatever expression was showing.
 */
import type { Channels, Expression } from './FaceRig';
import type { EmoteShape } from './Emotes';

export const ACTS = [
  'startle', 'giggle', 'wink', 'celebrate', 'nod', 'headShake', 'lookAround', 'eyeRoll', 'raspberry',
  'hmph', 'pout', 'sigh', 'yawn', 'shiver', 'dizzy',
  // Her moods beside the chat (2026-10-24): sass, boredom, attention-seeking, delight.
  'sideEye', 'fidget', 'hum', 'peek', 'fakeCry', 'sneeze', 'twirl', 'shrug', 'gasp', 'bow',
] as const;
export type ActName = typeof ACTS[number];

export type ActFrame = {
  values: Partial<Channels>;
  weight: number;
  /** Eye direction in head angles (radians) that replaces tracking. */
  gaze?: { yaw: number; pitch: number; weight: number };
  /** Lends an expression's discrete parts (spiral or heart pupils). */
  expression?: Expression;
  body?: { shiver?: number; giggle?: number; stretch?: number; roll?: number };
  tongueWiggle?: number;
};
type ActSpec = {
  duration: number;
  /** Hop height in body radii at the start, if any. */
  hop?: number;
  emotes?: { shape: EmoteShape; count: number };
  frame(t: number, seconds: number, side: number): ActFrame;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const envelope = (t: number, attack = 0.12, release = 0.18) => smooth(0, attack, t) * (1 - smooth(1 - release, 1, t));
const bell = (t: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, t)));

export const ACT_SPECS: Record<ActName, ActSpec> = {
  startle: {
    duration: 0.75, hop: 0.32, emotes: { shape: 'bang', count: 1 },
    frame: t => ({ weight: envelope(t, 0.04, 0.4), values: { wide: 1, lidUpL: 1, lidUpR: 1, lidLowL: 0, lidLowR: 0, pupil: 0.55, browInL: 1, browInR: 1, browOutL: 0.9, browOutR: 0.9, jaw: 0.38, round: 0.92, smileL: 0, smileR: 0 } }),
  },
  giggle: {
    duration: 1.35, emotes: { shape: 'sparkle', count: 2 },
    frame: (t, s) => ({ weight: envelope(t), body: { giggle: envelope(t) }, expression: 'ticklish', values: { lidLowL: 1, lidLowR: 1, lidUpL: 0.7, lidUpR: 0.7, smileL: 1, smileR: 1, jaw: 0.42 + 0.16 * Math.sin(s * 28), teeth: 0.4, browInL: 0.3, browInR: 0.3, blush: 0.5 } }),
  },
  wink: {
    duration: 0.7, emotes: { shape: 'sparkle', count: 1 },
    frame: t => ({ weight: envelope(t, 0.1, 0.3), values: { lidUpR: 0.92 - 0.92 * bell(t * 1.15), lidLowR: 0.6, smileL: 0.95, smileR: 0.6, tongue: 0.35 * bell(t), tilt: 0.1, browOutR: -0.2 } }),
  },
  celebrate: {
    duration: 1.25, hop: 0.9, emotes: { shape: 'sparkle', count: 4 },
    frame: t => ({ weight: envelope(t), values: { lidLowL: 1, lidLowR: 1, lidUpL: 0.72, lidUpR: 0.72, smileL: 1, smileR: 1, jaw: 0.6, teeth: 0.45, browInL: 0.4, browInR: 0.4, browOutL: 0.45, browOutR: 0.45, blush: 0.3 } }),
  },
  nod: {
    duration: 0.95,
    frame: t => ({ weight: envelope(t), values: { nod: 0.16 * Math.sin(t * Math.PI * 4) * bell(t), smileL: 0.6, smileR: 0.6 } }),
  },
  headShake: {
    duration: 1.05,
    frame: t => ({ weight: envelope(t), values: { turn: 0.24 * Math.sin(t * Math.PI * 4.4) * bell(t), press: 0.4, smileL: -0.1, smileR: -0.1 } }),
  },
  lookAround: {
    duration: 2.6,
    frame: t => {
      const yaw = t < 0.33 ? -0.52 : t < 0.68 ? 0.52 : 0;
      return { weight: envelope(t, 0.05, 0.12), gaze: { yaw, pitch: 0.06, weight: envelope(t, 0.05, 0.12) }, values: { browInL: 0.22, browInR: 0.22, lidUpL: 0.96, lidUpR: 0.96, round: 0.25 } };
    },
  },
  eyeRoll: {
    duration: 1.1,
    frame: t => {
      // Over the top from one side to the other: the eyes sweep the upper arc.
      const phase = Math.PI * (-0.12 + 1.24 * smooth(0.05, 0.8, t));
      const w = envelope(t, 0.08, 0.2);
      return { weight: w, gaze: { yaw: 0.5 * Math.cos(phase), pitch: 0.42 * Math.max(Math.sin(phase), -0.1), weight: w },
        values: { lidUpL: 0.66, lidUpR: 0.66, browInL: -0.3, browInR: -0.3, browOutL: 0.15, browOutR: 0.15, smileL: -0.25, smileR: -0.25, press: 0.6, shift: 0.2, nod: t > 0.75 ? 0.08 : -0.04 } };
    },
  },
  raspberry: {
    duration: 1.55,
    frame: t => {
      const blow = smooth(0.12, 0.22, t) * (1 - smooth(0.8, 0.92, t));
      return { weight: envelope(t), body: { shiver: 0.28 * blow }, tongueWiggle: blow, expression: 'rude',
        values: { tongue: 1, jaw: 0.12, round: 0.35, smileL: 0.6, smileR: 0.1, lidUpL: 0.25, lidUpR: 0.82, lidLowL: 0.45, lidLowR: 0.3, browInL: -0.22, browInR: 0.3, tilt: -0.12, shift: 0.15 } };
    },
  },
  hmph: {
    duration: 2.6,
    frame: (t, _s, side) => ({ weight: envelope(t, 0.1, 0.22), expression: 'ignoring', values: { turn: 1.0 * side, gazeX: 2.5 * side, gazeY: 0.4, gazeW: 1, nod: -0.13, lidUpL: 0.06, lidUpR: 0.06, lidLowL: 0.2, lidLowR: 0.2, browInL: -0.45, browInR: -0.45, smileL: -0.42, smileR: -0.42, press: 0.85, shift: -0.3 * side, inflate: 0.05 } }),
  },
  pout: {
    duration: 1.8,
    frame: t => ({ weight: envelope(t), values: { smileL: -0.5, smileR: -0.5, press: 0.8, jaw: 0.04, round: 0.55, browInL: 0.42, browInR: 0.42, slantL: -0.2, slantR: -0.2, inflate: 0.045, shift: 0.1, lidUpL: 0.8, lidUpR: 0.8 } }),
  },
  sigh: {
    duration: 2.1,
    frame: t => {
      const inhale = t < 0.35;
      const breath = inhale ? smooth(0, 0.35, t) : 1 - smooth(0.35, 0.95, t);
      return { weight: envelope(t, 0.08, 0.2), values: inhale
        ? { inflate: 0.07 * breath, lidUpL: 0.8, lidUpR: 0.8, nod: -0.05, browInL: 0.25, browInR: 0.25 }
        : { inflate: -0.07 * (1 - breath), lidUpL: 0.45, lidUpR: 0.45, jaw: 0.12 * bell((t - 0.35) / 0.6), round: 0.55, nod: 0.12, smileL: -0.2, smileR: -0.2, browInL: 0.35, browInR: 0.35 } };
    },
  },
  yawn: {
    duration: 2.5,
    frame: t => {
      const y = Math.pow(bell(t), 1.4);
      return { weight: envelope(t, 0.05, 0.12), body: { stretch: 0.08 * y }, expression: 'yawning', values: { jaw: 0.95 * y, round: 0.45 * y, mouthWide: -0.2 * y, lidUpL: 0.9 - 0.86 * y, lidUpR: 0.9 - 0.86 * y, lidLowL: 0.35 * y, lidLowR: 0.35 * y, browInL: 0.5 * y, browInR: 0.5 * y, browOutL: -0.2 * y, browOutR: -0.2 * y, nod: -0.1 * y, wet: 0.2 + 0.6 * y } };
    },
  },
  shiver: {
    duration: 1.25, emotes: { shape: 'sweat', count: 1 },
    frame: (t, s) => ({ weight: envelope(t), body: { shiver: envelope(t) }, values: { wide: 0.3, sweat: 0.7, smileL: -0.3, smileR: -0.3, wobble: 0.7, jaw: 0.07 + 0.04 * Math.sin(s * 60), teeth: 0.85, browInL: 0.6, browInR: 0.6 } }),
  },
  dizzy: {
    duration: 2.9, emotes: { shape: 'star', count: 3 },
    frame: (t, s) => ({ weight: envelope(t, 0.05, 0.25), expression: 'dizzy', body: { roll: 0.2 * Math.sin(s * 8) * (1 - t) },
      values: { smileL: -0.2, smileR: 0.1, jaw: 0.3, wobble: 0.8, tilt: 0.12 * Math.sin(s * 5) } }),
  },
  sideEye: {
    // Head turned a little away, eyes slid back to the visitor, one brow up: "really?"
    duration: 1.7,
    frame: (t, _s, side) => {
      const w = envelope(t, 0.14, 0.24);
      return { weight: w, expression: 'skeptical', gaze: { yaw: 0.55 * side, pitch: 0.03, weight: w },
        values: { turn: -0.22 * side, lidUpL: 0.5, lidUpR: 0.5, lidLowL: 0.25, lidLowR: 0.25, browInL: -0.25, browInR: 0.35, browOutL: 0, browOutR: 0.6, smileL: -0.1, smileR: 0.35, press: 0.45, shift: 0.2 * side } };
    },
  },
  fidget: {
    // Impatient: little bounces in place and a tut.
    duration: 1.9,
    frame: (t, s) => {
      const w = envelope(t, 0.1, 0.2);
      return { weight: w, expression: 'impatient',
        values: { squash: 0.07 * Math.sin(s * Math.PI * 2 * 3.2) * bell(t), tilt: 0.06 * Math.sin(s * 7), press: 0.6, round: 0.4, smileL: -0.25, smileR: -0.25, browInL: -0.3, browInR: -0.3, lidUpL: 0.7, lidUpR: 0.7 } };
    },
  },
  hum: {
    // Eyes shut, swaying to a tune of her own.
    duration: 2.9, emotes: { shape: 'note', count: 2 },
    frame: (t, s) => ({ weight: envelope(t, 0.12, 0.2),
      values: { lidUpL: 0.12, lidUpR: 0.12, lidLowL: 0.8, lidLowR: 0.8, smileL: 0.6, smileR: 0.6, round: 0.3, jaw: 0.06, tilt: 0.12 * Math.sin(s * 4), nod: 0.04 * Math.sin(s * 8), browInL: 0.2, browInR: 0.2 } }),
  },
  peek: {
    // Ducks down, peeks out with wide eyes, then pops back up with a grin: "boo!"
    duration: 1.9, emotes: { shape: 'sparkle', count: 2 },
    frame: t => {
      const down = smooth(0, 0.18, t) * (1 - smooth(0.52, 0.66, t));
      const pop = smooth(0.52, 0.66, t) * (1 - smooth(0.8, 1, t));
      return { weight: envelope(t, 0.06, 0.18), gaze: { yaw: 0, pitch: 0.08, weight: down },
        values: { squash: -0.28 * down + 0.14 * pop, lidUpL: 1, lidUpR: 1, wide: 0.45 * down, pupil: 1.25, browInL: 0.6 * down, browInR: 0.6 * down, smileL: 0.2 + 0.75 * pop, smileR: 0.2 + 0.75 * pop, jaw: 0.4 * pop, round: 0.6 * pop, tuft: 0.6 * pop } };
    },
  },
  fakeCry: {
    // A dramatic sob, then one eye opens to check whether anyone is looking.
    duration: 3.1,
    frame: (t, s) => {
      const peek = smooth(0.62, 0.72, t);
      return { weight: envelope(t, 0.08, 0.16), expression: 'crying', body: { shiver: 0.22 * (1 - peek) * envelope(t) },
        gaze: { yaw: 0.25, pitch: 0.05, weight: peek * (1 - smooth(0.9, 1, t)) },
        values: { jaw: (0.5 + 0.15 * Math.sin(s * 18)) * (1 - peek) + 0.05 * peek, tears: 1 - peek, wobble: 0.7 * (1 - peek), lidUpR: 0.66 + 0.34 * peek, browInR: 1 - 1.2 * peek, slantR: -0.6 + 0.6 * peek, smileL: -1 + 0.9 * peek, smileR: -1 + 1.3 * peek } };
    },
  },
  sneeze: {
    // "Ah… ah…" with the head back and the eyes squeezing shut, then the sneeze, then a sheepish smile.
    duration: 1.5,
    frame: t => {
      const build = smooth(0, 0.55, t) * (1 - smooth(0.55, 0.6, t));
      const burst = smooth(0.55, 0.6, t) * (1 - smooth(0.62, 0.78, t));
      const after = smooth(0.7, 0.85, t);
      return { weight: envelope(t, 0.06, 0.2), body: { shiver: 0.6 * burst, stretch: 0.06 * build },
        values: { lidUpL: 0.9 - 0.7 * build - 0.2 * burst + 0.2 * after, lidUpR: 0.9 - 0.7 * build - 0.2 * burst + 0.2 * after, browInL: 0.6 * build, browInR: 0.6 * build, jaw: 0.3 * build + 0.1 * burst, round: 0.4 * build, nod: -0.08 * build + 0.15 * burst, inflate: 0.05 * build, squash: 0.18 * burst, blush: 0.4 * after, smileL: 0.5 * after, smileR: 0.5 * after } };
    },
  },
  twirl: {
    // A happy spin where she stands (in the air her roll is her own: a hop would freeze it).
    duration: 1.4, emotes: { shape: 'sparkle', count: 3 },
    frame: (t, _s, side) => ({ weight: envelope(t, 0.08, 0.15), expression: 'delighted', body: { roll: side * Math.PI * 2 * smooth(0.05, 0.8, t) },
      values: { squash: 0.08 * bell(t), lidLowL: 1, lidLowR: 1, lidUpL: 0.2, lidUpR: 0.2, smileL: 1, smileR: 1, jaw: 0.45, teeth: 0.2, tuft: 0.6 } }),
  },
  shrug: {
    // Up and down, brows up, mouth sideways: "meh".
    duration: 1.25,
    frame: t => ({ weight: envelope(t, 0.12, 0.25),
      values: { squash: 0.12 * bell(t * 1.4), browInL: 0.5, browInR: 0.5, browOutL: 0.6, browOutR: 0.6, smileL: 0.2, smileR: -0.1, shift: 0.3, tilt: 0.08, lidUpL: 0.85, lidUpR: 0.85, press: 0.3 } }),
  },
  gasp: {
    // A quick breath in, eyes wide: something just caught her eye.
    duration: 0.95, emotes: { shape: 'sparkle', count: 1 },
    frame: t => ({ weight: envelope(t, 0.05, 0.35),
      values: { wide: 0.6, lidUpL: 1, lidUpR: 1, lidLowL: 0, lidLowR: 0, round: 0.9, jaw: 0.45, browInL: 0.8, browInR: 0.8, browOutL: 0.7, browOutR: 0.7, inflate: 0.05, pupil: 0.8, smileL: 0.1, smileR: 0.1 } }),
  },
  bow: {
    // A small thankful bow, eyes closed in a smile.
    duration: 1.15,
    frame: t => ({ weight: envelope(t, 0.12, 0.25), expression: 'thankful',
      values: { nod: 0.26 * bell(t), lidUpL: 0, lidUpR: 0, lidLowL: 1, lidLowR: 1, smileL: 0.75, smileR: 0.75, blush: 0.25 } }),
  },
};

export class ActPlayer {
  private act: { name: ActName; time: number; side: number } | null = null;

  get playing(): ActName | null { return this.act?.name ?? null; }

  /** Returns the spec so the caller can start its hop and emotes. */
  start(name: ActName, side = 1): ActSpec {
    this.act = { name, time: 0, side: side < 0 ? -1 : 1 };
    return ACT_SPECS[name];
  }

  stop() { this.act = null; }

  update(dt: number): ActFrame | null {
    if (!this.act) return null;
    const spec = ACT_SPECS[this.act.name];
    this.act.time += dt;
    const t = this.act.time / spec.duration;
    if (t >= 1) { this.act = null; return null; }
    return spec.frame(t, this.act.time, this.act.side);
  }
}
