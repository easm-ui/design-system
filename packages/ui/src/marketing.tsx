'use client';

// Marketing parts (demand list wave 3, C-MKT-01…04 and C-MKT-08): how sure a figure is, how the attribution models
// share credit, one person's touches on a time axis, the funnel whose rates never cross from browsers to people,
// and an ad platform connection whose capabilities each keep their own state. Unknown is never zero: every figure
// can say "not measured" and why.
import { useMemo, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import type { BrandIconName, IconName } from '@easm-ui/icons';
import { BrandIcon } from '@easm-ui/icons/brand-icon';
import type { Provenance } from './charts';
import { Tooltip } from './feedback';
import { channelTone, finite, fullNumber, mark, toneStyle, useElementWidth } from './palette';
import { cx, reportContentProblem, UIIcon } from './shared';
import { defineStatuses, StatusChip, UnmeasuredValue } from './workflow';

export const marketingComponentNames = ['ProvenanceFigure', 'ProvenanceKey', 'CreditComparison', 'JourneyStrip', 'TwoBandFunnel', 'ConnectionCard'] as const;

type When = string | number | Date;
const time = (value: When) => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
const DAY = 86_400_000;
const shortDate = (locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
/** "paid_social" → "Paid social": a readable name for a channel key the caller did not name. */
const channelName = (channel: string) => { const words = channel.replace(/[_-]+/g, ' ').trim(); return words.charAt(0).toUpperCase() + words.slice(1); };

/* ------------------------------------------------------------------ ProvenanceFigure */

export interface ProvenanceGrade { label: string; glyph: IconName; sentence: string }
/** How sure a figure is, in one vocabulary: the same glyph and sentence on a stat, in a table and in a key. */
export const provenanceGrades: Readonly<Record<Provenance, ProvenanceGrade>> = {
  verified: { label: 'Verified', glyph: 'authority-verified', sentence: 'Verified: confirmed by the institution’s own records or a payment.' },
  external: { label: 'External', glyph: 'authority-external', sentence: 'External: reported by a connected system, not yet confirmed by the institution’s records.' },
  'self-reported': { label: 'Self-reported', glyph: 'authority-self-reported', sentence: 'Self-reported: the person said so in a conversation. Never added to verified figures.' },
  provisional: { label: 'Provisional', glyph: 'authority-provisional', sentence: 'Provisional: the provider can still adjust recent days, for about 72 hours.' },
  unmeasured: { label: 'Not measured', glyph: 'authority-unmeasured', sentence: 'Not measured: no connected source reports this.' },
};

export interface ProvenanceFigureProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** What the figure counts ("Applications"), read before the grade's sentence. */
  label: string;
  value: number | null;
  provenance: Provenance;
  /** Why there is no figure: "No account connected", "No connected provider reports this". */
  reason?: string;
  /** Replaces the grade's sentence when the source can be named: "External: reported by Meta, 26 Oct". */
  note?: string;
  format?: (value: number) => string;
  /** sm: a table cell or a bar list. md: running text. lg: a stat's headline figure. */
  size?: 'sm' | 'md' | 'lg';
  locale?: string;
}
/** A figure and how sure it is: verified, external, self-reported or provisional, with the reason in a tip that
 *  opens on hover, focus or tap. With no value (or unmeasured) it says "not measured" and why, never 0. */
export function ProvenanceFigure({ label, value, provenance, reason, note, format, size = 'md', locale = 'en', className, ...props }: ProvenanceFigureProps) {
  if (!finite(value) || provenance === 'unmeasured') {
    return <span {...props} className={cx('easm-ui easm-ui-provenance-figure', className)} data-size={size} data-provenance="unmeasured">
      <UnmeasuredValue reason={reason ?? note ?? provenanceGrades.unmeasured.sentence} showWord={size !== 'sm'} />
    </span>;
  }
  const grade = provenanceGrades[provenance];
  const sentence = note ?? grade.sentence;
  return <span {...props} className={cx('easm-ui easm-ui-provenance-figure', className)} data-size={size} data-provenance={provenance}>
    <span className="easm-ui-provenance-value">{(format ?? fullNumber(locale))(value)}</span>
    <Tooltip openOnClick trigger={<span className="easm-ui-provenance-mark" tabIndex={0} role="img" aria-label={`${label}: ${sentence}`}>
      <UIIcon name={grade.glyph} size={size === 'lg' ? 20 : 16} />
    </span>}>{sentence}</Tooltip>
  </span>;
}

export interface ProvenanceKeyProps extends Omit<HTMLAttributes<HTMLUListElement>, 'children'> {
  label?: string;
  /** The grades this page shows, in reading order. */
  grades?: readonly Provenance[];
}
/** The key to the grades a page uses, one line under a chart or above a table. */
export function ProvenanceKey({ label = 'How sure each figure is', grades = ['verified', 'external', 'self-reported', 'provisional'], className, ...props }: ProvenanceKeyProps) {
  return <ul {...props} aria-label={label} className={cx('easm-ui easm-ui-provenance-key', className)}>
    {grades.map(id => <li key={id} data-provenance={id} title={provenanceGrades[id].sentence}>
      <span className="easm-ui-provenance-mark" aria-hidden="true"><UIIcon name={provenanceGrades[id].glyph} size={16} /></span>{provenanceGrades[id].label}
    </li>)}
  </ul>;
}

/* ------------------------------------------------------------------ CreditComparison */

export type AttributionModel = 'first-touch' | 'last-touch' | 'linear' | 'time-decay' | 'position-based';
export const attributionModels: Readonly<Record<AttributionModel, { label: string; short: string; glyph: IconName; description: string }>> = {
  'first-touch': { label: 'First touch', short: 'First', glyph: 'model-first-touch', description: 'All credit to the first touch.' },
  'last-touch': { label: 'Last touch', short: 'Last', glyph: 'model-last-touch', description: 'All credit to the last touch before the outcome.' },
  linear: { label: 'Linear', short: 'Linear', glyph: 'model-linear', description: 'Credit shared equally between the touches.' },
  'time-decay': { label: 'Time decay', short: 'Decay', glyph: 'model-time-decay', description: 'More credit to the touches nearer the outcome.' },
  'position-based': { label: 'Position based', short: 'Position', glyph: 'model-position-based', description: 'Most credit to the first and last touches, the rest shared between.' },
};
const allModels = Object.keys(attributionModels) as AttributionModel[];

export interface CreditTouch {
  id: string;
  /** The channel key (paid_social, email…): its colour is the same in every chart. */
  channel: string;
  /** The campaign or source the touch came through. */
  label: string;
  /** A date or a short line under the label. */
  detail?: ReactNode;
  /** Credit under each model; null when that model was not computed. */
  credit: Partial<Record<AttributionModel, number | null>>;
}
export interface CreditComparisonProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  /** One person's touches (credit adds to 1 per model) or touches added up by campaign or channel. */
  touches: readonly CreditTouch[];
  models?: readonly AttributionModel[];
  /** Outcomes with no qualifying touch: the same under every model, shown apart, never parked on a channel. */
  unattributed?: number | null;
  format?: (value: number) => string;
  channelLabel?: (channel: string) => string;
  locale?: string;
}
/** The attribution models side by side: one stacked bar per model in the channels' own colours, and every touch's
 *  credit under every model below it, with the unattributed outcomes and the total at the foot. Pointing at a touch
 *  lights its share in every bar. */
export function CreditComparison({ label, touches, models = allModels, unattributed, format, channelLabel = channelName, locale = 'en', className, ...props }: CreditComparisonProps) {
  const [active, setActive] = useState<string | null>(null);
  const totals = models.map(m => touches.reduce((sum, t) => sum + (finite(t.credit[m]) ? t.credit[m] as number : 0), 0) + (finite(unattributed) ? unattributed : 0));
  const scale = Math.max(...totals, 0);
  const shares = scale <= 1.0001;
  const show = format ?? (shares ? (v: number) => `${Math.round(v * 100)}%` : (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 1 }));
  const cell = (v: number | null | undefined) => finite(v) ? show(v) : null;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-credit', className)} data-active={active ? true : undefined}>
    <div className="easm-ui-credit-bars">
      {models.map((m, mi) => {
        const parts = touches.filter(t => finite(t.credit[m]) && (t.credit[m] as number) > 0);
        const spoken = parts.map(t => `${channelLabel(t.channel)}, ${t.label}: ${show(t.credit[m] as number)}`).concat(finite(unattributed) && unattributed > 0 ? [`unattributed: ${show(unattributed)}`] : []).join('; ');
        return <div key={m} className="easm-ui-credit-model">
          <span className="easm-ui-credit-model-name"><UIIcon name={attributionModels[m].glyph} size={20} />{attributionModels[m].label}</span>
          <span className="easm-ui-credit-bar" role="img" aria-label={`${attributionModels[m].label}: ${spoken || 'no credit'}`}>
            {parts.map(t => <i key={t.id} data-touch={t.id} data-lit={active === t.id || undefined} style={{ flexBasis: `${((t.credit[m] as number) / scale) * 100}%`, background: mark(channelTone(t.channel)) }}
              onPointerEnter={() => setActive(t.id)} onPointerLeave={() => setActive(null)} />)}
            {finite(unattributed) && unattributed > 0 ? <i data-unattributed="true" style={{ flexBasis: `${(unattributed / scale) * 100}%` }} /> : null}
          </span>
          <span className="easm-ui-credit-total">{show(totals[mi])}</span>
        </div>;
      })}
    </div>
    <table className="easm-ui-credit-table" role="table" style={{ '--easm-credit-models': models.length } as CSSProperties}>
      <thead role="rowgroup"><tr role="row">
        <th role="columnheader" scope="col">Touch</th>
        {models.map(m => <th key={m} role="columnheader" scope="col" title={attributionModels[m].description}>
          <UIIcon name={attributionModels[m].glyph} size={16} /><span>{attributionModels[m].short}</span></th>)}
      </tr></thead>
      <tbody role="rowgroup">{touches.map(t => <tr key={t.id} role="row" data-lit={active === t.id || undefined}
        onPointerEnter={() => setActive(t.id)} onPointerLeave={() => setActive(null)}>
        <th role="rowheader" scope="row"><span className="easm-ui-credit-who">
          <i className="easm-ui-credit-swatch" aria-hidden="true" style={{ background: mark(channelTone(t.channel)) }} />
          <span className="easm-ui-credit-touch"><strong>{t.label}</strong><span>{channelLabel(t.channel)}{t.detail ? <> · {t.detail}</> : null}</span></span>
        </span></th>
        {models.map(m => <td key={m} role="cell" data-label={attributionModels[m].short}>{cell(t.credit[m]) ?? <UnmeasuredValue reason={`${attributionModels[m].label} was not computed`} />}</td>)}
      </tr>)}</tbody>
      <tfoot role="rowgroup">
        {finite(unattributed) ? <tr role="row" data-kind="unattributed">
          <th role="rowheader" scope="row"><span className="easm-ui-credit-who"><i className="easm-ui-credit-swatch" data-unattributed="true" aria-hidden="true" />
            <span className="easm-ui-credit-touch"><strong>Unattributed</strong><span>No touch to credit</span></span></span></th>
          {models.map(m => <td key={m} role="cell" data-label={attributionModels[m].short}>{show(unattributed)}</td>)}
        </tr> : null}
        <tr role="row" data-kind="total">
          <th role="rowheader" scope="row"><span className="easm-ui-credit-who"><span className="easm-ui-credit-touch"><strong>Total</strong></span></span></th>
          {models.map((m, mi) => <td key={m} role="cell" data-label={attributionModels[m].short}>{show(totals[mi])}</td>)}
        </tr>
      </tfoot>
    </table>
  </section>;
}

/* ------------------------------------------------------------------ JourneyStrip */

export type TouchRole = 'first' | 'last' | 'only' | 'assist' | 'outside';
const roleWords: Record<TouchRole, string> = { first: 'First touch', last: 'Last touch', only: 'First and last touch', assist: 'Assist', outside: 'Outside the lookback window' };
export interface JourneyTouch {
  id: string;
  at: When;
  channel: string;
  /** The campaign or source. */
  label: string;
  detail?: string;
  /** Worked out from the lookback window when left out. */
  role?: TouchRole;
}
export interface JourneyStripProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  touches: readonly JourneyTouch[];
  /** What the journey ended in ("Applied"), at the right end. */
  outcome?: { at: When; label: string; icon?: IconName };
  /** Touches older than this, counted back from the outcome, get no credit and are drawn hollow. */
  lookbackDays?: number;
  /** compact: the strip alone (a table row, a drawer). full: the strip and the touches listed under it. */
  variant?: 'compact' | 'full';
  channelLabel?: (channel: string) => string;
  locale?: string;
}
const NODE_GAP = 26;
// Two marked touches side by side need room for both words ("First", "Last") above them.
const FLAG_GAP = 46;
const marked = (role: TouchRole) => role === 'first' || role === 'last' || role === 'only';
const rolePill: Partial<Record<TouchRole, string>> = { first: 'First touch', last: 'Last touch', only: 'Only touch', outside: 'Outside the window' };
/** One person's touches on a time axis: each in its channel's colour, the first, last and assisting touches marked,
 *  the lookback window shaded and the outcome at the end. Close touches are spread so none hides another. */
export function JourneyStrip({ label, touches, outcome, lookbackDays, variant = 'full', channelLabel = channelName, locale = 'en', className, ...props }: JourneyStripProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const dates = shortDate(locale);
  const plan = useMemo(() => {
    const sorted = touches.map(t => ({ ...t, t: time(t.at) })).filter(t => Number.isFinite(t.t)).sort((a, b) => a.t - b.t);
    if (sorted.length !== touches.length) reportContentProblem('JourneyStrip: a touch has no readable date.');
    const end = outcome ? time(outcome.at) : sorted.length ? sorted[sorted.length - 1].t : Date.now();
    const windowStart = lookbackDays ? end - lookbackDays * DAY : -Infinity;
    const start = Math.min(sorted.length ? sorted[0].t : end, Number.isFinite(windowStart) ? windowStart : end);
    const span = Math.max(end - start, DAY);
    const inside = sorted.filter(t => t.t >= windowStart && t.t <= end);
    const roleOf = (t: typeof sorted[number]): TouchRole => t.role ?? (!inside.includes(t) ? 'outside' : inside.length === 1 ? 'only'
      : t === inside[0] ? 'first' : t === inside[inside.length - 1] ? 'last' : 'assist');
    return { start, end, span, windowStart, nodes: sorted.map(t => ({ ...t, role: roleOf(t), frac: (t.t - start) / span })) };
  }, [touches, outcome, lookbackDays]);
  // Positions in pixels once the strip is measured, spread so close touches stay apart; fractions until then.
  const pad = 14, right = outcome ? 30 : pad;
  const xs = useMemo(() => {
    if (!width) return null;
    const usable = width - pad - right;
    const at = plan.nodes.map(n => pad + n.frac * usable);
    const gap = (i: number) => marked(plan.nodes[i].role) && marked(plan.nodes[i - 1].role) ? FLAG_GAP : NODE_GAP;
    for (let i = 1; i < at.length; i++) at[i] = Math.max(at[i], at[i - 1] + gap(i));
    const limit = outcome ? width - right - NODE_GAP : width - pad;
    for (let i = at.length - 1; i >= 0; i--) at[i] = Math.min(at[i], i === at.length - 1 ? limit : at[i + 1] - gap(i + 1));
    return at.map(x => Math.max(pad, x));
  }, [width, plan, outcome, right]);
  const left = (i: number, frac: number) => xs ? `${xs[i]}px` : `calc(${pad}px + ${frac} * (100% - ${pad + right}px))`;
  const windowFrac = Number.isFinite(plan.windowStart) ? (plan.windowStart - plan.start) / plan.span : null;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-journey-strip', className)} data-variant={variant}>
    <div ref={ref} className="easm-ui-journey-axis">
      {windowFrac !== null ? <span className="easm-ui-journey-window" style={{ left: `calc(${pad}px + ${windowFrac} * (100% - ${pad + right}px))` }}>
        <span>{lookbackDays}-day lookback</span></span> : null}
      <i className="easm-ui-journey-line" aria-hidden="true" />
      <ol className="easm-ui-journey-nodes">
        {plan.nodes.map((n, i) => {
          const words = `${channelLabel(n.channel)}, ${n.label}, ${dates.format(n.t)}: ${roleWords[n.role]}`;
          return <li key={n.id} data-role={n.role} style={{ left: left(i, n.frac), ...toneStyle(channelTone(n.channel)) }}>
            {marked(n.role) ? <span className="easm-ui-journey-flag" aria-hidden="true">{n.role === 'only' ? 'Only' : n.role === 'first' ? 'First' : 'Last'}</span> : null}
            <Tooltip openOnClick trigger={<span className="easm-ui-journey-node" tabIndex={0} role="img" aria-label={words} />}>{words}</Tooltip>
          </li>;
        })}
      </ol>
      {outcome ? <span className="easm-ui-journey-outcome" title={outcome.label}><UIIcon name={outcome.icon ?? 'target'} size={16} /></span> : null}
      <span className="easm-ui-journey-dates" aria-hidden="true"><span>{dates.format(plan.start)}</span><span>{outcome ? `${outcome.label} · ` : ''}{dates.format(plan.end)}</span></span>
    </div>
    {variant === 'full' ? <ol className="easm-ui-journey-list">
      {plan.nodes.map(n => <li key={n.id} data-role={n.role}>
        <i className="easm-ui-credit-swatch" aria-hidden="true" style={{ background: mark(channelTone(n.channel)) }} />
        <span className="easm-ui-credit-touch"><strong>{n.label}</strong><span>{channelLabel(n.channel)} · {dates.format(n.t)}{n.detail ? ` · ${n.detail}` : ''}</span></span>
        {rolePill[n.role] ? <span className="easm-ui-journey-role">{rolePill[n.role]}</span> : <span className="easm-ui-sr-only">{roleWords[n.role]}</span>}
      </li>)}
      {outcome ? <li data-role="outcome"><UIIcon name={outcome.icon ?? 'target'} size={16} />
        <span className="easm-ui-credit-touch"><strong>{outcome.label}</strong><span>{dates.format(plan.end)}</span></span></li> : null}
    </ol> : null}
  </section>;
}

/* ------------------------------------------------------------------ TwoBandFunnel */

export interface BandStep {
  id: string;
  label: string;
  value: number | null;
  /** Why there is no figure, when value is null. */
  reason?: string;
  provenance?: Exclude<Provenance, 'unmeasured'>;
}
export interface FunnelBand {
  /** "Observation", "Lifecycle". */
  label: string;
  /** What it counts: "browsers", "people". */
  unit: string;
  steps: readonly BandStep[];
}
export interface TwoBandFunnelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  /** The website's band: it counts browsers. */
  observation: FunnelBand;
  /** The admissions band: it counts people. */
  lifecycle: FunnelBand;
  /** What the line between the bands carries: the identification rate the reporting engine measured. It is never
   *  worked out from the steps either side, which count different things. */
  boundary?: { label?: string; rate?: number | null; reason?: string };
  format?: (value: number) => string;
  locale?: string;
}
/** Two funnels and the line between them: browsers above, people below, each band scaled to its own first step,
 *  with what each step kept and lost. No rate is drawn across the line; it carries the identification rate. */
export function TwoBandFunnel({ label, observation, lifecycle, boundary, format, locale = 'en', className, ...props }: TwoBandFunnelProps) {
  const show = format ?? fullNumber(locale);
  const pct = (v: number) => `${v < .1 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;
  const band = (b: FunnelBand, kind: 'observation' | 'lifecycle') => {
    const top = Math.max(...b.steps.map(s => finite(s.value) ? s.value : 0), 0);
    return <section className="easm-ui-band" data-band={kind} aria-label={`${b.label}: counts ${b.unit}`}>
      <header className="easm-ui-band-head"><UIIcon name={kind === 'observation' ? 'globe' : 'people'} size={16} /><strong>{b.label}</strong><span>Counts {b.unit}</span></header>
      <ol className="easm-ui-band-steps">
        {b.steps.map((s, i) => {
          const prev = i > 0 ? b.steps[i - 1].value : null;
          const kept = finite(prev) && prev > 0 && finite(s.value) ? s.value / prev : null;
          return <li key={s.id} data-provenance={s.provenance}>
            {i > 0 ? <p className="easm-ui-band-loss">{kept === null ? <span>No rate: a step is not measured</span>
              : <><UIIcon name="arrow-down" size={16} /><strong>{pct(kept)}</strong> of the step before{(prev as number) > (s.value as number) ? <span>{show((prev as number) - (s.value as number))} fewer</span> : null}</>}</p> : null}
            <div className="easm-ui-band-row">
              <span className="easm-ui-band-label">{s.label}</span>
              <span className="easm-ui-band-value">{s.provenance ? <ProvenanceFigure label={s.label} value={s.value} provenance={s.provenance} reason={s.reason} format={show} size="sm" />
                : finite(s.value) ? show(s.value) : <UnmeasuredValue reason={s.reason ?? 'Not measured'} showWord />}</span>
              <span className="easm-ui-band-track" aria-hidden="true">{finite(s.value) && top > 0 ? <span style={{ width: `${Math.max((s.value / top) * 100, 1.5)}%` }} /> : null}</span>
            </div>
          </li>;
        })}
      </ol>
    </section>;
  };
  const rate = boundary?.rate;
  return <div {...props} role="group" aria-label={label} className={cx('easm-ui easm-ui-two-band', className)}>
    {band(observation, 'observation')}
    <div className="easm-ui-band-boundary" role="note">
      <i aria-hidden="true" />
      <span className="easm-ui-band-boundary-pill"><UIIcon name="fingerprint" size={16} />
        <span>{boundary?.label ?? 'Identified'}</span>
        <strong>{finite(rate) ? pct(rate) : <UnmeasuredValue reason={boundary?.reason ?? 'Identification is not measured'} />}</strong></span>
      <i aria-hidden="true" />
      <span className="easm-ui-band-boundary-note">{observation.unit} above, {lifecycle.unit} below: no rate crosses this line.</span>
    </div>
    {band(lifecycle, 'lifecycle')}
  </div>;
}

/* ------------------------------------------------------------------ ConnectionCard */

export type ConnectionCapabilityId = 'reporting' | 'conversions' | 'audiences';
export type ConnectionCapabilityStatus = 'on' | 'off' | 'unsupported' | 'attention' | 'error';
export interface ConnectionCapability {
  status: ConnectionCapabilityStatus;
  /** When the last import or send ran. */
  lastRunAt?: When | null;
  /** The newest day the provider's data covers. A run can succeed while this stays behind. */
  dataThrough?: When | null;
  /** One more line: "1,204 accepted in 7 days", "2 audiences". */
  detail?: ReactNode;
}
export type ConnectionState = 'connected' | 'expiring' | 'expired' | 'error' | 'disconnected';
const capabilityText: Record<ConnectionCapabilityId, { label: string; icon: IconName }> = {
  reporting: { label: 'Reporting', icon: 'data-area' }, conversions: { label: 'Conversions', icon: 'conversion' }, audiences: { label: 'Audience sync', icon: 'people-audience' },
};
const capabilityStatuses = defineStatuses({
  on: { label: 'On', glyph: 'state-done', tone: 'success' },
  off: { label: 'Off', glyph: 'state-paused', tone: 'neutral' },
  unsupported: { label: 'Not offered', glyph: 'authority-unmeasured', tone: 'neutral' },
  attention: { label: 'Needs attention', glyph: 'state-blocked', tone: 'warning' },
  error: { label: 'Failing', glyph: 'state-failed', tone: 'danger' },
  behind: { label: 'Data behind', glyph: 'history', tone: 'warning', description: 'It runs, but the newest data is old' },
});
const connectionStatuses = defineStatuses({
  connected: { label: 'Connected', glyph: 'state-live', tone: 'success' },
  expiring: { label: 'Expiring', glyph: 'state-expired', tone: 'warning' },
  expired: { label: 'Expired', glyph: 'state-expired', tone: 'danger' },
  error: { label: 'Failing', glyph: 'state-failed', tone: 'danger' },
  disconnected: { label: 'Not connected', glyph: 'plug-disconnected', tone: 'neutral' },
});
const ago = (ms: number) => ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60_000))} min ago` : ms < 2 * DAY ? `${Math.round(ms / 3_600_000)} h ago` : `${Math.round(ms / DAY)} days ago`;
export interface ConnectionCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  provider: BrandIconName;
  name: string;
  /** The ad account, pixel or stream: "Ad account act_1234 · Pixel 5678". */
  account?: ReactNode;
  state: ConnectionState;
  /** When the sign-in stops working. */
  expiresAt?: When | null;
  capabilities: Partial<Record<ConnectionCapabilityId, ConnectionCapability>>;
  /** How far behind the data may fall before it is called behind (default 48 hours). */
  staleAfterHours?: number;
  /** The time to measure from (tests, server rendering). */
  now?: When;
  actions?: ReactNode;
  locale?: string;
}
/** One ad platform connection: its sign-in, and reporting, conversions and audience sync each with its own state,
 *  when it last ran and how far its data reaches, so a successful run over stale data shows as behind. */
export function ConnectionCard({ provider, name, account, state, expiresAt, capabilities, staleAfterHours = 48, now, actions, locale = 'en', className, ...props }: ConnectionCardProps) {
  const at = now !== undefined ? time(now) : Date.now();
  const dates = shortDate(locale);
  const expires = expiresAt ? time(expiresAt) : null;
  const expiryLine = expires === null ? null : expires <= at ? <>Sign-in expired {dates.format(expires)}</>
    : <>Sign-in valid until {dates.format(expires)} <span className="easm-ui-nowrap">· {Math.ceil((expires - at) / DAY)} days left</span></>;
  return <article {...props} aria-label={`${name} connection`} className={cx('easm-ui easm-ui-connection', className)} data-state={state}>
    <header className="easm-ui-connection-head">
      <BrandIcon name={provider} appearance="tile" size={40} />
      <span className="easm-ui-connection-name"><strong>{name}</strong>{account ? <span>{account}</span> : null}</span>
      <StatusChip status={state} statuses={connectionStatuses} size="sm" />
    </header>
    <ul className="easm-ui-connection-capabilities">
      {(Object.keys(capabilityText) as ConnectionCapabilityId[]).map(id => {
        const c = capabilities[id] ?? { status: 'unsupported' as const };
        const ran = c.lastRunAt ? time(c.lastRunAt) : null;
        const through = c.dataThrough ? time(c.dataThrough) : null;
        const behind = through !== null && c.status !== 'off' && c.status !== 'unsupported' ? Math.floor((at - through) / DAY) : 0;
        const stale = through !== null && at - through > staleAfterHours * 3_600_000 && c.status !== 'off' && c.status !== 'unsupported';
        return <li key={id} data-status={c.status} data-stale={stale || undefined}>
          <span className="easm-ui-connection-cap-icon" aria-hidden="true"><UIIcon name={capabilityText[id].icon} size={20} /></span>
          <span className="easm-ui-connection-cap-main">
            <strong>{capabilityText[id].label}</strong>
            {c.status === 'unsupported' ? <span>{name} does not offer this</span> : null}
            {ran !== null || through !== null ? <span className="easm-ui-connection-times">
              {ran !== null ? <span>Last run {ago(Math.max(at - ran, 0))}</span> : null}
              {through !== null ? <span className="easm-ui-connection-through" data-stale={stale || undefined}>
                {stale ? <UIIcon name="warning" size={16} /> : null}Data through {dates.format(through)}{stale ? ` · ${behind} days behind` : ''}</span> : null}
            </span> : null}
            {c.detail ? <span>{c.detail}</span> : null}
          </span>
          <StatusChip status={stale && c.status === 'on' ? 'behind' : c.status} statuses={capabilityStatuses} size="sm" />
        </li>;
      })}
    </ul>
    {expiryLine || actions ? <footer className="easm-ui-connection-foot">
      {expiryLine ? <span data-expired={expires !== null && expires <= at || undefined}>{expiryLine}</span> : <span />}
      {actions ? <span className="easm-ui-connection-actions">{actions}</span> : null}
    </footer> : null}
  </article>;
}
