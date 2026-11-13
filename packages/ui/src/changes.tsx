'use client';

// Reading a change before it lands (demand list wave 4c, 2026-10-29): two texts compared line by line, raw against
// cleaned in the review queue and old against new on an import or sync (DiffCompare, C-CIMS-05), and an import's
// preview as four counts with a sample under each and an Apply that says what it will do (ChangePreview, C-CIMS-06).
import { useId, useMemo, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button } from './actions';
import { cx, reportContentProblem, UIIcon } from './shared';

export const changeComponentNames = ['DiffCompare', 'ChangePreview'] as const;

/* ------------------------------------------------------------------ DiffCompare */

export type DiffLine = { kind: 'same' | 'removed' | 'added'; text: string; before?: number; after?: number };
/** Line differences between two texts: the common start and end are kept as they are and the middle is compared
 *  by longest common subsequence; a middle too large to compare (over four million line pairs) is shown as replaced. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n'), b = after.split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const out: DiffLine[] = a.slice(0, start).map((text, i) => ({ kind: 'same', text, before: i + 1, after: i + 1 }));
  const midA = a.slice(start, endA), midB = b.slice(start, endB);
  if (midA.length * midB.length > 4_000_000) {
    midA.forEach((text, i) => out.push({ kind: 'removed', text, before: start + i + 1 }));
    midB.forEach((text, i) => out.push({ kind: 'added', text, after: start + i + 1 }));
  } else {
    const n = midA.length, m = midB.length, table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) { out.push({ kind: 'same', text: midA[i], before: start + i + 1, after: start + j + 1 }); i++; j++; }
      // Removals first, so a changed line reads as the old one then the new one and the two pair side by side.
      else if (i < n && (j === m || table[i + 1][j] >= table[i][j + 1])) { out.push({ kind: 'removed', text: midA[i], before: start + i + 1 }); i++; }
      else { out.push({ kind: 'added', text: midB[j], after: start + j + 1 }); j++; }
    }
  }
  a.slice(endA).forEach((text, k) => out.push({ kind: 'same', text, before: endA + k + 1, after: endB + k + 1 }));
  return out;
}

export interface DiffCompareProps extends HTMLAttributes<HTMLElement> {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** side-by-side folds to inline on a narrow container. */
  layout?: 'side-by-side' | 'inline';
  /** Unchanged lines kept around each change; longer unchanged runs fold into "N unchanged lines". */
  context?: number;
  locale?: string;
}
type Unit = { kind: 'pair'; left?: DiffLine; right?: DiffLine; changed: boolean };
type Row = Unit | { kind: 'fold'; count: number; id: number };

/** Two texts compared line by line: what was taken out, what was put in, and how much smaller or larger it got.
 *  Removed lines carry a minus and added lines a plus, so the change reads without its colour. Side by side pairs a
 *  run of removals with the additions after it; inline lists them one under the other. */
export function DiffCompare({ before, after, beforeLabel = 'Before', afterLabel = 'After', layout = 'side-by-side', context = 2, locale, className, ...props }: DiffCompareProps) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const removed = lines.filter(l => l.kind === 'removed').length, added = lines.filter(l => l.kind === 'added').length;
  const change = before.length ? Math.round(((after.length - before.length) / before.length) * 100) : 0;
  const rows = useMemo(() => {
    const units: Unit[] = [];
    if (layout === 'inline') for (const line of lines) units.push(line.kind === 'removed' ? { kind: 'pair', left: line, changed: true } : { kind: 'pair', right: line, changed: line.kind === 'added' });
    else for (let i = 0; i < lines.length;) {
      if (lines[i].kind === 'same') { units.push({ kind: 'pair', left: lines[i], right: lines[i], changed: false }); i++; continue; }
      const gone: DiffLine[] = [], came: DiffLine[] = [];
      while (i < lines.length && lines[i].kind === 'removed') gone.push(lines[i++]);
      while (i < lines.length && lines[i].kind === 'added') came.push(lines[i++]);
      for (let k = 0; k < Math.max(gone.length, came.length); k++) units.push({ kind: 'pair', left: gone[k], right: came[k], changed: true });
    }
    const near = units.map((u, i) => u.changed ? i : -1).filter(i => i >= 0);
    const keep = (i: number) => near.some(c => Math.abs(c - i) <= context);
    const out: Row[] = [];
    for (let i = 0; i < units.length;) {
      if (keep(i)) { out.push(units[i++]); continue; }
      const from = i; while (i < units.length && !keep(i)) i++;
      if (i - from <= 2 || opened.has(from)) out.push(...units.slice(from, i)); else out.push({ kind: 'fold', count: i - from, id: from });
    }
    return out;
  }, [lines, layout, context, opened]);
  const cell = (line: DiffLine | undefined, side: 'before' | 'after') => line
    ? <div className="easm-ui-diff-cell" data-kind={line.kind}><span className="easm-ui-diff-num">{side === 'before' ? line.before : line.after}</span>
      <span className="easm-ui-diff-sign" aria-hidden="true">{line.kind === 'removed' ? '−' : line.kind === 'added' ? '+' : ''}</span>
      <span className="easm-ui-diff-text">{line.kind === 'removed' ? <span className="easm-ui-sr-only">Removed: </span> : line.kind === 'added' ? <span className="easm-ui-sr-only">Added: </span> : null}{line.text || '\u00a0'}</span></div>
    : <div className="easm-ui-diff-cell" data-kind="empty" aria-hidden="true" />;
  return <section {...props} className={cx('easm-ui easm-ui-diff', className)} data-layout={layout}>
    <header className="easm-ui-diff-summary">
      <span className="easm-ui-diff-size" data-direction={change < 0 ? 'smaller' : change > 0 ? 'larger' : undefined}>{change === 0 ? 'Same size' : `${change > 0 ? '+' : '−'}${Math.abs(change)}% size`}</span>
      <span>{before.length.toLocaleString(locale)} → {after.length.toLocaleString(locale)} characters</span>
      <span><b>{removed.toLocaleString(locale)}</b> {removed === 1 ? 'line' : 'lines'} removed · <b>{added.toLocaleString(locale)}</b> added</span>
    </header>
    {layout === 'side-by-side' ? <div className="easm-ui-diff-heads" aria-hidden="true"><span>{beforeLabel}</span><span>{afterLabel}</span></div> : null}
    <div className="easm-ui-diff-rows" role="table" aria-label={`${beforeLabel} and ${afterLabel}, line by line`}>
      {rows.map((row, i) => row.kind === 'fold'
        ? <div key={`f${row.id}`} role="row" className="easm-ui-diff-fold"><span role="cell"><button type="button" onClick={() => setOpened(new Set(opened).add(row.id))}>
          <UIIcon name="chevron-down" size={16} />{row.count.toLocaleString(locale)} unchanged lines</button></span></div>
        : layout === 'inline'
          ? <div key={i} role="row" className="easm-ui-diff-row"><div role="cell" className="easm-ui-diff-side">{row.left ? cell(row.left, 'before') : cell(row.right, 'after')}</div></div>
          : <div key={i} role="row" className="easm-ui-diff-row">
            <div role="cell" className="easm-ui-diff-side" data-side="before"><span className="easm-ui-sr-only">{beforeLabel}: </span>{cell(row.left, 'before')}</div>
            <div role="cell" className="easm-ui-diff-side" data-side="after"><span className="easm-ui-sr-only">{afterLabel}: </span>{cell(row.right, 'after')}</div>
          </div>)}
    </div>
  </section>;
}

/* ------------------------------------------------------------------ ChangePreview */

export interface ChangeGroup {
  id: 'new' | 'changed' | 'removed' | 'problems' | (string & {});
  label: string;
  count: number;
  /** A sample of what is in the group (the first few). */
  items?: readonly { id: string; label: ReactNode; detail?: ReactNode }[];
}
export interface ChangePreviewProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  groups: readonly ChangeGroup[];
  /** What Apply does, in a sentence the button sits beside ("Adds 12 programmes and changes 4; 3 rows with problems
   *  are left out"). Without it the sentence is built from the counts. */
  consequence?: string;
  onApply: () => void;
  applyLabel?: string;
  applying?: boolean;
  onCancel?: () => void;
  /** The noun the counts are about ("programme", "programmes"). */
  noun?: readonly [string, string];
}
const groupLook: Record<string, { icon: IconName; tone: string }> = {
  new: { icon: 'add', tone: 'teal' }, changed: { icon: 'edit', tone: 'sky' }, removed: { icon: 'subtract', tone: 'plum' }, problems: { icon: 'warning', tone: 'amber' },
};
/** An import's or sync's preview: the four counts as tiles (new, changed, removed, with problems), a sample of the
 *  picked one beneath, and Apply beside the sentence that says what it will do. Nothing is applied by looking. */
export function ChangePreview({ title, groups, consequence, onApply, applyLabel = 'Apply', applying, onCancel, noun = ['item', 'items'], className, ...props }: ChangePreviewProps) {
  if (!groups.length) reportContentProblem('ChangePreview requires at least one group.');
  const id = useId();
  const first = groups.find(g => g.count > 0) ?? groups[0];
  const [open, setOpen] = useState(first?.id);
  const current = groups.find(g => g.id === open) ?? first;
  const word = (n: number) => n === 1 ? noun[0] : noun[1];
  const count = (gid: string) => groups.find(g => g.id === gid)?.count ?? 0;
  const said = consequence ?? [count('new') ? `adds ${count('new')} ${word(count('new'))}` : '', count('changed') ? `changes ${count('changed')}` : '', count('removed') ? `removes ${count('removed')}` : '']
    .filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase()) + (count('problems') ? `${count('new') + count('changed') + count('removed') ? '; ' : ''}${count('problems')} with problems ${count('problems') === 1 ? 'is' : 'are'} left out` : '') + '.';
  const nothing = groups.every(g => g.id === 'problems' || g.count === 0);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = groups[(index + step + groups.length) % groups.length];
    setOpen(next.id);
    (event.currentTarget.parentElement?.querySelector(`[data-group="${next.id}"]`) as HTMLButtonElement | null)?.focus();
  };
  return <section {...props} aria-labelledby={`${id}-title`} className={cx('easm-ui easm-ui-change-preview', className)}>
    <h3 id={`${id}-title`}>{title}</h3>
    <div className="easm-ui-change-tiles" role="tablist" aria-label={`${title}: what will change`}>
      {groups.map((g, i) => {
        const look = groupLook[g.id] ?? { icon: 'document' as IconName, tone: 'blue' };
        return <button key={g.id} type="button" role="tab" id={`${id}-tab-${g.id}`} aria-controls={`${id}-panel`} aria-selected={g.id === current?.id} tabIndex={g.id === current?.id ? 0 : -1}
          data-group={g.id} data-easm-tone={look.tone} data-empty={g.count ? undefined : true} className="easm-ui-change-tile" onClick={() => setOpen(g.id)} onKeyDown={event => onKey(event, i)}>
          <span className="easm-ui-change-tile-icon"><UIIcon name={look.icon} size={20} /></span>
          <span className="easm-ui-change-tile-count">{g.count.toLocaleString()}</span>
          <span className="easm-ui-change-tile-label">{g.label}</span>
        </button>;
      })}
    </div>
    {current ? <div className="easm-ui-change-sample" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${current.id}`} tabIndex={0}>
      {current.items?.length ? <ul>{current.items.map(item => <li key={item.id}><span className="easm-ui-change-item">{item.label}</span>{item.detail ? <span className="easm-ui-change-detail">{item.detail}</span> : null}</li>)}</ul>
        : <p className="easm-ui-change-none">{current.count ? 'No sample to show.' : `Nothing ${current.label.toLowerCase()}.`}</p>}
      {current.items && current.count > current.items.length ? <p className="easm-ui-change-more">and {(current.count - current.items.length).toLocaleString()} more</p> : null}
    </div> : null}
    <footer className="easm-ui-change-apply">
      <p>{nothing ? 'Nothing would change.' : said}</p>
      <div>{onCancel ? <Button variant="secondary" onClick={onCancel}>Cancel</Button> : null}
        <Button onClick={onApply} loading={applying} disabled={nothing}>{applyLabel}</Button></div>
    </footer>
  </section>;
}
