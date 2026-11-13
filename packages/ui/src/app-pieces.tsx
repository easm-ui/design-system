'use client';

// Pieces the dashboards made for themselves and that every EASM app needs (owner, 2026-11-11: "everything universal
// must live in our UI, not inside one app"): the dashboard front (ProductHomeHero, ProductHomeBody), the brand
// lockup, the page loader, the live-call waveform, press feedback on icons, the ⓘ explanation, a page's one main
// action, a parked feature and the error screen. Each one keeps the look it had in the app; navigation goes through
// EasmLink, so the app's router link (EasmUIProvider) is used and nothing here imports a framework.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import type { IconName } from '@easm-ui/icons';
import { EasmIcon, EasmLogo, type ProductName } from '@easm-ui/brand';
import { Button, IconButton } from './actions';
import { Badge } from './feedback';
import { Popover } from './overlays';
import { EmptyState } from './patterns';
import { Kbd } from './product';
import { ButtonLink } from './navigation';
import { EasmLink } from './link';
import { cx, UIIcon } from './shared';

export const appPieceComponentNames = [
  'ProductHomeHero', 'ProductHomeBody', 'BrandLockup', 'LoadingMark', 'LiveWaveform', 'IconTapMotion', 'ExplainTip',
  'PrimaryAction', 'ComingSoon', 'ErrorScreen',
] as const;

const rise = (ms: number) => ({ '--_rise-delay': `${ms}ms` }) as CSSProperties;

function useMatchMedia(query: string, fallback = false) {
  const [matches, setMatches] = useState(fallback);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

/* ------------------------------------------------------------------ ProductHomeHero */

export interface HomeMetric {
  label: string;
  value: ReactNode;
  /** The view this figure counts. Without one the figure is plain text. */
  href?: string;
}

export interface HomeAction {
  label: string;
  icon: IconName;
  href?: string;
  onClick?: () => void;
  count?: number | null;
  /** Something waiting on someone: the count in the brand orange, or an orange dot when there is no count. */
  attention?: boolean;
}

export interface HomeSearch {
  placeholder: string;
  /** The placeholder below 640 px. Default "Search". */
  shortPlaceholder?: string;
  /** With onChange the page owns the search (Forms filters its forms); without it the box opens the palette. */
  value?: string;
  onChange?: (value: string) => void;
}

export interface ProductHomeHeroProps {
  /** What this dashboard is for, in one line. */
  headline: string;
  /** The person's first name, after the greeting ("Good morning, Aisha"). */
  greetingName?: string;
  /** Fixes the greeting's words. Default: Good morning / afternoon / evening by the viewer's clock, set after mount. */
  greeting?: string;
  /** The day at a glance: a few plain figures, each a link to the view it counts. */
  metrics?: readonly HomeMetric[];
  search: HomeSearch;
  /** Opens the command palette carrying what was typed: called on the first key typed and on submit, when the page
   *  does not own the search (no search.onChange). */
  onOpenPalette?: (query: string) => void;
  /** Shows the palette shortcut (⌘K on Apple devices, Ctrl K elsewhere) in the box. Default true in palette mode. */
  shortcut?: boolean;
  /** The next moves: chips, each a place to go with its count. */
  actions?: readonly HomeAction[];
  /** The search box, for an app that animates its header search into it. */
  searchBoxRef?: Ref<HTMLLabelElement>;
  className?: string;
}

function greetingFor(date: Date) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** The front of a dashboard: the day at a glance, a greeting and what the dashboard is for, one large search and a
 *  row of next moves, centred over the dot field (which draws the living EASM mark where the hero leaves its
 *  anchor, top right). Each band rises in after the one before; reduced motion shows them at once. */
export function ProductHomeHero({ headline, greetingName, greeting: fixedGreeting, metrics, search, onOpenPalette, shortcut = true, actions, searchBoxRef, className }: ProductHomeHeroProps) {
  const [greeting, setGreeting] = useState(fixedGreeting ?? '');
  const [mac, setMac] = useState<boolean | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const narrow = useMatchMedia('(max-width: 639px)');
  useEffect(() => {
    setGreeting(fixedGreeting ?? greetingFor(new Date()));
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, [fixedGreeting]);

  const ownsSearch = typeof search.onChange === 'function';
  const value = ownsSearch ? (search.value ?? '') : draft;

  return <section aria-label="Overview" className={cx('easm-ui easm-ui-home-hero', className)}>
    {/* Where the dot field draws the living EASM mark: large, top right, half beyond the edge, behind the text. The
        box only measures; it sits in a clipped layer so a phone never counts it past the page's width. */}
    <div aria-hidden="true" className="easm-ui-home-anchor-layer"><div data-easm-mark-anchor className="easm-ui-home-anchor" /></div>
    {metrics && metrics.length > 0 ? <ul className="easm-ui-home-rise easm-ui-home-metrics">
      {metrics.map(m => {
        const figure = <><span className="easm-ui-home-metric-label">{m.label}</span><span className="easm-ui-home-metric-value">{m.value}</span></>;
        return <li key={m.label}>{m.href
          ? <EasmLink href={m.href} className="easm-ui-home-metric">{figure}</EasmLink>
          : <span className="easm-ui-home-metric">{figure}</span>}</li>;
      })}
    </ul> : null}

    <div className="easm-ui-home-centre">
      <div className="easm-ui-home-rise easm-ui-home-heading" style={rise(70)}>
        <p className="easm-ui-home-greeting" suppressHydrationWarning>{greeting ? `${greeting}${greetingName ? `, ${greetingName}` : ''}` : ' '}</p>
        <h1 className="easm-ui-home-headline">{headline}</h1>
      </div>

      <form role="search" className="easm-ui-home-rise easm-ui-home-search" style={rise(140)} onSubmit={e => {
        e.preventDefault();
        if (!ownsSearch) { onOpenPalette?.(draft); setDraft(''); }
      }}>
        <label ref={searchBoxRef} className="easm-ui-home-search-box">
          <UIIcon name="search" size={20} className="easm-ui-home-search-icon" />
          <span className="easm-ui-sr-only">{search.placeholder}</span>
          <input ref={inputRef} type="search" value={value} placeholder={narrow ? (search.shortPlaceholder ?? 'Search') : search.placeholder}
            onChange={e => {
              if (ownsSearch) { search.onChange!(e.target.value); return; }
              // The palette is the search: the first key typed opens it, carrying what was typed.
              const next = e.target.value;
              if (!onOpenPalette) { setDraft(next); return; }
              if (next) { onOpenPalette(next); setDraft(''); inputRef.current?.blur(); }
            }} />
          {!ownsSearch && shortcut && mac !== null ? <Kbd aria-hidden="true" className="easm-ui-home-search-kbd">{mac ? '⌘K' : 'Ctrl K'}</Kbd> : null}
        </label>
      </form>

      {actions && actions.length > 0 ? <ul className="easm-ui-home-rise easm-ui-home-actions" style={rise(210)}>
        {actions.map(a => {
          const body = <>
            <UIIcon name={a.icon} size={16} className="easm-ui-home-action-icon" />
            <span>{a.label}</span>
            {a.attention && a.count == null ? <span aria-hidden="true" className="easm-ui-home-action-dot" /> : null}
            {a.count != null && a.count > 0 ? <span className="easm-ui-home-action-count" data-attention={a.attention || undefined}>{a.count > 99 ? '99+' : a.count}</span> : null}
          </>;
          return <li key={a.label}>{a.href
            ? <EasmLink href={a.href} className="easm-ui-home-action">{body}</EasmLink>
            : <button type="button" onClick={a.onClick} className="easm-ui-home-action">{body}</button>}</li>;
        })}
      </ul> : null}
    </div>
  </section>;
}

export interface ProductHomeBodyProps { className?: string; children: ReactNode }
/** The page's own content under the hero: one centred column (up to 1200 px), blocks 32 px apart, rising in last. */
export function ProductHomeBody({ className, children }: ProductHomeBodyProps) {
  return <div className={cx('easm-ui easm-ui-home-rise easm-ui-home-body', className)} style={rise(280)}>{children}</div>;
}

/* ------------------------------------------------------------------ BrandLockup */

export interface BrandLockupProps {
  /** 'light' is the lockup for a DARK ground (the brand's reversed version); 'dark' (default) for a light one. */
  tone?: 'dark' | 'light';
  /** md: 24 px (chrome). lg: 32 px (entry pages, the boot screen). Never under 24 px: the product lockup's minimum. */
  size?: 'md' | 'lg';
  /** The product the lockup names. Default One ("EASM One"). */
  product?: ProductName;
  /** Accessible name. Default "EASM <product>". */
  title?: string;
  className?: string;
}
/** The platform's signature: the EASM lockup from the brand kit (logo v6), the one the sign-in, password-reset and
 *  launcher screens all render so they cannot drift apart. Inline SVG with its own accessible name. */
export function BrandLockup({ tone = 'dark', size = 'md', product = 'One', title, className }: BrandLockupProps) {
  return <span className={cx('easm-ui-brand-lockup', className)}>
    <EasmLogo product={product} theme={tone === 'light' ? 'dark' : 'light'} height={size === 'lg' ? 32 : 24} title={title ?? `EASM ${product}`} />
  </span>;
}

/* ------------------------------------------------------------------ LoadingMark */

export interface LoadingMarkProps {
  /** What is loading, for screen readers ("Loading conversations"). */
  label: string;
  /** Pixel size of the mark. Default 56. */
  size?: number;
  className?: string;
}
/** A page or panel waiting for its data: the EASM icon in its connecting state. It fades in after a short beat, so a
 *  fast answer never flashes a loader. For a control's own busy state use Spinner. */
export function LoadingMark({ label, size = 56, className }: LoadingMarkProps) {
  return <span role="status" className={cx('easm-ui-loading-mark', className)}>
    <EasmIcon state="connecting" size={size} title="" aria-hidden="true" />
    <span className="easm-ui-sr-only">{label}</span>
  </span>;
}

/* ------------------------------------------------------------------ LiveWaveform */

export interface LiveWaveformProps {
  /** Its name and tooltip. Default "Call in progress". */
  label?: string;
  className?: string;
}
/** A call that is happening now: five bars breathing out of step. Only for live audio (a recording is an
 *  AudioPlayer). Under reduced motion the bars hold still and the label still says it is live. */
export function LiveWaveform({ label = 'Call in progress', className }: LiveWaveformProps) {
  return <span role="img" aria-label={label} title={label} className={cx('easm-ui-live-wave', className)}>
    {[0, 180, 360, 90, 270].map(delay => <span key={delay} style={{ animationDelay: `${delay}ms` }} />)}
  </span>;
}

/* ------------------------------------------------------------------ IconTapMotion */

export interface IconTapPreset { motion: string; ms: number }
/** Icons with a motion of their own in the icon pack; every other icon takes `tap`. */
export const iconTapPresets: Readonly<Record<string, IconTapPreset>> = {
  notification: { motion: 'notify', ms: 440 },
  alert: { motion: 'notify', ms: 440 },
  send: { motion: 'send', ms: 240 },
  sync: { motion: 'sync', ms: 640 },
  refresh: { motion: 'sync', ms: 640 },
  'arrow-sync': { motion: 'sync', ms: 640 },
  'check-circle': { motion: 'confirm', ms: 280 },
  save: { motion: 'settle', ms: 220 },
};
const TAP: IconTapPreset = { motion: 'tap', ms: 360 };
const PRESSABLE = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], summary, label';

export interface IconTapMotionProps {
  /** More or different motions by icon name, merged over iconTapPresets. */
  presets?: Readonly<Record<string, IconTapPreset>>;
  /** Where presses are listened for. Default the document. */
  root?: Document | HTMLElement | null;
}
/** Press feedback for every icon: when a link, button, tab or menu item is pressed, the icon inside it plays its
 *  motion once and rests. Mount once at the app's root; nothing opts in. An icon already in motion (a spinner) is
 *  left alone, and reduced motion is honoured. Renders nothing. */
export function IconTapMotion({ presets, root }: IconTapMotionProps = {}) {
  useEffect(() => {
    const target: Document | HTMLElement | null = root ?? (typeof document === 'undefined' ? null : document);
    if (!target) return;
    const table = { ...iconTapPresets, ...presets };
    const timers = new WeakMap<Element, number>();
    const onDown = (event: Event) => {
      const e = event as PointerEvent;
      if (e.button !== 0) return;
      const control = (e.target as Element | null)?.closest?.(PRESSABLE);
      if (!control || control.closest('[aria-disabled="true"], :disabled')) return;
      const icon = control.querySelector<SVGElement>('svg.easm-icon');
      if (!icon) return;
      // A motion owned by the component (spinner, waveform) is not ours to replace.
      if (icon.hasAttribute('data-motion') && !icon.hasAttribute('data-tap')) return;
      const spec = table[icon.getAttribute('data-icon') ?? ''] ?? TAP;
      const previous = timers.get(icon);
      if (previous) window.clearTimeout(previous);
      icon.removeAttribute('data-active');
      // Restart the animation even when the same icon is pressed again quickly.
      void icon.getBoundingClientRect();
      icon.setAttribute('data-tap', '');
      icon.setAttribute('data-motion', spec.motion);
      icon.setAttribute('data-active', 'true');
      timers.set(icon, window.setTimeout(() => {
        icon.removeAttribute('data-active');
        icon.removeAttribute('data-motion');
        icon.removeAttribute('data-tap');
        timers.delete(icon);
      }, spec.ms + 60));
    };
    target.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    return () => target.removeEventListener('pointerdown', onDown, { capture: true });
  }, [presets, root]);
  return null;
}

/* ------------------------------------------------------------------ ExplainTip */

export interface ExplainTipProps {
  /** The popover's title and the ⓘ button's name. */
  title: string;
  children: ReactNode;
  /** Panel width in px. Default 340. */
  width?: number;
  align?: 'start' | 'center' | 'end';
  className?: string;
}
/** What a page or a section is for, behind a small ⓘ. It opens on a tap as well as a click, so it works on a phone
 *  where a hover tooltip does not. Keep the text to what someone needs to use the page well. */
export function ExplainTip({ title, children, width = 340, align = 'start', className }: ExplainTipProps) {
  return <Popover title={title} width={width} align={align} dim={false}
    trigger={<IconButton icon="info" label={title} variant="subtle" size="sm" className={className} />}>
    <div className="easm-ui-explain-tip">{children}</div>
  </Popover>;
}

/* ------------------------------------------------------------------ PrimaryAction */

export interface PrimaryActionProps {
  label: string;
  icon?: IconName;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Only the floating button on a phone: the desktop layout already offers the action elsewhere. */
  phoneOnly?: boolean;
}
/** A page's one main action ("New form", "Add person"). From 768 px it is the ordinary primary button, where the
 *  page puts it; below, it floats as a round button bottom right, 12 px above the tab bar, and the page keeps room
 *  at its foot (body[data-easm-fab]) so it never covers the last row. One per page; give onClick or href. */
export function PrimaryAction({ label, icon = 'add', onClick, href, disabled, loading, phoneOnly = false }: PrimaryActionProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    document.body.setAttribute('data-easm-fab', '');
    return () => document.body.removeAttribute('data-easm-fab');
  }, []);
  const desktop = href
    ? <ButtonLink href={href} variant="primary" leadingIcon={icon}>{label}</ButtonLink>
    : <Button variant="primary" leadingIcon={icon} onClick={onClick} disabled={disabled} loading={loading}>{label}</Button>;
  const glyph = <UIIcon name={icon} size={24} />;
  const fab = href
    ? <EasmLink href={href} aria-label={label} title={label} className="easm-ui easm-ui-fab">{glyph}</EasmLink>
    : <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled || loading} className="easm-ui easm-ui-fab">{glyph}</button>;
  return <>
    {!phoneOnly ? <span className="easm-ui-primary-action">{desktop}</span> : null}
    {mounted ? createPortal(fab, document.body) : null}
  </>;
}

/* ------------------------------------------------------------------ ComingSoon */

export interface ComingSoonProps {
  title: string;
  description?: ReactNode;
  /** What next to this still works, in one line. */
  stillAvailable?: ReactNode;
  icon?: IconName;
  compact?: boolean;
  className?: string;
}
/** A parked feature, labelled: what it is, that nothing is being collected, and what still works beside it. A
 *  half-working surface is worse than a labelled one. Nothing here is a setting. */
export function ComingSoon({ title, description = 'Planned, and not switched on for this workspace. Nothing here is being collected or stored.', stillAvailable, icon = 'clock', compact = false, className }: ComingSoonProps) {
  const name = title || 'Coming soon';
  return <section className={cx('easm-ui easm-ui-card easm-ui-coming-soon', className)} data-padding={compact ? 'md' : 'lg'} data-compact={compact || undefined} aria-label={name}>
    <span className="easm-ui-tone-icon easm-ui-coming-soon-icon" aria-hidden="true"><UIIcon name={icon} size={compact ? 20 : 24} /></span>
    <div className="easm-ui-coming-soon-body">
      <div className="easm-ui-coming-soon-title"><h3>{name}</h3><Badge tone="neutral" size="sm" icon="clock">Coming soon</Badge></div>
      <div className="easm-ui-coming-soon-text">{description}</div>
      {stillAvailable ? <div className="easm-ui-coming-soon-still">{stillAvailable}</div> : null}
    </div>
  </section>;
}

/* ------------------------------------------------------------------ ErrorScreen */

export interface ErrorScreenProps {
  error: Error & { digest?: string };
  /** Shows Try again. */
  retry?: () => void;
  /** Centre on the whole viewport with the logo (outside the app shell). */
  fullPage?: boolean;
  title?: string;
  /** Where Go to home leads. Default "/". */
  homeHref?: string;
  /** Replaces the full-page navigation to homeHref. */
  onHome?: () => void;
  /** Shows the error's message under the card (development builds). Default false. */
  showDetails?: boolean;
  /** Writes the error to the console once. Default true. */
  log?: boolean;
}
/** What a route shows when something on it throws, in place of a blank page: the error EmptyState, a retry, a way
 *  home and the reference to quote. */
export function ErrorScreen({ error, retry, fullPage = false, title = 'This page could not load', homeHref = '/', onHome, showDetails = false, log = true }: ErrorScreenProps) {
  useEffect(() => { if (log) console.error(error); }, [error, log]);
  const reference = error?.digest ? `Reference ${error.digest}.` : '';
  const body = <div className="easm-ui-error-screen-body">
    <EmptyState kind="error" title={title} description={`Something went wrong while showing it. Try again, or go back to your home page. ${reference}`.trim()}
      action={<div className="easm-ui-error-screen-actions">
        {retry ? <Button variant="primary" leadingIcon="refresh" onClick={() => retry()}>Try again</Button> : null}
        <Button variant="secondary" leadingIcon="home" onClick={() => (onHome ? onHome() : window.location.assign(homeHref))}>Go to home</Button>
      </div>} />
    {showDetails && error?.message ? <pre className="easm-ui-error-screen-details">{error.message}</pre> : null}
  </div>;
  if (!fullPage) return <div className="easm-ui easm-ui-error-screen">{body}</div>;
  return <main className="easm-ui easm-ui-error-screen" data-full-page="true">
    <EasmLogo product="One" height={32} />
    <div className="easm-ui-error-screen-card">{body}</div>
  </main>;
}
