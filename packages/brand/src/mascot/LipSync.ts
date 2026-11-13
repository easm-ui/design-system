/**
 * Mouth shapes from the sound itself. Loudness alone only opens and closes a
 * mouth; the shape of a vowel lives in its formants. The first formant (F1)
 * rises as the jaw opens (/a/ is high, /i/ and /u/ low); the second (F2)
 * rises as the lips spread (/i/ is high) and falls as they round (/u/, /o/).
 * Fricatives (s, f, sh) put their energy above 3.5 kHz; nasals (m, n) hum
 * below 300 Hz with closed lips. Formants are estimated here as power-
 * weighted centroids inside each formant's usual band: coarse, cheap, and
 * good enough for a cartoon mouth, but not phoneme recognition.
 *
 * Levels adapt to the voice (a tracked noise floor and peak), so a quiet
 * and a loud speaker both use the full mouth. The analyser taps the signal
 * before it reaches the speakers, so frames are held back by the context's
 * output latency to land on the sound the visitor actually hears.
 *
 * Two sources. `attach` taps an audio graph with an AnalyserNode. `feed` takes
 * the PCM a player schedules, with its start time on the playback clock, and
 * analyses the samples playing right now with its own FFT: WebKit can keep a
 * graph audible while an AnalyserNode returns zeros, so the live voice call
 * (which already reads its own PCM for the same reason) uses `feed`.
 */
export type MouthShape = {
  jaw: number; wide: number; round: number; press: number; teeth: number;
  /** 0..1 speech energy, and a short pulse on stressed onsets. */
  energy: number; emphasis: number;
};
export type Viseme = 'rest' | 'aa' | 'ee' | 'oh' | 'fv' | 'mm';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const SILENT: MouthShape = { jaw: 0, wide: 0, round: 0, press: 0, teeth: 0, energy: 0, emphasis: 0 };
const WINDOW = 512;

/** In-place iterative radix-2 FFT (length a power of two). */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = -2 * Math.PI / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const c = Math.cos(step * k), s = Math.sin(step * k);
        const a = start + k, b = a + size / 2;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}
type Frame = { start: number; end: number; samples: Float32Array; rate: number };

export function visemeShape(level: number, viseme?: Viseme): MouthShape {
  const energy = Math.max(0, Math.min(1, level));
  switch (viseme) {
    case 'aa': return { ...SILENT, jaw: 0.85 * energy + 0.1, energy };
    case 'ee': return { ...SILENT, jaw: 0.3 * energy, wide: 1, teeth: 0.4, energy };
    case 'oh': return { ...SILENT, jaw: 0.5 * energy + 0.1, round: 1, energy };
    case 'fv': return { ...SILENT, jaw: 0.1, teeth: 1, press: 0.3, energy };
    case 'mm': case 'rest': return { ...SILENT, press: viseme === 'mm' ? 1 : 0, energy };
    default: return { ...SILENT, jaw: energy * 0.85, energy };
  }
}

export class LipSync {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frequency = new Float32Array(0);
  private time = new Float32Array(0);
  private floor = -60;
  private peak = -20;
  private previousLoud = 0;
  private readonly shape: MouthShape = { ...SILENT };
  private readonly queue: { at: number; shape: MouthShape }[] = [];
  private emphasis = 0;
  private clock: AudioContext | null = null;
  private frames: Frame[] = [];
  private readonly re = new Float32Array(WINDOW);
  private readonly im = new Float32Array(WINDOW);
  private readonly power = new Float32Array(WINDOW / 2);
  private analyserPower = new Float32Array(0);

  get attached() { return !!this.analyser || !!this.clock; }

  /** Speech a player has scheduled: PCM16 or float samples starting at `startTime` on `context`'s clock. */
  feed(context: AudioContext, pcm: Int16Array | Float32Array, sampleRate: number, startTime: number) {
    if (this.analyser) this.detach();
    if (this.clock !== context) this.frames = [];
    this.clock = context;
    const samples = pcm instanceof Float32Array ? pcm : Float32Array.from(pcm, v => v / 0x8000);
    this.frames.push({ start: startTime, end: startTime + samples.length / sampleRate, samples, rate: sampleRate });
    const now = context.currentTime;
    while (this.frames.length && this.frames[0].end < now - 0.5) this.frames.shift();
  }

  /** Drops queued speech (barge-in, hang-up) so the mouth stops with the sound. */
  clearFeed() { this.frames = []; }

  attach(context: AudioContext, source: AudioNode) {
    this.detach();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    this.context = context;
    this.analyser = analyser;
    this.frequency = new Float32Array(analyser.frequencyBinCount);
    this.analyserPower = new Float32Array(analyser.frequencyBinCount);
    this.time = new Float32Array(analyser.fftSize);
    this.queue.length = 0;
  }

  detach() {
    try { this.analyser?.disconnect(); } catch { /* Already disconnected. */ }
    this.analyser = null; this.context = null; this.queue.length = 0;
    this.clock = null; this.frames = [];
    Object.assign(this.shape, SILENT);
  }

  /** Power spectrum and level of what is playing now, from either source. */
  private measure(): { power: Float32Array; binHz: number; db: number; bins: number } | null {
    const analyser = this.analyser, context = this.context;
    if (analyser && context) {
      analyser.getFloatTimeDomainData(this.time);
      analyser.getFloatFrequencyData(this.frequency);
      let sum = 0;
      for (let i = 0; i < this.time.length; i++) sum += this.time[i] * this.time[i];
      for (let i = 0; i < this.frequency.length; i++) this.analyserPower[i] = Math.pow(10, this.frequency[i] / 10);
      return { power: this.analyserPower, binHz: context.sampleRate / analyser.fftSize, db: 10 * Math.log10(sum / this.time.length + 1e-12), bins: this.frequency.length };
    }
    const clock = this.clock;
    if (!clock) return null;
    // The sound reaching the speakers now was scheduled outputLatency ago.
    const now = clock.currentTime - (clock.outputLatency || 0) - (clock.baseLatency || 0);
    const frame = this.frames.find(f => f.start <= now && now < f.end);
    if (!frame) return { power: this.power.fill(0), binHz: 1, db: -120, bins: 0 };
    const centre = Math.floor((now - frame.start) * frame.rate);
    let sum = 0;
    for (let i = 0; i < WINDOW; i++) {
      // Hann-windowed samples around the playhead, borrowing from neighbours.
      const index = centre - WINDOW / 2 + i;
      let v = 0;
      if (index >= 0 && index < frame.samples.length) v = frame.samples[index];
      else {
        const t = frame.start + index / frame.rate;
        const other = this.frames.find(f => f !== frame && f.start <= t && t < f.end);
        if (other) v = other.samples[Math.floor((t - other.start) * other.rate)] ?? 0;
      }
      sum += v * v;
      this.re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WINDOW - 1)));
      this.im[i] = 0;
    }
    fft(this.re, this.im);
    for (let i = 0; i < WINDOW / 2; i++) this.power[i] = (this.re[i] * this.re[i] + this.im[i] * this.im[i]) / WINDOW;
    return { power: this.power, binHz: frame.rate / WINDOW, db: 10 * Math.log10(sum / WINDOW + 1e-12), bins: WINDOW / 2 };
  }

  /** Returns the mouth shape due on the speakers now. */
  update(dt: number): MouthShape {
    const measured = this.measure();
    if (!measured) return SILENT;
    const { power: spectrum, binHz, db, bins } = measured;
    // Adaptive range: floor falls fast and creeps up; peak rises fast and decays.
    this.floor = db < this.floor ? db : Math.min(this.floor + dt * 0.8, -30);
    this.floor = Math.max(this.floor, -90);
    this.peak = db > this.peak ? db : Math.max(this.peak - dt * 3, this.floor + 18);
    const loud = smoothstep(this.floor + 8, this.peak - 2, db);

    let nasal = 0, low = 0, mid = 0, high = 0, f1Power = 0, f1Moment = 0, f2Power = 0, f2Moment = 0;
    for (let i = 1; i < bins; i++) {
      const hz = i * binHz;
      if (hz > 9000) break;
      const power = spectrum[i];
      if (hz >= 90 && hz < 320) nasal += power;
      if (hz >= 90 && hz < 1000) low += power;
      if (hz >= 1000 && hz < 3000) mid += power;
      if (hz >= 3500) high += power;
      if (hz >= 260 && hz < 1000) { f1Power += power; f1Moment += power * hz; }
      if (hz >= 900 && hz < 2900) { f2Power += power; f2Moment += power * hz; }
    }
    const f1 = f1Power > 0 ? f1Moment / f1Power : 500;
    const f2 = f2Power > 0 ? f2Moment / f2Power : 1500;
    const fricative = smoothstep(0.32, 0.65, high / (low + mid + high + 1e-12)) * smoothstep(0.02, 0.2, loud);
    const voiced = loud * (1 - fricative);
    const nasality = smoothstep(0.5, 0.8, nasal / (low + mid + 1e-12)) * smoothstep(0.1, 0.4, loud) * (1 - smoothstep(0.4, 0.9, loud));

    const target: MouthShape = {
      jaw: voiced * (0.3 + 0.7 * smoothstep(320, 760, f1)) * (1 - nasality * 0.8) + fricative * 0.12,
      wide: smoothstep(1450, 2200, f2) * voiced,
      round: (1 - smoothstep(950, 1450, f2)) * smoothstep(0.08, 0.3, voiced) * (1 - 0.5 * smoothstep(650, 900, f1)),
      press: nasality,
      teeth: fricative,
      energy: loud,
      emphasis: 0,
    };
    // Stressed syllables arrive as sharp rises in energy.
    const rise = (loud - this.previousLoud) / Math.max(dt, 1e-3);
    this.previousLoud = loud;
    if (rise > 9 && loud > 0.55) this.emphasis = 1;
    this.emphasis = Math.max(0, this.emphasis - dt * 4);
    target.emphasis = this.emphasis;

    // Fast attack, slower release, as a jaw and lips have mass.
    const ease = (key: keyof MouthShape, attack: number, release: number) => {
      const tau = target[key] > this.shape[key] ? attack : release;
      this.shape[key] += (target[key] - this.shape[key]) * (1 - Math.exp(-dt / tau));
    };
    ease('jaw', 0.03, 0.075); ease('wide', 0.05, 0.08); ease('round', 0.05, 0.09);
    ease('press', 0.03, 0.06); ease('teeth', 0.03, 0.06); ease('energy', 0.03, 0.12);
    this.shape.emphasis = target.emphasis;

    // Fed speech was already read at the speakers' time; a tapped graph is
    // read ahead of them, so its shapes wait out the output latency.
    const context = this.context;
    if (!this.analyser || !context) return { ...this.shape };
    const latency = (context.outputLatency || 0) + (context.baseLatency || 0);
    const now = context.currentTime;
    this.queue.push({ at: now + latency, shape: { ...this.shape } });
    let due = this.queue[0].shape;
    while (this.queue.length > 1 && this.queue[1].at <= now) { this.queue.shift(); due = this.queue[0].shape; }
    if (this.queue.length > 120) this.queue.splice(0, this.queue.length - 120);
    return due;
  }
}
