// The animated EASM icon (logo v6 Junction) for the app: one engine, twelve states, every frame computed from the clock.
//
// One grammar runs through every state, so each motion means something:
//   the core is EASM · a rail is a system (or, in the voice states, the channel to the person) · orange light inside a
//   rail is information moving. Light running out from the core: EASM reaching out (a request, an answer). Light running
//   in toward the core: something arriving (a reply, the user's voice). A rail that docks (moves in to the core) is in
//   use. The core turning is EASM thinking; the core glowing is EASM's voice, and nothing else; an empty core is EASM
//   without a connection.
// The right-hand rail carries EASM's answers; the left-hand rail is the user's (their voice, their turn).
// States change by blending the old motion into the new one (both keep moving), so nothing ever snaps.

import { clamp, lerp, smooth, ease, keys, bump, frac, mixHex, spring } from './math';
import { V6, RAIL_LINE, ORANGE, INK, PAPER, ORANGE_GLOW, motionOff, reducedMotionQuery, watchMotionSwitch, latestIntersection, nameSvg } from './brand';
import { escapeMarkup } from './markup';
import { ICON_LABELS } from './meta';
import { voiceAt } from './voice';
import { levelReader, type LevelInput, type LevelMeterOptions } from './audio';

export type IconState =
  | 'idle' | 'connecting' | 'listening' | 'thinking' | 'searching' | 'toolCalling'
  | 'writing' | 'speaking' | 'awaiting' | 'done' | 'error' | 'offline';
export type Theme = 'light' | 'dark';

/** Every state, in the order a conversation meets them. */
export const ICON_STATES: readonly IconState[] = ['idle', 'connecting', 'listening', 'thinking', 'searching', 'toolCalling', 'writing', 'speaking', 'awaiting', 'done', 'error', 'offline'];

/** Seconds. Loops repeat at these periods; `done` and `error` play once and end on the still mark. */
export const ICON_TIMING = {
  blend: 0.5,
  blendOneShot: 0.28, // a change into done or error (an event) takes over faster than a change of activity
  connecting: 1.6,  // one docking wave round the circle; the core fills and empties once
  thinking: 1.5,    // the core turns a quarter (the loop is seamless: the square looks the same every 90°)
  searching: 1.8,   // one sweep round the six rails
  toolCall: 1.6,    // one call; the loop visits all six systems (9.6 s)
  writing: 3.6,     // five strokes at an uneven, natural cadence
  awaiting: 2.4,    // one breath
  done: 1.25,
  error: 1.5,
} as const;

/** States that play once, then rest on the still mark (and call onComplete). */
export const ONE_SHOT: ReadonlySet<IconState> = /* @__PURE__ */ new Set<IconState>(['done', 'error']);
/** States with no motion of their own: the engine stops once the blend into them is over. */
const STILL: ReadonlySet<IconState> = /* @__PURE__ */ new Set<IconState>(['idle', 'offline']);

/** Light inside a rail: from a to b (0 = the end at the core, 1 = the outer tip), at intensity i (its width). */
interface Seg { a: number; b: number; i: number }
/** d: how far the rail has moved along its axis, in grid units (negative = in toward the core: docked).
 *  dim: 0 = full contrast, 1 = faded back (offline). */
interface RailPose { d: number; dim: number; l: Seg[] }
/** hole: 0 = a solid core, 1 = an empty one (only its outline). */
export interface IconPose { rails: RailPose[]; rot: number; scale: number; glow: number; hole: number }

const LIGHTS = 3;                 // light elements per rail (a blend can show an outgoing and an incoming light at once)
const DOCK = 2.4;                 // how far a rail in use moves in toward the core
const ANSWER = 0, ASK = 3;        // the right-hand and left-hand rails
const CALL_ORDER = [0, 3, 1, 4, 2, 5];       // tool calls visit systems across the circle, never neighbours in a row
const STROKES = [0, 0.74, 1.38, 2.3, 2.92];  // writing: when each stroke leaves, within the 3.6 s loop
const T = ICON_TIMING;
const TAU = Math.PI * 2;

const pose0 = (): IconPose => ({ rails: [0, 1, 2, 3, 4, 5].map(() => ({ d: 0, dim: 0, l: [] })), rot: 0, scale: 1, glow: 0, hole: 0 });

/** The fraction of a rail its round cap takes: a light shorter than this is drawn as a dot. */
const CAP = V6.rw / (V6.r1 - V6.r0);
/** A light from a to b. Shorter than a cap, it is a dot that swells as it grows: lights are born and die as points,
 *  never by fading (orange fading over ink would read as brown). */
const lit = (a: number, b: number, k = 1): Seg => ({ a, b, i: k * smooth((b - a) / (CAP * 0.9)) });
/** A light that leaves the core, runs the rail and leaves at the tip, for u from 0 to 1: the head sets off from rest
 *  and the tail follows, so the light is a stroke that grows, travels and shrinks away. */
function stroke(u: number, tailLag = 0.3): Seg {
  const head = ease.soft(clamp(u / (1 - tailLag * 1.4))), tail = ease.io(clamp((u - tailLag) / (1 - tailLag)));
  return lit(tail, head);
}

// ── the states ────────────────────────────────────────────────────────────────────────────────────────────────────

function connecting(t: number): IconPose {
  // EASM coming online: the rails reach in and plug into the core one after another, clockwise, while the empty core
  // fills and empties again
  const p = pose0(), ph = t / T.connecting;
  p.rails.forEach((r, k) => { r.d = -DOCK * bump(ph - k / 6, 0.2); });
  // (the centre never shrinks to a speck: it swells from a small square to three quarters of the core and back)
  p.hole = 0.25 + 0.45 * (0.5 + 0.5 * Math.cos(TAU * ph));
  return p;
}

function thinking(t: number): IconPose {
  // the core turns without stopping, quickening and easing on every quarter (it breathes as it turns); as each corner
  // points at a rail the rail eases outward, as if the corner brushed it
  const p = pose0(), b = t / T.thinking;
  p.rot = 90 * (b - (0.58 / TAU) * Math.sin(TAU * b));
  p.rails.forEach((r, k) => {
    // the angle between this rail and the nearest corner, 0–45°
    const a = (((60 * k - p.rot - 45) % 90) + 90) % 90, off = Math.min(a, 90 - a);
    r.d = 1.25 * Math.cos(clamp(off / 32) * Math.PI / 2) ** 2;
  });
  p.scale = 1 - 0.025 * (0.5 - 0.5 * Math.cos(TAU * b));
  return p;
}

function searching(t: number): IconPose {
  // a sweep: clockwise, each rail in turn sends a light out of the core to its tip, reaching into a source, and the
  // rail reaches out with it; three lights are under way at once, so the sweep reads as one continuous motion
  const p = pose0(), ph = t / T.searching, life = 0.5;
  p.rails.forEach((r, k) => {
    const x = frac(ph - k / 6);
    if (x >= life) return;
    const u = x / life;
    r.l.push(stroke(u));
    r.d = 0.9 * Math.sin(Math.PI * u) ** 2;
  });
  return p;
}

function callOn(p: IconPose, rail: number, u: number): void {
  // one tool call, u from 0 to ~1.1: the system's rail docks; the request fills it out to the tip; it holds while the
  // system works; the reply drains back into the core, which takes it in; the rail lets go
  const r = p.rails[rail];
  r.d = Math.min(r.d, -DOCK * keys(u, [[0, 0], [0.16, 1], [0.8, 1], [1.08, 0]]));
  if (u > 0.08 && u < 0.86) {
    const head = u < 0.5 ? ease.soft(clamp((u - 0.08) / 0.32)) : 1 - ease.io(clamp((u - 0.56) / 0.3));
    r.l.push(lit(0, head));
  }
  p.scale *= keys(u, [[0.78, 1], [0.9, 1.075], [1.08, 1]]);
}

function toolCalling(t: number): IconPose {
  const p = pose0(), c = t / T.toolCall, n = Math.floor(c), u = c - n;
  callOn(p, CALL_ORDER[n % 6], u);
  if (n > 0) callOn(p, CALL_ORDER[(n - 1) % 6], u + 1);  // the last call's rail is still letting go
  return p;
}

function writing(t: number): IconPose {
  // a text answer streaming out: the answer rail docks and strokes of light leave the core along it at the uneven
  // cadence of writing; the core nudges as each one goes
  const p = pose0(), r = p.rails[ANSWER], x = ((t % T.writing) + T.writing) % T.writing;
  r.d = -1.6;
  for (const s of STROKES) for (const w of [x - s, x - s + T.writing]) {
    const u = w / 0.6;
    if (u < 0 || u > 1) continue;
    r.l.push(stroke(u, 0.28));
    p.scale *= 1 + 0.03 * Math.sin(Math.PI * clamp(u / 0.34)) ** 2;
  }
  return p;
}

function speaking(lvl: number, fill: number): IconPose {
  // EASM's voice: the core glows with it, and the voice runs out along the answer rail as far as it is loud
  const p = pose0(), r = p.rails[ANSWER];
  p.glow = lvl;
  p.scale = 1 + 0.045 * lvl;
  r.d = -1.6;
  r.l.push(lit(0, 0.17 + 0.83 * fill));
  return p;
}

function listening(lvl: number, fill: number): IconPose {
  // the user's voice: it pours in along their rail from the tip toward the core, as far as it is loud; the core
  // listens (it never glows: the glow is EASM's voice only)
  const p = pose0(), r = p.rails[ASK];
  p.scale = 1 + 0.03 * lvl;
  r.d = -1.6;
  r.l.push(lit(1 - (0.17 + 0.83 * fill), 1));
  return p;
}

function awaiting(t: number): IconPose {
  // over to you: EASM has asked something (a confirmation, a choice, a missing detail) and waits; the user's rail
  // stays lit and the whole mark breathes slowly
  const p = pose0(), br = 0.5 - 0.5 * Math.cos((TAU * t) / T.awaiting);
  p.rails[ASK].l.push({ a: 0, b: 1, i: 1 - 0.3 * br });
  p.scale = 1 - 0.045 * br;
  return p;
}

function done(t: number): IconPose {
  // a task finished (plays once): light fills every rail in turn round the circle, then all of it drains back into the
  // core together, which takes it in with one beat and comes to rest as the still mark
  const p = pose0();
  p.rails.forEach((r, k) => {
    const s = 0.05 * k, head = ease.soft(clamp((t - s) / 0.36)) * (1 - ease.io(clamp((t - 0.64) / 0.3)));
    if (t > s && t < 0.95) r.l.push(lit(0, head));
    r.d = -1.2 * keys(t, [[s, 0], [s + 0.24, 1], [0.8, 1], [1.12, 0]]);
  });
  p.scale = keys(t, [[0.84, 1], [0.97, 1.1], [1.25, 1]]);
  return p;
}

function error(t: number): IconPose {
  // a task failed (plays once): a request sets out along the answer rail, gets halfway and falls back; the rail comes
  // away from the core; the core empties (nothing came back), then fills again and rests as the still mark
  const p = pose0(), r = p.rails[ANSWER];
  const head = t < 0.38 ? 0.56 * ease.soft(clamp(t / 0.38)) : 0.56 * (1 - ease.io(clamp((t - 0.42) / 0.28)));
  if (t < 0.72) r.l.push(lit(0, head));
  r.d = 2.6 * keys(t, [[0.4, 0], [0.58, 1], [0.96, 1], [1.46, 0]]);
  p.hole = keys(t, [[0.42, 0], [0.64, 1], [1.02, 1], [1.42, 0]]);
  return p;
}

function offline(): IconPose {
  // no connection: the core is empty and the rails fall back
  const p = pose0();
  p.hole = 1;
  p.rails.forEach(r => { r.dim = 1; });
  return p;
}

function blendPose(a: IconPose, b: IconPose, w: number, rotShift: number): IconPose {
  const p = pose0();
  p.rails.forEach((r, k) => {
    const ra = a.rails[k], rb = b.rails[k];
    r.d = lerp(ra.d, rb.d, w);
    r.dim = lerp(ra.dim, rb.dim, w);
    // each outgoing light thins away where it is while each incoming one swells where it is: no light ever jumps
    r.l = ra.l.map(s => ({ a: s.a, b: s.b, i: s.i * (1 - w) })).concat(rb.l.map(s => ({ a: s.a, b: s.b, i: s.i * w })));
  });
  // the square core looks the same every 90°: the incoming rotation is shifted by whole quarter turns (chosen once, when
  // the blend starts) to land nearest to where the outgoing one is heading, so the core never turns back
  p.rot = lerp(a.rot, b.rot + rotShift, w);
  p.scale = lerp(a.scale, b.scale, w);
  p.glow = lerp(a.glow, b.glow, w);
  p.hole = lerp(a.hole, b.hole, w);
  return p;
}

// ── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The SVG nodes an engine drives (created by the React component or by mountIcon()). */
export interface IconParts {
  svg: SVGSVGElement;
  bloom: SVGRectElement;
  core: SVGGElement;
  coreRing: SVGPathElement;      // the core's outline (what is left when it empties)
  coreFill: SVGRectElement;      // the core's centre, which shrinks away when it empties
  rails: SVGGElement[];          // one per rail, translated along its own axis
  railLines: SVGLineElement[];   // the rails themselves (their colour follows the theme)
  lights: SVGLineElement[][];    // LIGHTS light lines per rail
}

/** Rails are ink on light surfaces and paper on dark ones; the core is always signature orange. */
export const railColor = (theme: Theme): string => (theme === 'dark' ? PAPER : INK);
const GLOW_CORE = ORANGE_GLOW;  // the core at the top of a syllable: signature orange, lit from within

const f3 = (v: number) => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3));

function renderPose(parts: IconParts, p: IconPose, theme: Theme): void {
  const L = RAIL_LINE.x2 - RAIL_LINE.x1, span = V6.r1 - V6.r0, half = V6.rw / 2;
  p.rails.forEach((r, k) => {
    parts.rails[k].setAttribute('transform', `translate(${f3(r.d)} 0)`);
    parts.railLines[k].setAttribute('opacity', f3(1 - 0.7 * smooth(r.dim)));
    // at most LIGHTS lights per rail: if a blend asks for more, the faintest go first
    const segs = r.l.length > LIGHTS ? r.l.slice().sort((x, y) => y.i - x.i).slice(0, LIGHTS) : r.l;
    for (let n = 0; n < LIGHTS; n++) {
      const el = parts.lights[k][n], s = segs[n];
      // a light is always fully orange: it appears and goes by swelling from, and thinning back to, a point or a line
      // along the rail's centre (never by transparency)
      const wv = s ? smooth(s.i) : 0;
      if (wv < 0.015) { el.setAttribute('opacity', '0'); continue; }
      let c0 = V6.r0 + s.a * span + half, c1 = V6.r0 + s.b * span - half;
      if (c1 < c0) c0 = c1 = (c0 + c1) / 2;
      // keep the dash a hair inside the line: a dash that starts exactly at its end is not drawn at all
      c0 = clamp(c0 - V6.r0 - half, 0, L - 0.02); c1 = clamp(c1 - V6.r0 - half, 0, L - 0.02);
      el.setAttribute('stroke-dasharray', `${Math.max(0.01, c1 - c0).toFixed(3)} 99`);
      el.setAttribute('stroke-dashoffset', f3(-c0));
      el.setAttribute('stroke-width', (7.36 * wv).toFixed(3));
      el.setAttribute('opacity', '1');
    }
  });
  const g = clamp(p.glow, 0, 1), rot = ((p.rot % 90) + 90) % 90;
  const at = (s: number) => `rotate(${f3(rot)} 32 32) translate(32 32) scale(${s.toFixed(4)}) translate(-32 -32)`;
  parts.core.setAttribute('transform', at(p.scale));
  const fill = g > 0.002 ? mixHex(ORANGE, GLOW_CORE, Math.pow(g, 0.8)) : ORANGE;
  parts.coreRing.setAttribute('fill', fill);
  parts.coreFill.setAttribute('fill', fill);
  // emptying: the centre contracts to nothing inside the outline (and grows back out to fill it)
  parts.coreFill.setAttribute('transform', `translate(32 32) scale(${(1 - clamp(p.hole)).toFixed(4)}) translate(-32 -32)`);
  // the glow: a soft square of light the shape of the core, swelling with the voice (behind the rails, so they stand in it)
  if (g < 0.004) parts.bloom.setAttribute('opacity', '0');
  else {
    parts.bloom.setAttribute('opacity', ((theme === 'dark' ? 0.95 : 0.78) * Math.pow(g, 0.9)).toFixed(3));
    parts.bloom.setAttribute('transform', at(p.scale * (1.04 + 0.5 * g)));
  }
}

// ── the engine ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface IconEngineOptions {
  theme?: Theme;
  /** Rail colour override (any CSS colour, e.g. 'currentColor'); kept when the theme changes. */
  railColor?: string;
  /** Keep the svg's accessible name in step with the state (ICON_LABELS), as mountIcon() does. The React component
   *  names the svg itself and leaves this off. */
  labels?: boolean;
  /** A fixed accessible name instead of the state's ('' makes the icon decorative). Implies `labels`. */
  label?: string;
  /** Drives speaking (EASM's voice) and listening (the user's voice). Without it, both follow the EASM voice's rhythm. */
  level?: LevelInput;
  meter?: LevelMeterOptions;
  /** Called when a one-shot state (done, error) has finished playing. */
  onComplete?: (state: IconState) => void;
}

type From = { state: IconState; start: number } | { pose: IconPose };

export class IconEngine {
  private state: IconState = 'idle';
  private start = 0;
  private from: From | null = null;
  private blendAt = 0;
  private rotShift = 0;
  private blendDur: number = T.blend;
  private shown: IconPose = pose0();
  private raf = 0;
  private manual = false;
  private last = 0;
  private fill = 0;
  private fillV = 0;
  private glow = 0;
  private glowV = 0;
  private completed = false;
  private reader: ReturnType<typeof levelReader>;
  private visible = true;
  private io?: IntersectionObserver;
  private mq?: MediaQueryList;
  private theme: Theme;
  private railOverride?: string;
  private meter?: LevelMeterOptions;
  private labelled: boolean;
  private label?: string;
  private unwatch: () => void = () => {};
  onComplete?: (state: IconState) => void;

  constructor(private parts: IconParts, options: IconEngineOptions = {}) {
    this.theme = options.theme ?? 'light';
    this.railOverride = options.railColor;
    this.meter = options.meter;
    this.onComplete = options.onComplete;
    this.label = options.label;
    this.labelled = !!options.labels || options.label !== undefined;
    this.reader = levelReader(options.level, t => voiceAt(t - this.start), this.meter);
    if (typeof window !== 'undefined') {
      this.mq = reducedMotionQuery() ?? undefined;
      this.mq?.addEventListener?.('change', this.kick);
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(e => { this.visible = latestIntersection(e); this.kick(); });
        this.io.observe(parts.svg);
      }
      this.unwatch = watchMotionSwitch(parts.svg, this.kick);
    }
    if (this.railOverride !== undefined) this.paintRails();
    renderPose(parts, this.shown, this.theme);
    this.named();
  }

  private now(): number { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000; }

  get current(): IconState { return this.state; }

  /** Changes state; the old motion blends into the new over 0.5 s. `at` sets the clock (offline rendering only). */
  setState(s: IconState, at?: number): void {
    if (s === this.state) return;
    this.begin(s, at ?? this.now());
  }

  /** Puts the engine straight into a state with no blend (a first paint that shouldn't fade in, exports, tests). */
  jump(s: IconState, at?: number): void {
    this.from = null;
    this.state = s;
    this.start = at ?? this.now();
    this.completed = false;
    this.named();
    this.kick();
  }

  /** Plays the current state again from its start (for a second `done` or `error` in a row). */
  replay(at?: number): void { this.begin(this.state, at ?? this.now()); }

  private begin(s: IconState, t: number): void {
    // keep the outgoing motion alive while it fades; if a blend is already running, freeze what is on screen
    const from: From = this.from || this.state === s ? { pose: this.shown } : { state: this.state, start: this.start };
    // where the outgoing core will be when the blend ends, and where the incoming one will be: the quarter-turn shift
    // between them is fixed now, for the whole blend
    // a one-shot is an event: it takes over faster than a change of activity does
    this.blendDur = ONE_SHOT.has(s) ? T.blendOneShot : T.blend;
    const endT = t + this.blendDur;
    const outRot = 'pose' in from ? from.pose.rot : this.poseOf(from.state, from.start, endT, 0, 0).rot;
    const inRot = this.poseOf(s, t, endT, 0, 0).rot;
    this.rotShift = 90 * Math.round((outRot - inRot) / 90);
    this.from = from;
    this.blendAt = t;
    this.state = s;
    this.start = t;
    this.completed = false;
    this.named();
    this.kick();
  }

  setLevel(input: LevelInput): void { this.reader.dispose(); this.reader = levelReader(input, t => voiceAt(t - this.start), this.meter); }
  /** Stops the clock-driven loop for good (offline rendering with renderFrame()). */
  pause(): void { this.manual = true; cancelAnimationFrame(this.raf); this.raf = 0; }
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.paintRails();
    renderPose(this.parts, this.shown, theme);
  }
  /** Overrides the rail colour (any CSS colour, e.g. 'currentColor'); pass nothing to return to the theme's. The
   *  override is kept when the theme changes. */
  setRailColor(color?: string): void { this.railOverride = color; this.paintRails(); }
  private paintRails(): void {
    const stroke = this.railOverride ?? railColor(this.theme);
    this.parts.railLines.forEach(l => l.setAttribute('stroke', stroke));
  }

  /** Sets a fixed accessible name ('' = decorative); pass nothing to name the svg after the state again. */
  setLabel(label?: string): void { this.label = label; this.labelled = true; this.named(); }

  /** Writes the accessible name on the svg when the engine manages it (mountIcon, or the labels option). */
  private named(): void {
    if (this.labelled) nameSvg(this.parts.svg, this.label ?? ICON_LABELS[this.state]);
  }

  private poseOf(state: IconState, start: number, t: number, lvl: number, fill: number): IconPose {
    const lt = t - start;
    switch (state) {
      case 'connecting': return connecting(lt);
      case 'thinking': return thinking(lt);
      case 'searching': return searching(lt);
      case 'toolCalling': return toolCalling(lt);
      case 'writing': return writing(lt);
      case 'speaking': return speaking(lvl, fill);
      case 'listening': return listening(lvl, fill);
      case 'awaiting': return awaiting(lt);
      case 'done': return lt < T.done ? done(lt) : pose0();
      case 'error': return lt < T.error ? error(lt) : pose0();
      case 'offline': return offline();
      default: return pose0();
    }
  }

  private kick = (): void => {
    if (typeof window === 'undefined' || this.manual) return;
    if (motionOff(this.parts.svg)) {
      // reduced motion: the state's still picture (the empty core for offline, the still mark for everything else)
      cancelAnimationFrame(this.raf); this.raf = 0; this.from = null;
      this.shown = this.state === 'offline' ? offline() : pose0();
      renderPose(this.parts, this.shown, this.theme);
      if (ONE_SHOT.has(this.state)) this.finish();
      return;
    }
    if (!this.raf && this.visible) { this.last = this.now(); this.raf = requestAnimationFrame(this.frame); }
  };

  private frame = (): void => {
    this.raf = 0;
    if (motionOff(this.parts.svg)) { this.kick(); return; }
    const t = this.now(), dt = Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    this.tick(t, dt);
    if (this.running(t) && this.visible) this.raf = requestAnimationFrame(this.frame);
  };

  /** Whether anything still moves: a blend, a looping state, or a one-shot that hasn't finished. */
  private running(t: number): boolean {
    if (this.from) return true;
    if (STILL.has(this.state)) return false;
    if (ONE_SHOT.has(this.state)) return t - this.start < T[this.state as 'done' | 'error'];
    return true;
  }

  private finish(): void {
    if (this.completed) return;
    this.completed = true;
    this.onComplete?.(this.state);
  }

  /** Draws the frame at time t on a fixed clock (exports, tests, video): call with increasing t; `level` overrides the
   *  source for the voice states. Exactly what the live loop does each frame. */
  renderFrame(t: number, dt: number, level?: number): void { this.tick(t, dt, level); }

  private tick(t: number, dt: number, levelOverride?: number): void {
    const voiced = this.state === 'speaking' || this.state === 'listening' ||
      (!!this.from && 'state' in this.from && (this.from.state === 'speaking' || this.from.state === 'listening'));
    const raw = voiced ? clamp(levelOverride ?? this.reader.read(t, dt)) : 0;
    // springs between the audio and the picture: the glow answers each syllable within ~25 ms, the rail's light a little
    // more calmly, and neither ever changes speed abruptly
    [this.glow, this.glowV] = spring(this.glow, this.glowV, raw, dt, 44);
    [this.fill, this.fillV] = spring(this.fill, this.fillV, raw, dt, 17);
    const lvl = clamp(this.glow);
    let pose = this.poseOf(this.state, this.start, t, lvl, clamp(this.fill));
    if (this.from) {
      const w = ease.io(clamp((t - this.blendAt) / this.blendDur));
      const old = 'pose' in this.from ? this.from.pose : this.poseOf(this.from.state, this.from.start, t, lvl, clamp(this.fill));
      pose = blendPose(old, pose, w, this.rotShift);
      if (w >= 1) this.from = null;
    }
    this.shown = pose;
    renderPose(this.parts, pose, this.theme);
    if (ONE_SHOT.has(this.state) && !this.from && t - this.start >= T[this.state as 'done' | 'error']) this.finish();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.reader.dispose();
    this.io?.disconnect();
    this.mq?.removeEventListener?.('change', this.kick);
    this.unwatch();
  }
}

/** Finds the nodes an engine drives inside an icon <svg> that holds iconMarkup(). */
export function collectIconParts(svg: SVGSVGElement): IconParts {
  const rails = Array.from(svg.querySelectorAll<SVGGElement>('[data-easm=rail]'));
  return {
    svg,
    bloom: svg.querySelector('[data-easm=bloom]') as SVGRectElement,
    core: svg.querySelector('[data-easm=core]') as SVGGElement,
    coreRing: svg.querySelector('[data-easm=core-ring]') as SVGPathElement,
    coreFill: svg.querySelector('[data-easm=core-fill]') as SVGRectElement,
    rails,
    railLines: rails.map(g => g.querySelector('[data-easm=rail-line]') as SVGLineElement),
    lights: rails.map(g => Array.from(g.querySelectorAll<SVGLineElement>('[data-easm=light]'))),
  };
}

/** The core's outline when it is empty (offline, connecting, error), in grid units. */
export const CORE_RING = 2.6;

/** The icon's static markup (identical to what the React component renders). Rails are round-capped lines: exactly
 *  the v6 pills, and a light inside one is the same line in orange with a dash. */
export function iconMarkup(theme: Theme, uid: string, railStroke = railColor(theme)): string {
  const { x1, x2 } = RAIL_LINE, c = V6.c - V6.core / 2, R = CORE_RING, ir = V6.coreR - R, rail = escapeMarkup(railStroke);
  const light = `<line data-easm="light" x1="${x1}" y1="32" x2="${x2}" y2="32" stroke="${ORANGE}" stroke-width="7.36" stroke-linecap="round" stroke-dasharray="0.01 99" opacity="0"/>`;
  let s = `<defs><filter id="${uid}b" x="-1" y="-1" width="3" height="3" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3.4"/></filter></defs>` +
    `<rect data-easm="bloom" x="${c}" y="${c}" width="${V6.core}" height="${V6.core}" rx="${V6.coreR}" fill="${ORANGE}" filter="url(#${uid}b)" opacity="0"/>`;
  for (let k = 0; k < 6; k++) {
    s += `<g transform="rotate(${k * 60} 32 32)"><g data-easm="rail"><line data-easm="rail-line" x1="${x1}" y1="32" x2="${x2}" y2="32" stroke="${rail}" stroke-width="7.2" stroke-linecap="round"/>` +
      light.repeat(LIGHTS) + `</g></g>`;
  }
  // the core: an outline, plus a centre that overlaps it a little (so the two never show a seam when the core is solid)
  s += `<g data-easm="core"><path data-easm="core-ring" fill="${ORANGE}" fill-rule="evenodd" d="${rrect(c, V6.core, V6.coreR)}${rrect(c + R, V6.core - 2 * R, ir)}"/>` +
    `<rect data-easm="core-fill" x="${c + R - 0.6}" y="${c + R - 0.6}" width="${V6.core - 2 * R + 1.2}" height="${V6.core - 2 * R + 1.2}" rx="${ir + 0.6}" fill="${ORANGE}"/></g>`;
  return s;
}

/** A rounded square as path data. */
function rrect(x: number, w: number, r: number): string {
  const f = (v: number) => +v.toFixed(3);
  return `M${f(x + r)} ${f(x)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(x + r)}V${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(x + w)}` +
    `H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(x + w - r)}V${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(x)}Z`;
}
