'use client';

// Workflow parts the dashboards kept building for themselves (demand list, 2026-10-28, wave 1): a status
// declared once and shown with its glyph, presence with idle, the identity ladder, the response clock, a
// timeline, a step tracker, a readiness checklist, a figure that was not measured and the lead-stage ramp.
import { useEffect, useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Tooltip } from './feedback';
import { cx, reportContentProblem, UIIcon } from './shared';
import { EasmLink } from './link';
import type { ChartTone } from './palette';
import type { ColourRole } from './roles';

export const workflowComponentNames = [
  'StatusChip', 'Presence', 'IdentityLevel', 'SlaClock', 'Timeline', 'Stepper', 'ReadinessChecklist', 'UnmeasuredValue', 'StageChip', 'FilterChip', 'PersonJourney',
] as const;

/* ------------------------------------------------------------------ StatusChip */

/** The six status tones, a colour role (`temperature-hot`, `consent-withdrawn`, `attention`: roles.ts) or a palette
 *  hue for a vocabulary of the caller's own (a category, a channel). */
export type StatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'ai' | ColourRole | ChartTone;
export interface StatusSpec {
  label: string;
  /** The sign that tells this status apart without colour. The state-* icons are drawn for this. */
  glyph: IconName;
  tone: StatusTone;
  /** One line on what it means, for the dot's tip and the row variant. */
  description?: string;
}
/** Declare a vocabulary once (`const callOutcomes = defineStatuses({ reached: {…}, voicemail: {…} })`) and
 *  pass it to every StatusChip that shows it, so a status has one label, glyph and tone everywhere. */
export function defineStatuses<K extends string>(statuses: Record<K, StatusSpec>) { return statuses; }

/** The product's shared vocabulary: work that moves through states (knowledge items, deliveries, tools, forms). */
export const workStatuses = defineStatuses({
  queued: { label: 'Queued', glyph: 'state-queued', tone: 'neutral', description: 'Waiting its turn' },
  processing: { label: 'Processing', glyph: 'state-processing', tone: 'brand', description: 'Work under way' },
  done: { label: 'Done', glyph: 'state-done', tone: 'success' },
  failed: { label: 'Failed', glyph: 'state-failed', tone: 'danger' },
  paused: { label: 'Paused', glyph: 'state-paused', tone: 'neutral' },
  blocked: { label: 'Blocked', glyph: 'state-blocked', tone: 'warning', description: 'Cannot continue until something changes' },
  waiting: { label: 'Waiting on someone', glyph: 'state-waiting-on-person', tone: 'warning' },
  scheduled: { label: 'Scheduled', glyph: 'state-scheduled', tone: 'brand' },
  expired: { label: 'Expired', glyph: 'state-expired', tone: 'neutral', description: 'Time ran out' },
  draft: { label: 'Draft', glyph: 'state-draft', tone: 'neutral', description: 'Not published yet' },
  live: { label: 'Live', glyph: 'state-live', tone: 'success', description: 'In use now' },
  archived: { label: 'Archived', glyph: 'state-archived', tone: 'neutral' },
});
export type WorkStatus = keyof typeof workStatuses;

export interface StatusChipProps<K extends string = WorkStatus> extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: K;
  /** The vocabulary; defaults to workStatuses. */
  statuses?: Record<K, StatusSpec>;
  /** chip: glyph and label. dot: the glyph alone, its label for screen readers and in a tip. row: glyph,
   *  label and a detail line under it. */
  variant?: 'chip' | 'dot' | 'row';
  /** The row variant's second line (when it happened, why it stopped); defaults to the status's description. */
  detail?: ReactNode;
  size?: 'sm' | 'md';
}
/** A status as a glyph and a word. The glyph carries the meaning, so two statuses in the same tone (four call
 *  outcomes that are all neutral) are still told apart, and the label is one stable word per status. */
export function StatusChip<K extends string = WorkStatus>({ status, statuses, variant = 'chip', detail, size = 'md', className, ...props }: StatusChipProps<K>) {
  const vocabulary = (statuses ?? workStatuses) as Record<string, StatusSpec>;
  let spec = vocabulary[status];
  if (!spec) {
    reportContentProblem(`Unknown status: ${status}`);
    spec = { label: String(status || 'Unknown'), glyph: 'question-circle', tone: 'neutral' };
  }
  const moving = spec.glyph === 'state-processing';
  const glyph = <UIIcon name={spec.glyph} size={size === 'sm' ? 16 : 20} className="easm-ui-status-glyph"
    {...(moving ? { 'data-motion': 'spin', 'data-active': 'true', 'data-repeat': 'true' } : {})} />;
  const common = { ...props, 'data-tone': spec.tone, 'data-size': size, 'data-variant': variant, 'data-status': status };
  if (variant === 'dot') {
    const tip = spec.description ? `${spec.label}: ${spec.description}` : spec.label;
    return <Tooltip trigger={<span {...common} tabIndex={0} role="img" aria-label={tip} className={cx('easm-ui easm-ui-status-chip', className)}>{glyph}</span>}>{tip}</Tooltip>;
  }
  if (variant === 'row') {
    const line = detail ?? spec.description;
    return <span {...common} className={cx('easm-ui easm-ui-status-chip', className)}>
      {glyph}<span className="easm-ui-status-copy"><span className="easm-ui-status-label">{spec.label}</span>{line ? <span className="easm-ui-status-detail">{line}</span> : null}</span>
    </span>;
  }
  return <span {...common} className={cx('easm-ui easm-ui-status-chip', className)}>{glyph}<span className="easm-ui-status-label">{spec.label}</span></span>;
}

/* ------------------------------------------------------------------ StageChip */

export type LeadStageStep = 1 | 2 | 3 | 4 | 5 | 'closed' | 'stopped';
export interface StageChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Where on the one ramp the stage sits: 1 (first contact) to 5 (the goal), or off it. */
  step: LeadStageStep;
  children: ReactNode;
  size?: 'sm' | 'md';
}
/** A lead stage on one blue ramp that deepens towards the goal, so a stage is the same colour on the contacts
 *  list, the board and the conversation panel. Closed stages (lost, withdrawn) are muted; do-not-contact is red.
 *  Five pips beside the word say how far along it is without colour. */
export function StageChip({ step, children, size = 'md', className, ...props }: StageChipProps) {
  const on = typeof step === 'number' ? step : 0;
  return <span {...props} data-step={step} data-size={size} className={cx('easm-ui easm-ui-stage-chip', className)}>
    {typeof step === 'number' ? <span className="easm-ui-stage-pips" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} data-on={n <= on || undefined} />)}</span> : null}
    <span className="easm-ui-stage-label">{children}</span>
  </span>;
}

/* ------------------------------------------------------------------ Presence */

export type PresenceState = 'online' | 'idle' | 'away' | 'offline';
const presenceWords: Record<PresenceState, string> = { online: 'Online', idle: 'Idle', away: 'Away', offline: 'Offline' };
export interface PresenceProps extends HTMLAttributes<HTMLSpanElement> {
  state: PresenceState;
  /** On a call now: a blue phone dot beside the presence. */
  onCall?: boolean;
  /** How long in this state ("6 min"), shown after the word. */
  since?: string;
  /** The last thing they did ("Replied to Ali Khan"), a second line. */
  lastAction?: ReactNode;
  variant?: 'dot' | 'label';
  /** Words for the state (translation). */
  labels?: Partial<Record<PresenceState, string>>;
}
/** Online, idle, away or offline, told by shape as well as colour: a filled dot, a ring, a half dot, a hollow
 *  ring. Presence is derived from activity, so there is never a control here. */
export function Presence({ state, onCall = false, since, lastAction, variant = 'label', labels, className, ...props }: PresenceProps) {
  const word = labels?.[state] ?? presenceWords[state];
  const full = `${word}${since ? ` · ${since}` : ''}${onCall ? ', on a call' : ''}`;
  const marks = <span className="easm-ui-presence-marks" aria-hidden="true"><i className="easm-ui-presence-dot" data-state={state} />{onCall ? <i className="easm-ui-presence-call"><UIIcon name="call" size={16} /></i> : null}</span>;
  if (variant === 'dot') return <span {...props} role="img" aria-label={full} title={full} className={cx('easm-ui easm-ui-presence', className)} data-variant="dot">{marks}</span>;
  return <span {...props} className={cx('easm-ui easm-ui-presence', className)} data-variant="label">
    {marks}<span className="easm-ui-presence-copy"><span className="easm-ui-presence-word">{word}{since ? <span className="easm-ui-presence-since"> · {since}</span> : null}{onCall ? <span className="easm-ui-sr-only">, on a call</span> : null}</span>
      {lastAction ? <span className="easm-ui-presence-last">{lastAction}</span> : null}</span>
  </span>;
}

/* ------------------------------------------------------------------ IdentityLevel */

export type IdentityLevelName = 'anonymous' | 'claimed' | 'verified' | 'erp';
const identityOrder: IdentityLevelName[] = ['anonymous', 'claimed', 'verified', 'erp'];
const identityText: Record<IdentityLevelName, { label: string; glyph: IconName; hint: string }> = {
  anonymous: { label: 'Anonymous', glyph: 'identity-anonymous', hint: 'Nothing said about who they are' },
  claimed: { label: 'Claimed', glyph: 'identity-claimed', hint: 'Said who they are; not proven' },
  verified: { label: 'Verified', glyph: 'identity-verified', hint: 'Proved their email with a code' },
  erp: { label: 'Institution sign-in', glyph: 'identity-erp', hint: "Signed in through the institution's own system" },
};
export interface IdentityLevelProps extends HTMLAttributes<HTMLSpanElement> {
  level: IdentityLevelName;
  /** labelled: the glyph, the level's name and the four rising bars. compact: the glyph and the bars. */
  variant?: 'compact' | 'labelled';
  labels?: Partial<Record<IdentityLevelName, string>>;
}
/** How sure we are of who someone is, on the platform's one ladder: anonymous, claimed, verified, institution
 *  sign-in. Four bars rise like a signal and fill to the level; each level has its own colour (grey, amber,
 *  blue, teal), so the ladder reads at a glance and still reads without colour. */
export function IdentityLevel({ level, variant = 'labelled', labels, className, ...props }: IdentityLevelProps) {
  const known = identityOrder.includes(level) ? level : 'anonymous';
  const index = identityOrder.indexOf(known);
  const spec = identityText[known];
  const label = labels?.[known] ?? spec.label;
  const name = `Identity: ${label}, ${index + 1} of 4. ${spec.hint}.`;
  return <Tooltip trigger={<span {...props} tabIndex={0} role="img" aria-label={name} data-level={known} data-variant={variant} className={cx('easm-ui easm-ui-identity', className)}>
    <UIIcon name={spec.glyph} size={20} />
    {variant === 'labelled' ? <span className="easm-ui-identity-label">{label}</span> : null}
    <span className="easm-ui-identity-bars" aria-hidden="true">{identityOrder.map((step, i) => <i key={step} data-on={i <= index || undefined} />)}</span>
  </span>}>{`${label}: ${spec.hint}`}</Tooltip>;
}

/* ------------------------------------------------------------------ SlaClock */

type Clockish = Date | string | number;
const toTime = (value: Clockish) => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
function spoken(ms: number) {
  const minutes = Math.round(Math.abs(ms) / 60000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  if (hours < 24) return rest && hours < 10 ? `${hours} h ${rest} min` : `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}
export type SlaState = 'on-track' | 'due-soon' | 'breached' | 'paused' | 'met';
export interface SlaClockProps extends HTMLAttributes<HTMLSpanElement> {
  /** When the response is due. */
  dueAt: Clockish;
  /** When the clock started; the ring shows the share of that time left. */
  startedAt?: Clockish;
  /** Paused (outside office hours) or met override the time. */
  paused?: boolean;
  met?: boolean;
  /** Why it is paused, shown after the word. Defaults to "outside office hours". */
  pausedReason?: string;
  /** Under this many minutes left is "due soon". */
  soonMinutes?: number;
  /** dot: a mark for list rows. chip: the time left in words. ring: the time left inside a closing ring. */
  variant?: 'dot' | 'chip' | 'ring';
  /** The time to measure against; the clock keeps itself current when omitted. */
  now?: Clockish;
}
export function slaState({ dueAt, paused, met, soonMinutes = 15, now }: Pick<SlaClockProps, 'dueAt' | 'paused' | 'met' | 'soonMinutes'> & { now: number }): SlaState {
  if (met) return 'met';
  if (paused) return 'paused';
  const left = toTime(dueAt) - now;
  return left < 0 ? 'breached' : left <= soonMinutes * 60000 ? 'due-soon' : 'on-track';
}
/** The response clock: how long is left, due soon, overdue by how much, paused outside office hours, or met.
 *  It counts by itself every 30 seconds; it never moves or blinks, only the words and the ring change. */
export function SlaClock({ dueAt, startedAt, paused, met, pausedReason = 'outside office hours', soonMinutes = 15, variant = 'chip', now: fixedNow, className, ...props }: SlaClockProps) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (fixedNow !== undefined || paused || met) return;
    const id = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [fixedNow, paused, met]);
  const now = fixedNow !== undefined ? toTime(fixedNow) : tick;
  const state = slaState({ dueAt, paused, met, soonMinutes, now });
  const left = toTime(dueAt) - now;
  const words = state === 'met' ? 'Met' : state === 'paused' ? `Paused, ${pausedReason}` : state === 'breached' ? `Overdue ${spoken(left)}` : `${spoken(left)} left`;
  const glyph: IconName = state === 'met' ? 'state-done' : state === 'paused' ? 'state-paused' : state === 'breached' ? 'sla-breach' : 'clock';
  const total = startedAt !== undefined ? toTime(dueAt) - toTime(startedAt) : 0;
  const share = state === 'met' ? 1 : state === 'breached' ? 0 : total > 0 ? Math.max(0, Math.min(1, left / total)) : 1;
  const common = { ...props, 'data-state': state, 'data-variant': variant, className: cx('easm-ui easm-ui-sla', className) };
  if (variant === 'dot') return <span {...common} role="img" aria-label={`Response time: ${words}`} title={words}><i className="easm-ui-sla-dot" /></span>;
  if (variant === 'ring') {
    const r = 15, c = 2 * Math.PI * r;
    return <span {...common} role="img" aria-label={`Response time: ${words}`}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true" className="easm-ui-sla-ring">
        <circle cx="18" cy="18" r={r} className="easm-ui-sla-ring-track" />
        <circle cx="18" cy="18" r={r} className="easm-ui-sla-ring-left" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 18 18)" />
      </svg>
      <span className="easm-ui-sla-words" aria-hidden="true" suppressHydrationWarning>{words}</span>
    </span>;
  }
  return <span {...common}><UIIcon name={glyph} size={16} /><span suppressHydrationWarning>{words}</span></span>;
}

/* ------------------------------------------------------------------ Timeline */

export interface TimelineItem {
  id: string;
  glyph: IconName;
  tone?: StatusTone;
  /** Who did it (a name, "Assistant", "System"). */
  actor?: ReactNode;
  /** What happened, one line. */
  title: ReactNode;
  /** When, already formatted ("10:42", "Yesterday"). */
  time?: ReactNode;
  /** Machine time for the <time> element. */
  dateTime?: string;
  detail?: ReactNode;
  /** Longer content behind a "Show more" disclosure (a transcript, a diff). */
  body?: ReactNode;
  /** The day it belongs to ("Today", "12 Oct"); a separator is drawn when it changes. */
  day?: string;
  /** A stage chip or tag beside the title (the person-journey variant). */
  badge?: ReactNode;
}
export interface TimelineProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  items: readonly TimelineItem[];
  density?: 'compact' | 'roomy';
  /** Shown above the first item when earlier events exist. */
  onLoadEarlier?: () => void;
  loadingEarlier?: boolean;
  emptyLabel?: string;
}
/** What happened, in order: a marker per event (its glyph in a tinted circle), who did it, when, one line, and
 *  an optional longer body. Days are separated. Newest last, like a conversation. */
export function Timeline({ label, items, density = 'roomy', onLoadEarlier, loadingEarlier = false, emptyLabel = 'Nothing has happened yet.', className, ...props }: TimelineProps) {
  let lastDay: string | undefined;
  return <section {...props} aria-label={label} data-density={density} className={cx('easm-ui easm-ui-timeline', className)}>
    {onLoadEarlier ? <button type="button" className="easm-ui-timeline-earlier" onClick={onLoadEarlier} disabled={loadingEarlier} aria-busy={loadingEarlier || undefined}>
      <UIIcon name={loadingEarlier ? 'spinner' : 'arrow-up'} size={16} {...(loadingEarlier ? { 'data-motion': 'spin', 'data-active': 'true', 'data-repeat': 'true' } : {})} />{loadingEarlier ? 'Loading earlier events' : 'Show earlier events'}
    </button> : null}
    {items.length ? <ol className="easm-ui-timeline-list">
      {items.map((item, index) => {
        const day = item.day && item.day !== lastDay ? item.day : undefined;
        lastDay = item.day ?? lastDay;
        // The rail is the marker column: the thread above a day label (continuing from the event before), the
        // marker, and the thread down to the next event. Every segment is laid out in the flow, so a line can
        // never cross a marker whatever the row holds.
        return <li key={item.id} className="easm-ui-timeline-item" data-tone={item.tone ?? 'neutral'} data-day-start={day ? true : undefined}>
          <span className="easm-ui-timeline-rail" aria-hidden="true">
            {day ? <i className="easm-ui-timeline-lead" data-blank={index === 0 || undefined} /> : null}
            <span className="easm-ui-timeline-marker"><UIIcon name={item.glyph} size={density === 'compact' ? 16 : 20} /></span>
            {index < items.length - 1 ? <i className="easm-ui-timeline-thread" /> : null}
          </span>
          <div className="easm-ui-timeline-content">
            {day ? <p className="easm-ui-timeline-day">{day}</p> : null}
            <p className="easm-ui-timeline-head">
              <span className="easm-ui-timeline-title">{item.actor ? <strong>{item.actor} </strong> : null}{item.title}{item.badge ? <> {item.badge}</> : null}</span>
              {item.time ? <time className="easm-ui-timeline-time" dateTime={item.dateTime}>{item.time}</time> : null}
            </p>
            {item.detail ? <p className="easm-ui-timeline-detail">{item.detail}</p> : null}
            {item.body ? <details className="easm-ui-timeline-body"><summary>Show more</summary><div>{item.body}</div></details> : null}
          </div>
        </li>;
      })}
    </ol> : <p className="easm-ui-timeline-empty">{emptyLabel}</p>}
  </section>;
}

/* ------------------------------------------------------------------ Stepper */

export type StepState = 'todo' | 'current' | 'done' | 'blocked' | 'skipped';
export interface StepperStep { id: string; label: ReactNode; hint?: ReactNode; state: StepState; /** Why a blocked step cannot continue. */ reason?: ReactNode }
export interface StepperProps extends HTMLAttributes<HTMLElement> {
  label: string;
  steps: readonly StepperStep[];
  orientation?: 'horizontal' | 'vertical';
  /** dots: five-dot progress that fits a table cell; its words are for screen readers and the tip. */
  variant?: 'full' | 'dots';
  /** Make a reached step a link or button (going back to a done step). */
  onStepSelect?: (id: string) => void;
}
const stepWords: Record<StepState, string> = { todo: 'not started', current: 'current step', done: 'done', blocked: 'blocked', skipped: 'skipped' };
/** Where someone is in a set of steps: done, the current one, what is left, and a blocked step with the reason.
 *  Horizontal lays the steps side by side and folds to vertical in a narrow box. */
export function Stepper({ label, steps, orientation = 'horizontal', variant = 'full', onStepSelect, className, ...props }: StepperProps) {
  const done = steps.filter(s => s.state === 'done' || s.state === 'skipped').length;
  if (variant === 'dots') {
    const words = `${label}: ${done} of ${steps.length} done`;
    return <span {...props} role="img" aria-label={words} title={words} className={cx('easm-ui easm-ui-stepper-dots', className)}>
      {steps.map(s => <i key={s.id} data-state={s.state} />)}
    </span>;
  }
  return <nav {...props} aria-label={label} data-orientation={orientation} className={cx('easm-ui easm-ui-stepper', className)}>
    <ol>
      {steps.map((step, index) => {
        const glyph: IconName | null = step.state === 'done' ? 'checkmark' : step.state === 'blocked' ? 'state-blocked' : step.state === 'skipped' ? 'arrow-right' : null;
        // The node and the line to the next step share one rail, laid out in the flow (a row when the steps sit
        // side by side, a column when they stack), so the line always starts and ends clear of the nodes.
        const body = <>
          <span className="easm-ui-step-rail" aria-hidden="true">
            <span className="easm-ui-step-node">{glyph ? <UIIcon name={glyph} size={16} /> : index + 1}</span>
            {index < steps.length - 1 ? <i className="easm-ui-step-line" /> : null}
          </span>
          <span className="easm-ui-step-copy"><span className="easm-ui-step-label">{step.label}<span className="easm-ui-sr-only">, {stepWords[step.state]}</span></span>
            {step.hint ? <span className="easm-ui-step-hint">{step.hint}</span> : null}
            {step.state === 'blocked' && step.reason ? <span className="easm-ui-step-reason">{step.reason}</span> : null}</span>
        </>;
        const reachable = onStepSelect && (step.state === 'done' || step.state === 'current');
        return <li key={step.id} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
          {reachable ? <button type="button" className="easm-ui-step" onClick={() => onStepSelect!(step.id)}>{body}</button> : <span className="easm-ui-step">{body}</span>}
        </li>;
      })}
    </ol>
  </nav>;
}

/* ------------------------------------------------------------------ ReadinessChecklist */

export interface ReadinessItem {
  id: string;
  label: ReactNode;
  state: 'done' | 'blocked' | 'needs-someone';
  /** Why it is not ready, in words a person can act on. */
  why?: ReactNode;
  /** Shown only when the viewer can fix it: pass it only for them. */
  fix?: { label: string; href?: string; onClick?: () => void };
  /** Who else must act, for needs-someone ("An administrator"). */
  owner?: ReactNode;
}
export interface ReadinessChecklistProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  items: readonly ReadinessItem[];
  /** Said when everything is done. */
  readyLabel?: ReactNode;
}
/** What stands between this and ready: each step done, blocked (with why and a Fix it for someone who can) or
 *  waiting on someone else, and a count. Done items fold into the count so what is left leads. */
export function ReadinessChecklist({ title, items, readyLabel = 'Ready', className, ...props }: ReadinessChecklistProps) {
  const id = useId();
  const done = items.filter(i => i.state === 'done').length;
  const ready = done === items.length;
  const left = items.filter(i => i.state !== 'done');
  const [showDone, setShowDone] = useState(false);
  return <section {...props} aria-labelledby={id} data-ready={ready || undefined} className={cx('easm-ui easm-ui-readiness', className)}>
    <header className="easm-ui-readiness-head">
      <h3 id={id}>{title}</h3>
      <span className="easm-ui-readiness-count"><UIIcon name={ready ? 'state-done' : 'state-blocked'} size={16} />{ready ? readyLabel : `${done} of ${items.length} done`}</span>
    </header>
    <ul className="easm-ui-readiness-list">
      {(showDone ? items : left).map(item => <li key={item.id} data-state={item.state} data-fix={item.state !== 'done' && item.fix ? true : undefined}>
        <UIIcon name={item.state === 'done' ? 'state-done' : item.state === 'blocked' ? 'state-blocked' : 'state-waiting-on-person'} size={20} />
        <div className="easm-ui-readiness-copy">
          <span className="easm-ui-readiness-label">{item.label}<span className="easm-ui-sr-only">, {item.state === 'done' ? 'done' : item.state === 'blocked' ? 'not done' : 'waiting on someone else'}</span></span>
          {item.state !== 'done' && (item.why || item.owner) ? <span className="easm-ui-readiness-why">{item.why}{item.owner ? <>{item.why ? ' ' : ''}<span className="easm-ui-readiness-owner">Needs {item.owner}.</span></> : null}</span> : null}
        </div>
        {item.state !== 'done' && item.fix ? item.fix.href
          ? <EasmLink href={item.fix.href} className="easm-ui-readiness-fix">{item.fix.label}</EasmLink>
          : <button type="button" className="easm-ui-readiness-fix" onClick={item.fix.onClick}>{item.fix.label}</button> : null}
      </li>)}
    </ul>
    {done && !ready ? <button type="button" className="easm-ui-readiness-toggle" aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>{showDone ? 'Hide done steps' : `Show ${done} done`}</button> : null}
  </section>;
}

/* ------------------------------------------------------------------ UnmeasuredValue */

export interface UnmeasuredValueProps extends HTMLAttributes<HTMLSpanElement> {
  /** Why there is no figure ("No ad account connected", "No connected provider reports this"). */
  reason: string;
  /** Short word shown beside the dash in roomy places (a stat card); tables show the dash alone. */
  showWord?: boolean;
}
/** "Not measured" as a value of its own, never a zero: a dash, and the reason on hover, focus or tap. */
export function UnmeasuredValue({ reason, showWord = false, className, ...props }: UnmeasuredValueProps) {
  return <Tooltip openOnClick trigger={<span {...props} tabIndex={0} role="img" aria-label={`Not measured: ${reason}`} className={cx('easm-ui easm-ui-unmeasured', className)}>
    <span aria-hidden="true" className="easm-ui-unmeasured-dash">—</span>{showWord ? <span aria-hidden="true" className="easm-ui-unmeasured-word">Not measured</span> : null}
  </span>}>{reason}</Tooltip>;
}

/* ------------------------------------------------------------------ FilterChip */

export interface FilterChipProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children' | 'onChange'> {
  label: string;
  icon?: IconName;
  /** How many items this filter would show; 0 dims the chip but keeps it usable. */
  count?: number;
  /** Something here needs someone (Needs you, Urgent): the chip carries the attention accent. */
  attention?: boolean;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  disabled?: boolean;
}
/** A quick filter that can be combined with others: an optional glyph, the words, a count, and an attention accent
 *  for filters that point at work waiting on someone. On is a dark fill, never only a colour change. */
export function FilterChip({ label, icon, count, attention = false, selected, onSelectedChange, disabled, className, ...props }: FilterChipProps) {
  return <button {...props} type="button" aria-pressed={selected} disabled={disabled} onClick={() => onSelectedChange(!selected)}
    data-attention={attention || undefined} data-empty={count === 0 || undefined} className={cx('easm-ui easm-ui-filter-chip', className)}>
    {icon ? <UIIcon name={icon} size={16} /> : null}
    <span className="easm-ui-filter-chip-label">{label}</span>
    {count !== undefined ? <span className="easm-ui-filter-chip-count">{count > 999 ? '999+' : count}<span className="easm-ui-sr-only"> {count === 1 ? 'item' : 'items'}</span></span> : null}
  </button>;
}
export interface FilterChipGroupProps extends HTMLAttributes<HTMLDivElement> { label: string; children: ReactNode }
/** A labelled row of FilterChips that wraps on narrow screens. */
export function FilterChipGroup({ label, className, children, ...props }: FilterChipGroupProps) {
  return <div {...props} role="group" aria-label={label} className={cx('easm-ui easm-ui-filter-chips', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ PersonJourney */

export type JourneyKind = 'stage' | 'source' | 'chat' | 'call' | 'form' | 'payment' | 'note';
const journeyKinds: Record<JourneyKind, { label: string; icon: IconName }> = {
  stage: { label: 'Stages', icon: 'stage-applied' }, source: { label: 'Sources', icon: 'dashboard-marketing' }, chat: { label: 'Chats', icon: 'chat' },
  call: { label: 'Calls', icon: 'call' }, form: { label: 'Forms', icon: 'dashboard-forms' }, payment: { label: 'Payments', icon: 'wallet' }, note: { label: 'Notes', icon: 'internal-note' },
};
export interface JourneyEvent extends TimelineItem { kind: JourneyKind }
export interface PersonJourneyProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  events: readonly JourneyEvent[];
  density?: 'compact' | 'roomy';
  onLoadEarlier?: () => void;
  loadingEarlier?: boolean;
}
/** One person's story in one timeline: stage changes, where they first came from, chats, calls, forms, payments and
 *  notes, with a filter per kind (each with its count): nothing picked shows everything, picking kinds narrows it.
 *  Serves the contact page and Marketing's People journey. */
export function PersonJourney({ label, events, density = 'roomy', onLoadEarlier, loadingEarlier, className, ...props }: PersonJourneyProps) {
  const present = (Object.keys(journeyKinds) as JourneyKind[]).filter(kind => events.some(e => e.kind === kind));
  // Nothing picked shows everything; picking kinds narrows the story to them.
  const [picked, setPicked] = useState<readonly JourneyKind[]>([]);
  const shown = picked.length ? events.filter(e => picked.includes(e.kind)) : events;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-journey', className)}>
    {present.length > 1 ? <FilterChipGroup label={`Show in ${label}`}>
      {present.map(kind => <FilterChip key={kind} label={journeyKinds[kind].label} icon={journeyKinds[kind].icon} count={events.filter(e => e.kind === kind).length}
        selected={picked.includes(kind)} onSelectedChange={on => setPicked(current => on ? [...current, kind] : current.filter(k => k !== kind))} />)}
    </FilterChipGroup> : null}
    <Timeline label={label} items={shown} density={density} onLoadEarlier={onLoadEarlier} loadingEarlier={loadingEarlier} emptyLabel="Nothing of this kind yet." />
  </section>;
}
