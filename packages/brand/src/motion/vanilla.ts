// The same animations without React: mount into any element (plain pages, other frameworks, web views).

import { IconEngine, collectIconParts, iconMarkup, type IconEngineOptions, type IconState } from './core/icon';
import { WaveEngine, collectWaveParts, waveMarkup, waveViewBox, WAVE, type WaveEngineOptions } from './core/wave';
import { DOTS_VIEWBOX, DOTS_PERIOD, DOTS_ANNOUNCE_DELAY_MS, dotsBox, dotsMarkup, injectDotsCss, VISUALLY_HIDDEN_CSS, type DotsVariant } from './core/dots';
import { ORANGE } from './core/brand';
import { DOTS_LABELS } from './core/meta';

let n = 0;
const SVG = 'http://www.w3.org/2000/svg';

/** Puts an animated EASM icon into `host`. Returns the engine: call setState(), setLevel(), dispose().
 *  Its accessible name follows the state (ICON_LABELS) unless you pass `label` ('' makes it decorative). */
export function mountIcon(host: Element, opts: IconEngineOptions & { state?: IconState; size?: number | string; railColor?: string } = {}): IconEngine {
  const svg = document.createElementNS(SVG, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', String(opts.size ?? 24));
  svg.setAttribute('height', String(opts.size ?? 24));
  svg.innerHTML = iconMarkup(opts.theme ?? 'light', `easmv${++n}`, opts.railColor);
  host.appendChild(svg);
  const e = new IconEngine(collectIconParts(svg), { ...opts, labels: true });
  if (opts.state) e.jump(opts.state); // the first paint shows the state itself, not a fade in from the still mark
  return e;
}

/** Puts an EASM waveform into `host`. Returns the engine: call setMode(), setLevel(), dispose().
 *  Its accessible name follows the mode (WAVE_LABELS) unless you pass `label` ('' makes it decorative). */
export function mountWaveform(host: Element, opts: WaveEngineOptions & { bars?: number; height?: number; color?: string } = {}): WaveEngine {
  const bars = opts.bars ?? 24, h = opts.height ?? 28;
  const svg = document.createElementNS(SVG, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', waveViewBox(bars));
  svg.setAttribute('height', String(h));
  svg.setAttribute('width', String((h * bars * WAVE.pitch) / WAVE.height));
  svg.innerHTML = waveMarkup(bars, opts.color ?? ORANGE);
  host.appendChild(svg);
  return new WaveEngine(collectWaveParts(svg), { ...opts, labels: true });
}

/** Puts the three-dot indicator into `host` (pure CSS once mounted). Returns the element; remove it when done.
 *  By default it is a status live region holding its label as text (announced); `announce: false` makes it a named
 *  image instead, for a chat that announces progress in its own live region. */
export function mountDots(host: Element, opts: { variant?: DotsVariant; size?: number; color?: string; speed?: number; label?: string; announce?: boolean } = {}): HTMLSpanElement {
  const v = opts.variant ?? 'typing', size = opts.size ?? 6, color = opts.color ?? 'currentColor';
  const name = opts.label ?? DOTS_LABELS[v], announce = opts.announce ?? true;
  const el = document.createElement('span');
  el.className = 'easm-dots' + (color !== 'currentColor' && color !== 'inherit' ? ' solid' : '');
  el.dataset.variant = v;
  if (announce) {
    el.setAttribute('role', 'status');
    if (name) el.setAttribute('aria-label', name);
  } else if (name) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', name);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
  el.style.setProperty('--easm-dots-period', `${(DOTS_PERIOD[v] / (opts.speed ?? 1)).toFixed(3)}s`);
  const box = dotsBox(size);
  el.innerHTML = `<svg viewBox="${DOTS_VIEWBOX}" width="${box.width}" height="${box.height}" aria-hidden="true" focusable="false">${dotsMarkup(color)}</svg>`;
  if (announce && name) {
    // the text arrives a moment after the region: a live region is heard when its content changes, not when it
    // arrives already holding it
    const text = document.createElement('span');
    text.setAttribute('style', VISUALLY_HIDDEN_CSS);
    el.appendChild(text);
    setTimeout(() => { text.textContent = name; }, DOTS_ANNOUNCE_DELAY_MS);
  }
  host.appendChild(el);
  injectDotsCss(el); // after it is placed, so a shadow root gets the CSS too
  return el;
}
