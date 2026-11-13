'use client';

// Setup and operations parts (demand list wave 4a): a connected system as a card (ConnectorCard, C-X-19) and a
// knowledge source on it (SourceCard, C-CIMS-09), a setup laid out as steps with what each still needs
// (SetupChecklist, C-MKT-13), the AI credits balance with its low and paused states (CreditsMeter, C-SH-02), and a
// person's day as presence over time (ShiftStrip, C-SUP-09). Each replaces a page's own text-only version.
import { useId, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import type { BrandIconName, IconName } from '@easm-ui/icons';
import { BrandIcon } from '@easm-ui/icons/brand-icon';
import { Sparkline } from './charts';
import { cx, UIIcon } from './shared';
import { defineStatuses, ReadinessChecklist, StatusChip, type ReadinessItem } from './workflow';

export const setupComponentNames = ['ConnectorCard', 'SourceCard', 'SetupChecklist', 'CreditsMeter', 'ShiftStrip'] as const;

type When = string | number | Date;
const time = (value: When) => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
const span = (ms: number) => ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60_000))} min` : ms < 172_800_000 ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / 86_400_000)} days`;
const hm = (ms: number) => { const m = Math.round(ms / 60_000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };

/* ------------------------------------------------------------------ ConnectorCard */

export type ConnectorState = 'connected' | 'syncing' | 'attention' | 'failing' | 'paused' | 'off';
export const connectorStates = defineStatuses({
  connected: { label: 'Connected', glyph: 'state-live', tone: 'success' },
  syncing: { label: 'Syncing', glyph: 'state-processing', tone: 'brand', description: 'Reading it now' },
  attention: { label: 'Needs attention', glyph: 'state-blocked', tone: 'warning' },
  failing: { label: 'Failing', glyph: 'state-failed', tone: 'danger' },
  paused: { label: 'Paused', glyph: 'state-paused', tone: 'neutral' },
  off: { label: 'Not connected', glyph: 'plug-disconnected', tone: 'neutral' },
});
export interface ConnectorCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  name: string;
  /** The system's own mark; or `icon` for EASM's own kinds (a website crawl, an upload folder). */
  brand?: BrandIconName;
  icon?: IconName;
  /** Its address or account: "uni.example.edu", "Ad account act_2041". */
  detail?: ReactNode;
  state: ConnectorState;
  lastSync?: When | null;
  nextSync?: When | null;
  /** One line on how it is doing, in words: "3 pages could not be read". */
  health?: ReactNode;
  /** The main action: Sync now, Reconnect, Open. */
  action?: ReactNode;
  /** The time to measure from (tests, server rendering). */
  now?: When;
  children?: ReactNode;
}
/** A connected system: its mark, name and address, its state, when it last synced and syncs next, one line on its
 *  health, and the one action it needs. Sources, Automation systems and the Admin systems list share it. */
export function ConnectorCard({ name, brand, icon = 'plug-disconnected', detail, state, lastSync, nextSync, health, action, now, children, className, ...props }: ConnectorCardProps) {
  const at = now !== undefined ? time(now) : Date.now();
  const last = lastSync ? time(lastSync) : null, next = nextSync ? time(nextSync) : null;
  return <article {...props} aria-label={name} className={cx('easm-ui easm-ui-connector', className)} data-state={state}>
    <header className="easm-ui-connector-head">
      {brand ? <BrandIcon name={brand} appearance="tile" size={40} /> : <span className="easm-ui-connector-tile" aria-hidden="true"><UIIcon name={icon} size={24} /></span>}
      <span className="easm-ui-connector-name"><strong>{name}</strong>{detail ? <span>{detail}</span> : null}</span>
      <StatusChip status={state} statuses={connectorStates} size="sm" />
    </header>
    {last !== null || next !== null ? <p className="easm-ui-connector-times">
      {last !== null ? <span>Synced {span(Math.max(at - last, 0))} ago</span> : null}
      {next !== null && state !== 'off' && state !== 'paused' ? <span>{next <= at ? 'Next sync due now' : `Next in ${span(next - at)}`}</span> : null}
    </p> : null}
    {health ? <p className="easm-ui-connector-health"><UIIcon name={state === 'failing' ? 'state-failed' : state === 'attention' ? 'state-blocked' : 'state-done'} size={16} /><span>{health}</span></p> : null}
    {children}
    {action ? <footer className="easm-ui-connector-foot">{action}</footer> : null}
  </article>;
}

/* ------------------------------------------------------------------ SourceCard */

export interface SourceCardProps extends ConnectorCardProps {
  indexed?: number;
  failed?: number;
  /** The last 14 days, oldest first: the share of items that indexed each day (0–1). */
  trend?: readonly number[];
  /** pull: EASM reads the source. two-way: the WordPress plugin also takes removals back. */
  direction?: 'pull' | 'two-way';
  locale?: string;
}
/** A knowledge source: the connector card with how many items it indexed (and failed), the last two weeks of sync
 *  health as a line, and which way the sync runs. */
export function SourceCard({ indexed, failed, trend, direction, locale = 'en', children, className, ...props }: SourceCardProps) {
  const n = (v: number) => v.toLocaleString(locale);
  const latest = trend?.length ? trend[trend.length - 1] : null;
  return <ConnectorCard {...props} className={cx('easm-ui-source-card', className)}>
    {indexed !== undefined || direction ? <p className="easm-ui-source-stats">
      {indexed !== undefined ? <span><strong>{n(indexed)}</strong> indexed</span> : null}
      {failed ? <span data-failed="true"><strong>{n(failed)}</strong> could not be read</span> : null}
      {direction ? <span className="easm-ui-source-direction"><UIIcon name={direction === 'two-way' ? 'arrow-swap' : 'arrow-download'} size={16} />
        {direction === 'two-way' ? 'Two-way: removals go back' : 'EASM reads it'}</span> : null}
    </p> : null}
    {trend?.length ? <div className="easm-ui-source-trend">
      <span>Last 14 days{latest !== null ? <> · <strong>{Math.round(latest * 100)}%</strong> indexed today</> : null}</span>
      <Sparkline label="Share of items indexed each day, last 14 days" data={trend.map(v => Math.round(v * 100))} tone={latest !== null && latest < .9 ? 'amber' : 'teal'} height={32} locale={locale} />
    </div> : null}
    {children}
  </ConnectorCard>;
}

/* ------------------------------------------------------------------ SetupChecklist */

export interface SetupStep {
  id: string;
  label: string;
  /** What each part of the step still needs; done items fold into the count. */
  checks: readonly ReadinessItem[];
  /** Where to go to do it: "Open tracking settings". */
  action?: ReactNode;
}
type SetupState = 'done' | 'blocked' | 'waiting' | 'todo';
const setupState = (s: SetupStep): SetupState => s.checks.every(c => c.state === 'done') ? 'done' : s.checks.some(c => c.state === 'blocked') ? 'blocked' : 'waiting';
const setupWords: Record<SetupState, (s: SetupStep) => string> = {
  done: () => 'Ready',
  blocked: s => { const n = s.checks.filter(c => c.state === 'blocked').length; return `${n} ${n === 1 ? 'thing' : 'things'} to fix`; },
  waiting: () => 'Waiting on someone else',
  todo: () => 'Not started',
};
export interface SetupChecklistProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  steps: readonly SetupStep[];
}
/** A setup as its steps in order, each with its state, and under the open step what it still needs with a Fix it
 *  for someone who can. The first step that is not ready opens by itself. */
export function SetupChecklist({ label, steps, className, ...props }: SetupChecklistProps) {
  const id = useId();
  const states = steps.map(setupState);
  const firstOpen = states.findIndex(s => s !== 'done');
  const [open, setOpen] = useState<string | null>(firstOpen >= 0 ? steps[firstOpen].id : null);
  const ready = states.filter(s => s === 'done').length;
  return <section {...props} aria-labelledby={`${id}-t`} className={cx('easm-ui easm-ui-setup', className)}>
    <header className="easm-ui-setup-head">
      <h3 id={`${id}-t`}>{label}</h3>
      <span className="easm-ui-setup-count" data-ready={ready === steps.length || undefined}>{ready} of {steps.length} ready</span>
    </header>
    <ol className="easm-ui-setup-steps">
      {steps.map((step, i) => {
        const state = states[i];
        const expanded = open === step.id;
        return <li key={step.id} data-state={state} data-open={expanded || undefined}>
          <button type="button" className="easm-ui-setup-step" aria-expanded={expanded} aria-controls={`${id}-${step.id}`} onClick={() => setOpen(expanded ? null : step.id)}>
            <span className="easm-ui-setup-node" aria-hidden="true">{state === 'done' ? <UIIcon name="checkmark" size={16} /> : state === 'blocked' ? <UIIcon name="state-blocked" size={16} /> : i + 1}</span>
            <span className="easm-ui-setup-copy"><strong>{step.label}</strong><span>{setupWords[state](step)}</span></span>
            <UIIcon name="chevron-down" size={16} className="easm-ui-setup-chevron" />
          </button>
          {expanded ? <div id={`${id}-${step.id}`} className="easm-ui-setup-body">
            <ReadinessChecklist title="What it needs" items={step.checks} />
            {step.action ? <div className="easm-ui-setup-action">{step.action}</div> : null}
          </div> : null}
        </li>;
      })}
    </ol>
  </section>;
}

/* ------------------------------------------------------------------ CreditsMeter */

export interface CreditsMeterProps extends HTMLAttributes<HTMLElement> {
  balance: number;
  /** A full balance (the plan's allowance or the last top-up), for the bar. */
  of?: number;
  /** At or under this it is low (default a tenth of `of`). */
  lowAt?: number;
  /** Spent per day lately, for "about N days left". */
  perDay?: number;
  /** What people are told while the assistants are paused for credits. */
  pausedMessage?: string;
  /** Top up, or ask an administrator to. */
  action?: ReactNode;
  /** card: Usage & credits. inline: a header or a settings row. */
  variant?: 'card' | 'inline';
  locale?: string;
}
/** The AI credits balance: a bar against a full balance, how long it lasts at the current rate, amber when low, and
 *  when it runs out, that the assistants are paused and what people are told meanwhile, with the way to top up. */
export function CreditsMeter({ balance, of, lowAt, perDay, pausedMessage = 'The assistant is not available right now. Please contact the office, or try again later.',
  action, variant = 'card', locale = 'en', className, ...props }: CreditsMeterProps) {
  const low = lowAt ?? (of ? of / 10 : 0);
  const state = balance <= 0 ? 'exhausted' : balance <= low ? 'low' : 'ok';
  const share = of ? Math.max(0, Math.min(1, balance / of)) : null;
  const days = perDay && perDay > 0 && balance > 0 ? Math.floor(balance / perDay) : null;
  const n = Math.max(balance, 0).toLocaleString(locale);
  const bar = share !== null ? <span className="easm-ui-credits-bar" aria-hidden="true"><span style={{ width: `${share * 100}%` } as CSSProperties} /></span> : null;
  const said = state === 'exhausted' ? 'Used up: the assistants are paused' : days !== null ? `About ${days.toLocaleString(locale)} ${days === 1 ? 'day' : 'days'} left at the current rate` : state === 'low' ? 'Running low' : 'Enough for now';
  if (variant === 'inline') return <span {...props} className={cx('easm-ui easm-ui-credits', className)} data-variant="inline" data-state={state} role="group" aria-label={`AI credits: ${n}. ${said}`}>
    <UIIcon name={state === 'ok' ? 'credits' : state === 'low' ? 'credits-low' : 'credits-exhausted'} size={16} /><strong>{n}</strong>{bar}
  </span>;
  return <section {...props} aria-label="AI credits" className={cx('easm-ui easm-ui-credits', className)} data-variant="card" data-state={state}>
    <header className="easm-ui-credits-head">
      <span className="easm-ui-credits-tile" aria-hidden="true"><UIIcon name={state === 'ok' ? 'credits' : state === 'low' ? 'credits-low' : 'credits-exhausted'} size={24} /></span>
      <span className="easm-ui-credits-title"><span>AI credits</span><strong>{n}<span> credits</span></strong></span>
    </header>
    {bar}
    <p className="easm-ui-credits-said">{state !== 'ok' ? <UIIcon name={state === 'low' ? 'warning' : 'state-paused'} size={16} /> : null}<span>{said}{of ? <span className="easm-ui-credits-of"> · {of.toLocaleString(locale)} when full</span> : null}</span></p>
    {state === 'exhausted' ? <blockquote className="easm-ui-credits-quote"><span>What people are told meanwhile</span><p>{pausedMessage}</p></blockquote> : null}
    {action ? <footer className="easm-ui-credits-foot">{action}</footer> : null}
  </section>;
}

/* ------------------------------------------------------------------ ShiftStrip */

export type ShiftPresence = 'online' | 'idle' | 'away';
export interface ShiftPeriod { from: When; to: When; state: ShiftPresence }
export interface ShiftDay {
  id: string;
  /** The day's name in the week view ("Mon 26"). */
  label?: string;
  periods: readonly ShiftPeriod[];
  /** How the shift ended: signed out, away too long, the office day ended, or still open. */
  ended?: 'logout' | 'gap' | 'day-end' | 'open';
}
const endedWords: Record<NonNullable<ShiftDay['ended']>, string> = { logout: 'Signed out', gap: 'Away too long', 'day-end': 'Office day ended', open: 'Still on shift' };
const presenceWords: Record<ShiftPresence, string> = { online: 'Online', idle: 'Idle', away: 'Away' };
export interface ShiftStripProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  /** One day draws the full strip; several draw the week, a row each. */
  days: readonly ShiftDay[];
  /** The hours the strip covers (8 to 20). */
  from?: number;
  to?: number;
  locale?: string;
}
/** A person's day as presence over time: online, idle and away along the office hours, when the shift began and
 *  ended and why, and the totals. With several days it is the week, one short row each. */
export function ShiftStrip({ label, days, from = 8, to = 20, locale = 'en', className, ...props }: ShiftStripProps) {
  const clock = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const week = days.length > 1;
  const row = (day: ShiftDay) => {
    const ps = day.periods.map(p => ({ ...p, a: time(p.from), b: time(p.to) })).filter(p => p.b > p.a).sort((x, y) => x.a - y.a);
    const base = ps.length ? new Date(ps[0].a) : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), from).getTime();
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), to).getTime();
    const pct = (t: number) => `${(Math.min(Math.max(t, start), end) - start) / (end - start) * 100}%`;
    const total = (s: ShiftPresence) => ps.filter(p => p.state === s).reduce((m, p) => m + Math.min(p.b, end) - Math.max(p.a, start), 0);
    const began = ps.length ? ps[0].a : null, finished = ps.length ? ps[ps.length - 1].b : null;
    const totals = (['online', 'idle', 'away'] as ShiftPresence[]).filter(s => total(s) > 0).map(s => `${presenceWords[s]} ${hm(total(s))}`).join(' · ');
    const story = began === null ? 'No shift' : `Started ${clock.format(began)}, ${day.ended === 'open' ? 'still on shift' : `ended ${clock.format(finished!)} (${endedWords[day.ended ?? 'logout'].toLowerCase()})`}. ${totals}.`;
    return { ps, pct, began, finished, totals, story };
  };
  if (!week) {
    const day = days[0];
    const r = row(day);
    const hours = Array.from({ length: Math.floor((to - from) / 2) + 1 }, (_, i) => from + i * 2);
    return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-shift', className)} data-view="day">
      <div className="easm-ui-shift-track" role="img" aria-label={`${label}: ${r.story}`}>
        {r.ps.map((p, i) => <i key={i} data-state={p.state} style={{ left: r.pct(p.a), width: `calc(${r.pct(p.b)} - ${r.pct(p.a)})` }} />)}
        {r.began !== null ? <span className="easm-ui-shift-mark" data-edge="start" style={{ left: r.pct(r.began) }} /> : null}
        {r.finished !== null && day.ended !== 'open' ? <span className="easm-ui-shift-mark" data-edge="end" style={{ left: r.pct(r.finished) }} /> : null}
      </div>
      <div className="easm-ui-shift-hours" aria-hidden="true">{hours.map(h => <span key={h} style={{ left: `${(h - from) / (to - from) * 100}%` }}>{h > 12 ? h - 12 : h}{h >= 12 ? ' pm' : ' am'}</span>)}</div>
      {r.began !== null ? <p className="easm-ui-shift-story">
        <span>Started <strong>{clock.format(r.began)}</strong></span>
        <span>{day.ended === 'open' ? <strong>Still on shift</strong> : <>Ended <strong>{clock.format(r.finished!)}</strong> · {endedWords[day.ended ?? 'logout']}</>}</span>
      </p> : <p className="easm-ui-shift-story"><span>No shift this day</span></p>}
      {r.totals ? <ul className="easm-ui-shift-totals" aria-label="Totals">{(['online', 'idle', 'away'] as ShiftPresence[]).map(s => {
        const part = r.totals.split(' · ').find(t => t.startsWith(presenceWords[s]));
        return part ? <li key={s} data-state={s}><i aria-hidden="true" />{part}</li> : null;
      })}</ul> : null}
    </section>;
  }
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-shift', className)} data-view="week">
    <ol className="easm-ui-shift-week">
      {days.map(day => { const r = row(day); return <li key={day.id}>
        <span className="easm-ui-shift-day">{day.label ?? ''}</span>
        <span className="easm-ui-shift-track" role="img" aria-label={`${day.label ?? ''}: ${r.story}`}>
          {r.ps.map((p, i) => <i key={i} data-state={p.state} style={{ left: r.pct(p.a), width: `calc(${r.pct(p.b)} - ${r.pct(p.a)})` }} />)}
        </span>
        <span className="easm-ui-shift-day-total">{r.totals ? r.totals.split(' · ')[0].replace('Online ', '') : '—'}</span>
      </li>; })}
    </ol>
    <ul className="easm-ui-shift-totals" aria-hidden="true">{(['online', 'idle', 'away'] as ShiftPresence[]).map(s => <li key={s} data-state={s}><i />{presenceWords[s]}</li>)}</ul>
  </section>;
}
