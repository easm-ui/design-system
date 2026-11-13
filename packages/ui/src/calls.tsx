'use client';

// Calling parts the Support desk built twice (demand list wave 2, C-SUP-01…06): the round call buttons and the
// keypad, the in-call bar in a docked and a page size, a call row's meta line, the transcript, the call result and
// the compact event row of a conversation. The Dialer page and the corner card both draw from these, so the two
// cannot drift again.
import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { cx, reportContentProblem, UIIcon } from './shared';
import { StatusChip, type StatusSpec, type StatusTone } from './workflow';

/* ------------------------------------------------------------------ CallButton */

export type CallAction = 'call' | 'answer' | 'decline' | 'hangup' | 'mute' | 'hold' | 'transfer' | 'keypad' | 'record' | 'speaker';
const actions: Record<CallAction, { label: string; icon: IconName; kind: 'go' | 'stop' | 'toggle' | 'plain' }> = {
  call: { label: 'Call', icon: 'call', kind: 'go' },
  answer: { label: 'Answer', icon: 'call', kind: 'go' },
  decline: { label: 'Decline', icon: 'call-end', kind: 'stop' },
  hangup: { label: 'Hang up', icon: 'call-end', kind: 'stop' },
  mute: { label: 'Mute', icon: 'voice', kind: 'toggle' },
  hold: { label: 'Hold', icon: 'pause', kind: 'toggle' },
  transfer: { label: 'Transfer', icon: 'call-transfer', kind: 'plain' },
  keypad: { label: 'Keypad', icon: 'keypad', kind: 'toggle' },
  record: { label: 'Record', icon: 'recording', kind: 'toggle' },
  speaker: { label: 'Speaker', icon: 'speaker-volume', kind: 'toggle' },
};
export interface CallButtonProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  action: CallAction;
  /** For mute, hold, keypad, record and speaker: whether it is on. */
  pressed?: boolean;
  disabled?: boolean;
  /** Work under way (connecting, transferring): the button waits and says so. */
  loading?: boolean;
  /** md 48 px (a docked card), lg 64 px (the Dialer page). */
  size?: 'md' | 'lg';
  /** The word under the button; defaults to the action's own ("Hang up"). */
  label?: string;
  /** Hide the word for a tight row; it stays the button's name. */
  hideLabel?: boolean;
}
/** One round call control. Call and Answer are green, Hang up and Decline red, the rest quiet; a control that is
 *  on (muted, on hold, recording) turns dark, and its word stays the same so the row never re-flows. */
export function CallButton({ action, pressed, disabled = false, loading = false, size = 'md', label, hideLabel = false, className, onClick, ...props }: CallButtonProps) {
  const spec = actions[action];
  const word = label ?? spec.label;
  const icon: IconName = action === 'mute' && pressed ? 'mic-off' : spec.icon;
  return <button {...props} type="button" className={cx('easm-ui easm-ui-call-button', className)} data-kind={spec.kind} data-size={size}
    data-on={pressed || undefined} aria-pressed={spec.kind === 'toggle' ? !!pressed : undefined} aria-label={hideLabel ? word : undefined}
    aria-busy={loading || undefined} aria-disabled={disabled || loading || undefined} onClick={event => { if (disabled || loading) { event.preventDefault(); return; } onClick?.(event); }}>
    <span className="easm-ui-call-button-face" aria-hidden="true">
      {loading ? <UIIcon name="spinner" size={size === 'lg' ? 24 : 20} data-motion="spin" data-active="true" data-repeat="true" /> : <UIIcon name={icon} size={size === 'lg' ? 24 : 20} />}
    </span>
    {hideLabel ? null : <span className="easm-ui-call-button-label">{word}</span>}
  </button>;
}
export interface CallControlsProps extends HTMLAttributes<HTMLDivElement> { label?: string; children: ReactNode }
/** A row of CallButtons, named as a group. */
export function CallControls({ label = 'Call controls', className, children, ...props }: CallControlsProps) {
  return <div {...props} role="group" aria-label={label} className={cx('easm-ui easm-ui-call-controls', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ Keypad */

const keys: readonly [string, string][] = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
export interface KeypadProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Called with each key: a digit, *, # or + (a long press on 0). */
  onKey: (key: string) => void;
  /** What has been sent or typed so far, shown above the keys. */
  value?: string;
  label?: string;
  disabled?: boolean;
  /** Show the digits line above the keys. */
  showValue?: boolean;
}
/** The dial pad: twelve keys with their letters, a long press on 0 for +, typing works while it has focus, and
 *  what has been sent shows above it. */
export function Keypad({ onKey, value = '', label = 'Keypad', disabled = false, showValue = true, className, ...props }: KeypadProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);
  const press = (event: PointerEvent<HTMLButtonElement>, digit: string) => {
    if (digit !== '0' || disabled) return;
    longPressed.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    timer.current = setTimeout(() => { longPressed.current = true; onKey('+'); }, 550);
  };
  const release = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  const typed = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^[0-9*#+]$/.test(event.key)) { event.preventDefault(); onKey(event.key); }
  };
  return <div {...props} className={cx('easm-ui easm-ui-keypad', className)} role="group" aria-label={label} onKeyDown={typed}>
    {showValue ? <output className="easm-ui-keypad-value" aria-live="polite" data-empty={!value || undefined}>{value || 'Type or tap a number'}</output> : null}
    <div className="easm-ui-keypad-keys">
      {keys.map(([digit, letters]) => <button key={digit} type="button" className="easm-ui-keypad-key" disabled={disabled}
        aria-label={letters ? `${digit} ${digit === '0' ? '(hold for +)' : letters}` : digit}
        onPointerDown={event => press(event, digit)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
        onClick={() => { if (longPressed.current) { longPressed.current = false; return; } onKey(digit); }}>
        <span className="easm-ui-keypad-digit">{digit}</span>{letters ? <span className="easm-ui-keypad-letters" aria-hidden="true">{letters}</span> : null}
      </button>)}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ CallDeviceLine */

export interface CallDeviceLineProps extends HTMLAttributes<HTMLDivElement> {
  microphone?: string;
  speaker?: string;
  onChange?: () => void;
  /** The microphone is blocked or missing: the line says so and Change becomes the fix. */
  problem?: string;
}
/** Which microphone and speaker a call uses, with Change. */
export function CallDeviceLine({ microphone, speaker, onChange, problem, className, ...props }: CallDeviceLineProps) {
  return <div {...props} className={cx('easm-ui easm-ui-call-device', className)} data-problem={problem ? true : undefined}>
    <UIIcon name={problem ? 'mic-off' : 'headset'} size={16} />
    <span className="easm-ui-call-device-text">{problem ?? ([microphone, speaker].filter(Boolean).join(' · ') || 'Default devices')}</span>
    {onChange ? <button type="button" className="easm-ui-call-device-change" onClick={onChange}>{problem ? 'Fix' : 'Change'}</button> : null}
  </div>;
}

/* ------------------------------------------------------------------ Elapsed time */

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
/** Time since a call started, counting every second; tabular figures so the line never jitters. */
export function CallElapsed({ startedAt, now: fixedNow, className }: { startedAt: Date | number | string; now?: Date | number | string; className?: string }) {
  const start = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => { if (fixedNow !== undefined) return; const id = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(id); }, [fixedNow]);
  const now = fixedNow !== undefined ? new Date(fixedNow).getTime() : tick;
  return <time className={cx('easm-ui-call-elapsed', className)} suppressHydrationWarning>{clock(now - start)}</time>;
}

/* ------------------------------------------------------------------ CallBar */

export type CallBarStatus = 'ringing' | 'connecting' | 'live' | 'on-hold' | 'ended';
const statusWords: Record<CallBarStatus, string> = { ringing: 'Ringing', connecting: 'Connecting', live: 'On a call', 'on-hold': 'On hold', ended: 'Call ended' };
export interface CallBarProps extends HTMLAttributes<HTMLElement> {
  name: string;
  /** The number, the purpose or the campaign, one line. */
  detail?: ReactNode;
  status: CallBarStatus;
  startedAt?: Date | number | string;
  /** docked: the corner card on any page. page: the Dialer's own call surface. */
  variant?: 'docked' | 'page';
  muted?: boolean;
  onHold?: boolean;
  keypadOpen?: boolean;
  onMuteChange?: (muted: boolean) => void;
  onHoldChange?: (onHold: boolean) => void;
  onKeypadChange?: (open: boolean) => void;
  onHangUp?: () => void;
  onAnswer?: () => void;
  onDecline?: () => void;
  /** The docked card's way back to the Dialer. */
  onOpen?: () => void;
  /** Extra controls (Transfer, Record) after the standard ones. */
  extra?: ReactNode;
  /** The keypad or a device line, shown under the controls. */
  children?: ReactNode;
}
/** The one in-call surface: who, how long, and the controls. Docked it is a dark card in the corner; on the Dialer it
 *  is the page's call area with large buttons. Ringing shows Answer and Decline instead of the call controls. */
export function CallBar({ name, detail, status, startedAt, variant = 'docked', muted = false, onHold = false, keypadOpen = false,
  onMuteChange, onHoldChange, onKeypadChange, onHangUp, onAnswer, onDecline, onOpen, extra, children, className, ...props }: CallBarProps) {
  if (!name.trim()) reportContentProblem('CallBar requires the name of who is on the call.');
  const size = variant === 'page' ? 'lg' : 'md';
  const ringing = status === 'ringing' && (onAnswer || onDecline);
  return <section {...props} aria-label={`Call with ${name}`} data-variant={variant} data-status={status} className={cx('easm-ui easm-ui-call-bar', className)}>
    <header className="easm-ui-call-bar-head">
      <span className="easm-ui-call-bar-who">
        <span className="easm-ui-call-bar-name">{name}</span>
        {detail ? <span className="easm-ui-call-bar-detail">{detail}</span> : null}
      </span>
      <span className="easm-ui-call-bar-state" role="status">
        <span className="easm-ui-call-bar-dot" aria-hidden="true" />{statusWords[status]}
        {startedAt && (status === 'live' || status === 'on-hold') ? <> · <CallElapsed startedAt={startedAt} /></> : null}
      </span>
      {onOpen && variant === 'docked' ? <button type="button" className="easm-ui-call-bar-open" onClick={onOpen}>Open Dialer</button> : null}
    </header>
    <CallControls className="easm-ui-call-bar-controls">
      {ringing ? <>
        {onDecline ? <CallButton action="decline" size={size} onClick={onDecline} /> : null}
        {onAnswer ? <CallButton action="answer" size={size} onClick={onAnswer} /> : null}
      </> : <>
        {onMuteChange ? <CallButton action="mute" size={size} pressed={muted} onClick={() => onMuteChange(!muted)} disabled={status === 'ended'} /> : null}
        {onHoldChange ? <CallButton action="hold" size={size} pressed={onHold} onClick={() => onHoldChange(!onHold)} disabled={status === 'ended'} /> : null}
        {onKeypadChange ? <CallButton action="keypad" size={size} pressed={keypadOpen} onClick={() => onKeypadChange(!keypadOpen)} disabled={status === 'ended'} /> : null}
        {extra}
        {onHangUp ? <CallButton action="hangup" size={size} onClick={onHangUp} disabled={status === 'ended'} /> : null}
      </>}
    </CallControls>
    {children ? <div className="easm-ui-call-bar-body">{children}</div> : null}
  </section>;
}

/* ------------------------------------------------------------------ CallRowMeta */

export type CallHandler = 'ai' | 'staff' | 'transfer';
export interface CallRowMetaProps extends HTMLAttributes<HTMLSpanElement> {
  direction: 'inbound' | 'outbound';
  handledBy?: CallHandler;
  purpose?: ReactNode;
  /** The outcome as a StatusChip or text. */
  outcome?: ReactNode;
  /** A call under way: the time since it started, ticking. */
  liveSince?: Date | number | string;
}
const handlerMark: Record<CallHandler, { icon: IconName; word: string }> = {
  ai: { icon: 'actor-ai', word: 'Assistant' }, staff: { icon: 'actor-staff', word: 'Staff' }, transfer: { icon: 'call-transfer', word: 'Transfer' },
};
/** The meta line of a call row: which way, who handled it, what for, how it ended, or how long it has been live. */
export function CallRowMeta({ direction, handledBy, purpose, outcome, liveSince, className, ...props }: CallRowMetaProps) {
  return <span {...props} className={cx('easm-ui easm-ui-call-meta', className)}>
    <span className="easm-ui-call-meta-part"><UIIcon name={direction === 'inbound' ? 'call-inbound' : 'call-outbound'} size={16} />{direction === 'inbound' ? 'Inbound' : 'Outbound'}</span>
    {handledBy ? <span className="easm-ui-call-meta-part" data-handler={handledBy}><UIIcon name={handlerMark[handledBy].icon} size={16} />{handlerMark[handledBy].word}</span> : null}
    {purpose ? <span className="easm-ui-call-meta-part easm-ui-call-meta-purpose">{purpose}</span> : null}
    {liveSince ? <span className="easm-ui-call-meta-part" data-live="true"><span className="easm-ui-call-meta-live" aria-hidden="true" />Live <CallElapsed startedAt={liveSince} /></span>
      : outcome ? <span className="easm-ui-call-meta-part">{outcome}</span> : null}
  </span>;
}

/* ------------------------------------------------------------------ TranscriptViewer */

export type TranscriptSpeaker = 'caller' | 'assistant' | 'staff' | 'transfer';
export interface TranscriptTurn {
  id: string;
  speaker: TranscriptSpeaker;
  /** The speaker's name ("Ayesha", "Ali Khan"); defaults to the role. */
  name?: string;
  /** Seconds from the start of the recording. */
  at: number;
  text: string;
  /** Where the assistant held an answer back or a lookup failed: shown as a marker after the turn. */
  marker?: { kind: 'held' | 'lookup-failed' | 'handoff'; text: string };
}
const speakerMark: Record<TranscriptSpeaker, { icon: IconName; word: string }> = {
  caller: { icon: 'actor-visitor', word: 'Caller' }, assistant: { icon: 'actor-ai', word: 'Assistant' },
  staff: { icon: 'actor-staff', word: 'Staff' }, transfer: { icon: 'call-transfer', word: 'Transferred to' },
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export interface TranscriptViewerProps extends Omit<HTMLAttributes<HTMLElement>, 'onSeek'> {
  label: string;
  turns: readonly TranscriptTurn[];
  /** Seconds played; the turn being heard is marked. */
  currentTime?: number;
  /** Jump the recording to a turn. */
  onSeek?: (seconds: number) => void;
  /** Bring one turn into view and mark it (a jump from the summary). */
  focusTurnId?: string;
  /** Show the search field. */
  searchable?: boolean;
}
/** The call's words, turn by turn: who spoke (with their mark), when (a button that seeks the recording), what
 *  they said, and markers where the assistant held back an answer or a lookup failed. */
export function TranscriptViewer({ label, turns, currentTime, onSeek, focusTurnId, searchable = true, className, ...props }: TranscriptViewerProps) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const q = query.trim().toLowerCase();
  const shown = q ? turns.filter(t => t.text.toLowerCase().includes(q) || (t.name ?? '').toLowerCase().includes(q)) : turns;
  const playing = currentTime === undefined ? undefined : [...turns].reverse().find(t => t.at <= currentTime)?.id;
  useEffect(() => {
    if (!focusTurnId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-turn="${CSS.escape(focusTurnId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusTurnId]);
  const mark = (text: string) => {
    if (!q) return text;
    const parts: ReactNode[] = []; let i = 0; const lower = text.toLowerCase();
    for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, i)) { parts.push(text.slice(i, at), <mark key={at}>{text.slice(at, at + q.length)}</mark>); i = at + q.length; }
    parts.push(text.slice(i));
    return parts;
  };
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-transcript', className)}>
    {searchable ? <div className="easm-ui-transcript-search">
      <UIIcon name="search" size={16} />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the transcript" aria-label={`Search ${label}`} />
      {q ? <span className="easm-ui-transcript-count" aria-live="polite">{shown.length} of {turns.length}</span> : null}
    </div> : null}
    {shown.length ? <ol ref={listRef} className="easm-ui-transcript-list">
      {shown.map(turn => {
        const who = speakerMark[turn.speaker];
        return <li key={turn.id} data-turn={turn.id} data-speaker={turn.speaker} data-playing={playing === turn.id || undefined} data-focus={focusTurnId === turn.id || undefined}>
          <span className="easm-ui-transcript-mark" aria-hidden="true"><UIIcon name={who.icon} size={20} /></span>
          <div className="easm-ui-transcript-body">
            <p className="easm-ui-transcript-head">
              <strong>{turn.name ?? who.word}</strong>
              {onSeek ? <button type="button" className="easm-ui-transcript-time" onClick={() => onSeek(turn.at)} aria-label={`Play from ${mmss(turn.at)}`}>{mmss(turn.at)}</button>
                : <span className="easm-ui-transcript-time">{mmss(turn.at)}</span>}
            </p>
            <p className="easm-ui-transcript-text">{mark(turn.text)}</p>
            {turn.marker ? <p className="easm-ui-transcript-marker" data-kind={turn.marker.kind}>
              <UIIcon name={turn.marker.kind === 'held' ? 'state-paused' : turn.marker.kind === 'handoff' ? 'event-handoff-to-human' : 'state-failed'} size={16} />{turn.marker.text}</p> : null}
          </div>
        </li>;
      })}
    </ol> : <p className="easm-ui-transcript-empty">{q ? `Nothing in the transcript says "${query.trim()}".` : 'No transcript for this call.'}</p>}
  </section>;
}

/* ------------------------------------------------------------------ CallResultCard */

export interface CallFollowUp { id: string; label: ReactNode; state: 'done' | 'waiting' | 'not-done'; detail?: ReactNode }
export interface CallResultCardProps extends HTMLAttributes<HTMLElement> {
  /** The outcome: a StatusSpec (glyph, label, tone). */
  outcome: StatusSpec;
  /** What the call established ("Interested in BS Computer Science, Fall 2027"). */
  qualification?: ReactNode;
  followUps?: readonly CallFollowUp[];
  /** Handed to a counsellor: who, shown as its own line. */
  handedTo?: ReactNode;
}
const followUpGlyph: Record<CallFollowUp['state'], [IconName, StatusTone]> = { done: ['state-done', 'success'], waiting: ['state-waiting-on-person', 'warning'], 'not-done': ['state-blocked', 'neutral'] };
/** How a call ended and what came of it: the outcome, what it established, each follow-up and its state, and
 *  whether it went to a counsellor. */
export function CallResultCard({ outcome, qualification, followUps = [], handedTo, className, ...props }: CallResultCardProps) {
  return <section {...props} aria-label={`Call result: ${outcome.label}`} className={cx('easm-ui easm-ui-call-result', className)}>
    <StatusChip status="outcome" statuses={{ outcome }} variant="row" detail={qualification} />
    {followUps.length ? <ul className="easm-ui-call-result-follow">
      {followUps.map(f => <li key={f.id} data-state={f.state} data-tone={followUpGlyph[f.state][1]}>
        <UIIcon name={followUpGlyph[f.state][0]} size={16} /><span>{f.label}{f.detail ? <span className="easm-ui-call-result-detail">{f.detail}</span> : null}</span>
      </li>)}
    </ul> : null}
    {handedTo ? <p className="easm-ui-call-result-handed"><UIIcon name="event-handoff-to-human" size={16} /><span>Handed to {handedTo}</span></p> : null}
  </section>;
}

/* ------------------------------------------------------------------ ThreadEvent */

export interface ThreadEventProps extends HTMLAttributes<HTMLDivElement> {
  glyph: IconName;
  tone?: StatusTone;
  children: ReactNode;
  time?: ReactNode;
  dateTime?: string;
  detail?: ReactNode;
}
/** A centred event between messages: "Assigned to Ayesha · 10:42". Quiet, so the messages stay the story. */
export function ThreadEvent({ glyph, tone = 'neutral', children, time, dateTime, detail, className, ...props }: ThreadEventProps) {
  return <div {...props} role="note" data-tone={tone} className={cx('easm-ui easm-ui-thread-event', className)}>
    <span className="easm-ui-thread-event-line">
      <span className="easm-ui-thread-event-mark" aria-hidden="true"><UIIcon name={glyph} size={16} /></span>
      <span>{children}{time ? <> · <time dateTime={dateTime}>{time}</time></> : null}</span>
    </span>
    {detail ? <span className="easm-ui-thread-event-detail">{detail}</span> : null}
  </div>;
}
