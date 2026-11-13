'use client';

// Admin console parts (demand list wave 4c, 2026-10-29): a person's access level as a ladder with what the next step
// adds (LevelLadder, C-SH-01), notifications as events against channels with the workspace's locks and quiet hours
// (NotificationMatrix, C-SH-03), and the systems registry as one hierarchy that says what stops before a disconnect
// (RegistryTree, C-SH-04).
import { useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button } from './actions';
import { Switch } from './inputs';
import { Tooltip } from './feedback';
import { cx, reportContentProblem, UIIcon } from './shared';
import { defineStatuses, StatusChip } from './workflow';

export const adminComponentNames = ['LevelLadder', 'NotificationMatrix', 'RegistryTree'] as const;

/* ------------------------------------------------------------------ LevelLadder */

export interface AccessLevelStep { id: string; /** The dashboard's own name (Viewer, Agent, Creator, Contributor…). */ name: string; /** What this level can do, in a line. */ does: string }
export interface LevelLadderProps extends HTMLAttributes<HTMLElement> {
  label: string;
  levels: readonly AccessLevelStep[];
  current: string;
}
const levelGlyphs: IconName[] = ['level-viewer', 'level-member', 'level-manager', 'level-administrator'];
/** Access levels as a ladder: the person's step lit, each level by the dashboard's own name, and what changes at the
 *  next step. For Users, Access profiles and the Microsoft group mapping. */
export function LevelLadder({ label, levels, current, className, ...props }: LevelLadderProps) {
  if (!levels.some(l => l.id === current)) reportContentProblem('LevelLadder: the current level is not one of the levels.');
  const at = Math.max(0, levels.findIndex(l => l.id === current));
  const next = levels[at + 1];
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-ladder', className)}>
    <ol style={{ ['--_steps' as string]: levels.length }}>
      {levels.map((level, i) => <li key={level.id} data-state={i < at ? 'below' : i === at ? 'current' : 'above'} style={{ ['--_step' as string]: i }} aria-current={i === at ? 'step' : undefined}>
        <span className="easm-ui-ladder-step"><UIIcon name={levelGlyphs[Math.min(i, levelGlyphs.length - 1)]} size={20} /><b>{level.name}</b></span>
        <span className="easm-ui-ladder-does">{level.does}</span>
      </li>)}
    </ol>
    <p className="easm-ui-ladder-next">{next ? <><UIIcon name="arrow-up" size={16} /><span>At the next step, <b>{next.name}</b>: {next.does}</span></> : <><UIIcon name="checkmark" size={16} /><span>The highest level: nothing more to add.</span></>}</p>
  </section>;
}

/* ------------------------------------------------------------------ NotificationMatrix */

export type NotifyChannel = 'bell' | 'email' | 'push';
const channelInfo: Record<NotifyChannel, { label: string; icon: IconName }> = { bell: { label: 'Bell', icon: 'notify-bell' }, email: { label: 'Email', icon: 'notify-email' }, push: { label: 'Push', icon: 'notify-push' } };
export interface NotifyEvent {
  id: string;
  label: string;
  description?: string;
  /** The group heading it sits under (Conversations, Calls, Forms…). */
  group?: string;
  value: Partial<Record<NotifyChannel, boolean>>;
  /** Channels the workspace decided for everyone, with why. */
  locked?: Partial<Record<NotifyChannel, string>>;
}
export interface NotificationMatrixProps extends Omit<HTMLAttributes<HTMLElement>, 'onToggle'> {
  label: string;
  events: readonly NotifyEvent[];
  channels?: readonly NotifyChannel[];
  onToggle?: (eventId: string, channel: NotifyChannel, on: boolean) => void;
  /** Quiet hours in 24-hour "HH:MM": email and push wait until they end; the bell still collects. */
  quietHours?: { from: string; to: string } | null;
}
const mins = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0); };
/** Notifications as a grid: events as rows (grouped), the bell, email and push as columns of switches, a lock where
 *  the workspace decided for everyone, and the quiet hours drawn across the day. Replaces Account → Notifications'
 *  table and the policy table in Admin. */
export function NotificationMatrix({ label, events, channels = ['bell', 'email', 'push'], onToggle, quietHours, className, ...props }: NotificationMatrixProps) {
  const groups = [...new Set(events.map(e => e.group ?? ''))];
  const quiet = quietHours ? (() => { const a = mins(quietHours.from), b = mins(quietHours.to); return a <= b ? [[a, b]] : [[a, 1440], [0, b]]; })() : [];
  return <section {...props} className={cx('easm-ui easm-ui-notify-matrix', className)}>
    {quietHours ? <div className="easm-ui-notify-quiet">
      <span className="easm-ui-notify-quiet-words"><UIIcon name="quiet-hours" size={16} />Quiet {quietHours.from}–{quietHours.to}: email and push wait until it ends; the bell still collects.</span>
      <span className="easm-ui-notify-quiet-day" aria-hidden="true">{quiet.map(([a, b], i) => <i key={i} style={{ insetInlineStart: `${(a / 1440) * 100}%`, inlineSize: `${((b - a) / 1440) * 100}%` }} />)}
        {[0, 6, 12, 18, 24].map(h => <span key={h} style={{ insetInlineStart: `${(h / 24) * 100}%` }}>{String(h).padStart(2, '0')}</span>)}</span>
    </div> : null}
    <div className="easm-ui-notify-scroll" role="region" aria-label={label} tabIndex={0}>
      <table>
        <caption className="easm-ui-sr-only">{label}</caption>
        <thead><tr><th scope="col">Event</th>{channels.map(c => <th key={c} scope="col"><span className="easm-ui-notify-channel"><UIIcon name={channelInfo[c].icon} size={16} />{channelInfo[c].label}</span></th>)}</tr></thead>
        {groups.map(group => <tbody key={group || 'all'}>
          {group ? <tr className="easm-ui-notify-group"><th scope="rowgroup" colSpan={channels.length + 1}>{group}</th></tr> : null}
          {events.filter(e => (e.group ?? '') === group).map(event => <tr key={event.id}>
            <th scope="row"><span className="easm-ui-notify-event">{event.label}</span>{event.description ? <span className="easm-ui-notify-description">{event.description}</span> : null}</th>
            {channels.map(c => {
              const on = !!event.value[c], lock = event.locked?.[c];
              return <td key={c} data-locked={lock ? true : undefined}>{lock
                ? <Tooltip trigger={<span className="easm-ui-notify-lock" tabIndex={0} aria-label={`${channelInfo[c].label} for ${event.label}: ${on ? 'on' : 'off'}, locked by your workspace. ${lock}`}>
                  <UIIcon name="lock-closed" size={16} />{on ? 'On' : 'Off'}</span>}>{`Locked by your workspace: ${lock}`}</Tooltip>
                : <Switch label={`${channelInfo[c].label} for ${event.label}`} hideLabel size="sm" checked={on} onCheckedChange={next => onToggle?.(event.id, c, next)} disabled={!onToggle} />}</td>;
            })}
          </tr>)}
        </tbody>)}
      </table>
    </div>
  </section>;
}

/* ------------------------------------------------------------------ RegistryTree */

export type RegistryKind = 'system' | 'connection' | 'resource' | 'use';
export const registryStates = defineStatuses({
  ok: { label: 'Working', glyph: 'state-live', tone: 'success' },
  attention: { label: 'Needs attention', glyph: 'state-blocked', tone: 'warning' },
  expiring: { label: 'Expiring', glyph: 'state-expired', tone: 'warning', description: 'Its secret or token runs out soon' },
  off: { label: 'Off', glyph: 'state-paused', tone: 'neutral' },
  failing: { label: 'Failing', glyph: 'state-failed', tone: 'danger' },
});
export interface RegistryNode {
  id: string;
  kind: RegistryKind;
  label: string;
  detail?: ReactNode;
  state?: keyof typeof registryStates;
  /** Shown as EASM's, with no editor (PeopleSoft, the platform app). */
  managedByEasm?: boolean;
  children?: readonly RegistryNode[];
}
export interface RegistryTreeProps extends HTMLAttributes<HTMLElement> {
  label: string;
  systems: readonly RegistryNode[];
  /** Disconnecting a connection: shown with the uses that would stop, then confirmed. */
  onDisconnect?: (connectionId: string) => void;
}
const kindGlyph: Record<RegistryKind, IconName> = { system: 'system', connection: 'system-connection', resource: 'system-resource', use: 'system-use' };
const kindWord: Record<RegistryKind, string> = { system: 'System', connection: 'Connection', resource: 'Resource', use: 'Use' };
const usesUnder = (node: RegistryNode): RegistryNode[] => (node.children ?? []).flatMap(c => c.kind === 'use' ? [c] : usesUnder(c));
/** Every outside system as one hierarchy: the system, its connections, what each reaches and which feature uses it,
 *  with a state at every level. Disconnecting a connection first lists what would stop. Replaces the flat lists on
 *  the Admin systems pages. */
export function RegistryTree({ label, systems, onDisconnect, className, ...props }: RegistryTreeProps) {
  const id = useId();
  const [confirming, setConfirming] = useState<string | null>(null);
  const render = (nodes: readonly RegistryNode[], level: number): ReactNode => <ul className="easm-ui-registry-level" data-level={level}>
    {nodes.map(node => {
      const stops = node.kind === 'connection' ? usesUnder(node) : [];
      return <li key={node.id} data-kind={node.kind}>
        <div className="easm-ui-registry-row">
          <span className="easm-ui-registry-icon"><UIIcon name={kindGlyph[node.kind]} size={node.kind === 'system' ? 20 : 16} /></span>
          <span className="easm-ui-registry-name"><span className="easm-ui-sr-only">{kindWord[node.kind]}: </span>{node.label}
            {node.managedByEasm ? <span className="easm-ui-registry-easm">Managed by EASM</span> : null}
            {node.detail ? <span className="easm-ui-registry-detail">{node.detail}</span> : null}</span>
          {node.state ? <StatusChip status={node.state} statuses={registryStates} size="sm" /> : null}
          {node.kind === 'connection' && onDisconnect && !node.managedByEasm && confirming !== node.id
            ? <Button size="sm" variant="secondary" leadingIcon="plug-disconnected" onClick={() => setConfirming(node.id)} aria-describedby={`${id}-${node.id}-stops`}>Disconnect</Button> : null}
        </div>
        {confirming === node.id ? <div className="easm-ui-registry-confirm" role="group" aria-label={`Disconnect ${node.label}`}>
          <p id={`${id}-${node.id}-stops`}>{stops.length ? <>These stop working when it is disconnected:</> : <>Nothing uses this connection; disconnecting it stops nothing.</>}</p>
          {stops.length ? <ul>{stops.map(u => <li key={u.id}><UIIcon name="system-use" size={16} />{u.label}</li>)}</ul> : null}
          <div className="easm-ui-registry-confirm-actions">
            <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>Keep it</Button>
            <Button size="sm" variant="secondary" leadingIcon="plug-disconnected" onClick={() => { setConfirming(null); onDisconnect?.(node.id); }}>Disconnect{stops.length ? ` and stop ${stops.length}` : ''}</Button>
          </div>
        </div> : null}
        {node.children?.length ? render(node.children, level + 1) : null}
      </li>;
    })}
  </ul>;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-registry', className)}>{render(systems, 1)}</section>;
}
