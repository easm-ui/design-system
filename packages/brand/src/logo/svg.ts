// EASM logo v6 as SVG markup: one builder for every lockup, used by the React components and by the
// exported artwork files, so the two can never differ. Geometry and colours follow the brand guidelines
// sheet (logo v6, locked October 2026).
import { WORDMARK, CROSSBAR, PRODUCT_NAMES, DESCRIPTOR_SIDE, DESCRIPTOR_UNDER } from './artwork';
import { ORANGE, INK, PAPER, WHITE as W, GREY_DESCRIPTOR, GREY_DIVIDER, GREY_DESCRIPTOR_DARK, RAIL_ANGLES, devWarn } from '../motion/core/brand';
import { escapeMarkup } from '../motion/core/markup';
import { FULL_NAME_TEXT } from '../brand';

/** The four approved colour versions. light = full colour (ink and orange) on paper, white or light photos;
 * dark = reversed (paper and orange) on dark grounds; ink = one colour for fax, stamps, engraving and for
 * merchandise on signature orange; white = one colour for photo and video watermarks. */
export type LogoTheme = 'light' | 'dark' | 'ink' | 'white';
/** Products with outlined names. EASM One is the platform: core only. Every other product lights the
 * right-hand rail. A future product can pass any name; it is set in Geist Regular (load the font). */
export type ProductName = keyof typeof PRODUCT_NAMES | (string & {});
/** horizontal: the primary lockup · stacked: square spaces and profiles (EASM only) · wordmark: when the
 * icon is already nearby · descriptor: EASM with its full name beside it · descriptor-under: the full name
 * justified under the wordmark (covers, signage). */
export type LogoVariant = 'horizontal' | 'stacked' | 'wordmark' | 'descriptor' | 'descriptor-under';

const PALETTE: Record<LogoTheme, { ink: string; core: string; descriptor: string; divider: string }> = {
  light: { ink: INK, core: ORANGE, descriptor: GREY_DESCRIPTOR, divider: GREY_DIVIDER },
  dark: { ink: PAPER, core: ORANGE, descriptor: GREY_DESCRIPTOR_DARK, divider: GREY_DESCRIPTOR },
  ink: { ink: INK, core: INK, descriptor: INK, divider: INK },
  white: { ink: W, core: W, descriptor: W, divider: W },
};
/** The full name, with the ampersand: the same constant as BRAND.fullName. */
export const FULL_NAME = FULL_NAME_TEXT;

/** The platform names that never light a rail: EASM itself and the PRODUCTS entries marked `platform` (EASM One). */
const PLATFORM = new Set(['', 'EASM', 'One']);
const litFor = (product?: string) => (product && !PLATFORM.has(product) ? 0 : -1);

/** The Junction on its 64-unit grid: six 19.7 × 7.2 rails at 0°…300°, a 15 × 15 orange core.
 * `lit` is the rail drawn in orange: 0 (the right-hand rail) for products, -1 for EASM and EASM One. */
export function markShapes(rails: string, core: string, lit = -1, litColor = ORANGE): string {
  let out = '';
  RAIL_ANGLES.forEach((angle, i) => {
    out += `<rect x="42.4" y="28.4" width="19.7" height="7.2" rx="3.6" transform="rotate(${angle} 32 32)" fill="${escapeMarkup(i === lit ? litColor : rails)}"/>`;
  });
  return out + `<rect x="24.5" y="24.5" width="15" height="15" rx="3.75" fill="${escapeMarkup(core)}"/>`;
}

export interface LogoArt { viewBox: string; width: number; height: number; label: string; inner: string }

/** The icon alone (app icons, favicons, avatars, collapsed sidebars). */
export function markArt({ theme = 'light', product }: { theme?: LogoTheme; product?: string } = {}): LogoArt {
  const p = PALETTE[theme];
  const lit = theme === 'light' || theme === 'dark' ? litFor(product) : -1;
  const litColor = lit >= 0 ? ORANGE : p.ink;
  // the platform's mark is the EASM mark, but it is named for what it stands for (EASM One)
  return { viewBox: '0 0 64 64', width: 64, height: 64, label: product && product !== 'EASM' ? `EASM ${product}` : 'EASM', inner: markShapes(p.ink, p.core, lit, litColor) };
}

/** The app icon and favicon tile: 64 units, corner radius 14, ink fill, the icon at 80% with white rails.
 * Products light the right-hand rail. */
export function tileArt({ product }: { product?: string } = {}): LogoArt {
  const lit = litFor(product);
  return {
    viewBox: '0 0 64 64', width: 64, height: 64, label: product && product !== 'EASM' ? `EASM ${product}` : 'EASM',
    inner: `<rect width="64" height="64" rx="14" fill="${INK}"/><g transform="translate(6.4 6.4) scale(0.8)">${markShapes(W, ORANGE, lit)}</g>`,
  };
}

function nameShape(product: string, x: number, ink: string): string {
  const art = (PRODUCT_NAMES as Record<string, { xmin: number; xmax: number; d: string }>)[product];
  if (art) return `<path d="${art.d}" transform="translate(${x - art.xmin} 0)" fill="${escapeMarkup(ink)}"/>`;
  // A product without outlined artwork yet: Geist Regular at the wordmark's cap height (710 units).
  return `<text x="${x}" y="710" font-family="Geist, 'Geist Fallback', system-ui, sans-serif" font-weight="400" font-size="1000" fill="${escapeMarkup(ink)}">${escapeMarkup(product)}</text>`;
}
function nameWidth(product: string): number {
  const art = (PRODUCT_NAMES as Record<string, { xmin: number; xmax: number }>)[product];
  return art ? art.xmax - art.xmin : Math.round(product.length * 560);
}

/** Any lockup, as markup for an <svg> with the returned viewBox. */
export function logoArt({ variant = 'horizontal', theme = 'light', product }: { variant?: LogoVariant; theme?: LogoTheme; product?: ProductName } = {}): LogoArt {
  const p = PALETTE[theme];
  // only the horizontal lockup carries a product: the other variants are EASM's own (and never pair the full name
  // with a product), so they ignore it, lit rail included
  const horizontal = variant !== 'wordmark' && variant !== 'stacked' && variant !== 'descriptor' && variant !== 'descriptor-under';
  if (!horizontal && product && product !== 'EASM') devWarn(`the ${variant} lockup never carries a product; product "${product}" is ignored. Use the horizontal lockup.`);
  const lit = horizontal && (theme === 'light' || theme === 'dark') ? litFor(product) : -1;
  const named = product && product !== 'EASM' ? String(product) : '';
  const label = named ? `EASM ${named}` : 'EASM';
  const mark = (tx: number, ty: number) => `<g transform="translate(${tx} ${ty}) scale(17.1875)">${markShapes(p.ink, p.core, lit)}</g>`;
  const word = (tx: number, ty: number) => `<g transform="translate(${tx} ${ty})"><path d="${CROSSBAR}" fill="${p.core}"/><path d="${WORDMARK}" fill="${p.ink}"/></g>`;
  switch (variant) {
    case 'wordmark':
      return { viewBox: '0 -20 2578 750', width: 2578, height: 750, label: 'EASM', inner: word(0, 0) };
    case 'stacked':
      return { viewBox: '0 0 2694 2110', width: 2694, height: 2110, label: 'EASM', inner: mark(797, 0) + word(58, 1360) };
    case 'descriptor':
      return {
        viewBox: '0 -195 7983 1100', width: 7983, height: 1100, label: `EASM, ${FULL_NAME.replace('&', 'and')}`,
        inner: mark(0, -195) + word(1400, 0) + `<rect x="4278" y="95" width="14" height="520" fill="${p.divider}"/>`
          + `<path d="${DESCRIPTOR_SIDE[0]}" transform="translate(4592 135) scale(0.225)" fill="${p.descriptor}"/><path d="${DESCRIPTOR_SIDE[1]}" transform="translate(4592 415) scale(0.225)" fill="${p.descriptor}"/>`,
      };
    case 'descriptor-under':
      return {
        viewBox: '0 -20 3978 1300', width: 3978, height: 1300, label: `EASM, ${FULL_NAME.replace('&', 'and')}`,
        inner: mark(0, 81) + word(1400, 0)
          + `<path d="${DESCRIPTOR_UNDER[0]}" transform="translate(1400 923) scale(0.17)" fill="${p.descriptor}"/><path d="${DESCRIPTOR_UNDER[1]}" transform="translate(1400 1141) scale(0.17)" fill="${p.descriptor}"/>`,
      };
    default: {
      // Horizontal: icon 1.55 cap, 0.42 cap to the wordmark, 0.42 cap to the product name.
      const x = 4278, width = named ? x + nameWidth(named) : 3978;
      return { viewBox: `0 -195 ${width} 1100`, width, height: 1100, label, inner: mark(0, -195) + word(1400, 0) + (named ? nameShape(named, x, p.ink) : '') };
    }
  }
}

/** A complete standalone SVG file for any lockup, the icon or the app tile. */
export function svgFile(art: LogoArt): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeMarkup(art.viewBox)}" role="img" aria-label="${escapeMarkup(art.label)}">${art.inner}</svg>\n`;
}
