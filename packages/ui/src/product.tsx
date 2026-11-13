'use client';

import { forwardRef, useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode,
  type Ref, type TextareaHTMLAttributes } from 'react';
import { Button, IconButton } from './actions';
import { Spinner } from './feedback';
import { SegmentedControl, useHorizontalOverflow } from './selection';
import { Avatar } from './utility';
import { assignRef, cx, quietPointerFocus, UIIcon, type UIIconName } from './shared';
import { useFlip, useGrowMotion } from './motion-hooks';
import type { BrandIconName } from '@easm-ui/icons';
import { BrandIcon, brandIcons } from '@easm-ui/icons/brand-icon';
import { fullNumber, requireLabel } from './palette';
import { Popover } from './overlays';
import { NotificationPattern, type NotificationItem } from './patterns';
import { EasmLink } from './link';

/**
 * Product layer: the support inbox (conversation list, thread, messages, composer, contact header)
 * and the top-bar status parts. Separate from the 47 core names.
 */
export const productComponentNames = [
  'StatusPill', 'Kbd', 'NotificationButton', 'NotificationCenter', 'ChannelMark', 'QuickFilters', 'ScorePill', 'ConversationList', 'ConversationListItem',
  'ThreadHeader', 'MessageThread', 'MessageDivider', 'Message', 'Composer', 'ContactHeader', 'AudioPlayer',
] as const;

/* Counts render the same on the server and in every browser, whatever the runtime's default locale. */
const formatCount = fullNumber('en');
const joinIds = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;
/** Attaches a node to our own ref and the caller's, React 19 style: the returned cleanup detaches both. */
function bindRefs<T>(node: T | null, own: { current: T | null }, ref: Ref<T> | undefined) {
  own.current = node;
  const cleanup = typeof ref === 'function' ? ref(node) : ref ? (ref.current = node, undefined) : undefined;
  return () => {
    own.current = null;
    if (typeof cleanup === 'function') cleanup();
    else if (typeof ref === 'function') ref(null);
    else if (ref) ref.current = null;
  };
}

/* -------------------------------------------------------------- StatusPill */

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  /** Quieter text after the label, such as "16 min today". */
  meta?: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'brand';
  /** A soft pulse on the dot for a live connection. Off under reduced motion. */
  live?: boolean;
  ref?: Ref<HTMLSpanElement>;
}
/** A connection or presence state: a dot, a label and optional detail. */
export function StatusPill({ label, meta, tone = 'neutral', live = false, className, ...props }: StatusPillProps) {
  requireLabel(label, 'StatusPill');
  return <span {...props} className={cx('easm-ui easm-ui-status-pill', className)} data-tone={tone} data-live={live || undefined}>
    <span className="easm-ui-status-pill-dot" aria-hidden="true" /><span className="easm-ui-status-pill-label">{label}</span>
    {meta ? <span className="easm-ui-status-pill-meta">{meta}</span> : null}
  </span>;
}

/* --------------------------------------------------------------------- Kbd */

export interface KbdProps extends HTMLAttributes<HTMLElement> { ref?: Ref<HTMLElement> }
export function Kbd({ children, className, ...props }: KbdProps) {
  return <kbd {...props} className={cx('easm-ui easm-ui-kbd', className)}>{children}</kbd>;
}

/* ------------------------------------------------------ NotificationButton */

export interface NotificationButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  count?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'secondary' | 'subtle';
  icon?: UIIconName;
}
/** A bell with an unread count. The count is part of the button's name. Works as a Popover or menu trigger. */
export const NotificationButton = forwardRef<HTMLButtonElement, NotificationButtonProps>(function NotificationButton({ count = 0, label = 'Notifications', size = 'md', variant = 'secondary', icon = 'notification', className, ...props }, ref) {
  requireLabel(label, 'NotificationButton');
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('NotificationButton count must be a nonnegative integer.');
  const name = count ? `${label}, ${count} unread` : label;
  // A notification arriving rings the bell once (the notify preset) and the count pops in; a count going down
  // (one read) changes quietly.
  const own = useRef<HTMLButtonElement | null>(null), last = useRef(count);
  useEffect(() => {
    const previous = last.current;
    last.current = count;
    if (count <= previous) return;
    const glyph = own.current?.querySelector(':scope > .easm-icon');
    if (!glyph) return;
    glyph.setAttribute('data-motion', 'notify');
    glyph.removeAttribute('data-active');
    void glyph.getBoundingClientRect();
    glyph.setAttribute('data-active', 'true');
  }, [count]);
  return <Button {...props} ref={node => { own.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }}
    size={size} variant={variant} leadingIcon={icon} aria-label={name}
    className={cx('easm-ui-icon-button', 'easm-ui-notification-button', className)}>
    <span className="easm-ui-sr-only">{name}</span>
    {count > 0 ? <span key={count} className="easm-ui-notification-count" aria-hidden="true">{count > 99 ? '99+' : count}</span> : null}
  </Button>;
});

/* ------------------------------------------------------ NotificationCenter */

export interface NotificationCenterProps {
  items: readonly NotificationItem[];
  onRead: (id: string) => void;
  onReadAll?: () => void;
  label?: string;
  variant?: 'secondary' | 'subtle';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Opens what an item is about (see NotificationPattern). */
  onOpen?: (id: string) => void;
}
/** The bell and its panel: a NotificationButton whose count is the unread total, opening a NotificationPattern ordered by priority. On phones the panel takes the screen's width. */
export function NotificationCenter({ items, onRead, onReadAll, label = 'Notifications', variant = 'secondary', open, onOpenChange, onOpen }: NotificationCenterProps) {
  const unread = items.filter(item => item.unread).length;
  return <Popover label={label} align="end" open={open} onOpenChange={onOpenChange} className="easm-ui-notification-popover"
    trigger={<NotificationButton count={unread} label={label} variant={variant} />}>
    <NotificationPattern appearance="plain" items={items} onRead={onRead} onReadAll={onReadAll} label={label} onOpen={onOpen} />
  </Popover>;
}

/* ------------------------------------------------------------- AudioPlayer */

const AUDIO_RATES = [1, 1.5, 2] as const;
/** Files above this are not downloaded twice just to draw their loudness (a long call recording). */
const AUDIO_PEAKS_MAX_BYTES = 6 * 1024 * 1024;
const audioPeaksCache = new Map<string, Promise<{ peaks: number[]; duration: number } | null>>();

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The file's loudness in `bars` steps (0–1, the loudest step 1) and its true length, or null when the file cannot
 * be read here (another origin without CORS, too large, an undecodable format). Cached by address. */
function loadAudioPeaks(src: string, bars: number): Promise<{ peaks: number[]; duration: number } | null> {
  const key = `${bars}:${src}`;
  let pending = audioPeaksCache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const Offline = typeof window !== 'undefined' ? (window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext) : undefined;
        if (!Offline) return null;
        const response = await fetch(src);
        if (!response.ok) return null;
        const size = Number(response.headers.get('content-length') || 0);
        if (size > AUDIO_PEAKS_MAX_BYTES) { void response.body?.cancel(); return null; }
        const data = await response.arrayBuffer();
        if (data.byteLength > AUDIO_PEAKS_MAX_BYTES) return null;
        // A low sample rate is plenty for a loudness outline and keeps the decoded copy small.
        const context = new Offline(1, 1, 8000);
        const buffer = await context.decodeAudioData(data);
        // Every channel, the louder of them per bar: a call recording is stereo with the caller on one channel and
        // the assistant on the other, and reading the first alone drew the caller's turns and flat dots for every
        // answer.
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
        const length = buffer.length;
        const step = Math.max(1, Math.floor(length / bars));
        const levels: number[] = [];
        for (let bar = 0; bar < bars; bar++) {
          const start = bar * step, end = Math.min(length, start + step);
          let level = 0;
          for (const samples of channels) {
            let sum = 0;
            for (let i = start; i < end; i++) sum += samples[i] * samples[i];
            level = Math.max(level, Math.sqrt(sum / Math.max(1, end - start)));
          }
          levels.push(level);
        }
        const loudest = Math.max(...levels, 1e-6);
        return { peaks: levels.map((level) => Math.min(1, level / loudest)), duration: buffer.duration };
      } catch {
        return null;
      }
    })();
    audioPeaksCache.set(key, pending);
    if (audioPeaksCache.size > 64) audioPeaksCache.delete(audioPeaksCache.keys().next().value!);
  }
  return pending;
}

export interface AudioPlayerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
  src: string;
  /** What the recording is, for assistive technology ("Voice message", "Call recording"). */
  label?: string;
  /** The loudness outline (0–1 per bar) when the caller already has it; otherwise it is read from the file. */
  peaks?: readonly number[];
  /** How many bars the outline has. */
  bars?: number;
  /** Called when the audio cannot load, e.g. so a caller can re-sign an expired link. */
  onError?: () => void;
}
/**
 * A voice message or recording. Its bars are the recording's own loudness, and they fill in step with the sound
 * as it plays; they are also the seek bar (drag, click, or arrow keys). Where the file cannot be read for its
 * loudness (another origin without CORS, a long recording), the bars are even and still fill with the playback.
 * The length is the file's true length, also for browser recordings that carry none in their header.
 */
export function AudioPlayer({ src, label = 'Voice message', peaks: givenPeaks, bars = 40, onError, className, ...props }: AudioPlayerProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [failed, setFailed] = useState(false);
  const [peaks, setPeaks] = useState<readonly number[] | null>(givenPeaks ?? null);
  // Without the recording's outline the bars are even and low: a plain track that still fills with the playback.
  const fallbackPeaks = useRef<number[]>(Array.from({ length: bars }, () => 0.12));

  // Read the outline once the player is near the screen, so a long thread does not fetch every message at once.
  useEffect(() => {
    if (givenPeaks) { setPeaks(givenPeaks); return; }
    setPeaks(null);
    const node = root.current;
    if (!node) return;
    let cancelled = false;
    const load = () => loadAudioPeaks(src, bars).then((result) => {
      if (cancelled || !result) return;
      setPeaks(result.peaks);
      if (result.duration > 0) setDuration((current) => (current > 0 && Number.isFinite(current) ? current : result.duration));
    });
    if (typeof IntersectionObserver === 'undefined') { void load(); return () => { cancelled = true; }; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); void load(); }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => { cancelled = true; observer.disconnect(); };
  }, [src, bars, givenPeaks]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    setFailed(false);
    setTime(0);
    let probing = false;
    const readDuration = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) { setDuration(el.duration); return; }
      // A browser recording (WebM/Opus) carries no length in its header: seeking far past the end makes the
      // browser find it, after which the element goes back to the start.
      if (el.duration === Infinity && !probing) { probing = true; el.currentTime = 1e7; }
    };
    const onTime = () => {
      if (probing) {
        if (Number.isFinite(el.duration)) { probing = false; setDuration(el.duration); el.currentTime = 0; }
        return;
      }
      setTime(el.currentTime);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setTime(0); el.currentTime = 0; };
    const onWaiting = () => setBuffering(true);
    const onReady = () => setBuffering(false);
    const onFail = () => { setFailed(true); setPlaying(false); setBuffering(false); onError?.(); };
    const events: [string, () => void][] = [['loadedmetadata', readDuration], ['durationchange', readDuration], ['timeupdate', onTime], ['play', onPlay], ['pause', onPause], ['ended', onEnded], ['waiting', onWaiting], ['playing', onReady], ['canplay', onReady], ['error', onFail]];
    for (const [name, handler] of events) el.addEventListener(name, handler);
    return () => { for (const [name, handler] of events) el.removeEventListener(name, handler); };
  }, [src, onError]);

  // While playing, follow the playhead every frame, so the fill moves smoothly rather than in timeupdate's steps.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => { const el = audio.current; if (el) setTime(el.currentTime); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (playing) el.pause();
    else { el.playbackRate = rate; void el.play().catch(() => setPlaying(false)); }
  };
  const seekTo = (seconds: number) => {
    const el = audio.current;
    if (!el || !(duration > 0)) return;
    const next = Math.min(duration, Math.max(0, seconds));
    el.currentTime = next;
    setTime(next);
  };
  const seekFromPointer = (clientX: number) => {
    const box = wave.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    seekTo(((clientX - box.left) / box.width) * duration);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 };
    if (event.key in moves) { event.preventDefault(); seekTo(time + moves[event.key]); }
    else if (event.key === 'Home') { event.preventDefault(); seekTo(0); }
    else if (event.key === 'End') { event.preventDefault(); seekTo(duration); }
    else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(); }
  };
  const nextRate = () => {
    const next = AUDIO_RATES[(AUDIO_RATES.indexOf(rate as typeof AUDIO_RATES[number]) + 1) % AUDIO_RATES.length];
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const outline = peaks && peaks.length ? peaks : fallbackPeaks.current;
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const shown = playing || time > 0 ? time : duration;
  const barsOf = (layer: 'base' | 'played') => (
    <span className="easm-ui-audio-bars" data-layer={layer} aria-hidden="true">
      {outline.map((level, i) => <span key={i} style={{ height: `${Math.round(18 + Math.max(0, Math.min(1, level)) * 82)}%` }} />)}
    </span>
  );

  return (
    <div {...props} ref={root} className={cx('easm-ui easm-ui-audio', className)} data-playing={playing || undefined} data-failed={failed || undefined}>
      {failed ? (
        <p className="easm-ui-audio-failed"><UIIcon name="error-circle" size={16} /> Audio unavailable</p>
      ) : (
        <>
          <IconButton icon={playing ? 'pause' : 'play'} label={playing ? `Pause ${label.toLowerCase()}` : `Play ${label.toLowerCase()}`} variant="primary" className="easm-ui-audio-play" onClick={toggle} aria-busy={buffering || undefined} />
          {buffering ? <Spinner size={16} variant="ring" label="Loading audio" className="easm-ui-audio-spinner" /> : null}
          <div
            ref={wave}
            role="slider"
            tabIndex={0}
            aria-label={`${label}: position`}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
            aria-valuetext={`${formatAudioTime(time)} of ${formatAudioTime(duration)}`}
            className="easm-ui-audio-wave"
            data-outline={peaks ? 'recording' : 'even'}
            style={{ '--easm-audio-progress': `${(progress * 100).toFixed(2)}%` } as CSSProperties}
            onKeyDown={onKeyDown}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); seekFromPointer(event.clientX); }}
            onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFromPointer(event.clientX); }}
          >
            {barsOf('base')}
            {barsOf('played')}
          </div>
          <span className="easm-ui-audio-time" aria-hidden="true">{formatAudioTime(shown)}</span>
          <button type="button" className="easm-ui-audio-rate" onClick={nextRate} aria-label={`Playback speed ${rate} times. Change speed`}>{rate}×</button>
        </>
      )}
      <audio ref={audio} src={src} preload="metadata" />
    </div>
  );
}

/* ------------------------------------------------------------ QuickFilters */

export interface QuickFilterOption { id: string; label: string; count?: number; icon?: UIIconName; disabled?: boolean }
export interface QuickFiltersProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  options: readonly QuickFilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md';
  ref?: Ref<HTMLDivElement>;
}
/** One-of-many view filters with counts ("Needs you 78"). Overflowing rows page with arrows like tabs, and the
 * selected chip is kept in view, also when the value changes from outside (the URL, Back). */
export function QuickFilters({ label, options, value, onValueChange, size = 'md', className, ...props }: QuickFiltersProps) {
  requireLabel(label, 'QuickFilters');
  const overflow = useHorizontalOverflow(true, options.length, '[aria-pressed="true"]');
  useEffect(() => { overflow.reveal(overflow.ref.current?.querySelector('[aria-pressed="true"]')); }, [value]);
  return <div {...props} className={cx('easm-ui easm-ui-quick-filters', className)} data-size={size}>
    <div className="easm-ui-tab-scroller" data-overflow-start={overflow.edges.start} data-overflow-end={overflow.edges.end}>
      {overflow.edges.start ? <IconButton icon="chevron-left" label="Show previous filters" size="sm" variant="secondary" tabIndex={-1} className="easm-ui-tab-scroll" data-side="start" onClick={() => overflow.page(-1)} /> : null}
      <div ref={overflow.ref} role="group" aria-label={label} className="easm-ui-quick-filters-row">
        {options.map(option => <button key={option.id} type="button" aria-pressed={value === option.id} disabled={option.disabled}
          className="easm-ui-quick-filter" onClick={event => { onValueChange(option.id); overflow.reveal(event.currentTarget); }}>
          {option.icon ? <UIIcon name={option.icon} size={16} /> : null}<span>{option.label}</span>
          {option.count !== undefined ? <span className="easm-ui-quick-filter-count">{formatCount(option.count)}</span> : null}
        </button>)}
      </div>
      {overflow.edges.end ? <IconButton icon="chevron-right" label="Show more filters" size="sm" variant="secondary" tabIndex={-1} className="easm-ui-tab-scroll" data-side="end" onClick={() => overflow.page(1)} /> : null}
    </div>
  </div>;
}

/* --------------------------------------------------------------- ScorePill */

/** The words a ScorePill can state. Confidence: high, medium, low. Lead: hot, warm, cool, cold. */
export type ScoreLevel = 'high' | 'medium' | 'low' | 'hot' | 'warm' | 'cool' | 'cold';
const levelTone: Record<ScoreLevel, 'green' | 'amber' | 'coral' | 'sky'> = { high: 'green', medium: 'amber', low: 'coral', hot: 'coral', warm: 'amber', cool: 'sky', cold: 'sky' };
let warnedFraction = false;
export interface ScorePillProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  /** confidence: the assistant's certainty (0–100). lead: how likely a lead is to apply (0–100). */
  kind?: 'confidence' | 'lead';
  size?: 'sm' | 'md';
  /** The scale `value` is on: 100 (the default) for 0–100, or 1 for a 0–1 fraction such as a model's confidence. */
  scale?: 1 | 100;
  /** The level as the source of truth decides it (for example the server's lead temperature). Overrides the
   * built-in thresholds (confidence 80/60, lead 65/50) and sets the colour. */
  level?: ScoreLevel;
  ref?: Ref<HTMLSpanElement>;
}
/** A small coloured score. Colour follows the level, and the level is also stated in words. */
export function ScorePill({ value, kind = 'confidence', size = 'sm', scale = 100, level, className, ...props }: ScorePillProps) {
  if (!Number.isFinite(value) || value < 0 || value > scale) throw new Error(`ScorePill value must be between 0 and ${scale}.`);
  if (scale === 100 && kind === 'confidence' && value > 0 && value < 1 && !warnedFraction) {
    warnedFraction = true;
    console.warn(`ScorePill: confidence ${value} looks like a 0–1 fraction shown as ${Math.round(value)}%. Pass scale={1}.`);
  }
  const v = Math.round(scale === 1 ? value * 100 : value);
  const word: ScoreLevel = level ?? (kind === 'lead' ? v >= 65 ? 'hot' : v >= 50 ? 'warm' : 'cool' : v >= 80 ? 'high' : v >= 60 ? 'medium' : 'low');
  const name = kind === 'lead' ? `Lead score ${v}, ${word}` : `AI confidence ${v}%, ${word}`;
  return <span {...props} role="img" aria-label={name} className={cx('easm-ui easm-ui-score-pill', className)} data-tone={levelTone[word]} data-size={size}>
    <UIIcon name={kind === 'lead' ? 'lead-hot' : 'sparkle'} size={16} /><span aria-hidden="true">{kind === 'lead' ? v : `${v}%`}</span>
  </span>;
}

/* ------------------------------------------------------ ConversationList */

export interface ConversationListProps extends HTMLAttributes<HTMLUListElement> { label: string; ref?: Ref<HTMLUListElement> }
/** A list of conversations. Up and down arrows move between them; Home and End jump to the ends. */
export function ConversationList({ label, children, className, onKeyDown, ref, ...props }: ConversationListProps) {
  requireLabel(label, 'ConversationList');
  // A conversation that moves (a new message lifts it to the top, a filter narrows the list) glides to its place.
  const listRef = useRef<HTMLUListElement | null>(null);
  useFlip(listRef, ':scope > *', { enter: false });
  const move = (event: KeyboardEvent<HTMLUListElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('.easm-ui-conversation-item-control:not(:disabled)'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    items[next]?.focus();
  };
  return <ul {...props} ref={node => { listRef.current = node; assignRef(ref, node); }} aria-label={label} onKeyDown={move}
    className={cx('easm-ui easm-ui-conversation-list', className)}>{children}</ul>;
}

/* --------------------------------------------------------------- ListPane */

export interface ListPaneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** What always stays in view above the list: the title row, the search and the main filters. */
  header: ReactNode;
  /** The secondary refinements (department, tag, "2 filters active"): they slide away while the list is read
   * downwards, so the rows get the room, most of all on a phone, and slide back as soon as it is scrolled up. */
  filters?: ReactNode;
  /** The list. It scrolls inside the pane. */
  children: ReactNode;
  /** The scrolling box, for a caller that keeps a row in view. */
  listRef?: Ref<HTMLDivElement>;
}

/** Scrolled this far down, the secondary filters fold. */
const LIST_PANE_FOLD_AFTER = 48;
/** Scrolled back up this far, they return. */
const LIST_PANE_UNFOLD_BY = 24;
/** The fold's own animation: the list changes height while it runs, and the browser's scroll then is not the person's. */
const LIST_PANE_SETTLE_MS = 340;

/**
 * A list beside a detail (the inbox, calls, callbacks): a card holding the title, search and main filters above a
 * list that scrolls on its own. The secondary filters fold away while the list is read downwards and come back the
 * moment it is scrolled up.
 */
export function ListPane({ header, filters, children, listRef, className, ...props }: ListPaneProps) {
  const [folded, setFolded] = useState(false);
  const list = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const shelf = useRef<HTMLDivElement>(null);
  const last = useRef(0), travel = useRef(0), settleUntil = useRef(0);
  const fold = useCallback((next: boolean) => {
    setFolded((current) => {
      if (current === next) return current;
      settleUntil.current = performance.now() + LIST_PANE_SETTLE_MS;
      travel.current = 0;
      return next;
    });
  }, []);
  const setList = useCallback((node: HTMLDivElement | null) => { list.current = node; assignRef(listRef, node); }, [listRef]);
  const onScroll = () => {
    const box = list.current;
    if (!box || !filters) return;
    const top = box.scrollTop, delta = top - last.current;
    last.current = top;
    if (top <= 4) { fold(false); return; }
    if (performance.now() < settleUntil.current || delta === 0) return;
    travel.current = Math.sign(delta) === Math.sign(travel.current) ? travel.current + delta : delta;
    if (!folded && travel.current > 0 && top > LIST_PANE_FOLD_AFTER) {
      // Only when the list is long enough to stay scrollable without them: a list that fits once they fold could
      // never be scrolled up to bring them back.
      const room = box.scrollHeight - box.clientHeight - (shelf.current?.offsetHeight ?? 0) - 12;
      if (room > LIST_PANE_FOLD_AFTER) fold(true);
    } else if (folded && travel.current <= -LIST_PANE_UNFOLD_BY) fold(false);
  };
  // Folded filters are out of the tab order, and come back when the list stops scrolling (filtered down to a few
  // rows, emptied, reset to its top).
  useEffect(() => {
    shelf.current?.toggleAttribute('inert', folded);
    const box = list.current;
    if (!folded || !box || typeof ResizeObserver === 'undefined') return;
    const check = () => { if (box.scrollHeight <= box.clientHeight + 1 || box.scrollTop <= 4) fold(false); };
    const observer = new ResizeObserver(check);
    observer.observe(box);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [folded, fold]);
  return <div {...props} className={cx('easm-ui easm-ui-list-pane', className)} data-folded={folded || undefined}>
    <div className="easm-ui-list-pane-head">
      {header}
      {filters ? <div className="easm-ui-list-pane-filters" ref={shelf}><div className="easm-ui-list-pane-filters-inner">{filters}</div></div> : null}
    </div>
    <div ref={setList} className="easm-ui-list-pane-list" onScroll={onScroll}>
      <div ref={content} className="easm-ui-list-pane-content">{children}</div>
    </div>
  </div>;
}

/* ------------------------------------------------------------ ChannelMark */

/** Where a conversation happens: a brand's own mark (WhatsApp, Messenger, Instagram…) or one of the
 * channels EASM runs itself. */
export type ConversationChannel = BrandIconName | 'web-chat' | 'email' | 'voice' | 'sms';
const ownChannels: Record<'web-chat' | 'email' | 'voice' | 'sms', { icon: UIIconName; title: string }> = {
  'web-chat': { icon: 'globe', title: 'Web chat' }, email: { icon: 'mail', title: 'Email' }, voice: { icon: 'call', title: 'Voice' }, sms: { icon: 'chat', title: 'SMS' },
};
export const channelTitle = (channel: ConversationChannel) => channel in ownChannels ? ownChannels[channel as keyof typeof ownChannels].title : brandIcons[channel as BrandIconName].title;
export interface ChannelMarkProps { channel: ConversationChannel; size?: number; /** Name it for assistive technology when no text beside it says the channel. */ label?: string; className?: string }
/** A channel's mark as a small solid tile: the brand's own app icon, or EASM blue and warm grey for web chat, email, voice and SMS. */
export function ChannelMark({ channel, size = 16, label, className }: ChannelMarkProps) {
  const own = ownChannels[channel as keyof typeof ownChannels];
  if (!own) return <BrandIcon name={channel as BrandIconName} appearance="solid" size={size} label={label} className={cx('easm-ui-channel-mark', className)} />;
  return <span className={cx('easm-ui-channel-mark', className)} data-channel={channel} style={{ width: size, height: size }}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><UIIcon name={own.icon} size={16} /></span>;
}

function AvatarWithChannel({ name, src, presence, channel, size = 'md' }: { name: string; src?: string; presence?: 'online' | 'idle' | 'away' | 'offline'; channel?: ConversationChannel; size?: 'sm' | 'md' | 'lg' }) {
  const avatar = <Avatar name={name} src={src} status={presence} decorative size={size} />;
  if (!channel) return avatar;
  return <span className="easm-ui-avatar-channel" data-size={size}>{avatar}<ChannelMark channel={channel} size={size === 'lg' ? 20 : 16} /></span>;
}

export interface ConversationListItemProps extends Omit<HTMLAttributes<HTMLLIElement>, 'onSelect' | 'children'> {
  name: string;
  preview: ReactNode;
  /** A short author tag before the preview, such as "AI" or "You". */
  previewAuthor?: string;
  time: string;
  avatarSrc?: string;
  presence?: 'online' | 'idle' | 'away' | 'offline';
  selected?: boolean;
  unread?: boolean;
  /** Small parts under the preview: a ScorePill, department, role, priority. */
  meta?: ReactNode;
  /** Quick actions (small IconButtons: resolve, assign). They sit beside the row's link, never inside it, and
   * appear on hover or keyboard focus over a fade in the row's own colour, on devices with a pointer that hovers. */
  actions?: ReactNode;
  /** The channel, shown as a small mark on the avatar's corner and read out after the name. */
  channel?: ConversationChannel;
  /** Called on activation with the click event. With an href, call event.preventDefault() to keep the link from navigating. */
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
  /** Renders the item as a link, through the app's router link when EasmUIProvider sets one. */
  href?: string;
  disabled?: boolean;
  className?: string;
  /** The list item (`li`), for measuring rows in a virtualised list. Id, style and data attributes go there too. */
  ref?: Ref<HTMLLIElement>;
}
/** One conversation: who, when, the latest message and its context. */
export function ConversationListItem({ name, preview, previewAuthor, time, avatarSrc, presence, selected = false, unread = false, meta, actions, channel, onSelect, href, disabled, className, ...props }: ConversationListItemProps) {
  requireLabel(name, 'ConversationListItem');
  const body = <>
    <AvatarWithChannel name={name} src={avatarSrc} presence={presence} channel={channel} />
    <span className="easm-ui-conversation-item-body">
      <span className="easm-ui-conversation-item-top"><span className="easm-ui-conversation-item-name">{name}{channel ? <span className="easm-ui-sr-only">, {channelTitle(channel)}</span> : null}</span>
        <span className="easm-ui-conversation-item-time">{time}</span></span>
      <span className="easm-ui-conversation-item-preview">{previewAuthor ? <b>{previewAuthor} · </b> : null}{preview}</span>
      {meta ? <span className="easm-ui-conversation-item-meta">{meta}</span> : null}
    </span>
    {unread ? <span className="easm-ui-conversation-item-unread"><span className="easm-ui-sr-only">Unread</span></span> : null}
  </>;
  const common = { className: 'easm-ui-conversation-item-control', 'aria-current': selected ? 'true' as const : undefined };
  return <li {...props} className={cx('easm-ui-conversation-item', className)} data-selected={selected || undefined} data-unread={unread || undefined}>
    {/* A disabled item is never a live link: it renders as a disabled button (not focusable, announced as unavailable). */}
    {href && !disabled ? <EasmLink {...common} href={href} onClick={onSelect}>{body}</EasmLink> : <button {...common} type="button" disabled={disabled} onClick={onSelect}>{body}</button>}
    {actions && !disabled ? <span className="easm-ui-conversation-item-actions">{actions}</span> : null}
  </li>;
}

/* ------------------------------------------------------------ ThreadHeader */

export interface ThreadHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  name: string;
  avatarSrc?: string;
  /** Badges after the name, such as "AI handling". */
  status?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** The conversation's channel, as a small mark on the avatar's corner. Say it in the subtitle too. */
  channel?: ConversationChannel;
  headingLevel?: 2 | 3;
  /** Shows a back button before the avatar, for single-pane layouts on phones where the thread
   * replaces the conversation list. */
  onBack?: () => void;
  backLabel?: string;
  ref?: Ref<HTMLElement>;
}
export function ThreadHeader({ name, avatarSrc, status, subtitle, actions, channel, headingLevel = 2, onBack, backLabel = 'Back to conversations', className, ...props }: ThreadHeaderProps) {
  requireLabel(name, 'ThreadHeader');
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return <header {...props} className={cx('easm-ui easm-ui-thread-header', className)}>
    {onBack ? <IconButton icon="arrow-left" label={backLabel} onClick={onBack} className="easm-ui-thread-header-back" /> : null}
    <AvatarWithChannel name={name} src={avatarSrc} channel={channel} />
    <div className="easm-ui-thread-header-copy">
      <div className="easm-ui-thread-header-title"><Heading>{name}</Heading>{status}</div>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {actions ? <div className="easm-ui-thread-header-actions">{actions}</div> : null}
  </header>;
}

/* ----------------------------------------------------- MessageThread & co */

export interface MessageThreadProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  /** The scrolling log, for keeping the latest message in view. Scrolling it is instant unless you ask for smooth. */
  ref?: Ref<HTMLDivElement>;
}
/** The scrolling message history. A log, so new messages are announced politely. */
export function MessageThread({ label, children, className, ...props }: MessageThreadProps) {
  requireLabel(label, 'MessageThread');
  return <div {...props} {...quietPointerFocus(props)} role="log" aria-label={label} tabIndex={0} className={cx('easm-ui easm-ui-message-thread', className)}>{children}</div>;
}

export interface MessageDividerProps extends HTMLAttributes<HTMLDivElement> { ref?: Ref<HTMLDivElement> }
/** A day or event marker in the thread ("Today"). Plain text, so screen readers read it in the log. */
export function MessageDivider({ children, className, ...props }: MessageDividerProps) {
  return <div {...props} className={cx('easm-ui-message-divider', className)}><span>{children}</span></div>;
}

export type MessageAuthor = 'contact' | 'agent' | 'assistant' | 'note' | 'system';
export type MessageDelivery = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export interface MessageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  author: MessageAuthor;
  /** Who wrote it. Shown for agents, the assistant and notes; read out for everyone. */
  name: string;
  time?: string;
  children: ReactNode;
  /** Delivery for outgoing messages. */
  delivery?: MessageDelivery;
  /** Small actions shown on hover and focus, such as copy or improve. Always shown when delivery failed. */
  actions?: ReactNode;
  avatarSrc?: string;
  /** With delivery="failed", shows a Retry button beside "Not sent" that is always visible. */
  onRetry?: () => void;
  /** The Retry button's text. */
  retryLabel?: string;
  /** The message is still being written (a streamed reply). Marks it busy so the log announces it once, when complete. */
  streaming?: boolean;
  ref?: Ref<HTMLDivElement>;
}
const authorLabel: Record<MessageAuthor, string> = { contact: '', agent: '', assistant: 'AI assistant', note: 'Internal note', system: '' };
const authorIcon: Partial<Record<MessageAuthor, UIIconName>> = { assistant: 'sparkle', note: 'lock-closed' };
const deliveryView: Record<MessageDelivery, { icon: UIIconName; label: string }> = {
  sending: { icon: 'clock', label: 'Sending' }, sent: { icon: 'checkmark', label: 'Sent' }, delivered: { icon: 'checkmark-circle', label: 'Delivered' },
  read: { icon: 'checkmark-circle', label: 'Read' }, failed: { icon: 'error-circle', label: 'Not sent' },
};
/** One message. Contacts sit on the start side; staff, the assistant and notes on the end side. */
export function Message({ author, name, time, children, delivery, actions, avatarSrc, onRetry, retryLabel = 'Retry', streaming = false, className, ...props }: MessageProps) {
  requireLabel(name, 'Message');
  if (author === 'system') return <div {...props} className={cx('easm-ui-message-system', className)}><UIIcon name="info" size={16} /><span>{children}</span>{time ? <time>{time}</time> : null}</div>;
  const tag = authorLabel[author] || (author === 'agent' ? name : '');
  const view = delivery ? deliveryView[delivery] : undefined;
  const retry = delivery === 'failed' && onRetry;
  return <div {...props} className={cx('easm-ui easm-ui-message', className)} data-author={author} data-delivery={delivery} aria-busy={streaming || undefined}>
    {author === 'contact' ? <Avatar name={name} src={avatarSrc} decorative size="sm" /> : null}
    <div className="easm-ui-message-column">
      <div className="easm-ui-message-bubble">
        <span className="easm-ui-sr-only">{author === 'contact' ? name : author === 'agent' ? name : `${authorLabel[author]}${author === 'note' ? ` by ${name}` : ''}`}: </span>
        {tag ? <span className="easm-ui-message-tag" aria-hidden="true">{authorIcon[author] ? <UIIcon name={authorIcon[author] as UIIconName} size={16} /> : null}{tag}{author === 'note' ? ` · ${name}` : ''}</span> : null}
        <div className="easm-ui-message-body">{children}</div>
      </div>
      {(time || view || actions || retry) && <div className="easm-ui-message-footer">
        {time ? <time>{time}</time> : null}
        {view ? <span className="easm-ui-message-delivery" data-state={delivery}><UIIcon name={view.icon} size={16} />{view.label}</span> : null}
        {retry ? <button type="button" className="easm-ui-message-retry" onClick={onRetry}><UIIcon name="retry" size={16} />{retryLabel}</button> : null}
        {actions ? <span className="easm-ui-message-actions">{actions}</span> : null}
      </div>}
    </div>
  </div>;
}

/* ---------------------------------------------------------------- Composer */

export type ComposerMode = 'reply' | 'note';
export type ComposerFormat = 'bold' | 'italic' | 'list' | 'link';
/** The field and its selection when a toolbar button is pressed, so the caller can wrap the selected text or
 * insert at the caret, then set the new value through onValueChange. */
export interface ComposerSelection { selectionStart: number; selectionEnd: number; field: HTMLTextAreaElement | null }
export interface ComposerProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onSubmit'> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string, mode: ComposerMode) => void;
  mode?: ComposerMode;
  onModeChange?: (mode: ComposerMode) => void;
  /** Who the reply goes to, for the field's accessible name. */
  recipient?: string;
  /** A line above the composer, such as why replying is restricted. The field is described by it. */
  notice?: ReactNode;
  /** Shows "Draft with AI". */
  onDraft?: () => void;
  drafting?: boolean;
  /** Formatting buttons; the caller applies the formatting, using the selection it is given. */
  onFormat?: (format: ComposerFormat, selection: ComposerSelection) => void;
  onAttach?: () => void;
  /** Shows "Insert a saved reply"; the caller inserts at the selection it is given. */
  onTemplate?: (selection: ComposerSelection) => void;
  busy?: boolean;
  /** The text field. */
  ref?: Ref<HTMLTextAreaElement>;
}

/** Apple keyboards say ⌘. Decided after mount, so the server and the first client render agree. */
function useApplePlatform() {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    setApple(/mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent || ''));
  }, []);
  return apple;
}

/** Write a reply or an internal note. Ctrl or ⌘ + Enter sends. Notes are tinted so they are never mistaken for replies. */
export function Composer({ value, onValueChange, onSubmit, mode = 'reply', onModeChange, recipient, notice, onDraft, drafting = false, onFormat, onAttach, onTemplate,
  busy = false, disabled, placeholder, className, id, rows, style, ref, onKeyDown, 'aria-describedby': describedBy, 'aria-keyshortcuts': keyShortcuts, ...props }: ComposerProps) {
  const uid = useId();
  const fieldId = id ?? `${uid}-field`;
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const setField = useCallback((node: HTMLTextAreaElement | null) => bindRefs(node, fieldRef, ref), [ref]);
  // The field grows with its text; each new line eases in instead of jumping.
  useGrowMotion(fieldRef, value);
  const apple = useApplePlatform();
  const empty = !value.trim();
  const submit = () => { if (!empty && !busy && !disabled) onSubmit(value, mode); };
  const selection = (): ComposerSelection => {
    const field = fieldRef.current;
    return { selectionStart: field?.selectionStart ?? value.length, selectionEnd: field?.selectionEnd ?? value.length, field };
  };
  const action = mode === 'note' ? 'save' : 'send';
  const fieldLabel = mode === 'note' ? 'Internal note, only your team will see this' : `Reply${recipient ? ` to ${recipient}` : ''}`;
  // rows sets the field's starting height; without it the field keeps its designed minimum and grows with its text.
  const fieldStyle = rows !== undefined ? { '--easm-composer-min-height': `calc(${rows} * 22px + 16px)`, ...style } as CSSProperties : style;
  return <div className={cx('easm-ui easm-ui-composer', className)} data-mode={mode} data-disabled={disabled || undefined}>
    {notice ? <p id={`${uid}-notice`} className="easm-ui-composer-notice"><UIIcon name="info" size={16} />{notice}</p> : null}
    <div className="easm-ui-composer-box">
      <div className="easm-ui-composer-top">
        {onModeChange ? <SegmentedControl label="Message type" size="sm" value={mode} disabled={disabled} onValueChange={next => onModeChange(next as ComposerMode)}
          options={[{ id: 'reply', label: 'Reply', icon: 'reply' }, { id: 'note', label: 'Internal note', icon: 'internal-note' }]} /> : <span />}
        {onDraft ? <Button size="sm" variant="subtle" leadingIcon="sparkle" loading={drafting} onClick={onDraft} disabled={disabled} className="easm-ui-composer-draft">Draft with AI</Button> : null}
      </div>
      <label htmlFor={fieldId} className="easm-ui-sr-only">{fieldLabel}</label>
      <span id={`${uid}-shortcut`} hidden>{apple ? 'Command' : 'Control'}+Enter to {action}.</span>
      <textarea {...props} ref={setField} id={fieldId} value={value} disabled={disabled} rows={rows ?? 3} style={fieldStyle}
        placeholder={placeholder ?? (mode === 'note' ? 'Write an internal note. Only your team will see it.' : `Write a reply${recipient ? ` to ${recipient}` : ''}…`)}
        aria-describedby={joinIds(describedBy, notice ? `${uid}-notice` : null, `${uid}-shortcut`)} aria-keyshortcuts={keyShortcuts ?? 'Control+Enter Meta+Enter'}
        className="easm-ui-composer-field" onChange={event => onValueChange(event.target.value)}
        onKeyDown={event => {
          onKeyDown?.(event);
          // A handler that took the key, or an input method still composing text, keeps Enter.
          if (event.defaultPrevented || event.nativeEvent.isComposing) return;
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); }
        }} />
      <div className="easm-ui-composer-bar">
        <div className="easm-ui-composer-tools" role="group" aria-label="Formatting and attachments">
          {onAttach ? <IconButton icon="attach" label="Attach a file" size="sm" onClick={onAttach} disabled={disabled} /> : null}
          {onFormat ? <>
            <IconButton icon="text-bold" label="Bold" size="sm" onClick={() => onFormat('bold', selection())} disabled={disabled} />
            <IconButton icon="text-italic" label="Italic" size="sm" onClick={() => onFormat('italic', selection())} disabled={disabled} />
            <IconButton icon="text-bullet-list" label="Bulleted list" size="sm" onClick={() => onFormat('list', selection())} disabled={disabled} />
            <IconButton icon="link" label="Link" size="sm" onClick={() => onFormat('link', selection())} disabled={disabled} />
          </> : null}
          {onTemplate ? <IconButton icon="canned-response" label="Insert a saved reply" size="sm" onClick={() => onTemplate(selection())} disabled={disabled} /> : null}
        </div>
        <span className="easm-ui-composer-hint" aria-hidden="true">{apple ? '⌘' : 'Ctrl'} ⏎ to {action}</span>
        <Button size="sm" variant={mode === 'note' ? 'secondary' : 'primary'} trailingIcon={mode === 'note' ? 'save' : 'send'} loading={busy}
          disabled={disabled || empty} onClick={submit}>{mode === 'note' ? 'Save note' : 'Send'}</Button>
      </div>
    </div>
  </div>;
}

/* ----------------------------------------------------------- ContactHeader */

export interface ContactHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  name: string;
  avatarSrc?: string;
  /** Email or phone, with an icon. */
  detail?: ReactNode;
  detailIcon?: UIIconName;
  /** Several contact lines (email, phone, student id), each with its own icon, stacked under the name.
   * Takes the place of `detail`. */
  details?: readonly { icon: UIIconName; content: ReactNode }[];
  /** Badges such as role or stage. */
  tags?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  ref?: Ref<HTMLElement>;
}
/** The person at the top of a side panel. */
export function ContactHeader({ name, avatarSrc, detail, detailIcon = 'mail', details, tags, actions, headingLevel = 2, className, ...props }: ContactHeaderProps) {
  requireLabel(name, 'ContactHeader');
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return <header {...props} className={cx('easm-ui easm-ui-contact-header', className)}>
    <Avatar name={name} src={avatarSrc} decorative size="lg" />
    <Heading>{name}</Heading>
    {details?.length
      ? <div className="easm-ui-contact-header-details">{details.map((line, index) => <p key={index}><UIIcon name={line.icon} size={16} />{line.content}</p>)}</div>
      : detail ? <p><UIIcon name={detailIcon} size={16} />{detail}</p> : null}
    {tags ? <div className="easm-ui-contact-header-tags">{tags}</div> : null}
    {actions ? <div className="easm-ui-contact-header-actions">{actions}</div> : null}
  </header>;
}
