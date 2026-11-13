'use client';

import { cloneElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type ReactElement, type SVGProps } from 'react';

interface MotionInteractionProps {
  element: ReactElement<SVGProps<SVGSVGElement>>;
  recipe: string;
  durationMs: number;
  active: boolean;
  disabled: boolean;
  paused: boolean;
}

/** Client boundary only for interaction hints. Manual/event icons keep their server-only renderer.
 * Hints finish gracefully when a pointer leaves. Native CSS/Animation tracks do the frame work; React
 * never reconciles the drawing on a timer. The control, SVG and forwarded ref remain mounted. */
export const MotionInteraction = forwardRef<SVGSVGElement, MotionInteractionProps>(function MotionInteraction({
  element, recipe, durationMs, active, disabled, paused,
}, forwardedRef) {
  const svg = useRef<SVGSVGElement | null>(null);
  const current = useRef({ active, disabled, durationMs, paused });
  current.current = { active, disabled, durationMs, paused };
  const stop = useRef<(() => void) | undefined>(undefined);
  const reschedule = useRef<(() => void) | undefined>(undefined);
  const assignRef = useCallback((node: SVGSVGElement | null) => {
    svg.current = node;
  }, []);
  // A consumer can replace its callback ref without tearing down a running interaction.
  useImperativeHandle(forwardedRef, () => svg.current!, []);

  useEffect(() => {
    const node = svg.current;
    const control = node?.closest<HTMLElement>('button, a[href], [role="button"], [data-icon-interactive]');
    if (!node || !control) return;
    const win = node.ownerDocument.defaultView;
    // Without media queries or the Web Animations API (a test DOM, an embedded renderer) there are no hints.
    if (!win || typeof win.matchMedia !== 'function' || typeof node.getAnimations !== 'function') return;
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = win.matchMedia('(hover: hover) and (pointer: fine)');
    let hintRunning = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const blocked = () => current.current.disabled || reduced.matches || Boolean(node.closest(
      ':disabled, [aria-disabled="true"], [inert], [data-easm-motion="off"], [data-easm-motion="reduced"]',
    ));
    const finish = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (!hintRunning) return;
      hintRunning = false;
      if (!current.current.active) {
        delete node.dataset.active;
        node.dataset.emphasis = 'hint';
      }
    };
    stop.current = finish;
    const scheduleFallback = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (!hintRunning || current.current.paused) return;
      const scene = node.getAnimations({ subtree: true }).find(animation =>
        (animation as CSSAnimation).animationName === 'easm-part-sequence-layer');
      const scale = Number(win.getComputedStyle(node).getPropertyValue('--easm-motion-duration-scale')) || 1;
      const remaining = scene
        ? Number(scene.effect?.getComputedTiming().endTime ?? 0) - Number(scene.currentTime ?? 0)
        : current.current.durationMs * scale;
      timer = setTimeout(() => {
        const tracks = node.getAnimations({ subtree: true });
        if (current.current.paused || tracks.some(animation => animation.playState === 'paused')) return;
        const incomplete = tracks.some(animation => animation.playState === 'running' &&
          Number(animation.currentTime ?? 0) < Number(animation.effect?.getComputedTiming().endTime ?? 0));
        if (incomplete) scheduleFallback(); else finish();
      }, Math.max(40, remaining + 80));
    };
    reschedule.current = scheduleFallback;
    const start = () => {
      if (hintRunning || current.current.active || blocked()) return;
      hintRunning = true;
      node.dataset.emphasis = 'hint';
      node.dataset.active = 'true';
      // animationend is the primary completion. This fallback also releases hints if CSS was omitted,
      // without cutting short real CSS tracks when their playhead has been paused.
      scheduleFallback();
    };
    const pointer = (event: PointerEvent) => { if (event.pointerType === 'mouse' && finePointer.matches) start(); };
    const focus = () => { if (control.matches(':focus-visible')) start(); };
    const complete = (event: AnimationEvent) => { if (event.animationName === 'easm-part-sequence-layer') finish(); };
    const preference = () => { if (blocked()) finish(); };
    control.addEventListener('pointerenter', pointer);
    control.addEventListener('focusin', focus);
    node.addEventListener('animationend', complete);
    reduced.addEventListener('change', preference);
    const observer = new MutationObserver(preference);
    for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) observer.observe(ancestor, {
      attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'data-easm-motion', 'inert'],
    });
    node.dataset.interactionReady = 'true';
    return () => {
      finish(); stop.current = undefined; reschedule.current = undefined; observer.disconnect();
      control.removeEventListener('pointerenter', pointer);
      control.removeEventListener('focusin', focus);
      node.removeEventListener('animationend', complete);
      reduced.removeEventListener('change', preference);
      delete node.dataset.interactionReady;
    };
  }, [recipe]);

  useEffect(() => {
    if (active || disabled) stop.current?.(); else reschedule.current?.();
  }, [active, disabled, paused]);
  return cloneElement(element, { ref: assignRef });
});
