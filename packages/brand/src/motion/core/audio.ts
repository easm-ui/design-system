// Turns real audio into a smooth 0–1 level the animations can follow: EASM's own speech (an <audio>/<video> element, a
// Web Audio AnalyserNode, or a MediaStream from a call) or the user's microphone (a MediaStream from getUserMedia).

import { clamp, follow } from './math';

export type AudioSource = MediaStream | HTMLMediaElement | AnalyserNode;
/** What drives a voice animation: real audio, a number you update (0–1), or a function read every frame. */
export type LevelInput = AudioSource | number | (() => number) | null | undefined;

let shared: AudioContext | null = null;
/** One AudioContext for the page (browsers limit how many can exist). Created on first use. */
export function audioContext(): AudioContext {
  if (!shared) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    shared = new Ctx();
    keepRunning(shared);
  }
  return shared;
}

/** Asks a suspended context to run (browsers only allow it after a user gesture; a refusal is harmless). */
function resume(ctx: BaseAudioContext): void {
  const c = ctx as AudioContext;
  if (c.state !== 'running' && c.state !== 'closed' && typeof c.resume === 'function') c.resume().catch(() => {});
}

// A context created before the page had a user gesture starts suspended, and Safari can suspend one later (a phone
// call, the tab in the background). While it is not running, the first pointer or key press anywhere resumes it, so a
// captured <audio> element is never left silent waiting for an animation frame (none run under reduced motion,
// off-screen or between voice states).
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
function keepRunning(ctx: AudioContext): void {
  if (typeof document === 'undefined') return;
  const onGesture = () => resume(ctx);
  let armed = false;
  const sync = () => {
    const want = ctx.state !== 'running' && ctx.state !== 'closed';
    if (want === armed) return;
    armed = want;
    for (const g of GESTURES) {
      if (want) document.addEventListener(g, onGesture, { capture: true, passive: true });
      else document.removeEventListener(g, onGesture, { capture: true });
    }
  };
  if (typeof ctx.addEventListener === 'function') ctx.addEventListener('statechange', sync);
  sync();
}

/** Creates (if needed) and resumes the page's shared AudioContext. Call it from a click or key handler, such as the
 *  button that starts a voice session, before EASM's speech plays: a context resumed inside a user gesture is allowed
 *  to run everywhere, including Safari. */
export function primeEasmAudio(): void {
  if (typeof window === 'undefined') return;
  try { resume(audioContext()); } catch { /* no Web Audio: the animations fall back to the EASM voice's rhythm */ }
}

// An element can only ever get one MediaElementAudioSourceNode, so they are cached and shared, and routed to the
// speakers once so the audio stays audible.
const elementNodes = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

/** Whether an element's audio can be read without muting it: null while it has no source yet. Media from another
 *  origin without CORS (`crossOrigin` unset) would come out of Web Audio as silence, so it is never captured. */
function readable(el: HTMLMediaElement): boolean | null {
  if (el.srcObject) return true;
  const src = el.currentSrc || el.src;
  if (!src) return null;
  try {
    const url = new URL(src, typeof document !== 'undefined' ? document.baseURI : undefined);
    if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
    return (typeof location !== 'undefined' && url.origin === location.origin) || el.crossOrigin != null;
  } catch { return false; }
}

export interface LevelMeterOptions {
  /** Loudness (dBFS) that maps to 0. Default −58. */
  floorDb?: number;
  /** Loudness (dBFS) that maps to 1. Default −16. */
  ceilDb?: number;
  /** Rise and fall times in seconds. Default 0.025 and 0.16: syllables stay crisp, nothing flickers. */
  attack?: number;
  release?: number;
  /** Called when the source cannot be read (no Web Audio, media from another origin without CORS, an element already
   *  captured elsewhere). The animation then follows its fallback (the EASM voice's rhythm, or silence). */
  onError?: (error: unknown) => void;
}

/** Reads the loudness of an audio source, smoothed, as 0–1. Call read() once per animation frame.
 *  An <audio>/<video> element is only routed through Web Audio on the first read(), so an animation that never runs
 *  (reduced motion, off-screen, a state that does not follow the voice) never touches the element's sound. */
export class LevelMeter {
  private analyser: AnalyserNode;
  private input: AudioNode | null = null;
  private element: HTMLMediaElement | null = null;
  private buf: Float32Array<ArrayBuffer>;
  private value = 0;
  private broken = false;
  private opts: Required<Omit<LevelMeterOptions, 'onError'>>;
  private onError?: (error: unknown) => void;

  constructor(source: AudioSource, options: LevelMeterOptions = {}) {
    const { onError, ...levels } = options;
    this.opts = { floorDb: -58, ceilDb: -16, attack: 0.025, release: 0.16, ...levels };
    this.onError = onError;
    if (typeof AnalyserNode !== 'undefined' && source instanceof AnalyserNode) {
      this.analyser = source;
    } else {
      const ctx = audioContext();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0;
      if (typeof MediaStream !== 'undefined' && source instanceof MediaStream) {
        this.input = ctx.createMediaStreamSource(source); // not routed to the speakers: no echo of the microphone
        this.input.connect(this.analyser);
      } else {
        this.element = source as HTMLMediaElement; // captured on the first read()
      }
    }
    this.buf = new Float32Array(this.analyser.fftSize);
  }

  /** True once the source turned out to be unreadable (see LevelMeterOptions.onError); read() then returns 0. */
  get failed(): boolean { return this.broken; }

  /** Routes the element through the shared context. False while it cannot be read yet (or ever). */
  private attach(): boolean {
    const el = this.element!;
    const ok = readable(el);
    if (ok === null) return false;
    if (!ok) { this.fail(new Error('EASM motion: media from another origin without CORS cannot be measured; it plays unchanged.')); return false; }
    try {
      const ctx = this.analyser.context as AudioContext;
      let node = elementNodes.get(el);
      if (!node) {
        node = ctx.createMediaElementSource(el);
        node.connect(ctx.destination);
        elementNodes.set(el, node);
        // from now on the element is heard through the context: make sure it runs whenever the element plays
        el.addEventListener('play', () => resume(ctx));
      }
      node.connect(this.analyser);
      this.input = node;
      resume(ctx);
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  private fail(error: unknown): void {
    if (this.broken) return;
    this.broken = true;
    this.element = null;
    this.onError?.(error);
  }

  /** The smoothed level, 0–1. dt is the time since the last call, in seconds. */
  read(dt: number): number {
    if (this.broken || (this.element && !this.input && !this.attach())) {
      return (this.value = follow(this.value, 0, dt, this.opts.attack, this.opts.release));
    }
    resume(this.analyser.context);
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    const db = 20 * Math.log10(Math.sqrt(s / this.buf.length) + 1e-9);
    let n = clamp((db - this.opts.floorDb) / (this.opts.ceilDb - this.opts.floorDb));
    n = n < 0.04 ? 0 : Math.pow(n, 1.1);
    this.value = follow(this.value, n, dt, this.opts.attack, this.opts.release);
    return this.value;
  }

  dispose(): void {
    if (this.input) { try { this.input.disconnect(this.analyser); } catch { /* already gone */ } }
  }
}

/** A level reader for any LevelInput. Returns a function to call each frame, and a cleanup. */
export function levelReader(input: LevelInput, fallback: (t: number) => number, options?: LevelMeterOptions) {
  let meter: LevelMeter | null = null;
  let held = 0;
  if (input && typeof input === 'object') {
    try { meter = new LevelMeter(input, options); } catch (error) { meter = null; options?.onError?.(error); }
  }
  return {
    read(t: number, dt: number): number {
      if (meter) {
        const v = meter.read(dt);
        if (!meter.failed) return v;
        meter.dispose();
        meter = null;
      }
      if (typeof input === 'number') return (held = follow(held, clamp(input), dt, 0.025, 0.16));
      if (typeof input === 'function') return (held = follow(held, clamp(input()), dt, 0.025, 0.16));
      return fallback(t);
    },
    dispose(): void { meter?.dispose(); },
  };
}
