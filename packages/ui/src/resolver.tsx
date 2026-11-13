'use client';

// Automation's runtime parts (demand list wave 4c, 2026-10-29): what the assistant may call on a turn and why
// (ResolverResult, C-AUT-05), the checks a pilot tool must pass before everyone gets it, with an audited way past them
// (GoLiveGate, C-AUT-06), and one logged call with who made it, how it ended and how long it took (ToolCallRow,
// C-AUT-07).
import { useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button } from './actions';
import { TextArea } from './inputs';
import { cx, reportContentProblem, UIIcon } from './shared';
import { defineStatuses, IdentityLevel, ReadinessChecklist, StatusChip, type IdentityLevelName, type ReadinessItem } from './workflow';

export const resolverComponentNames = ['ResolverResult', 'GoLiveGate', 'ToolCallRow'] as const;

/* ------------------------------------------------------------------ ResolverResult */

export interface ResolverTool { id: string; label: string; reason: string; builtin?: boolean }
export interface ResolverRule { id: string; label: string; builtin?: boolean; /** The exact words the assistant is given. */ wording?: string }
export interface ResolverResultProps extends HTMLAttributes<HTMLElement> {
  mustUse: readonly ResolverTool[];
  mayUse: readonly ResolverTool[];
  leftOut: readonly ResolverTool[];
  rules?: readonly ResolverRule[];
}
const columns = [
  { key: 'mustUse', title: 'Must use', glyph: 'state-done' as IconName, tone: 'blue', empty: 'Nothing is required this turn.' },
  { key: 'mayUse', title: 'May use', glyph: 'tool-call' as IconName, tone: 'teal', empty: 'Nothing else is offered.' },
  { key: 'leftOut', title: 'Left out', glyph: 'state-paused' as IconName, tone: 'honey', empty: 'Nothing was left out.' },
] as const;
/** What the assistant gets on one turn: the tools it must use, may use and was not given, each with the reason in one
 *  line, and the rules applied, whose exact wording opens on request. Replaces the lists of the resolver preview. */
export function ResolverResult({ mustUse, mayUse, leftOut, rules, className, ...props }: ResolverResultProps) {
  const lists = { mustUse, mayUse, leftOut };
  return <section {...props} className={cx('easm-ui easm-ui-resolver', className)}>
    <div className="easm-ui-resolver-columns">
      {columns.map(col => {
        const tools = lists[col.key];
        return <section key={col.key} className="easm-ui-resolver-column" data-easm-tone={col.tone} aria-label={`${col.title}: ${tools.length}`}>
          <h4><UIIcon name={col.glyph} size={16} />{col.title}<span>{tools.length}</span></h4>
          {tools.length ? <ul>{tools.map(tool => <li key={tool.id}>
            <span className="easm-ui-resolver-tool"><UIIcon name={tool.builtin ? 'tool-builtin' : 'tool-added'} size={16} />{tool.label}</span>
            <span className="easm-ui-resolver-reason">{tool.reason}</span>
          </li>)}</ul> : <p className="easm-ui-resolver-empty">{col.empty}</p>}
        </section>;
      })}
    </div>
    {rules?.length ? <section className="easm-ui-resolver-rules" aria-label="Rules applied">
      <h4>Rules applied<span>{rules.length}</span></h4>
      <ul>{rules.map(rule => <li key={rule.id}>
        <span className="easm-ui-resolver-rule"><UIIcon name={rule.builtin ? 'rule-builtin' : 'trigger-always'} size={16} /><span>{rule.label}{rule.builtin ? <span className="easm-ui-resolver-builtin">Built in</span> : null}</span></span>
        {rule.wording ? <details className="easm-ui-resolver-wording"><summary>Show the exact wording</summary><p>{rule.wording}</p></details> : null}
      </li>)}</ul>
    </section> : null}
  </section>;
}

/* ------------------------------------------------------------------ GoLiveGate */

export interface GoLiveGateProps extends HTMLAttributes<HTMLElement> {
  tool: string;
  /** The tool's checks: a successful test on this revision, a pilot sample, no untested changes. */
  checks: readonly ReadinessItem[];
  onGoLive: () => void;
  /** Going live past failing checks: the reason is recorded in the audit log with the person's name. */
  onGoLiveAnyway?: (reason: string) => void;
  busy?: boolean;
}
/** The checks a pilot tool must pass before everyone gets it, and Go live once they do. Past failing checks there is
 *  one way on: say why, and it is recorded. */
export function GoLiveGate({ tool, checks, onGoLive, onGoLiveAnyway, busy, className, ...props }: GoLiveGateProps) {
  const id = useId();
  const ready = checks.every(c => c.state === 'done');
  const [anyway, setAnyway] = useState(false);
  const [reason, setReason] = useState('');
  const enough = reason.trim().length >= 12;
  return <section {...props} aria-labelledby={`${id}-title`} className={cx('easm-ui easm-ui-golive', className)} data-ready={ready || undefined}>
    <header className="easm-ui-golive-head">
      <span className="easm-ui-golive-icon"><UIIcon name="go-live" size={20} /></span>
      <div><h3 id={`${id}-title`}>Go live: {tool}</h3><p>{ready ? 'Every check passed. Going live offers it to everyone it is meant for.' : 'It stays with its test users until these pass.'}</p></div>
    </header>
    <ReadinessChecklist title="Before it goes live" items={checks} />
    <footer className="easm-ui-golive-actions">
      <Button leadingIcon="go-live" onClick={onGoLive} disabled={!ready} loading={busy && ready}>Go live</Button>
      {!ready && onGoLiveAnyway && !anyway ? <Button variant="secondary" onClick={() => setAnyway(true)}>Go live anyway…</Button> : null}
    </footer>
    {!ready && onGoLiveAnyway && anyway ? <div className="easm-ui-golive-anyway">
      <TextArea label="Why it should go live without these checks" description="Recorded in the audit log with your name. At least a sentence." value={reason} rows={3}
        onChange={event => setReason(event.target.value)} required />
      <div className="easm-ui-golive-actions">
        <Button variant="secondary" onClick={() => { setAnyway(false); setReason(''); }}>Cancel</Button>
        <Button variant="secondary" leadingIcon="go-live" disabled={!enough} loading={busy} onClick={() => onGoLiveAnyway(reason.trim())}>Go live anyway</Button>
      </div>
    </div> : null}
  </section>;
}

/* ------------------------------------------------------------------ ToolCallRow */

export const toolCallOutcomes = defineStatuses({
  ok: { label: 'Answered', glyph: 'state-done', tone: 'success' },
  empty: { label: 'No records', glyph: 'result-no-record', tone: 'neutral', description: 'The system answered with nothing for this person' },
  'not-found': { label: 'Not found', glyph: 'result-not-found', tone: 'warning', description: 'The address does not exist (HTTP 404): often a typo in the path' },
  unmatched: { label: 'Fields unmatched', glyph: 'result-fields-unmatched', tone: 'warning', description: 'None of the chosen fields were in the answer; it went to the assistant unfiltered' },
  truncated: { label: 'Cut short', glyph: 'result-truncated', tone: 'neutral', description: 'The answer was longer than the assistant is given' },
  'service-down': { label: 'Service down', glyph: 'result-service-down', tone: 'danger', description: 'Calls are paused while the system recovers' },
  refused: { label: 'Refused', glyph: 'state-blocked', tone: 'warning', description: 'A check refused the call before it was sent' },
  error: { label: 'Failed', glyph: 'state-failed', tone: 'danger' },
});
export interface ToolCallRowProps extends HTMLAttributes<HTMLElement> {
  tool: string;
  builtin?: boolean;
  who: { name?: string; level: IdentityLevelName };
  outcome: keyof typeof toolCallOutcomes;
  durationMs: number;
  /** The time allowed (8 s by default); the bar is measured against it. */
  limitMs?: number;
  status?: number;
  at: string;
  /** Why it ended as it did, in words: opens under the row. */
  why?: ReactNode;
}
/** One logged tool call: how it ended, the tool, who asked and how sure we are of them, how long it took against the
 *  time allowed, the HTTP status and when; "Why this happened" opens under it. Replaces the call log's rows. */
export function ToolCallRow({ tool, builtin, who, outcome, durationMs, limitMs = 8000, status, at, why, className, ...props }: ToolCallRowProps) {
  if (!tool.trim()) reportContentProblem('ToolCallRow requires the tool name.');
  const id = useId();
  const [open, setOpen] = useState(false);
  const share = Math.max(2, Math.min(100, (durationMs / limitMs) * 100));
  const seconds = durationMs < 1000 ? `${Math.round(durationMs)} ms` : `${(durationMs / 1000).toFixed(1)} s`;
  return <article {...props} className={cx('easm-ui easm-ui-tool-call', className)} data-open={open || undefined} aria-labelledby={`${id}-tool`}>
    <div className="easm-ui-tool-call-row">
      <StatusChip status={outcome} statuses={toolCallOutcomes} variant="dot" size="sm" />
      <span className="easm-ui-tool-call-name"><span id={`${id}-tool`}><UIIcon name={builtin ? 'tool-builtin' : 'tool-added'} size={16} />{tool}</span>
        <span className="easm-ui-tool-call-who">{who.name ?? 'Someone'}<IdentityLevel level={who.level} variant="compact" /></span></span>
      <span className="easm-ui-tool-call-time" data-slow={durationMs > limitMs * .75 || undefined}>
        <span className="easm-ui-tool-call-bar" aria-hidden="true"><i style={{ inlineSize: `${share}%` }} /></span>{seconds}</span>
      <span className="easm-ui-tool-call-status">{status ? `HTTP ${status}` : '—'}</span>
      <span className="easm-ui-tool-call-at">{at}</span>
      {why ? <button type="button" className="easm-ui-tool-call-why" aria-expanded={open} aria-controls={`${id}-why`} onClick={() => setOpen(!open)}>
        <UIIcon name="chevron-down" size={16} /><span>Why this happened</span></button> : null}
    </div>
    {why && open ? <div className="easm-ui-tool-call-detail" id={`${id}-why`}><p><b>{toolCallOutcomes[outcome].label}.</b> {why}</p></div> : null}
  </article>;
}
