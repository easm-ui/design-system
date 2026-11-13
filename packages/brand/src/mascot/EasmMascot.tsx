'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FurCompanion } from './FurCompanion';
import type { ActName, CompanionActivity, Corner, Expression, Mood, Perch, Viseme } from './FurCompanion';

/**
 * EasmMascot: the EASM mascot, a fluffy WebGL 2 character drawn entirely in code (no images), with a face of
 * 69 expressions, short acts, a personality, gaze that follows the pointer, and soft-body physics. She is the
 * brand's, like the logo: any EASM product may host her. She is not an assistant and has no name; she never
 * makes a sound (a host that plays audio may lend her its signal for lip sync, `audioLevel`/`attachAudio`).
 *
 * Two placements:
 * - `stage` (default): she fills the element she is given. Give it a size (she draws to its box).
 * - `corner`: she floats over the page from the viewport's right and bottom edges (`corner`), can be picked up and
 *   thrown, lands on the bottom edge and hops home; `perch` stands her on a ledge instead (a button, a panel).
 *
 * She is created once per mount; props only steer her. Without WebGL 2 she is not drawn: `fallback` is rendered
 * instead (default nothing) and `onUnavailable` is called. Reduced motion follows the system preference unless
 * `reducedMotion` is given: travel, squash, roll, coat motion and symbol drift stop; expressions, gaze and blinks stay.
 */
export interface EasmMascotProps {
  /** `stage` fills this element; `corner` floats her over the page. Fixed for the mount. Default `stage`. */
  placement?: 'stage' | 'corner';
  /** Coat colour, `#rrggbb`. Default the character's own crimson. */
  color?: string;
  /** A pose held on her face (one of `MASCOT_EXPRESSIONS`), or null to let her feelings choose. */
  expression?: Expression | null;
  /** Seconds `expression` is held; default for ever (until the prop changes). */
  expressionHold?: number;
  /** A broad mood (idle hands the face back to her). Prefer `expression` for a precise pose. */
  mood?: Mood;
  /** What she is doing beside the host: idle, greeting, thinking, writing, listening, speaking. */
  activity?: CompanionActivity;
  /** Corner placement: distance from the viewport's right and bottom edges (CSS px). */
  corner?: Corner;
  /** Corner placement: a ledge to stand on instead of her corner (client px), null for the corner. */
  perch?: Perch | null;
  /** Corner placement: skin radius in CSS px (the fur adds about a third). Default 46. */
  size?: number;
  /** Corner placement: the z-index of her layer. Default 2147482900. */
  layer?: number;
  /** Stops her frame loop and hides her button, keeping her GPU state. */
  paused?: boolean;
  /** Override the system's reduced-motion preference. Omit to follow it. */
  reducedMotion?: boolean;
  /** Let her feelings drive her (default true); off, she shows only what she is told. */
  personality?: boolean;
  /** A lighter coat (fewer layers, 30 fps at rest). Default: on for coarse-pointer, no-hover devices. */
  light?: boolean;
  /** Her mouth zipped shut (a quiet, written-only mood). Default false. */
  mouthZipped?: boolean;
  /** A click or Enter on her. Without one, a click is a poke. */
  onActivate?: () => void;
  /** What happened to her, names only: poked, petted, grabbed, put_down, tossed, activated… */
  onEvent?: (name: string) => void;
  /** The engine once running, then null on unmount: for hop, play, lookAt, notice, onFrame and the rest. */
  onReady?: (engine: FurCompanion | null) => void;
  /** No WebGL 2 or the character could not start. */
  onUnavailable?: () => void;
  /** Rendered instead of her when she cannot be drawn. Default nothing. */
  fallback?: ReactNode;
  /** Host-driven lip sync: playback level 0..1 of audio the host plays, with an optional mouth shape. */
  audioLevel?: number;
  viseme?: Viseme;
  /** Accessible name. In `stage` she is an image; in `corner` a focusable button. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export type { ActName as EasmMascotAct, CompanionActivity as EasmMascotActivity, Corner as EasmMascotCorner, Expression as EasmMascotExpression, Mood as EasmMascotMood, Perch as EasmMascotPerch, Viseme as EasmMascotViseme };

const lightByDefault = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;

export function EasmMascot(props: EasmMascotProps) {
  const {
    placement = 'stage', color, expression, expressionHold = Infinity, mood, activity, corner, perch = null, size,
    layer, paused = false, reducedMotion, personality, mouthZipped, onActivate, audioLevel, viseme,
    label = 'The EASM mascot', className, style, fallback = null,
  } = props;
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<FurCompanion | null>(null);
  const latest = useRef(props);
  const [unavailable, setUnavailable] = useState(false);
  useLayoutEffect(() => { latest.current = props; });

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const p = latest.current;
    const canvas = document.createElement('canvas');
    if (placement === 'stage') {
      Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%' });
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', p.label ?? 'The EASM mascot');
    } else {
      // Her corner button carries the name; the canvas itself is decoration.
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.zIndex = String(p.layer ?? 2147482900);
    }
    container.append(canvas);
    let companion: FurCompanion;
    try {
      companion = new FurCompanion(canvas, {
        placement,
        ...(p.color ? { color: p.color } : {}),
        ...(p.reducedMotion !== undefined ? { reducedMotion: p.reducedMotion } : {}),
        ...(p.corner ? { corner: p.corner } : {}),
        ...(p.size !== undefined ? { size: p.size } : {}),
        voiceEnabled: !p.mouthZipped,
        personality: p.personality ?? true,
        light: p.light ?? lightByDefault(),
        label: p.label ?? 'The EASM mascot',
        onActivate: p.onActivate ? () => latest.current.onActivate?.() : undefined,
        onEvent: (name) => latest.current.onEvent?.(name),
      });
    } catch {
      canvas.remove();
      setUnavailable(true);
      latest.current.onUnavailable?.();
      return;
    }
    engine.current = companion;
    latest.current.onReady?.(companion);
    return () => {
      latest.current.onReady?.(null);
      companion.destroy();
      canvas.remove();
      engine.current = null;
    };
  }, [placement]);

  useEffect(() => { if (color) engine.current?.setColor(color); }, [color]);
  useEffect(() => { engine.current?.setLabel(label); if (placement === 'stage') host.current?.querySelector('canvas')?.setAttribute('aria-label', label); }, [label, placement]);
  useEffect(() => { if (size !== undefined) engine.current?.setSize(size); }, [size]);
  useEffect(() => { if (layer !== undefined) engine.current?.setLayer(layer); }, [layer]);
  useEffect(() => { if (corner) engine.current?.setCorner(corner); }, [corner?.right, corner?.bottom, corner?.span, corner?.ground]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { engine.current?.setSuspended(paused); }, [paused]);
  useEffect(() => { if (personality !== undefined) engine.current?.setPersonality(personality); }, [personality]);
  useEffect(() => { if (mouthZipped !== undefined) engine.current?.setVoiceEnabled(!mouthZipped); }, [mouthZipped]);
  useEffect(() => { if (mood !== undefined) engine.current?.setMood(mood); }, [mood]);
  useEffect(() => { if (activity !== undefined) engine.current?.setActivity(activity); }, [activity]);
  useEffect(() => { if (expression !== undefined) engine.current?.setExpression(expression, expressionHold); }, [expression, expressionHold]);
  // A perch that moves while she is on it carries her; a new one pops her there.
  const lastPerch = useRef<Perch | null>(null);
  useEffect(() => {
    if (placement !== 'corner') return;
    const was = lastPerch.current;
    lastPerch.current = perch;
    if (!was && !perch) return;
    engine.current?.setPerch(perch, was && perch && !was.hang === !perch.hang ? 'ride' : 'pop');
  }, [perch, placement]);
  const activatable = !!onActivate;
  useEffect(() => { engine.current?.setActivateHandler(activatable ? () => latest.current.onActivate?.() : undefined); }, [activatable]);

  // Reduced motion: an explicit value wins; removing it resumes the system preference.
  const overridden = useRef(reducedMotion !== undefined);
  useEffect(() => {
    const companion = engine.current;
    if (!companion) return;
    if (reducedMotion !== undefined) { overridden.current = true; companion.setReducedMotion(reducedMotion); return; }
    if (!overridden.current) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    companion.setReducedMotion(preference.matches);
    const sync = (event: MediaQueryListEvent) => companion.setReducedMotion(event.matches);
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, [reducedMotion]);

  // Host-driven lip sync, refreshed every frame (the engine drops a level after 160 ms).
  const audio = useRef({ audioLevel, viseme });
  audio.current = { audioLevel, viseme };
  const lipSynced = audioLevel !== undefined || viseme !== undefined;
  useEffect(() => {
    if (!lipSynced) return;
    let frame = 0;
    const feed = () => {
      engine.current?.setAudioLevel(audio.current.audioLevel ?? 0, audio.current.viseme);
      frame = requestAnimationFrame(feed);
    };
    feed();
    return () => { cancelAnimationFrame(frame); engine.current?.setAudioLevel(0, 'rest'); };
  }, [lipSynced]);

  if (unavailable) return <>{fallback}</>;
  return (
    <div
      ref={host}
      className={className}
      data-easm-mascot={placement}
      style={placement === 'stage' ? { position: 'relative', width: '100%', height: '100%', touchAction: 'none', ...style } : { display: paused ? 'none' : undefined, ...style }}
    />
  );
}
