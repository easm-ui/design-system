'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, IconButton } from './actions';
import { Popover } from './overlays';
import { cx, UIIcon, useNativeFormReset, type ComponentSize } from './shared';

/** Date, range and time pickers built on Popover, replacing the browser's native pickers so they follow the theme. */
export const pickerComponentNames = ['DatePicker', 'DateRangePicker', 'TimePicker'] as const;

/* ---------- Date helpers (local calendar dates; values are ISO yyyy-mm-dd strings) ---------- */
export interface DateRange { start: string; end: string }
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 ? date : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const addMonths = (d: Date, n: number) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), daysIn(t.getFullYear(), t.getMonth())));
};
const sameDay = (a: Date | null | undefined, b: Date | null | undefined) => !!a && !!b && toISO(a) === toISO(b);
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7; // Monday first

function formatters(locale: string) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o);
  return {
    long: f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    field: f({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    short: f({ day: 'numeric', month: 'short', year: 'numeric' }),
    dayMonth: f({ day: 'numeric', month: 'short' }),
    month: f({ month: 'long', year: 'numeric' }),
    monthShort: f({ month: 'short' }),
    weekday: f({ weekday: 'short' }),
    weekdayNarrow: f({ weekday: 'narrow' }),
    weekdayLong: f({ weekday: 'long' }),
  };
}
type Formatters = ReturnType<typeof formatters>;
/** Column heads for one week. Two letters of the short name where that keeps the seven days apart
 * (Mo Tu We…); otherwise the narrow form, then the full short name, so no two days ever look the same
 * (in ur-PK two letters make Thursday and Friday identical; in ar every day starts the same). */
function weekdayHeads(fmt: Formatters, week: Date[]) {
  const short = week.map(d => fmt.weekday.format(d));
  const clipped = short.map(name => Array.from(name).slice(0, 2).join(''));
  if (new Set(clipped).size === week.length) return clipped;
  const narrow = week.map(d => fmt.weekdayNarrow.format(d));
  return new Set(narrow).size === week.length ? narrow : short;
}
function formatRange(fmt: Formatters, start: Date | null, end: Date | null) {
  if (!start) return null;
  if (!end || sameDay(start, end)) return fmt.short.format(start);
  return start.getFullYear() === end.getFullYear()
    ? `${fmt.dayMonth.format(start)} – ${fmt.short.format(end)}`
    : `${fmt.short.format(start)} – ${fmt.short.format(end)}`;
}

/* ---------- Field shell shared by the pickers ---------- */
interface PickerFieldProps {
  label: ReactNode; description?: ReactNode; error?: ReactNode; required?: boolean; disabled?: boolean;
  size?: ComponentSize; name?: string; id?: string; className?: string;
  /** Show the label to screen readers only, e.g. in a page header or a table cell. */
  hideLabel?: boolean;
}
function usePickerField(id: string | undefined, description: ReactNode, error: ReactNode) {
  const auto = useId();
  const base = id ?? `easm-picker-${auto}`;
  const descriptionId = description ? `${base}-description` : undefined, errorId = error ? `${base}-error` : undefined;
  // The trigger is named by its label AND the value it shows ("Follow up on, Tue 20 Oct 2026"): a label
  // associated with a button would otherwise replace the button's own text as its name.
  const labelId = `${base}-label`, valueId = `${base}-value`;
  return { id: base, labelId, valueId, labelledBy: `${labelId} ${valueId}`, descriptionId, errorId, describedBy: [descriptionId, errorId].filter(Boolean).join(' ') || undefined };
}
function PickerField({ field, label, description, error, required, size = 'md', className, hideLabel, children }:
  PickerFieldProps & { field: ReturnType<typeof usePickerField>; hideLabel?: boolean; children: ReactNode }) {
  return <div className={cx('easm-ui', 'easm-ui-field', 'easm-ui-picker-field', className)} data-size={size} data-labelled={!hideLabel || undefined} data-status={error ? 'error' : undefined}>
    <label className={hideLabel ? 'easm-ui-sr-only' : 'easm-ui-field-label'} htmlFor={field.id} id={field.labelId}>{label}{required ? <><span className="easm-ui-required" aria-hidden="true">{hideLabel ? '' : ' *'}</span><span className="easm-ui-sr-only">, required</span></> : null}</label>
    <div className="easm-ui-field-body">
      {children}
      {description ? <p className="easm-ui-field-description" id={field.descriptionId}>{description}</p> : null}
      {error ? <p className="easm-ui-field-message" data-status="error" id={field.errorId}><UIIcon name="error-circle" size={16} />{error}</p> : null}
    </div>
  </div>;
}

/* ---------- Form value ----------
 * What a picker submits. A text input kept out of sight rather than type="hidden", because hidden inputs are
 * barred from constraint validation: this way `required` stops an empty picker from submitting. When the
 * browser reports it missing, the picker shows its message and focus moves to the trigger. A completed,
 * non-cancelled form reset restores an uncontrolled picker's default without calling onValueChange. */
function FormValue({ name, value, required, disabled, triggerId, onMissing, onReset }: {
  name?: string; value: string; required?: boolean; disabled?: boolean; triggerId: string; onMissing: () => void; onReset: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const reset = useRef(onReset); reset.current = onReset;
  useNativeFormReset(ref, useCallback(() => reset.current(), []));
  return <input ref={ref} className="easm-ui-picker-value" name={name} value={value} required={required} disabled={disabled}
    onChange={() => {}} tabIndex={-1} aria-hidden="true" autoComplete="off"
    onInvalid={event => { event.preventDefault(); onMissing(); document.getElementById(triggerId)?.focus(); }} />;
}

/* ---------- Calendar: days → months → years ---------- */
type CalendarView = 'day' | 'month' | 'year';
type RangePart = 'start' | 'end' | 'mid' | 'single' | undefined;
interface CalendarProps {
  initial: Date; fmt: Formatters; min?: Date | null; max?: Date | null;
  onPick: (date: Date) => void;
  isSelected: (date: Date) => boolean;
  isSelectedMonth: (year: number, month: number) => boolean;
  isSelectedYear: (year: number) => boolean;
  rangeOf?: (date: Date) => RangePart;
  onHover?: (date: Date | null) => void;
}
function Calendar({ initial, fmt, min, max, onPick, isSelected, isSelectedMonth, isSelectedYear, rangeOf, onHover }: CalendarProps) {
  const now = useMemo(today, []);
  const [view, setView] = useState<CalendarView>('day');
  // The focused date is always kept inside min and max, so the grid's one Tab stop is never a disabled cell.
  const clamp = (d: Date) => (min && d < min ? min : max && d > max ? max : d);
  const [focus, setFocusState] = useState(() => clamp(initial));
  const grid = useRef<HTMLDivElement>(null), moveFocus = useRef(true);
  const setFocus = (d: Date, keyboard = true) => { moveFocus.current = keyboard; setFocusState(clamp(d)); };
  const switchView = (next: CalendarView) => { moveFocus.current = true; setView(next); };
  const y = focus.getFullYear(), m = focus.getMonth(), page = Math.floor(y / 12) * 12;
  const cellKey = view === 'day' ? toISO(focus) : view === 'month' ? `${y}-${m}` : String(y);
  useEffect(() => {
    if (!moveFocus.current) return;
    const t = setTimeout(() => grid.current?.querySelector<HTMLElement>(`[data-cell="${cellKey}"]`)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [cellKey, view]);
  // In the month and year views Escape steps back one view instead of closing the popover.
  useEffect(() => {
    if (view === 'day') return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !grid.current?.parentElement?.contains(document.activeElement)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      switchView(view === 'year' ? 'month' : 'day');
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [view]);
  const dayOff = (d: Date) => (!!min && d < min) || (!!max && d > max);
  const monthOff = (yy: number, mm: number) => (!!min && new Date(yy, mm + 1, 0) < min) || (!!max && new Date(yy, mm, 1) > max);
  const yearOff = (yy: number) => (!!min && new Date(yy, 11, 31) < min) || (!!max && new Date(yy, 0, 1) > max);
  const stride = view === 'day' ? 1 : view === 'month' ? 12 : 144;
  const unit = view === 'day' ? 'month' : view === 'month' ? 'year' : 'twelve years';
  // Paging stops at the bounds: Previous is unavailable when the whole previous month, year or page of
  // years is before min, and Next when the whole next one is after max.
  const previousOff = !!min && (view === 'day' ? new Date(y, m, 0) < min : view === 'month' ? new Date(y - 1, 11, 31) < min : new Date(page - 1, 11, 31) < min);
  const nextOff = !!max && (view === 'day' ? new Date(y, m + 1, 1) > max : view === 'month' ? new Date(y + 1, 0, 1) > max : new Date(page + 12, 0, 1) > max);
  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = view === 'day' ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
      : view === 'month' ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 } : { ArrowLeft: -12, ArrowRight: 12, ArrowUp: -36, ArrowDown: 36 };
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const key = rtl && event.key === 'ArrowLeft' ? 'ArrowRight' : rtl && event.key === 'ArrowRight' ? 'ArrowLeft' : event.key;
    let next: Date | null = null;
    if (steps[key] !== undefined) next = view === 'day' ? addDays(focus, steps[key]) : addMonths(focus, steps[key]);
    else if (view === 'day' && key === 'Home') next = addDays(focus, -weekdayIndex(focus));
    else if (view === 'day' && key === 'End') next = addDays(focus, 6 - weekdayIndex(focus));
    else if (key === 'PageUp') next = addMonths(focus, -(event.shiftKey ? 12 : 1) * stride);
    else if (key === 'PageDown') next = addMonths(focus, (event.shiftKey ? 12 : 1) * stride);
    if (!next) return;
    event.preventDefault();
    // Keep the focused date selectable: a step past min or max stops on the bound, so focus never lands on a disabled cell.
    if (min && next < min) next = min;
    if (max && next > max) next = max;
    if (!sameDay(next, focus)) setFocus(next);
  };

  let body: ReactNode;
  if (view === 'day') {
    const first = new Date(y, m, 1), start = addDays(first, -weekdayIndex(first));
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const weekdays = days.slice(0, 7), heads = weekdayHeads(fmt, weekdays);
    body = <table role="grid" aria-label={fmt.month.format(focus)} onMouseLeave={() => onHover?.(null)}>
      <thead><tr>{weekdays.map((d, i) => <th key={d.getDay()} scope="col" abbr={fmt.weekdayLong.format(d)}>{heads[i]}</th>)}</tr></thead>
      <tbody>{Array.from({ length: 6 }, (_, w) => <tr key={w}>{days.slice(w * 7, w * 7 + 7).map(d => <td key={toISO(d)}>
        <button type="button" className="easm-ui-cal-day" data-cell={toISO(d)} tabIndex={sameDay(d, focus) ? 0 : -1} disabled={dayOff(d)}
          aria-label={fmt.long.format(d)} aria-pressed={isSelected(d)} aria-current={sameDay(d, now) ? 'date' : undefined}
          data-outside={d.getMonth() !== m || undefined} data-range={rangeOf?.(d)}
          onMouseEnter={() => onHover?.(d)} onFocus={() => onHover?.(d)} onClick={() => { setFocus(d, false); onPick(d); }}>{d.getDate()}</button>
      </td>)}</tr>)}</tbody>
    </table>;
  } else if (view === 'month') {
    body = <div className="easm-ui-cal-grid" role="group" aria-label={String(y)}>{Array.from({ length: 12 }, (_, mm) => <button key={mm} type="button"
      className="easm-ui-cal-cell" data-cell={`${y}-${mm}`} tabIndex={mm === m ? 0 : -1} disabled={monthOff(y, mm)}
      aria-label={fmt.month.format(new Date(y, mm, 1))} aria-pressed={isSelectedMonth(y, mm)}
      data-current={(y === now.getFullYear() && mm === now.getMonth()) || undefined}
      onClick={() => { setFocus(new Date(y, mm, Math.min(focus.getDate(), daysIn(y, mm)))); switchView('day'); }}>{fmt.monthShort.format(new Date(y, mm, 1))}</button>)}</div>;
  } else {
    body = <div className="easm-ui-cal-grid" role="group" aria-label={`${page} – ${page + 11}`}>{Array.from({ length: 12 }, (_, i) => page + i).map(yy => <button key={yy} type="button"
      className="easm-ui-cal-cell" data-cell={String(yy)} tabIndex={yy === y ? 0 : -1} disabled={yearOff(yy)} aria-pressed={isSelectedYear(yy)}
      data-current={yy === now.getFullYear() || undefined}
      onClick={() => { setFocus(new Date(yy, m, Math.min(focus.getDate(), daysIn(yy, m)))); switchView('month'); }}>{yy}</button>)}</div>;
  }
  const title = view === 'day' ? fmt.month.format(focus) : view === 'month' ? String(y) : `${page} – ${page + 11}`;
  return <div className="easm-ui-cal" data-view={view}>
    <div className="easm-ui-cal-head">
      {view === 'year'
        ? <span className="easm-ui-cal-title" aria-live="polite">{title}</span>
        : <button type="button" className="easm-ui-cal-title easm-ui-cal-title-button" aria-live="polite"
            aria-label={view === 'day' ? `${title}. Choose month and year` : `${title}. Choose year`}
            onClick={() => switchView(view === 'day' ? 'month' : 'year')}>{title}<UIIcon name="chevron-down" size={16} /></button>}
      <div className="easm-ui-cal-nav">
        <IconButton icon="chevron-left" label={`Previous ${unit}`} size="sm" variant="subtle" aria-disabled={previousOff || undefined} onClick={() => setFocus(addMonths(focus, -stride), false)} />
        <IconButton icon="chevron-right" label={`Next ${unit}`} size="sm" variant="subtle" aria-disabled={nextOff || undefined} onClick={() => setFocus(addMonths(focus, stride), false)} />
      </div>
    </div>
    <div ref={grid} onKeyDown={onKeyDown}>{body}</div>
  </div>;
}

/* ---------- DatePicker ---------- */
export interface DatePickerProps extends PickerFieldProps {
  /** ISO date, yyyy-mm-dd; '' when empty. */
  value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Earliest and latest selectable ISO dates. */
  min?: string; max?: string;
  placeholder?: string; locale?: string;
}
export function DatePicker({ label, description, error, required, disabled, size = 'md', name, id, className, value, defaultValue = '',
  onValueChange, min, max, placeholder = 'Choose a date', locale = 'en-GB', hideLabel }: DatePickerProps) {
  const fmt = useMemo(() => formatters(locale), [locale]);
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const [missing, setMissing] = useState(false);
  const shownError = error ?? (missing && !current ? 'Choose a date.' : undefined);
  const field = usePickerField(id, description, shownError);
  const selected = fromISO(current);
  const [open, setOpen] = useState(false);
  const minDate = fromISO(min), maxDate = fromISO(max), now = useMemo(today, []);
  const choose = (d: Date | null) => {
    const next = d ? toISO(d) : '';
    // Clear on an empty picker only closes it.
    if (!next && !current) { setOpen(false); return; }
    if (value === undefined) setInternal(next);
    onValueChange?.(next); setOpen(false);
  };
  const todayOff = (!!minDate && now < minDate) || (!!maxDate && now > maxDate);
  return <PickerField {...{ field, label, description, error: shownError, required, size, className, hideLabel }}>
    <Popover dim={false} label={`Choose ${typeof label === 'string' ? label.toLowerCase() : 'a date'}`} align="start" open={open && !disabled} onOpenChange={next => !disabled && setOpen(next)}
      className="easm-ui-picker-popover" trigger={<button type="button" id={field.id} disabled={disabled} className="easm-ui-input easm-ui-picker-trigger"
        aria-haspopup="dialog" aria-labelledby={field.labelledBy} aria-describedby={field.describedBy} aria-invalid={shownError ? true : undefined} data-empty={!selected || undefined}>
        <span id={field.valueId} suppressHydrationWarning>{selected ? fmt.field.format(selected) : placeholder}</span><UIIcon name="calendar" size={20} /></button>}>
      {open ? <>
        <Calendar initial={selected ?? (minDate && now < minDate ? minDate : now)} fmt={fmt} min={minDate} max={maxDate} onPick={choose}
          isSelected={d => sameDay(d, selected)}
          isSelectedMonth={(yy, mm) => !!selected && selected.getFullYear() === yy && selected.getMonth() === mm}
          isSelectedYear={yy => !!selected && selected.getFullYear() === yy} />
        <div className="easm-ui-cal-foot">
          <Button size="sm" variant="subtle" onClick={() => choose(null)}>Clear</Button>
          <Button size="sm" variant="secondary" disabled={todayOff} onClick={() => choose(now)}>Today</Button>
        </div>
      </> : null}
    </Popover>
    {name || required ? <FormValue name={name} value={current} required={required} disabled={disabled} triggerId={field.id}
      onMissing={() => setMissing(true)} onReset={() => { if (value === undefined) setInternal(defaultValue); setMissing(false); }} /> : null}
  </PickerField>;
}

/* ---------- DateRangePicker ---------- */
export interface DateRangePreset { label: string; start: string; end: string }
export interface DateRangePickerProps extends PickerFieldProps {
  value?: DateRange | null; defaultValue?: DateRange | null;
  onValueChange?: (value: DateRange | null) => void;
  min?: string; max?: string;
  /** Quick ranges shown beside the calendar. Defaults to common reporting periods ending today. */
  presets?: DateRangePreset[] | false;
  /** Show the label to screen readers only, e.g. in a page header. */
  hideLabel?: boolean;
  /** 'field' looks like an input; 'button' is a compact filled control for headers and toolbars. */
  appearance?: 'field' | 'button';
  placeholder?: string; locale?: string;
}
function defaultPresets(): DateRangePreset[] {
  const t = today(), iso = toISO;
  return [
    { label: 'Today', start: iso(t), end: iso(t) },
    { label: 'Yesterday', start: iso(addDays(t, -1)), end: iso(addDays(t, -1)) },
    { label: 'Last 7 days', start: iso(addDays(t, -6)), end: iso(t) },
    { label: 'Last 30 days', start: iso(addDays(t, -29)), end: iso(t) },
    { label: 'This month', start: iso(new Date(t.getFullYear(), t.getMonth(), 1)), end: iso(t) },
    { label: 'Last month', start: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), end: iso(new Date(t.getFullYear(), t.getMonth(), 0)) },
  ];
}
export function DateRangePicker({ label, description, error, required, disabled, size = 'md', name, id, className, value, defaultValue = null,
  onValueChange, min, max, presets, hideLabel, appearance = 'field', placeholder = 'Choose dates', locale = 'en-GB' }: DateRangePickerProps) {
  const fmt = useMemo(() => formatters(locale), [locale]);
  const [internal, setInternal] = useState<DateRange | null>(defaultValue);
  const current = value === undefined ? internal : value;
  const [missing, setMissing] = useState(false);
  const shownError = error ?? (missing && !(current?.start && current?.end) ? 'Choose a start and end date.' : undefined);
  const field = usePickerField(id, description, shownError);
  const start = fromISO(current?.start), end = fromISO(current?.end);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [hover, setHover] = useState<Date | null>(null);
  // Each opening starts from the current value, in the same render that opens the popover, so the
  // calendar never mounts on a draft abandoned with Escape.
  const openChange = (next: boolean) => {
    if (disabled) return;
    setDraft(next ? { start, end } : { start: null, end: null });
    setHover(null);
    setOpen(next);
  };
  const minDate = fromISO(min), maxDate = fromISO(max);
  // With nothing chosen, open on today, kept inside min and max, so the first month shown is usable.
  const now = today();
  const opening = minDate && now < minDate ? minDate : maxDate && now > maxDate ? maxDate : now;
  const quick = presets === false ? [] : presets ?? defaultPresets();
  // A preset outside min/max is shown but cannot be chosen, the same rule the calendar applies to days.
  const minISO = minDate ? toISO(minDate) : null, maxISO = maxDate ? toISO(maxDate) : null;
  const outOfBounds = (p: DateRangePreset) => (minISO !== null && p.start < minISO) || (maxISO !== null && p.end > maxISO);
  const apply = (range: DateRange | null) => { if (value === undefined) setInternal(range); onValueChange?.(range); setOpen(false); };
  const pick = (d: Date) => {
    if (!draft.start || draft.end || d < draft.start) { setDraft({ start: d, end: null }); return; }
    apply({ start: toISO(draft.start), end: toISO(d) });
  };
  const lo = draft.start, hi = draft.end ?? (draft.start && hover && hover >= draft.start ? hover : null);
  const rangeOf = (d: Date): RangePart => !lo ? undefined
    : sameDay(d, lo) && (!hi || sameDay(lo, hi)) ? 'single' : sameDay(d, lo) ? 'start' : hi && sameDay(d, hi) ? 'end' : hi && d > lo && d < hi ? 'mid' : undefined;
  const text = formatRange(fmt, start, end);
  const button = appearance === 'button';
  return <PickerField {...{ field, label, description, error: shownError, required, size, hideLabel }} className={cx(button && 'easm-ui-picker-field-inline', className)}>
    <Popover dim={false} label={`Choose ${typeof label === 'string' ? label.toLowerCase() : 'dates'}`} align={button ? 'end' : 'start'} open={open && !disabled} onOpenChange={openChange}
      className="easm-ui-picker-popover easm-ui-range-popover" trigger={<button type="button" id={field.id} disabled={disabled}
        className={button ? 'easm-ui-range-button' : 'easm-ui-input easm-ui-picker-trigger'} aria-haspopup="dialog" aria-labelledby={field.labelledBy} aria-describedby={field.describedBy} aria-invalid={shownError ? true : undefined}
        data-empty={!text || undefined}>
        {button ? <UIIcon name="calendar" size={20} /> : null}<span id={field.valueId} suppressHydrationWarning>{text ?? placeholder}</span><UIIcon name={button ? 'chevron-down' : 'calendar'} size={button ? 16 : 20} /></button>}>
      {open ? <div className="easm-ui-range" data-presets={quick.length > 0 || undefined}>
        {quick.length ? <div className="easm-ui-range-presets" role="group" aria-label="Quick ranges">{quick.map(p => <button key={p.label} type="button"
          className="easm-ui-range-preset" aria-pressed={current?.start === p.start && current?.end === p.end} disabled={outOfBounds(p)}
          onClick={() => { if (!outOfBounds(p)) apply({ start: p.start, end: p.end }); }}>{p.label}</button>)}</div> : null}
        <div>
          <Calendar initial={draft.end ?? draft.start ?? end ?? opening} fmt={fmt} min={minDate} max={maxDate} onPick={pick} rangeOf={rangeOf} onHover={setHover}
            isSelected={d => { const part = rangeOf(d); return part === 'start' || part === 'end' || part === 'single'; }}
            isSelectedMonth={() => false} isSelectedYear={() => false} />
          <p className="easm-ui-range-hint" aria-live="polite">{!draft.start || draft.end ? 'Choose a start date' : `From ${fmt.short.format(draft.start)}. Choose an end date`}</p>
        </div>
      </div> : null}
    </Popover>
    {name || required ? <>
      <FormValue name={name && `${name}-start`} value={current?.start ?? ''} required={required} disabled={disabled} triggerId={field.id}
        onMissing={() => setMissing(true)} onReset={() => { if (value === undefined) setInternal(defaultValue); setMissing(false); }} />
      <FormValue name={name && `${name}-end`} value={current?.end ?? ''} required={required} disabled={disabled} triggerId={field.id}
        onMissing={() => setMissing(true)} onReset={() => {}} />
    </> : null}
  </PickerField>;
}

/* ---------- TimePicker ---------- */
export interface TimePickerProps extends PickerFieldProps {
  /** 24-hour time, HH:mm; '' when empty. */
  value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Minute interval: 1, 5, 10, 15 or 30. */
  step?: 1 | 5 | 10 | 15 | 30;
  /** 12-hour clock with AM/PM (default) or 24-hour. */
  hourCycle?: 12 | 24;
  placeholder?: string;
}
export function TimePicker({ label, description, error, required, disabled, size = 'md', name, id, className, value, defaultValue = '',
  onValueChange, step = 5, hourCycle = 12, placeholder = 'Choose a time', hideLabel }: TimePickerProps) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  // The newest value, updated the moment a part is committed, so two commits in one event (one column's
  // pending choice on blur, then a click in another column) build on each other.
  const latest = useRef(current);
  latest.current = current;
  const [missing, setMissing] = useState(false);
  const shownError = error ?? (missing && !current ? 'Choose a time.' : undefined);
  const field = usePickerField(id, description, shownError);
  const [open, setOpen] = useState(false);
  // Arrow keys move a highlight (the listbox's active option); Enter, a click, leaving the column or Done
  // commits it. Escape or a click outside closes without committing.
  const [active, setActive] = useState<Record<string, number>>({});
  const closing = useRef(false), typed = useRef({ text: '', at: 0, column: '' });
  // Set while a press on Clear or Now is under way. Safari does not focus a clicked button, so the column's
  // blur then has no relatedTarget to show where focus went.
  const pressingAction = useRef(false);
  const lists = useRef<Record<string, HTMLDivElement | null>>({});
  const parse = (time: string) => /^\d{2}:\d{2}$/.test(time) ? time.split(':').map(Number) as [number, number] : null;
  const parsed = parse(current);
  const H = parsed ? parsed[0] : null, M = parsed ? parsed[1] : null;
  const twelve = hourCycle === 12;
  const hour = H === null ? null : twelve ? ((H + 11) % 12) + 1 : H;
  const period = H === null ? null : H >= 12 ? 'PM' : 'AM';
  const set = (next: string) => {
    if (next === latest.current) return;
    latest.current = next;
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };
  const commit = (part: string, option: number | string) => {
    const base = parse(latest.current), h = base ? base[0] : null, minute = base ? base[1] : 0;
    const h24 = part === 'hour' ? (twelve ? (Number(option) % 12) + (h !== null && h >= 12 ? 12 : 0) : Number(option))
      : part === 'minute' ? h ?? 9
      : ((h === null ? 9 : ((h + 11) % 12) + 1) % 12) + (option === 'PM' ? 12 : 0);
    set(`${pad(h24)}:${pad(part === 'minute' ? Number(option) : minute)}`);
  };
  const columns = [
    { key: 'hour', label: 'Hour', options: twelve ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 24 }, (_, i) => i),
      selected: hour as number | string | null, text: (v: number | string) => twelve ? String(v) : pad(Number(v)) },
    { key: 'minute', label: 'Minute', options: Array.from({ length: 60 / step }, (_, i) => i * step),
      selected: M as number | string | null, text: (v: number | string) => pad(Number(v)) },
    ...(twelve ? [{ key: 'period', label: 'AM or PM', options: ['AM', 'PM'] as (number | string)[], selected: period as number | string | null, text: (v: number | string) => String(v) }] : []),
  ];
  const commitPending = () => columns.forEach(col => { const at = active[col.key]; if (at !== undefined && col.options[at] !== undefined) commit(col.key, col.options[at]); });
  const openChange = (next: boolean) => {
    if (disabled) return;
    closing.current = !next;
    if (next) setActive({});
    setOpen(next);
  };
  const close = () => { closing.current = true; setOpen(false); };
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => Object.values(lists.current).forEach(list => {
      const option = list?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (list && option) list.scrollTop = option.offsetTop - list.clientHeight / 2 + option.clientHeight / 2;
    }), 0);
    return () => clearTimeout(t);
  }, [open, current]);
  // Keep the highlighted option in view as it moves.
  useEffect(() => {
    for (const [key, index] of Object.entries(active)) {
      const list = lists.current[key], option = list?.children[index] as HTMLElement | undefined;
      if (!list || !option) continue;
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [active]);
  const setNow = () => {
    const d = new Date(); let minute = Math.round(d.getMinutes() / step) * step, h24 = d.getHours();
    if (minute === 60) { minute = 0; h24 = (h24 + 1) % 24; }
    setActive({});
    set(`${pad(h24)}:${pad(minute)}`);
  };
  const shown = parsed ? twelve ? `${hour}:${pad(M!)} ${period}` : `${pad(H!)}:${pad(M!)}` : null;
  return <PickerField {...{ field, label, description, error: shownError, required, size, className, hideLabel }}>
    <Popover dim={false} label={`Choose ${typeof label === 'string' ? label.toLowerCase() : 'a time'}`} align="start" open={open && !disabled} onOpenChange={openChange}
      className="easm-ui-picker-popover easm-ui-time-popover" trigger={<button type="button" id={field.id} disabled={disabled} className="easm-ui-input easm-ui-picker-trigger"
        aria-haspopup="dialog" aria-labelledby={field.labelledBy} aria-describedby={field.describedBy} aria-invalid={shownError ? true : undefined} data-empty={!shown || undefined}>
        <span id={field.valueId}>{shown ?? placeholder}</span><UIIcon name="clock" size={20} /></button>}>
      {open ? <>
        <div className="easm-ui-time" data-columns={columns.length}>{columns.map(col => {
          const selectedIndex = col.options.indexOf(col.selected as never);
          const at = active[col.key] ?? selectedIndex;
          const highlight = (index: number) => setActive(previous => ({ ...previous, [col.key]: index }));
          return <div key={col.key} className="easm-ui-time-column">
            <div className="easm-ui-time-head" aria-hidden="true">{col.label}</div>
            <div className="easm-ui-time-list" role="listbox" aria-label={col.label} tabIndex={0} ref={el => { lists.current[col.key] = el; }}
              aria-activedescendant={at >= 0 ? `${field.id}-${col.key}-${at}` : undefined}
              onBlur={event => {
                // Leaving the column commits its highlight, unless the popover is closing (Escape, a click
                // outside) or focus went to Clear or Now, which set the value themselves.
                const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
                const pending = active[col.key];
                if (closing.current || pressingAction.current || to?.closest('.easm-ui-time-actions') || pending === undefined || pending === selectedIndex) return;
                commit(col.key, col.options[pending]);
              }}
              onKeyDown={event => {
                const last = col.options.length - 1;
                let next: number | null = null;
                if (event.key === 'ArrowDown') next = at < 0 ? 0 : Math.min(last, at + 1);
                else if (event.key === 'ArrowUp') next = at < 0 ? 0 : Math.max(0, at - 1);
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = last;
                else if (event.key === 'PageDown') next = Math.min(last, Math.max(0, at) + 5);
                else if (event.key === 'PageUp') next = Math.max(0, at - 5);
                else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (at >= 0) commit(col.key, col.options[at]);
                  return;
                } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                  // Type to jump: "4" then "5" finds 45; "p" finds PM. Leading zeros are optional.
                  const now = Date.now(), key = event.key.toLowerCase();
                  const find = (text: string) => col.options.findIndex(option => {
                    const label = col.text(option).toLowerCase();
                    return label.startsWith(text) || label.replace(/^0+(?=\d)/, '').startsWith(text);
                  });
                  let text = typed.current.column === col.key && now - typed.current.at < 800 ? typed.current.text + key : key;
                  let found = find(text);
                  if (found < 0 && text !== key) { text = key; found = find(text); }
                  typed.current = { text, at: now, column: col.key };
                  if (found >= 0) { event.preventDefault(); highlight(found); }
                  return;
                }
                if (next !== null) { event.preventDefault(); highlight(next); }
              }}>
              {col.options.map((option, i) => <div key={option} id={`${field.id}-${col.key}-${i}`} role="option" className="easm-ui-time-option"
                aria-selected={option === col.selected} data-active={i === at || undefined}
                onClick={() => { highlight(i); commit(col.key, option); }}>{col.text(option)}</div>)}
            </div>
          </div>;
        })}</div>
        <div className="easm-ui-cal-foot">
          <div className="easm-ui-time-actions" onMouseDown={() => { pressingAction.current = true; setTimeout(() => { pressingAction.current = false; }, 0); }}>
            <Button size="sm" variant="subtle" onClick={() => { setActive({}); if (latest.current) set(''); close(); }}>Clear</Button>
            <Button size="sm" variant="subtle" onClick={setNow}>Now</Button>
          </div>
          <Button size="sm" variant="secondary" onClick={() => { commitPending(); close(); }}>Done</Button>
        </div>
      </> : null}
    </Popover>
    {name || required ? <FormValue name={name} value={current} required={required} disabled={disabled} triggerId={field.id}
      onMissing={() => setMissing(true)} onReset={() => { if (value === undefined) setInternal(defaultValue); setMissing(false); }} /> : null}
  </PickerField>;
}
