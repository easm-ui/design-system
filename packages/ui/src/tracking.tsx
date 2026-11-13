'use client';

// Marketing's collection and delivery, drawn as they work (demand list wave 4c, 2026-10-29): the four gates every
// event passes with what each refused and why (GatePipeline, C-MKT-05), which business signal goes to which
// destination as which provider event (RoutingMatrix, C-MKT-06), and the conversion outbox as its delivery states
// (OutboxBoard, C-MKT-07).
import { useId, type HTMLAttributes, type ReactNode } from 'react';
import type { BrandIconName, IconName } from '@easm-ui/icons';
import { BrandIcon } from '@easm-ui/icons/brand-icon';
import { Button } from './actions';
import { cx, reportContentProblem, UIIcon } from './shared';
import { defineStatuses, StatusChip } from './workflow';
import { deliveryStatuses } from './roles';

export const trackingComponentNames = ['GatePipeline', 'RoutingMatrix', 'OutboxBoard'] as const;

/* ------------------------------------------------------------------ GatePipeline */

export interface CollectionGate {
  id: 'contract' | 'authority' | 'consent' | 'dedup' | (string & {});
  label: string;
  /** Events this gate refused. */
  refused: number;
  /** The reason most of them were refused. */
  topReason?: { label: string; count: number };
}
const gateGlyphs: Record<string, IconName> = { contract: 'gate-contract', authority: 'gate-authority', consent: 'gate-consent', dedup: 'gate-dedup' };
export interface GatePipelineProps extends HTMLAttributes<HTMLElement> {
  label: string;
  received: number;
  gates: readonly CollectionGate[];
  locale?: string;
}
/** The path every collected event takes: how many arrived, what each gate (contract, authority, consent,
 *  duplicates) let through and refused with its top reason, and how many were accepted at the end. Replaces the
 *  "1 · … 4 ·" figures on Tracking health. */
export function GatePipeline({ label, received, gates, locale, className, ...props }: GatePipelineProps) {
  const f = (n: number) => n.toLocaleString(locale);
  let left = received;
  const steps = gates.map(gate => { const into = left; left = Math.max(0, left - gate.refused); return { gate, into, out: left }; });
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-gates', className)}>
    <ol style={{ ['--_steps' as string]: gates.length + 2 }}>
      <li className="easm-ui-gate-end"><span className="easm-ui-gate-label">Received</span><span className="easm-ui-gate-count">{f(received)}</span></li>
      {steps.map(({ gate, into, out }) => <li key={gate.id} className="easm-ui-gate">
        <span className="easm-ui-gate-icon"><UIIcon name={gateGlyphs[gate.id] ?? 'filter'} size={20} /></span>
        <span className="easm-ui-gate-label">{gate.label}</span>
        <span className="easm-ui-gate-count">{f(out)}<span className="easm-ui-sr-only"> passed of {f(into)}</span></span>
        <span className="easm-ui-gate-refused" data-none={gate.refused ? undefined : true}>{gate.refused ? `${f(gate.refused)} refused` : 'None refused'}</span>
        {gate.topReason && gate.refused ? <span className="easm-ui-gate-reason">Mostly: {gate.topReason.label} ({f(gate.topReason.count)})</span> : null}
      </li>)}
      <li className="easm-ui-gate-end" data-final=""><span className="easm-ui-gate-label">Accepted</span><span className="easm-ui-gate-count">{f(left)}</span>
        <span className="easm-ui-gate-reason">{received ? `${Math.round((left / received) * 100)}% of what arrived` : 'Nothing arrived'}</span></li>
    </ol>
  </section>;
}

/* ------------------------------------------------------------------ RoutingMatrix */

export const routingStates = defineStatuses({
  mapped: { label: 'Mapped', glyph: 'state-live', tone: 'success', description: 'Sent as this provider event' },
  missing: { label: 'Not mapped', glyph: 'state-draft', tone: 'neutral', description: 'This signal is not sent here' },
  blocked: { label: 'Blocked', glyph: 'state-blocked', tone: 'warning', description: 'Mapped, but the connection cannot send it' },
  off: { label: 'Switched off', glyph: 'state-paused', tone: 'neutral' },
});
export interface RoutingDestination { id: string; label: string; brand?: BrandIconName; /** The connection's own state, said under its name. */ note?: string }
export interface RoutingCell { event?: string; state: keyof typeof routingStates; reason?: string }
export interface RoutingSignal { id: string; label: string; description?: string; cells: Readonly<Record<string, RoutingCell>> }
export interface RoutingMatrixProps extends HTMLAttributes<HTMLElement> {
  label: string;
  destinations: readonly RoutingDestination[];
  signals: readonly RoutingSignal[];
  /** Opens one mapping to change it. */
  onCellSelect?: (signalId: string, destinationId: string) => void;
}
/** Which business signal goes where: signals as rows, destinations as columns, and in each cell the provider event it
 *  is sent as and whether that works (mapped, not mapped, blocked by the connection, switched off). Replaces the
 *  connector routing matrix and the event contract table. */
export function RoutingMatrix({ label, destinations, signals, onCellSelect, className, ...props }: RoutingMatrixProps) {
  return <section {...props} className={cx('easm-ui easm-ui-routing', className)}>
    <div className="easm-ui-routing-scroll" tabIndex={0} role="region" aria-label={label}>
      <table>
        <caption className="easm-ui-sr-only">{label}</caption>
        <thead><tr><th scope="col">Signal</th>{destinations.map(d => <th key={d.id} scope="col">
          <span className="easm-ui-routing-dest">{d.brand ? <BrandIcon name={d.brand} appearance="glyph" size={16} /> : null}{d.label}</span>
          {d.note ? <span className="easm-ui-routing-note">{d.note}</span> : null}</th>)}</tr></thead>
        <tbody>{signals.map(signal => <tr key={signal.id}>
          <th scope="row"><span className="easm-ui-routing-signal">{signal.label}</span>{signal.description ? <span className="easm-ui-routing-note">{signal.description}</span> : null}</th>
          {destinations.map(d => {
            const cell = signal.cells[d.id] ?? { state: 'missing' as const };
            const body = <>
              <StatusChip status={cell.state} statuses={routingStates} variant="dot" size="sm" />
              <span className="easm-ui-routing-cell-text">{cell.event ? <code>{cell.event}</code> : <span className="easm-ui-routing-none">{routingStates[cell.state].label}</span>}
                {cell.reason ? <span className="easm-ui-routing-reason">{cell.reason}</span> : null}</span>
            </>;
            return <td key={d.id} data-state={cell.state}>{onCellSelect
              ? <button type="button" className="easm-ui-routing-cell" aria-label={`${signal.label} to ${d.label}: ${cell.event ? `${cell.event}, ` : ''}${routingStates[cell.state].label}${cell.reason ? `, ${cell.reason}` : ''}`} onClick={() => onCellSelect(signal.id, d.id)}>{body}</button>
              : <span className="easm-ui-routing-cell">{body}</span>}</td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

/* ------------------------------------------------------------------ OutboxBoard */

export type OutboxState = keyof typeof deliveryStatuses;
export interface OutboxItem { id: string; title: ReactNode; destination?: string; at?: string; attempts?: number; reason?: string }
export interface OutboxColumn { state: OutboxState; count: number; items?: readonly OutboxItem[]; /** Why items are here, tallied (held back: no consent, withdrawn…). */ reasons?: readonly { label: string; count: number }[] }
export interface OutboxBoardProps extends HTMLAttributes<HTMLElement> {
  label: string;
  columns: readonly OutboxColumn[];
  /** Sends a dead-lettered item again. */
  onRetry?: (id: string) => void;
  onOpen?: (id: string) => void;
  locale?: string;
}
/** The conversion outbox as its delivery states, side by side: queued, accepted (the provider took it, nothing more),
 *  matched, held back for want of consent, and not delivered; each with its count, its latest items and, where it
 *  matters, why. A dead-lettered item can be sent again. Replaces the filter-chip view of Conversions. */
export function OutboxBoard({ label, columns, onRetry, onOpen, locale, className, ...props }: OutboxBoardProps) {
  if (!columns.length) reportContentProblem('OutboxBoard requires columns.');
  const id = useId();
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-outbox', className)}>
    <div className="easm-ui-outbox-columns">
      {columns.map(col => {
        const spec = deliveryStatuses[col.state];
        return <section key={col.state} className="easm-ui-outbox-column" aria-labelledby={`${id}-${col.state}`} data-easm-tone={spec.tone}>
          <header className="easm-ui-outbox-head">
            <StatusChip status={col.state} statuses={deliveryStatuses} size="sm" id={`${id}-${col.state}`} />
            <span className="easm-ui-outbox-count">{col.count.toLocaleString(locale)}</span>
          </header>
          {spec.description ? <p className="easm-ui-outbox-means">{spec.description}</p> : null}
          {col.reasons?.length ? <ul className="easm-ui-outbox-reasons" aria-label="Why">{col.reasons.map(r => <li key={r.label}><span>{r.label}</span><b>{r.count.toLocaleString(locale)}</b></li>)}</ul> : null}
          {col.items?.length ? <ul className="easm-ui-outbox-items">{col.items.map(item => <li key={item.id} className="easm-ui-outbox-item">
            {onOpen ? <button type="button" className="easm-ui-outbox-title" onClick={() => onOpen(item.id)}>{item.title}</button> : <span className="easm-ui-outbox-title">{item.title}</span>}
            <span className="easm-ui-outbox-meta">{[item.destination, item.at, item.attempts ? `${item.attempts} ${item.attempts === 1 ? 'attempt' : 'attempts'}` : ''].filter(Boolean).join(' · ')}</span>
            {item.reason ? <span className="easm-ui-outbox-reason">{item.reason}</span> : null}
            {col.state === 'dead-letter' && onRetry ? <Button size="sm" variant="secondary" leadingIcon="arrow-clockwise" onClick={() => onRetry(item.id)} className="easm-ui-outbox-retry">Send again</Button> : null}
          </li>)}</ul> : col.reasons?.length ? null : <p className="easm-ui-outbox-empty">{col.count ? 'None of the latest to show.' : 'Nothing here.'}</p>}
          {col.items && col.count > col.items.length ? <p className="easm-ui-outbox-more">and {(col.count - col.items.length).toLocaleString(locale)} more</p> : null}
        </section>;
      })}
    </div>
  </section>;
}
