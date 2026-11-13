/**
 * Her inner life: a handful of feelings that rise with what the visitor does
 * and fade on their own, and the rules that turn them into a face, a glance,
 * a performed moment or a move. She is curious when you come close, giggles
 * when petted, gets cross when poked again and again, gets bored, then
 * lonely, when the visitor is on the page but ignoring her, falls asleep when
 * nobody is there, and is delighted when they come back. Everything here is
 * deterministic given the random source, so it can be tested.
 *
 * Owner, 2026-10-24: "she has no other expression… she mostly have a
 * predicted pattern. Like if someone is ignoring her, then she can be rude."
 * So she has a temperament for the page view (sassy, dramatic, shy or
 * playful), an idle face that drifts from one small mood to another, whims
 * (a hum, a peek, a fidget, a side-eye…) at irregular times and never the
 * same twice running, and an arc when ignored: bored and fidgeting for
 * attention, then sassy (side-eyes, a hmph, a raspberry), then a sulk, then
 * hiding. Waved away she gets huffier each time; taken up again after that
 * she makes up in her own way ("ab yaad aayi?").
 *
 * 2026-11-10: the sass, the sulk and the hiding need a reason. A visitor who
 * is simply reading the page has done nothing to her, and a pet that blew a
 * raspberry at them after 50 seconds and hid in a sulk after 105 was acting
 * out at someone who had never met her. Left to herself she gets bored,
 * amuses herself and, after a couple of minutes, dozes. She holds a grudge
 * only when her line was waved away, or two of her lines went by unanswered,
 * and drops it when she is taken up or petted.
 */
import type { Expression } from './FaceRig';
import type { ActName } from './Acts';
import type { EmoteShape } from './Emotes';

export const FEELINGS = ['joy', 'affection', 'interest', 'surprise', 'annoyance', 'sadness', 'boredom', 'sleepiness', 'dizziness', 'fear', 'shyness', 'sass'] as const;
export type Feeling = typeof FEELINGS[number];
export type Activity = 'idle' | 'greeting' | 'thinking' | 'writing' | 'listening' | 'speaking';
export type GazeMode = 'pointer' | 'viewer' | 'away' | 'down' | 'idle' | 'up';
export const TEMPERAMENTS = ['sassy', 'dramatic', 'shy', 'playful'] as const;
export type Temperament = typeof TEMPERAMENTS[number];

export type PersonalityContext = {
  /** Pointer relative to her, in body radii, and seconds since it last moved; null when no pointer is known. */
  pointer: { distance: number; speed: number; side: number; still: number } | null;
  /** The visitor has moved, scrolled or typed in the last few seconds. */
  present: boolean;
  held: boolean;
  activity: Activity;
  scrolling: boolean;
  hidden: boolean;
  reducedMotion: boolean;
  /** Her bubble has a line up: the visitor is reading her, so neither ignored nor a time for whims. */
  talking?: boolean;
};
export type Stimulus =
  | { type: 'poke' } | { type: 'pet'; amount: number } | { type: 'grab' } | { type: 'shake'; energy: number }
  | { type: 'release'; speed: number } | { type: 'land'; speed: number } | { type: 'returned'; away: number }
  | { type: 'doubleClick' } | { type: 'pointerLeft' }
  // From the page around her: her line waved away, her line left unanswered, the visitor took her up.
  | { type: 'snubbed' } | { type: 'unanswered' } | { type: 'attended' };
export type PersonalityOutput = {
  blend: Partial<Record<Expression, number>>;
  gaze: GazeMode;
  blinkRate: number;
  blinkSlowness: number;
  acts: ActName[];
  emotes: EmoteShape[];
  sustain: { anger: boolean; sweat: boolean };
  hide: boolean;
  hop: 'attention' | 'popUp' | null;
  /** Where the pointer is for an act that turns away from it. */
  side: number;
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Her whims while idle, by the state she is in, weighted by temperament: never the same twice running.
type Pool = Partial<Record<ActName, number>>;
const WHIMS: Record<'content' | 'bored' | 'sassy' | 'sulky', Pool> = {
  content: { hum: 3, lookAround: 2, peek: 1.2, wink: 1, twirl: 0.6, shrug: 0.6, gasp: 0.6, sneeze: 0.25 },
  bored: { fidget: 3, lookAround: 2, peek: 2.2, hum: 1.2, yawn: 1, sideEye: 0.8, shrug: 1, sneeze: 0.3 },
  sassy: { sideEye: 3, eyeRoll: 2.4, hmph: 2, fidget: 1.6, raspberry: 1.2, pout: 1, shrug: 0.8 },
  sulky: { sigh: 3, pout: 2.4, fakeCry: 1.2, hmph: 1.2, sideEye: 0.8 },
};
const LEANING: Record<Temperament, Pool> = {
  sassy: { sideEye: 1.6, eyeRoll: 1.5, raspberry: 1.6, hmph: 1.3 },
  dramatic: { fakeCry: 2.4, sigh: 1.5, gasp: 1.6, twirl: 1.3 },
  shy: { peek: 1.8, pout: 1.5, raspberry: 0.4, hmph: 0.6, hum: 1.3 },
  playful: { twirl: 1.8, wink: 1.5, peek: 1.4, raspberry: 1.2, sneeze: 1.5 },
};
// Her idle face drifts between small moods; which ones depends on how she feels.
const FLAVOURS: Record<'content' | 'bored' | 'sassy' | 'sulky', Expression[]> = {
  content: ['welcoming', 'understanding', 'listening', 'mischievous', 'proud', 'dreamy', 'curious', 'smug', 'reassuring'],
  bored: ['waitingForReply', 'dreamy', 'thinking', 'unsure', 'curious', 'impatient'],
  sassy: ['sassy', 'smug', 'skeptical', 'impatient', 'mischievous'],
  sulky: ['sulky', 'disappointed', 'beingIgnored'],
};

export class Personality {
  readonly feelings: Record<Feeling, number> = Object.fromEntries(FEELINGS.map(f => [f, 0])) as Record<Feeling, number>;
  /** How she takes things this page view: what she leans to when bored, cross or made up with. */
  readonly temperament: Temperament;
  private readonly random: () => number;
  private clock = 0;
  private ignoredFor = 0;
  private absentFor = 0;
  private pokes: number[] = [];
  private snubs = 0;
  private unanswered = 0;
  /** She has a reason to be cross: waved away, or two lines unanswered, since she was last taken up. */
  private grudge = false;
  private cooldown: Partial<Record<string, number>> = {};
  private queuedActs: ActName[] = [];
  private later: { act: ActName; at: number }[] = [];
  private queuedEmotes: EmoteShape[] = [];
  private queuedHop: PersonalityOutput['hop'] = null;
  private hidesLeft = 2;
  private attentionHopsLeft = 4;
  private glanceUntil = 0;
  private side = 1;
  private wasHidden = false;
  private nextWhim: number;
  private lastAct: ActName | null = null;
  private flavour: { name: Expression; from: number; until: number } | null = null;
  private lastFlavours: Expression[] = [];

  constructor(random: () => number) {
    this.random = random;
    this.feelings.joy = 0.35;
    this.feelings.interest = 0.3;
    // The first draw of a freshly seeded generator leans low: the second picks her temperament.
    random();
    this.temperament = TEMPERAMENTS[Math.floor(random() * TEMPERAMENTS.length)];
    this.nextWhim = 8 + random() * 8;
  }

  /** Fast-forward for the studio: pretend the visitor ignored her for a while. */
  pretendIgnored(seconds: number) { this.ignoredFor = seconds; }
  pretendAbsent(seconds: number) { this.absentFor = seconds; }

  private ready(key: string, seconds: number) {
    if ((this.cooldown[key] ?? -Infinity) > this.clock) return false;
    this.cooldown[key] = this.clock + seconds;
    return true;
  }

  private act(name: ActName, cooldown = 1.2) { if (this.ready(`act:${name}`, cooldown)) { this.queuedActs.push(name); this.lastAct = name; } }

  /** One act after another: two started in the same frame, only the last would play. */
  private then(name: ActName, delay: number) { this.later.push({ act: name, at: this.clock + delay }); }

  /** One of `pool`, weighted, leaning the way her temperament does, never the act she did last. */
  private choose(pool: Pool, not: ActName | null = this.lastAct): ActName | null {
    const lean = LEANING[this.temperament];
    const entries = (Object.entries(pool) as [ActName, number][]).map(([a, w]) => [a, w * (lean[a] ?? 1)] as [ActName, number]).filter(([a, w]) => a !== not && w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.random() * total;
    for (const [a, w] of entries) { roll -= w; if (roll <= 0) return a; }
    return entries[entries.length - 1]?.[0] ?? null;
  }

  /** The state her whims and her idle face come from. */
  private state(): 'content' | 'bored' | 'sassy' | 'sulky' {
    const f = this.feelings;
    if (f.sadness > 0.4) return 'sulky';
    if (f.sass > 0.35) return 'sassy';
    if (f.boredom > 0.45) return 'bored';
    return 'content';
  }

  stimulus(s: Stimulus) {
    const f = this.feelings;
    // Only what the visitor does counts as attention; her own landings do not, and neither does being waved away.
    const byVisitor = s.type !== 'pointerLeft' && s.type !== 'land' && s.type !== 'snubbed' && s.type !== 'unanswered';
    const sore = f.sass > 0.35 || f.sadness > 0.35 || this.ignoredFor > 40;
    if (byVisitor) { this.ignoredFor = 0; this.absentFor = 0; }
    if (f.sleepiness > 0.75 && byVisitor) { f.sleepiness = 0.2; f.surprise = 0.8; this.act('startle', 0.5); }
    switch (s.type) {
      case 'poke': {
        this.pokes = this.pokes.filter(t => this.clock - t < 5);
        this.pokes.push(this.clock);
        const count = this.pokes.length;
        f.surprise = Math.min(1, f.surprise + 0.55);
        f.annoyance = clamp01(f.annoyance + (count <= 1 ? 0.1 : count === 2 ? 0.18 : 0.26));
        f.joy = Math.max(0, f.joy - 0.1 * (count - 1));
        if (count === 1) this.act('startle', 0.8);
        else if (count === 2) this.act('pout', 1.5);
        else if (count === 3) this.act('eyeRoll', 2);
        else if (f.annoyance > 0.85) { this.act('raspberry', 3); this.then('hmph', 1.5); }
        else this.act('raspberry', 2.5);
        break;
      }
      case 'pet':
        f.affection = clamp01(f.affection + s.amount * 0.35);
        f.joy = clamp01(f.joy + s.amount * 0.25);
        f.shyness = clamp01(f.shyness + s.amount * 0.22);
        f.annoyance = Math.max(0, f.annoyance - s.amount * 0.3);
        f.sass = Math.max(0, f.sass - s.amount * 0.5);
        this.grudge = false; this.unanswered = 0;
        if (f.affection > 0.5 && this.ready('hearts', 1.6)) this.queuedEmotes.push('heart');
        if (f.joy > 0.55 && this.random() < 0.5) this.act(this.random() < 0.7 ? 'giggle' : 'hum', 3.5);
        break;
      case 'doubleClick':
        f.joy = clamp01(f.joy + 0.5); f.affection = clamp01(f.affection + 0.2);
        this.act(this.random() < 0.7 ? 'giggle' : 'twirl', 1);
        break;
      case 'grab':
        f.surprise = Math.min(1, f.surprise + 0.45);
        f.interest = clamp01(f.interest + 0.2);
        break;
      case 'shake':
        f.dizziness = clamp01(f.dizziness + s.energy * 0.9);
        f.fear = clamp01(f.fear + s.energy * 0.5);
        break;
      case 'release':
        if (s.speed > 9) { f.joy = clamp01(f.joy + 0.35); f.fear = clamp01(f.fear + 0.25); }
        break;
      case 'land':
        // The harder she comes down, the dizzier: a hard throw sees stars, a toss is fun.
        if (s.speed > 7) f.dizziness = clamp01(f.dizziness + Math.min(0.5, 0.1 + (s.speed - 7) / 45));
        if (f.dizziness > 0.42) { this.act('dizzy', 4); f.dizziness = Math.max(f.dizziness, 0.6); }
        else if (s.speed > 5) { f.joy = clamp01(f.joy + 0.25); this.act('celebrate', 3); }
        break;
      case 'returned':
        if (s.away > 8) {
          f.joy = clamp01(f.joy + 0.6); f.sadness *= 0.3; f.boredom = 0; f.sass *= 0.5;
          this.act(this.choose({ celebrate: 2, twirl: 1, gasp: 1 }) ?? 'celebrate', 5);
        }
        break;
      case 'pointerLeft':
        f.sadness = clamp01(f.sadness + 0.05);
        break;
      case 'snubbed': {
        // Waved away: huffier each time this page view, never the same reaction twice running.
        this.snubs++;
        this.grudge = true;
        f.sass = clamp01(f.sass + 0.22 + 0.1 * Math.min(this.snubs, 3));
        f.joy = Math.max(0, f.joy - 0.12);
        const pool: Pool = this.snubs === 1 ? { pout: 2, shrug: 2, sigh: 1.5, sideEye: 1.2 }
          : this.snubs === 2 ? { sideEye: 2, eyeRoll: 2, hmph: 1.5, pout: 1 }
            : { hmph: 2, raspberry: 2, eyeRoll: 1.2, fakeCry: 0.8 };
        const reaction = this.choose(pool);
        if (reaction) this.act(reaction, 0.3);
        break;
      }
      case 'unanswered':
        // Her line went by with nobody taking it up: a little sass, and now and then a shrug.
        this.unanswered++;
        if (this.unanswered >= 2) this.grudge = true;
        if (this.grudge) f.sass = clamp01(f.sass + 0.1);
        if (this.random() < 0.3) this.act('shrug', 6);
        break;
      case 'attended':
        // Taken up at last. Sore, she makes up in her own way; else a small thank-you now and then.
        if (sore) {
          f.joy = clamp01(f.joy + 0.5);
          if (this.temperament === 'sassy') { this.act('sideEye', 0.5); this.then('giggle', 1.5); }
          else if (this.temperament === 'dramatic') { this.act('gasp', 0.5); this.then('celebrate', 0.9); }
          else if (this.temperament === 'shy') { f.shyness = clamp01(f.shyness + 0.7); this.act('bow', 0.5); }
          else this.act('twirl', 0.5);
        } else if (this.random() < 0.3) this.act(this.random() < 0.5 ? 'bow' : 'wink', 4);
        f.sass *= 0.2; f.sadness *= 0.3; f.boredom = 0;
        this.grudge = false; this.unanswered = 0;
        break;
    }
  }

  update(dt: number, ctx: PersonalityContext): PersonalityOutput {
    this.clock += dt;
    const f = this.feelings;
    const pointer = ctx.pointer;
    if (pointer) this.side = pointer.side;
    const busy = ctx.activity !== 'idle';
    // Hidden below the edge she watches a wider circle for someone coming back.
    const engaged = busy || ctx.held || (!!pointer && pointer.distance < (ctx.hidden ? 5 : 2.6));

    // Ignored means present but paying no attention to her; absent means no one is there.
    // While her bubble has a line up the visitor is reading her: neither.
    if (engaged) {
      if (this.ignoredFor > 30 || (ctx.hidden && this.ready('popUp', 3))) {
        f.joy = clamp01(f.joy + 0.55); f.sadness *= 0.4; f.boredom = 0; f.sass *= 0.5;
        this.act(ctx.hidden ? 'startle' : this.choose({ celebrate: 2, gasp: 1, peek: 1 }) ?? 'celebrate', 4);
        if (ctx.hidden) this.queuedHop = 'popUp';
      }
      this.ignoredFor = 0; this.absentFor = 0;
    } else if (ctx.talking) {
      this.absentFor = 0;
      // Saying something wakes her from a doze.
      if (!this.grudge) this.ignoredFor = Math.min(this.ignoredFor, 60);
    }
    else if (ctx.present) { this.ignoredFor += dt; this.absentFor = 0; }
    else this.absentFor += dt;

    const toward = (key: Feeling, target: number, rate: number) => {
      f[key] += (target - f[key]) * (1 - Math.exp(-dt * rate));
    };
    const ignored = this.ignoredFor;
    toward('surprise', 0, 2.2);
    toward('annoyance', 0, this.pokes.length && this.clock - this.pokes[this.pokes.length - 1] < 3 ? 0.02 : 0.12);
    toward('joy', engaged ? 0.4 : 0.15, 0.12);
    toward('affection', 0, 0.06);
    toward('interest', pointer ? 0.25 + 0.55 * (1 - smoothstep(1, 6, pointer.distance)) : 0.15, 0.8);
    toward('dizziness', 0, 0.28);
    toward('fear', 0, 0.45);
    toward('shyness', 0, 0.3);
    // Left to herself: bored, then dozing. With a grudge: bored, then sassy, then a sulk (and, much later, hiding).
    const cross = this.grudge ? 1 : 0;
    toward('boredom', busy ? 0 : smoothstep(14, 34, ignored) * (1 - smoothstep(40, 60, ignored) * 0.6), 0.5);
    // Sass raised by being waved away fades slowly; ignored, it rises and gives way to the sulk.
    const sassTarget = busy ? 0 : cross * smoothstep(34, 56, ignored) * 0.9 * (1 - smoothstep(72, 92, ignored));
    toward('sass', sassTarget, engaged ? 0.6 : f.sass > sassTarget ? 0.04 : 0.35);
    toward('sadness', busy ? 0 : cross * smoothstep(70, 95, ignored) * 0.85, engaged ? 0.9 : 0.25);
    // Nobody there: asleep. Somebody there who has no need of her: a doze, never a sulk.
    const doze = cross || engaged ? 0 : smoothstep(90, 150, ignored) * 0.6;
    const sleepy = busy ? 0 : ctx.present ? doze : Math.max(doze, smoothstep(30, 80, this.absentFor));
    toward('sleepiness', sleepy, ctx.present ? (sleepy > f.sleepiness ? 0.2 : 3) : 0.15);
    if (pointer && pointer.speed > 14 && pointer.distance < 2.2) f.surprise = Math.min(1, f.surprise + dt * 6);
    if (ctx.held) f.joy = clamp01(f.joy + dt * 0.25);

    // Acts asked to follow another, when their time comes.
    for (let i = this.later.length - 1; i >= 0; i--) if (this.later[i].at <= this.clock) { this.queuedActs.push(this.later[i].act); this.lastAct = this.later[i].act; this.later.splice(i, 1); }

    // Idle performances, each on its own clock.
    if (!busy && !ctx.held) {
      if (f.sleepiness > 0.35 && f.sleepiness < 0.8 && this.ready('yawn', 9 + this.random() * 6)) this.act('yawn', 0);
      if (f.sleepiness > 0.8 && this.ready('z', 1.5)) this.queuedEmotes.push('z');
      // A whim: what she does while nobody asks anything of her, at irregular times.
      if (!ctx.talking && !ctx.scrolling && f.sleepiness < 0.35 && !ctx.hidden && this.clock >= this.nextWhim) {
        const state = this.state();
        const whim = this.choose(WHIMS[state]);
        if (whim && !ctx.reducedMotion) this.act(whim, 0);
        const [lo, hi] = state === 'sassy' ? [7, 14] : state === 'bored' ? [8, 16] : state === 'sulky' ? [10, 18] : [13, 30];
        this.nextWhim = this.clock + lo + this.random() * (hi - lo);
      }
      if (f.boredom > 0.45 && f.sadness < 0.35 && !ctx.reducedMotion && this.attentionHopsLeft > 0 && this.ready('attention', 38 + this.random() * 14)) {
        this.attentionHopsLeft--; this.queuedHop = 'attention';
      }
      if (f.joy > 0.45 && !pointer && f.sleepiness < 0.2 && this.ready('note', 14 + this.random() * 10)) this.queuedEmotes.push('note');
    }

    const hide = !ctx.reducedMotion && !busy && !engaged && !ctx.talking && (ctx.hidden || (this.grudge && f.sadness > 0.72 && this.ignoredFor > 105 && this.hidesLeft > 0));
    if (hide && !this.wasHidden) this.hidesLeft--;
    this.wasHidden = hide;

    const out: PersonalityOutput = {
      blend: this.blend(ctx),
      gaze: this.gazeMode(ctx, pointer),
      blinkRate: 14 - 5 * f.interest + 16 * f.sleepiness + 9 * f.fear + 4 * f.sadness,
      blinkSlowness: 1 + 1.4 * f.sleepiness + 0.4 * f.sadness,
      acts: this.queuedActs.splice(0),
      emotes: this.queuedEmotes.splice(0),
      sustain: { anger: f.annoyance > 0.62, sweat: f.fear > 0.55 },
      hide,
      hop: this.queuedHop,
      side: this.side,
    };
    this.queuedHop = null;
    return out;
  }

  /** Her idle face's small mood of the moment: it fades in, holds a while and gives way to another. */
  private drift(): { name: Expression; weight: number } | null {
    const f = this.feelings;
    if (f.sleepiness > 0.3 || f.dizziness > 0.3 || f.fear > 0.3 || f.surprise > 0.4) return null;
    const state = this.state();
    if (!this.flavour || this.clock > this.flavour.until || !FLAVOURS[state].includes(this.flavour.name)) {
      const pool = FLAVOURS[state].filter(n => !this.lastFlavours.includes(n));
      const name = pool[Math.floor(this.random() * pool.length)] ?? FLAVOURS[state][0];
      this.lastFlavours = [...this.lastFlavours, name].slice(-2);
      this.flavour = { name, from: this.clock, until: this.clock + 10 + this.random() * 14 };
    }
    const { name, from, until } = this.flavour;
    const weight = smoothstep(from, from + 1.6, this.clock) * (1 - smoothstep(until - 1.6, until, this.clock));
    return { name, weight: weight * (state === 'content' ? 0.32 : 0.42) };
  }

  private blend(ctx: PersonalityContext): Partial<Record<Expression, number>> {
    const f = this.feelings;
    switch (ctx.activity) {
      case 'greeting': return { greeting: 1 };
      case 'thinking': return { thinking: 1 };
      case 'writing': return { writing: 1 };
      case 'listening': return { listening: 1 };
      case 'speaking': return { happy: 0.4, listening: 0.2 };
    }
    // Feelings to poses of the expression library.
    const w: Partial<Record<Expression, number>> = {
      happy: f.joy * (1 - f.annoyance) * (1 - f.sadness) * (1 - f.sass) * 0.9,
      delighted: smoothstep(0.62, 0.95, f.joy),
      petted: smoothstep(0.3, 0.6, f.affection) * (1 - smoothstep(0.7, 0.95, f.affection)),
      love: smoothstep(0.7, 0.95, f.affection),
      blushing: f.shyness * 0.85,
      curious: f.interest * 0.5 * (1 - f.joy),
      listening: smoothstep(0.4, 0.8, f.interest) * 0.45,
      surprised: f.surprise,
      impatient: smoothstep(0.18, 0.5, f.annoyance) * (1 - smoothstep(0.55, 0.8, f.annoyance)),
      angry: smoothstep(0.55, 0.9, f.annoyance),
      waitingForReply: f.boredom * (1 - f.sadness) * (1 - f.sass) * 0.9,
      sassy: smoothstep(0.2, 0.55, f.sass) * 0.85,
      skeptical: smoothstep(0.6, 0.9, f.sass) * 0.45,
      beingIgnored: f.sadness * (1 - smoothstep(0.75, 1, f.sadness) * 0.5),
      sulky: smoothstep(0.35, 0.75, f.sadness) * 0.55,
      sad: smoothstep(0.6, 1, f.sadness) * 0.6,
      drowsy: smoothstep(0.25, 0.7, f.sleepiness) * (1 - smoothstep(0.78, 0.95, f.sleepiness)),
      asleep: smoothstep(0.78, 0.95, f.sleepiness),
      dizzy: smoothstep(0.35, 0.7, f.dizziness),
      afraid: smoothstep(0.2, 0.7, f.fear),
    };
    // The drifting small mood, added before the cut so a strong feeling still wins.
    const drift = this.drift();
    if (drift && drift.weight > 0.02) w[drift.name] = Math.max(w[drift.name] ?? 0, drift.weight);
    // Three strongest feelings at most, or the face turns to mush.
    const top = (Object.entries(w) as [Expression, number][]).filter(([, v]) => v > 0.04).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return Object.fromEntries(top);
  }

  private gazeMode(ctx: PersonalityContext, pointer: PersonalityContext['pointer']): GazeMode {
    const f = this.feelings;
    if (ctx.activity === 'thinking') return 'up';
    if (ctx.activity === 'writing') return 'down';
    if (ctx.activity === 'speaking' || ctx.activity === 'listening' || ctx.activity === 'greeting') {
      // In conversation a pointer left where the visitor clicked is not their
      // attention: glancing at it would send her eyes (and a blink with each
      // big shift) to the same empty spot every second or two.
      return pointer && pointer.still < 2 && this.glance(0.25, 2.5) ? 'pointer' : 'viewer';
    }
    if (f.sleepiness > 0.8) return 'down';
    // Sassy: looking pointedly away, with a side glance back now and then.
    if (f.sass > 0.5) return pointer && this.glance(0.35, 3.4) ? 'pointer' : this.glance(0.25, 5) ? 'viewer' : 'away';
    // Sad and shy faces look away, stealing the odd glance.
    if (f.sadness > 0.4 || f.shyness > 0.55) return pointer && this.glance(0.3, 3.2) ? 'pointer' : f.sadness > 0.4 ? 'away' : 'down';
    if (f.boredom > 0.5) return 'idle';
    // A pet watches what moves near it, glances at what moves far off, and
    // looks around (or at you) once it stops. Following the cursor everywhere
    // it went read as a stare (owner, 2026-10-23: "she is constantly following").
    if (!pointer) return this.glance(0.15, 6) ? 'viewer' : 'idle';
    if (pointer.still > 1.4) return this.glance(0.2, 4.5) ? 'viewer' : 'idle';
    if (pointer.distance < 3.5 || pointer.speed > 14) return this.glance(0.75, 3) ? 'pointer' : 'idle';
    return this.glance(0.3, 4) ? 'pointer' : 'idle';
  }

  /** Alternates between a glance and looking elsewhere, by share of time. */
  private glance(share: number, period: number) {
    if (this.clock >= this.glanceUntil) this.glanceUntil = this.clock + period * (0.6 + this.random() * 0.8);
    const phase = (this.glanceUntil - this.clock) / period;
    return phase < share;
  }
}
