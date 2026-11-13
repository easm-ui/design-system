'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { Skeleton } from './feedback';
import { InfoHint } from './insights';
import { UnmeasuredValue } from './workflow';
import { EasmLink } from './link';
import { chartTone, finite, hoverOut, mark, percentOf, toneStyle, useElementWidth, type ChartTone } from './palette';
import { checkLabel, checkLabelledItems, cx, formatReadableNumber, MissingValue, quietPointerFocus, reportContentProblem, UIIcon, useOverflowing, type ComponentSize } from './shared';

/**
 * Charts for the reporting layer. Every chart states its numbers in text (a legend, a list or a
 * data table), so the drawing itself is decorative and hidden from assistive technology.
 *
 * Content problems (a blank label, a repeated id, a value out of range) throw in development and tests. In a
 * production build they warn once and the chart draws what it can (a negative share as zero, a gauge value at
 * the end of its scale), so one bad record never blanks a report.
 */
export const chartComponentNames = ['SeriesChart', 'Sparkline', 'DonutChart', 'ProportionBar', 'BarList', 'Heatmap', 'Funnel', 'Gauge'] as const;

/* ------------------------------------------------------------------ geometry */

/** Round axis steps (1, 2, 2.5 or 5 × 10ⁿ) with about four intervals. With `integer`, steps are whole numbers
 * of at least 1, so a count axis never reads 0.25 or 0.5. An empty range (all zero) falls back to 0–1. */
function niceTicks(minimum: number, maximum: number, count = 4, integer = false) {
  if (maximum === minimum) maximum = minimum + 1;
  const raw = (maximum - minimum) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map(m => m * power).find(s => s >= raw && (!integer || Number.isInteger(s))) ?? 10 * power;
  const step = integer ? Math.max(1, Math.round(nice)) : nice;
  const ticks: number[] = [];
  for (let value = Math.floor(minimum / step) * step; value <= Math.ceil(maximum / step) * step + step / 2; value += step) ticks.push(Number(value.toFixed(10)));
  return ticks;
}

/** The smallest and largest value, without spreading the array into Math.min/max (which throws on very long data). */
function extent(values: readonly number[]) {
  let low = Infinity, high = -Infinity;
  for (const value of values) { if (value < low) low = value; if (value > high) high = value; }
  return [low, high] as const;
}

/** Decimals needed to write a step exactly: 0.25 needs 2, 0.5 needs 1, 50 needs none. */
function stepDecimals(step: number) {
  let digits = 0;
  while (digits < 6 && Math.abs(Math.round(step * 10 ** digits) - step * 10 ** digits) > 1e-6) digits++;
  return digits;
}

/** Values people read (1,412.5; 0.023): the default for legends, tooltips, lists and data tables. */
const readable = (locale: string) => (value: number) => formatReadableNumber(value, locale, 1);

/** Compact axis labels (1.4K) with as many decimals as the tick step needs, so ticks 0.25 apart never read "0.3". */
function axisNumber(locale: string, ticks: readonly number[]) {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  const top = Math.max(Math.abs(ticks[0] ?? 0), Math.abs(ticks[ticks.length - 1] ?? 0));
  const unit = top >= 1e12 ? 1e12 : top >= 1e9 ? 1e9 : top >= 1e6 ? 1e6 : top >= 1e3 ? 1e3 : 1;
  const format = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: stepDecimals(step / unit) });
  return (value: number) => format.format(value);
}

/** DOM ids built from React's id and an index, never from caller ids, which may hold spaces or other characters
 * that break `url(#…)` references. */
const domId = (id: string) => id.replace(/[^\w-]/g, '');

type Point = readonly [number, number];
/** Monotone cubic interpolation (Fritsch–Carlson): smooth, and never overshoots the data. */
function monotone(points: readonly Point[], move = true) {
  if (!points.length) return '';
  const start = `${move ? 'M' : 'L'}${points[0][0]} ${points[0][1]}`;
  if (points.length < 2) return start;
  const n = points.length, dx: number[] = [], slope: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = points[i + 1][0] - points[i][0]; slope[i] = (points[i + 1][1] - points[i][1]) / (dx[i] || 1); }
  const t: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  t[n - 1] = slope[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / slope[i], b = t[i + 1] / slope[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * slope[i]; t[i + 1] = k * b * slope[i]; }
  }
  let d = start;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1], h = dx[i] / 3;
    d += ` C${x0 + h} ${y0 + t[i] * h} ${x1 - h} ${y1 - t[i + 1] * h} ${x1} ${y1}`;
  }
  return d;
}

/** A bar with rounded ends on its free side only. */
function barPath(x: number, y: number, w: number, h: number, r: number, round: 'top' | 'bottom' | 'none') {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  if (round === 'none' || radius === 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  if (round === 'top') return `M${x} ${y + h}V${y + radius}Q${x} ${y} ${x + radius} ${y}H${x + w - radius}Q${x + w} ${y} ${x + w} ${y + radius}V${y + h}Z`;
  return `M${x} ${y}H${x + w}V${y + h - radius}Q${x + w} ${y + h} ${x + w - radius} ${y + h}H${x + radius}Q${x} ${y + h} ${x} ${y + h - radius}Z`;
}

const motionDelay = (index: number, count: number) => ({ '--easm-chart-i': Math.min(index, 24) * (count > 24 ? 10 : 22) }) as CSSProperties;

function DataTableDisclosure({ title, caption, head, rows }: { title: string; caption: string; head: ReactNode; rows: ReactNode }) {
  // A region (and a Tab stop) only when the table is wider than the card and has to scroll.
  const [scrollRef, scrolls] = useOverflowing<HTMLDivElement>();
  return <details className="easm-ui-chart-data">
    <summary><UIIcon name="table" size={16} /><span>View data table</span><UIIcon name="chevron-down" size={16} /></summary>
    <div ref={scrollRef} className="easm-ui-data-table-scroll" {...(scrolls ? { role: 'region', 'aria-label': `${title} values`, tabIndex: 0 } : {})} {...quietPointerFocus()}>
      <table><caption className="easm-ui-sr-only">{caption}</caption><thead>{head}</thead><tbody>{rows}</tbody></table>
    </div>
  </details>;
}

function ChartHeader({ id, title, info, description, actions, summary, level }: { id: string; title: string; info?: string; description?: ReactNode; actions?: ReactNode; summary?: ReactNode; level: 2 | 3 | 4 }) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  // The figure is named by the title alone: the ⓘ sits beside it in the heading, outside the named span.
  return <figcaption className="easm-ui-chart-header">
    <div className="easm-ui-chart-heading">
      <Heading className="easm-ui-chart-title"><span id={`${id}-title`}>{title}</span>{info ? <InfoHint label={`About ${title}`}>{info}</InfoHint> : null}</Heading>
      {description ? <p className="easm-ui-chart-description">{description}</p> : null}
    </div>
    {actions ? <div className="easm-ui-chart-actions">{actions}</div> : null}
    {summary ? <div className="easm-ui-chart-summary">{summary}</div> : null}
  </figcaption>;
}

/* ------------------------------------------------------------- SeriesChart */

/** Where a figure comes from (demand list CLR-07). Verified and external figures are drawn solid, self-reported
 * ones outlined, provisional ones (a provider still adjusting its last ~72 h) dashed, and an unmeasured one as a
 * hollow track with a dash and its reason. The words are always said too: in the legend, a note under the chart,
 * the data table and to screen readers. Never add a self-reported figure to a verified one. */
export type Provenance = 'verified' | 'external' | 'self-reported' | 'provisional' | 'unmeasured';
const provenanceWords: Partial<Record<Provenance, string>> = { external: 'external', 'self-reported': 'self-reported', provisional: 'provisional' };
/** A legend or tooltip swatch: filled, or an outline for a self-reported series. */
function swatch(tone: ChartTone, provenance?: Provenance): CSSProperties {
  return provenance === 'self-reported' ? { background: 'transparent', boxShadow: `inset 0 0 0 2px ${mark(tone)}` } : { background: mark(tone) };
}
export interface ChartSeries {
  id: string;
  label: string;
  tone?: ChartTone;
  /** A dashed line, for a comparison such as the previous period. */
  dashed?: boolean;
  /** Self-reported series are drawn outlined (a hollow line, outlined bars); external ones like verified. */
  provenance?: 'verified' | 'external' | 'self-reported';
}
export interface SeriesDatum {
  id: string;
  label: string;
  values: Readonly<Record<string, number | null | undefined>>;
  /** With a single bar series, colours this category (bands such as low / medium / high). */
  tone?: ChartTone;
  /** Values that may still change (a provider's last ~72 h): lines turn dashed from here on, bars are drawn dashed. */
  provisional?: boolean;
}
export type SeriesChartKind = 'line' | 'area' | 'stacked-area' | 'bar' | 'stacked-bar';
export interface SeriesChartProps {
  title: string;
  description?: ReactNode;
  /** How the figure is measured, behind an ⓘ next to the title. */
  info?: string;
  actions?: ReactNode;
  /** A headline under the title, such as the period total and its change. */
  summary?: ReactNode;
  series: readonly ChartSeries[];
  data: readonly SeriesDatum[];
  kind?: SeriesChartKind;
  valueLabel?: string;
  /** Plot height in pixels at a medium width. The plot shortens in narrow containers and grows in very
   * wide ones so it keeps a readable shape; set fixedHeight to keep exactly this height. */
  height?: number;
  fixedHeight?: boolean;
  /** Legend chips that show and hide series. Defaults to on for more than one series. */
  legend?: boolean;
  loading?: boolean;
  error?: string;
  locale?: string;
  formatValue?: (value: number) => string;
  formatAxis?: (value: number) => string;
  /** Whole-number axis steps (1, 2, 5…), for counts. Inferred when every value is a whole number; set false to
   * allow fractional steps anyway, or true to force whole steps. */
  integerTicks?: boolean;
  headingLevel?: 2 | 3 | 4;
  appearance?: 'card' | 'plain';
  className?: string;
}

/** Narrow plots get shorter and very wide plots taller, so the shape stays readable on a phone and on a
 * wide monitor alike. */
export function fitHeight(height: number, width: number) {
  if (width < 440) return Math.max(160, Math.round(height * 0.78));
  if (width > 1000) return Math.min(Math.round(height * 1.4), Math.round(height + (width - 1000) * 0.16));
  return height;
}

/** Values over shared categories: smooth lines, soft areas, grouped or stacked bars.
 * Hover or the arrow keys read one category; the data table is always one click away. */
export function SeriesChart({ title, description, info, actions, summary, series, data, kind = 'area', valueLabel = 'Value',
  height = 240, fixedHeight = false, legend, loading = false, error, locale = 'en', formatValue, formatAxis, integerTicks, headingLevel = 3, appearance = 'card', className }: SeriesChartProps) {
  checkLabel(title, 'SeriesChart');
  if (!series.length) reportContentProblem('SeriesChart requires at least one series.');
  checkLabelledItems(series, 'SeriesChart series');
  checkLabelledItems(data, 'SeriesChart data');
  const format = formatValue ?? readable(locale);
  const id = domId(useId());
  const [plotRef, measured] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  // The hover layer (guide, dots, band, tooltip) stays mounted where it last was and fades out in place, so the
  // next hover glides from there instead of popping in. `at` is where it sits.
  const lastActive = useRef<number | null>(null);
  if (active !== null) lastActive.current = active;
  const at = active ?? lastActive.current;
  // The tooltip follows the pointer's height. That is written straight to the tooltip, never to state: moving the
  // pointer within a category re-renders nothing.
  const tipRef = useRef<HTMLDivElement>(null);
  const pointerY = useRef<number | null>(null);
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const [announce, setAnnounce] = useState('');
  const tones = series.map((s, i) => s.tone ?? chartTone(i));
  const shown = series.map((s, i) => ({ s, i, tone: tones[i] })).filter(item => !hidden.includes(item.s.id));
  const stacked = kind === 'stacked-bar' || kind === 'stacked-area';
  const bars = kind === 'bar' || kind === 'stacked-bar';
  if (stacked && data.some(d => series.some(s => { const v = d.values[s.id]; return finite(v) && v < 0; })))
    reportContentProblem('Stacked charts require nonnegative values.');
  // (In production a negative value in a stack is drawn as zero.)
  const read = (d: SeriesDatum, s: ChartSeries) => { const v = d.values[s.id]; return finite(v) ? (stacked && v < 0 ? 0 : v) : null; };
  const all = data.flatMap(d => series.map(s => read(d, s))).filter(finite);
  const totals = data.map(d => shown.reduce((sum, { s }) => sum + (read(d, s) ?? 0), 0));
  const visible = data.flatMap(d => shown.map(({ s }) => read(d, s))).filter(finite);
  // The scale follows the data: no forced maximum of 1, so rates of 0.02–0.05 fill the plot. Only an empty or
  // all-zero range falls back to 0–1. Counts (every value whole) get whole-number steps.
  const [low, high] = extent(visible);
  const top = stacked ? extent(totals)[1] : high;
  const ticks = niceTicks(Math.min(0, low), Math.max(0, top), 4, integerTicks ?? visible.every(v => Number.isInteger(v)));
  const axis = formatAxis ?? axisNumber(locale, ticks);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const axisWidth = Math.max(26, ...ticks.map(t => axis(t).length * 6.6 + 10));
  const width = Math.max(200, measured);
  const padTop = 12, bottom = 28, plotHeight = Math.max(120, fixedHeight || !measured ? height : fitHeight(height, measured));
  const plotWidth = width - axisWidth - 6;
  const band = plotWidth / Math.max(1, data.length);
  const x = (i: number) => axisWidth + band * (i + 0.5);
  const y = (v: number) => padTop + (1 - (v - yMin) / (yMax - yMin || 1)) * (plotHeight - padTop - bottom);
  const zero = y(Math.max(0, yMin));
  let longest = 3;
  for (const d of data) longest = Math.max(longest, Math.min(14, d.label.length));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotWidth / (longest * 6.4 + 20)))));
  const labelChars = Math.max(4, Math.floor((band * labelEvery - 8) / 6.4));
  const empty = !all.length;
  const sourced = (s: ChartSeries) => s.provenance && provenanceWords[s.provenance] ? `${s.label} (${provenanceWords[s.provenance]})` : s.label;
  const provisionalAt = data.findIndex(d => d.provisional);
  const describe = (i: number) => `${data[i].label}${data[i].provisional ? ' (provisional)' : ''}: ${shown.map(({ s }) => `${sourced(s)} ${read(data[i], s) === null ? 'not available' : format(read(data[i], s) as number)}`).join(', ')}${stacked && shown.length > 1 ? `, total ${format(totals[i])}` : ''}`;
  const placeTip = () => {
    const tip = tipRef.current;
    if (!tip) return;
    const height = tip.offsetHeight;
    const top = pointerY.current === null ? 6 : Math.max(6, Math.min(plotHeight - height - 6, pointerY.current - height / 2));
    tip.style.setProperty('--easm-ui-tip-y', `${top}px`);
  };
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left - axisWidth) / band);
    pointerY.current = event.clientY - box.top;
    setActive(index >= 0 && index < data.length ? index : null);
    placeTip();
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = data.length - 1;
    const next = event.key === 'ArrowRight' ? Math.min(last, (active ?? -1) + 1) : event.key === 'ArrowLeft' ? Math.max(0, (active ?? 1) - 1)
      : event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'Escape' ? null : undefined;
    if (next === undefined) return;
    event.preventDefault();
    pointerY.current = null;
    setActive(next);
    setAnnounce(next === null ? '' : describe(next));
  };
  const toggle = (sid: string) => setHidden(current => current.includes(sid) ? current.filter(h => h !== sid) : current.length >= series.length - 1 ? current : [...current, sid]);

  // Stacked layers: cumulative lower and upper bounds per category.
  const layers = useMemo(() => {
    const base = data.map(() => 0);
    return shown.map(({ s }) => data.map((d, i) => { const lo = base[i]; base[i] += read(d, s) ?? 0; return [lo, base[i]] as const; }));
  }, [data, stacked, shown.map(item => item.s.id).join('|')]);

  let marks: ReactNode = null;
  if (!empty && !bars) {
    // A stacked area stops where any shown series is missing and starts again after it, as lines do, rather than
    // dipping as though the missing value were zero.
    const spans: number[][] = [[]];
    if (kind === 'stacked-area') data.forEach((d, i) => { if (shown.some(({ s }) => read(d, s) === null)) spans.push([]); else spans[spans.length - 1].push(i); });
    const stackRuns = spans.filter(span => span.length);
    marks = <>
      {/* Gradient ids come from the series position, never its id, which may hold spaces that break url(#…). */}
      <defs>{shown.map(({ s, i: si, tone }) => <linearGradient key={s.id} id={`${id}-g${si}`} x1="0" x2="0" y1="0" y2="1" style={{ color: mark(tone) }}>
        <stop offset="0" stopColor="currentColor" stopOpacity={kind === 'stacked-area' ? 0.5 : 0.24} />
        <stop offset="1" stopColor="currentColor" stopOpacity={kind === 'stacked-area' ? 0.18 : 0.01} />
      </linearGradient>)}</defs>
      {(kind === 'stacked-area' ? [...shown].reverse() : shown).map(item => {
        const { s, i: si, tone } = item;
        const li = shown.indexOf(item);
        const gradient = `url(#${id}-g${si})`;
        let runs: Point[][];
        let tails: Point[][] = [];
        let fills: string[] = [];
        if (kind === 'stacked-area') {
          runs = stackRuns.map(span => span.map(i => [x(i), y(layers[li][i][1])] as Point));
          fills = stackRuns.map((span, ri) => `${monotone(runs[ri])} ${monotone(span.map(i => [x(i), y(layers[li][i][0])] as Point).reverse(), false)} Z`);
        } else {
          runs = [[]];
          const at: number[][] = [[]];
          data.forEach((d, i) => { const v = read(d, s); if (v === null) { runs.push([]); at.push([]); } else { runs[runs.length - 1].push([x(i), y(v)]); at[at.length - 1].push(i); } });
          // From the first provisional category on, the line continues dashed: the last settled point joins it.
          if (provisionalAt >= 0) {
            const settled: Point[][] = [];
            runs.forEach((run, ri) => {
              const cut = at[ri].findIndex(i => i >= provisionalAt);
              if (cut === -1) settled.push(run);
              else { if (cut > 0) settled.push(run.slice(0, cut)); tails.push(run.slice(Math.max(0, cut - 1))); }
            });
            runs = settled;
            tails = tails.filter(run => run.length > 1);
          }
          runs = runs.filter(run => run.length);
        }
        const lastRun = tails.length ? tails[tails.length - 1] : runs[runs.length - 1];
        const last = lastRun?.[lastRun.length - 1];
        const hollow = s.provenance === 'self-reported';
        return <g key={s.id} style={{ color: mark(tone) }} className="easm-ui-series-layer" data-provenance={s.provenance}>
          {fills.map((d, fi) => <path key={`f${fi}`} d={d} fill={gradient} className="easm-ui-series-fill" />)}
          {kind === 'area' && !s.dashed && !hollow && [...runs, ...tails].map((run, ri) => run.length > 1 && <path key={`a${ri}`} className="easm-ui-series-fill" fill={gradient}
            d={`${monotone(run)} L${run[run.length - 1][0]} ${zero} L${run[0][0]} ${zero} Z`} data-provisional={ri >= runs.length || undefined} />)}
          {runs.map((run, ri) => <path key={ri} d={monotone(run)} pathLength={s.dashed ? undefined : 1} className="easm-ui-series-line" data-dashed={s.dashed || undefined} />)}
          {/* Self-reported: the same line hollowed by a core in the card's colour, so it reads as an outline. */}
          {hollow && runs.map((run, ri) => <path key={`c${ri}`} d={monotone(run)} pathLength={s.dashed ? undefined : 1} className="easm-ui-series-line easm-ui-series-line-core" data-dashed={s.dashed || undefined} />)}
          {tails.map((run, ri) => <path key={`t${ri}`} d={monotone(run)} className="easm-ui-series-line" data-dashed="true" data-provisional="true" />)}
          {active === null && last && !s.dashed && <circle cx={last[0]} cy={last[1]} r={3.5} className="easm-ui-series-end" data-hollow={hollow || tails.length > 0 || undefined} />}
        </g>;
      })}
      {at !== null && at < data.length && <line x1={0} x2={0} y1={padTop} y2={plotHeight - bottom} className="easm-ui-series-guide"
        data-visible={active !== null || undefined} style={{ transform: `translateX(${x(at)}px)` }} />}
      {/* A stacked area draws nothing at a category where a shown series is missing, so no dot floats there either. */}
      {at !== null && at < data.length && !(kind === 'stacked-area' && shown.some(({ s }) => read(data[at], s) === null)) && shown.map(({ s, tone }, li) => {
        const own = read(data[at], s);
        const v = own === null ? null : kind === 'stacked-area' ? layers[li][at][1] : own;
        return v === null ? null : <g key={s.id} className="easm-ui-series-marker" data-visible={active !== null || undefined}
          style={{ color: mark(tone), transform: `translate(${x(at)}px, ${y(v)}px)` }}>
          <circle cx={0} cy={0} r={9} className="easm-ui-series-halo" />
          <circle cx={0} cy={0} r={4.5} className="easm-ui-series-dot" />
        </g>;
      })}
    </>;
  } else if (!empty) {
    const singleBar = series.length === 1;
    const groupWidth = Math.min(band * (data.length > 20 ? 0.66 : 0.58), kind === 'stacked-bar' || singleBar ? 40 : 18 * shown.length + 3 * (shown.length - 1));
    marks = data.map((d, i) => {
      const dim = active !== null && active !== i;
      if (kind === 'stacked-bar') {
        const segs = shown.map((item, li) => ({ ...item, lo: layers[li][i][0], hi: layers[li][i][1] })).filter(seg => seg.hi > seg.lo);
        return <g key={d.id} data-dim={dim || undefined} className="easm-ui-series-bar" style={motionDelay(i, data.length)}>
          {segs.map((seg, si) => {
            const top0 = y(seg.hi), bottom0 = y(seg.lo), gap = si > 0 ? 1.5 : 0;
            return <path key={seg.s.id} d={barPath(x(i) - groupWidth / 2, top0, groupWidth, Math.max(0.5, bottom0 - top0 - gap), 5, si === segs.length - 1 ? 'top' : 'none')} style={{ fill: mark(seg.tone), stroke: mark(seg.tone) }}
              data-provenance={seg.s.provenance} data-provisional={d.provisional || undefined} />;
          })}
        </g>;
      }
      const barWidth = (groupWidth - 3 * (shown.length - 1)) / shown.length;
      return <g key={d.id} data-dim={dim || undefined} className="easm-ui-series-bar" style={motionDelay(i, data.length)}>
        {shown.map(({ s, tone }, si) => {
          const v = read(d, s);
          if (v === null) return null;
          const bx = x(i) - groupWidth / 2 + si * (barWidth + 3);
          const yTop = y(Math.max(0, v)), yBottom = y(Math.min(0, v));
          const t = singleBar && d.tone ? d.tone : tone;
          return <path key={s.id} d={barPath(bx, yTop, barWidth, Math.max(1, yBottom - yTop), 5, v >= 0 ? 'top' : 'bottom')}
            style={{ fill: mark(t), stroke: mark(t) }} data-provenance={s.provenance} data-provisional={d.provisional || undefined} />;
        })}
      </g>;
    });
  }

  // The tooltip opens towards the side with more room and never grows past it, so it stays inside the plot.
  const tipX = at === null ? 0 : x(at);
  const roomRight = width - tipX - 14, roomLeft = tipX - 14;
  const tipRight = roomRight >= 240 || roomRight >= roomLeft;
  const tipRoom = Math.max(96, Math.min(240, tipRight ? roomRight : roomLeft));
  // It glides to each category and changes side by sliding across, never by jumping (see .easm-ui-series-tooltip).
  const tip = at !== null && at < data.length && <div ref={tipRef} className="easm-ui-series-tooltip" aria-hidden="true" data-side={tipRight ? 'right' : 'left'}
    data-visible={active !== null || undefined} style={{ '--easm-ui-tip-x': `${tipX}px`, maxWidth: tipRoom, minWidth: Math.min(156, tipRoom) } as CSSProperties}>
    <strong>{data[at].label}{data[at].provisional ? <span className="easm-ui-series-tooltip-note"> · provisional</span> : null}</strong>
    {shown.map(({ s, tone }) => {
      const v = read(data[at], s);
      return <span key={s.id}><i style={swatch(series.length === 1 && data[at].tone ? data[at].tone as ChartTone : tone, s.provenance)} data-dashed={s.dashed || undefined} /><em>{sourced(s)}</em><b>{v === null ? '—' : format(v)}</b></span>;
    })}
    {stacked && shown.length > 1 && <span className="easm-ui-series-tooltip-total"><em>Total</em><b>{format(totals[at])}</b></span>}
  </div>;
  // A new category can change the tooltip's height; keep it centred on the pointer and inside the plot.
  useLayoutEffect(placeTip);

  return <figure className={cx('easm-ui easm-ui-series-chart', className)} data-appearance={appearance} data-kind={kind} aria-labelledby={`${id}-title`} aria-busy={loading || undefined}>
    <ChartHeader id={id} title={title} info={info} description={description} actions={actions} summary={summary} level={headingLevel} />
    {/* The legend stays while loading, so the plot does not move down when the data arrives. */}
    {(legend ?? series.length > 1) && !error && <div className="easm-ui-chart-legend" role="group" aria-label={`Show or hide ${title} series`}>
      {series.map((s, i) => {
        const on = !hidden.includes(s.id), locked = on && shown.length === 1;
        return <button key={s.id} type="button" aria-pressed={on} aria-disabled={locked || undefined} aria-describedby={locked ? `${id}-legend-note` : undefined}
          onClick={() => toggle(s.id)} className="easm-ui-chart-legend-item">
          <i style={swatch(tones[i], s.provenance)} data-dashed={s.dashed || undefined} aria-hidden="true" />{s.label}
          {s.provenance && provenanceWords[s.provenance] ? <span className="easm-ui-chart-legend-source">{provenanceWords[s.provenance]}</span> : null}
        </button>;
      })}
      <span id={`${id}-legend-note`} hidden>At least one series stays visible.</span>
    </div>}
    <div ref={plotRef} className="easm-ui-chart-measure" aria-hidden="true" />
    {error ? <div className="easm-ui-chart-message" role="alert"><UIIcon name="error-circle" /><p>{error}</p></div>
      : loading ? <><div className="easm-ui-chart-placeholder" style={{ height: plotHeight }}><Skeleton shape="rect" /></div><div className="easm-ui-chart-data-reserve" aria-hidden="true" /></>
      : empty ? <div className="easm-ui-chart-message" style={{ minHeight: plotHeight }}><UIIcon name="analytics" /><p>No measured values in this range.</p></div>
      : <div className="easm-ui-series-plot" tabIndex={0} role="group" aria-roledescription="chart"
          aria-label={`${title}, ${valueLabel}`} aria-describedby={`${id}-keys`}
          onKeyDown={onKey} onBlur={() => { setActive(null); setAnnounce(''); }}>
          <svg width={width} height={plotHeight} viewBox={`0 0 ${width} ${plotHeight}`} aria-hidden="true" focusable="false"
            onPointerMove={pick} onPointerDown={pick} onPointerLeave={hoverOut(() => setActive(null))}>
            {ticks.map(t => <g key={t}>
              <line x1={axisWidth} x2={width} y1={y(t)} y2={y(t)} className={t === 0 ? 'easm-ui-series-baseline' : 'easm-ui-series-grid'} />
              <text x={axisWidth - 10} y={y(t) + 4} textAnchor="end" className="easm-ui-series-axis">{axis(t)}</text>
            </g>)}
            {data.map((d, i) => (i % labelEvery === 0 || (i === data.length - 1 && (data.length - 1) % labelEvery > labelEvery / 2))
              ? <text key={d.id} x={x(i)} y={plotHeight - 8} textAnchor="middle" className="easm-ui-series-axis" data-active={active === i || undefined}>
                  {d.label.length > labelChars ? `${d.label.slice(0, labelChars - 1)}…` : d.label}</text> : null)}
            {bars && at !== null && at < data.length && <rect x={-band / 2 + 2} y={padTop - 4} width={band - 4} height={plotHeight - padTop - bottom + 4} rx={8}
              className="easm-ui-series-band" data-visible={active !== null || undefined} style={{ transform: `translateX(${x(at)}px)` }} />}
            {marks}
          </svg>
          {tip}
          <span className="easm-ui-sr-only" aria-live="polite">{announce}</span>
          {/* Instructions describe the plot rather than name it, so they are not repeated on every visit. */}
          <span id={`${id}-keys`} hidden>Use the left and right arrow keys to read each category, Home and End for the first and last.</span>
        </div>}
    {/* What the drawing styles mean, in words, whenever the chart uses them. */}
    {!loading && !error && !empty && (provisionalAt >= 0 || series.some(s => s.provenance === 'self-reported')) && <p className="easm-ui-chart-provenance">
      {provisionalAt >= 0 && <span><i data-style="provisional" aria-hidden="true" />Dashed from {data[provisionalAt].label}: provisional, may still change</span>}
      {series.some(s => s.provenance === 'self-reported') && <span><i data-style="self-reported" aria-hidden="true" />Outlined: self-reported, never added to verified figures</span>}
    </p>}
    {!loading && !error && !empty && <DataTableDisclosure title={title} caption={`${title}, ${valueLabel}`}
      head={<tr><th scope="col">Category</th>{series.map(s => <th key={s.id} scope="col" data-align="end">{sourced(s)}</th>)}{stacked && series.length > 1 ? <th scope="col" data-align="end">Total</th> : null}</tr>}
      rows={data.map(d => <tr key={d.id}><th scope="row">{d.label}{d.provisional ? ' (provisional)' : ''}</th>
        {series.map(s => <td key={s.id} data-align="end">{read(d, s) === null ? <MissingValue /> : format(read(d, s) as number)}</td>)}
        {stacked && series.length > 1 ? <td data-align="end">{format(series.reduce((sum, s) => sum + (read(d, s) ?? 0), 0))}</td> : null}</tr>)} />}
    {/* Always mounted, so screen readers hear the change rather than a region that appears with its text. */}
    <span className="easm-ui-sr-only" role="status">{loading ? `Loading ${title}.` : ''}</span>
  </figure>;
}

/* --------------------------------------------------------------- Sparkline */

export interface SparklineProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'role'> {
  /** Says what the line shows; the first and last values are added to it. */
  label: string;
  data: readonly number[];
  tone?: ChartTone;
  height?: number;
  /** Fill under the line. */
  area?: boolean;
  locale?: string;
}
/** A small trend line for tiles and table rows. */
export function Sparkline({ label, data, tone = 'blue', height = 36, area = true, locale = 'en', className, style, ...props }: SparklineProps) {
  checkLabel(label, 'Sparkline');
  const [ref, width] = useElementWidth<HTMLSpanElement>();
  const id = domId(useId());
  const values = data.filter(finite);
  const [lo, hi] = extent(values);
  const w = Math.max(40, width), pad = 3;
  const pts = values.map((v, i) => [pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2), pad + (1 - (v - lo) / (hi - lo || 1)) * (height - pad * 2)] as Point);
  const format = readable(locale);
  const text = values.length ? `${label}: from ${format(values[0])} to ${format(values[values.length - 1])}` : `${label}: no data`;
  const end = pts[pts.length - 1];
  return <span {...props} ref={ref} role="img" aria-label={text} className={cx('easm-ui easm-ui-sparkline', className)} style={{ ...toneStyle(tone), height, ...style }}>
    {width > 0 && pts.length > 1 && <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden="true" focusable="false">
      <defs><linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={mark(tone)} stopOpacity={0.28} /><stop offset="1" stopColor={mark(tone)} stopOpacity={0} /></linearGradient></defs>
      {area && <path d={`${monotone(pts)} L${end[0]} ${height} L${pts[0][0]} ${height} Z`} fill={`url(#${id}-g)`} className="easm-ui-series-fill" />}
      <path d={monotone(pts)} pathLength={1} className="easm-ui-sparkline-line" />
      <circle cx={end[0]} cy={end[1]} r={2.75} className="easm-ui-sparkline-end" />
    </svg>}
  </span>;
}

/* -------------------------------------------------------------- DonutChart */

export interface ShareSegment { id: string; label: string; value: number; tone?: ChartTone }
export interface DonutChartProps {
  label: string;
  segments: readonly ShareSegment[];
  centerValue?: ReactNode;
  centerLabel?: ReactNode;
  legend?: 'side' | 'bottom' | 'none';
  size?: ComponentSize;
  locale?: string;
  formatValue?: (value: number) => string;
  className?: string;
}
const donutSizes = { sm: [124, 14], md: [168, 18], lg: [208, 22] } as const;
/** Checks the segments and returns them ready to draw: in production a negative or non-finite value counts as zero. */
function checkSegments(segments: readonly ShareSegment[], subject: string): readonly ShareSegment[] {
  checkLabelledItems(segments, subject);
  if (segments.some(s => !finite(s.value) || s.value < 0)) reportContentProblem(`${subject} values must be finite and nonnegative.`);
  return segments.map(s => finite(s.value) && s.value >= 0 ? s : { ...s, value: 0 });
}
/** Share of a whole, as a ring with rounded segments. The legend states each value and share. */
export function DonutChart({ label, segments: given, centerValue, centerLabel = 'Total', legend = 'side', size = 'md', locale = 'en', formatValue, className }: DonutChartProps) {
  checkLabel(label, 'DonutChart');
  const segments = checkSegments(given, 'DonutChart segments');
  const format = formatValue ?? readable(locale);
  const [active, setActive] = useState<string | null>(null);
  const [rootRef, rootWidth] = useElementWidth<HTMLDivElement>();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const [box, stroke] = donutSizes[size];
  // A side legend needs room for labels and values; below that it moves under the ring.
  const layout = legend === 'side' && rootWidth > 0 && rootWidth < box + 280 ? 'bottom' : legend;
  const radius = (box - stroke) / 2 - 4, circumference = 2 * Math.PI * radius;
  // The hole as drawn now: a highlighted arc is 5 px thicker and grows inward. 2 px of clearance on each side.
  const hole = Math.floor(2 * (radius - (stroke + (active ? 5 : 0)) / 2) - 4);
  const present = segments.filter(s => s.value > 0);
  const gap = present.length > 1 ? 4 : 0;
  // Rounded caps add half the stroke at each end; draw them only where every arc can absorb that.
  const round = present.length > 0 && present.every(s => (s.value / total) * circumference > stroke + gap + 2);
  const tones = segments.map((s, i) => s.tone ?? chartTone(i));
  const focus = segments.find(s => s.id === active);
  let offset = 0;
  return <div ref={rootRef} role="group" aria-label={label} className={cx('easm-ui easm-ui-donut', className)} data-legend={layout} data-size={size}>
    <div className="easm-ui-donut-figure" style={{ width: box, height: box }}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true" focusable="false" className="easm-ui-donut-ring">
        <circle cx={box / 2} cy={box / 2} r={radius} className="easm-ui-donut-track" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${box / 2} ${box / 2})`}>
          {segments.map((s, i) => {
            if (s.value <= 0) return null;
            const length = (s.value / total) * circumference;
            const trim = gap + (round && present.length > 1 ? stroke : 0);
            const dash = present.length > 1 ? Math.max(0.5, length - trim) : length;
            const start = offset + (present.length > 1 ? trim / 2 : 0);
            offset += length;
            return <circle key={s.id} cx={box / 2} cy={box / 2} r={radius} fill="none" strokeWidth={active === s.id ? stroke + 5 : stroke}
              strokeLinecap={round && present.length > 1 ? 'round' : 'butt'} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-start}
              style={{ stroke: mark(tones[i]) }} data-dim={active && active !== s.id ? true : undefined} className="easm-ui-donut-segment"
              onPointerEnter={() => setActive(s.id)} onPointerLeave={hoverOut(() => setActive(null))} />;
          })}
        </g>
      </svg>
      {/* The centre is sized to the ring's hole as drawn (it narrows while an arc is highlighted), so text never
          reaches the ring. A highlighted share puts its name and percentage on two
          lines: one line ("WhatsApp · 22%") was wider than the hole at the small size. */}
      <div className="easm-ui-donut-center" aria-hidden="true" style={{ width: hole, height: hole }}>
        <strong>{focus ? format(focus.value) : centerValue ?? format(total)}</strong>
        <span>{focus ? focus.label : centerLabel}</span>
        {focus ? <span className="easm-ui-donut-share">{percentOf(focus.value, total)}%</span> : null}
      </div>
      {/* The drawn centre is hidden (it changes on hover), so its headline figure is stated here once. */}
      <span className="easm-ui-sr-only">{centerLabel}: {centerValue ?? format(total)}</span>
    </div>
    {layout !== 'none' && <ul className="easm-ui-share-legend">
      {segments.map((s, i) => <li key={s.id} style={toneStyle(tones[i])} data-active={active === s.id || undefined} data-dim={active && active !== s.id ? true : undefined}
        onPointerEnter={() => setActive(s.id)} onPointerLeave={hoverOut(() => setActive(null))}>
        <i aria-hidden="true" /><span className="easm-ui-share-legend-label">{s.label}</span>
        <span className="easm-ui-share-legend-value">{format(s.value)}</span><span className="easm-ui-share-legend-share">{percentOf(s.value, total)}%</span>
      </li>)}
    </ul>}
    {layout === 'none' && <ShareList segments={segments} total={total} format={format} />}
  </div>;
}

/** The segments as text when the visible legend is turned off, so the numbers stay available to
 * screen readers (the drawing itself is aria-hidden). */
function ShareList({ segments, total, format }: { segments: readonly ShareSegment[]; total: number; format: (v: number) => string }) {
  return <ul className="easm-ui-sr-only">{segments.map(s => <li key={s.id}>{s.label}: {format(s.value)}, {percentOf(s.value, total)}%</li>)}</ul>;
}

/* ------------------------------------------------------------ ProportionBar */

export interface ProportionBarProps {
  label: string;
  segments: readonly ShareSegment[];
  size?: 'sm' | 'md' | 'lg';
  legend?: boolean;
  locale?: string;
  formatValue?: (value: number) => string;
  className?: string;
}
/** One bar split into shares: a calmer alternative to a donut for two to six parts. */
export function ProportionBar({ label, segments: given, size = 'md', legend = true, locale = 'en', formatValue, className }: ProportionBarProps) {
  checkLabel(label, 'ProportionBar');
  const segments = checkSegments(given, 'ProportionBar segments');
  const format = formatValue ?? readable(locale);
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const tones = segments.map((s, i) => s.tone ?? chartTone(i));
  return <div role="group" aria-label={label} className={cx('easm-ui easm-ui-proportion', className)} data-size={size}>
    <div className="easm-ui-proportion-bar" aria-hidden="true">
      {total > 0 ? segments.map((s, i) => s.value > 0 && <span key={s.id} style={{ flexGrow: s.value, background: mark(tones[i]), ...motionDelay(i, segments.length) }}
        data-dim={active && active !== s.id ? true : undefined} onPointerEnter={() => setActive(s.id)} onPointerLeave={hoverOut(() => setActive(null))} />) : <span className="easm-ui-proportion-empty" />}
    </div>
    {legend && <ul className="easm-ui-share-legend" data-layout="inline">
      {segments.map((s, i) => <li key={s.id} style={toneStyle(tones[i])} data-dim={active && active !== s.id ? true : undefined}
        onPointerEnter={() => setActive(s.id)} onPointerLeave={hoverOut(() => setActive(null))}>
        <i aria-hidden="true" /><span className="easm-ui-share-legend-label">{s.label}</span>
        <span className="easm-ui-share-legend-value">{format(s.value)}</span><span className="easm-ui-share-legend-share">{percentOf(s.value, total)}%</span>
      </li>)}
    </ul>}
    {!legend && <ShareList segments={segments} total={total} format={format} />}
  </div>;
}

/* ----------------------------------------------------------------- BarList */

export interface BarListItem {
  id: string; label: string; value: number | null; tone?: ChartTone; href?: string; description?: string;
  /** Self-reported bars are outlined, provisional ones dashed; both say so after the value. */
  provenance?: Provenance;
  /** Why there is no value (value null): shown as "Not measured" with the reason, on a hollow dashed track. */
  unmeasured?: string;
}
export interface BarListProps {
  label: string;
  items: readonly BarListItem[];
  /** inline: label, bar and value on one row. stacked: label and value above a full-width bar. */
  layout?: 'inline' | 'stacked';
  /** One colour for every bar, or 'auto' to give each bar its own. */
  tone?: ChartTone | 'auto';
  /** What a full bar means: the largest value, the sum, or a fixed whole (such as all leads).
   * Percentages are of the fixed whole when one is given, otherwise of the sum. */
  scale?: 'max' | 'total' | number;
  display?: 'value' | 'percent' | 'both';
  /** Number the rows 1, 2, 3… */
  ranked?: boolean;
  size?: 'sm' | 'md';
  locale?: string;
  formatValue?: (value: number) => string;
  emptyText?: string;
  className?: string;
}
/** Ranked horizontal bars that read as text: every row states its label and value. */
export function BarList({ label, items, layout = 'inline', tone = 'blue', scale = 'max', display = 'value', ranked = false, size = 'md', locale = 'en', formatValue, emptyText = 'No values in this range.', className }: BarListProps) {
  checkLabel(label, 'BarList');
  checkLabelledItems(items, 'BarList items');
  // Its own width, so the narrow layout applies wherever the list sits, not only inside a Card or Panel
  // (a container query needs a size container above it).
  const [listRef, listWidth] = useElementWidth<HTMLElement>();
  const format = formatValue ?? readable(locale);
  const values = items.map(item => item.value).filter(finite);
  const total = values.reduce((sum, v) => sum + v, 0);
  const max = typeof scale === 'number' ? scale : scale === 'total' ? total : Math.max(0, extent(values)[1]);
  if (!items.length) return <p className={cx('easm-ui easm-ui-bar-list-empty', className)}>{emptyText}</p>;
  const List = ranked ? 'ol' : 'ul';
  return <List ref={listRef as RefObject<HTMLOListElement & HTMLUListElement>} className={cx('easm-ui easm-ui-bar-list', className)} aria-label={label} data-layout={layout} data-size={size}
    data-ranked={ranked || undefined} data-narrow={(listWidth > 0 && listWidth <= 440) || undefined}>
    {items.map((item, i) => {
      const t = item.tone ?? (tone === 'auto' ? chartTone(i) : tone);
      const v = finite(item.value) ? item.value : null;
      const share = v === null ? 0 : percentOf(v, typeof scale === 'number' ? scale : total);
      const text = v === null ? '—' : display === 'percent' ? `${share}%` : display === 'both' ? <>{format(v)}<span> · {share}%</span></> : format(v);
      const source = item.provenance && provenanceWords[item.provenance];
      return <li key={item.id} style={{ ...toneStyle(t), ...motionDelay(i, items.length) }} data-provenance={v === null && item.unmeasured ? 'unmeasured' : item.provenance}>
        {ranked && <span className="easm-ui-bar-list-rank" aria-hidden="true">{i + 1}</span>}
        <span className="easm-ui-bar-list-label" title={item.label}>{item.href ? <EasmLink href={item.href}>{item.label}</EasmLink> : item.label}
          {item.description ? <span className="easm-ui-bar-list-description">{item.description}</span> : null}</span>
        <span className="easm-ui-bar-list-track" aria-hidden="true"><span style={{ width: `${v === null || max <= 0 ? 0 : Math.max(v > 0 ? 1.5 : 0, Math.min(100, (v / max) * 100))}%` }} /></span>
        <span className="easm-ui-bar-list-value">{v === null ? item.unmeasured ? <UnmeasuredValue reason={item.unmeasured} /> : <MissingValue label="Not measured" /> : <>{text}{source ? <span className="easm-ui-bar-list-source">{source}</span> : null}</>}</span>
      </li>;
    })}
  </List>;
}

/* ----------------------------------------------------------------- Heatmap */

export interface HeatmapAxis { id: string; label: string }
export interface HeatmapProps {
  label: string;
  rows: readonly HeatmapAxis[];
  columns: readonly HeatmapAxis[];
  /** values[row][column]; null when not measured. */
  values: readonly (readonly (number | null)[])[];
  tone?: ChartTone;
  /** Show every nth column heading (the rest stay available to screen readers). */
  columnLabelEvery?: number;
  valueLabel?: string;
  locale?: string;
  formatValue?: (value: number) => string;
  className?: string;
}
/** Intensity across two dimensions, such as weekday by hour. A real table, so every value is reachable. */
export function Heatmap({ label, rows, columns, values, tone = 'blue', columnLabelEvery = 1, valueLabel = 'Value', locale = 'en', formatValue, className }: HeatmapProps) {
  checkLabel(label, 'Heatmap');
  checkLabelledItems(rows, 'Heatmap rows');
  checkLabelledItems(columns, 'Heatmap columns');
  if (values.length !== rows.length || values.some(row => row.length !== columns.length)) reportContentProblem('Heatmap values must match its rows and columns.');
  // One reader for every cell: a missing, extra or non-finite value is "not measured", never a broken cell.
  const cell = (ri: number, ci: number) => { const v = values[ri]?.[ci]; return finite(v) ? v : null; };
  const format = formatValue ?? readable(locale);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [scrollRef, scrolls] = useOverflowing<HTMLDivElement>();
  const known = rows.flatMap((_, ri) => columns.map((__, ci) => cell(ri, ci))).filter(finite);
  // The real peak (0.4 stays 0.4); 1 is only the divisor when nothing above zero was measured.
  const max = Math.max(0, extent(known)[1]);
  const level = (v: number | null) => v === null ? -1 : v <= 0 ? 0 : Math.min(4, Math.ceil((v / (max || 1)) * 4));
  // The tooltip stays where it last was and fades out there, so the next hover glides from it instead of popping.
  const lastFocus = useRef<[number, number] | null>(null);
  if (focus) lastFocus.current = focus;
  const shownCell = focus ?? lastFocus.current;
  const shownValue = shownCell ? cell(shownCell[0], shownCell[1]) : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Above the hovered cell, centred on it and kept inside the heatmap; written to the tooltip, not to state.
  useLayoutEffect(() => {
    const root = rootRef.current, tip = tipRef.current;
    const target = root?.querySelector<HTMLElement>('.easm-ui-heatmap-cell[data-active]');
    if (!root || !tip || !target) return;
    const box = root.getBoundingClientRect(), at = target.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const x = Math.max(half, Math.min(box.width - half, at.left - box.left + at.width / 2));
    tip.style.setProperty('--easm-ui-tip-x', `${x}px`);
    tip.style.setProperty('--easm-ui-tip-y', `${at.top - box.top}px`);
  }, [focus?.[0], focus?.[1]]);
  return <div ref={rootRef} className={cx('easm-ui easm-ui-heatmap', className)} style={toneStyle(tone)}>
    {/* Caller labels are quoted as given, never lowercased ("WhatsApp" stays "WhatsApp"). */}
    {shownCell && <div ref={tipRef} className="easm-ui-heatmap-tip" aria-hidden="true" data-visible={focus ? true : undefined}>
      <strong>{rows[shownCell[0]].label} · {columns[shownCell[1]].label}</strong>
      <span>{valueLabel}<b>{shownValue === null ? 'Not measured' : format(shownValue)}</b></span>
    </div>}
    <div ref={scrollRef} className="easm-ui-heatmap-scroll" role="region" aria-label={label} tabIndex={scrolls ? 0 : undefined} {...quietPointerFocus()}>
      <table onPointerLeave={hoverOut(() => setFocus(null))}>
        <caption className="easm-ui-sr-only">{label}, {valueLabel}</caption>
        <thead><tr><td />{columns.map((c, ci) => <th key={c.id} scope="col"><span className={ci % columnLabelEvery === 0 ? undefined : 'easm-ui-sr-only'}>{c.label}</span></th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={r.id}><th scope="row">{r.label}</th>
          {columns.map((c, ci) => { const v = cell(ri, ci); return <td key={c.id} onPointerEnter={() => setFocus([ri, ci])}>
            <span className="easm-ui-heatmap-cell" data-level={level(v)} data-active={focus?.[0] === ri && focus?.[1] === ci || undefined} aria-hidden="true" />
            <span className="easm-ui-sr-only">{v === null ? 'Not measured' : format(v)}</span></td>; })}</tr>)}</tbody>
      </table>
    </div>
    {/* The peak sits with the colour key, where the eye goes to read the colours. */}
    <div className="easm-ui-heatmap-foot" aria-hidden="true">
      <p className="easm-ui-heatmap-peak">{known.length ? <>Peak <b>{format(max)}</b></> : 'No measured values'}</p>
      <div className="easm-ui-heatmap-scale"><span>Less</span>{[0, 1, 2, 3, 4].map(l => <span key={l} className="easm-ui-heatmap-cell" data-level={l} />)}<span>More</span></div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ Funnel */

export interface FunnelStage {
  id: string; label: string; value: number; tone?: ChartTone;
  /** Self-reported stages are outlined, provisional ones dashed; both say so after the value. */
  provenance?: 'verified' | 'external' | 'self-reported' | 'provisional';
}
export interface FunnelProps {
  label: string;
  stages: readonly FunnelStage[];
  tone?: ChartTone;
  locale?: string;
  formatValue?: (value: number) => string;
  className?: string;
}
/** Stages that narrow, with the conversion from each stage to the next. */
export function Funnel({ label, stages: given, tone = 'blue', locale = 'en', formatValue, className }: FunnelProps) {
  checkLabel(label, 'Funnel');
  checkLabelledItems(given, 'Funnel stages');
  if (given.some(s => !finite(s.value) || s.value < 0)) reportContentProblem('Funnel values must be finite and nonnegative.');
  const stages = given.map(s => finite(s.value) && s.value >= 0 ? s : { ...s, value: 0 });
  const format = formatValue ?? readable(locale);
  const first = stages[0]?.value ?? 0;
  return <ol className={cx('easm-ui easm-ui-funnel', className)} aria-label={label}>
    {stages.map((s, i) => {
      const previous = i > 0 ? stages[i - 1] : null;
      // A square-root scale keeps late stages readable as bars (a 1% stage would otherwise be a dot);
      // the exact value and share are always written beside it.
      const width = first > 0 ? Math.max(6, Math.sqrt(s.value / first) * 100) : 0;
      const source = s.provenance && provenanceWords[s.provenance];
      return <li key={s.id} style={{ ...toneStyle(s.tone ?? tone), ...motionDelay(i, stages.length) }} data-provenance={s.provenance}>
        {/* Between stages: how many of the stage above continued, and how many were lost (red) or, rarely, added (green). */}
        {previous && <span className="easm-ui-funnel-step">
          <UIIcon name="arrow-down" size={16} />
          {/* One wrapping block beside the arrow, so a long sentence wraps under itself and the arrow stays on its first line. */}
          <span className="easm-ui-funnel-step-copy"><span><strong>{percentOf(s.value, previous.value)}%</strong> of {previous.label} continued</span>
          {previous.value !== s.value ? <span className="easm-ui-funnel-change" data-change={s.value < previous.value ? 'drop' : 'gain'}>
            {format(Math.abs(previous.value - s.value))} {s.value < previous.value ? 'dropped' : 'added'}</span> : null}</span>
        </span>}
        <span className="easm-ui-funnel-row">
          <span className="easm-ui-funnel-label">{s.label}</span>
          {/* An empty stage draws no bar at all; the bar's minimum width is for small values, not for zero. */}
          <span className="easm-ui-funnel-track" aria-hidden="true">{s.value > 0 ? <span style={{ width: `${width}%`, opacity: 1 - i * (0.5 / Math.max(1, stages.length - 1)) }} /> : null}</span>
          <span className="easm-ui-funnel-value">{format(s.value)}{i > 0 && <span> · {percentOf(s.value, first)}%</span>}{source ? <span className="easm-ui-funnel-source">{source}</span> : null}</span>
        </span>
      </li>;
    })}
  </ol>;
}

/* ------------------------------------------------------------------- Gauge */

export interface GaugeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  label: string;
  value: number;
  max?: number;
  /** A goal marker on the arc. */
  target?: number;
  /** 'auto' compares with the target (or 70% without one): below is amber, far below coral. */
  tone?: ChartTone | 'auto';
  valueText?: string;
  caption?: ReactNode;
  size?: 'sm' | 'md';
}
/** A level against a goal on a half ring, such as SLA attainment. */
export function Gauge({ label, value: given, max: givenMax = 100, target: givenTarget, tone = 'auto', valueText, caption, size = 'md', className, style, ...props }: GaugeProps) {
  checkLabel(label, 'Gauge');
  if (!finite(givenMax) || givenMax <= 0 || !finite(given) || given < 0 || given > givenMax || (givenTarget !== undefined && (!finite(givenTarget) || givenTarget < 0 || givenTarget > givenMax)))
    reportContentProblem('Gauge value and target must be between zero and max.');
  // (In production an out-of-range value or target is drawn at the nearest end of the scale.)
  const max = finite(givenMax) && givenMax > 0 ? givenMax : 100;
  const value = Math.min(max, Math.max(0, finite(given) ? given : 0));
  const target = givenTarget !== undefined && finite(givenTarget) ? Math.min(max, Math.max(0, givenTarget)) : undefined;
  const id = useId();
  const share = value / max, goal = (target ?? max * 0.7) / max;
  const t: ChartTone = tone !== 'auto' ? tone : share >= goal ? 'green' : share >= goal * 0.85 ? 'amber' : 'coral';
  const w = size === 'sm' ? 136 : 184, stroke = size === 'sm' ? 12 : 16, r = (w - stroke) / 2, cy = w / 2;
  const arc = Math.PI * r;
  const point = (f: number) => [w / 2 - r * Math.cos(Math.PI * f), cy - r * Math.sin(Math.PI * f)];
  const [tx, ty] = point(goal);
  const text = valueText ?? `${Math.round(share * 100)}%`;
  return <div {...props} className={cx('easm-ui easm-ui-gauge', className)} data-size={size} style={{ ...toneStyle(t), ...style }}>
    <div role="meter" aria-labelledby={`${id}-label`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
      aria-valuetext={target !== undefined ? `${text}, target ${Math.round(goal * 100)}%` : text} className="easm-ui-gauge-figure" style={{ width: w, height: w / 2 + stroke / 2 + 2 }}>
      <svg width={w} height={w / 2 + stroke / 2 + 2} viewBox={`0 0 ${w} ${w / 2 + stroke / 2 + 2}`} aria-hidden="true" focusable="false">
        <path d={`M${stroke / 2} ${cy} A${r} ${r} 0 0 1 ${w - stroke / 2} ${cy}`} className="easm-ui-gauge-track" strokeWidth={stroke} />
        {/* At zero the value arc keeps square ends, so a round cap does not draw a coloured dot. */}
        <path d={`M${stroke / 2} ${cy} A${r} ${r} 0 0 1 ${w - stroke / 2} ${cy}`} className="easm-ui-gauge-value" strokeWidth={stroke}
          strokeDasharray={`${share * arc} ${arc}`} data-zero={share === 0 || undefined} />
        {target !== undefined && <line x1={tx} y1={ty} x2={w / 2 + (tx - w / 2) * ((r - stroke) / r)} y2={cy + (ty - cy) * ((r - stroke) / r)} className="easm-ui-gauge-target" />}
      </svg>
      <span className="easm-ui-gauge-center" aria-hidden="true"><strong>{text}</strong></span>
    </div>
    <span id={`${id}-label`} className="easm-ui-gauge-label">{label}</span>
    {caption ? <span className="easm-ui-gauge-caption">{caption}</span> : null}
  </div>;
}
