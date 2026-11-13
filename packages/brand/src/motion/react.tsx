// React components for the EASM app animations. Each renders crisp inline SVG; the engines update a handful of
// attributes per frame through refs, so React never re-renders while they animate.

import * as React from 'react';
import { IconEngine, collectIconParts, iconMarkup, type IconState, type Theme } from './core/icon';
import { WaveEngine, collectWaveParts, waveMarkup, waveViewBox, waveMode, WAVE, type WaveModeInput } from './core/wave';
import { DOTS_VIEWBOX, DOTS_PERIOD, DOTS_ANNOUNCE_DELAY_MS, dotsBox, dotsMarkup, injectDotsCss, type DotsVariant } from './core/dots';
import { ORANGE } from './core/brand';
import { ICON_LABELS, WAVE_LABELS, DOTS_LABELS } from './core/meta';
import type { LevelInput, LevelMeterOptions } from './core/audio';
import { imageName } from '../a11y';

const { useEffect, useLayoutEffect, useMemo, useRef, useId, useState } = React;
// Layout effects run before paint (no unstyled flash); on the server neither runs, so fall back quietly.
const useIsoLayout = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

type SvgAttrs = Omit<React.SVGProps<SVGSVGElement>, 'ref' | 'children' | 'dangerouslySetInnerHTML'>;

const uidOf = (id: string) => 'easm' + id.replace(/[^a-zA-Z0-9]/g, '');

/** Numbers and functions change identity on every render; give the engines one stable reader of the latest value
 *  instead, so the meter (and its smoothing) is only rebuilt when the kind of source changes. */
function useLevelInput(level: LevelInput): [LevelInput, unknown] {
  const ref = useRef(level);
  ref.current = level;
  const live = typeof level === 'number' || typeof level === 'function';
  const stable = useMemo<LevelInput>(() => (live ? () => {
    const v = ref.current;
    return typeof v === 'function' ? v() : typeof v === 'number' ? v : 0;
  } : level), [live, live ? 0 : level]); // eslint-disable-line react-hooks/exhaustive-deps
  return [stable, live ? 'live' : level];
}

// Visually hidden but read by screen readers (the same rule as VISUALLY_HIDDEN_CSS in core/dots, which mountDots uses).
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, border: 0, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap',
};

export interface EasmIconProps extends SvgAttrs {
  /** idle · connecting · listening · thinking · searching · toolCalling · writing · speaking · awaiting · done · error ·
   *  offline. Changes blend over 0.5 s. `done` and `error` play once and rest on the still mark. */
  state?: IconState;
  /** Pixel size (number) or any CSS length. Default 24. */
  size?: number | string;
  /** Rails in ink (light surfaces) or paper (dark surfaces). The core is always signature orange. */
  theme?: Theme;
  /** Overrides the rail colour with any CSS colour, e.g. 'currentColor' to follow the text. */
  railColor?: string;
  /**
   * What the voice states follow. speaking: EASM's audio (an <audio>/<video> element, an AnalyserNode or a
   * MediaStream) or a 0–1 number/function; without it, the EASM voice's own rhythm. listening: the microphone stream.
   */
  level?: LevelInput;
  /** Accessible name. Default describes the state; "" makes the icon decorative (text beside it says the state). */
  title?: string;
  meter?: LevelMeterOptions;
  /** Called when `done` or `error` has finished playing. */
  onComplete?: (state: IconState) => void;
  /** Change it to play `done` or `error` again while the state stays the same. */
  replayKey?: string | number;
}

export function EasmIcon({ state = 'idle', size = 24, theme = 'light', railColor, level, title, meter, onComplete, replayKey, 'aria-label': ariaLabel, ...svg }: EasmIconProps) {
  const ref = useRef<SVGSVGElement>(null);
  const engine = useRef<IconEngine | null>(null);
  const done = useRef(onComplete);
  done.current = onComplete;
  const uid = uidOf(useId());
  const markup = useMemo(() => iconMarkup(theme, uid, railColor), [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [input, inputKey] = useLevelInput(level);

  useEffect(() => {
    const e = new IconEngine(collectIconParts(ref.current!), { theme, railColor, level: input, meter, onComplete: s => done.current?.(s) });
    engine.current = e;
    e.jump(state); // the first paint shows the state itself, not a fade in from the still mark
    return () => { e.dispose(); engine.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { engine.current?.setState(state); }, [state]);
  useEffect(() => { engine.current?.setTheme(theme); engine.current?.setRailColor(railColor); }, [theme, railColor]);
  useEffect(() => { engine.current?.setLevel(input); }, [inputKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // replay only when the key really changes (StrictMode re-runs effects on mount with the same key)
  const lastKey = useRef(replayKey);
  useEffect(() => {
    if (Object.is(lastKey.current, replayKey)) return;
    lastKey.current = replayKey;
    engine.current?.replay();
  }, [replayKey]);

  return (
    <svg ref={ref} viewBox="0 0 64 64" width={size} height={size} {...imageName(ariaLabel ?? title ?? ICON_LABELS[state])}
      data-state={state} {...svg} dangerouslySetInnerHTML={{ __html: markup }} />
  );
}

export interface EasmWaveformProps extends SvgAttrs {
  /** idle (still dots) · loading (dots + wave) · listening (the user's voice: pass `level`) · speaking (EASM's voice:
   *  pass `level`, or nothing for the EASM voice's rhythm). `live` and `voice` are accepted for listening and speaking.
   *  Default speaking. */
  mode?: WaveModeInput;
  /** listening: the microphone MediaStream. speaking: EASM's audio element or stream. Or any 0–1 number/function. */
  level?: LevelInput;
  /** Number of bars. Default 24. */
  bars?: number;
  /** Pixel height (number) or CSS length. Width follows the bar count unless you set it. Default 28. */
  height?: number | string;
  width?: number | string;
  /** Bar colour. Default signature orange. */
  color?: string;
  /** Accessible name. Default describes the mode; "" makes the waveform decorative. */
  label?: string;
  meter?: LevelMeterOptions;
}

export function EasmWaveform({ mode = 'speaking', level, bars = 24, height = 28, width, color = ORANGE, label, meter, 'aria-label': ariaLabel, ...svg }: EasmWaveformProps) {
  const ref = useRef<SVGSVGElement>(null);
  const engine = useRef<WaveEngine | null>(null);
  const markup = useMemo(() => waveMarkup(bars, color), [bars]); // eslint-disable-line react-hooks/exhaustive-deps
  const [input, inputKey] = useLevelInput(level);

  useEffect(() => {
    const e = new WaveEngine(collectWaveParts(ref.current!), { mode, level: input, meter });
    engine.current = e;
    return () => { e.dispose(); engine.current = null; };
  }, [bars]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { engine.current?.setMode(mode); }, [mode]);
  useEffect(() => { engine.current?.setColor(color); }, [color]);
  useEffect(() => { engine.current?.setLevel(input); }, [inputKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const w = width ?? (typeof height === 'number' ? (height * bars * WAVE.pitch) / WAVE.height : undefined);
  const m = waveMode(mode);
  return (
    <svg ref={ref} viewBox={waveViewBox(bars)} width={w} height={height} preserveAspectRatio="xMidYMid meet"
      {...imageName(ariaLabel ?? label ?? WAVE_LABELS[m])} data-mode={m} {...svg} dangerouslySetInnerHTML={{ __html: markup }} />
  );
}

export interface EasmDotsProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** typing (EASM is writing) · searching (looking through sources) · thinking (reasoning). Default typing. */
  variant?: DotsVariant;
  /** Dot diameter in px. Default 6. */
  size?: number;
  /** Dot colour. Default currentColor (inherits the text colour); use '#FF6A00' for the brand tone. */
  color?: string;
  /** 1 = the variant's natural pace (typing 1.2 s, searching 1.5 s, thinking 1.8 s per cycle). */
  speed?: number;
  /** What the dots say: announced to screen readers. Default per variant ("EASM is writing" for typing). An
   *  `aria-label` you pass wins, and is also what is announced. */
  label?: string;
  /** true (default): a status live region holding the label as text, so screen readers announce it when the dots
   *  appear or change (the text is filled in a moment after the region appears, which is when a live region is
   *  reliably heard). false: a named image that is read but never announced, for a chat that already announces its
   *  progress in one live region of its own. */
  announce?: boolean;
}

export function EasmDots({ variant = 'typing', size = 6, color = 'currentColor', speed = 1, label, announce = true, className, style, 'aria-label': ariaLabel, ...rest }: EasmDotsProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // the CSS goes into the document, or into the shadow root the dots render in (the chat widget's)
  useIsoLayout(() => { injectDotsCss(ref.current); }, []);
  // the spoken text arrives a moment after the region itself (also on the server and at hydration: empty first)
  const [spoken, setSpoken] = useState(false);
  useEffect(() => {
    if (!announce) return;
    const t = setTimeout(() => setSpoken(true), DOTS_ANNOUNCE_DELAY_MS);
    return () => { clearTimeout(t); setSpoken(false); };
  }, [announce]);
  const markup = useMemo(() => dotsMarkup(color), [color]);
  // text-coloured dots dim between beats; brand-coloured ones only change size
  const solid = color !== 'currentColor' && color !== 'inherit';
  const name = ariaLabel ?? label ?? DOTS_LABELS[variant];
  const box = dotsBox(size);
  const a11y = announce ? { role: 'status', 'aria-label': name || undefined } : imageName(name);
  return (
    <span ref={ref} {...a11y} data-variant={variant}
      className={['easm-dots', solid && 'solid', className].filter(Boolean).join(' ')}
      style={{ ...style, ['--easm-dots-period' as string]: `${(DOTS_PERIOD[variant] / speed).toFixed(3)}s` } as React.CSSProperties} {...rest}>
      <svg viewBox={DOTS_VIEWBOX} width={box.width} height={box.height} aria-hidden="true" focusable="false"
        dangerouslySetInnerHTML={{ __html: markup }} />
      {announce && name ? <span style={VISUALLY_HIDDEN}>{spoken ? name : ''}</span> : null}
    </span>
  );
}

/** The typing variant of EasmDots (kept under its first name). */
export type EasmTypingDotsProps = Omit<EasmDotsProps, 'variant'>;
export const EasmTypingDots = (props: EasmTypingDotsProps) => <EasmDots {...props} variant="typing" />;
