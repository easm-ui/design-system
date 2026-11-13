import type { IconNode } from './core';
import type { GeometryNode, IconName } from './registry';

/** A semantic piece of the approved drawing. CSS animates this group, never the outer SVG. */
export interface IconMotionPart {
  id: string;
  nodes: readonly GeometryNode[];
  /** Foreground faces that hide earlier actors, independently of the selected fill treatment. */
  occludes?: readonly GeometryNode[];
  animation?: string;
  durationMs?: number;
  delayMs?: number;
  origin?: string;
  /** Use linear for densely sampled continuous curves; actions default to a smooth zero-velocity ease. */
  easing?: string;
  /** Event-only geometry (a message, a data packet, a receipt). Hidden in the approved resting pose. */
  temporary?: boolean;
  /** Static clipping window, inset from the 24-unit viewBox. Moving artwork stays inside this window. */
  clipInset?: string;
  /** The size of the part's gesture, read by the verb keyframes (motion-verbs.css): --mx, --mr, --ms… */
  vars?: Readonly<Record<string, string | number>>;
}

export interface IconMotionRecipe {
  name: IconName;
  title: string;
  family: 'Actions' | 'Communication' | 'Status' | 'AI and data' | 'Access' | 'Education';
  durationMs: number;
  /** Describes actual ongoing activity, as distinct from an illustrative review cycle. */
  loopAllowed?: boolean;
  /** A deliberately paced repeat period. Falls back to the bounded action duration. */
  loopDurationMs?: number;
  /** Optional cyclic choreography, including the return/rearm for the next event. */
  loopParts?: readonly IconMotionPart[];
  /** Explains how the result prepares the next cycle. */
  loopStory?: string;
  story: string;
  /** The visible causal sequence: preparation, operation, result. */
  beats?: readonly [string, string, string];
  parts: readonly IconMotionPart[];
}

export function part(id: string, nodes: readonly GeometryNode[] | GeometryNode, animation?: string,
  options: Pick<IconMotionPart, 'durationMs' | 'delayMs' | 'origin' | 'easing' | 'temporary' | 'clipInset' | 'occludes' | 'vars'> = {}): IconMotionPart {
  return { id, nodes: Array.isArray(nodes) ? nodes : [nodes as GeometryNode], animation, ...options };
}

export function path(d: string, attrs: IconNode['attrs'] = {}): GeometryNode {
  return { tag: 'path', attrs: { d, ...attrs } };
}

export function group(nodes: readonly GeometryNode[], attrs: IconNode['attrs'] = {}): GeometryNode {
  return { tag: 'g', attrs, children: nodes };
}
