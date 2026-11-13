'use client';

import { useId, useLayoutEffect, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { finite, toneStyle, useElementWidth, type ChartTone } from './palette';
import { Tooltip, Skeleton } from './feedback';
import { EasmLink } from './link';
import { checkLabel, checkLabelledItems, cx, MissingValue, reportContentProblem, UIIcon, type ComponentSize, type UIIconName } from './shared';

/**
 * Reporting layer: meters, metric tiles and the structural pieces analytics pages are built from.
 * The charts live in charts.tsx. Separate from the 47 core names.
 */
export const insightComponentNames = [
  'ProgressRing', 'Meter', 'MetricTile', 'MetricGroup', 'InlineStats', 'SectionHeading', 'DescriptionList', 'CellStack', 'InfoHint',
] as const;

export { chartTones, chartTone, accentTones, accentFor, channelTones, channelTone, productTones, type ChartTone, type MarketingChannel, type ProductId } from './palette';
/** The plumbing every chart part uses, for product-owned chart chrome: `chartToneStyle(tone)` sets the local
 * --easm-chart-tone, --easm-chart-tone-tint and --easm-chart-tone-ink properties; `chartToneColor(tone)` is the
 * tone's mark colour as a CSS variable. */
export { toneStyle as chartToneStyle, mark as chartToneColor } from './palette';
// Content problems throw in development and tests; in a production build they warn once and the part renders
// what it can (a level out of range is drawn at the nearest end of its scale), so one bad value never blanks a page.
const required = checkLabel;
const uniqueIds = checkLabelledItems;
/** A value to show, or the missing-value dash when it is null, undefined or blank text, never an empty box
 * (the same rule as StatCard). */
const orMissing = (value: ReactNode) => value == null || (typeof value === 'string' && !value.trim()) ? <MissingValue /> : value;
/** A level within 0…max: reported when out of range, then drawn at the nearest end of the scale. */
function level(value: number, max: number, subject: string) {
  if (!finite(max) || max <= 0 || !finite(value) || value < 0 || value > max) reportContentProblem(`${subject} value must be between zero and max.`);
  const top = finite(max) && max > 0 ? max : 100;
  return [Math.min(top, Math.max(0, finite(value) ? value : 0)), top] as const;
}

/* ------------------------------------------------------------------ InfoHint */

export interface InfoHintProps { label: string; children: string; side?: 'top' | 'right' | 'bottom' | 'left'; className?: string }
/** A small ⓘ button that explains a metric. The button is named; the tooltip is supplemental. */
export function InfoHint({ label, children, side = 'top', className }: InfoHintProps) {
  required(label, 'InfoHint');
  return <Tooltip side={side} openOnClick trigger={<button type="button" className={cx('easm-ui-info-hint', className)} aria-label={label}><UIIcon name="info" size={16} /></button>}>{children}</Tooltip>;
}

/* ------------------------------------------------------------ ProgressRing */

export interface ProgressRingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> {
  label: string;
  value: number;
  max?: number;
  size?: ComponentSize;
  tone?: ChartTone;
  /** Centre text; defaults to the percentage. Use valueText to say the same in words. */
  children?: ReactNode;
  valueText?: string;
  /** progress: work under way, read as a progress bar (the default). level: a measured amount that is not
   * moving towards done, such as profile fields captured, read as a meter. */
  kind?: 'progress' | 'level';
}
const ringSizes = { sm: [36, 4], md: [52, 5], lg: [80, 7] } as const;
export function ProgressRing({ label, value: givenValue, max: givenMax = 100, size = 'md', tone = 'blue', children, valueText, kind = 'progress', className, style, ...props }: ProgressRingProps) {
  required(label, 'ProgressRing');
  const [value, max] = level(givenValue, givenMax, 'ProgressRing');
  const [box, stroke] = ringSizes[size];
  const radius = (box - stroke) / 2, circumference = 2 * Math.PI * radius;
  const share = value / max;
  return <div {...props} role={kind === 'level' ? 'meter' : 'progressbar'} aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
    aria-valuetext={valueText ?? `${Math.round(share * 100)}%`} className={cx('easm-ui easm-ui-progress-ring', className)}
    data-size={size} style={{ ...toneStyle(tone), width: box, height: box, ...style }}>
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true" focusable="false">
      <circle cx={box / 2} cy={box / 2} r={radius} strokeWidth={stroke} className="easm-ui-progress-ring-track" />
      {/* At zero the arc keeps square ends, so a round cap does not draw a coloured dot at the top. */}
      <circle cx={box / 2} cy={box / 2} r={radius} strokeWidth={stroke} className="easm-ui-progress-ring-value" data-zero={share === 0 || undefined}
        strokeDasharray={`${share * circumference} ${circumference}`} transform={`rotate(-90 ${box / 2} ${box / 2})`} />
    </svg>
    <span className="easm-ui-progress-ring-center" aria-hidden="true">{children ?? `${Math.round(share * 100)}%`}</span>
  </div>;
}

/* ------------------------------------------------------------------- Meter */

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  label: string;
  value: number;
  max?: number;
  /** 'auto' colours by level: under 40% coral, under 70% amber, otherwise green. */
  tone?: ChartTone | 'auto';
  valueText?: string;
  description?: ReactNode;
  size?: 'sm' | 'md';
  /** Bar and value on one row with the label read but not shown, for table cells. */
  inline?: boolean;
}
/** A measured level (confidence, capacity, completeness), not an operation in progress. */
export function Meter({ label, value: givenValue, max: givenMax = 100, tone = 'auto', valueText, description, size = 'md', inline = false, className, style, ...props }: MeterProps) {
  required(label, 'Meter');
  const [value, max] = level(givenValue, givenMax, 'Meter');
  const id = useId();
  const share = value / max;
  const t: ChartTone = tone === 'auto' ? share < 0.4 ? 'coral' : share < 0.7 ? 'amber' : 'green' : tone;
  const text = valueText ?? `${Math.round(share * 100)}%`;
  return <div {...props} className={cx('easm-ui easm-ui-meter', className)} data-size={size} data-inline={inline || undefined} style={{ ...toneStyle(t), ...style }}>
    <div className="easm-ui-meter-row"><span id={`${id}-label`} className={cx('easm-ui-meter-label', inline && 'easm-ui-sr-only')}>{label}</span><span className="easm-ui-meter-value" aria-hidden="true">{text}</span></div>
    <div role="meter" aria-labelledby={`${id}-label`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text}
      aria-describedby={description ? `${id}-description` : undefined} className="easm-ui-meter-track"><span style={{ width: `${share * 100}%` }} /></div>
    {description ? <p id={`${id}-description`} className="easm-ui-meter-description">{description}</p> : null}
  </div>;
}

/* ----------------------------------------------------- MetricTile / Group */

export interface MetricTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  /** 'neutral' sits on the grey track; a chart tone tints the tile and colours the figure. */
  tone?: ChartTone | 'neutral' | 'plain';
  icon?: UIIconName;
  info?: string;
  size?: ComponentSize;
  loading?: boolean;
}
/** A compact figure inside a card: label, value and an optional caption. */
export function MetricTile({ label, value, caption, tone = 'neutral', icon, info, size = 'md', loading = false, className, style, ...props }: MetricTileProps) {
  required(label, 'MetricTile');
  const tinted = tone !== 'neutral' && tone !== 'plain';
  return <div {...props} className={cx('easm-ui easm-ui-metric-tile', className)} data-tone={tinted ? 'tinted' : tone} data-size={size}
    style={tinted ? { ...toneStyle(tone as ChartTone), ...style } : style} aria-busy={loading || undefined}>
    <span className="easm-ui-metric-label">{icon ? <UIIcon name={icon} size={16} /> : null}<span>{label}</span>{info ? <InfoHint label={`About ${label}`}>{info}</InfoHint> : null}</span>
    <strong className="easm-ui-metric-value">{loading ? <Skeleton width="4ch" /> : orMissing(value)}</strong>
    {caption ? <span className="easm-ui-metric-caption">{caption}</span> : null}
  </div>;
}

export interface MetricGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** The most columns to use, or 'auto' to fit tiles of at least `minWidth` pixels. A fixed count steps down
   * evenly as the group narrows (4 → 2 → 1, 3 or 2 → 1), so tiles never squeeze or leave one alone on a row. */
  columns?: number | 'auto';
  minWidth?: number;
}
export function MetricGroup({ columns = 'auto', minWidth = 160, className, style, children, ...props }: MetricGroupProps) {
  const fixed = columns !== 'auto';
  // The group's own width steps the columns down, so it works on any page, not only inside a Card or Panel
  // (a container query needs a size container above it, and a grid cannot query itself). Before the first
  // measurement the container rules in responsive.css still apply.
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const band = !fixed || !width || width >= 600 ? undefined : width >= 420 ? 'md' : width >= 300 ? 'sm' : 'xs';
  // Cards side by side line up part by part: in each visual row every heading, figure and description takes the
  // height of the tallest of its kind, so a label that wraps ("PBX answered" on two lines) never lowers its figure
  // below its neighbours'. Measured, not subgrid: each card is a size container, and containment rules out subgrid.
  useLayoutEffect(() => {
    const group = ref.current;
    if (!group || typeof ResizeObserver === 'undefined') return;
    const parts = ['.easm-ui-stat-heading', '.easm-ui-stat-value', ':scope > p'];
    const align = () => {
      const cards = Array.from(group.querySelectorAll<HTMLElement>(':scope > .easm-ui-stat-card'));
      const found = cards.map(card => parts.map(part => card.querySelector<HTMLElement>(part)));
      found.flat().forEach(node => { if (node) node.style.minHeight = ''; });
      const rows = new Map<number, number[]>();
      cards.forEach((card, i) => { const top = Math.round(card.offsetTop); rows.set(top, [...(rows.get(top) ?? []), i]); });
      for (const members of rows.values()) {
        if (members.length < 2) continue;
        parts.forEach((_, p) => {
          const tallest = Math.max(...members.map(i => found[i][p]?.offsetHeight ?? 0));
          members.forEach(i => { const node = found[i][p]; if (node && node.offsetHeight < tallest) node.style.minHeight = `${tallest}px`; });
        });
      }
    };
    align();
    const observer = new ResizeObserver(() => align());
    observer.observe(group);
    group.querySelectorAll(':scope > .easm-ui-stat-card').forEach(card => observer.observe(card));
    document.fonts?.ready.then(align, () => undefined);
    return () => observer.disconnect();
  });
  return <div {...props} ref={ref} className={cx('easm-ui easm-ui-metric-group', className)} data-columns={fixed ? columns : undefined} data-narrow={band}
    style={{ ...(fixed ? { '--easm-metric-columns': columns } as CSSProperties : { gridTemplateColumns: `repeat(auto-fit, minmax(min(${minWidth}px, 100%), 1fr))` }), ...style }}>{children}</div>;
}

/* ------------------------------------------------------------- InlineStats */

export interface InlineStat { id: string; label: string; value: ReactNode; tone?: ChartTone }
export interface InlineStatsProps extends HTMLAttributes<HTMLDListElement> { items: readonly InlineStat[]; size?: 'sm' | 'md' }
/** A row of headline figures, value first: "1687 In funnel · 5% Reached applied". */
export function InlineStats({ items, size = 'md', className, ...props }: InlineStatsProps) {
  uniqueIds(items, 'InlineStats');
  return <dl {...props} className={cx('easm-ui easm-ui-inline-stats', className)} data-size={size}>
    {items.map(item => <div key={item.id} style={item.tone ? toneStyle(item.tone) : undefined} data-toned={item.tone ? true : undefined}>
      <dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}

/* ---------------------------------------------------------- SectionHeading */

export interface SectionHeadingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  /** Scope after the title, such as "Last 30 days". */
  meta?: string;
  description?: ReactNode;
  actions?: ReactNode;
  level?: 2 | 3 | 4;
}
/** The small uppercase label that groups cards on a long page. */
export function SectionHeading({ title, meta, description, actions, level = 2, className, ...props }: SectionHeadingProps) {
  required(title, 'SectionHeading');
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  return <div {...props} className={cx('easm-ui easm-ui-section-heading', className)}>
    <div><Heading>{title}{meta ? <span className="easm-ui-section-heading-meta"> · {meta}</span> : null}</Heading>
      {description ? <p>{description}</p> : null}</div>
    {actions ? <div className="easm-ui-section-heading-actions">{actions}</div> : null}
  </div>;
}

/* --------------------------------------------------------- DescriptionList */

export interface DescriptionItem {
  id: string; label: string; value: ReactNode;
  /** A quieter line under the value: what it means, or since when. */
  hint?: ReactNode;
  /** One small action at the end of the row (Change, Copy), so a value is read first and edited on purpose. */
  action?: ReactNode;
}
export interface DescriptionListProps extends HTMLAttributes<HTMLDListElement> {
  items: readonly DescriptionItem[];
  /** rows: label left, value right. columns: label above value, side by side. */
  layout?: 'rows' | 'columns';
  size?: 'sm' | 'md';
}
export function DescriptionList({ items, layout = 'rows', size = 'md', className, ...props }: DescriptionListProps) {
  uniqueIds(items, 'DescriptionList');
  return <dl {...props} className={cx('easm-ui easm-ui-description-list', className)} data-layout={layout} data-size={size}>
    {items.map(item => <div key={item.id} data-action={item.action ? true : undefined}><dt>{item.label}</dt>
      <dd>{orMissing(item.value)}{item.hint ? <span className="easm-ui-description-hint">{item.hint}</span> : null}</dd>
      {item.action ? <dd className="easm-ui-description-action">{item.action}</dd> : null}</div>)}
  </dl>;
}

/* --------------------------------------------------------------- CellStack */

export interface CellStackProps extends HTMLAttributes<HTMLSpanElement> { primary: ReactNode; secondary?: ReactNode; href?: string }
/** A table cell with a main value and a quieter second line ("— / —" over "n = 0"). */
export function CellStack({ primary, secondary, href, className, ...props }: CellStackProps) {
  return <span {...props} className={cx('easm-ui-cell-stack', className)}>
    <span className="easm-ui-cell-stack-primary">{href ? <EasmLink href={href}>{primary}</EasmLink> : primary}</span>
    {secondary != null ? <span className="easm-ui-cell-stack-secondary">{secondary}</span> : null}
  </span>;
}

/** Shared by StatCard and Card headers: an icon in a soft tinted square. */
export function ToneIcon({ icon, tone, size = 'md' }: { icon: UIIconName; tone?: ChartTone; size?: 'sm' | 'md' | 'lg' }) {
  return <span className="easm-ui-tone-icon" data-size={size} data-toned={tone ? true : undefined} style={tone ? toneStyle(tone) : undefined} aria-hidden="true">
    <UIIcon name={icon} size={size === "sm" ? 16 : size === "lg" ? 24 : 20} />
  </span>;
}
