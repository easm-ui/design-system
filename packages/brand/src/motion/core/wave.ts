// The EASM voice waveform: a row of orange pills (the rails' shape) whose modes blend into one another.
//   idle       a still row of dots (the mic is closed, nothing is playing)
//   loading    the row of dots with a wave running through it: each dot swells into a short pill as the wave passes
//   listening  the user's voice (a microphone MediaStream, or any level): tallest in the middle, rippling outward; in
//              silence the dots breathe, so the user can see the mic is open
//   speaking   EASM's voice (its TTS audio, or any level); without one, the EASM voice's own rhythm
// Every bar samples one smooth field (a centred envelope × two slow travelling waves), so neighbouring bars always
// agree: the row moves as one shape, never as independent jitter. Bars change size, never opacity (orange at half
// opacity over a dark surface reads as brown).

import { clamp, lerp, smooth, ease, follow, spring } from './math';
import { motionOff, reducedMotionQuery, watchMotionSwitch, latestIntersection, nameSvg } from './brand';
import { escapeMarkup } from './markup';
import { WAVE_LABELS } from './meta';
import { voiceAt } from './voice';
import { levelReader, type LevelInput, type LevelMeterOptions } from './audio';

export type WaveMode = 'idle' | 'loading' | 'listening' | 'speaking';
/** Earlier names, still accepted: `voice` is speaking, `live` is listening. */
export type WaveModeInput = WaveMode | 'voice' | 'live';
export const waveMode = (m: WaveModeInput | undefined): WaveMode =>
  m === 'voice' ? 'speaking' : m === 'live' ? 'listening' : m ?? 'speaking';

/** Grid units: each bar sits in a 10-wide slot; the row is 60 high. Seconds for the timings. */
export const WAVE = { pitch: 10, bar: 5, dot: 3.6, height: 60, maxBar: 56, loadPeriod: 1.4, ripple: 0.016, blend: 0.45 } as const;

export const waveViewBox = (bars: number): string => `0 0 ${bars * WAVE.pitch} ${WAVE.height}`;

export function waveMarkup(bars: number, color: string): string {
  let s = '';
  const d = WAVE.dot, y = (WAVE.height - d) / 2, fill = escapeMarkup(color);
  for (let i = 0; i < bars; i++) {
    const x = i * WAVE.pitch + (WAVE.pitch - d) / 2;
    s += `<rect data-easm="bar" x="${x}" y="${y}" width="${d}" height="${d}" rx="${d / 2}" fill="${fill}"/>`;
  }
  return s;
}

export interface WaveParts { svg: SVGSVGElement; bars: SVGRectElement[] }
export const collectWaveParts = (svg: SVGSVGElement): WaveParts => ({ svg, bars: Array.from(svg.querySelectorAll<SVGRectElement>('[data-easm=bar]')) });

export interface WaveEngineOptions {
  mode?: WaveModeInput;
  level?: LevelInput;
  meter?: LevelMeterOptions;
  /** Keep the svg's accessible name in step with the mode (WAVE_LABELS), as mountWaveform() does. The React component
   *  names the svg itself and leaves this off. */
  labels?: boolean;
  /** A fixed accessible name instead of the mode's ('' makes the waveform decorative). Implies `labels`. */
  label?: string;
}

const MODES: WaveMode[] = ['idle', 'loading', 'listening', 'speaking'];
const TAU = Math.PI * 2;

/** The loading wave at row position x (0 = left, 1 = right) and time t: 0 at rest, 1 at the crest. One crest, about a
 *  third of the row wide, crosses left to right at a steady speed in the first 70% of each period; then the row rests.
 *  (Steady, so every bar runs the same motion, only later: the static SVG shares one set of keyframes.) */
export function loadingWave(x: number, t: number): number {
  const W = 0.2, ph = t / WAVE.loadPeriod, f = ph - Math.floor(ph);
  const c = -W + ((1 + 2 * W) * f) / 0.7;          // where the crest is (it is off the row while resting)
  const d = Math.abs(x - c) / W;
  return d >= 1 ? 0 : Math.cos((d * Math.PI) / 2) ** 2;
}
/** How much later each bar's loading motion runs than the first bar's, in periods, for a bar at x. */
export const loadingLag = (x: number): number => (0.7 * x) / 1.4;

export class WaveEngine {
  private mode: WaveMode;
  private from: number[];
  private weights: number[];
  private blendAt = -1;
  private start = 0;
  private raf = 0;
  private manual = false;
  private last = 0;
  private visible = true;
  private io?: IntersectionObserver;
  private mq?: MediaQueryList;
  private reader: ReturnType<typeof levelReader>;
  private hasLevel: boolean;
  private meter?: LevelMeterOptions;
  private labelled: boolean;
  private label?: string;
  private unwatch: () => void = () => {};
  private quiet = 1;
  // the level's recent history, so each bar can show it a few milliseconds late (the ripple out from the middle)
  private histT = new Float64Array(160).fill(-1e9);
  private histL = new Float32Array(160);
  private head = 0;
  private lv = 0;   // the level, after the spring
  private lvV = 0;
  private bw: Float32Array;   // each bar's width, after its own spring (dot ↔ bar changes are never sudden)
  private bwV: Float32Array;

  constructor(private parts: WaveParts, options: WaveEngineOptions = {}) {
    this.mode = waveMode(options.mode);
    this.bw = new Float32Array(parts.bars.length).fill(WAVE.dot);
    this.bwV = new Float32Array(parts.bars.length);
    this.weights = MODES.map(m => (m === this.mode ? 1 : 0));
    this.from = this.weights.slice();
    this.meter = options.meter;
    this.label = options.label;
    this.labelled = !!options.labels || options.label !== undefined;
    this.hasLevel = options.level != null;
    this.reader = levelReader(options.level, () => 0, this.meter);
    this.start = this.now();
    if (typeof window !== 'undefined') {
      this.mq = reducedMotionQuery() ?? undefined;
      this.mq?.addEventListener?.('change', this.kick);
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(e => { this.visible = latestIntersection(e); this.kick(); });
        this.io.observe(parts.svg);
      }
      this.unwatch = watchMotionSwitch(parts.svg, this.kick);
    }
    this.named();
    this.kick();
  }

  private now(): number { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000; }

  get current(): WaveMode { return this.mode; }

  /** Changes mode; the bars blend into the new behaviour over 0.45 s. `at` sets the clock (offline rendering only). */
  setMode(input: WaveModeInput, at?: number): void {
    const m = waveMode(input);
    if (m === this.mode) return;
    const t = at ?? this.now();
    this.from = this.weights.slice();
    this.blendAt = t;
    this.mode = m;
    if (m === 'speaking') this.start = t;
    this.named();
    this.kick();
  }
  /** Sets a fixed accessible name ('' = decorative); pass nothing to name the svg after the mode again. */
  setLabel(label?: string): void { this.label = label; this.labelled = true; this.named(); }

  /** Writes the accessible name on the svg when the engine manages it (mountWaveform, or the labels option). */
  private named(): void {
    if (this.labelled) nameSvg(this.parts.svg, this.label ?? WAVE_LABELS[this.mode]);
  }
  setLevel(input: LevelInput): void {
    this.reader.dispose();
    this.hasLevel = input != null;
    this.reader = levelReader(input, () => 0, this.meter);
  }
  /** Stops the clock-driven loop (for offline rendering with render()). */
  pause(): void { this.manual = true; cancelAnimationFrame(this.raf); this.raf = 0; }
  setColor(color: string): void { this.parts.bars.forEach(b => b.setAttribute('fill', color)); }

  private histAt(t: number): number {
    const n = this.histT.length;
    for (let k = 0; k < n - 1; k++) {
      const i = (this.head - 1 - k + n * 2) % n, j = (i - 1 + n) % n;
      if (this.histT[j] <= t) {
        const span = this.histT[i] - this.histT[j];
        return span > 0 ? lerp(this.histL[j], this.histL[i], clamp((t - this.histT[j]) / span)) : this.histL[i];
      }
    }
    return this.histL[this.head];   // older than the whole history: the oldest value kept
  }

  private kick = (): void => {
    if (typeof window === 'undefined' || this.manual) return;
    if (motionOff(this.parts.svg)) { cancelAnimationFrame(this.raf); this.raf = 0; this.still(); return; }
    if (!this.raf && this.visible) { this.last = this.now(); this.raf = requestAnimationFrame(this.frame); }
  };

  /** Reduced motion: a quiet row of dots. */
  private still(): void { this.parts.bars.forEach((el, i) => this.put(el, i, WAVE.dot, WAVE.dot, 0)); }

  private frame = (): void => {
    this.raf = 0;
    if (motionOff(this.parts.svg)) { this.kick(); return; }
    const t = this.now(), dt = Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    this.render(t, dt);
    if (this.visible && (this.mode !== 'idle' || this.blendAt >= 0)) this.raf = requestAnimationFrame(this.frame);
  };

  private put(el: SVGRectElement, i: number, w: number, h: number, dy: number): void {
    el.setAttribute('x', (i * WAVE.pitch + (WAVE.pitch - w) / 2).toFixed(2));
    el.setAttribute('width', w.toFixed(2));
    el.setAttribute('rx', (w / 2).toFixed(2));
    el.setAttribute('height', h.toFixed(2));
    el.setAttribute('y', ((WAVE.height - h) / 2 + dy).toFixed(2));
  }

  /** Draws the frame at time t (also used by tests and exports with a fixed clock). `level` overrides the source. */
  render(t: number, dt: number, level?: number): void {
    const target = MODES.map(m => (m === this.mode ? 1 : 0));
    if (this.blendAt >= 0) {
      const w = ease.io(clamp((t - this.blendAt) / WAVE.blend));
      this.weights = this.from.map((f, k) => lerp(f, target[k], w));
      if (w >= 1) this.blendAt = -1;
    } else this.weights = target;
    const [, wLoad, wListen, wSpeak] = this.weights;
    // one level drives both voice modes: the given source, or (speaking without one) the EASM voice's rhythm
    let L = 0;
    if (wListen > 0 || wSpeak > 0) {
      L = level ?? (this.hasLevel ? this.reader.read(t, dt) : wSpeak > 0 ? voiceAt(t - this.start) : 0);
      L = clamp(L) * (wListen + wSpeak);
    }
    // a spring between the audio and the bars: loud onsets arrive as a quick, smooth rise instead of a step
    [this.lv, this.lvV] = spring(this.lv, this.lvV, L, dt, 42);
    L = Math.max(0, this.lv);
    this.histT[this.head] = t; this.histL[this.head] = L; this.head = (this.head + 1) % this.histT.length;
    // how silent it has been lately (the breathing dots only come in after a moment of quiet)
    this.quiet = follow(this.quiet, L < 0.03 ? 1 : 0, dt, 0.5, 0.08);
    const N = this.parts.bars.length, c = (N - 1) / 2;
    this.parts.bars.forEach((el, i) => {
      const x = N > 1 ? Math.abs(i - c) / c : 0;     // 0 in the middle, 1 at either end
      // the voice: a centred envelope × two slow waves running outward, read a little later the further out the bar is
      const env = 0.26 + 0.74 * Math.cos((Math.PI / 2) * x) ** 1.6;
      const tex = 0.7 + 0.3 * (0.55 * Math.sin(TAU * (1.1 * x - 0.9 * t)) + 0.45 * Math.sin(TAU * (2.3 * x - 1.45 * t) + 1.3));
      const v = this.histAt(t - WAVE.ripple * Math.abs(i - c)) * env * tex * 1.22;
      const voiceH = WAVE.bar + (WAVE.maxBar - WAVE.bar) * clamp(v) ** 0.9;
      // breathing dots for an open mic in silence: a slow swell running out from the middle
      const breath = 0.5 + 0.5 * Math.sin(TAU * (t / 1.8 - x * 0.7));
      const lw = loadingWave(i / Math.max(1, N - 1), t);
      // each mode's bar: width (dot → bar), height
      let w = 0, h = 0;
      w += this.weights[0] * WAVE.dot; h += this.weights[0] * WAVE.dot;
      if (wLoad > 0) { const s = smooth(lw); w += wLoad * lerp(WAVE.dot, WAVE.bar, s); h += wLoad * lerp(WAVE.dot, 17, s ** 1.3); }
      if (wListen > 0) {
        const q = this.quiet * (wListen / Math.max(1e-6, wListen + wSpeak));
        const restW = lerp(WAVE.dot, WAVE.dot + 0.9 * breath, q), restH = lerp(WAVE.dot, WAVE.dot + 2.2 * breath, q);
        const k = smooth(clamp((voiceH - WAVE.bar) / 4));  // voice → full bar width; silence → the breathing dot
        w += wListen * lerp(restW, WAVE.bar, k); h += wListen * Math.max(lerp(restH, voiceH, k), restH);
      }
      if (wSpeak > 0) { const k = smooth(clamp((voiceH - WAVE.bar) / 4)); w += wSpeak * lerp(WAVE.dot, WAVE.bar, k); h += wSpeak * lerp(WAVE.dot, voiceH, k); }
      const [bw, bv] = spring(this.bw[i], this.bwV[i], w, dt, 30);
      this.bw[i] = bw; this.bwV[i] = bv;
      this.put(el, i, bw, Math.max(bw, h), 0);
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.reader.dispose();
    this.io?.disconnect();
    this.mq?.removeEventListener?.('change', this.kick);
    this.unwatch();
  }
}
