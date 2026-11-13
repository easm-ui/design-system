'use client';

import { Children, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { BrandIconName, IconName } from '@easm-ui/icons';
import { BrandIcon } from '@easm-ui/icons/brand-icon';
import { Button, IconButton } from './actions';
import { Checkbox } from './inputs';
import { Popover } from './overlays';
import { cx, iconSizeFor, quietPointerFocus, reportContentProblem, UIIcon, useControllableState, type ComponentSize } from './shared';
import { useSlidingIndicator } from './motion';
import type { ChartTone } from './palette';

export interface SelectionOption { id: string; label: string; disabled?: boolean; icon?: IconName }
export interface TabItem extends SelectionOption { content: ReactNode }
export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string; items: TabItem[]; value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void; size?: ComponentSize;
  orientation?: 'horizontal' | 'vertical'; activation?: 'manual' | 'automatic';
}

function nextIndex(items: SelectionOption[], current: number, key: string, orientation: string, rtl: boolean) {
  const enabled = items.map((item, index) => item.disabled ? -1 : index).filter(index => index >= 0);
  if (!enabled.length) return undefined;
  if (key === 'Home') return enabled[0];
  if (key === 'End') return enabled[enabled.length - 1];
  const forward = orientation === 'vertical' ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
  const backward = orientation === 'vertical' ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key !== forward && key !== backward) return undefined;
  const position = enabled.indexOf(current);
  if (position < 0) return key === forward ? enabled[0] : enabled[enabled.length - 1];
  return enabled[(position + (key === forward ? 1 : -1) + enabled.length) % enabled.length];
}
const selectionIconSize = iconSizeFor;
/* Content problems throw in development and tests. In a production build they warn once and the control degrades:
   an empty chip renders nothing, and options without a usable ID or label (or with a repeated ID) are left out. */
function requireContent(content: ReactNode, subject: string) {
  if (content == null || typeof content === 'boolean' || typeof content === 'string' && !content.trim() || Array.isArray(content) && !content.length) {
    reportContentProblem(`${subject} requires meaningful text content.`);
    return false;
  }
  return true;
}
function isRtl(element: HTMLElement) { return getComputedStyle(element).direction === 'rtl'; }
/** The options a control can present: every option when they are valid, otherwise those with a unique, nonblank ID
 * and a nonblank label (after reporting the problem). */
function validateOptions<T extends SelectionOption>(label: string, options: T[]): T[] {
  if (typeof label !== 'string' || !label.trim()) reportContentProblem('Selection controls require a meaningful group label.');
  const seen = new Set<string>();
  const usable = options.filter(option => {
    const valid = typeof option.id === 'string' && !!option.id.trim() && typeof option.label === 'string' && !!option.label.trim() && !seen.has(option.id);
    seen.add(option.id);
    return valid;
  });
  if (usable.length === options.length) return options;
  reportContentProblem('Selection options require unique, nonempty IDs and labels.');
  return usable;
}

/**
 * Horizontal overflow for a scrolling row. A mouse wheel cannot scroll sideways, so overflow is made
 * visible (fade edges and paging buttons on the side that hides content) and the vertical wheel scrolls
 * the row while it can still move. Keyboard users reach every tab through arrow keys, which scroll the
 * focused tab into view.
 */
/** Overflow handling for a horizontal row (tabs, filter chips): edge state, wheel scrolling, paging and reveal.
 * `selectedSelector` finds the item to bring into view when the row is first laid out. */
export function useHorizontalOverflow(enabled: boolean, count: number, selectedSelector = '[aria-selected="true"]', { wheel = true }: { wheel?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const list = ref.current;
    if (!enabled || !list) return;
    const set = (start: boolean, end: boolean) => setEdges(current => current.start === start && current.end === end ? current : { start, end });
    // The first and last tabs tell us which side hides content. This follows reading direction (RTL too),
    // and also fires when a hidden panel containing the tabs becomes visible.
    let observer: IntersectionObserver | null = null, revealed = false;
    let first: Element | null = null, last: Element | null = null;
    const seen = new Map<Element, boolean>();
    const bind = () => {
      const nextFirst = list.firstElementChild, nextLast = list.lastElementChild;
      if (nextFirst === first && nextLast === last) return;
      observer?.disconnect();
      seen.clear();
      first = nextFirst; last = nextLast;
      if (!first || !last) { set(false, false); return; }
      seen.set(first, true).set(last, true);
      observer!.observe(first);
      if (last !== first) observer!.observe(last);
    };
    let mutations: MutationObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) seen.set(entry.target, entry.intersectionRatio >= 0.95);
        if (!first || !last) return;
        set(!seen.get(first), !seen.get(last));
        // The first time the row is actually laid out (it may start in a hidden panel), show the selected tab.
        if (!revealed && list.clientWidth > 0) { revealed = true; reveal(list.querySelector(selectedSelector)); }
      }, { root: list, threshold: [0, 0.5, 0.95, 1] });
      bind();
      // Items can be replaced without their number changing (tabs per record, relabelled filters): follow the
      // row's new ends rather than observing nodes that have left it.
      if (typeof MutationObserver !== 'undefined') {
        mutations = new MutationObserver(bind);
        mutations.observe(list, { childList: true });
      }
    }
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || list.scrollWidth - list.clientWidth < 4) return;
      const rtl = getComputedStyle(list).direction === 'rtl', delta = rtl ? -event.deltaY : event.deltaY;
      const offset = Math.abs(list.scrollLeft), room = list.scrollWidth - list.clientWidth;
      if ((delta < 0 && offset <= 0) || (delta > 0 && offset >= room - 1)) return;
      event.preventDefault();
      list.scrollBy({ left: rtl ? -delta : delta, behavior: 'auto' });
    };
    // Rows of chips turn a vertical wheel into sideways scrolling; tall content (a board) must not.
    if (wheel) list.addEventListener('wheel', onWheel, { passive: false });
    return () => { observer?.disconnect(); mutations?.disconnect(); list.removeEventListener('wheel', onWheel); };
  }, [enabled, count, selectedSelector, wheel]);
  // Scroll only the row (never the page) so an element sits fully inside it, clear of the fade edges.
  function reveal(element: Element | null | undefined) {
    const list = ref.current;
    if (!list || !element) return;
    const row = list.getBoundingClientRect(), item = element.getBoundingClientRect(), clear = 36;
    if (!row.width) return;
    if (item.left < row.left + clear) list.scrollBy({ left: item.left - row.left - clear });
    else if (item.right > row.right - clear) list.scrollBy({ left: item.right - row.right + clear });
  }
  const page = (direction: -1 | 1) => {
    const list = ref.current;
    if (!list) return;
    const rtl = getComputedStyle(list).direction === 'rtl';
    list.scrollBy({ left: direction * (rtl ? -1 : 1) * Math.max(120, list.clientWidth * 0.75) });
  };
  return { ref, edges, page, reveal };
}

export function Tabs({ label, items: givenItems, value, defaultValue, onValueChange, size = 'md', orientation = 'horizontal', activation = 'manual', className, ...props }: TabsProps) {
  const items = validateOptions(label, givenItems);
  const uid = useId();
  const [selected, select] = useControllableState(value, defaultValue ?? items.find(item => !item.disabled)?.id ?? '', onValueChange);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const selectedIndex = items.findIndex(item => item.id === selected && !item.disabled);
  const focusedIndex = items.findIndex(item => item.id === focusedId && !item.disabled);
  const focusIndex = focusedIndex >= 0 ? focusedIndex : selectedIndex >= 0 ? selectedIndex : items.findIndex(item => !item.disabled);
  const horizontal = orientation === 'horizontal';
  const overflow = useHorizontalOverflow(horizontal, items.length);
  useSlidingIndicator(overflow.ref, '.easm-ui-tab[aria-selected="true"]', selectedIndex);
  useEffect(() => {
    if (horizontal && selectedIndex >= 0) overflow.reveal(refs.current[selectedIndex]);
  }, [horizontal, selectedIndex]);
  const tablist = <div ref={overflow.ref} role="tablist" aria-label={label} aria-orientation={orientation} className="easm-ui-tab-list" aria-describedby={selected && selectedIndex < 0 ? `${uid}-unavailable` : undefined}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedId(null); }}>
      {items.map((item, index) => <button type="button" role="tab" key={item.id} ref={node => { refs.current[index] = node; }}
        id={`${uid}-tab-${index}`} aria-controls={`${uid}-panel-${index}`} aria-selected={selectedIndex === index}
        disabled={item.disabled} tabIndex={focusIndex === index ? 0 : -1} className="easm-ui-tab"
        onFocus={() => { if (focusIndex !== index) setFocusedId(item.id); }}
        onClick={() => { if (!item.disabled) { setFocusedId(item.id); select(item.id); } }} onKeyDown={event => {
          if (item.disabled || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
          const next = nextIndex(items, index, event.key, orientation, isRtl(event.currentTarget));
          if (next === undefined) return;
          event.preventDefault(); setFocusedId(items[next].id); refs.current[next]?.focus();
          if (activation === 'automatic') select(items[next].id);
        }}>{item.icon ? <UIIcon name={item.icon} size={selectionIconSize(size)} /> : null}<span className="easm-ui-selection-label">{item.label}</span></button>)}
    </div>;
  return <div {...props} className={cx('easm-ui easm-ui-tabs', className)} data-size={size} data-orientation={orientation}>
    {horizontal ? <div className="easm-ui-tab-scroller" data-overflow-start={overflow.edges.start} data-overflow-end={overflow.edges.end}>
      {overflow.edges.start ? <IconButton icon="chevron-left" label="Show previous tabs" size="sm" variant="secondary" tabIndex={-1}
        className="easm-ui-tab-scroll" data-side="start" onClick={() => overflow.page(-1)} /> : null}
      {tablist}
      {overflow.edges.end ? <IconButton icon="chevron-right" label="Show more tabs" size="sm" variant="secondary" tabIndex={-1}
        className="easm-ui-tab-scroll" data-side="end" onClick={() => overflow.page(1)} /> : null}
    </div> : tablist}
    {items.map((item, index) => <div role="tabpanel" tabIndex={0} {...quietPointerFocus()} key={item.id} id={`${uid}-panel-${index}`}
      aria-labelledby={`${uid}-tab-${index}`} hidden={selectedIndex !== index} className="easm-ui-tab-panel">{item.content}</div>)}
    {selected && selectedIndex < 0 ? <p id={`${uid}-unavailable`} className="easm-ui-selection-unavailable">The selected tab is unavailable. Choose another tab.</p> : null}
  </div>;
}

export interface ScrollRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the row for assistive technology ("Conversation filters"). */
  label: string;
  children: ReactNode;
  /** The item to keep in view when the row first lays out. Default: a pressed, selected or current item. */
  selectedSelector?: string;
  /** Names for the two page buttons. */
  previousLabel?: string;
  nextLabel?: string;
}
/** A single row of chips, filters or thumbnails that is wider than its space. It never wraps and never shows a
 * scrollbar: an arrow button marks the hidden side and pages it (as Tabs and QuickFilters do), so a mouse user can
 * see there is more and reach it. A vertical wheel scrolls it sideways; touch swipes it. Use it for any row that
 * would otherwise be `overflow-x: auto`. */
export function ScrollRow({ label, children, selectedSelector = '[aria-pressed="true"], [aria-selected="true"], [aria-current="true"], [aria-current="page"]',
  previousLabel = 'Show previous', nextLabel = 'Show more', className, ...props }: ScrollRowProps) {
  const overflow = useHorizontalOverflow(true, Children.count(children), selectedSelector);
  return <div {...props} className={cx('easm-ui easm-ui-scroll-row', className)}>
    <div className="easm-ui-tab-scroller" data-overflow-start={overflow.edges.start} data-overflow-end={overflow.edges.end}>
      {overflow.edges.start ? <IconButton icon="chevron-left" label={previousLabel} size="sm" variant="secondary" tabIndex={-1}
        className="easm-ui-tab-scroll" data-side="start" onClick={() => overflow.page(-1)} /> : null}
      <div ref={overflow.ref} role="group" aria-label={label} className="easm-ui-scroll-row-track">{children}</div>
      {overflow.edges.end ? <IconButton icon="chevron-right" label={nextLabel} size="sm" variant="secondary" tabIndex={-1}
        className="easm-ui-tab-scroll" data-side="end" onClick={() => overflow.page(1)} /> : null}
    </div>
  </div>;
}

export interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string; options: SelectionOption[]; value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void; size?: ComponentSize; disabled?: boolean;
  name?: string;
}
export function SegmentedControl({ label, options: givenOptions, value, defaultValue, onValueChange, size = 'md', disabled, name, className, ...props }: SegmentedControlProps) {
  const options = validateOptions(label, givenOptions);
  const uid = useId();
  const initial = defaultValue ?? options.find(option => !option.disabled)?.id ?? '';
  const [internal, setInternal] = useState(initial);
  const selected = value ?? internal;
  const select = (next: string) => { if (next === selected) return; if (value === undefined) setInternal(next); onValueChange?.(next); };
  const formRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = formRef.current, form = input?.form;
    if (!input || !form) return;
    const reset = (event: Event) => queueMicrotask(() => { if (!event.defaultPrevented && input.isConnected && value === undefined) setInternal(initial); });
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [value, initial, name, disabled]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex(option => option.id === selected && !option.disabled);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : options.findIndex(option => !option.disabled);
  const unavailable = !!selected && selectedIndex < 0;
  // Wider than its space, the control pages with arrows (as Tabs do) and keeps every label whole; it never wraps.
  const overflow = useHorizontalOverflow(true, options.length, '[aria-checked="true"]');
  const group = overflow.ref;
  useSlidingIndicator(group, '.easm-ui-segment[aria-checked="true"]', selectedIndex);
  useEffect(() => { overflow.reveal(group.current?.querySelector('[aria-checked="true"]')); }, [selectedIndex]);
  return <div className={cx('easm-ui easm-ui-segmented-frame', className)}>
    <div className="easm-ui-tab-scroller" data-overflow-start={overflow.edges.start} data-overflow-end={overflow.edges.end}>
    {overflow.edges.start ? <IconButton icon="chevron-left" label="Show previous options" size="sm" variant="secondary" tabIndex={-1}
      className="easm-ui-tab-scroll" data-side="start" onClick={() => overflow.page(-1)} /> : null}
  <div {...props} ref={group} role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} aria-invalid={unavailable || undefined} aria-describedby={[props['aria-describedby'], unavailable ? `${uid}-unavailable` : undefined].filter(Boolean).join(' ') || undefined} className="easm-ui-segmented" data-size={size}>
    {name && !disabled ? <input ref={formRef} type="hidden" name={name} value={selectedIndex >= 0 ? selected : ''} /> : null}
    {options.map((option, index) => <button type="button" role="radio" key={option.id} ref={node => { refs.current[index] = node; }}
      aria-checked={selectedIndex === index} disabled={disabled || option.disabled} tabIndex={focusIndex === index ? 0 : -1}
      onClick={() => { if (!disabled && !option.disabled) select(option.id); }} onKeyDown={event => {
        if (disabled || option.disabled || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
        const next = nextIndex(options, index, event.key, event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'vertical' : 'horizontal', isRtl(event.currentTarget));
        if (next === undefined) return; event.preventDefault(); select(options[next].id); refs.current[next]?.focus();
      }} className="easm-ui-segment" title={typeof option.label === 'string' ? option.label : undefined}>{option.icon ? <UIIcon name={option.icon} size={selectionIconSize(size)} /> : null}<span className="easm-ui-selection-label">{option.label}</span></button>)}
  </div>
    {overflow.edges.end ? <IconButton icon="chevron-right" label="Show more options" size="sm" variant="secondary" tabIndex={-1}
      className="easm-ui-tab-scroll" data-side="end" onClick={() => overflow.page(1)} /> : null}
    </div>
    {unavailable ? <p id={`${uid}-unavailable`} className="easm-ui-selection-unavailable">The selected value is unavailable. Choose another option.</p> : null}
  </div>;
}

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> {
  children: ReactNode; icon?: IconName; size?: 'sm' | 'md'; selected?: boolean;
  /** A category colour: the chip in its tint, and filled with it once selected. */
  tone?: ChartTone;
  onSelectedChange?: (selected: boolean) => void; onRemove?: () => void;
  removeLabel?: string; disabled?: boolean;
}
export function Chip({ children, icon, size = 'md', selected = false, tone, onSelectedChange, onRemove, removeLabel = `Remove ${typeof children === 'string' ? children : 'item'}`, disabled, className, ...props }: ChipProps) {
  if (!requireContent(children, 'Chip')) return null;
  if (onRemove && (typeof removeLabel !== 'string' || !removeLabel.trim())) {
    reportContentProblem('Chip removal requires a meaningful label.');
    removeLabel = typeof children === 'string' ? `Remove ${children}` : 'Remove item';
  }
  const content = <>{icon ? <UIIcon name={icon} size={16} /> : null}<span>{children}</span></>;
  return <span {...props} className={cx('easm-ui easm-ui-chip', className)} data-easm-tone={tone} data-size={size} data-selected={selected || undefined} data-disabled={disabled || undefined}>
    {onSelectedChange ? <button type="button" aria-pressed={selected} disabled={disabled} className="easm-ui-chip-select" onClick={() => onSelectedChange(!selected)}>{content}</button> : <span className="easm-ui-chip-content">{content}</span>}
    {onRemove ? <button type="button" aria-label={removeLabel} disabled={disabled} onClick={onRemove} className="easm-ui-chip-remove"><UIIcon name="close" size={16} /></button> : null}
  </span>;
}

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** `neutral` and `brand` are the plain tags; an accent colour (violet, rose, lime…) marks a category. */
  children: ReactNode; tone?: 'neutral' | 'brand' | ChartTone; icon?: IconName; size?: 'sm' | 'md';
  /** A channel or campus system's own mark in its colours (WhatsApp, Moodle, Koha…), in place of `icon`. */
  brand?: BrandIconName;
}
export function Tag({ children, tone = 'neutral', size = 'md', icon, brand, className, ...props }: TagProps) {
  if (!requireContent(children, 'Tag')) return null;
  const accent = tone !== 'neutral' && tone !== 'brand';
  return <span {...props} className={cx('easm-ui easm-ui-tag', className)} data-tone={accent ? undefined : tone} data-easm-tone={accent ? tone : undefined} data-size={size}>
    {brand ? <BrandIcon name={brand} appearance="glyph" size={16} /> : icon ? <UIIcon name={icon} size={16} /> : null}<span className="easm-ui-selection-label">{children}</span></span>;
}

export interface FilterControlProps { label: string; options: SelectionOption[]; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void; disabled?: boolean; size?: ComponentSize; className?: string }
export function FilterControl({ label, options: givenOptions, value, defaultValue = [], onValueChange, disabled, size = 'md', className }: FilterControlProps) {
  const options = validateOptions(label, givenOptions);
  const uid = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const [selected, select] = useControllableState(value, defaultValue, onValueChange);
  const active = options.filter(option => !option.disabled && selected.includes(option.id)).map(option => option.id);
  const unavailable = selected.some(id => !options.some(option => option.id === id && !option.disabled));
  // Active filters show in the trigger's tint and its count. The trigger opens a dialog; it is not a toggle, so it
  // carries no pressed state.
  return <div className={cx('easm-ui easm-ui-filter-control', className)}><Popover dim={false} title={label} className="easm-ui-filter-popover" align="start" open={open && !disabled} onOpenChange={next => { if (!disabled) setOpen(next); }} trigger={<Button variant="secondary" size={size} disabled={disabled} data-active={active.length > 0 || undefined} leadingIcon="filter" trailingIcon="chevron-down" aria-describedby={unavailable ? `${uid}-unavailable` : undefined}>{label}{active.length ? ` (${active.length})` : ''}</Button>}>
    <fieldset className="easm-ui-filter-options"><legend className="easm-ui-sr-only">{label}</legend>
      {options.map(option => <Checkbox key={option.id} size={size} label={<span className="easm-ui-filter-option-label">{option.icon ? <UIIcon name={option.icon} size={selectionIconSize(size)} /> : null}<span>{option.label}</span></span>} checked={active.includes(option.id)} disabled={disabled || option.disabled}
        onChange={event => select(event.target.checked ? [...active, option.id] : active.filter(id => id !== option.id))} />)}
      {!options.length && <p className="easm-ui-filter-empty">No filter options are available.</p>}
    </fieldset>
    <Button variant="subtle" size="sm" disabled={!selected.length || disabled} onClick={() => select([])}>Clear filters</Button>
  </Popover>{unavailable ? <p id={`${uid}-unavailable`} className="easm-ui-selection-unavailable">Some selected filters are unavailable. Review or clear this filter.</p> : null}</div>;
}
