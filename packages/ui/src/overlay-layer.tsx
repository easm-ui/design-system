'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

interface OverlayLayerScope {
  level: number;
  anchorDepth: number;
}

/** Private portal context: React context survives a portal's change of DOM parent. Level 0 is the page;
 * each open modal holds a band of its own above it. */
export const OverlayLayerContext = createContext<OverlayLayerScope>({ level: 0, anchorDepth: 0 });

/** One modal activation's claim on a band. */
interface BandHold { level: number }
interface BandRegistry { top: number; holds: Set<BandHold> }

// Shared through the document so independent React roots and separate copies of the package stack together.
const registryKey = Symbol.for('easm.ui.modal-bands');
// The counter that versions before the band registry read; kept current so an older copy still opens above.
const legacyKey = Symbol.for('easm.ui.modal-band');
type LayerDocument = Document & { [registryKey]?: BandRegistry; [legacyKey]?: number };

function bandRegistry() {
  const owner = document as LayerDocument;
  return owner[registryKey] ??= { top: 0, holds: new Set() };
}

/** Bands stack while any modal is open or still animating out, so a new modal always opens above every
 * surface already on screen, including one fading away. When the last one is gone the stack starts again
 * at the first band, so z-index never climbs for the life of the page. */
function acquireBand(parentLevel: number): BandHold {
  const registry = bandRegistry();
  if (!registry.holds.size) registry.top = 0;
  const hold = { level: Math.max(registry.top, parentLevel) + 1 };
  registry.top = hold.level;
  registry.holds.add(hold);
  const owner = document as LayerDocument;
  owner[legacyKey] = Math.max(owner[legacyKey] ?? 0, hold.level);
  return hold;
}

function releaseBand(hold: BandHold | null | undefined) {
  if (!hold) return;
  const registry = bandRegistry();
  registry.holds.delete(hold);
  if (!registry.holds.size) registry.top = 0;
}

interface ModalRecord {
  /** The hold for the current activation. */
  current: BandHold | null;
  /** Holds of closed activations whose panel is still mounted for its exit animation. */
  exiting: BandHold[];
  /** Whether the modal's content element is in the document. */
  mounted: boolean;
  pendingRelease: object | null;
}

/**
 * Layer bands for overlays. Page anchors (menus, popovers, tooltips outside any modal) sit in band 0, at their
 * token z-index. Each open modal takes the next band (1000 higher per level), so its scrim and panel cover every
 * page surface and its own anchored surfaces sit above its panel. A modal's band is released when its panel has
 * left the document, after the exit animation.
 *
 * Modals attach the returned `ref` to their content element so the band can be held through the exit.
 */
export function useOverlayLayer(kind: 'modal' | 'anchor' | 'tooltip', active = false) {
  const parent = useContext(OverlayLayerContext);
  const [activation, setActivation] = useState({ active: false, level: parent.level + 1 });
  const record = useRef<ModalRecord>({ current: null, exiting: [], mounted: false, pendingRelease: null });
  useLayoutEffect(() => {
    if (kind !== 'modal') return;
    const state = record.current;
    // Any run of this effect cancels the release that a preceding cleanup scheduled (Strict Mode replays).
    state.pendingRelease = null;
    if (!active) {
      // A committed close is a genuine activation boundary: the next opening gets a fresh band. The panel
      // keeps its band while it animates out, unless it is already gone.
      if (state.current) {
        if (state.mounted) state.exiting.push(state.current);
        else releaseBand(state.current);
        state.current = null;
      }
      setActivation(previous => previous.active ? { ...previous, active: false } : previous);
      return;
    }
    if (!state.current || state.current.level <= parent.level) {
      const previous = state.current;
      state.current = acquireBand(parent.level);
      // The new band sits above the old one, which no longer paints anything of this modal's.
      releaseBand(previous);
      for (const hold of state.exiting.splice(0)) releaseBand(hold);
    }
    const level = state.current.level;
    setActivation(previous => previous.active && previous.level === level ? previous : { active: true, level });
    return () => {
      const release = {};
      state.pendingRelease = release;
      // Unmounting releases every band this modal holds. Strict Mode replays layout effects; when a replay
      // immediately follows this cleanup it cancels the release and the mounted popup keeps its band.
      queueMicrotask(() => {
        if (state.pendingRelease !== release) return;
        state.pendingRelease = null;
        releaseBand(state.current);
        state.current = null;
        for (const hold of state.exiting.splice(0)) releaseBand(hold);
      });
    };
  }, [kind, active, parent.level]);
  const ref = useCallback((node: HTMLElement | null) => {
    const state = record.current;
    state.mounted = node !== null;
    // The panel has left the document: its exit animation is over, so the bands it kept are free.
    if (!node) for (const hold of state.exiting.splice(0)) releaseBand(hold);
  }, []);
  const level = kind === 'modal' ? activation.level : parent.level;
  const anchorDepth = kind === 'modal' ? 0 : parent.anchorDepth + 1;
  // Modal bands start 1000 above the page. Anchored descendants gain a small ordering increment within their band.
  const offset = level * 1000 + anchorDepth * 2;
  return {
    scope: { level, anchorDepth },
    style: { '--easm-ui-layer-offset': offset } as CSSProperties,
    /** Attach to a modal's content element; anchors and tooltips may ignore it. */
    ref,
    // Mount content after allocation so Radix Popper measures the final band.
    // Keep the existing band during exit; later activations always get a fresh one.
    ready: kind !== 'modal' || !active || activation.active && level > parent.level,
  };
}
