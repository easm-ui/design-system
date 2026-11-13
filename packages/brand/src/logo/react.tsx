// EASM logo v6 as React components. The artwork comes from svg.ts, the same builder as the exported files.
import { useMemo, type CSSProperties, type SVGProps } from 'react';
import { logoArt, markArt, tileArt, type LogoTheme, type LogoVariant, type ProductName } from './svg';
import { imageName } from '../a11y';

type SvgAttrs = Omit<SVGProps<SVGSVGElement>, 'children' | 'dangerouslySetInnerHTML' | 'viewBox'>;

export interface EasmLogoProps extends SvgAttrs {
  /** EASM One (core only) or a product such as Forms, Calling, Ask, Kiosk, Library, Clouds, Support, Knowledge, Marketing or Automation (lights the right-hand rail).
   *  Omit for EASM. Only the horizontal lockup carries a product; the other variants ignore it. */
  product?: ProductName;
  variant?: LogoVariant;
  /** light (default) on paper or white · dark on dark grounds · ink or white for one-colour uses. */
  theme?: LogoTheme;
  /** Height in px or any CSS length. Defaults to 24, the sidebar size. Minimums: EASM lockup 20 px, product lockup 24 px,
   *  wordmark 48 px wide. The lockup never grows wider than its container: in a narrower one it scales down. */
  height?: number | string;
  /** Accessible name; defaults to the lockup's text, such as "EASM Forms". Pass "" when text beside it already says it. */
  title?: string;
}
/** The EASM logo: the horizontal lockup by default, or the stacked, wordmark and full-name lockups. */
export function EasmLogo({ product, variant = 'horizontal', theme = 'light', height = 24, title, style, 'aria-label': ariaLabel, ...svg }: EasmLogoProps) {
  const art = useMemo(() => logoArt({ variant, theme, product }), [variant, theme, product]);
  // Width follows the height through the artwork's ratio, capped at the container's width; the height then follows
  // the width, so a lockup too wide for a phone scales down whole instead of overflowing. A height or width set in
  // `style`, or a percentage height, keeps the plain height-driven box.
  const ratio = art.width / art.height;
  const plain = style?.height !== undefined || style?.width !== undefined || (typeof height === 'string' && height.trim().endsWith('%'));
  const box: CSSProperties = plain ? { height, width: 'auto' }
    : { width: typeof height === 'number' ? height * ratio : `calc(${height} * ${+ratio.toFixed(5)})`, height: 'auto' };
  const css: CSSProperties = { display: 'block', flex: 'none', ...box, maxWidth: '100%', aspectRatio: `${art.width} / ${art.height}`, overflow: 'visible', ...style };
  return <svg viewBox={art.viewBox} height={height} {...imageName(ariaLabel ?? title ?? art.label)} style={css} {...svg}
    dangerouslySetInnerHTML={{ __html: art.inner }} />;
}

export interface EasmMarkProps extends SvgAttrs {
  /** A product lights the right-hand rail; EASM and EASM One do not. */
  product?: ProductName;
  theme?: LogoTheme;
  /** The app icon and favicon tile: ink, corner radius 14, icon at 80% with white rails. */
  tile?: boolean;
  /** Pixel size or CSS length. Default 32 (collapsed sidebar). Never under 16 px. */
  size?: number | string;
  /** Accessible name; pass "" when text beside it already says EASM. */
  title?: string;
}
/** The Junction on its own: app icons, favicons, avatars and the collapsed sidebar. For an animated icon use EasmIcon. */
export function EasmMark({ product, theme = 'light', tile = false, size = 32, title, style, 'aria-label': ariaLabel, ...svg }: EasmMarkProps) {
  const art = useMemo(() => (tile ? tileArt({ product }) : markArt({ theme, product })), [tile, theme, product]);
  return <svg viewBox={art.viewBox} width={size} height={size} {...imageName(ariaLabel ?? title ?? art.label)}
    style={{ display: 'block', flex: 'none', ...style }} {...svg} dangerouslySetInnerHTML={{ __html: art.inner }} />;
}
