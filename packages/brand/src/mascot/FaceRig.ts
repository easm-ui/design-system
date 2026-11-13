/**
 * The face as a set of continuous channels, the way an animation rig works:
 * an expression is only a target for those channels, so any two expressions
 * blend, an act (an eye roll, a raspberry) can borrow a few channels for a
 * moment, and speech can own the mouth while the eyes keep their mood.
 *
 * The expression set is the EASM mascot expression library v1: 64 poses on four
 * sheets (core emotions, social personality, communication and voice,
 * movement and rest), each tuned against its drawing. Sides are screen sides:
 * `L` is the eye on the visitor's left.
 */
import type { EmoteShape } from './Emotes';

export const CHANNELS = [
  'lidUpL', 'lidUpR', 'lidLowL', 'lidLowR', 'slantL', 'slantR', 'pupil', 'wide', 'wonky',
  'browInL', 'browInR', 'browOutL', 'browOutR',
  'jaw', 'mouthWide', 'round', 'smileL', 'smileR', 'shift', 'press', 'tongue', 'teeth', 'wobble', 'zip',
  'blush', 'tears', 'sweat', 'anger', 'wet', 'inflate', 'tint', 'tilt', 'turn', 'nod',
  'squash', 'tuft', 'gazeX', 'gazeY', 'gazeW',
] as const;
export type Channel = typeof CHANNELS[number];
export type Channels = Record<Channel, number>;
export type PupilShape = 'round' | 'heart' | 'spiral' | 'star';

/** One entry per pose of the library, in sheet order, plus the poses beyond the sheets. */
export const EXPRESSION_SHEETS = [
  { title: 'Core emotions', poses: ['neutral', 'happy', 'delighted', 'laughing', 'sad', 'crying', 'angry', 'rude', 'skeptical', 'surprised', 'shocked', 'afraid', 'worried', 'disappointed', 'confused', 'blushing'] },
  { title: 'Social personality', poses: ['greeting', 'welcoming', 'listening', 'curious', 'thankful', 'proud', 'smug', 'mischievous', 'teasing', 'shy', 'embarrassed', 'flattered', 'impatient', 'ignoring', 'beingIgnored', 'apologetic'] },
  { title: 'Communication and voice', poses: ['thinking', 'concentrating', 'reading', 'writing', 'idea', 'understanding', 'unsure', 'waitingForReply', 'reassuring', 'whispering', 'speakingA', 'speakingE', 'speakingO', 'closedLips', 'zipped', 'unzipping'] },
  { title: 'Movement and rest', poses: ['anticipation', 'takeoff', 'midHop', 'falling', 'landing', 'rebound', 'wobbling', 'dizzy', 'petted', 'ticklish', 'drowsy', 'asleep', 'waking', 'yawning', 'exhausted', 'celebrating'] },
] as const;
/**
 * Beyond the sheets: love, and the moods she lives in beside the chat
 * (owner, 2026-10-24: "she has no other expression… if someone is ignoring
 * her, then she can be rude"): starry eyes, a sulk with puffed cheeks, a
 * sassy chin-up smirk, a daydream.
 */
export const EXTRA_EXPRESSIONS = ['love', 'starstruck', 'sulky', 'sassy', 'dreamy'] as const;
export const EXPRESSIONS = [...EXPRESSION_SHEETS.flatMap(sheet => sheet.poses), ...EXTRA_EXPRESSIONS] as const;
export type Expression = typeof EXPRESSIONS[number];

const INDEX = Object.fromEntries(CHANNELS.map((name, i) => [name, i])) as Record<Channel, number>;

/** Paired channels accept [left, right]; a scalar sets both sides. */
type Pair = number | [number, number];
type Preset = Partial<Record<Channel | 'lidUp' | 'lidLow' | 'slant' | 'browIn' | 'browOut' | 'smile', Pair>> & {
  shape?: PupilShape;
  /** A symbol held while this pose shows (a book for reading). */
  emote?: EmoteShape;
  /** Gaze hint in body radii in front of her: x right, y up. */
  look?: [number, number, number?];
};

const NEUTRAL: Preset = {
  lidUp: 0.94, lidLow: 0, slant: 0, pupil: 1, wide: 0, wonky: 0, browIn: 0, browOut: 0,
  jaw: 0, mouthWide: 0, round: 0, smile: 0.34, shift: 0, press: 0, tongue: 0, teeth: 0, wobble: 0, zip: 0,
  blush: 0, tears: 0, sweat: 0, anger: 0, wet: 0.2, inflate: 0, tint: 0, tilt: 0, turn: 0, nod: 0,
  squash: 0, tuft: 0, gazeX: 0, gazeY: 0, gazeW: 0,
};

/**
 * Hand-tuned against the sheets. Lids: lidUp 1 open → 0 closed; lidLow lifts
 * the lower lid, and both closed with lidLow 1 make the happy ∩ arcs. Slant
 * + tips the upper lid down toward the nose (cross), − away (sad). Brows are
 * fur ridges that only show when they move. `squash` holds a body pose.
 */
const PRESETS: Record<Expression, Preset> = {
  // Core emotions
  neutral: {},
  happy: { smile: 0.95, jaw: 0.3, round: 0.12, lidLow: 0.2, browIn: 0.15, browOut: 0.15, wet: 0.3 },
  delighted: { lidUp: 0, lidLow: 1, smile: 1, jaw: 0.5, teeth: 0.05, browIn: 0.3, browOut: 0.3, blush: 0.15, tilt: 0.04 },
  laughing: { lidUp: [0, 0.05], lidLow: 1, smile: 1, jaw: 0.95, mouthWide: 0.3, teeth: 0.15, tilt: 0.12, nod: -0.08, squash: -0.05, tuft: 0.2 },
  sad: { browIn: 0.8, browOut: -0.3, slant: -0.45, lidUp: 0.8, pupil: 1.25, wet: 0.7, smile: -0.7, press: 0.15, nod: 0.08, tuft: -0.4, tint: -0.18, inflate: -0.03, look: [0, -1.4, 0.6] },
  crying: { browIn: 1, browOut: -0.4, slant: -0.6, lidUp: 0.66, lidLow: 0.25, pupil: 1.3, wet: 1, tears: 1, smile: -1, jaw: 0.6, round: 0.2, wobble: 0.7, tint: -0.18, tuft: -0.5 },
  angry: { browIn: -1.2, browOut: 0.45, slant: 0.85, lidUp: 0.74, lidLow: 0.25, pupil: 0.9, smile: -0.75, press: 0.5, anger: 0.8, tint: 0.45, inflate: 0.06, nod: 0.06, emote: 'anger' },
  rude: { lidUp: [1, 0.48], slant: [-0.1, 0.3], browIn: [0.35, -0.6], browOut: [0.75, 0], smile: [0.15, 0.85], shift: 0.25, tongue: 1, jaw: 0.12, tilt: -0.12 },
  skeptical: { lidUp: [0.55, 0.98], slant: [0.3, 0], browIn: [-0.35, 0.45], browOut: [-0.1, 0.7], smile: -0.35, shift: -0.2, press: 0.4, tilt: 0.08 },
  surprised: { lidUp: 1, lidLow: 0, wide: 0.7, pupil: 0.75, browIn: 0.8, browOut: 0.7, jaw: 0.3, round: 1, smile: 0, squash: 0.06 },
  shocked: { lidUp: 1, lidLow: 0, wide: 1, pupil: 0.55, browIn: 1, browOut: 0.9, jaw: 1, round: 0.5, smile: -0.2, teeth: 0.1, squash: 0.1, tuft: 0.6 },
  afraid: { lidUp: 0.96, wide: 0.5, pupil: 0.7, browIn: 0.9, browOut: -0.3, slant: -0.4, smile: -0.5, wobble: 0.7, jaw: 0.22, round: 0.1, sweat: 0.8, squash: -0.05, tint: -0.1, look: [1.8, 0.3, 0.6], emote: 'sweat' },
  worried: { browIn: [0.85, 0.6], browOut: [-0.2, -0.35], slant: -0.4, lidUp: 0.86, smile: -0.45, press: 0.45, wobble: 0.2, look: [-0.5, -0.5, 0.3] },
  disappointed: { lidUp: 0.55, slant: -0.25, browIn: 0.45, browOut: -0.35, smile: -0.55, press: 0.3, pupil: 1.05, nod: 0.1, tuft: -0.4, inflate: -0.03, look: [0.3, -1.2, 0.6] },
  confused: { browIn: [0.6, -0.35], browOut: [0.65, -0.2], lidUp: [0.98, 0.8], smile: -0.15, shift: 0.35, press: 0.35, wobble: 0.15, tilt: 0.2, look: [1.2, 1.4, 0.6], emote: 'question' },
  blushing: { blush: 1, lidUp: 0.8, lidLow: 0.35, browIn: 0.35, smile: 0.55, press: 0.15, tilt: 0.1, pupil: 1.1, look: [1.6, -0.4, 0.7] },
  // Social personality
  greeting: { smile: 0.9, jaw: 0.38, round: 0.15, lidUp: 1, browIn: 0.35, browOut: 0.35, nod: -0.08, pupil: 1.15, squash: 0.04, tuft: 0.3 },
  welcoming: { smile: 0.85, jaw: 0.22, lidLow: 0.3, lidUp: 0.92, browIn: 0.2, browOut: 0.15, tilt: 0.12, wet: 0.3 },
  listening: { lidUp: 0.98, pupil: 1.2, browIn: 0.25, browOut: 0.2, smile: 0.45, tilt: 0.08, nod: 0.03 },
  curious: { lidUp: 1, pupil: 1.15, browIn: [0.5, -0.05], browOut: [0.55, -0.1], smile: 0.3, round: 0.2, jaw: 0.04, tilt: -0.1, look: [1.5, 1.4, 0.8] },
  thankful: { lidUp: 0, lidLow: 1, smile: 0.7, jaw: 0.06, browIn: 0.3, browOut: 0.1, nod: 0.18, tilt: 0.05 },
  proud: { lidUp: 0.6, lidLow: 0.45, smile: 0.8, press: 0.15, browIn: 0.25, browOut: 0.4, nod: -0.15, inflate: 0.06, squash: 0.06, tuft: 0.5 },
  smug: { lidUp: 0.45, lidLow: 0.25, browIn: [-0.1, 0.2], browOut: [0, 0.45], smile: [0.15, 0.9], shift: 0.25, press: 0.3, tilt: 0.08, nod: -0.06, look: [1.6, 0, 0.6] },
  mischievous: { lidUp: 0.62, lidLow: 0.3, slant: 0.35, browIn: -0.45, browOut: 0.35, smile: [0.7, 0.95], jaw: 0.1, teeth: 0.2, shift: 0.15, tilt: -0.06, look: [1.8, -0.1, 0.7] },
  teasing: { lidUp: [0, 0.95], lidLow: [0.6, 0.1], smile: [0.9, 0.6], tongue: 0.7, jaw: 0.1, shift: 0.1, browIn: [-0.2, 0.4], tilt: 0.12 },
  shy: { lidUp: 0.7, lidLow: 0.35, browIn: 0.4, browOut: -0.1, smile: 0.35, press: 0.3, blush: 0.35, nod: 0.14, tilt: 0.15, pupil: 1.15, squash: -0.06, look: [-1.4, -1, 0.8] },
  embarrassed: { blush: 1, lidUp: 0.85, browIn: 0.55, browOut: -0.15, slant: -0.2, smile: 0.5, jaw: 0.08, teeth: 0.25, wobble: 0.2, shift: 0.1, sweat: 0.3, look: [1.6, -0.6, 0.8] },
  flattered: { blush: 1, lidUp: 1, wide: 0.3, pupil: 1.25, browIn: 0.5, browOut: 0.4, smile: 0.8, jaw: 0.25, round: 0.2, wet: 0.5 },
  impatient: { lidUp: 0.6, lidLow: 0.2, slant: 0.2, browIn: [-0.4, 0.3], browOut: [0, 0.5], smile: -0.3, press: 0.7, round: 0.5, shift: 0.2, tilt: 0.05, anger: 0.2 },
  ignoring: { lidUp: 0.45, lidLow: 0.1, browIn: -0.2, browOut: 0.1, smile: -0.25, press: 0.8, turn: 1.05, nod: -0.1, look: [2.5, 0.4, 1] },
  beingIgnored: { browIn: 0.6, browOut: -0.2, slant: -0.3, lidUp: 0.86, pupil: 1.3, wet: 0.65, smile: 0.1, press: 0.2, tuft: -0.8, nod: 0.05, inflate: -0.04, tint: -0.15, look: [-1.8, 0.6, 0.8] },
  apologetic: { browIn: 0.8, browOut: -0.2, slant: -0.4, lidUp: 0.8, pupil: 1.2, smile: -0.15, press: 0.4, shift: 0.1, nod: 0.2, wobble: 0.15, look: [0, -0.9, 0.4] },
  // Communication and voice
  thinking: { lidUp: 0.9, browIn: [-0.3, 0.45], browOut: [0.05, 0.55], smile: -0.1, shift: 0.5, press: 0.5, round: 0.2, tilt: 0.1, look: [1.6, 1.6, 0.9] },
  concentrating: { lidUp: 0.62, lidLow: 0.3, slant: 0.55, browIn: -0.7, browOut: 0.1, smile: -0.1, press: 0.7, nod: 0.05, look: [0, -0.6, 0.6] },
  reading: { lidUp: 0.72, browIn: 0.1, smile: 0.2, nod: 0.12, look: [0, -2.2, 1], emote: 'book' },
  writing: { lidUp: 0.75, slant: 0.25, browIn: -0.25, tongue: 0.45, shift: 0.3, smile: 0.3, nod: 0.12, look: [0.6, -2.2, 1], emote: 'pencil' },
  idea: { lidUp: 1, wide: 0.5, pupil: 1.25, browIn: 0.7, browOut: 0.7, jaw: 0.2, round: 0.7, smile: 0.5, tuft: 1, squash: 0.05, emote: 'idea' },
  understanding: { lidUp: 0.78, lidLow: 0.35, browIn: 0.15, smile: 0.75, press: 0.1, nod: 0.1, tilt: 0.05 },
  unsure: { browIn: [0.55, -0.2], browOut: [0.2, -0.3], slant: [-0.2, 0], lidUp: 0.9, smile: -0.25, wobble: 0.45, shift: 0.3, tilt: 0.08, look: [1.4, 0.5, 0.5] },
  waitingForReply: { lidUp: 1, pupil: 1.25, browIn: 0.5, browOut: 0.3, smile: 0.35, press: 0.2, nod: -0.03, tilt: -0.06 },
  reassuring: { lidUp: 0.82, lidLow: 0.35, browIn: 0.35, browOut: 0.1, smile: 0.65, tilt: 0.12, wet: 0.25 },
  whispering: { lidUp: 0.9, browIn: 0.3, smile: 0, jaw: 0.1, round: 0.9, mouthWide: -0.4, shift: 0.3, tilt: -0.18, turn: 0.2, look: [1.6, 0.2, 0.6] },
  speakingA: { jaw: 0.75, round: 0.2, smile: 0.3, lidUp: 0.95, browIn: 0.2 },
  speakingE: { jaw: 0.32, mouthWide: 0.9, teeth: 0.7, smile: 0.6, lidUp: 0.95 },
  speakingO: { jaw: 0.35, round: 1, smile: 0, lidUp: 0.97 },
  closedLips: { jaw: 0, press: 0.6, smile: 0.2 },
  zipped: { zip: 1, lidUp: 1, browIn: 0.3, browOut: 0.2 },
  unzipping: { zip: 0.5, smile: 0.5, jaw: 0.1, lidUp: 0.95, browIn: 0.2 },
  // Movement and rest
  anticipation: { squash: -0.38, lidUp: 0.95, smile: 0.3, nod: 0.05, look: [0, 0.4, 0.3] },
  takeoff: { squash: 0.3, lidUp: 1, jaw: 0.3, smile: 0.6, round: 0.2, tuft: -0.3 },
  midHop: { squash: 0.02, lidUp: 1, jaw: 0.25, smile: 0.7 },
  falling: { squash: 0.12, lidUp: 1, wide: 0.3, jaw: 0.15, round: 0.8, smile: -0.2, tuft: 1, look: [0, -1.6, 0.8] },
  landing: { squash: -0.45, lidUp: 0.9, lidLow: 0.2, smile: 0.5, jaw: 0.15 },
  rebound: { squash: 0.22, jaw: 0.3, smile: 0.7, lidUp: 1 },
  wobbling: { lidUp: [0.9, 1], smile: 0.4, jaw: 0.2, tilt: 0.2, wonky: 0.3 },
  dizzy: { wonky: 1, lidUp: [0.85, 1], tilt: 0.2, tongue: 0.4, smile: -0.1, jaw: 0.15, wobble: 0.3, shape: 'spiral', emote: 'star' },
  petted: { lidUp: 0, lidLow: 1, smile: 0.6, squash: -0.12, tuft: -0.6, blush: 0.3 },
  ticklish: { lidUp: 0, lidLow: 1, smile: 1, jaw: 0.6, teeth: 0.1, tilt: 0.15 },
  drowsy: { lidUp: 0.3, lidLow: 0.15, browOut: -0.35, browIn: 0.05, smile: -0.05, jaw: 0.08, round: 0.5, tuft: -0.6, nod: 0.08, squash: -0.05 },
  // A doze, not a pancake (squash -0.25 flattened her): settled a little, head resting to one side, a soft o of a mouth.
  asleep: { lidUp: 0, lidLow: 0.1, smile: 0.12, jaw: 0.06, round: 0.55, squash: -0.07, tuft: -0.5, nod: 0.12, tilt: 0.14, emote: 'z' },
  waking: { lidUp: [0.75, 0], lidLow: [0.1, 0.3], browIn: [0.3, -0.2], smile: -0.1, jaw: 0.1, round: 0.5, tuft: 0.2 },
  yawning: { jaw: 1, round: 0.45, mouthWide: -0.15, lidUp: 0, lidLow: 0.5, squash: 0.1, browIn: 0.4 },
  exhausted: { lidUp: 0.4, slant: -0.15, browIn: 0.2, browOut: -0.4, smile: -0.3, jaw: 0.1, squash: -0.35, tuft: -0.8, inflate: -0.05, tint: -0.15 },
  celebrating: { lidUp: 1, wide: 0.2, pupil: 1.2, smile: 1, jaw: 0.6, round: 0.1, browIn: 0.45, browOut: 0.45, squash: 0.1, tuft: 0.6 },
  // Beyond the sheets
  love: { blush: 0.9, pupil: 1.25, smile: 0.8, jaw: 0.15, lidLow: 0.3, browIn: 0.3, wet: 0.45, tilt: 0.1, shape: 'heart', emote: 'heart' },
  // Star eyes: something exciting (a programme they picked, a form done).
  starstruck: { lidUp: 1, wide: 0.4, pupil: 1.3, browIn: 0.6, browOut: 0.6, jaw: 0.35, round: 0.35, smile: 0.85, blush: 0.3, tuft: 0.7, squash: 0.05, wet: 0.5, shape: 'star', emote: 'sparkle' },
  // Ignored too long: cheeks puffed, lips pressed, looking down and away.
  sulky: { lidUp: 0.62, lidLow: 0.2, slant: -0.15, browIn: 0.5, browOut: -0.2, smile: -0.55, press: 0.75, round: 0.35, inflate: 0.06, shift: 0.2, tilt: -0.08, nod: 0.08, tuft: -0.3, look: [-1.6, -0.6, 0.7] },
  // Sassy: chin up, one brow raised, a lopsided smirk, eyes on the visitor.
  sassy: { lidUp: [0.42, 0.8], lidLow: [0.3, 0.15], browIn: [-0.3, 0.7], browOut: [-0.1, 0.95], smile: [0.05, 0.95], jaw: 0.05, shift: 0.42, press: 0.3, nod: -0.14, tilt: -0.12, look: [0.6, 0.2, 0.5] },
  // A daydream: soft eyes up and to the side, a small smile, head tilted.
  dreamy: { lidUp: 0.55, lidLow: 0.3, browIn: 0.25, browOut: 0.1, smile: 0.6, tilt: 0.14, pupil: 1.25, wet: 0.5, look: [1.2, 1.8, 0.8] },
};

function compile(preset: Preset, base?: Float32Array): Float32Array {
  const values = base ? base.slice() : new Float32Array(CHANNELS.length);
  const pair = (left: Channel, right: Channel, value: Pair | undefined) => {
    if (value === undefined) return;
    const [l, r] = Array.isArray(value) ? value : [value, value];
    values[INDEX[left]] = l; values[INDEX[right]] = r;
  };
  pair('lidUpL', 'lidUpR', preset.lidUp); pair('lidLowL', 'lidLowR', preset.lidLow);
  pair('slantL', 'slantR', preset.slant); pair('browInL', 'browInR', preset.browIn);
  pair('browOutL', 'browOutR', preset.browOut); pair('smileL', 'smileR', preset.smile);
  for (const name of CHANNELS) {
    const value = preset[name];
    if (typeof value === 'number') values[INDEX[name]] = value;
  }
  if (preset.look) {
    values[INDEX.gazeX] = preset.look[0]; values[INDEX.gazeY] = preset.look[1]; values[INDEX.gazeW] = preset.look[2] ?? 1;
  }
  return values;
}

const NEUTRAL_VALUES = compile(NEUTRAL);
const COMPILED = Object.fromEntries(EXPRESSIONS.map(name => [name, compile(PRESETS[name], NEUTRAL_VALUES)])) as Record<Expression, Float32Array>;

/** Response speed per channel (1/s). Lids and mouth are quick, the body slow. */
const SPEED = new Float32Array(CHANNELS.map(name =>
  /^lid|^slant/.test(name) ? 16 : /^brow/.test(name) ? 13 : name === 'pupil' ? 5
    : /^(jaw|mouthWide|round|smile|shift|press|teeth|tongue|zip)/.test(name) ? 18
      : /^gaze/.test(name) ? 9
        : /^(inflate|tint|tilt|turn|nod|squash|tuft)$/.test(name) ? 5 : 7));

export type Override = { values: Partial<Channels>; weight: number };

export class FaceRig {
  /** The smoothed channel values the renderer draws. */
  readonly current = NEUTRAL_VALUES.slice();
  private readonly velocity = new Float32Array(CHANNELS.length);
  private readonly target = new Float32Array(CHANNELS.length);
  private shape: PupilShape = 'round';
  private shapeMix = 0;

  static index(name: Channel) { return INDEX[name]; }
  static preset(name: Expression) { return COMPILED[name]; }
  static shapeOf(name: Expression): PupilShape { return PRESETS[name].shape ?? 'round'; }
  static emoteOf(name: Expression): EmoteShape | undefined { return PRESETS[name].emote; }

  /**
   * Build this frame's target from weighted expressions, then let overrides
   * (acts, speech, the zipper) take channels, and ease every channel toward
   * it with a lightly underdamped spring so brows and lids have a little life.
   */
  update(dt: number, blend: Partial<Record<Expression, number>>, overrides: Override[], reducedMotion: boolean): Channels {
    this.target.set(NEUTRAL_VALUES);
    let total = 0;
    for (const value of Object.values(blend)) total += Math.max(0, value ?? 0);
    const normalise = total > 1 ? 1 / total : 1;
    let strongest: Expression = 'neutral', strongestWeight = 0;
    for (const [name, raw] of Object.entries(blend) as [Expression, number][]) {
      const weight = Math.max(0, raw) * normalise;
      if (!weight) continue;
      const preset = COMPILED[name];
      for (let i = 0; i < CHANNELS.length; i++) this.target[i] += (preset[i] - NEUTRAL_VALUES[i]) * weight;
      if (weight > strongestWeight && PRESETS[name].shape) { strongest = name; strongestWeight = weight; }
    }
    for (const { values, weight } of overrides) {
      if (weight <= 0) continue;
      const w = Math.min(1, weight);
      for (const [name, value] of Object.entries(values) as [Channel, number][]) {
        const i = INDEX[name];
        this.target[i] += (value - this.target[i]) * w;
      }
    }
    const shape = strongestWeight > 0.35 ? FaceRig.shapeOf(strongest) : 'round';
    if (shape !== this.shape) {
      // Fade the old shape out before the new one fades in.
      this.shapeMix = Math.max(0, this.shapeMix - dt * 5);
      if (this.shapeMix === 0) this.shape = shape;
    } else this.shapeMix = Math.min(shape === 'round' ? 0 : 1, this.shapeMix + dt * 4);

    for (let i = 0; i < CHANNELS.length; i++) {
      if (reducedMotion || dt <= 0) { this.current[i] = this.target[i]; this.velocity[i] = 0; continue; }
      // ω = speed, ζ ≈ 0.8: a small overshoot reads as muscle, not interpolation.
      const omega = SPEED[i], zeta = 0.8;
      const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let s = 0; s < steps; s++) {
        this.velocity[i] += ((this.target[i] - this.current[i]) * omega * omega - this.velocity[i] * 2 * zeta * omega) * h;
        this.current[i] += this.velocity[i] * h;
      }
    }
    return this.read();
  }

  read(): Channels {
    return Object.fromEntries(CHANNELS.map((name, i) => [name, this.current[i]])) as Channels;
  }

  pupilShape() { return { shape: this.shape, mix: this.shapeMix }; }
}
