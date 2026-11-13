'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { tokens } from './tokens.generated';

/* Motion that CSS cannot express on its own: things that move because their neighbours changed.
   Both hooks measure the layout React just committed and animate from where things were, on the compositor
   (transform, height), so nothing re-renders per frame. Reduced motion and [data-easm-motion='off'] skip them. */

// Also quiet where the Web Animations API is missing (a test DOM): there is nothing to measure against or play.
const quiet = (node: Element) => typeof window === 'undefined' || typeof window.matchMedia !== 'function'
  || typeof node.animate !== 'function' || typeof node.getAnimations !== 'function'
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(node.closest('[data-easm-motion="off"], [data-easm-motion="reduced"]'));

/** Animate with the token spring; a browser without linear() easing gets the standard curve instead. */
function play(node: Element, keyframes: Keyframe[], duration: number, easing: string) {
  try { return node.animate(keyframes, { duration, easing }); }
  catch { return node.animate(keyframes, { duration, easing: tokens.motion.ease }); }
}

type Place = { x: number; y: number };

/**
 * Rows that stay glide to their new place when the list changes (a filter narrows it while you type, a new
 * message moves a conversation to the top); rows that are new rise in. Positions are relative to the list, so
 * scrolling the page or the pane never counts as movement. Runs after every commit; it measures only the list's
 * own children.
 */
export function useFlip<T extends HTMLElement>(ref: RefObject<T | null>, selector = ':scope > *', { enter = true }: { enter?: boolean } = {}) {
  const places = useRef(new WeakMap<Element, Place>());
  const seeded = useRef(false);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host || quiet(host)) return;
    const origin = host.getBoundingClientRect();
    const items = Array.from(host.querySelectorAll(selector));
    const next = new WeakMap<Element, Place>();
    for (const item of items) {
      // A row still gliding from the last change: its layout place is where it is drawn less the glide's current
      // offset, and the new glide starts from where it is drawn now, so typing quickly never makes it jump.
      const moving = getComputedStyle(item).transform;
      const offset = moving === 'none' ? { e: 0, f: 0 } : new DOMMatrixReadOnly(moving);
      const box = item.getBoundingClientRect();
      const place = { x: box.left - origin.left - offset.e, y: box.top - origin.top - offset.f };
      next.set(item, place);
      if (!seeded.current) continue;
      const before = places.current.get(item);
      if (before) {
        const dx = before.x - place.x + offset.e, dy = before.y - place.y + offset.f;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          item.getAnimations().forEach(animation => animation.cancel());
          play(item, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], tokens.motion.arrive, tokens.motion.easeSpringSoft);
        }
      } else {
        // A new row waits while the rows around it move out of its way, then fades in, so text never passes over
        // text. (A list whose rows already rise in from CSS passes enter: false and gets only the wait and fade.)
        const rise = enter ? 'translateY(6px)' : 'none';
        // The curve belongs to the fade alone (on the keyframe), so the wait really lasts its third of the time.
        play(item, [{ opacity: 0, transform: rise, offset: 0 }, { opacity: 0, transform: rise, offset: .35, easing: tokens.motion.easeOut },
          { opacity: 1, transform: 'none', offset: 1 }], tokens.motion.arrive, 'linear');
      }
    }
    places.current = next;
    seeded.current = true;
  });
}

/**
 * A field that grows with its text (field-sizing: content) eases to its new height instead of jumping a line at a
 * time. The browser keeps sizing the field; this only animates between the heights it chose.
 */
export function useGrowMotion<T extends HTMLElement>(ref: RefObject<T | null>, value: unknown) {
  const settled = useRef<number | null>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field || quiet(field)) return;
    // A text field has already resized itself by the time React renders (the browser applies the keystroke first),
    // so "before" is the height from the last render, or the height drawn now if a previous ease is still running.
    const easing = field.getAnimations().length > 0;
    const drawn = easing ? field.offsetHeight : settled.current;
    field.getAnimations().forEach(animation => animation.cancel());
    const wanted = field.offsetHeight;
    settled.current = wanted;
    if (drawn === null || Math.abs(drawn - wanted) < 1) return;
    play(field, [{ height: `${drawn}px` }, { height: `${wanted}px` }], tokens.motion.slow, tokens.motion.easeSpringSoft);
  }, [value]);
}
