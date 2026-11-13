'use client';

// Marketing's planning parts (demand list wave 4c, 2026-10-29): a cohort written as rules people can read, with how
// many it matches as it is written (CohortBuilder, C-MKT-09), plan against actual as a bar with its target (TargetBar,
// C-MKT-10), and a standing recommendation with its evidence and what to do about it (RecommendationCard, C-MKT-11).
import { useId, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button, IconButton } from './actions';
import { DropdownSelect, type InputOption } from './inputs';
import { NumberField } from './additional-inputs';
import { Callout } from './layout';
import { cx, reportContentProblem, UIIcon } from './shared';
import { defineStatuses, StatusChip } from './workflow';

export const planningComponentNames = ['CohortBuilder', 'TargetBar', 'RecommendationCard'] as const;

/* ------------------------------------------------------------------ CohortBuilder */

export interface CohortRule {
  id: string;
  mode: 'include' | 'exclude';
  kind: 'event' | 'outcome';
  /** The event or outcome id. */
  ref: string;
  /** Events only: at least this many times… */
  atLeast?: number;
  /** …in the last this many days. */
  withinDays?: number;
}
export interface CohortBuilderProps extends HTMLAttributes<HTMLElement> {
  rules: readonly CohortRule[];
  onRulesChange: (rules: CohortRule[]) => void;
  events: readonly InputOption[];
  outcomes: readonly InputOption[];
  /** How many people the rules match now; null while not counted. */
  count?: number | null;
  counting?: boolean;
  locale?: string;
}
let ruleSeed = 0;
/** A cohort as rules read like sentences: include people who did an event at least N times in the last D days or
 *  have an outcome; leave out people who… The count of people it matches follows the rules as they change. A cohort
 *  of only leave-out rules matches nobody, and says so, because the product refuses it. */
export function CohortBuilder({ rules, onRulesChange, events, outcomes, count, counting, locale, className, ...props }: CohortBuilderProps) {
  const id = useId();
  const include = rules.filter(r => r.mode === 'include'), exclude = rules.filter(r => r.mode === 'exclude');
  const onlyExclusions = !include.length && !!exclude.length;
  const update = (rule: CohortRule, change: Partial<CohortRule>) => onRulesChange(rules.map(r => r.id === rule.id ? { ...r, ...change } : r));
  const add = (mode: CohortRule['mode']) => onRulesChange([...rules, { id: `rule-${++ruleSeed}-${Date.now().toString(36)}`, mode, kind: 'event', ref: '', atLeast: 1, withinDays: 30 }]);
  const kinds: InputOption[] = [{ value: 'event', label: 'did the event' }, { value: 'outcome', label: 'have the outcome' }];
  const row = (rule: CohortRule, index: number) => {
    const n = index + 1, words = rule.mode === 'include' ? 'Include rule' : 'Leave-out rule';
    return <li key={rule.id} className="easm-ui-cohort-rule">
      <span className="easm-ui-cohort-join">{index ? 'and' : 'who'}</span>
      <DropdownSelect label={`${words} ${n}: kind`} hideLabel size="sm" options={kinds} value={rule.kind} onValueChange={value => update(rule, { kind: value as CohortRule['kind'], ref: '' })} />
      <DropdownSelect label={`${words} ${n}: ${rule.kind}`} hideLabel size="sm" placeholder={rule.kind === 'event' ? 'Choose an event' : 'Choose an outcome'}
        options={rule.kind === 'event' ? events : outcomes} value={rule.ref} onValueChange={value => update(rule, { ref: value })} />
      {rule.kind === 'event' ? <>
        <span className="easm-ui-cohort-word">at least</span>
        <NumberField label={`${words} ${n}: at least how many times`} hideLabel size="sm" min={1} value={rule.atLeast ?? 1} onValueChange={value => update(rule, { atLeast: value ?? 1 })} className="easm-ui-cohort-number" />
        <span className="easm-ui-cohort-word">{(rule.atLeast ?? 1) === 1 ? 'time' : 'times'} in the last</span>
        <NumberField label={`${words} ${n}: within how many days`} hideLabel size="sm" min={1} value={rule.withinDays ?? 30} onValueChange={value => update(rule, { withinDays: value ?? 30 })} className="easm-ui-cohort-number" />
        <span className="easm-ui-cohort-word">days</span>
      </> : null}
      <IconButton icon="dismiss" size="sm" label={`Remove ${words.toLowerCase()} ${n}`} onClick={() => onRulesChange(rules.filter(r => r.id !== rule.id))} className="easm-ui-cohort-remove" />
    </li>;
  };
  return <section {...props} aria-labelledby={`${id}-count`} className={cx('easm-ui easm-ui-cohort', className)}>
    <div className="easm-ui-cohort-group" data-mode="include">
      <h4><UIIcon name="rule-include" size={20} />Include people</h4>
      {include.length ? <ol>{include.map(row)}</ol> : <p className="easm-ui-cohort-empty">No include rule yet.</p>}
      <Button size="sm" variant="secondary" leadingIcon="add" onClick={() => add('include')}>Include people who…</Button>
    </div>
    <div className="easm-ui-cohort-group" data-mode="exclude">
      <h4><UIIcon name="rule-exclude" size={20} />Leave out people</h4>
      {exclude.length ? <ol>{exclude.map(row)}</ol> : <p className="easm-ui-cohort-empty">Nobody is left out.</p>}
      <Button size="sm" variant="secondary" leadingIcon="add" onClick={() => add('exclude')}>Leave out people who…</Button>
    </div>
    {onlyExclusions ? <Callout tone="caution" title="Matches nobody">A cohort of only leave-out rules would be everyone who never did those things, so it is refused. Add an include rule.</Callout> : null}
    <p className="easm-ui-cohort-count" id={`${id}-count`} aria-live="polite" data-counting={counting || undefined}>
      <UIIcon name="cohort" size={20} />
      {onlyExclusions || !include.length ? 'No one yet: add an include rule.' : counting ? 'Counting…' : count == null ? 'Not counted yet' : <><b>{count.toLocaleString(locale)}</b> {count === 1 ? 'person matches' : 'people match'} these rules</>}
    </p>
  </section>;
}

/* ------------------------------------------------------------------ TargetBar */

export interface TargetBarProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  actual: number | null;
  /** The planned figure; null when nobody set one (then no percentage is drawn, never 0%). */
  target: number | null;
  /** Spend against its budget, drawn as a thin line under the bar. */
  spend?: { actual: number; budget?: number | null };
  /** Formats the figures (a currency, a unit). */
  format?: (value: number) => string;
  formatSpend?: (value: number) => string;
}
/** Plan against actual: the actual as a fill, the target as a marked line, and how much of it is reached. With no
 *  target the bar says so and draws no percentage: attainment is unknown, not zero. Spend runs under it. */
export function TargetBar({ label, actual, target, spend, format = n => n.toLocaleString(), formatSpend = n => n.toLocaleString(), className, ...props }: TargetBarProps) {
  const scale = Math.max(actual ?? 0, target ?? 0, 1) * 1.08;
  const pct = target ? Math.round(((actual ?? 0) / target) * 100) : null;
  const words = actual == null ? 'Not measured' : target == null ? `${format(actual)} · no target set` : `${format(actual)} of ${format(target)} · ${pct}%`;
  const spendScale = spend ? Math.max(spend.actual, spend.budget ?? 0, 1) * 1.08 : 1;
  return <div {...props} className={cx('easm-ui easm-ui-target', className)} data-reached={pct != null && pct >= 100 || undefined} data-untargeted={target == null || undefined}>
    <div className="easm-ui-target-head"><span className="easm-ui-target-label">{label}</span><span className="easm-ui-target-words">{words}</span></div>
    <div className="easm-ui-target-track" role="img" aria-label={`${label}: ${words}`}>
      {actual != null ? <i className="easm-ui-target-fill" style={{ inlineSize: `${(actual / scale) * 100}%` }} /> : null}
      {target != null ? <i className="easm-ui-target-mark" style={{ insetInlineStart: `${(target / scale) * 100}%` }} /> : null}
    </div>
    {spend ? <div className="easm-ui-target-spend">
      <span className="easm-ui-target-spend-track" aria-hidden="true"><i style={{ inlineSize: `${(spend.actual / spendScale) * 100}%` }} />{spend.budget ? <b style={{ insetInlineStart: `${(spend.budget / spendScale) * 100}%` }} /> : null}</span>
      <span className="easm-ui-target-spend-words">Spent {formatSpend(spend.actual)}{spend.budget ? ` of ${formatSpend(spend.budget)}` : ''}</span>
    </div> : null}
  </div>;
}

/* ------------------------------------------------------------------ RecommendationCard */

export const recommendationSeverities = defineStatuses({
  note: { label: 'Worth knowing', glyph: 'info', tone: 'neutral' },
  watch: { label: 'Watch', glyph: 'eye', tone: 'warning' },
  act: { label: 'Act on it', glyph: 'alert-circle', tone: 'attention' },
});
const recommendationKinds: Record<string, IconName> = { anomaly: 'anomaly', demand: 'demand-signal', creative: 'creative-insight', recommendation: 'recommendation', fatigue: 'creative-insight' };
export interface RecommendationCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  severity: keyof typeof recommendationSeverities;
  kind?: 'anomaly' | 'demand' | 'creative' | 'fatigue' | 'recommendation';
  /** The condition as a sentence ("Paid social fell 38% while its spend went on"). */
  title: string;
  /** What shows it: figures, dates, the rows behind it. */
  evidence?: readonly ReactNode[];
  /** How long the condition has stood. */
  standingDays?: number;
  owner?: string;
  onDismiss?: () => void;
  onSnooze?: () => void;
  onDone?: () => void;
}
/** A recommendation that stands until it is dealt with: how serious, the condition in a sentence, the evidence, how
 *  long it has stood and whose it is, with Done, Snooze and Dismiss. One record shows everywhere it is surfaced, so a
 *  dismissal holds everywhere. Replaces the list on AI intelligence. */
export function RecommendationCard({ severity, kind = 'recommendation', title, evidence, standingDays, owner, onDismiss, onSnooze, onDone, className, ...props }: RecommendationCardProps) {
  if (!title.trim()) reportContentProblem('RecommendationCard requires the condition as a sentence.');
  const id = useId();
  return <article {...props} aria-labelledby={`${id}-title`} className={cx('easm-ui easm-ui-recommendation', className)} data-severity={severity}>
    <header className="easm-ui-recommendation-head">
      <span className="easm-ui-recommendation-icon"><UIIcon name={recommendationKinds[kind]} size={20} /></span>
      <StatusChip status={severity} statuses={recommendationSeverities} size="sm" />
      <span className="easm-ui-recommendation-age">{[standingDays != null ? (standingDays < 1 ? 'New today' : `Standing for ${standingDays} ${standingDays === 1 ? 'day' : 'days'}`) : '', owner ? `Owner: ${owner}` : ''].filter(Boolean).join(' · ')}</span>
    </header>
    <h4 id={`${id}-title`}>{title}</h4>
    {evidence?.length ? <ul className="easm-ui-recommendation-evidence">{evidence.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
    {onDone || onSnooze || onDismiss ? <footer className="easm-ui-recommendation-actions">
      {onDone ? <Button size="sm" variant="secondary" leadingIcon="checkmark" onClick={onDone}>Done</Button> : null}
      {onSnooze ? <Button size="sm" variant="secondary" leadingIcon="clock" onClick={onSnooze}>Snooze</Button> : null}
      {onDismiss ? <Button size="sm" variant="secondary" leadingIcon="dismiss" onClick={onDismiss}>Dismiss</Button> : null}
    </footer> : null}
  </article>;
}
