'use client';

import { forwardRef, useEffect, useId, useMemo, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { motionOff, reducedMotionQuery, watchMotionSwitch } from './motion/core/brand';
import { getParticleFieldPoints, renderParticleField } from './background/particle-field';
import { EASM_BACKGROUND_PALETTES, EASM_PARTICLE_LOOP_MS, type EasmBackgroundVariant } from './background/palettes';

export interface EasmParticleFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role' | 'aria-label' | 'aria-labelledby' | 'aria-hidden' | 'tabIndex' | 'dangerouslySetInnerHTML'> {
  variant?: EasmBackgroundVariant;
  /** Smooth pointer response inside the containing surface. Never intercepts controls. Default true. */
  interactive?: boolean;
  /** Freeze the current pose. Resuming continues from that pose. */
  paused?: boolean;
  /** Authored particle/material visibility, from 0 to 1. Default .82. */
  intensity?: number;
  /** 1 is a 32-second cycle; .5 is a 64-second cycle. Clamped to .25–2. */
  speed?: number;
  /** Optional fixed phase in turns, for stills and frame inspection. 0 and 1 join exactly. */
  phase?: number;
}

const clamp = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const turn = (value: number) => Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0;

function Poster({ variant, intensity, phase, uid }: { variant: EasmBackgroundVariant; intensity: number; phase: number; uid: string }) {
  const palette = EASM_BACKGROUND_PALETTES[variant];
  const paths = useMemo(() => {
    const groups = Array.from({ length: 33 }, () => '');
    const warm = Array.from({ length: 9 }, () => '');
    for (const point of getParticleFieldPoints(1280, 720, phase, { variant, intensity })) {
      const x = point.x.toFixed(2), y = point.y.toFixed(2), r = point.radius.toFixed(2);
      const bin = Math.min(32, Math.round(point.alpha * 32));
      const d = `M${x} ${y}m-${r} 0a${r} ${r} 0 1 0 ${(+r * 2).toFixed(2)} 0a${r} ${r} 0 1 0 -${(+r * 2).toFixed(2)} 0`;
      groups[bin] += d;
      const warmLevel = Math.min(8, Math.round(point.warmth * point.alpha * 8));
      if (warmLevel) warm[warmLevel] += d;
    }
    return { base: groups, warm };
  }, [variant, intensity, phase]);
  return <svg data-particle-poster="" aria-hidden="true" focusable="false" viewBox="0 0 1280 720"
    preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', width: '100%', height: '100%', inset: 0 }}>
    <defs>
      <radialGradient id={`${uid}-warm`}><stop stopColor={palette.rust} stopOpacity={palette.light ? .3 : .75} /><stop offset="1" stopColor={palette.rust} stopOpacity="0" /></radialGradient>
      <radialGradient id={`${uid}-cool`}><stop stopColor={palette.steel} stopOpacity={palette.light ? .22 : .25} /><stop offset="1" stopColor={palette.steel} stopOpacity="0" /></radialGradient>
    </defs>
    <path d="M0 0h1280v720H0Z" fill={palette.ground} />
    <ellipse cx="990" cy="310" rx="660" ry="660" fill={`url(#${uid}-cool)`} />
    <ellipse cx="950" cy="750" rx="640" ry="540" fill={`url(#${uid}-warm)`} />
    {paths.base.map((d, index) => d && <path key={index} d={d} fill={`rgb(${palette.particle})`} opacity={index / 32} />)}
    {paths.warm.map((d, index) => d && <path key={`warm-${index}`} d={d} fill={palette.light ? '#B44700' : '#FF9145'} opacity={index / 8 * .8} />)}
  </svg>;
}

/** Decorative atmosphere. Its containing surface owns dimensions, content and readable foregrounds.
 * Pointer listeners only steer the decorative surface; controls retain all input. No React frame updates. */
export const EasmParticleField = forwardRef<HTMLDivElement, EasmParticleFieldProps>(function EasmParticleField({
  variant = 'charcoal', interactive = true, paused = false, intensity = .82, speed = 1, phase, className, style, ...props
}, forwardedRef) {
  const host = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const refresh = useRef<(() => void) | null>(null);
  const selected = Object.prototype.hasOwnProperty.call(EASM_BACKGROUND_PALETTES, variant) ? variant : 'charcoal';
  const amount = clamp(intensity, .82, 0, 1);
  const settings = useRef({ variant: selected, interactive, paused, intensity: amount, speed, phase });
  settings.current = { variant: selected, interactive, paused, intensity: amount, speed, phase };
  const uid = `easm-field-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    const element = host.current!, surface = canvas.current!;
    const ctx = surface.getContext('2d', { alpha: false });
    if (!ctx) { element.dataset.playback = 'fallback'; return; }
    let disposed = false, frame = 0, last = 0, painted = 0, elapsed = 0;
    let width = 0, height = 0, visible = true;
    const media = reducedMotionQuery();
    const pointer = { x: .5, y: .5, strength: 0 };
    const target = { x: .5, y: .5, strength: 0 };
    function state() {
      if (media?.matches || element.closest('[data-easm-motion="reduced"]')) return 'reduced';
      if (motionOff(element)) return 'off';
      if (document.hidden) return 'hidden';
      if (!visible || !width || !height) return 'offscreen';
      if (settings.current.phase !== undefined) return 'still';
      return settings.current.paused ? 'paused' : 'playing';
    }
    function draw() {
      if (!width || !height || disposed) return;
      const mode = state();
      const pose = mode === 'off' || mode === 'reduced' ? 0 : settings.current.phase === undefined ? elapsed / EASM_PARTICLE_LOOP_MS : turn(settings.current.phase);
      renderParticleField(ctx!, width, height, pose, { ...settings.current,
        pointer: mode === 'reduced' || mode === 'off' || !settings.current.interactive ? undefined : pointer });
      element.dataset.ready = 'true';
    }
    function tick(now: number) {
      frame = 0;
      if (disposed || state() !== 'playing') { update(); return; }
      // Use elapsed time so pointer settling stays consistent when frames are delayed.
      // Pausing/visibility changes reset `last`, so time away never advances this response.
      const delta = last ? Math.max(0, now - last) : 1000 / 60;
      if (last) elapsed = (elapsed + (now - last) * clamp(settings.current.speed, 1, .25, 2)) % EASM_PARTICLE_LOOP_MS;
      const follow = 1 - Math.exp(-delta / 145);
      pointer.x += (target.x - pointer.x) * follow;
      pointer.y += (target.y - pointer.y) * follow;
      pointer.strength += (target.strength - pointer.strength) * follow;
      if (pointer.strength < .0001 && target.strength === 0) pointer.strength = 0;
      last = now;
      // Ambient motion is deliberately slower than activity indicators; 30 fps bounds rendering cost.
      if (!painted || now - painted >= 1000 / 30 - 1) { draw(); painted = now; }
      frame = requestAnimationFrame(tick);
    }
    function update() {
      if (disposed) return;
      cancelAnimationFrame(frame); frame = 0; last = 0; painted = 0;
      const mode = state();
      element.dataset.playback = mode;
      if (mode === 'off' || mode === 'reduced') elapsed = 0;
      else if (settings.current.phase !== undefined) elapsed = turn(settings.current.phase) * EASM_PARTICLE_LOOP_MS;
      if (mode === 'off' || mode === 'reduced' || !settings.current.interactive) pointer.strength = target.strength = 0;
      draw();
      if (mode === 'playing') frame = requestAnimationFrame(tick);
    }
    function resize() {
      const bounds = element.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      if (width && height) {
        // Keep a single background within a sensible pixel budget, including large retina displays.
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5, 2400 / width, 1600 / height);
        surface.width = Math.max(1, Math.round(width * dpr));
        surface.height = Math.max(1, Math.round(height * dpr));
        ctx!.setTransform(surface.width / width, 0, 0, surface.height / height, 0, 0);
      }
      update();
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(element);
    if (!observer) window.addEventListener('resize', resize);
    const intersection = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (entries.length) visible = entries[entries.length - 1].isIntersecting;
      update();
    }) : null;
    intersection?.observe(element);
    function leave() { target.strength = 0; }
    function move(event: PointerEvent) {
      if (!settings.current.interactive || state() !== 'playing' || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
      const bounds = element.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) { leave(); return; }
      target.x = x; target.y = y;
      if (pointer.strength === 0 && target.strength === 0) { pointer.x = x; pointer.y = y; }
      target.strength = 1;
    }
    function out(event: PointerEvent) { if (!event.relatedTarget) leave(); }
    // Listen passively on the document so sibling dashboard content remains fully interactive.
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', out, { passive: true });
    window.addEventListener('blur', leave);
    const stopWatching = watchMotionSwitch(element, update);
    media?.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    refresh.current = update;
    resize();
    return () => {
      disposed = true; cancelAnimationFrame(frame); refresh.current = null;
      observer?.disconnect(); intersection?.disconnect(); stopWatching();
      if (!observer) window.removeEventListener('resize', resize);
      media?.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', out);
      window.removeEventListener('blur', leave);
    };
  }, []);
  useEffect(() => { refresh.current?.(); }, [selected, interactive, paused, amount, speed, phase]);

  const css: CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden', background: EASM_BACKGROUND_PALETTES[selected].ground,
    ...style, pointerEvents: 'none', userSelect: 'none' };
  return <div {...props} ref={node => {
    host.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node;
  }} className={['easm-particle-field', className].filter(Boolean).join(' ')} style={css}
    data-easm-particle-field={selected} data-interactive={interactive || undefined} aria-hidden="true" role="presentation" tabIndex={undefined}>
    <Poster uid={uid} variant={selected} intensity={amount} phase={phase === undefined ? 0 : turn(phase)} />
    <canvas ref={canvas} aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
  </div>;
});
