// The three-dot indicator, in three variants that mirror the icon's states for places where only text fits (a chat
// bubble, a status line). Pure CSS: no JavaScript runs per frame.
//   typing     EASM is writing an answer: a wave runs left to right, each dot rising and swelling in turn, then rests
//   searching  EASM is looking through sources: a highlight scans across the dots and back, lingering at the ends
//   thinking   EASM is reasoning: the dots swell and settle slowly, one after another, without moving
// Text-coloured dots (the default, currentColor) dim between beats; dots in a brand colour (`solid`) only change size,
// because orange at low opacity over a dark surface reads as brown.

import { escapeMarkup } from './markup';

export type DotsVariant = 'typing' | 'searching' | 'thinking';

/** The dots' grid: 26 × 10.4 units; dots are 6 units across. */
export const DOTS_WIDTH = 26;
export const DOTS_HEIGHT = 10.4;
/** viewBox 26 × 10.4 grid units; dots are 6 units across. */
export const DOTS_VIEWBOX = '0 0 26 10.4';
export const DOTS_ASPECT = 26 / 6; // width per unit of dot size
/** Rendered size in px for a dot diameter in px (the grid scales with the dot). */
export const dotsBox = (size: number): { width: number; height: number } => ({ width: (size * DOTS_WIDTH) / 6, height: (size * DOTS_HEIGHT) / 6 });
/** Seconds per cycle at speed 1. */
export const DOTS_PERIOD: Record<DotsVariant, number> = { typing: 1.2, searching: 1.5, thinking: 1.8 };

const E = 'cubic-bezier(.45,0,.55,1)';
const P = 'var(--easm-dots-period)';
const LO = 'var(--easm-dots-lo,.36)', SM = 'var(--easm-dots-sm,.84)';

export const DOTS_CSS =
  '.easm-dots{display:inline-flex;align-items:center;line-height:0;vertical-align:middle}' +
  '.easm-dots svg{overflow:visible}' +
  '.easm-dots circle{transform-box:fill-box;transform-origin:50% 50%;animation-timing-function:' + E + ';animation-iteration-count:infinite;animation-fill-mode:both}' +
  '.easm-dots.solid{--easm-dots-lo:1;--easm-dots-sm:.62}' +
  // typing: one wave every period; each dot is lifted for the first ~45% of its own cycle
  `.easm-dots[data-variant=typing] circle{animation-name:easm-dots-type;animation-duration:${P}}` +
  `.easm-dots[data-variant=typing] circle:nth-child(2){animation-delay:calc(${P} * -.86)}` +
  `.easm-dots[data-variant=typing] circle:nth-child(3){animation-delay:calc(${P} * -.72)}` +
  `@keyframes easm-dots-type{0%,46%,100%{transform:translateY(0) scale(${SM});opacity:${LO}}22%{transform:translateY(-2.6px) scale(1);opacity:1}}` +
  // searching: a highlight moves 1 → 2 → 3 → 2 → 1. The end dots are reached once per cycle, the middle one twice, so
  // the middle one runs the same keyframes twice as fast; the highlight lingers at the ends as it turns
  `.easm-dots[data-variant=searching] circle{animation-name:easm-dots-scan;animation-duration:${P}}` +
  `.easm-dots[data-variant=searching] circle:nth-child(2){animation-duration:calc(${P} / 2);animation-delay:calc(${P} * -.25)}` +
  `.easm-dots[data-variant=searching] circle:nth-child(3){animation-delay:calc(${P} * -.5)}` +
  `@keyframes easm-dots-scan{0%,100%{transform:scale(1);opacity:1}28%,72%{transform:scale(${SM});opacity:${LO}}}` +
  // thinking: slow swells, each dot a third of a cycle after the last
  `.easm-dots[data-variant=thinking] circle{animation-name:easm-dots-think;animation-duration:${P}}` +
  `.easm-dots[data-variant=thinking] circle:nth-child(2){animation-delay:calc(${P} * -.667)}` +
  `.easm-dots[data-variant=thinking] circle:nth-child(3){animation-delay:calc(${P} * -.333)}` +
  `@keyframes easm-dots-think{0%,100%{transform:scale(${SM});opacity:${LO}}50%{transform:scale(1);opacity:1}}` +
  '@media (prefers-reduced-motion:reduce){.easm-dots circle{animation:none!important;opacity:.7}.easm-dots.solid circle{opacity:1}}' +
  // the switch works on an ancestor or on the dots themselves
  '[data-easm-motion=off] .easm-dots circle,.easm-dots[data-easm-motion=off] circle{animation:none!important;opacity:.7}' +
  '[data-easm-motion=off] .easm-dots.solid circle,.easm-dots.solid[data-easm-motion=off] circle{opacity:1}';

export function dotsMarkup(color: string): string {
  const fill = escapeMarkup(color);
  return [3, 13, 23].map(x => `<circle cx="${x}" cy="6.9" r="3" fill="${fill}"/>`).join('');
}

/** The id of the <style> element the document-level injection adds (include your own with this id to skip it). */
export const DOTS_STYLE_ID = 'easm-motion-css';

// Each document and each shadow root gets the CSS once. A shadow root adopts one shared constructable stylesheet
// (it needs no <style> element, so a strict style-src CSP does not block it); the document keeps the <style> element
// it has always had, so server snapshots and existing checks see the same markup.
const styled = new WeakSet<Node>();
let shared: CSSStyleSheet | null | undefined;
function sharedSheet(): CSSStyleSheet | null {
  if (shared === undefined) {
    shared = null;
    try {
      if (typeof CSSStyleSheet !== 'undefined' && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(DOTS_CSS);
        shared = sheet;
      }
    } catch { shared = null; }
  }
  return shared;
}

/** Adds the dots' CSS once per document or shadow root (no-op on the server, or if you include DOTS_CSS yourself,
 *  or `tokens/easm-dots.css`). Pass the element the dots render in (or its root): inside a shadow root, such as the
 *  chat widget's, the CSS is added to that root, where the document's styles cannot reach. */
export function injectDotsCss(target?: Node | null): void {
  if (typeof document === 'undefined') return;
  const root = target && typeof target.getRootNode === 'function' ? target.getRootNode() : null;
  const shadow = root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : null;
  const scope: Document | ShadowRoot = shadow ?? document;
  if (styled.has(scope)) return;
  styled.add(scope);
  if (scope.getElementById(DOTS_STYLE_ID)) return;
  if (shadow) {
    const sheet = sharedSheet();
    if (sheet && 'adoptedStyleSheets' in shadow) {
      try {
        if (!shadow.adoptedStyleSheets.includes(sheet)) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
        return;
      } catch { /* a root from another document: fall back to a <style> element */ }
    }
  }
  const el = document.createElement('style');
  el.id = DOTS_STYLE_ID;
  el.textContent = DOTS_CSS;
  (shadow ?? document.head).appendChild(el);
}

/** A live region is heard when its content changes, not when it arrives already holding it (most screen readers only
 *  watch regions that exist), so the dots' spoken text is filled in this long after the region appears. */
export const DOTS_ANNOUNCE_DELAY_MS = 100;

/** Visually hidden but read by screen readers: the dots' label as text, so a live region has something to announce. */
export const VISUALLY_HIDDEN_CSS =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';
