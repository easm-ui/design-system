'use client';

import { useCallback, useLayoutEffect, useState, type FocusEvent, type PointerEvent } from 'react';
import type { IconProps, IconName } from '@easm-ui/icons';
// Subpath imports keep the icons entry (which also re-exports the motion system) out of the static graph.
import { Icon } from '@easm-ui/icons/icon';
// Used by the field and action helpers at the end of this file (aliased so they never clash with other imports).
import { useEffect as useFieldEffect, type ForwardedRef as FieldForwardedRef, type RefObject as FieldRefObject } from 'react';
import { tokens as fieldTokens } from './tokens.generated';

export type ComponentSize = 'sm' | 'md' | 'lg';
export type UIIconName = IconName;
export function cx(...values: (string | false | undefined | null)[]) {
  return values.filter(Boolean).join(' ');
}

/** Functional glyphs inherit their control's ink; their geometry is always branded. */
export function UIIcon({ size = 20, tone = 'inherit', outline = true, className, name, ...props }: IconProps & { name: UIIconName }) {
  return <Icon {...props} name={name} size={size} tone={tone} outline={outline} className={cx('easm-ui-icon', className)} />;
}

export type WritingDirection = 'ltr' | 'rtl';
/** The writing direction and language in force at one place in the page. */
export interface PlaceLocale { dir?: WritingDirection; lang?: string }

/** The direction and language at an element: those of its nearest ancestors that declare them (`dir="auto"` declares
 * none). Pass the parent of an element a Radix primitive stamps with its own `dir` (a Select trigger). */
export function localeAt(element: Element | null | undefined): PlaceLocale {
  if (!element) return {};
  const dir = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
  const lang = element.closest('[lang]')?.getAttribute('lang')?.trim();
  return { ...(dir === 'ltr' || dir === 'rtl' ? { dir } : {}), ...(lang ? { lang } : {}) };
}

/** The element the person last pressed, clicked or typed in. A modal opened from code (no trigger) opens from there:
 * focus is no guide, since Safari does not focus a clicked button. Recorded in the capture phase, before the handler
 * that opens the overlay runs; the listeners are added once, when the first overlay mounts. */
let lastInteraction: Element | null = null;
let recordingInteractions = false;
function recordInteraction(event: Event) {
  if (event.target instanceof Element) lastInteraction = event.target;
}
function recordInteractions() {
  if (recordingInteractions || typeof document === 'undefined') return;
  recordingInteractions = true;
  for (const type of ['pointerdown', 'click', 'keydown']) document.addEventListener(type, recordInteraction, true);
}
/** Where a modal opened from code was opened from: the last element pressed or typed in, else the focused one. */
export function interactionOrigin(): Element | null {
  if (typeof document === 'undefined') return null;
  if (lastInteraction?.isConnected) return lastInteraction;
  return document.activeElement;
}

/** Overlays render at the end of <body>, so on their own they take the page's direction and language. A menu,
 * popup or modal opened from an English region of an Urdu page (or the other way round) takes those of the place it
 * opened from instead, read again each time it opens; `dir` is an explicit override. Spread the result on the
 * portaled panel (and give Radix roots that accept it the `dir`). */
export function useOpenerLocale(open: boolean, origin: () => Element | null | undefined, dir?: WritingDirection): PlaceLocale {
  const [found, setFound] = useState<PlaceLocale>({});
  useLayoutEffect(() => {
    recordInteractions();
    const next = localeAt(origin());
    setFound(current => current.dir === next.dir && current.lang === next.lang ? current : next);
    // origin reads refs and the focused element at this moment, so it is deliberately not a dependency.
  }, [open]);
  return dir ? { ...found, dir } : found;
}

/** Controlled state is never copied into local state or silently changed by the library. A component keeps the
 * mode it mounted with: in development, switching between controlled (a value) and uncontrolled (undefined)
 * warns once, because the shown state can then go stale. Pass null or '' for "nothing selected". */
export function useControllableState<T>(value: T | undefined, defaultValue: T, onChange?: (value: T) => void) {
  const [local, setLocal] = useState(defaultValue);
  const [mountedControlled] = useState(value !== undefined);
  const [warned] = useState(() => ({ current: false }));
  if (mountedControlled !== (value !== undefined) && !warned.current && !isProductionBuild()) {
    warned.current = true;
    if (typeof console !== 'undefined') console.warn(`EASM UI: a component changed from ${mountedControlled ? 'controlled to uncontrolled' : 'uncontrolled to controlled'}. Keep passing a value (null or '' for nothing selected), or never pass one.`);
  }
  const current = value === undefined ? local : value;
  const update = useCallback((next: T) => {
    if (Object.is(next, current)) return;
    if (value === undefined) setLocal(next);
    onChange?.(next);
  }, [value, current, onChange]);
  return [current, update] as const;
}

/** For focusable containers (scroll regions, tab panels, the message log, breadcrumbs): focus that a click
 * inside them gave the container shows no ring, even when keys are pressed afterwards to scroll, because a
 * ring round a whole region reads as a stray line. Focus reached with Tab still shows it. Pass the caller's
 * own handlers to keep them. */
export function quietPointerFocus<E extends HTMLElement>(own: {
  onPointerDown?: (event: PointerEvent<E>) => void; onFocus?: (event: FocusEvent<E>) => void; onBlur?: (event: FocusEvent<E>) => void;
} = {}) {
  return {
    onPointerDown: (event: PointerEvent<E>) => { event.currentTarget.dataset.pointerAt = String(Date.now()); own.onPointerDown?.(event); },
    onFocus: (event: FocusEvent<E>) => {
      const el = event.currentTarget;
      if (event.target === el && Date.now() - Number(el.dataset.pointerAt || 0) < 1000) el.dataset.pointerFocus = '';
      own.onFocus?.(event);
    },
    onBlur: (event: FocusEvent<E>) => { if (event.target === event.currentTarget) delete event.currentTarget.dataset.pointerFocus; own.onBlur?.(event); },
  };
}

/** A value that was not measured: a dash people see and words a screen reader reads, never a zero. The dash is
 * hidden and the words are visually hidden, because aria-label is not allowed on a plain span. */
export function MissingValue({ label = 'Not available' }: { label?: string }) {
  return <><span aria-hidden="true">—</span><span className="easm-ui-sr-only">{label}</span></>;
}

/** Numbers as people read them. Values of one or more keep at most `fractionDigits` decimals (1,412.5); values
 * between zero and one keep their significant digits instead, so a rate of 0.02 never rounds to 0. */
export function formatReadableNumber(value: number, locale = 'en', fractionDigits = 1) {
  const size = Math.abs(value);
  return size > 0 && size < 1
    ? value.toLocaleString(locale, { maximumSignificantDigits: Math.max(2, fractionDigits) })
    : value.toLocaleString(locale, { maximumFractionDigits: fractionDigits });
}

/** Whether a scroll container really overflows, kept current as it or its content resizes. Scroll regions
 * take focus (and a region name) only then, so a table that fits adds no Tab stop that does nothing.
 * A callback ref, so it follows a container that mounts later (after loading, or inside a closed disclosure). */
export function useOverflowing<T extends HTMLElement>() {
  const [overflowing, setOverflowing] = useState(false);
  const ref = useCallback((node: T | null) => {
    if (!node) return;
    const measure = () => setOverflowing(node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, []);
  return [ref, overflowing] as const;
}

/* Field and action helpers (actions, inputs, additional inputs, validation). */

declare const process: { env: { NODE_ENV?: string } };
/** True in a production bundle: bundlers replace process.env.NODE_ENV. Development, tests and unbundled use are not. */
function isProductionBuild() {
  try { return process.env.NODE_ENV === 'production'; } catch { return false; }
}
const reportedContentProblems = new Set<string>();
/** Content that cannot be presented properly (a blank label, a repeated option value). In development and tests it
 * throws, so the data is fixed where it comes from. In a production build it warns once per message and returns,
 * and the caller degrades (drops the option, falls back to a default), so one bad record never unmounts a page. */
export function reportContentProblem(message: string): void {
  if (!isProductionBuild()) throw new Error(message);
  if (reportedContentProblems.has(message)) return;
  reportedContentProblems.add(message);
  if (typeof console !== 'undefined') console.warn(`EASM UI: ${message}`);
}

/** The icon size every control pairs with its own size (tokens.icon): sm 16, md 20, lg 24. */
export function iconSizeFor(size: ComponentSize = 'md'): 16 | 20 | 24 {
  return fieldTokens.icon[size];
}

/** Writes a node to a forwarded ref of either kind. */
export function assignRef<T>(ref: FieldForwardedRef<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

/** Native form reset emits no change event. Waits until the reset event's cancellation is final, then runs
 * `reset` (which should restore only uncontrolled state). */
export function useNativeFormReset<T extends { form: HTMLFormElement | null; isConnected: boolean }>(ref: FieldRefObject<T | null>, reset: () => void) {
  useFieldEffect(() => {
    const control = ref.current, form = control?.form;
    if (!control || !form) return;
    const handleReset = (event: Event) => queueMicrotask(() => {
      if (!event.defaultPrevented && control.isConnected) reset();
    });
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [ref, reset]);
}

/* Content checks for navigation and patterns. */

/** A name, id or destination that must not be blank. Reported through reportContentProblem (throws in
 * development and tests, warns once in production). */
export function requireNonBlankText(value: string, subject: string) {
  if (typeof value !== 'string' || !value.trim()) reportContentProblem(`${subject} requires nonempty text.`);
}
/** Item identifiers that must be nonblank and unique within one list (they key the rendered rows). */
export function requireUniqueItemIds(items: readonly { id: string }[], subject: string) {
  if (new Set(items.map(item => item.id)).size !== items.length) reportContentProblem(`${subject} identifiers must be unique.`);
  for (const item of items) requireNonBlankText(item.id, `${subject} identifier`);
}

/* Content checks for the reporting layer (data display, insights, charts): the same messages as palette's
   requireLabel and requireUnique, reported through reportContentProblem, so in production one bad record warns
   and the report renders what it can instead of unmounting. */

/** A label that must not be blank. */
export function checkLabel(value: string | undefined, subject: string) {
  if (typeof value !== 'string' || !value.trim()) reportContentProblem(`${subject} requires a meaningful label.`);
}
/** Items keyed by id, each with a meaningful label. */
export function checkLabelledItems(items: readonly { id: string; label: string }[], subject: string) {
  if (new Set(items.map(item => item.id)).size !== items.length
    || items.some(item => typeof item.id !== 'string' || !item.id.trim() || typeof item.label !== 'string' || !item.label.trim()))
    reportContentProblem(`${subject} requires unique IDs and meaningful labels.`);
}
