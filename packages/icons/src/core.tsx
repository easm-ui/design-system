import { createElement, forwardRef, useId, type ForwardedRef, type ReactElement, type ReactNode, type SVGProps } from 'react';
import { createOcclusionPainter } from './icon-occlusion';

export type IconState = 'default' | 'hover' | 'pressed' | 'selected' | 'disabled';
export type IconTone = 'brand' | 'neutral' | 'inverse' | 'inherit';
export type IconNode = {
  tag: 'path' | 'circle' | 'rect' | 'ellipse' | 'g';
  attrs: Record<string, string | number>;
  children?: IconNode[];
};
export type IconDefinition = {
  name: string;
  body: IconNode[];
};
/** Props the renderer fixes for every glyph. They stay accepted for compatibility but have no effect. */
type FixedSvgProps = 'fill' | 'stroke' | 'viewBox' | 'focusable' | 'strokeLinecap' | 'strokeLinejoin';
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'width' | 'height' | 'dangerouslySetInnerHTML' | 'strokeWidth' | FixedSvgProps> {
  size?: 16 | 20 | 24 | 32 | 48;
  /** The icon's accessible name. Omit for decorative icons next to an accessible control label.
   * `aria-label` and `aria-labelledby` also name the icon; `aria-hidden` hides even a named one. */
  label?: string;
  state?: IconState;
  tone?: IconTone;
  outline?: boolean;
  /** @deprecated Ignored: a glyph's fills come from its `tone`, `state` and `outline`. */
  fill?: SVGProps<SVGSVGElement>['fill'];
  /** @deprecated Ignored: strokes always follow `currentColor`; set `color` or `tone` instead. */
  stroke?: SVGProps<SVGSVGElement>['stroke'];
  /** @deprecated Ignored: every EASM glyph is drawn on the 24-unit grid. */
  viewBox?: SVGProps<SVGSVGElement>['viewBox'];
  /** @deprecated Ignored: icons are never focusable; put the interaction on a button. */
  focusable?: SVGProps<SVGSVGElement>['focusable'];
  /** @deprecated Ignored: the stroke style is part of the approved geometry. */
  strokeLinecap?: SVGProps<SVGSVGElement>['strokeLinecap'];
  /** @deprecated Ignored: the stroke style is part of the approved geometry. */
  strokeLinejoin?: SVGProps<SVGSVGElement>['strokeLinejoin'];
}

/** The read-only form of IconNode that stored drawings use. */
type DrawingNode = { readonly tag: IconNode['tag']; readonly attrs: { readonly [attribute: string]: string | number }; readonly children?: readonly DrawingNode[] };

// Named brushes in the geometry. Without the icon stylesheet the fallbacks follow the EASM UI tokens when
// they are loaded and the original icon colours when they are not.
const brushes: Record<string, string> = {
  ink: 'currentColor',
  core: 'var(--easm-icon-core, currentColor)',
  surface: 'var(--easm-icon-fill, var(--easm-ui-primary-surface, #EEF3FF))',
  background: 'var(--easm-icon-background, var(--easm-ui-surface, #FFFFFF))',
  contrast: 'var(--easm-icon-contrast, var(--easm-ui-surface, #FFFFFF))',
};

function element(node: DrawingNode, key: number, normalizePath = false): ReactElement {
  const attrs: Record<string, string | number> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    const prop = /^(data|aria)-/.test(name) ? name : name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    attrs[prop] = typeof value === 'string' && Object.hasOwn(brushes, value) ? brushes[value] : value;
  }
  if (normalizePath && node.tag === 'path') attrs.pathLength = 1;
  return createElement(node.tag, attrs, node.children?.map((child, index) => element(child, index, normalizePath)));
}

// Shared by the part-motion renderer so geometry, brushes and accessible SVG treatment stay identical.
export { element as renderIconNode };

/** The one SVG renderer behind every glyph: per-icon components (createIcon) and <Icon name>. */
export function renderIcon(
  name: string,
  body: readonly DrawingNode[],
  { size = 24, label, state = 'default', tone = 'brand', outline = false, className, ...rest }: IconProps,
  ref: ForwardedRef<SVGSVGElement>,
  artwork?: ReactNode,
  instance = 'static',
) {
  // The fixed attributes below are written after the spread, so fill, stroke, viewBox and the rest of
  // FixedSvgProps cannot override the geometry.
  const props: Record<string, unknown> = { ...rest };
  // A blank `label` does not hide a non-blank `aria-label`.
  const accessibleLabel = label?.trim() || (props['aria-label'] as string | undefined)?.trim() || undefined;
  const labelledBy = (props['aria-labelledby'] as string | undefined)?.trim() || undefined;
  const ariaHidden = props['aria-hidden'];
  const hidden = ariaHidden === true || ariaHidden === 'true' || (!accessibleLabel && !labelledBy);
  const role = props.role as string | undefined;
  delete props['aria-label'];
  delete props['aria-labelledby'];
  delete props['aria-hidden'];
  delete props.role;
  const normalizePath = props['data-motion'] === 'confirm';
  const painter = createOcclusionPainter(instance, (node, key) => element(node, key, normalizePath));
  const painted = artwork ?? painter.paint(body);
  return (
    <svg
      {...props}
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={['easm-icon', className].filter(Boolean).join(' ')}
      data-icon={name}
      data-state={state}
      data-tone={tone}
      data-outline={outline || undefined}
      role={hidden ? role : role ?? 'img'}
      aria-label={hidden ? undefined : accessibleLabel}
      aria-labelledby={hidden ? undefined : labelledBy}
      aria-hidden={hidden ? true : undefined}
    >
      {accessibleLabel && !hidden ? <title>{accessibleLabel}</title> : null}
      <g className="easm-icon-artwork">{painter.definitions.length ? <defs>{painter.definitions}</defs> : null}{painted}</g>
    </svg>
  );
}

/** Builds a glyph component that follows the EASM icon contract (24-unit grid, 1.6 stroke, currentColor,
 * tone and state styling, accessible naming). Individual icon modules use it; it does not import the
 * registry, so a product-specific glyph built with it costs only its own drawing. */
export function createIcon(definition: IconDefinition) {
  const Component = forwardRef<SVGSVGElement, IconProps>(function EasmIcon(props, ref) {
    const instance = useId();
    return renderIcon(definition.name, definition.body, props, ref, undefined, instance);
  });
  Component.displayName = `EasmIcon(${definition.name})`;
  return Component;
}
