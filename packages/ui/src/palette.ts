import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react';

/** Data colours. Each has a mark colour (3:1 on card and page), a tint and an ink (4.5:1 on its tint). */
export type ChartTone = 'blue' | 'violet' | 'teal' | 'green' | 'amber' | 'coral' | 'sky' | 'honey' | 'indigo' | 'rose' | 'orange' | 'lime' | 'plum';
/** Series order when a caller does not choose (CLR-12, twelve since 2026-10-29): neighbours stay apart for people
 *  with red-green colour blindness as well (test/palette.cjs measures it; blue then violet, the old second step,
 *  nearly merged for them), honey reads as "other" and coral (read as "bad") comes last. Orange stays out: it is the
 *  attention accent. */
export const chartTones: readonly ChartTone[] = ['blue', 'teal', 'amber', 'sky', 'green', 'plum', 'rose', 'violet', 'lime', 'indigo', 'honey', 'coral'];
export const chartTone = (index: number): ChartTone => chartTones[((index % chartTones.length) + chartTones.length) % chartTones.length];
/** Accent colours for small places (avatars, tags, a sidebar icon): the data hues and four tuned from them (indigo
 *  between blue and violet, rose from coral towards violet, orange from the signature, lime from green towards
 *  yellow). Grey is left out: these exist to bring colour. */
export const accentTones: readonly ChartTone[] = ['blue', 'violet', 'teal', 'amber', 'rose', 'sky', 'green', 'indigo', 'orange', 'lime', 'coral'];
/** The same accent for the same name every time, on the server and in the browser alike (a person keeps one
 *  colour across the inbox, the roster and the pipeline). */
export function accentFor(name: string): ChartTone {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return accentTones[hash % accentTones.length];
}

/** The marketing channels, each with one colour that every chart uses (demand list CLR-11): a channel never changes
 *  colour from one view to the next. Paid and organic of the same kind are siblings (search blue and sky, social
 *  indigo and plum); "other" is grey. Keys are the Marketing reporting engine's (lib/marketing/channel.ts). */
export type MarketingChannel = 'paid_search' | 'organic_search' | 'paid_social' | 'organic_social' | 'email' | 'direct' | 'referral'
  | 'whatsapp' | 'display' | 'sms' | 'affiliate' | 'video' | 'other';
export const channelTones: Readonly<Record<MarketingChannel, ChartTone>> = {
  paid_search: 'blue', organic_search: 'sky', paid_social: 'indigo', organic_social: 'plum', email: 'amber', direct: 'teal',
  referral: 'lime', whatsapp: 'green', display: 'orange', sms: 'rose', affiliate: 'coral', video: 'violet', other: 'honey',
};
const channelAliases: Record<string, MarketingChannel> = {
  cpc: 'paid_search', ppc: 'paid_search', sem: 'paid_search', search: 'organic_search', organic: 'organic_search', seo: 'organic_search',
  paid: 'paid_social', social: 'organic_social', newsletter: 'email', mail: 'email', none: 'direct', wa: 'whatsapp', banner: 'display',
};
/** The colour of a channel by its key or a common spelling ("Paid social", "paid-social", "cpc"); unknown channels are grey. */
export function channelTone(channel: string): ChartTone {
  const key = channel.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return channelTones[(key in channelTones ? key : channelAliases[key] ?? 'other') as MarketingChannel];
}

/** The five dashboards' accents (demand list CLR-01): never a status colour, used where a place says which
 *  dashboard it belongs to (the switcher tile, a home hero, a breadcrumb or notification origin chip). */
export type ProductId = 'support' | 'knowledge' | 'marketing' | 'automation' | 'forms';
export const productTones: Readonly<Record<ProductId, ChartTone>> = { support: 'blue', knowledge: 'teal', marketing: 'plum', automation: 'indigo', forms: 'rose' };

export const mark = (tone: ChartTone) => `var(--easm-ui-chart-${tone})`;
/** Local custom properties every chart part reads: the mark, its tint and its ink. */
export const toneStyle = (tone: ChartTone) => ({
  '--easm-chart-tone': mark(tone),
  '--easm-chart-tone-tint': `var(--easm-ui-chart-${tone}-tint)`,
  '--easm-chart-tone-ink': `var(--easm-ui-chart-${tone}-ink)`,
}) as CSSProperties;

export function requireLabel(value: string | undefined, subject: string) {
  if (!value || !value.trim()) throw new Error(`${subject} requires a meaningful label.`);
}
export function requireUnique(items: readonly { id: string; label: string }[], subject: string) {
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => !item.id.trim() || !item.label.trim()))
    throw new Error(`${subject} requires unique IDs and meaningful labels.`);
}
export const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
export const percentOf = (part: number, whole: number) => whole > 0 ? Math.round((part / whole) * 100) : 0;

/** Full numbers for values people read (1,412); compact ones for axes (1.4K). */
export const fullNumber = (locale: string) => (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
export const compactNumber = (locale: string) => {
  const format = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  return (value: number) => format.format(value);
};

/** Wraps a hover-out handler so it ignores touch: a finger lift fires pointerleave straight after the
 * tap, which would otherwise clear the very thing the tap selected. */
export function hoverOut<E extends { pointerType: string }>(clear: () => void) {
  return (event: E) => { if (event.pointerType !== 'touch') clear(); };
}

/** Width of an element, kept current as its container resizes. The ref is a callback ref (it also keeps
 * `current`), so measuring follows the element when it mounts late or is replaced. */
export function useElementWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useMemo(() => {
    const callback = ((element: T | null) => { callback.current = element; setNode(element); }) as RefObject<T | null> & ((element: T | null) => void);
    callback.current = null;
    return callback;
  }, []);
  useEffect(() => {
    if (!node) return;
    const measure = () => setWidth(Math.floor(node.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  // Typed as the ref object it has always been: React calls it as a callback ref because it is a function.
  return [ref as RefObject<T | null>, width] as const;
}
