'use client';

// Support parts (demand list wave 4c, 2026-10-29): what a lead's profile holds and where each answer came from
// (CaptureGrid, C-SUP-08), a call campaign's funnel on one line (ConversionStrip, C-SUP-10), the pool of agents'
// extensions (ExtensionPool, C-SUP-12), the campus phone bridge (BridgeHealth, C-SUP-13) and where an applicant is
// (ApplicantStepper, C-SUP-14). Each replaces a table or a ring the dashboard drew for itself.
import { useId, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Avatar } from './utility';
import { cx, reportContentProblem, UIIcon, useControllableState } from './shared';
import { defineStatuses, StatusChip, UnmeasuredValue } from './workflow';

export const supportComponentNames = ['CaptureGrid', 'ConversionStrip', 'ExtensionPool', 'BridgeHealth', 'ApplicantStepper'] as const;

/* ------------------------------------------------------------------ CaptureGrid */

export type CaptureSource = 'chat' | 'whatsapp' | 'form' | 'call' | 'staff' | 'portal' | 'import';
const captureSources: Record<CaptureSource, { label: string; icon: IconName }> = {
  chat: { label: 'Chat', icon: 'chat' }, whatsapp: { label: 'WhatsApp', icon: 'chat-multiple' }, form: { label: 'Form', icon: 'lead-form' },
  call: { label: 'Call', icon: 'call' }, staff: { label: 'Staff', icon: 'user' }, portal: { label: 'Portal', icon: 'surface-portal' }, import: { label: 'Import', icon: 'arrow-download' },
};
export interface CaptureField {
  id: string;
  label: string;
  /** The answer; leave it out while nothing was captured. */
  value?: ReactNode;
  source?: CaptureSource;
  /** When it was captured ("12 Oct"). */
  at?: string;
}
export interface CaptureGridProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: string;
  fields: readonly CaptureField[];
}
/** A lead's profile as fields: what each holds, or that it is still missing, and where each answer came from (the
 *  chat, a form, a call, a member of staff). Replaces the capture ring, which said how much but not what. */
export function CaptureGrid({ title = 'Lead profile', fields, className, ...props }: CaptureGridProps) {
  const id = useId();
  const filled = fields.filter(f => f.value != null && f.value !== '').length;
  return <section {...props} aria-labelledby={`${id}-title`} className={cx('easm-ui easm-ui-capture', className)}>
    <header className="easm-ui-capture-head">
      <h3 id={`${id}-title`}>{title}</h3>
      <span className="easm-ui-capture-count">{filled} of {fields.length} captured</span>
      <span className="easm-ui-capture-pips" aria-hidden="true">{fields.map(f => <i key={f.id} data-on={f.value != null && f.value !== '' ? true : undefined} />)}</span>
    </header>
    <dl className="easm-ui-capture-grid">
      {fields.map(f => {
        const has = f.value != null && f.value !== '';
        const source = f.source ? captureSources[f.source] : undefined;
        return <div key={f.id} className="easm-ui-capture-field" data-empty={has ? undefined : true}>
          <dt>{f.label}</dt>
          <dd className="easm-ui-capture-value">{has ? f.value : 'Not captured yet'}</dd>
          {has && source ? <dd className="easm-ui-capture-source"><UIIcon name={source.icon} size={16} />From {source.label.toLowerCase() === 'whatsapp' ? 'WhatsApp' : source.label.toLowerCase()}{f.at ? ` · ${f.at}` : ''}</dd> : null}
        </div>;
      })}
    </dl>
  </section>;
}

/* ------------------------------------------------------------------ ConversionStrip */

export interface ConversionStep { id: string; label: string; value: number | null }
export interface ConversionStripProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  label: string;
  steps: readonly ConversionStep[];
  /** Opens the people at a step (the drill-down). */
  onSelect?: (id: string) => void;
  locale?: string;
}
/** A funnel on one line: each step's count, how much of the first step it is, and the rate from the step before.
 *  For a call campaign (listed, called, reached, qualified, counsellor reached, applied) where the tall Funnel does
 *  not fit. A step nobody measured shows as not measured, never as zero. */
export function ConversionStrip({ label, steps, onSelect, locale, className, ...props }: ConversionStripProps) {
  if (!label.trim()) reportContentProblem('ConversionStrip requires a meaningful label.');
  const first = steps[0]?.value ?? null;
  const rate = (a: number | null, b: number | null) => a && b != null ? Math.round((b / a) * 100) : null;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-conversion', className)}>
    <ol>
      {steps.map((step, i) => {
        const fromPrevious = i ? rate(steps[i - 1].value, step.value) : null;
        const share = first && step.value != null ? Math.max(2, Math.min(100, (step.value / first) * 100)) : 0;
        const body = <>
          <span className="easm-ui-conversion-label">{step.label}</span>
          <span className="easm-ui-conversion-value">{step.value == null ? <UnmeasuredValue reason="Not measured for this campaign" /> : step.value.toLocaleString(locale)}</span>
          <span className="easm-ui-conversion-bar" aria-hidden="true"><i style={{ inlineSize: `${share}%` }} /></span>
          <span className="easm-ui-conversion-rate">{i === 0 ? 'Start' : fromPrevious == null ? '—' : `${fromPrevious}% of ${steps[i - 1].label.toLowerCase()}`}</span>
        </>;
        return <li key={step.id}>
          {onSelect ? <button type="button" className="easm-ui-conversion-step" onClick={() => onSelect(step.id)}>{body}</button> : <span className="easm-ui-conversion-step">{body}</span>}
          {i < steps.length - 1 ? <UIIcon name="chevron-right" size={16} className="easm-ui-conversion-arrow" /> : null}
        </li>;
      })}
    </ol>
  </section>;
}

/* ------------------------------------------------------------------ ExtensionPool */

export type ExtensionState = 'registered' | 'signing-in' | 'signed-out' | 'refused';
export const extensionStates = defineStatuses({
  registered: { label: 'Signed in', glyph: 'state-live', tone: 'success', description: 'Rings when called' },
  'signing-in': { label: 'Signing in', glyph: 'state-processing', tone: 'brand' },
  'signed-out': { label: 'Not signed in', glyph: 'state-paused', tone: 'neutral', description: 'The phone or browser is closed' },
  refused: { label: 'Refused', glyph: 'state-blocked', tone: 'warning', description: 'The line refused its password' },
});
export interface PoolExtension {
  id: string;
  /** The extension number. */
  number: string;
  /** Whose it is; leave it out for an extension nobody has. */
  person?: { name: string; image?: string };
  state: ExtensionState;
  /** browser: the EASM Dialer; desk: a phone on the desk. */
  kind?: 'browser' | 'desk';
}
export interface ExtensionPoolProps extends HTMLAttributes<HTMLElement> {
  label: string;
  extensions: readonly PoolExtension[];
  /** Pick extensions for a bulk action (assign, release). */
  selectable?: boolean;
  selected?: readonly string[];
  defaultSelected?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
}
/** A line's extensions as cells: the number, whose it is (or that nobody has it), whether it is signed in, and
 *  whether it rings in the browser or on a desk phone. Picking cells offers a bulk action. Replaces the extensions table. */
export function ExtensionPool({ label, extensions, selectable, selected, defaultSelected = [], onSelectedChange, className, ...props }: ExtensionPoolProps) {
  const [picked, setPicked] = useControllableState<readonly string[]>(selected, defaultSelected, onSelectedChange as ((ids: readonly string[]) => void) | undefined);
  const free = extensions.filter(x => !x.person).length;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-extensions', className)}>
    <p className="easm-ui-extensions-summary">{extensions.length} extensions · {extensions.length - free} assigned · {free} free</p>
    <ul>
      {extensions.map(x => {
        const on = picked.includes(x.id);
        const cell = <>
          <span className="easm-ui-extension-number">{x.number}</span>
          <span className="easm-ui-extension-person">{x.person ? <><Avatar name={x.person.name} src={x.person.image} size="sm" decorative /><span>{x.person.name}</span></> : <><span className="easm-ui-extension-free" aria-hidden="true"><UIIcon name="user-add" size={16} /></span><span>Unassigned</span></>}</span>
          <span className="easm-ui-extension-meta"><StatusChip status={x.state} statuses={extensionStates} variant="dot" size="sm" />
            {x.kind ? <span className="easm-ui-extension-kind"><UIIcon name={x.kind === 'browser' ? 'headset' : 'call'} size={16} />{x.kind === 'browser' ? 'Browser' : 'Desk phone'}</span> : null}</span>
        </>;
        return <li key={x.id} data-free={x.person ? undefined : true} data-picked={on || undefined}>
          {selectable ? <label className="easm-ui-extension">
            <input type="checkbox" className="easm-ui-extension-check" checked={on} onChange={() => setPicked(on ? picked.filter(p => p !== x.id) : [...picked, x.id])}
              aria-label={`Extension ${x.number}, ${x.person ? x.person.name : 'unassigned'}, ${extensionStates[x.state].label.toLowerCase()}`} />
            {cell}</label> : <div className="easm-ui-extension">{cell}</div>}
        </li>;
      })}
    </ul>
  </section>;
}

/* ------------------------------------------------------------------ BridgeHealth */

export interface BridgeHealthProps extends HTMLAttributes<HTMLElement> {
  name: string;
  /** Seconds since its last heartbeat; null when it never reported. */
  heartbeatSeconds: number | null;
  revision: string;
  /** A newer revision this tenant's release carries, and where its update stands. */
  update?: { revision: string; state: 'available' | 'waiting' | 'installing' | 'rolled-back' };
  /** The campus lock: the address it reports and whether it is one of the campus's own. */
  campus?: { address: string; matches: boolean };
  callsInProgress?: number;
  actions?: ReactNode;
}
const bridgeStates = defineStatuses({
  online: { label: 'Online', glyph: 'state-live', tone: 'success' },
  late: { label: 'Late', glyph: 'clock', tone: 'warning', description: 'No heartbeat for over two minutes' },
  offline: { label: 'Offline', glyph: 'state-failed', tone: 'danger', description: 'No heartbeat for ten minutes' },
  never: { label: 'Never reported', glyph: 'state-paused', tone: 'neutral' },
});
const ago = (s: number) => s < 90 ? `${Math.max(1, Math.round(s))} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`;
const updateWords = { available: 'Update available', waiting: 'Waiting for no call', installing: 'Installing', 'rolled-back': 'Rolled back' } as const;
/** The phone bridge on campus: when it last reported, which revision it runs and whether an update waits, whether
 *  its internet address is the campus's (the lock that keeps the browser phone on campus) and the calls on it now. */
export function BridgeHealth({ name, heartbeatSeconds, revision, update, campus, callsInProgress, actions, className, ...props }: BridgeHealthProps) {
  const id = useId();
  const state = heartbeatSeconds == null ? 'never' : heartbeatSeconds > 600 ? 'offline' : heartbeatSeconds > 120 ? 'late' : 'online';
  return <article {...props} aria-labelledby={`${id}-name`} className={cx('easm-ui easm-ui-bridge', className)} data-state={state}>
    <header className="easm-ui-bridge-head">
      <span className="easm-ui-bridge-mark"><UIIcon name="bridge-appliance" size={24} /></span>
      <div className="easm-ui-bridge-title"><h3 id={`${id}-name`}>{name}</h3><span>Phone bridge</span></div>
      <StatusChip status={state} statuses={bridgeStates} size="sm" />
    </header>
    <dl className="easm-ui-bridge-facts">
      <div><dt>Last heartbeat</dt><dd>{heartbeatSeconds == null ? 'Never' : ago(heartbeatSeconds)}</dd></div>
      <div><dt>Revision</dt><dd>{revision}{update ? <span className="easm-ui-bridge-update" data-state={update.state}><UIIcon name={update.state === 'rolled-back' ? 'arrow-undo' : 'arrow-download'} size={16} />{updateWords[update.state]}: {update.revision}</span> : <span className="easm-ui-bridge-current">Up to date</span>}</dd></div>
      {campus ? <div><dt>Campus lock</dt><dd data-ok={campus.matches || undefined} data-lock=""><UIIcon name={campus.matches ? 'checkmark' : 'warning'} size={16} /><span>{campus.matches ? 'On the campus address' : 'Not a campus address'} · {campus.address}</span></dd></div> : null}
      {callsInProgress !== undefined ? <div><dt>Calls now</dt><dd>{callsInProgress}</dd></div> : null}
    </dl>
    {actions ? <footer className="easm-ui-bridge-actions">{actions}</footer> : null}
  </article>;
}

/* ------------------------------------------------------------------ ApplicantStepper */

export const applicantStages = [
  { id: 'inquiry', label: 'Inquiry', glyph: 'stage-inquiry' },
  { id: 'qualified', label: 'Qualified', glyph: 'stage-qualified' },
  { id: 'applied', label: 'Applied', glyph: 'stage-applied' },
  { id: 'admitted', label: 'Admitted', glyph: 'stage-admitted' },
  { id: 'enrolled', label: 'Enrolled', glyph: 'stage-enrolled' },
] as const satisfies readonly { id: string; label: string; glyph: IconName }[];
export type ApplicantStage = (typeof applicantStages)[number]['id'];
export const paymentStatuses = defineStatuses({
  none: { label: 'No payment yet', glyph: 'wallet', tone: 'neutral' },
  due: { label: 'Payment due', glyph: 'wallet', tone: 'warning' },
  overdue: { label: 'Payment overdue', glyph: 'state-expired', tone: 'warning' },
  paid: { label: 'Paid', glyph: 'state-done', tone: 'success' },
});
export interface ApplicantStepperProps extends HTMLAttributes<HTMLElement> {
  stage: ApplicantStage;
  /** Since when the applicant is at this stage ("since 12 Oct"). */
  since?: string;
  payment?: { status: keyof typeof paymentStatuses; detail?: string };
}
/** Where an applicant is, from inquiry to enrolled, small enough for the conversation's side panel: the reached
 *  stages checked, the current one in blue with its glyph and named with since when, and the fee payment beside it. */
export function ApplicantStepper({ stage, since, payment, className, ...props }: ApplicantStepperProps) {
  const at = applicantStages.findIndex(s => s.id === stage);
  const current = applicantStages[at];
  return <div {...props} className={cx('easm-ui easm-ui-applicant', className)}>
    <ol className="easm-ui-applicant-steps" aria-label={`Application: ${current.label}, step ${at + 1} of ${applicantStages.length}`}>
      {applicantStages.map((s, i) => <li key={s.id} data-state={i < at ? 'done' : i === at ? 'current' : 'todo'} title={s.label}>
        <span className="easm-ui-applicant-node">{i < at ? <UIIcon name="checkmark" size={16} /> : i === at ? <UIIcon name={s.glyph} size={16} /> : null}</span>
        <span className="easm-ui-sr-only">{s.label}{i < at ? ', done' : i === at ? ', current' : ''}</span>
      </li>)}
    </ol>
    <div className="easm-ui-applicant-now"><strong>{current.label}</strong>{since ? <span>{since}</span> : null}</div>
    {payment ? <StatusChip status={payment.status} statuses={paymentStatuses} size="sm" variant="row" detail={payment.detail} className="easm-ui-applicant-payment" /> : null}
  </div>;
}
