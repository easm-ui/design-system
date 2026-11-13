// EASM logo v6 (locked October 2026): the Junction on its 64-unit grid.
// Six pill rails, 19.7 × 7.2 (radius 3.6), from 10.4 to 30.1 from the centre at 0°, 60° … 300°;
// a 15 × 15 core with a 3.75 radius in signature orange.

export const V6 = { box: 64, c: 32, r0: 10.4, r1: 30.1, rw: 7.2, core: 15, coreR: 3.75 } as const;
/** A rail drawn as a round-capped line: its cap centres sit half a width inside the pill's ends. */
export const RAIL_LINE = { x1: V6.c + V6.r0 + V6.rw / 2, x2: V6.c + V6.r1 - V6.rw / 2 } as const; // 46 → 58.5
export const RAIL_ANGLES = [0, 60, 120, 180, 240, 300] as const; // clockwise from the right-hand rail

// The brand palette, defined once for the whole package (logo builder, motion engines, BRAND_COLOURS).
export const ORANGE = '#FF6A00';
export const INK = '#161616';
export const PAPER = '#FAFAF8';
// The rest of the palette (internal: BRAND_COLOURS, the logo builder and the engines read these). Plain constants,
// not an object, so a bundle keeps only the ones it uses.
export const DARK = '#0F0F0E';
export const WHITE = '#FFFFFF';
export const ORANGE_INK = '#B44700';
/** The core at the top of a syllable while speaking: signature orange, lit from within. */
export const ORANGE_GLOW = '#FF8A33';
/** The full name in full colour, and the divider on dark grounds. */
export const GREY_DESCRIPTOR = '#3B3B39';
/** The divider in full colour. */
export const GREY_DIVIDER = '#C9C9C4';
/** The full name on dark grounds. */
export const GREY_DESCRIPTOR_DARK = '#D8D8D2';
export const ENTERPRISE_BLUE = '#2457C5';

let reduce: MediaQueryList | null = null;
/** The page's prefers-reduced-motion query, created once and shared (null on the server or without matchMedia). */
export function reducedMotionQuery(): MediaQueryList | null {
  if (!reduce && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  return reduce;
}

/** True when motion should stop: the OS setting, or the EASM library's global switch. */
export function motionOff(el?: Element | null): boolean {
  if (typeof window === 'undefined') return true;
  if (el && el.closest && el.closest('[data-easm-motion="off"]')) return true;
  return !!reducedMotionQuery()?.matches;
}

// One MutationObserver per document or shadow root tells every engine when a data-easm-motion switch changes, so
// turning motion back on restarts what was frozen (the engines also re-check on every frame).
const switchWatchers = new Map<Node, { observer: MutationObserver; callbacks: Set<() => void> }>();

/** Calls `callback` whenever a `data-easm-motion` attribute changes in the document (and in the shadow root `el` is
 *  rendered in, if any). Returns the function that stops watching. */
export function watchMotionSwitch(el: Element | null | undefined, callback: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  const targets: Node[] = [document.documentElement];
  const root = el && typeof el.getRootNode === 'function' ? el.getRootNode() : null;
  if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) targets.push(root);
  for (const target of targets) {
    let entry = switchWatchers.get(target);
    if (!entry) {
      const callbacks = new Set<() => void>();
      const observer = new MutationObserver(() => callbacks.forEach(cb => cb()));
      observer.observe(target, { attributes: true, subtree: true, attributeFilter: ['data-easm-motion'] });
      entry = { observer, callbacks };
      switchWatchers.set(target, entry);
    }
    entry.callbacks.add(callback);
  }
  return () => {
    for (const target of targets) {
      const entry = switchWatchers.get(target);
      if (!entry) continue;
      entry.callbacks.delete(callback);
      if (!entry.callbacks.size) { entry.observer.disconnect(); switchWatchers.delete(target); }
    }
  };
}

/** Names an engine-managed svg: a name makes it role="img" with that label; '' makes it decorative (aria-hidden). */
export function nameSvg(svg: Element, name: string): void {
  if (name) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', name); svg.removeAttribute('aria-hidden'); }
  else { svg.removeAttribute('role'); svg.removeAttribute('aria-label'); svg.setAttribute('aria-hidden', 'true'); }
}

/** The last entry an IntersectionObserver reports is the element's current state (several can queue up). */
export const latestIntersection = (entries: IntersectionObserverEntry[]): boolean =>
  entries.length ? entries[entries.length - 1].isIntersecting : true;

declare const process: { env?: Record<string, string | undefined> } | undefined;
const warned = new Set<string>();
/** A development-only console warning, printed once per message (silent in production builds). */
export function devWarn(message: string): void {
  if (typeof process === 'undefined' || !process || !process.env || process.env.NODE_ENV === 'production') return;
  if (warned.has(message)) return;
  warned.add(message);
  if (typeof console !== 'undefined') console.warn(`@easm-ui/brand: ${message}`);
}
