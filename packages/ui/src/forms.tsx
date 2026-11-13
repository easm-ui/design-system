'use client';

// The Forms builder's parts (demand list wave 2, C-FRM-01…04): the palette tile for a question type, the question's
// card on the canvas (and the section that holds cards), the chip that says a question has rules and reads them as
// sentences, and the cells of the Responses table. The Forms dashboard keeps no decorative motion: nothing here
// lifts, pulses or glows on hover; selection and dragging are fills.
import { type DragEvent, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Popover } from './overlays';
import { cx, reportContentProblem, UIIcon } from './shared';
import { defineStatuses, StatusChip, type StatusSpec } from './workflow';

/* ------------------------------------------------------------------ QuestionTypeTile */

export interface QuestionTypeTileProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** The question-* icon. */
  icon: IconName;
  name: string;
  /** One line on what it does ("Checked for Pakistani mobile formats"). */
  example?: string;
  /** Adds the question (click, Enter or Space). */
  onAdd?: () => void;
  /** Dragging onto the canvas: the tile sets the drag data, the canvas reads it. */
  dragData?: string;
  /** Why it cannot be added here ("Not inside a repeated section"); the tile stays readable and says so. */
  disabledReason?: string;
}
/** A question type in the builder's palette: its glyph, name and one line, added by a click or dragged onto the
 *  canvas. When it cannot be used where the cursor is, it says why instead of silently greying out. */
export function QuestionTypeTile({ icon, name, example, onAdd, dragData, disabledReason, className, ...props }: QuestionTypeTileProps) {
  const disabled = !!disabledReason;
  const drag = (event: DragEvent<HTMLButtonElement>) => {
    if (disabled || !dragData) { event.preventDefault(); return; }
    event.dataTransfer.setData('application/x-easm-question', dragData);
    event.dataTransfer.setData('text/plain', name);
    event.dataTransfer.effectAllowed = 'copy';
  };
  return <button {...props} type="button" className={cx('easm-ui easm-ui-question-tile', className)} aria-disabled={disabled || undefined}
    draggable={!!dragData && !disabled} onDragStart={drag} onClick={() => { if (!disabled) onAdd?.(); }}
    aria-describedby={undefined}>
    <span className="easm-ui-question-tile-icon" aria-hidden="true"><UIIcon name={icon} size={20} /></span>
    <span className="easm-ui-question-tile-copy">
      <span className="easm-ui-question-tile-name">{name}</span>
      {disabled ? <span className="easm-ui-question-tile-reason">{disabledReason}</span> : example ? <span className="easm-ui-question-tile-example">{example}</span> : null}
    </span>
  </button>;
}
export interface QuestionTypeGroupProps extends HTMLAttributes<HTMLElement> { label: string; children: ReactNode }
/** A labelled group of tiles in the palette (Basic, Choice, Scale, University, Layout). */
export function QuestionTypeGroup({ label, className, children, ...props }: QuestionTypeGroupProps) {
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-question-group', className)}>
    <h4 className="easm-ui-question-group-label" aria-hidden="true">{label}</h4>
    <div className="easm-ui-question-group-tiles">{children}</div>
  </section>;
}

/* ------------------------------------------------------------------ RuleChip and RuleRow */

export type RuleEffect = 'show' | 'hide' | 'skip-to' | 'recall';
const effectIcon: Record<RuleEffect, IconName> = { show: 'logic-show', hide: 'logic-hide', 'skip-to': 'logic-skip-to', recall: 'logic-recall' };
const effectWord: Record<RuleEffect, string> = { show: 'Show', hide: 'Hide', 'skip-to': 'Skip to', recall: 'Recall' };
export interface FormRule { id: string; effect: RuleEffect; /** The rule as a sentence: "If Programme is one of 3 → show this". */ sentence: ReactNode }
export interface RuleRowProps extends HTMLAttributes<HTMLDivElement> { effect: RuleEffect; children: ReactNode; actions?: ReactNode }
/** One rule written as a sentence, led by what it does (show, hide, skip to, recall). The Logic tab's row. */
export function RuleRow({ effect, children, actions, className, ...props }: RuleRowProps) {
  return <div {...props} className={cx('easm-ui easm-ui-rule-row', className)} data-effect={effect}>
    <span className="easm-ui-rule-row-effect"><UIIcon name={effectIcon[effect]} size={16} />{effectWord[effect]}</span>
    <span className="easm-ui-rule-row-sentence">{children}</span>
    {actions ? <span className="easm-ui-rule-row-actions">{actions}</span> : null}
  </div>;
}
export interface RuleChipProps { rules: readonly FormRule[]; /** The question's name, for the popover's title. */ question?: string; className?: string }
/** A small chip on a field card that says how many rules touch the question and opens to read them as sentences. */
export function RuleChip({ rules, question, className }: RuleChipProps) {
  if (!rules.length) return null;
  const count = `${rules.length} ${rules.length === 1 ? 'rule' : 'rules'}`;
  return <Popover title={question ? `Rules for ${question}` : 'Rules'} align="start"
    trigger={<button type="button" className={cx('easm-ui easm-ui-rule-chip', className)} aria-label={`${count}${question ? ` for ${question}` : ''}: read them`}>
      <UIIcon name={effectIcon[rules[0].effect]} size={16} />{count}</button>}>
    <div className="easm-ui-rule-list">{rules.map(rule => <RuleRow key={rule.id} effect={rule.effect}>{rule.sentence}</RuleRow>)}</div>
  </Popover>;
}

/* ------------------------------------------------------------------ FieldCard */

export type FieldSensitivity = 'public' | 'personal' | 'restricted';
const sensitivityMark: Record<FieldSensitivity, { icon: IconName; word: string }> = {
  public: { icon: 'globe', word: 'Public' }, personal: { icon: 'user', word: 'Personal' }, restricted: { icon: 'lock-closed', word: 'Sealed' },
};
export interface FieldCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** The question as the person filling it reads it. */
  title: ReactNode;
  /** The question type: its glyph and name. */
  type: { icon: IconName; label: string };
  /** field: a question. section / repeated: a container that holds field cards (children). */
  kind?: 'field' | 'section' | 'repeated';
  required?: boolean;
  rules?: readonly FormRule[];
  /** How sensitive the answer is; personal and sealed answers say so on the card. */
  sensitivity?: FieldSensitivity;
  /** Help text or the answer options, one line. */
  description?: ReactNode;
  selected?: boolean;
  dragging?: boolean;
  /** Select the card for editing (click or Enter on its title). */
  onSelect?: () => void;
  /** The handle's keyboard and pointer props from the canvas's drag system. */
  handleProps?: HTMLAttributes<HTMLSpanElement>;
  /** Card actions (duplicate, delete) at the end of its head. */
  actions?: ReactNode;
  children?: ReactNode;
}
/** A question on the builder's canvas: drag handle, type, the question, required, rules and sensitivity. Sections
 *  and repeated sections are the same card holding cards. Selected is a blue fill and dragging a lifted fill, never
 *  an outline, a shadow or a hover lift. */
export function FieldCard({ title, type, kind = 'field', required = false, rules = [], sensitivity, description, selected = false, dragging = false,
  onSelect, handleProps, actions, children, className, ...props }: FieldCardProps) {
  if (title === undefined || title === null || title === '') reportContentProblem('FieldCard requires the question.');
  const plain = typeof title === 'string' ? title : undefined;
  return <article {...props} className={cx('easm-ui easm-ui-field-card', className)} data-kind={kind} data-selected={selected || undefined} data-dragging={dragging || undefined}
    aria-current={selected || undefined}>
    <div className="easm-ui-field-card-head">
      <span {...handleProps} className={cx('easm-ui-field-card-handle', handleProps?.className)} aria-label={handleProps?.['aria-label'] ?? `Move ${plain ?? 'question'}`} role={handleProps?.role ?? 'button'} tabIndex={handleProps?.tabIndex ?? 0}>
        <UIIcon name="drag-handle" size={16} />
      </span>
      <span className="easm-ui-field-card-type"><UIIcon name={type.icon} size={16} />{type.label}</span>
      {sensitivity && sensitivity !== 'public' ? <span className="easm-ui-field-card-sensitivity" data-sensitivity={sensitivity}><UIIcon name={sensitivityMark[sensitivity].icon} size={16} />{sensitivityMark[sensitivity].word}</span> : null}
      {rules.length ? <RuleChip rules={rules} question={plain} /> : null}
      {actions ? <span className="easm-ui-field-card-actions">{actions}</span> : null}
    </div>
    {onSelect ? <button type="button" className="easm-ui-field-card-title" onClick={onSelect}>{title}{required ? <span className="easm-ui-field-card-required" aria-label="required"> *</span> : null}</button>
      : <p className="easm-ui-field-card-title">{title}{required ? <span className="easm-ui-field-card-required" aria-label="required"> *</span> : null}</p>}
    {description ? <p className="easm-ui-field-card-description">{description}</p> : null}
    {kind !== 'field' ? <div className="easm-ui-field-card-children">{children}</div> : children}
  </article>;
}

/* ------------------------------------------------------------------ Response cells */

/** The six states of a form response. */
export const responseStatuses = defineStatuses({
  new: { label: 'New', glyph: 'response-new', tone: 'brand' },
  'in-review': { label: 'Being read', glyph: 'response-in-review', tone: 'neutral' },
  done: { label: 'Done', glyph: 'response-done', tone: 'success' },
  spam: { label: 'Spam', glyph: 'response-spam', tone: 'danger' },
  unfinished: { label: 'Not finished', glyph: 'response-unfinished', tone: 'warning' },
  corrected: { label: 'Corrected', glyph: 'response-corrected', tone: 'neutral', description: 'An answer was corrected by staff' },
});
export type ResponseStatus = keyof typeof responseStatuses;
/** How a response arrived. */
export const responseSources: Record<'link' | 'qr' | 'embed' | 'staff' | 'assistant-chat' | 'assistant-call', StatusSpec> = {
  link: { label: 'Link', glyph: 'via-link', tone: 'neutral' },
  qr: { label: 'QR code', glyph: 'via-qr', tone: 'neutral' },
  embed: { label: 'Website', glyph: 'via-embed', tone: 'neutral' },
  staff: { label: 'Entered by staff', glyph: 'via-staff', tone: 'brand' },
  'assistant-chat': { label: 'Assistant, chat', glyph: 'via-assistant-chat', tone: 'ai' },
  'assistant-call': { label: 'Assistant, call', glyph: 'via-assistant-call', tone: 'ai' },
};
export type ResponseSource = keyof typeof responseSources;
export function ResponseStatusCell({ status }: { status: ResponseStatus }) {
  return <StatusChip status={status} statuses={responseStatuses} size="sm" />;
}
export function ResponseSourceCell({ source }: { source: ResponseSource }) {
  return <StatusChip status={source} statuses={responseSources} variant="row" className="easm-ui-response-source" />;
}
export interface ResponseScoreCellProps { score: number; max: number }
/** A quiz score: the points and a short bar, so a column of scores reads at a glance. */
export function ResponseScoreCell({ score, max }: ResponseScoreCellProps) {
  const share = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
  return <span className="easm-ui easm-ui-response-score" data-level={share >= .8 ? 'high' : share >= .5 ? 'mid' : 'low'}>
    <span className="easm-ui-response-score-value">{score}<span> / {max}</span></span>
    <span className="easm-ui-response-score-bar" aria-hidden="true"><i style={{ width: `${share * 100}%` }} /></span>
  </span>;
}
export interface SealedCellProps {
  /** What everyone sees: the masked answer ("42101-•••••••-3"). */
  mask: string;
  /** The revealed answer, once Reveal succeeded. */
  value?: string;
  /** Asks to reveal (audited); omit for people who may not. */
  onReveal?: () => void;
  revealing?: boolean;
}
/** A sealed answer (CNIC): the mask, and Reveal for someone allowed to see it. Revealed, it says so. */
export function SealedCell({ mask, value, onReveal, revealing = false }: SealedCellProps) {
  return <span className="easm-ui easm-ui-sealed-cell" data-revealed={value ? true : undefined}>
    <UIIcon name={value ? 'lock-open' : 'lock-closed'} size={16} />
    <span className="easm-ui-sealed-value">{value ?? mask}</span>
    {!value && onReveal ? <button type="button" className="easm-ui-sealed-reveal" onClick={onReveal} disabled={revealing} aria-busy={revealing || undefined}>{revealing ? 'Revealing' : 'Reveal'}</button> : null}
    {value ? <span className="easm-ui-sr-only">Revealed; this is recorded</span> : null}
  </span>;
}
export interface FilesCellProps { files: readonly { name: string; icon: IconName }[]; onOpen?: () => void }
/** Files attached to a response: up to three type tiles and the count. */
export function FilesCell({ files, onOpen }: FilesCellProps) {
  if (!files.length) return <span className="easm-ui easm-ui-files-cell" data-empty="true">No files</span>;
  const body = <>
    <span className="easm-ui-files-cell-tiles" aria-hidden="true">{files.slice(0, 3).map((f, i) => <span key={i} className="easm-ui-files-cell-tile"><UIIcon name={f.icon} size={16} /></span>)}</span>
    <span>{files.length} {files.length === 1 ? 'file' : 'files'}</span>
  </>;
  return onOpen ? <button type="button" className="easm-ui easm-ui-files-cell" onClick={onOpen} title={files.map(f => f.name).join(', ')}>{body}</button>
    : <span className="easm-ui easm-ui-files-cell" title={files.map(f => f.name).join(', ')}>{body}</span>;
}
