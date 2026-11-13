import { forwardRef, useId, type CSSProperties } from 'react';
import { Icon, type NamedIconProps } from './Icon';
import { renderIcon, renderIconNode } from './core';
import { getIconMotion } from './motion-recipes';
import { geometry, type GeometryNode } from './registry';
import { createOcclusionPainter } from './icon-occlusion';
import type { IconMotionPart } from './motion-parts';
import { MotionInteraction } from './motion-interaction';

export interface MotionIconProps extends NamedIconProps {
  /** Explicit playback. An inactive icon can still preview a bounded interaction hint. */
  active?: boolean;
  /** Play the authored continuous cycle. Set active=false to restore the exact original artwork. */
  repeat?: boolean;
  /** Interaction responds to the enclosing button/link's hover and keyboard focus; never focus the SVG. */
  trigger?: 'manual' | 'interaction';
  /** Hints soften secondary gestures while preserving operation routes. Both modes restore the exact resting pose. */
  emphasis?: 'hint' | 'action';
  paused?: boolean;
  /** Visual cleanup only. Fires once when a bounded sequence ends; business success comes from the app. */
  onMotionComplete?: () => void;
}

const normalizedDrawings = new WeakMap<readonly GeometryNode[], readonly GeometryNode[]>();
function normalize(nodes: readonly GeometryNode[]): readonly GeometryNode[] {
  const cached = normalizedDrawings.get(nodes);
  if (cached) return cached;
  const result = nodes.map(node => ({ ...node,
    // Unit path length makes drawing independent of each stroke's physical length.
    attrs: node.tag === 'path' || node.tag === 'circle' || node.tag === 'rect' || node.tag === 'ellipse'
      ? { ...node.attrs, pathLength: 1 } : node.attrs,
    children: node.children ? normalize(node.children) : undefined,
  }));
  normalizedDrawings.set(nodes, result);
  return result;
}

/** Part-directed motion, opt-in and server-renderable. Unsupported names remain their original static icon. */
export const MotionIcon = forwardRef<SVGSVGElement, MotionIconProps>(function MotionIcon({
  name, active = false, repeat = false, trigger = 'manual', emphasis = 'action', paused = false,
  state = 'default', className, style, onMotionComplete, ...props
}, ref) {
  const instance = useId();
  const recipe = getIconMotion(name);
  if (!recipe) return <Icon {...props} ref={ref} name={name} state={state} className={className} style={style} />;
  const cycling = active && repeat;
  const sceneDuration = cycling ? recipe.loopDurationMs ?? recipe.durationMs : recipe.durationMs;
  const parts = cycling ? recipe.loopParts ?? recipe.parts : recipe.parts;
  const painter = createOcclusionPainter(instance, renderIconNode);
  const track = (piece: IconMotionPart, children: React.ReactNode, masking = false) => {
    const drawing = <g key={piece.id} className={masking ? 'easm-motion-mask-part' : 'easm-motion-part'}
      data-part={masking ? undefined : piece.id} data-mask-part={masking ? piece.id : undefined}
      data-moving={piece.animation ? 'true' : undefined}
      data-temporary={piece.temporary ? 'true' : undefined} opacity={piece.temporary ? 0 : undefined}
      style={{
        '--easm-part-animation': piece.animation ?? 'none',
        '--easm-part-duration': `${cycling ? sceneDuration : piece.durationMs ?? sceneDuration}ms`,
        // A delay staggers parts; in a repeating cycle it stays as a constant phase offset.
        '--easm-part-delay': `${piece.delayMs ?? 0}ms`,
        ...piece.vars,
        '--easm-part-ease': piece.easing ?? 'cubic-bezier(.45, 0, .55, 1)',
        transformOrigin: piece.origin ?? '12px 12px',
      } as CSSProperties}>{children}</g>;
    return piece.clipInset ? <g key={piece.id} className="easm-motion-window"
      style={{ clipPath: `inset(${piece.clipInset}) view-box` }}>{drawing}</g> : drawing;
  };
  let sequence: React.ReactNode = null;
  for (const piece of parts) {
    const cutouts = painter.cutouts(normalize(piece.nodes), piece.occludes);
    if (cutouts.length) sequence = painter.erase(sequence, track(piece, cutouts.map((node, index) => renderIconNode(node, index)), true));
    sequence = <>{sequence}{track(piece, painter.paint(normalize(piece.nodes)))}</>;
  }
  const resting = painter.paint(geometry[name]);
  // A split stroke can have a different antialias seam. Keep the original drawing for idle, suppression
  // and the final frame, and show the articulated layer only during the directed sequence.
  // A confirmed action interrupts an in-flight hover preview with fresh tracks. The outer SVG/ref stays
  // mounted; a later event while active is still true can be replayed with the caller's event key.
  // Mask mirrors must restart with visible tracks when a confirmed action interrupts a hint.
  const playbackKey = `${active}-${emphasis}-${repeat}`;
  const artwork = <>
    {painter.definitions.length ? <defs key={`masks-${playbackKey}`}>{painter.definitions}</defs> : null}
    <g key={`rest-${playbackKey}`} className="easm-motion-rest">{resting}</g>
    <g key={`sequence-${playbackKey}`} className="easm-motion-sequence" visibility="hidden">{sequence}</g>
  </>;
  // Do not pass an event function to native SVG for an otherwise static/server-rendered use.
  const onAnimationEnd: NamedIconProps['onAnimationEnd'] = onMotionComplete || props.onAnimationEnd ? event => {
    props.onAnimationEnd?.(event);
    if (event.animationName === 'easm-part-sequence-layer' && !(active && repeat)) onMotionComplete?.();
  } : undefined;
  const iconProps = {
    ...props, state,
    className: ['easm-motion-icon', className].filter(Boolean).join(' '),
    style: { ...style, '--easm-scene-duration': `${sceneDuration}ms` } as CSSProperties,
    'data-motion': 'parts',
    'data-recipe': recipe.name,
    'data-active': active && state !== 'disabled' ? 'true' : undefined,
    'data-repeat': active && repeat || undefined,
    'data-trigger': trigger,
    'data-emphasis': active ? emphasis : 'hint',
    'data-paused': paused || undefined,
    onAnimationEnd,
  };
  const element = renderIcon(name, [], iconProps, trigger === 'interaction' ? null : ref, artwork);
  return trigger === 'interaction' ? <MotionInteraction element={element} ref={ref} recipe={recipe.name}
    durationMs={sceneDuration} active={active} disabled={state === 'disabled'} paused={paused} /> : element;
});
