'use client';
import { useEffect, useLayoutEffect, type RefObject } from 'react';

// Layout effects run before paint, so the indicator is in place on the first frame; on the server neither runs.
const useIsoLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * One indicator that slides between the items of a group (the selected tab or segment, the sidebar's current
 * page) instead of the fill jumping from one item to the next.
 *
 * The host draws the indicator itself (`[data-indicator]::before` in motion.css) from four custom properties
 * this hook keeps current: `--easm-ui-indicator-x`, `-y`, `-w` and `-h`, measured from the host's padding box.
 * The host must be positioned. `data-indicator` is `rest` while it is placed without motion (the first frame,
 * the host resizing) and `move` once the active item changes, which is the only time it transitions. Without
 * an active item the attribute is removed and the items fall back to their own selected fill.
 */
export function useSlidingIndicator(host: RefObject<HTMLElement | null>, activeSelector: string, activeKey: unknown) {
  useIsoLayoutEffect(() => {
    const element = host.current;
    if (element) placeIndicator(element, activeSelector, true);
  }, [activeKey, activeSelector]);

  useIsoLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    placeIndicator(element, activeSelector, false);
    if (typeof ResizeObserver === 'undefined') return;
    // The host resizing (a sidebar collapsing, a window narrowing, a label wrapping) moves every item at once:
    // the indicator follows in the same frame instead of sliding after them.
    let lastWidth = element.offsetWidth, lastHeight = element.offsetHeight;
    const observer = new ResizeObserver(() => {
      if (element.offsetWidth === lastWidth && element.offsetHeight === lastHeight) return;
      lastWidth = element.offsetWidth; lastHeight = element.offsetHeight;
      placeIndicator(element, activeSelector, false);
    });
    observer.observe(element);
    let live = true;
    // Inter arriving after the first paint changes every label's width.
    document.fonts?.ready.then(() => { if (live) placeIndicator(element, activeSelector, false); });
    return () => { live = false; observer.disconnect(); };
  }, [activeSelector]);
}

function placeIndicator(host: HTMLElement, selector: string, animate: boolean) {
  const target = host.querySelector<HTMLElement>(selector);
  if (!target || !target.offsetWidth || !target.offsetHeight) {
    delete host.dataset.indicator;
    return;
  }
  let x = target.offsetLeft, y = target.offsetTop;
  if (target.offsetParent !== host) {
    const outer = host.getBoundingClientRect(), inner = target.getBoundingClientRect();
    x = inner.left - outer.left - host.clientLeft + host.scrollLeft;
    y = inner.top - outer.top - host.clientTop + host.scrollTop;
  }
  // The first placement never slides in from the corner.
  host.dataset.indicator = animate && host.dataset.indicator ? 'move' : 'rest';
  host.style.setProperty('--easm-ui-indicator-x', `${x}px`);
  host.style.setProperty('--easm-ui-indicator-y', `${y}px`);
  host.style.setProperty('--easm-ui-indicator-w', `${target.offsetWidth}px`);
  host.style.setProperty('--easm-ui-indicator-h', `${target.offsetHeight}px`);
}
