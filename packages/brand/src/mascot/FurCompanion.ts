/**
 * The living character: one controller that runs her body, eyes, face, coat,
 * voice and personality every frame and draws her with FurRenderer.
 *
 * Two placements:
 * - `stage` (default) fills the canvas it is given; clicking empty space
 *   sends her hopping there. Used by previews, showcases and full-panel stages.
 * - `corner` floats her over the page in a corner, where a host such as a chat
 *   sits. The world is the viewport: she can be picked up and thrown across
 *   it, lands on its bottom edge and hops back home. A small canvas follows
 *   her, so the rest of the page stays clickable and cheap to composite.
 */
import { FurRenderer } from './FurRenderer';
import type { MouthFrame, RenderFrame } from './FurRenderer';
import { BodyPhysics, REST_HEIGHT } from './BodyPhysics';
import type { Ledge } from './BodyPhysics';
import type { BodyEvent } from './BodyPhysics';
import { Gaze } from './Gaze';
import { FaceRig, EXPRESSIONS, EXPRESSION_SHEETS, EXTRA_EXPRESSIONS } from './FaceRig';
import type { Channels, Expression, Override } from './FaceRig';
import { ActPlayer, ACTS } from './Acts';
import type { ActFrame, ActName } from './Acts';
import { Emotes } from './Emotes';
import type { EmoteShape } from './Emotes';
import { LipSync, visemeShape } from './LipSync';
import type { MouthShape, Viseme } from './LipSync';
import { Personality, FEELINGS } from './Personality';
import type { Activity, Feeling, GazeMode, PersonalityOutput } from './Personality';

/**
 * A ledge she stands on (corner placement): its top (`floor`) and, when
 * known, its ends (`left`, `right`); off it she falls to the floor. With
 * `hang`, a swing whose ropes hang from that client y.
 */
export type Perch = { x: number; floor: number; size: number; hang?: number; left?: number; right?: number };

/**
 * Her corner, from the viewport's right and bottom edges. `span` is the width
 * of what she sits on there (the chat button), a ledge; `ground` is how far
 * the floor is from the bottom edge (else the corner's own bottom).
 */
export type Corner = { right: number; bottom: number; span?: number; ground?: number };

/**
 * Where she is each frame (screen pixels), and on the page what to add for an
 * absolutely positioned layer; `edge` is the screen edge her layer is pinned
 * to and `height` the screen height her world was laid out at, so a layer
 * beside her (her bubble) can be pinned the same way.
 */
export type FrameAt = { x: number; y: number; radius: number; page: { x: number; y: number } | null; edge: 'top' | 'bottom'; height: number };

export type Mood = 'idle' | 'curious' | 'happy' | 'listening' | 'thinking' | 'sleepy';
export type CompanionActivity = Activity;
export type { Viseme, Expression, ActName, Feeling };
export { EXPRESSIONS, EXPRESSION_SHEETS, EXTRA_EXPRESSIONS, ACTS, FEELINGS };

type Options = {
  color?: string; reducedMotion?: boolean; onStateChange?: (state: string) => void;
  /** The host owns permission prompts. This runs only after a mouth click. */
  onVoiceRequest?: () => void;
  /** Existing integrations retain an open mouth unless they opt into text mode. */
  voiceEnabled?: boolean;
  placement?: 'stage' | 'corner';
  /** Distance from the viewport's right and bottom edges, corner placement only. */
  corner?: Corner;
  /** Skin radius in CSS pixels for the corner; the fur adds about a third. */
  size?: number;
  /** A click or Enter on her. Without it, a click is a poke. */
  onActivate?: () => void;
  /** Interaction names only (poked, petted, tossed…), never any content. */
  onEvent?: (name: string) => void;
  /** Accessible name of the corner button. */
  label?: string;
  /** Let her feelings drive her; off, she shows only what she is told. */
  personality?: boolean;
  /** Keeps the drawing buffer for pixel diagnostics. */
  preserveDrawingBuffer?: boolean;
  /**
   * A phone or tablet: a lighter coat, a lower pixel density, and 30 frames a
   * second while she sits still (60 when she moves). Her full coat made a
   * phone-sized university site stutter (2026-10-23: 183 frames over 34 ms in
   * three runs with her, 22 without).
   */
  light?: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function randomGenerator(seed = 9173) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const MOOD_EXPRESSION: Record<Mood, Expression | null> = { idle: null, curious: 'curious', happy: 'happy', listening: 'listening', thinking: 'thinking', sleepy: 'drowsy' };
/** "beingIgnored" → "Being ignored". */
export function expressionLabel(name: Expression) {
  const words = name.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1).replace(/ ([a-z])$/, (_, letter: string) => ` ${letter.toUpperCase()}`);
}
/** Symbols a pose holds while it shows; the rest pop up now and then. */
const HELD_EMOTES = new Set<EmoteShape>(['anger', 'sweat', 'question', 'idea', 'book', 'pencil']);
const ACT_LABELS: Partial<Record<ActName, string>> = {
  startle: 'Startled', giggle: 'Giggling', wink: 'Winking', celebrate: 'Celebrating', eyeRoll: 'Rolling her eyes',
  raspberry: 'Blowing a raspberry', hmph: 'Hmph!', pout: 'Pouting', sigh: 'Sighing', yawn: 'Yawning', shiver: 'Shivering', dizzy: 'Seeing stars',
  sideEye: 'Giving you a side-eye', fidget: 'Fidgeting', hum: 'Humming', peek: 'Peekaboo', fakeCry: 'Fake crying', sneeze: 'Sneezing',
  twirl: 'Twirling', shrug: 'Shrugging', gasp: 'Gasping', bow: 'Bowing',
};

export class FurCompanion {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: FurRenderer;
  private readonly observer: ResizeObserver;
  private readonly preference = matchMedia('(prefers-reduced-motion: reduce)');
  // A new seed each page view: with fixed seeds her whims, glances and blinks came in the same order on every page.
  private readonly seed = (Math.random() * 2 ** 31) | 0;
  private readonly rng = randomGenerator(this.seed + 409);
  private readonly body = new BodyPhysics();
  private readonly gaze = new Gaze(randomGenerator(this.seed + 77));
  private readonly rig = new FaceRig();
  private readonly acts = new ActPlayer();
  private readonly emotes = new Emotes(randomGenerator(this.seed + 31));
  private readonly lipSync = new LipSync();
  private readonly personality = new Personality(randomGenerator(this.seed + 5));
  private readonly placement: 'stage' | 'corner';
  private corner: Corner;
  private readonly onStateChange?: (state: string) => void;
  private activateHandler?: () => void;
  private readonly onEvent?: (name: string) => void;
  private onVoiceRequest?: () => void;
  private hit: HTMLButtonElement | null = null;
  private badge: HTMLSpanElement | null = null;
  private badgeCount = 0;
  private frameListener: ((at: FrameAt) => void) | null = null;
  private perch: Perch | null = null;
  /** Her swing (a perch with `hang`): two ropes and a seat, drawn beside the canvas. */
  private swing: { el: SVGSVGElement; ropes: SVGLineElement[]; twists: SVGLineElement[]; seat: SVGRectElement; edge: SVGRectElement; left: number; top: number; push: number; pushAt: number; seated: number } | null = null;
  private targetRadius = 0;
  private boxRadius = 0;
  private listenLevel = 0;
  private listenNod = 0;
  /** 0..1 progress of a pop-in (she reappears somewhere far rather than travelling there). */
  private appear = 1;
  private preferenceOverride = false;
  private reducedMotion = false;
  private personalityOn: boolean;
  private color = '#E20A18';
  private rgb: [number, number, number] = [0.886, 0.039, 0.094];
  private mood: Mood = 'idle';
  private pinned: { expression: Expression; until: number; long: boolean } | null = null;
  private activity: CompanionActivity = 'idle';
  private activityStarted = 0;
  private voiceEnabled = true;
  private zip = { value: 0, velocity: 0 };
  private suspended = false;
  private destroyed = false;
  private width = 0;
  private height = 0;
  private box = 0;
  private boxLeft = 0;
  private boxTop = 0;
  /**
   * While she stands on the page itself (not in her corner or on the open
   * panel): the scroll her coordinates were measured at. She is then drawn in
   * the page's own coordinates (position: absolute), so the browser scrolls
   * her with the content; as a fixed overlay she trailed it by a frame and
   * shook while the page scrolled.
   */
  private pageAt: { x: number; y: number } | null = null;
  /** The page coordinates of an absolutely positioned layer's (0, 0). */
  private pageOrigin = { x: 0, y: 0 };
  /**
   * The screen edge her corner layer is pinned to while the screen is her
   * world. At the chat button it is the bottom, as the button's is, so a
   * phone's toolbar sliding in or out moves both together with no script;
   * counted from the top she sank into the button as the toolbar came back,
   * then snapped up once the browser reported the new size (2026-10-23).
   * Under a header (her swing) it is the top.
   */
  private edge: 'top' | 'bottom' = 'top';
  private radius = 52;
  private requestedSize: number;
  private dpr = 1;
  private home = { x: 0, y: 0 };
  private returning = false;
  private returnAt = 0;
  private pointer = { x: 0, y: 0, active: false, time: 0, speed: 0 };
  private lookTarget: { x: number; y: number } | null = null;
  private lookViewer = false;
  private lastInput = 0;
  private press: { id: number; x: number; y: number; time: number; mouth: boolean; grabbed: boolean; slop: number } | null = null;
  private pointerVelocity = { x: 0, y: 0 };
  private shake = 0;
  private petBuffer = 0;
  private petStrength = 0;
  private scrollY = 0;
  private scrollSpeed = 0;
  private scrollAt = 0;
  private hiddenAt = 0;
  private elapsed = 0;
  private frames = 0;
  private lastTime = 0;
  private raf = 0;
  private state = '';
  private channels: Channels;
  private gazeState: ReturnType<Gaze['update']> | null = null;
  private lastOutput: PersonalityOutput | null = null;
  private talking = false;
  private tears: { x: number; y: number; z: number; vy: number; side: number; age: number }[] = [];
  private tearClock = 0;
  private bodyFrame: ReturnType<BodyPhysics['frame']> | null = null;
  private fps = 60;
  private actFrame: ActFrame | null = null;
  private light = false;
  private emoteWants: Partial<Record<EmoteShape, boolean>> = {};
  private poseEmoteClock = 0;
  // Speech.
  private speechKind: 'stream' | null = null;
  private externalLevel = 0;
  private externalUntil = 0;
  private viseme: Viseme | undefined;
  private mouthShape: MouthShape = { jaw: 0, wide: 0, round: 0, press: 0, teeth: 0, energy: 0, emphasis: 0 };
  private voiceUntil = 0;

  constructor(canvas: HTMLCanvasElement, options: Options = {}) {
    this.canvas = canvas;
    this.placement = options.placement ?? 'stage';
    this.corner = options.corner ?? { right: 24, bottom: 22 };
    this.requestedSize = options.size ?? 46;
    this.renderer = new FurRenderer(canvas, { preserveDrawingBuffer: options.preserveDrawingBuffer });
    this.light = !!options.light;
    this.renderer.setLight(this.light);
    this.onStateChange = options.onStateChange;
    this.activateHandler = options.onActivate;
    this.onEvent = options.onEvent;
    this.onVoiceRequest = options.onVoiceRequest;
    this.personalityOn = options.personality ?? true;
    this.voiceEnabled = options.voiceEnabled ?? true;
    this.zip.value = this.voiceEnabled ? 0 : 1;
    this.reducedMotion = options.reducedMotion ?? this.preference.matches;
    this.preferenceOverride = options.reducedMotion !== undefined;
    this.channels = this.rig.read();
    this.setColor(options.color ?? '#E20A18');
    if (this.placement === 'corner') this.mountCorner(options.label ?? 'The EASM mascot. Click her, or pick her up.');
    else {
      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointerdown', this.pointerDown);
      canvas.addEventListener('dblclick', this.doubleClick);
    }
    window.addEventListener('pointermove', this.pointerMove, { passive: true });
    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('pointercancel', this.pointerCancel);
    window.addEventListener('pointerout', this.pointerOut);
    window.addEventListener('blur', this.blur);
    window.addEventListener('scroll', this.scroll, { passive: true });
    window.addEventListener('keydown', this.keyActivity, { passive: true });
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.visibility);
    this.preference.addEventListener('change', this.preferenceChange);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.scrollY = window.scrollY;
    this.lastInput = performance.now();
    this.resize();
    this.report('Ready to explore');
    this.raf = requestAnimationFrame(this.frame);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  setColor(hex: string) {
    if (this.destroyed || !/^#[\da-f]{6}$/i.test(hex)) return;
    this.color = hex.toUpperCase();
    this.rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
    this.paintBadge();
  }

  /** Legacy moods map onto expressions; `idle` hands the face back to her. */
  setMood(mood: Mood) {
    if (this.destroyed || !(mood in MOOD_EXPRESSION)) return;
    this.mood = mood;
    const expression = MOOD_EXPRESSION[mood];
    this.pinned = expression ? { expression, until: Infinity, long: true } : null;
    this.report(mood === 'idle' ? 'Ready to explore' : mood.charAt(0).toUpperCase() + mood.slice(1));
  }

  /** Show one expression for `hold` seconds (Infinity to keep it), or null to let her be herself. */
  setExpression(expression: Expression | null, hold = 4) {
    if (this.destroyed) return;
    if (expression && !EXPRESSIONS.includes(expression)) return;
    this.pinned = expression ? { expression, until: this.elapsed + hold, long: hold > 6 } : null;
    if (expression) this.report(expressionLabel(expression));
  }

  play(act: ActName) {
    if (this.destroyed || this.suspended || !ACTS.includes(act)) return;
    this.startAct(act, this.pointerSide());
  }

  setPersonality(enabled: boolean) { this.personalityOn = enabled; }

  /**
   * What happened to her on the page around her, for her feelings: her line
   * waved away (`snubbed`), left without an answer (`unanswered`), or the
   * visitor took her up (`attended`: a tap, a question picked, the chat opened).
   */
  notice(kind: 'snubbed' | 'unanswered' | 'attended') {
    if (this.destroyed) return;
    this.personality.stimulus({ type: kind });
  }

  /** Her bubble has a line up: the visitor is reading her, not ignoring her. */
  setTalking(talking: boolean) { this.talking = talking; }

  /** How she feels now, in one word, for the writer of her next line. */
  moodWord(): 'happy' | 'fond' | 'bored' | 'sassy' | 'sulky' | 'sleepy' | 'calm' {
    const f = this.personality.feelings;
    if (f.sleepiness > 0.5) return 'sleepy';
    if (f.sadness > 0.4) return 'sulky';
    if (f.sass > 0.35) return 'sassy';
    if (f.boredom > 0.45) return 'bored';
    if (f.affection > 0.4) return 'fond';
    if (f.joy > 0.5) return 'happy';
    return 'calm';
  }

  setVoiceEnabled(enabled: boolean) {
    if (this.destroyed) return;
    this.voiceEnabled = enabled;
    if (!enabled) this.stopSpeaking();
    if (this.reducedMotion) { this.zip.value = enabled ? 0 : 1; this.zip.velocity = 0; }
    this.report(enabled ? 'Voice is ready' : 'Happy to help in writing');
  }

  setMouthZipped(zipped: boolean) { this.setVoiceEnabled(!zipped); }

  /** Pause a dismissed character without discarding its GPU resources. */
  setSuspended(suspended: boolean) {
    if (this.destroyed || this.suspended === suspended) return;
    this.suspended = suspended;
    this.lastTime = 0;
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.hit) this.hit.hidden = suspended;
    if (suspended) { this.pointer.active = false; this.pointerCancel(); this.stopSpeaking(); }
    else if (!document.hidden) this.raf = requestAnimationFrame(this.frame);
  }

  setVoiceRequestHandler(handler?: () => void) { if (!this.destroyed) this.onVoiceRequest = handler; }

  setActivity(activity: CompanionActivity) {
    if (this.destroyed || !['idle', 'greeting', 'thinking', 'writing', 'listening', 'speaking'].includes(activity)) return;
    if (activity !== this.activity) {
      this.activityStarted = this.elapsed;
      if (activity === 'greeting') this.body.jump(0.35, this.reducedMotion);
    }
    this.activity = activity;
    const labels = { idle: 'Here to help', greeting: 'Hello, lovely to meet you', thinking: 'Thinking it through', writing: 'Writing a reply', listening: 'Listening to you', speaking: 'Speaking' };
    this.report(labels[activity]);
  }

  setReducedMotion(value: boolean) { this.preferenceOverride = true; this.applyReducedMotion(value); }

  /** The layer she is drawn in (corner placement): under the widget beside it, over it on her swing. */
  setLayer(z: number) {
    if (this.destroyed) return;
    this.canvas.style.zIndex = String(z);
    if (this.hit) this.hit.style.zIndex = String(z + 1);
    if (this.badge) this.badge.style.zIndex = String(z + 2);
    if (this.swing) this.swing.el.style.zIndex = String(z - 1);
  }

  /** Where her corner is (corner placement), from the viewport's right and bottom edges; she goes home there. */
  setCorner(corner: Corner) {
    if (this.destroyed || this.placement !== 'corner') return;
    const was = this.corner;
    if (corner.right === was.right && corner.bottom === was.bottom && corner.span === was.span && corner.ground === was.ground) return;
    this.corner = { ...corner };
    this.layout(false);
    if (!this.perch) this.goHome();
  }

  /** Corner size: skin radius in CSS pixels. She grows or shrinks smoothly. */
  setSize(radius: number) {
    if (this.destroyed || !Number.isFinite(radius)) return;
    this.requestedSize = clamp(radius, 14, 120);
    this.layout(false);
  }

  /**
   * Stand on a ledge instead of the page's bottom edge (client pixels: her
   * centre x, the y her base rests on, and her skin radius there), or null to
   * go back to the corner. Corner placement only. `pop` (the panel opening or
   * closing) puts her there at once with a plop; `leap` jumps there (onto a
   * heading of the page, or home again); `ride` moves her with a ledge that
   * moved under her, as when the page scrolls.
   */
  setPerch(perch: Perch | null, travel: 'pop' | 'leap' | 'ride' = 'pop', onPage = false) {
    if (this.destroyed || this.placement !== 'corner') return;
    // On the page, the perch was measured at this scroll; in the corner or on the panel, the screen is her world.
    // `anchor` already moved her with the scroll; what is left is how the ledge itself moved.
    this.anchor(!!perch && onPage);
    const was = this.perch;
    if (perch && was && Math.abs(perch.x - was.x) < 1 && Math.abs(perch.floor - was.floor) < 1 && perch.size === was.size && perch.hang === was.hang) return;
    if (travel === 'ride' && perch && was) {
      const from = { ...this.home };
      this.perch = perch;
      this.layout(false);
      this.hangSwing();
      this.body.shift(this.home.x - from.x, this.home.y - from.y);
      return;
    }
    this.perch = perch;
    this.returning = false;
    this.layout(false);
    this.hangSwing();
    if (travel === 'leap') { this.body.leapTo(this.home.x, this.home.y, this.reducedMotion); return; }
    const far = Math.hypot(this.home.x - this.body.x, this.home.y - this.body.y) > this.radius * 3;
    if (perch || far || this.reducedMotion) {
      // A leap or a fall that long would take longer than the panel takes to
      // open or close: she pops up where she is going instead, with a plop.
      this.radius = this.targetRadius;
      this.body.setRadius(this.radius);
      this.body.place(this.home.x, this.home.y);
      if (!this.reducedMotion) { this.appear = 0; this.body.thump(4); }
    } else this.body.drop();
  }

  /**
   * Her drop (corner placement): up to where the visitor clicked (`from`, the
   * client y her base reaches at the top), a moment's hang there, then
   * straight down onto `perch`, the first surface under the click. She stays
   * on it until the next perch or home.
   */
  dropOnto(perch: Perch, from: { y: number }) {
    if (this.destroyed || this.placement !== 'corner') return;
    this.anchor(true);
    this.perch = perch;
    this.returning = false;
    this.layout(false);
    this.body.dropTo(this.home.x, this.home.y - Math.max(0, perch.floor - from.y), this.home.y, this.reducedMotion);
  }

  /**
   * The surface under her drop, found while she was on her way up (client y
   * now): she falls onto it instead of the bottom of the screen.
   */
  setDropFloor(floor: number) {
    if (this.destroyed || this.placement !== 'corner' || !this.perch) return;
    const y = floor + (this.pageAt ? window.scrollY - this.pageAt.y : 0);
    this.perch = { ...this.perch, floor: y };
    this.layout(false);
    this.body.retarget(this.home.y);
  }

  /** What a click or Enter on her does; without one, a click is a poke. */
  setActivateHandler(handler?: () => void) { if (!this.destroyed) this.activateHandler = handler; }

  /** Accessible name of the corner button. */
  setLabel(label: string) { this.hit?.setAttribute('aria-label', label); }

  /** An unread count beside her head; 0 hides it. */
  setBadge(count: number) {
    this.badgeCount = Math.max(0, Math.floor(count));
    if (!this.badge) return;
    this.badge.textContent = this.badgeCount > 9 ? '9+' : String(this.badgeCount);
    this.badge.style.display = this.badgeCount ? 'flex' : 'none';
  }

  /** Called every frame with her visible centre and radius (client pixels), for things that sit beside her. */
  onFrame(listener: ((at: FrameAt) => void) | null) { this.frameListener = listener; }

  /** Live speech a player has scheduled (PCM at `startTime` on `context`'s clock): the mouth follows it. */
  feedSpeech(context: AudioContext, pcm: Int16Array | Float32Array, sampleRate: number, startTime: number) {
    if (this.destroyed) return;
    if (this.speechKind !== 'stream') { this.stopSpeaking(); this.speechKind = 'stream'; }
    this.lipSync.feed(context, pcm, sampleRate, startTime);
  }

  /** The speech stopped early (the visitor interrupted, or the call ended). */
  clearSpeech() { this.lipSync.clearFeed(); }

  /** The visitor's own voice level (0..1) while she listens: she nods along. */
  setListening(level: number) {
    const next = Number.isFinite(level) ? clamp(level, 0, 1) : 0;
    if (next - this.listenLevel > 0.22 && next > 0.3 && this.listenNod <= 0) this.listenNod = 1;
    this.listenLevel += (next - this.listenLevel) * 0.5;
  }

  /** Normalised stage coordinates (stage) or viewport fractions (corner). */
  hopTo(x: number, y: number) {
    if (this.destroyed || this.suspended || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.returning = false;
    const target = this.constrain(x * this.width, y * this.height);
    this.body.hopTo(target.x, target.y, 0.55, this.reducedMotion);
    this.report('Getting ready to hop');
  }

  hop() { this.body.jump(0.55, this.reducedMotion); }

  /** A throw in body radii per second, as if she had been flung. */
  toss(vx: number, vy: number) { if (!this.reducedMotion) { this.body.toss(vx, vy); this.returning = false; } }

  reset() {
    if (this.destroyed) return;
    this.stopSpeaking(); this.acts.stop(); this.emotes.clear(); this.pinned = null;
    this.setActivity('idle'); this.mood = 'idle';
    if (this.placement === 'corner') this.goHome();
    else this.hopTo(0.5, 0.53);
  }

  /** Point her eyes at a page position (client pixels), straight at the visitor ('viewer'), or null to let her choose. */
  lookAt(x: number | 'viewer' | null, y?: number) {
    this.lookViewer = x === 'viewer';
    this.lookTarget = x === null || x === 'viewer' || y === undefined ? null : this.toWorld(x, y);
  }

  /** Studio shortcuts that stand in for things a visitor would do. */
  simulate(kind: 'ignored' | 'absent' | 'poke' | 'pet' | 'shake') {
    if (kind === 'ignored') this.personality.pretendIgnored(74);
    else if (kind === 'absent') { this.personality.pretendAbsent(78); this.lastInput = performance.now() - 10_000; this.pointer.active = false; }
    else if (kind === 'poke') this.poke();
    else if (kind === 'pet') { this.personality.stimulus({ type: 'pet', amount: 0.6 }); this.petStrength = 1; }
    else this.personality.stimulus({ type: 'shake', energy: 0.7 });
  }

  /** Feed PCM playback RMS (0..1) at the actual playback clock, optionally with timed visemes. */
  setAudioLevel(level: number, viseme?: Viseme) {
    if (this.destroyed || this.suspended || !this.voiceEnabled) return;
    this.externalLevel = Number.isFinite(level) ? clamp(level, 0, 1) : 0;
    this.externalUntil = performance.now() + 160;
    this.viseme = viseme;
  }

  /** Lip sync from a live audio graph, such as the voice call's playback node. */
  attachAudio(context: AudioContext, node: AudioNode) {
    if (this.destroyed) return;
    this.stopSpeaking();
    this.lipSync.attach(context, node);
    this.speechKind = 'stream';
  }

  detachAudio() { if (this.speechKind === 'stream') { this.lipSync.detach(); this.speechKind = null; } }

  /**
   * Release the mouth: lip sync from a host's audio stops (the mascot never
   * makes a sound of her own; a host plays audio and lends her its signal).
   */
  stopSpeaking() {
    this.externalLevel = 0; this.externalUntil = 0; this.viseme = undefined;
    if (this.speechKind !== 'stream') this.lipSync.detach();
    if (!this.destroyed) this.report('Ready to explore');
  }

  getSnapshot() {
    const renderState = this.renderer.getSnapshot();
    const f = this.bodyFrame;
    const c = this.channels;
    return {
      ...renderState, color: this.color, mood: this.mood, activity: this.activity, placement: this.placement,
      expression: this.dominantExpression(), act: this.acts.playing, feelings: { ...this.personality.feelings },
      personality: this.personalityOn, voiceEnabled: this.voiceEnabled, mouthZipped: !this.voiceEnabled, zipProgress: this.zip.value,
      mouthHitTarget: this.toClient(this.renderer.getMouthHitTarget()),
      width: this.width, height: this.height, radius: this.radius, dpr: this.dpr,
      x: this.body.x, y: this.body.y, restX: this.body.restX, restY: this.body.restY, groundX: f?.groundX ?? 0, groundY: f?.groundY ?? 0,
      vx: this.body.vx, vy: this.body.vy, scaleY: f ? f.deform[4] : 1, bodyMode: this.body.mode,
      gazeX: this.gazeState?.eyes[0].yaw ?? 0, gazeY: -(this.gazeState?.eyes[0].pitch ?? 0), gazeMode: this.gazeState?.mode ?? 'idle',
      eyeOpen: 1 - (this.gazeState?.blink ?? 0), blink: this.gazeState?.blink ?? 0,
      mouthOpen: c.jaw * (1 - this.zip.value), dragging: this.body.mode === 'held',
      inFlight: this.body.mode === 'air' || this.body.mode === 'free' || this.body.mode === 'crouch',
      speaking: this.isSpeaking(), speechSource: this.speechKind, audioLevel: this.mouthShape.energy,
      state: this.state, reducedMotion: this.reducedMotion, suspended: this.suspended, hidden: f?.hidden ?? 0,
      frames: this.frames, fps: Math.round(this.fps), furStrands: renderState.strands, destroyed: this.destroyed,
    };
  }

  getPixelSummary() { return this.renderer.getPixelSummary(); }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopSpeaking(); this.lipSync.detach(); cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('dblclick', this.doubleClick);
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    window.removeEventListener('pointercancel', this.pointerCancel);
    window.removeEventListener('pointerout', this.pointerOut);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('scroll', this.scroll);
    window.removeEventListener('keydown', this.keyActivity);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibility);
    this.preference.removeEventListener('change', this.preferenceChange);
    this.hit?.remove(); this.hit = null;
    this.badge?.remove(); this.badge = null;
    this.swing?.el.remove(); this.swing = null;
    this.frameListener = null;
    this.renderer.destroy();
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  private mountCorner(label: string) {
    const canvas = this.canvas;
    Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: canvas.style.zIndex || '2147483000' });
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.setAttribute('aria-label', label);
    hit.className = 'fur-companion-hit';
    Object.assign(hit.style, {
      position: 'fixed', left: '0', top: '0', borderRadius: '50%', border: '0', padding: '0', margin: '0',
      background: 'transparent', cursor: 'grab', touchAction: 'none', zIndex: String(Number(canvas.style.zIndex) + 1),
      WebkitTapHighlightColor: 'transparent',
    });
    hit.addEventListener('pointerdown', this.pointerDown);
    hit.addEventListener('dblclick', this.doubleClick);
    hit.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.click(false); }
    });
    const badge = document.createElement('span');
    badge.setAttribute('aria-hidden', 'true');
    Object.assign(badge.style, {
      position: 'fixed', left: '0', top: '0', display: 'none', alignItems: 'center', justifyContent: 'center',
      minWidth: '20px', height: '20px', padding: '0 5px', boxSizing: 'border-box', borderRadius: '10px',
      background: '#fff', font: '700 11px/1 system-ui, -apple-system, sans-serif', pointerEvents: 'none',
      boxShadow: '0 2px 6px rgba(0,0,0,0.22)', zIndex: String(Number(canvas.style.zIndex) + 2),
    });
    canvas.after(hit, badge);
    this.hit = hit;
    this.badge = badge;
    this.paintBadge();
  }

  // ── Her swing ───────────────────────────────────────────────────────────
  // A perch with `hang` (owner, 2026-10-23: on a phone, with the chat open,
  // "sit her on rope swing and rope connects with top red header"): two ropes
  // from that line down to a seat at the perch's floor. Two ropes on two hooks
  // keep the seat level, so the seat (and she, while she sits on it) moves
  // along an arc without tilting. A slow sway, a push when she is tapped or
  // lands on it; still when motion is reduced.

  private hangSwing() {
    const perch = this.perch;
    if (!perch?.hang || this.placement !== 'corner') { this.swing?.el.remove(); this.swing = null; return; }
    const NS = 'http://www.w3.org/2000/svg';
    if (!this.swing) {
      const el = document.createElementNS(NS, 'svg');
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', overflow: 'visible', zIndex: String(Number(this.canvas.style.zIndex) - 1) });
      const line = (stroke: string, width: number, dash?: string) => {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', String(width)); l.setAttribute('stroke-linecap', 'round');
        if (dash) l.setAttribute('stroke-dasharray', dash);
        return l;
      };
      const rect = (fill: string) => { const r = document.createElementNS(NS, 'rect'); r.setAttribute('fill', fill); return r; };
      const ropes = [line('#7d5c37', 2.4), line('#7d5c37', 2.4)];
      const twists = [line('#c9a676', 1.1, '2.2 2.6'), line('#c9a676', 1.1, '2.2 2.6')];
      const edge = rect('#7a4e26'), seat = rect('#b47b44');
      // A white ring with a thin dark edge: it shows on the header's colour and on a white strip alike.
      const hooks = [0, 1, 2, 3].map((i) => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', '2.6'); c.setAttribute('fill', 'none');
        c.setAttribute('stroke', i < 2 ? 'rgba(27,24,19,0.28)' : 'rgba(255,255,255,0.95)'); c.setAttribute('stroke-width', i < 2 ? '2.8' : '1.5');
        return c;
      });
      el.append(...ropes, ...twists, edge, seat, ...hooks);
      this.canvas.after(el);
      this.swing = { el, ropes, twists, seat, edge, left: 0, top: 0, push: 0, pushAt: 0, seated: 0 };
      this.pushSwing(0.14);
    }
    const s = this.swing, r = this.targetRadius;
    const seatW = r * 2.4, x = this.home.x;
    s.left = x - seatW / 2; s.top = perch.hang;
    s.el.setAttribute('width', String(Math.ceil(seatW))); s.el.setAttribute('height', String(Math.ceil(perch.floor - perch.hang + 8)));
    const hooks = s.el.querySelectorAll('circle');
    hooks.forEach((c, i) => c.setAttribute('cx', i % 2 ? String(seatW - 3) : '3'));
    hooks.forEach(c => c.setAttribute('cy', '1'));
    for (const l of [...s.ropes, ...s.twists]) l.setAttribute('y1', '1');
    s.ropes[0].setAttribute('x1', '3'); s.twists[0].setAttribute('x1', '3');
    s.ropes[1].setAttribute('x1', String(seatW - 3)); s.twists[1].setAttribute('x1', String(seatW - 3));
    s.seat.setAttribute('width', String(seatW)); s.seat.setAttribute('height', '5'); s.seat.setAttribute('rx', '2.5');
    s.edge.setAttribute('width', String(seatW - 2)); s.edge.setAttribute('height', '5'); s.edge.setAttribute('rx', '2.5');
  }

  private pushSwing(angle: number) {
    if (!this.swing || this.reducedMotion) return;
    const now = performance.now();
    const left = this.swing.push * Math.exp(-(now - this.swing.pushAt) / 2600);
    this.swing.push = Math.min(0.2, Math.max(left, angle)); this.swing.pushAt = now;
  }

  /** Where the seat is this frame, and how far she rides it (client pixels; zero off the swing). */
  private swayFrame(dt: number) {
    const s = this.swing, perch = this.perch;
    if (!s || !perch?.hang) return { x: 0, y: 0 };
    const now = performance.now();
    // A breath of sway at rest (about 3 degrees), a push that dies away over a few seconds.
    const amp = this.reducedMotion ? 0 : 0.05 + s.push * Math.exp(-(now - s.pushAt) / 2600);
    const angle = amp * Math.sin((now / 2700) * Math.PI * 2);
    const length = perch.floor - perch.hang;
    const dx = length * Math.sin(angle), dy = length * (1 - Math.cos(angle));
    // She rides it while she sits on it; picked up or off it, the seat swings on its own.
    const b = this.body;
    const on = b.mode === 'rest' && Math.hypot(b.x - this.home.x, b.y - this.home.y) < this.radius * 0.6 ? 1 : 0;
    if (on && s.seated < 0.5 && this.frames > 2) this.pushSwing(0.1);
    s.seated += (on - s.seated) * Math.min(1, dt * 6);
    const seatW = Number(s.seat.getAttribute('width')) || this.radius * 2.4;
    const y = length + dy;
    for (const [i, x0] of [3, seatW - 3].entries()) {
      for (const l of [s.ropes[i], s.twists[i]]) { l.setAttribute('x2', (x0 + dx).toFixed(1)); l.setAttribute('y2', (y + 1).toFixed(1)); }
    }
    s.seat.setAttribute('x', dx.toFixed(1)); s.seat.setAttribute('y', y.toFixed(1));
    s.edge.setAttribute('x', (dx + 1).toFixed(1)); s.edge.setAttribute('y', (y + 2).toFixed(1));
    s.el.style.transform = `translate3d(${Math.round(s.left)}px, ${Math.round(s.top)}px, 0)`;
    return { x: dx * s.seated, y: dy * s.seated };
  }

  private paintBadge() {
    if (!this.badge) return;
    this.badge.style.color = this.color;
    this.badge.style.border = `1.5px solid ${this.color}`;
  }

  private resize = () => this.layout(true);

  /** Fits her to the viewport (corner) or the canvas (stage); `place` puts a resting body home. */
  private layout(place: boolean) {
    if (this.destroyed) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.light ? 1.5 : 2);
    if (this.placement === 'corner') {
      const was = { width: this.width, height: this.height };
      this.width = window.innerWidth; this.height = window.innerHeight;
      // Only the height changed (a phone's toolbar or keyboard): pinned to the bottom,
      // everything she holds moves with the bottom edge and she is not put back home.
      const resized = this.frames > 0 && was.height > 0 && was.width === this.width && was.height !== this.height;
      if (resized && this.edge === 'bottom') this.shiftWorld(0, this.height - was.height);
      this.targetRadius = this.perch ? this.perch.size : Math.min(this.requestedSize, this.width * 0.16);
      if (!this.radius || this.frames === 0) this.radius = this.targetRadius;
      // The canvas is sized once for the largest she has been, so growing never reallocates it per frame.
      const boxRadius = Math.max(this.boxRadius, this.targetRadius, this.radius);
      if (boxRadius !== this.boxRadius || this.frames === 0) {
        this.boxRadius = boxRadius;
        this.box = Math.ceil(boxRadius * 4.6);
        this.canvas.style.width = `${this.box}px`; this.canvas.style.height = `${this.box}px`;
        this.canvas.width = Math.round(this.box * this.dpr); this.canvas.height = Math.round(this.box * this.dpr);
      }
      const floor = this.perch ? this.perch.floor : this.height - this.corner.bottom;
      this.body.setRadius(this.radius);
      this.home = this.perch
        ? { x: clamp(this.perch.x, this.targetRadius * 1.3, this.width - this.targetRadius * 1.3), y: floor - REST_HEIGHT * this.targetRadius }
        : { x: this.width - this.corner.right - this.targetRadius * 1.3, y: floor - REST_HEIGHT * this.targetRadius };
      this.applyBounds();
      if (place && !resized && (!this.body.busy || this.frames === 0)) this.body.place(this.home.x, this.home.y);
      // A swing hangs from the top; her corner stands on the bottom (see `edge`).
      if (!this.pageAt && this.edge !== (this.perch?.hang ? 'top' : 'bottom')) this.restyle('fixed');
    } else {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const nx = this.width ? this.body.restX / this.width : 0.5;
      const ny = this.height ? this.body.restY / this.height : 0.53;
      this.width = rect.width; this.height = rect.height;
      this.radius = Math.min(this.width * 0.2, this.height * 0.23, 140);
      this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
      this.body.setRadius(this.radius);
      this.body.setBounds({ left: 0, right: this.width, top: 0, floor: this.height - 16, hide: this.height });
      this.home = this.constrain(this.width * 0.5, this.height * 0.53);
      const target = this.constrain(nx * this.width, ny * this.height);
      this.body.place(target.x, target.y);
    }
    this.draw(0);
  }

  private constrain(x: number, y: number) {
    const r = this.radius;
    if (this.placement === 'corner') return { x: clamp(x, r * 1.3, this.width - r * 1.3), y: this.height - this.corner.bottom - REST_HEIGHT * r };
    const top = r * 1.6, bottom = this.height - 16 - REST_HEIGHT * r;
    return { x: clamp(x, r * 1.35, Math.max(r * 1.35, this.width - r * 1.35)), y: clamp(y, Math.min(top, bottom), bottom) };
  }

  private goHome() {
    if (this.placement !== 'corner') { this.body.hopTo(this.home.x, this.home.y, 0.55, this.reducedMotion); return; }
    const r = this.radius, dx = this.home.x - this.body.restX, dy = this.home.y - this.body.restY;
    if (Math.abs(dx) < r * 0.4 && Math.abs(dy) < 1) { this.returning = false; return; }
    // Close by, one hop down or along onto her ledge, a leap up onto it (a
    // hop's own gravity made the climb onto the chat button from the floor a
    // second-long float at a phone's size); from far below (her swing, from
    // the bottom of a phone's screen) one leap however far.
    if (Math.abs(dx) <= r * 3.2 || -dy > r * 6) {
      this.returning = false;
      if (-dy > r * 1.2) this.body.leapTo(this.home.x, this.home.y, this.reducedMotion);
      else this.body.hopTo(this.home.x, this.home.y, 0.5, this.reducedMotion);
      return;
    }
    // Long ways home are a few hops along what she stands on, down off its
    // end when it ends, never a landing on nothing.
    const x = this.body.restX + Math.sign(dx) * r * 3.2;
    const feet = this.body.restY + REST_HEIGHT * r;
    this.returning = true;
    this.body.hopTo(x, this.body.surfaceUnder(x, feet) - REST_HEIGHT * r, 0.5, this.reducedMotion);
  }

  /** Switches between the screen (fixed) and the page (absolute, scrolling with it) as her world. */
  /**
   * Her world counts from the screen (fixed) or from the page at one scroll
   * (absolute, so the browser scrolls her with it). Changing frames moves
   * everything she holds by the scroll between them, so she stays where she
   * is seen: re-attached after the page moved, she used to jump by the
   * distance scrolled (469 px at once on a university site, off the top of the
   * screen), and let go of the page she reappeared where she had been on the
   * screen when she was attached. Returns the move it made.
   */
  private anchor(onPage: boolean): { x: number; y: number } {
    const scroll = { x: window.scrollX, y: window.scrollY };
    const was = this.pageAt, next = onPage ? scroll : null;
    if (!was && !next) return { x: 0, y: 0 };
    // A world point w is the client point w - (scroll - frame), the screen's frame being the scroll now.
    const from = was ?? scroll, to = next ?? scroll;
    const d = { x: from.x - to.x, y: from.y - to.y };
    if (was && !next) { this.pageAt = null; this.restyle('fixed'); }
    else if (!was && next) { this.restyle('absolute'); this.pageAt = next; }
    else this.pageAt = next;
    this.shiftWorld(d.x, d.y);
    return d;
  }

  /** Everything she holds moves by (dx, dy): the same scene counted from another origin. */
  private shiftWorld(dx: number, dy: number) {
    if (!dx && !dy) return;
    this.body.translate(dx, dy);
    this.home = { x: this.home.x + dx, y: this.home.y + dy };
    this.pointer = { ...this.pointer, x: this.pointer.x + dx, y: this.pointer.y + dy };
    if (this.lookTarget) this.lookTarget = { x: this.lookTarget.x + dx, y: this.lookTarget.y + dy };
  }

  /**
   * Her ground (corner placement): the screen's edges in her world's
   * coordinates (they move with the page while she is on it), the floor a
   * little above the bottom edge, and the ledge she lives on with its ends:
   * the chat button at home, else her perch. Set every frame.
   */
  private applyBounds() {
    if (this.placement !== 'corner') return;
    const off = this.pageAt ? { x: window.scrollX - this.pageAt.x, y: window.scrollY - this.pageAt.y } : { x: 0, y: 0 };
    const bottom = this.height + off.y;
    const ledges: Ledge[] = [];
    if (this.perch) {
      const half = (this.targetRadius || this.radius) * 1.3;
      ledges.push({ left: this.perch.left ?? this.perch.x - half, right: this.perch.right ?? this.perch.x + half, y: this.perch.floor });
    } else if (this.corner.span) {
      ledges.push({ left: this.home.x - this.corner.span / 2, right: this.home.x + this.corner.span / 2, y: this.height - this.corner.bottom });
    }
    // The floor is never above what stands on it.
    const floor = Math.max(bottom - (this.corner.ground ?? this.corner.bottom), ...ledges.map(l => l.y));
    this.body.setBounds({ left: off.x, right: off.x + this.width, top: off.y, floor, hide: bottom, ledges });
  }

  private restyle(position: 'fixed' | 'absolute') {
    // On the page and under a header, from the top; at the chat button, from the bottom (see `edge`).
    this.edge = position === 'fixed' && !this.perch?.hang ? 'bottom' : 'top';
    const bottom = this.edge === 'bottom';
    for (const el of [this.canvas, this.hit, this.badge]) {
      if (!el) continue;
      el.style.position = position; el.style.top = bottom ? 'auto' : '0'; el.style.bottom = bottom ? '0' : 'auto';
    }
    if (position !== 'absolute') return;
    // Where (0, 0) of the page layer is: the page's origin, unless the host page positions an ancestor.
    const was = this.canvas.style.transform;
    this.canvas.style.transform = 'none';
    const at = this.canvas.getBoundingClientRect();
    this.pageOrigin = { x: at.left + window.scrollX, y: at.top + window.scrollY };
    this.canvas.style.transform = was;
  }

  /** What to add to her screen coordinates to place an absolutely positioned layer (0 on the screen). */
  private pageShift() {
    return this.pageAt ? { x: this.pageAt.x - this.pageOrigin.x, y: this.pageAt.y - this.pageOrigin.y } : { x: 0, y: 0 };
  }

  /** Client (page) pixels to world pixels. */
  private toWorld(x: number, y: number) {
    if (this.placement === 'corner') {
      if (this.pageAt) return { x: x + window.scrollX - this.pageAt.x, y: y + window.scrollY - this.pageAt.y };
      // Pinned to the bottom, her layer moves with a screen that changed size before she was told (a toolbar mid-slide).
      return { x, y: y + (this.edge === 'bottom' ? this.height - window.innerHeight : 0) };
    }
    const rect = this.canvas.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  }

  private toClient<T extends { x: number; y: number }>(point: T | null): T | null {
    if (!point) return null;
    if (this.placement !== 'corner') return point;
    const scrolled = this.pageAt ? { x: window.scrollX - this.pageAt.x, y: window.scrollY - this.pageAt.y }
      : { x: 0, y: this.edge === 'bottom' ? this.height - window.innerHeight : 0 };
    return { ...point, x: point.x + this.boxLeft - scrolled.x, y: point.y + this.boxTop - scrolled.y };
  }

  // ── Input ───────────────────────────────────────────────────────────────

  private bodyCentre() {
    const f = this.bodyFrame;
    if (!f) return { x: this.body.x, y: this.body.y };
    // The visible centre: origin moved by the deformation about the pivot.
    const [px, py] = f.pivot, d = f.deform;
    return { x: f.x + (px - d[0] * px - d[3] * py) * this.radius, y: f.y - (py - d[1] * px - d[4] * py) * this.radius };
  }

  private pointerSide() {
    const c = this.bodyCentre();
    return this.pointer.active && this.pointer.x < c.x ? -1 : 1;
  }

  private pointerMove = (event: PointerEvent) => {
    if (this.destroyed || this.suspended || !event.isPrimary) return;
    const p = this.toWorld(event.clientX, event.clientY);
    const now = performance.now();
    const dt = clamp((now - this.pointer.time) / 1000, 0.008, 0.1);
    const vx = (p.x - this.pointer.x) / dt, vy = (p.y - this.pointer.y) / dt;
    const a = 1 - Math.exp(-dt * 20);
    const ax = (vx - this.pointerVelocity.x) / dt, ay = (vy - this.pointerVelocity.y) / dt;
    this.pointerVelocity.x += (vx - this.pointerVelocity.x) * a; this.pointerVelocity.y += (vy - this.pointerVelocity.y) * a;
    const speed = Math.hypot(vx, vy);
    if (this.pointer.active) this.pointer.speed += (speed - this.pointer.speed) * a;
    this.pointer = { ...this.pointer, x: p.x, y: p.y, active: true, time: now };
    this.lastInput = now;
    const press = this.press;
    if (press && press.id === event.pointerId) {
      // A tap is a tap: a thumb drifts several pixels and rests a moment, so
      // only a clear move picks her up (a held press needs half the move).
      // Before, 6 px or 260 ms made it a grab, and most taps on a phone did
      // nothing (2026-10-23).
      const moved = Math.hypot(p.x - press.x, p.y - press.y);
      if (!press.grabbed && !press.mouth && (moved > press.slop || (now - press.time > 450 && moved > press.slop / 2))) {
        press.grabbed = true;
        this.body.grab(press.x, press.y);
        this.personality.stimulus({ type: 'grab' });
        this.emit('grabbed');
        this.returning = false;
      }
      if (press.grabbed) {
        this.body.drag(p.x, p.y, dt);
        // Shaking: how hard the hand is accelerating, in radii/s².
        this.shake += Math.min(Math.hypot(ax, ay) / this.radius, 400) * dt * 0.0016;
      }
    } else {
      // Stroking across the top of her head is petting.
      const c = this.bodyCentre(), r = this.radius;
      const inside = Math.hypot(p.x - c.x, p.y - c.y) < r * 1.2;
      if (inside && p.y < c.y + r * 0.1 && speed > r * 1.2) {
        this.petBuffer += Math.min(speed / r, 30) * dt * 0.05;
        this.petStrength = Math.min(1, this.petStrength + dt * 4);
      }
    }
    this.updateCursor(p);
  };

  private updateCursor(p: { x: number; y: number }) {
    const target = this.hit ?? this.canvas;
    const local = this.placement === 'corner' ? { x: p.x - this.boxLeft, y: p.y - this.boxTop } : p;
    target.style.cursor = this.body.mode === 'held' ? 'grabbing' : this.onVoiceRequest && this.renderer.hitTestMouth(local.x, local.y) ? 'pointer' : 'grab';
  }

  private pointerDown = (event: PointerEvent) => {
    if (this.destroyed || this.suspended || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const p = this.toWorld(event.clientX, event.clientY);
    const c = this.bodyCentre(), r = this.radius;
    const local = this.placement === 'corner' ? { x: p.x - this.boxLeft, y: p.y - this.boxTop } : p;
    // A fingertip is wider than a cursor: on touch her whole fur counts.
    const onBody = Math.hypot(p.x - c.x, p.y - c.y) < r * (event.pointerType === 'touch' ? 1.5 : 1.25);
    this.lastInput = performance.now();
    if (!onBody && this.placement === 'stage') { this.hopTo(p.x / this.width, p.y / this.height); return; }
    if (!onBody) return;
    event.preventDefault();
    const slop = event.pointerType === 'touch' ? 14 : event.pointerType === 'pen' ? 10 : 6;
    this.press = { id: event.pointerId, x: p.x, y: p.y, time: performance.now(), mouth: !!this.onVoiceRequest && this.renderer.hitTestMouth(local.x, local.y), grabbed: false, slop };
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    this.pointer = { ...this.pointer, x: p.x, y: p.y, active: true };
  };

  private pointerUp = (event: PointerEvent) => {
    const press = this.press;
    if (!press || press.id !== event.pointerId) return;
    this.press = null;
    if (press.grabbed) {
      const speed = this.body.release();
      this.personality.stimulus({ type: 'release', speed });
      this.emit(speed > 8 ? 'tossed' : 'put_down');
      this.report(speed > 8 ? 'Wheee' : 'Soft landing');
      return;
    }
    if (press.mouth) { this.onVoiceRequest?.(); return; }
    this.click(true);
  };

  private click(pointer: boolean) {
    if (this.swing) this.pushSwing(0.12);
    if (this.activateHandler) {
      this.emit('activated');
      this.personality.stimulus({ type: 'doubleClick' });
      this.activateHandler();
      return;
    }
    if (pointer) this.poke();
    else this.personality.stimulus({ type: 'doubleClick' });
  }

  private poke() {
    this.personality.stimulus({ type: 'poke' });
    this.body.jump(0.12, this.reducedMotion);
    this.emit('poked');
  }

  private doubleClick = (event: MouseEvent) => {
    if (this.destroyed || this.suspended) return;
    event.preventDefault();
    this.personality.stimulus({ type: 'doubleClick' });
    this.petStrength = 1;
    this.emit('delighted');
  };

  private pointerCancel = () => {
    if (!this.press) return;
    const grabbed = this.press.grabbed;
    this.press = null;
    if (grabbed) this.body.release();
  };
  private pointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget && this.pointer.active) { this.pointer.active = false; this.personality.stimulus({ type: 'pointerLeft' }); }
  };
  private blur = () => { this.pointer.active = false; this.pointerCancel(); };
  private keyActivity = () => { this.lastInput = performance.now(); };
  private scroll = () => {
    const now = performance.now(), y = window.scrollY;
    const dt = clamp((now - this.scrollAt) / 1000, 0.008, 0.2);
    this.scrollSpeed += ((y - this.scrollY) / dt - this.scrollSpeed) * 0.5;
    this.scrollY = y; this.scrollAt = now; this.lastInput = now;
  };
  private preferenceChange = () => { if (!this.preferenceOverride) this.applyReducedMotion(this.preference.matches); };
  private applyReducedMotion(value: boolean) {
    this.reducedMotion = value;
    if (value) { this.body.place(this.placement === 'corner' ? this.home.x : this.body.restX, this.placement === 'corner' ? this.home.y : this.body.restY); this.zip.value = this.voiceEnabled ? 0 : 1; }
  }
  private visibility = () => {
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (document.hidden) { this.hiddenAt = performance.now(); this.pointerCancel(); this.stopSpeaking(); }
    else if (!this.destroyed && !this.suspended) {
      const away = this.hiddenAt ? (performance.now() - this.hiddenAt) / 1000 : 0;
      this.personality.stimulus({ type: 'returned', away });
      this.lastInput = performance.now();
      this.lastTime = 0; this.raf = requestAnimationFrame(this.frame);
    }
  };

  // ── Frame ───────────────────────────────────────────────────────────────

  private frame = (now: number) => {
    if (this.destroyed || this.suspended) return;
    // Light: sitting still, every other frame is enough (breathing and blinks read the same at 30).
    if (this.light && this.lastTime && now - this.lastTime < 30 && this.still()) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.1) : 1 / 60;
    if (this.lastTime) this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
    this.lastTime = now; this.elapsed += dt; this.frames++;
    this.update(dt);
    this.draw(dt);
    if (!this.destroyed && !this.suspended && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  };

  /** Nothing moving that needs every frame: at rest, no act playing, nobody holding her, fully in. */
  private still() {
    return this.body.mode === 'rest' && !this.actFrame && !this.press && this.appear >= 1 && !this.isSpeaking();
  }

  private isSpeaking() {
    return !!this.speechKind && (this.speechKind !== 'stream' || this.elapsed < this.voiceUntil) || performance.now() < this.externalUntil;
  }

  private startAct(name: ActName, side: number) {
    const spec = this.acts.start(name, side);
    if (spec.hop) this.body.jump(spec.hop, this.reducedMotion);
    if (spec.emotes) this.emotes.spawn(spec.emotes.shape, spec.emotes.count);
    if (ACT_LABELS[name]) this.report(ACT_LABELS[name]!);
  }

  private update(dt: number) {
    if (this.appear < 1) this.appear = Math.min(1, this.appear + dt / 0.36);
    // Grow or shrink toward the asked size with her base on the floor.
    if (this.placement === 'corner' && this.targetRadius && Math.abs(this.targetRadius - this.radius) > 0.02) {
      this.radius = this.reducedMotion ? this.targetRadius : this.radius + (this.targetRadius - this.radius) * (1 - Math.exp(-dt * 7));
      this.body.setRadius(this.radius, true);
    }
    const r = this.radius;
    const now = performance.now();
    const c = this.bodyCentre();
    this.scrollSpeed *= Math.exp(-dt * 5);
    const pointerAge = (now - this.pointer.time) / 1000;
    const pointerRel = this.pointer.active ? { x: (this.pointer.x - c.x) / r, y: -(this.pointer.y - c.y) / r } : null;
    const present = !document.hidden && (now - this.lastInput) / 1000 < 6;

    // Petting arrives in small doses; shaking is reported while held.
    if (this.petBuffer > 0.08) { this.personality.stimulus({ type: 'pet', amount: Math.min(1, this.petBuffer) }); this.emit('petted'); this.petBuffer = 0; }
    this.petStrength = Math.max(0, this.petStrength - dt * 1.5);
    if (this.shake > 0.05) { this.personality.stimulus({ type: 'shake', energy: Math.min(1, this.shake) }); this.shake = 0; }

    // Feelings → face, gaze and moves.
    const out = this.personality.update(dt, {
      pointer: pointerRel ? { distance: Math.hypot(pointerRel.x, pointerRel.y), speed: this.pointer.speed / r * (pointerAge < 0.15 ? 1 : 0), side: Math.sign(pointerRel.x) || 1, still: pointerAge } : null,
      present, held: this.body.mode === 'held', activity: this.isSpeaking() ? 'speaking' : this.activity,
      scrolling: Math.abs(this.scrollSpeed) > r, hidden: (this.bodyFrame?.hidden ?? 0) > 0.5, reducedMotion: this.reducedMotion,
      talking: this.talking,
    });
    this.lastOutput = out;
    if (this.personalityOn) {
      for (const act of out.acts) this.startAct(act, act === 'hmph' ? -out.side : out.side);
      for (const shape of out.emotes) this.emotes.spawn(shape);
      this.emoteWants.anger = out.sustain.anger;
      this.emoteWants.sweat = out.sustain.sweat;
      if (out.hop === 'attention') { this.body.jump(0.5, this.reducedMotion); this.emit('attention_hop'); }
      if (out.hop === 'popUp') this.body.jump(0.85, this.reducedMotion);
    }
    if (this.pinned && this.elapsed > this.pinned.until) this.pinned = null;

    const act = this.acts.update(dt);
    this.actFrame = act;
    this.applyBounds();
    this.body.update(dt, {
      pose: this.channels.squash, inflate: this.channels.inflate, breathRate: this.channels.lidUpL < 0.2 ? 9 : 16 + 10 * this.personality.feelings.fear,
      shiver: act?.body?.shiver ?? 0, giggle: act?.body?.giggle ?? 0, stretch: act?.body?.stretch ?? 0,
      rollOffset: act?.body?.roll ?? 0, hidden: this.personalityOn && out.hide && this.placement === 'corner' || false, reducedMotion: this.reducedMotion,
    });
    for (const event of this.body.takeEvents()) this.bodyEvent(event);
    if (this.returning && !this.body.busy && this.elapsed >= this.returnAt) this.goHome();

    // Eyes.
    // Where she looks is her own attention even while a pose is held for her:
    // a held pose that also stared at the pointer read as her following it everywhere.
    const gazeMode: GazeMode = this.personalityOn ? out.gaze : pointerRel ? 'pointer' : 'idle';
    const side = Math.sign(pointerRel?.x ?? 1) || 1;
    const look = this.lookTarget ? { x: (this.lookTarget.x - c.x) / r, y: -(this.lookTarget.y - c.y) / r } : null;
    // Asleep, her eyes and head rest a little down and stay there.
    const sleeping = this.pinned?.expression === 'asleep' || (this.personalityOn && this.personality.feelings.sleepiness > 0.85);
    let target = sleeping && !look ? { x: 0, y: -0.6 } : look ?? (this.lookViewer ? { x: 0, y: 0.18 } : gazeMode === 'pointer' ? pointerRel
      : gazeMode === 'viewer' ? { x: 0, y: 0.18 } : gazeMode === 'away' ? { x: -side * 2.6, y: -1.3 }
        : gazeMode === 'down' ? { x: side * 0.5, y: -2.3 } : gazeMode === 'up' ? { x: -1.5, y: 2.1 } : null);
    // Poses that look somewhere of their own (reading looks down, smug looks aside).
    const hint = clamp(this.channels.gazeW, 0, 1);
    if (!look && hint > 0.05) {
      const want = { x: this.channels.gazeX, y: this.channels.gazeY };
      target = target ? { x: target.x + (want.x - target.x) * hint, y: target.y + (want.y - target.y) * hint } : hint > 0.3 ? want : null;
    }
    const writing = this.activity === 'writing' && !this.pinned;
    const phase = this.elapsed - this.activityStarted;
    const override = act?.gaze ?? (writing ? { yaw: Math.sin(phase * 3.8) * 0.28, pitch: -0.32, weight: 1 } : null);
    this.gazeState = this.gaze.update(dt, {
      target, override, headTurn: this.channels.turn, headNod: this.channels.nod,
      // Her eyes following a scrolling page and flicking back, her head nodding
      // with them, read as a grey band rolling through her eyes and her
      // sleeping face jerking (2026-10-23): none of that on a touch screen,
      // asleep or in a held pose; with a mouse, a gentler glance along.
      scroll: this.personalityOn && !look && !sleeping && !this.pinned && !this.light ? this.scrollSpeed / r * 0.5 : 0,
      blinkRate: this.personalityOn ? out.blinkRate : 14, blinkSlowness: this.personalityOn ? out.blinkSlowness : 1,
      roll: this.bodyFrame?.roll ?? 0, reducedMotion: this.reducedMotion,
    });

    // Face.
    // A held pose is most of her face, not all of it: her own feelings show
    // through the rest, so a long-held state still lives (the library poses at
    // full strength are the sheet's extremes). A brief reaction is stronger;
    // asleep is whole, or her eyes would be half open.
    const own: Partial<Record<Expression, number>> = this.personalityOn ? { ...out.blend } : this.activityBlend();
    let blend = own;
    if (this.pinned) {
      const w = this.pinned.expression === 'asleep' ? 1 : this.pinned.long ? 0.7 : 0.88;
      blend = {};
      for (const [name, value] of Object.entries(own) as [Expression, number][]) blend[name] = value * (1 - w);
      blend[this.pinned.expression] = Math.max(blend[this.pinned.expression] ?? 0, w);
    }
    if (act?.expression) blend[act.expression] = Math.max(blend[act.expression] ?? 0, act.weight);
    const overrides: Override[] = [];
    if (act) overrides.push({ values: act.values, weight: act.weight });
    this.mouthShape = this.speechShape(dt);
    if (this.isSpeaking()) {
      const s = this.mouthShape;
      overrides.push({ values: { jaw: clamp(0.04 + s.jaw * 0.9, 0, 1), round: s.round, mouthWide: s.wide * 0.7 - s.round * 0.45, teeth: s.teeth * 0.85 + s.wide * 0.2, press: s.press, tongue: 0 }, weight: 1 });
    }
    if (this.reducedMotion) { this.zip.value = this.voiceEnabled ? 0 : 1; this.zip.velocity = 0; }
    else {
      this.zip.velocity += ((this.voiceEnabled ? 0 : 1) - this.zip.value) * 95 * dt - this.zip.velocity * 20 * dt;
      this.zip.value = clamp(this.zip.value + this.zip.velocity * dt, 0, 1);
    }
    if (this.zip.value > 0.4) overrides.push({ values: { jaw: 0, tongue: 0, teeth: 0, press: 0.5, round: 0 }, weight: this.zip.value });
    this.channels = this.rig.update(dt, blend, overrides, this.reducedMotion);
    // Stressed syllables lift the brows and nod the head a touch.
    const emphasis = this.isSpeaking() ? this.mouthShape.emphasis : 0;
    if (emphasis) {
      this.channels.browInL += 0.3 * emphasis; this.channels.browInR += 0.3 * emphasis;
      this.channels.browOutL += 0.2 * emphasis; this.channels.browOutR += 0.2 * emphasis;
    }
    // Active listening: a small nod on each stressed rise in the visitor's voice.
    if (this.listenNod > 0) {
      this.listenNod = Math.max(0, this.listenNod - dt * 2.2);
      const nod = Math.sin(Math.PI * (1 - this.listenNod));
      if (this.activity === 'listening') { this.channels.nod += 0.08 * nod; this.channels.browInL += 0.12 * nod; this.channels.browInR += 0.12 * nod; }
    }
    this.listenLevel *= Math.exp(-dt * 4);

    // The dominant pose may hold a symbol (a book while reading) or repeat one.
    const pose = FaceRig.emoteOf(this.dominantExpression());
    for (const shape of HELD_EMOTES) {
      this.emotes.sustain(shape, shape === pose || (!this.pinned && this.personalityOn && !!this.emoteWants[shape]));
    }
    if (pose && !HELD_EMOTES.has(pose)) {
      this.poseEmoteClock -= dt;
      if (this.poseEmoteClock <= 0) { this.emotes.spawn(pose, pose === 'star' ? 3 : 1); this.poseEmoteClock = pose === 'star' ? 2.8 : pose === 'z' ? 1.5 : 1.2; }
    } else this.poseEmoteClock = 0;
    this.emotes.update(dt, this.reducedMotion);
    this.updateTears(dt);
    const label = this.acts.playing ? ACT_LABELS[this.acts.playing] : expressionLabel(this.dominantExpression());
    if (label && !this.isSpeaking() && this.activity === 'idle') this.report(label);
  }

  private activityBlend(): Partial<Record<Expression, number>> {
    switch (this.activity) {
      case 'greeting': return { greeting: 1 };
      case 'thinking': return { thinking: 1 };
      case 'writing': return { writing: 1 };
      case 'listening': return { listening: 1 };
      case 'speaking': return { happy: 0.5 };
      default: return { happy: 0.25 };
    }
  }

  private dominantExpression(): Expression {
    if (this.pinned) return this.pinned.expression;
    const blend = this.personalityOn ? this.lastOutput?.blend ?? {} : this.activityBlend();
    let best: Expression = 'neutral', weight = 0.2;
    for (const [name, value] of Object.entries(blend) as [Expression, number][]) if (value > weight) { best = name; weight = value; }
    return best;
  }

  private speechShape(dt: number): MouthShape {
    if (performance.now() < this.externalUntil) return visemeShape(this.externalLevel, this.viseme);
    if (this.lipSync.attached) {
      const shape = this.lipSync.update(dt);
      if (shape.energy > 0.06) this.voiceUntil = this.elapsed + 0.3;
      return shape;
    }
    return { jaw: 0, wide: 0, round: 0, press: 0, teeth: 0, energy: 0, emphasis: 0 };
  }

  private bodyEvent(event: BodyEvent) {
    // A drop: wide eyes at the top, then the fall.
    if (event.type === 'hang') this.setExpression('surprised', 0.5);
    if (event.type === 'fall') this.setExpression('falling', 0.6);
    // Her body shows on her face (2026-11-10: the movement sheet's poses were drawn and never used):
    // pushing off into a leap, touching down from one, a bounce, a wall, and getting up after a throw.
    if (event.type === 'launch' && event.leap) this.setExpression('takeoff', 0.28);
    if (event.type === 'land' && event.speed > 9) this.setExpression('landing', 0.32);
    if (event.type === 'bounce') this.setExpression(event.speed > 18 ? 'shocked' : 'rebound', 0.4);
    if (event.type === 'wall') this.setExpression('wobbling', 0.6);
    if (event.type === 'released') this.setExpression(event.speed > 9 ? 'laughing' : 'surprised', 0.7);
    if (event.type === 'settled') this.setExpression(this.personality.feelings.dizziness > 0.4 ? 'exhausted' : 'laughing', 1.3);
    // What happens to her (a throw's bounce, a wall) is felt; a landing from her own hop is not,
    // or she cheered every hop on her way home and went dizzy from her own leaps.
    if (event.type === 'bounce' || event.type === 'wall') {
      this.personality.stimulus({ type: 'land', speed: event.speed });
      if (event.speed > 6) this.emit('bumped');
    }
    if (event.type === 'land' && this.returning) { this.returnAt = this.elapsed + 0.12; }
    if ((event.type === 'settled' || event.type === 'land') && this.placement === 'corner' && !this.returning
      && (Math.abs(this.body.restX - this.home.x) > this.radius * 0.4 || Math.abs(this.body.restY - this.home.y) > 1)) {
      // She picks herself up and heads back to her corner.
      this.returning = true; this.returnAt = this.elapsed + (event.type === 'settled' ? 1.4 : 0.6);
    }
  }

  private updateTears(dt: number) {
    const amount = this.channels.tears;
    this.tearClock += dt * amount * 2.2;
    if (this.tearClock > 1 && this.tears.length < 8 && !this.reducedMotion) {
      this.tearClock = 0;
      const side = this.rng() < 0.5 ? -1 : 1, length = clamp(amount, 0, 1);
      this.tears.push({ x: side * (0.55 + 0.06 * length), y: -0.3 - 0.45 * length, z: 1, vy: -0.4, side, age: 0 });
    }
    for (let i = this.tears.length - 1; i >= 0; i--) {
      const t = this.tears[i];
      t.age += dt;
      // Run down the fur under gravity with drag, hugging the head.
      t.vy += (-3 - t.vy * 2.2) * dt;
      t.y += t.vy * dt;
      t.x += t.side * dt * 0.05;
      t.z = Math.sqrt(Math.max(0, 1.08 * 1.08 - t.x * t.x - t.y * t.y));
      if (t.z < 0.3 || t.age > 1.6) this.tears.splice(i, 1);
    }
  }

  private report(state: string) {
    if (this.state === state || this.destroyed) return;
    this.state = state;
    this.onStateChange?.(state);
  }

  private emit(name: string) { this.onEvent?.(name); }

  private draw(dt = 0) {
    if (!this.width || !this.height || this.destroyed) return;
    const act = this.actFrame;
    const frame = this.body.frame(act?.body?.shiver ?? 0);
    this.bodyFrame = frame;
    const c = this.channels, g = this.gazeState;
    // Pop-in: ease out with a little overshoot (easeOutBack).
    const t = this.appear - 1, pop = this.appear < 1 ? 1 + 2.70158 * t * t * t + 1.70158 * t * t : 1;
    const r = this.radius * frame.scale * pop;
    let ox = frame.x, oy = frame.y, width = this.width, height = this.height, groundX = frame.groundX, groundY = frame.groundY;
    if (this.placement === 'corner') {
      // The canvas follows her; everything is drawn relative to it.
      this.boxLeft = Math.round(frame.x - this.box / 2);
      this.boxTop = Math.round(frame.y - this.box * 0.58);
      const shift = this.pageShift();
      const sway = this.swayFrame(dt);
      shift.x += sway.x; shift.y += sway.y;
      // Pinned to the bottom edge, a layer of a given height is placed from there (see `edge`).
      const up = (height: number) => (this.edge === 'bottom' ? height - this.height : 0);
      this.canvas.style.transform = `translate3d(${this.boxLeft + shift.x}px, ${this.boxTop + shift.y + up(this.box)}px, 0)`;
      ox -= this.boxLeft; oy -= this.boxTop; groundX -= this.boxLeft; groundY -= this.boxTop;
      width = height = this.box;
      const centre = this.bodyCentre(), size = this.radius * 2.5;
      if (this.hit) {
        this.hit.style.width = this.hit.style.height = `${size}px`;
        this.hit.style.transform = `translate3d(${centre.x - size / 2 + shift.x}px, ${centre.y - size / 2 + shift.y + up(size)}px, 0)`;
      }
      if (this.badge && this.badgeCount) {
        this.badge.style.transform = `translate3d(${centre.x + this.radius * 0.72 + shift.x}px, ${centre.y - this.radius * 1.15 + shift.y + up(20)}px, 0) translate(-50%, -50%)`;
      }
      this.frameListener?.({ x: centre.x + sway.x, y: centre.y + sway.y, radius: this.radius * frame.scale, page: this.pageAt ? this.pageShift() : null, edge: this.edge, height: this.height });
    }
    const blink = g?.blink ?? 0;
    const closed = (value: number) => clamp(value * (1 - blink), 0, 1);
    const tracked = g?.eyes ?? [{ yaw: 0, pitch: 0 }, { yaw: 0, pitch: 0 }];
    // Dizzy eyes wander apart: one up and out, the other down and in.
    const w = clamp(c.wonky, 0, 1), wob = Math.sin(this.elapsed * 2.6) * 0.12 * w;
    const eyes = [
      { yaw: tracked[0].yaw - 0.32 * w + wob, pitch: tracked[0].pitch + 0.3 * w },
      { yaw: tracked[1].yaw + 0.28 * w - wob, pitch: tracked[1].pitch - 0.26 * w },
    ];
    const zip = Math.max(this.zip.value, clamp(c.zip, 0, 1));
    const { shape, mix } = this.rig.pupilShape();
    const mouth: MouthFrame = {
      jaw: clamp(c.jaw, 0, 1) * (1 - zip), wide: c.mouthWide, round: clamp(c.round, 0, 1), press: clamp(c.press, 0, 1),
      smileL: clamp(c.smileL, -1, 1), smileR: clamp(c.smileR, -1, 1), shift: clamp(c.shift, -1, 1), wobble: clamp(c.wobble, 0, 1),
      tongue: clamp(c.tongue, 0, 1) * (1 - zip), teeth: clamp(c.teeth, 0, 1), zip, tongueWiggle: act?.tongueWiggle ?? 0,
    };
    const tint = c.tint;
    const colour = this.rgb.map(v => {
      // Flush deeper when cross, wash out a little when sad.
      const grey = (this.rgb[0] + this.rgb[1] + this.rgb[2]) / 3;
      return clamp(tint >= 0 ? v * (1 - 0.12 * tint) + (v - grey) * 0.25 * tint : v + (grey - v) * -0.35 * tint - 0.04 * -tint, 0, 1);
    }) as [number, number, number];
    const frameData: RenderFrame = {
      width, height, dpr: this.dpr, x: ox, y: oy, radius: r,
      pivot: frame.pivot, deform: frame.deform,
      yaw: g?.headYaw ?? 0, pitch: g?.headPitch ?? 0, roll: frame.roll + c.tilt,
      groundX, groundY, lift: frame.lift, shadow: 1 - frame.hidden,
      eyes: [
        { yaw: eyes[0].yaw, pitch: eyes[0].pitch, lidUp: closed(c.lidUpL), lidLow: clamp(c.lidLowL, 0, 1), slant: c.slantL },
        { yaw: eyes[1].yaw, pitch: eyes[1].pitch, lidUp: closed(c.lidUpR), lidLow: clamp(c.lidLowR, 0, 1), slant: c.slantR },
      ],
      pupil: clamp(c.pupil, 0.5, 1.6), wide: clamp(c.wide, 0, 1), wet: clamp(c.wet, 0, 1),
      shape: shape === 'heart' ? 1 : shape === 'spiral' ? 2 : shape === 'star' ? 3 : 0, shapeMix: mix,
      browIn: [c.browInL, c.browInR], browOut: [c.browOutL, c.browOutR],
      mouth, blush: clamp(c.blush, 0, 1), tearStreak: clamp(c.tears, 0, 1), tuftLift: clamp(c.tuft, -1, 1),
      tears: this.tears.map(t => ({ x: t.x, y: t.y, z: t.z, size: 0.045 })),
      emotes: this.emotes.sprites(),
      color: colour, time: this.elapsed, dt, vx: this.body.vx, vy: this.body.vy,
      ...(this.petStrength > 0.1 && this.pointer.active ? { pet: { point: this.petPoint(), strength: this.petStrength * 0.6 } } : {}),
      reducedMotion: this.reducedMotion,
    };
    this.renderer.render(frameData);
  }

  /** The pointer, projected onto her head in body-local coordinates. */
  private petPoint(): [number, number, number] {
    const c = this.bodyCentre();
    const x = clamp((this.pointer.x - c.x) / this.radius, -0.9, 0.9), y = clamp(-(this.pointer.y - c.y) / this.radius, -0.9, 0.95);
    return [x, y, Math.sqrt(Math.max(0.05, 1 - x * x - y * y))];
  }
}
