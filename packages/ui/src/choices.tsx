'use client';

// Two ways of choosing that every dashboard built for itself (demand list wave 4b, 2026-10-29): a list typed one
// item at a time (TagInput, C-X-11: keywords, rule words, allowed domains, Forms options) and one choice out of a
// few shown as cards (ChoiceCards, C-X-12: a privacy mode, a form type, when a rule runs).
import { useId, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { cx, reportContentProblem, UIIcon, useControllableState } from './shared';

export const choiceComponentNames = ['TagInput', 'ChoiceCards'] as const;

const present = (value: ReactNode) => typeof value === 'string' ? !!value.trim() : value != null && value !== false;

/* ------------------------------------------------------------------ TagInput */

export interface TagInputProps {
  label: string;
  hideLabel?: boolean;
  description?: ReactNode;
  /** An error from the caller (a server check). The component's own notes (a duplicate, a refused item) show here too. */
  error?: ReactNode;
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  /** What ends an item as it is typed or pasted. comma: a comma or a new line (keywords, domains). line: only a new
   *  line, for items that contain commas themselves (example questions). none: only Enter. */
  separators?: 'comma' | 'line' | 'none';
  /** Clean one item as it is added; return '' to drop it. Defaults to trimming. */
  normalize?: (raw: string) => string;
  /** Refuse an item with a reason ("Not a web address"); the typed text stays so it can be fixed. */
  validate?: (item: string) => string | undefined;
  /** The most items the list holds; the count shows beside the label. */
  max?: number;
  /** Items can be dragged, or moved with Alt and an arrow key, into a new order. */
  reorderable?: boolean;
  /** Items in the code face (event names, ids, domains). */
  mono?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
}

const splitters = { comma: /[,\n]/, line: /\n/, none: null } as const;

/** A list typed one item at a time. Enter (or the separator) adds what was typed; a pasted list is split into
 *  items; a repeat or a refused item is said in words and the text stays to be fixed. Arrow keys reach the items
 *  from the box: Delete removes one, Alt and an arrow moves it. */
export function TagInput({ label, hideLabel, description, error, value, defaultValue = [], onValueChange, placeholder, separators = 'comma',
  normalize = item => item.trim(), validate, max, reorderable = false, mono = false, size = 'md', disabled, required, name, className }: TagInputProps) {
  if (!label.trim()) reportContentProblem('TagInput requires a meaningful label.');
  const id = useId();
  const [items, setItems] = useControllableState<readonly string[]>(value, defaultValue, onValueChange as ((next: readonly string[]) => void) | undefined);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string>();
  const [announcement, setAnnouncement] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const full = max !== undefined && items.length >= max;
  const splitter = splitters[separators];

  const commit = (next: readonly string[], said: string) => { setItems([...next]); setAnnouncement(said); };
  /** Adds what can be added; returns the text that could not be (to stay in the box). */
  function add(raw: readonly string[]): string {
    const next = [...items];
    let left = '', problem: string | undefined;
    for (const piece of raw) {
      const item = normalize(piece);
      if (!item) continue;
      if (max !== undefined && next.length >= max) { problem = `The list holds ${max}; remove one to add another.`; left ||= piece.trim(); continue; }
      if (next.some(existing => existing.toLowerCase() === item.toLowerCase())) { problem = `“${item}” is already in the list.`; continue; }
      const refused = validate?.(item);
      if (refused) { problem = refused; left ||= piece.trim(); continue; }
      next.push(item);
    }
    setNote(problem);
    if (next.length !== items.length) commit(next, `Added ${next.slice(items.length).join(', ')}. ${next.length} in the list.`);
    return left;
  }
  const remove = (index: number) => {
    const gone = items[index];
    commit(items.filter((_, i) => i !== index), `Removed ${gone}. ${items.length - 1} in the list.`);
    setNote(undefined);
    requestAnimationFrame(() => {
      const chips = list.current?.querySelectorAll<HTMLButtonElement>('.easm-ui-tag-input-text');
      if (chips?.length) chips[Math.min(index, chips.length - 1)].focus(); else input.current?.focus();
    });
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next, `Moved ${item} to position ${to + 1} of ${next.length}.`);
  };
  const focusChip = (index: number) => list.current?.querySelectorAll<HTMLButtonElement>('.easm-ui-tag-input-text')[index]?.focus();

  function onBoxKey(event: KeyboardEvent<HTMLInputElement>) {
    const caretAtStart = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0;
    if (event.key === 'Enter') { event.preventDefault(); setText(add([text])); }
    else if ((event.key === 'Backspace' || event.key === 'ArrowLeft') && caretAtStart && items.length && !event.altKey) { event.preventDefault(); focusChip(items.length - 1); }
  }
  function onChipKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft', forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); if (!disabled) remove(index); }
    else if (event.altKey && reorderable && (event.key === back || event.key === forward)) {
      event.preventDefault();
      const to = index + (event.key === back ? -1 : 1);
      move(index, to);
      requestAnimationFrame(() => focusChip(Math.max(0, Math.min(items.length - 1, to))));
    }
    else if (event.key === back) { event.preventDefault(); focusChip(Math.max(0, index - 1)); }
    else if (event.key === forward) { event.preventDefault(); if (index === items.length - 1) input.current?.focus(); else focusChip(index + 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusChip(0); }
    else if (event.key === 'End' || event.key === 'Escape') { event.preventDefault(); input.current?.focus(); }
  }
  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text');
    if (!splitter || !splitter.test(pasted)) return;
    event.preventDefault();
    const before = text.slice(0, event.currentTarget.selectionStart ?? text.length), after = text.slice(event.currentTarget.selectionEnd ?? text.length);
    setText(add((before + pasted + after).split(splitter)));
  }
  const onDragStart = (event: DragEvent<HTMLLIElement>, index: number) => { setDragging(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', items[index]); };
  const onDragOver = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (dragging === null) return;
    event.preventDefault();
    if (dragging !== index) { move(dragging, index); setDragging(index); }
  };

  const invalid = present(error);
  const shownNote = present(error) ? error : note;
  const hint = `${id}-hint`, described = [present(description) ? `${id}-description` : '', shownNote ? `${id}-note` : '', hint].filter(Boolean).join(' ');
  return <div className={cx('easm-ui easm-ui-field easm-ui-tag-input', className)} data-size={size} data-status={invalid ? 'error' : undefined} data-disabled={disabled || undefined}>
    <div className={cx('easm-ui-tag-input-head', hideLabel && 'easm-ui-sr-only')}>
      <label className="easm-ui-field-label" htmlFor={`${id}-box`}>{label}{required ? <span className="easm-ui-required" aria-hidden="true"> *</span> : null}</label>
      {max !== undefined ? <span className="easm-ui-tag-input-count" data-full={full || undefined}>{items.length} of {max}</span> : null}
    </div>
    <div className="easm-ui-field-body">
      <div className="easm-ui-tag-input-box" onPointerDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); input.current?.focus(); } }}>
        {items.length ? <ul ref={list} className="easm-ui-tag-input-list" aria-label={`${label}: ${items.length} ${items.length === 1 ? 'item' : 'items'}`}>
          {items.map((item, index) => <li key={item} className="easm-ui-tag-input-item" data-mono={mono || undefined} data-dragging={dragging === index || undefined}
            draggable={reorderable && !disabled} onDragStart={event => onDragStart(event, index)} onDragOver={event => onDragOver(event, index)} onDragEnd={() => setDragging(null)} onDrop={event => event.preventDefault()}>
            {reorderable ? <UIIcon name="drag-handle" size={16} className="easm-ui-tag-input-grip" /> : null}
            <button type="button" tabIndex={-1} className="easm-ui-tag-input-text" disabled={disabled} aria-describedby={hint} onKeyDown={event => onChipKey(event, index)}>{item}</button>
            <button type="button" tabIndex={-1} className="easm-ui-tag-input-remove" disabled={disabled} aria-label={`Remove ${item}`} onClick={() => remove(index)}><UIIcon name="dismiss" size={16} /></button>
          </li>)}
        </ul> : null}
        {full ? null : <input ref={input} id={`${id}-box`} className="easm-ui-tag-input-entry" value={text} disabled={disabled} placeholder={items.length ? 'Add another' : placeholder}
          aria-describedby={described || undefined} aria-invalid={invalid || undefined} required={required && !items.length}
          onChange={event => {
            const typed = event.target.value;
            if (splitter && splitter.test(typed)) { const pieces = typed.split(splitter); const rest = pieces.pop() ?? ''; const left = add(pieces); setText(left || rest); }
            else { setText(typed); if (note) setNote(undefined); }
          }}
          onKeyDown={onBoxKey} onPaste={onPaste} onBlur={() => { if (text.trim()) setText(add([text])); }} />}
        {full ? <span className="easm-ui-tag-input-full">The list is full</span> : null}
      </div>
      {present(description) ? <div className="easm-ui-field-description" id={`${id}-description`}>{description}</div> : null}
      {shownNote ? <div className="easm-ui-field-message" data-status={invalid ? 'error' : undefined} id={`${id}-note`}><UIIcon name={invalid ? 'error-circle' : 'info'} size={16} /><div className="easm-ui-field-message-text">{shownNote}</div></div> : null}
      <span id={hint} className="easm-ui-sr-only">{`Delete removes an item${reorderable ? '; Alt and an arrow key move it' : ''}.`}</span>
      <span className="easm-ui-sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
    {name ? items.map(item => <input key={item} type="hidden" name={name} value={item} />) : null}
  </div>;
}

/* ------------------------------------------------------------------ ChoiceCards */

export interface ChoiceCardOption {
  id: string;
  title: string;
  /** One line on what choosing it means. */
  description?: ReactNode;
  icon?: IconName;
  /** Marks the choice most people should make; a string replaces the word "Recommended". */
  recommended?: boolean | string;
  disabled?: boolean;
  /** Why it cannot be chosen, shown in place of the description while disabled. */
  disabledReason?: ReactNode;
}
export interface ChoiceCardsProps {
  label: string;
  hideLabel?: boolean;
  description?: ReactNode;
  options: readonly ChoiceCardOption[];
  /** The chosen id; null while nothing is chosen (a rule's "When" has no default). */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string) => void;
  /** Cards per row at full width; they fold to one column on a narrow container. */
  columns?: 1 | 2 | 3;
  size?: 'sm' | 'md';
  error?: ReactNode;
  required?: boolean;
  name?: string;
  className?: string;
}

/** One choice out of a few, as cards: a picture of each option, its name and what it means, the recommended one
 *  marked. Native radios underneath, so arrow keys move the choice and a form posts it. */
export function ChoiceCards({ label, hideLabel, description, options, value, defaultValue = null, onValueChange, columns = 2, size = 'md', error, required, name, className }: ChoiceCardsProps) {
  if (!label.trim()) reportContentProblem('ChoiceCards requires a meaningful label.');
  if (new Set(options.map(option => option.id)).size !== options.length || options.some(option => !option.id.trim() || !option.title.trim()))
    reportContentProblem('ChoiceCards requires unique ids and meaningful titles.');
  const id = useId();
  const [chosen, choose] = useControllableState<string | null>(value, defaultValue, next => { if (next) onValueChange?.(next); });
  const invalid = present(error);
  return <fieldset className={cx('easm-ui easm-ui-choice-cards', className)} data-size={size} data-status={invalid ? 'error' : undefined}
    aria-describedby={[present(description) ? `${id}-description` : '', invalid ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}>
    <legend className={cx('easm-ui-field-label', hideLabel && 'easm-ui-sr-only')}>{label}{required ? <span className="easm-ui-required" aria-hidden="true"> *</span> : null}</legend>
    {present(description) ? <div className="easm-ui-field-description" id={`${id}-description`}>{description}</div> : null}
    <div className="easm-ui-choice-cards-grid" data-columns={columns}>
      {options.map(option => {
        const checked = chosen === option.id;
        const line = option.disabled && option.disabledReason ? option.disabledReason : option.description;
        return <label key={option.id} className="easm-ui-choice-card" data-checked={checked || undefined} data-disabled={option.disabled || undefined} data-icon={option.icon ? true : undefined}>
          <input type="radio" className="easm-ui-choice-card-input" name={name ?? id} value={option.id} checked={checked} disabled={option.disabled} required={required}
            aria-describedby={line ? `${id}-${option.id}-line` : undefined} onChange={() => choose(option.id)} />
          {option.icon ? <span className="easm-ui-choice-card-icon"><UIIcon name={option.icon} size={size === 'sm' ? 20 : 24} /></span> : null}
          <span className="easm-ui-choice-card-copy">
            <span className="easm-ui-choice-card-title">{option.title}
              {option.recommended ? <span className="easm-ui-choice-card-recommended">{typeof option.recommended === 'string' ? option.recommended : 'Recommended'}</span> : null}</span>
            {line ? <span className="easm-ui-choice-card-line" id={`${id}-${option.id}-line`}>{line}</span> : null}
          </span>
          <span className="easm-ui-choice-card-mark" aria-hidden="true" />
        </label>;
      })}
    </div>
    {invalid ? <div className="easm-ui-field-message" data-status="error" id={`${id}-error`}><UIIcon name="error-circle" size={16} /><div className="easm-ui-field-message-text">{error}</div></div> : null}
  </fieldset>;
}
