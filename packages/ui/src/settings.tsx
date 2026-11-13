'use client';

import { useCallback, useId, useRef, useState, type ChangeEvent, type CSSProperties, type HTMLAttributes, type MouseEvent, type ReactNode, type Ref,
  type RefObject, type TextareaHTMLAttributes } from 'react';
import { IconButton } from './actions';
import { useHorizontalOverflow } from './selection';
import { cx, UIIcon, type UIIconName } from './shared';
import { requireLabel, finite, fullNumber } from './palette';
import { ToneIcon } from './insights';
import { EasmLink } from './link';
import { useSlidingIndicator } from './motion';

/* Settings layer: the AI settings screen and any long form of preferences. Sections are white
   blocks on the white page, rows are separated by space, and nothing is outlined. */

export const settingsComponentNames = ['Slider', 'SettingsLayout', 'SettingsNav', 'SettingsSection', 'SettingRow', 'PromptEditor', 'AdvancedSettings'] as const;

/* Numbers render the same on the server and in every browser, whatever the runtime's default locale. */
const formatNumber = fullNumber('en');
const joinIds = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;
/** Attaches a node to our own ref and the caller's, React 19 style: the returned cleanup detaches both. */
function bindRefs<T>(node: T | null, own: { current: T | null }, ref: Ref<T> | undefined) {
  own.current = node;
  const cleanup = typeof ref === 'function' ? ref(node) : ref ? (ref.current = node, undefined) : undefined;
  return () => {
    own.current = null;
    if (typeof cleanup === 'function') cleanup();
    else if (typeof ref === 'function') ref(null);
    else if (ref) ref.current = null;
  };
}
/** A plain left click: modified clicks (new tab, new window, download) and other buttons keep the browser's behaviour. */
const plainClick = (event: MouseEvent) => !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/* ------------------------------------------------------------------ Slider */

export interface SliderMark { value: number; label: string }
export interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  label: string;
  description?: ReactNode;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** How the value is shown and read out, such as 0.7 or "70%". */
  formatValue?: (value: number) => string;
  /** Words under the track, such as Precise at the start and Creative at the end. */
  marks?: readonly SliderMark[];
  disabled?: boolean;
  name?: string;
  /** The range input itself, for focusing it (for example on a validation error). */
  inputRef?: Ref<HTMLInputElement>;
  ref?: Ref<HTMLDivElement>;
}
/** A native range input with a filled track: keyboard, touch and screen readers work as the platform does. */
export function Slider({ label, description, value, defaultValue, onValueChange, min = 0, max = 100, step = 1,
  formatValue = v => String(v), marks, disabled, name, inputRef, className, style, ...props }: SliderProps) {
  requireLabel(label, 'Slider');
  if (!finite(min) || !finite(max) || max <= min) throw new Error('Slider max must be greater than min.');
  const id = useId();
  const [inner, setInner] = useState(defaultValue ?? min);
  const current = Math.min(max, Math.max(min, value ?? inner));
  const share = (current - min) / (max - min);
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };
  return <div {...props} className={cx('easm-ui easm-ui-slider', className)} data-disabled={disabled || undefined}
    style={{ '--easm-slider-fill': `${share * 100}%`, ...style } as CSSProperties}>
    <div className="easm-ui-slider-head">
      <label htmlFor={`${id}-input`} className="easm-ui-slider-label">{label}</label>
      <output htmlFor={`${id}-input`} className="easm-ui-slider-value" aria-hidden="true">{formatValue(current)}</output>
    </div>
    {description ? <p id={`${id}-description`} className="easm-ui-slider-description">{description}</p> : null}
    <input ref={inputRef} id={`${id}-input`} type="range" className="easm-ui-slider-input" min={min} max={max} step={step} value={current}
      onChange={change} disabled={disabled} name={name} aria-valuetext={formatValue(current)}
      aria-describedby={description ? `${id}-description` : undefined} />
    {marks?.length ? <div className="easm-ui-slider-marks" aria-hidden="true">
      {marks.map(m => <span key={m.value} style={{ insetInlineStart: `${((m.value - min) / (max - min)) * 100}%` }}
        data-edge={m.value <= min ? 'start' : m.value >= max ? 'end' : undefined}>{m.label}</span>)}
    </div> : null}
  </div>;
}

/* ---------------------------------------------------------- SettingsLayout */

export interface SettingsLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** Usually a SettingsNav. */
  nav: ReactNode;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}
/** Menu beside the content when there is room; above it, as a scrolling row, when there is not.
 * The switch follows the layout's own width, so it works in a page, a split view or a drawer. */
export function SettingsLayout({ nav, children, className, ...props }: SettingsLayoutProps) {
  return <div {...props} className={cx('easm-ui easm-ui-settings-layout', className)}>
    <div className="easm-ui-settings-layout-grid">
      <div className="easm-ui-settings-layout-nav">{nav}</div>
      <div className="easm-ui-settings-layout-content">{children}</div>
    </div>
  </div>;
}

/* ------------------------------------------------------------- SettingsNav */

export interface SettingsNavItem { id: string; label: string; description?: string; icon?: UIIconName; href?: string; badge?: ReactNode; disabled?: boolean }
export interface SettingsNavProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  label: string;
  items: readonly SettingsNavItem[];
  value: string;
  /** With hrefs as well, a plain click calls this instead of following the link; Cmd, Ctrl, Shift or Alt-click
   * and middle-click still open the link (a new tab or window). */
  onValueChange?: (id: string) => void;
  ref?: Ref<HTMLElement>;
}
/** Sections of a settings area, each with a line that says what is inside. Links when items have an
 * href (through the app's router link when EasmUIProvider sets one), buttons otherwise; the current one
 * carries aria-current. */
export function SettingsNav({ label, items, value, onValueChange, className, ref, ...props }: SettingsNavProps) {
  requireLabel(label, 'SettingsNav');
  // In a narrow settings layout the list runs sideways: it pages with arrows, as Tabs do, instead of hiding its
  // later sections past the edge. The current section's fill slides along the list, and scrolls with it.
  const overflow = useHorizontalOverflow(true, items.length, '[aria-current="page"]');
  const list = overflow.ref as unknown as RefObject<HTMLElement | null>;
  useSlidingIndicator(list, '.easm-ui-settings-nav-item[aria-current="page"]', value);
  return <nav {...props} ref={ref} aria-label={label} className={cx('easm-ui easm-ui-settings-nav', className)}>
    <div className="easm-ui-settings-nav-scroller easm-ui-tab-scroller" data-overflow-start={overflow.edges.start} data-overflow-end={overflow.edges.end}>
    {overflow.edges.start ? <IconButton icon="chevron-left" label="Show previous sections" size="sm" variant="secondary" tabIndex={-1}
      className="easm-ui-tab-scroll" data-side="start" onClick={() => overflow.page(-1)} /> : null}
    <ul ref={overflow.ref as unknown as RefObject<HTMLUListElement>}>
      {items.map(item => {
        const current = item.id === value;
        const inner = <>
          {item.icon ? <span className="easm-ui-settings-nav-icon" aria-hidden="true"><UIIcon name={item.icon} size={20} /></span> : null}
          <span className="easm-ui-settings-nav-copy">
            <span className="easm-ui-settings-nav-label">{item.label}</span>
            {item.description ? <span className="easm-ui-settings-nav-description">{item.description}</span> : null}
          </span>
          {item.badge ? <span className="easm-ui-settings-nav-badge">{item.badge}</span> : null}
        </>;
        const common = { className: 'easm-ui-settings-nav-item', 'aria-current': current ? 'page' as const : undefined };
        return <li key={item.id}>
          {item.href && !item.disabled
            ? <EasmLink {...common} href={item.href} onClick={onValueChange ? (event) => { if (!plainClick(event)) return; event.preventDefault(); onValueChange(item.id); } : undefined}>{inner}</EasmLink>
            : <button {...common} type="button" disabled={item.disabled} onClick={() => onValueChange?.(item.id)}>{inner}</button>}
        </li>;
      })}
    </ul>
    {overflow.edges.end ? <IconButton icon="chevron-right" label="Show more sections" size="sm" variant="secondary" tabIndex={-1}
      className="easm-ui-tab-scroll" data-side="end" onClick={() => overflow.page(1)} /> : null}
    </div>
  </nav>;
}

/* --------------------------------------------------------- SettingsSection */

export interface SettingsSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  description?: ReactNode;
  icon?: UIIconName;
  actions?: ReactNode;
  /** A save bar or a note at the end of the section. */
  footer?: ReactNode;
  headingLevel?: 2 | 3;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}
export function SettingsSection({ title, description, icon, actions, footer, headingLevel = 2, children, className, ...props }: SettingsSectionProps) {
  requireLabel(title, 'SettingsSection');
  const id = useId();
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return <section {...props} aria-labelledby={`${id}-title`} className={cx('easm-ui easm-ui-settings-section', className)}>
    <header className="easm-ui-settings-section-header">
      {icon ? <ToneIcon icon={icon} tone="blue" /> : null}
      <div className="easm-ui-settings-section-heading">
        <Heading id={`${id}-title`}>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="easm-ui-settings-section-actions">{actions}</div> : null}
    </header>
    <div className="easm-ui-settings-section-body">{children}</div>
    {footer ? <footer className="easm-ui-settings-section-footer">{footer}</footer> : null}
  </section>;
}

/* -------------------------------------------------------------- SettingRow */

export interface SettingRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  label: string;
  description?: ReactNode;
  /** Set to the control's id to make the title its visible label. Otherwise the row is a labelled
   * group and the control inside keeps its own (possibly hidden) label. */
  htmlFor?: string;
  /** 'inline' puts the control at the end of the row; 'stacked' under the text. Inline rows stack
   * by themselves when the section is narrow. */
  layout?: 'inline' | 'stacked';
  /** The description's id. With htmlFor, put the same id in the control's aria-describedby so the description
   * is read with the control (a label names a control but does not describe it). */
  descriptionId?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}
export function SettingRow({ label, description, htmlFor, layout = 'inline', descriptionId, children, className, ...props }: SettingRowProps) {
  requireLabel(label, 'SettingRow');
  const id = useId();
  const descId = descriptionId ?? `${id}-description`;
  const Title = htmlFor ? 'label' : 'span';
  return <div {...props} className={cx('easm-ui-setting-row', className)} data-layout={layout}
    role={htmlFor ? undefined : 'group'} aria-labelledby={htmlFor ? undefined : `${id}-label`} aria-describedby={!htmlFor && description ? descId : undefined}>
    <div className="easm-ui-setting-row-copy">
      <Title id={`${id}-label`} className="easm-ui-setting-row-label" {...(htmlFor ? { htmlFor } : {})}>{label}</Title>
      {description ? <p id={descId} className="easm-ui-setting-row-description">{description}</p> : null}
    </div>
    <div className="easm-ui-setting-row-control">{children}</div>
  </div>;
}

/* ------------------------------------------------------------ PromptEditor */

export interface PromptEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange' | 'children'> {
  label: string;
  description?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Placeholders the prompt can use; each one inserts itself at the cursor. */
  variables?: readonly string[];
  /** Shown as a guide: roughly four characters per token. */
  tokenHint?: boolean;
  error?: string;
  /** The text field, for focusing it (for example on a validation error). */
  ref?: Ref<HTMLTextAreaElement>;
}
/** A monospace editor for system prompts and templates, with variable chips and a live count. */
export function PromptEditor({ label, description, value, defaultValue = '', onValueChange, variables, tokenHint = true, maxLength,
  error, rows = 10, className, id: idProp, disabled, readOnly, ref, onSelect, 'aria-describedby': describedBy, ...props }: PromptEditorProps) {
  requireLabel(label, 'PromptEditor');
  const auto = useId();
  const id = idProp ?? `${auto}-prompt`;
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const set = (next: string) => { if (value === undefined) setInner(next); onValueChange?.(next); };
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const setField = useCallback((node: HTMLTextAreaElement | null) => bindRefs(node, fieldRef, ref), [ref]);
  // The last caret position in the editor; a chip clicked before the editor was used appends. Kept in state so
  // the chips' availability (maxLength) follows a selection change as well as an edit.
  const [caret, setCaret] = useState<[number, number] | null>(null);
  // Where a chip would go: the last caret (kept inside the current text, which may have changed from
  // outside) or the end.
  const span = (): [number, number] => {
    const [a, b] = caret ?? [text.length, text.length];
    return [Math.min(a, text.length), Math.min(b, text.length)];
  };
  // A chip that would push the prompt past maxLength is disabled, like typing past it is impossible.
  const fits = (token: string) => {
    if (maxLength === undefined) return true;
    const [start, end] = span();
    return text.length - (end - start) + token.length + 4 <= maxLength;
  };
  const insert = (token: string) => {
    if (!fits(token)) return;
    const field = fieldRef.current;
    const [start, end] = span();
    const piece = `{{${token}}}`;
    set(text.slice(0, start) + piece + text.slice(end));
    setCaret([start + piece.length, start + piece.length]);
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + piece.length, start + piece.length); });
  };
  const count = formatNumber(text.length);
  const described = joinIds(describedBy, description ? `${auto}-description` : null, `${auto}-count`, error ? `${auto}-error` : null);
  return <div className={cx('easm-ui easm-ui-prompt-editor', className)} data-invalid={error ? true : undefined} data-disabled={disabled || undefined}>
    <label htmlFor={id} className="easm-ui-prompt-editor-label">{label}</label>
    {description ? <p id={`${auto}-description`} className="easm-ui-prompt-editor-description">{description}</p> : null}
    <div className="easm-ui-prompt-editor-box">
      {variables?.length && !readOnly ? <div className="easm-ui-prompt-editor-vars" role="group" aria-label="Insert a variable">
        {variables.map(v => <button key={v} type="button" disabled={disabled || !fits(v)} onClick={() => insert(v)} className="easm-ui-prompt-editor-var">
          <UIIcon name="braces" size={16} />{v}</button>)}
      </div> : null}
      <textarea {...props} ref={setField} id={id} rows={rows}
        onSelect={event => {
          const { selectionStart: a, selectionEnd: b } = event.currentTarget;
          setCaret(current => current && current[0] === a && current[1] === b ? current : [a, b]);
          onSelect?.(event);
        }} value={text} disabled={disabled} readOnly={readOnly} maxLength={maxLength} spellCheck={false}
        aria-invalid={error ? true : undefined} aria-describedby={described} onChange={event => set(event.target.value)} className="easm-ui-prompt-editor-field" />
      <div id={`${auto}-count`} className="easm-ui-prompt-editor-meta">
        <span>{count}{maxLength ? ` / ${formatNumber(maxLength)}` : ''} characters</span>
        {tokenHint ? <span>about {formatNumber(Math.ceil(text.length / 4))} tokens</span> : null}
      </div>
    </div>
    {error ? <p id={`${auto}-error`} className="easm-ui-prompt-editor-error"><UIIcon name="error-circle" size={16} />{error}</p> : null}
  </div>;
}

/* -------------------------------------------------------- AdvancedSettings */

export interface AdvancedSettingsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Defaults to "advanced settings": the button reads Show or Hide before it. */
  label?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}
/** Keeps rarely changed settings one click away without a heavier accordion. */
export function AdvancedSettings({ label = 'advanced settings', open, defaultOpen = false, onOpenChange, children, className, ...props }: AdvancedSettingsProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultOpen);
  const expanded = open ?? inner;
  const toggle = () => { if (open === undefined) setInner(!expanded); onOpenChange?.(!expanded); };
  return <div {...props} className={cx('easm-ui easm-ui-advanced-settings', className)} data-open={expanded || undefined}>
    <button type="button" className="easm-ui-advanced-settings-toggle" aria-expanded={expanded} aria-controls={`${id}-region`} onClick={toggle}>
      <UIIcon name="sliders" size={16} />{expanded ? 'Hide' : 'Show'} {label}<UIIcon name="chevron-down" size={16} className="easm-ui-advanced-settings-chevron" />
    </button>
    <div id={`${id}-region`} className="easm-ui-advanced-settings-region" hidden={!expanded}>{children}</div>
  </div>;
}
