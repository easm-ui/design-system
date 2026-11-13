import { cloneElement, type ReactElement, type ReactNode } from 'react';
import type { IconNode } from './core';

type Drawing = { readonly tag: IconNode['tag']; readonly attrs: Readonly<Record<string, string | number>>; readonly children?: readonly Drawing[] };
type Brushes = { fill?: string | number; stroke?: string | number };
type Draw = (node: Drawing, key: number) => ReactElement;

/** Alpha compositing, rather than surface-coloured paint, keeps foreground faces and halos correct
 * on every background. Masks are local to the SVG instance and contain no per-frame JavaScript. */
export function createOcclusionPainter(instance: string, draw: Draw) {
  const definitions: ReactNode[] = [];
  const prefix = `easm-${instance.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  let next = 0;
  function mask(cutout: ReactNode) {
    const id = `${prefix}-cut-${next++}`;
    definitions.push(<mask key={id} id={id} x={-32} y={-32} width={88} height={88}
      maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
      style={{ maskType: 'luminance', forcedColorAdjust: 'none' }}>
      <rect x={-32} y={-32} width={88} height={88} fill="white" stroke="none" />
      {cutout}
    </mask>);
    return id;
  }
  function erase(content: ReactNode, cutout: ReactNode) {
    return content == null ? null : <g mask={`url(#${mask(cutout)})`}>{content}</g>;
  }
  function knockout(nodes: readonly Drawing[], inherited: Brushes = {}, faces = false): Drawing[] {
    return nodes.flatMap(node => {
      const fill = node.attrs.fill ?? inherited.fill;
      const stroke = node.attrs.stroke ?? inherited.stroke;
      if (node.tag === 'g') {
        const children = knockout(node.children ?? [], { fill, stroke }, faces);
        return children.length ? [{ ...node, attrs: { ...node.attrs, fill: 'black', stroke: 'black' }, children }] : [];
      }
      if (!faces && fill !== 'background' && stroke !== 'background') return [];
      return [{ ...node, attrs: { ...node.attrs,
        fill: faces || fill === 'background' ? 'black' : 'none',
        // Include the face edge beneath the foreground's own outline, avoiding doubled AA seams.
        stroke: faces || fill === 'background' && stroke !== 'none' || stroke === 'background' ? 'black' : 'none',
      } }];
    });
  }
  function paint(nodes: readonly Drawing[], inherited: Brushes = {}): ReactNode {
    let result: ReactNode = null;
    nodes.forEach((node, index) => {
      const fill = node.attrs.fill ?? inherited.fill;
      const stroke = node.attrs.stroke ?? inherited.stroke;
      const cutouts = knockout([node], inherited);
      if (cutouts.length) result = erase(result, cutouts.map(draw));
      const attrs = { ...node.attrs,
        ...(fill === 'background' ? { fill: 'none' } : {}),
        ...(stroke === 'background' ? { stroke: 'none' } : {}),
      };
      let current: ReactNode = node.tag === 'g'
        ? cloneElement(draw({ ...node, attrs, children: undefined }, index), undefined, paint(node.children ?? [], { fill, stroke }))
        : draw({ ...node, attrs }, index);
      // A background stroke is a clearance halo. Erase the rim of its own painted fill as well.
      if (node.tag !== 'g' && stroke === 'background') {
        current = erase(current, draw({ ...node, attrs: { ...node.attrs, fill: 'none', stroke: 'black' } }, 0));
      }
      result = <>{result}{current}</>;
    });
    return result;
  }
  return { definitions, paint, mask, erase,
    cutouts: (nodes: readonly Drawing[], faces: readonly Drawing[] = []) =>
      [...knockout(nodes), ...knockout(faces, {}, true)],
  };
}
