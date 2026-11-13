'use client';

// Page rhythm and the small page-level parts (demand list wave 4b, 2026-10-29): one body under the header with its
// sections and its row of figures (PageScaffold, C-X-13, replacing Marketing's Page/Section/StatGrid and
// Automation's AutomationPage), a stated caveat smaller than an Alert (Callout, C-X-14), and the bar that acts on
// the rows picked in a table (SelectionBar, C-X-17, promoted from the Forms responses table).
import type { HTMLAttributes, ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button } from './actions';
import { EasmLink } from './link';
import { SectionHeading } from './insights';
import { cx, reportContentProblem, UIIcon } from './shared';

export const layoutComponentNames = ['PageScaffold', 'PageSection', 'StatGrid', 'Callout', 'SelectionBar'] as const;

/* ------------------------------------------------------------------ PageScaffold */

export interface PageScaffoldProps extends HTMLAttributes<HTMLDivElement> {
  /** wide: tables, card grids and dashboards fill the frame. form: one column of fields at a readable measure.
   *  sections: independent settings cards, one column, two side by side once the body is wide enough. */
  width?: 'wide' | 'form' | 'sections';
  /** The header's line and actions, repeated at the top of the body on a phone, where the bar has room for
   *  neither. Hidden from 768 px, where the header shows them. */
  phoneIntro?: { text?: ReactNode; actions?: ReactNode };
  /** A link back to the page this one belongs to ("All tools"). */
  back?: { href: string; label: string };
  children: ReactNode;
}
/** The body under a page header: its gutter, its width and the gap between blocks, the same on every dashboard.
 *  Blocks rise in one after another when the page opens (the page-flow motion). Set --easm-ui-page-gutter to match
 *  the header if the app's own differs. */
export function PageScaffold({ width = 'wide', phoneIntro, back, children, className, ...props }: PageScaffoldProps) {
  const intro = phoneIntro && (phoneIntro.text || phoneIntro.actions);
  return <div {...props} className={cx('easm-ui easm-ui-page-scaffold easm-ui-page-flow', className)} data-width={width}>
    {intro ? <div className="easm-ui-page-intro">
      {phoneIntro.text ? <p>{phoneIntro.text}</p> : null}
      {phoneIntro.actions ? <div className="easm-ui-page-intro-actions">{phoneIntro.actions}</div> : null}
    </div> : null}
    {back ? <EasmLink href={back.href} className="easm-ui-page-back"><UIIcon name="arrow-left" size={16} />{back.label}</EasmLink> : null}
    {children}
  </div>;
}

export interface PageSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  /** Scope after the title, such as "Last 30 days". */
  meta?: string;
  description?: ReactNode;
  actions?: ReactNode;
  level?: 2 | 3;
  /** In a sections page, span both columns (a notice, the save row). */
  span?: boolean;
  children: ReactNode;
}
/** A titled group of related blocks on a page. */
export function PageSection({ title, meta, description, actions, level = 2, span, children, className, ...props }: PageSectionProps) {
  return <section {...props} className={cx('easm-ui easm-ui-page-section', className)} data-span={span || undefined}>
    <SectionHeading title={title} meta={meta} description={description} actions={actions} level={level} />
    {children}
  </section>;
}

export interface StatGridProps extends HTMLAttributes<HTMLDivElement> {
  /** The narrowest a card may get before the row wraps, in px. */
  min?: number;
  children: ReactNode;
}
/** A row of StatCards that wraps as the page narrows; every card keeps the same width in a row. */
export function StatGrid({ min = 220, children, className, style, ...props }: StatGridProps) {
  return <div {...props} className={cx('easm-ui easm-ui-stat-grid', className)} style={{ ...style, ['--_stat-min' as string]: `${min}px` }}>{children}</div>;
}

/* ------------------------------------------------------------------ Callout */

export type CalloutTone = 'info' | 'caution' | 'provisional' | 'neutral';
const calloutIcons: Record<CalloutTone, IconName> = { info: 'info', caution: 'warning', provisional: 'authority-provisional', neutral: 'note' };
export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** info: worth knowing. caution: read before acting. provisional: the figures may still change. neutral: an aside. */
  tone?: CalloutTone;
  /** A short lead in bold on the same line ("Note", "Estimated"). */
  title?: string;
  /** Replaces the tone's sign. */
  icon?: IconName;
  /** One small link or button after the text. */
  action?: ReactNode;
  children: ReactNode;
}
/** A stated caveat inside a page, smaller than an Alert: one line of tinted text with its sign. It is not
 *  announced and cannot be dismissed; it is part of what the page says. */
export function Callout({ tone = 'info', title, icon, action, children, className, ...props }: CalloutProps) {
  if (children == null || children === false || (typeof children === 'string' && !children.trim())) reportContentProblem('Callout requires text.');
  return <div {...props} className={cx('easm-ui easm-ui-callout', className)} data-tone={tone}>
    <span className="easm-ui-callout-icon"><UIIcon name={icon ?? calloutIcons[tone]} size={16} /></span>
    <p className="easm-ui-callout-text">{title ? <strong>{title}. </strong> : null}{children}</p>
    {action ? <span className="easm-ui-callout-action">{action}</span> : null}
  </div>;
}

/* ------------------------------------------------------------------ SelectionBar */

export interface SelectionBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** How many rows are picked. The bar renders nothing at zero. */
  count: number;
  /** The thing being picked, singular and plural (["response", "responses"]). */
  noun: readonly [string, string];
  /** Rows matching the current filter, when more than the page shows. */
  total?: number;
  /** Picks every matching row; offered only while `total` is more than `count`. */
  onSelectAll?: () => void;
  onClear: () => void;
  /** The actions, as Buttons of size sm. */
  children: ReactNode;
  /** Names the toolbar for assistive technology. */
  label?: string;
}
/** What to do with the rows picked in a table: how many, the actions, and Clear. It takes the place of the table's
 *  filters while rows are picked (a filter change would change what is picked), and offers the rest of the matching
 *  rows when only the page is picked. The count is announced politely. */
export function SelectionBar({ count, noun, total, onSelectAll, onClear, children, label = 'Selected rows', className, ...props }: SelectionBarProps) {
  if (count <= 0) return null;
  const word = count === 1 ? noun[0] : noun[1];
  return <div {...props} role="toolbar" aria-label={label} className={cx('easm-ui easm-ui-selection-bar', className)}><div className="easm-ui-selection-bar-inner">
    <p className="easm-ui-selection-bar-count" aria-live="polite">
      <strong>{count.toLocaleString()}</strong> {word} selected
      {total !== undefined && onSelectAll && total > count ? <>{' · '}<button type="button" className="easm-ui-selection-bar-all" onClick={onSelectAll}>Select all {total.toLocaleString()}</button></> : null}
    </p>
    <div className="easm-ui-selection-bar-actions">{children}</div>
    <Button size="sm" variant="secondary" leadingIcon="dismiss" onClick={onClear} className="easm-ui-selection-bar-clear">Clear</Button>
  </div></div>;
}
