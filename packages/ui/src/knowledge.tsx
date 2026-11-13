'use client';

// Knowledge (CIMS) parts (demand list wave 2, C-CIMS-01…04): the ingestion pipeline's progress in three sizes, a
// knowledge item as a row or a card, the assistant's retrieval trace, and one retrieved chunk with its scores.
// Each replaces a page's own version, so a stage, a score or a freshness reads the same everywhere.
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button } from './actions';
import { EasmLink } from './link';
import { ScorePill } from './product';
import { cx, reportContentProblem, UIIcon } from './shared';
import { StatusChip, type StatusSpec } from './workflow';

/* ------------------------------------------------------------------ PipelineProgress */

export type PipelineStageId = 'fetch' | 'clean' | 'refine' | 'chunk' | 'index';
export type PipelineStageState = 'todo' | 'current' | 'done' | 'failed' | 'skipped';
export interface PipelineStage {
  id: PipelineStageId;
  state: PipelineStageState;
  /** How long the stage took (or has taken so far), in milliseconds. */
  ms?: number;
  /** Why it stopped, for a failed stage. */
  error?: ReactNode;
  /** When it happened ("22 Oct"), shown in place of the duration: a record's history rather than a run's timing. */
  at?: string;
}
const stageText: Record<PipelineStageId, { label: string; icon: IconName }> = {
  fetch: { label: 'Fetch', icon: 'stage-fetch' }, clean: { label: 'Clean', icon: 'stage-clean' }, refine: { label: 'Refine', icon: 'stage-refine' },
  chunk: { label: 'Chunk', icon: 'stage-chunk' }, index: { label: 'Index', icon: 'stage-index' },
};
const duration = (ms: number) => ms < 1000 ? `${Math.round(ms)} ms` : ms < 60000 ? `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
const stateWords: Record<PipelineStageState, string> = { todo: 'waiting', current: 'in progress', done: 'done', failed: 'failed', skipped: 'skipped' };
export interface PipelineProgressProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  stages: readonly PipelineStage[];
  /** pips: five segments for a table row. track: the full track for the review drawer. banner: a strip for the
   *  global alert line, with the item's title and actions. */
  variant?: 'pips' | 'track' | 'banner';
  /** The item being processed (banner). */
  title?: ReactNode;
  actions?: ReactNode;
}
/** Where a knowledge item is in fetch → clean → refine → chunk → index: done stages filled, the current one turning,
 *  a failed one marked with where and why it stopped, and how long each took. */
export function PipelineProgress({ label, stages, variant = 'track', title, actions, className, ...props }: PipelineProgressProps) {
  const failed = stages.find(s => s.state === 'failed');
  const current = stages.find(s => s.state === 'current');
  const done = stages.filter(s => s.state === 'done' || s.state === 'skipped').length;
  const summary = failed ? `Stopped at ${stageText[failed.id].label}` : current ? `${stageText[current.id].label} (${stages.indexOf(current) + 1} of ${stages.length})`
    : done === stages.length ? 'Indexed' : 'Waiting';
  const pips = <span className="easm-ui-pipeline-pips" aria-hidden="true">{stages.map(s => <i key={s.id} data-state={s.state} />)}</span>;
  if (variant === 'pips') return <span {...props} role="img" aria-label={`${label}: ${summary}`} title={summary} className={cx('easm-ui easm-ui-pipeline', className)} data-variant="pips">{pips}</span>;
  if (variant === 'banner') return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-pipeline', className)} data-variant="banner" data-failed={failed ? true : undefined}>
    <UIIcon name={failed ? 'state-failed' : current ? 'state-processing' : 'state-done'} size={20} className="easm-ui-pipeline-banner-icon"
      {...(current && !failed ? { 'data-motion': 'spin', 'data-active': 'true', 'data-repeat': 'true' } : {})} />
    <span className="easm-ui-pipeline-banner-copy">{title ? <strong>{title}</strong> : null}<span role="status">{summary}</span></span>
    {pips}
    {actions ? <span className="easm-ui-pipeline-banner-actions">{actions}</span> : null}
  </section>;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-pipeline', className)} data-variant="track">
    <ol className="easm-ui-pipeline-track">
      {stages.map((s, i) => <li key={s.id} data-state={s.state}>
        <span className="easm-ui-pipeline-rail" aria-hidden="true">
          <span className="easm-ui-pipeline-node">
            <UIIcon name={s.state === 'failed' ? 'state-failed' : stageText[s.id].icon} size={20} />
            {s.state === 'current' ? <i className="easm-ui-pipeline-turning" /> : null}
          </span>
          {i < stages.length - 1 ? <i className="easm-ui-pipeline-line" /> : null}
        </span>
        <span className="easm-ui-pipeline-label">{stageText[s.id].label}<span className="easm-ui-sr-only">, {stateWords[s.state]}</span></span>
        <span className="easm-ui-pipeline-time">{s.at ?? (s.ms !== undefined ? duration(s.ms) : s.state === 'todo' ? '—' : s.state === 'skipped' ? 'Skipped' : '')}</span>
      </li>)}
    </ol>
    {failed ? <p className="easm-ui-pipeline-error" role="alert"><UIIcon name="state-failed" size={16} /><span><strong>Stopped at {stageText[failed.id].label}.</strong> {failed.error}</span></p> : null}
  </section>;
}

/* ------------------------------------------------------------------ KnowledgeItemRow */

export type AudienceId = 'public' | 'applicant' | 'student' | 'faculty' | 'staff' | 'parent';
const audienceText: Record<AudienceId, string> = { public: 'Public', applicant: 'Applicants', student: 'Students', faculty: 'Faculty', staff: 'Staff', parent: 'Parents' };
export interface KnowledgeFreshness { state: 'fresh' | 'due' | 'stale'; text: string }
export interface KnowledgeItemRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  /** The type-* icon (type-pdf, type-html…) and its name. */
  type: { icon: IconName; label: string };
  /** A StatusSpec, or a key of the shared work statuses. */
  status: StatusSpec;
  audiences?: readonly AudienceId[];
  tags?: readonly string[];
  /** The assistant's confidence in this item's content, 0–1. */
  confidence?: number;
  freshness?: KnowledgeFreshness;
  /** Where it came from ("uni.example.edu/fees", "Uploaded by Sana"). */
  source?: ReactNode;
  href?: string;
  onOpen?: () => void;
  /** row: one dense line for the library table; card: a tile for the grid view. */
  variant?: 'row' | 'card';
  /** Pipeline pips or actions at the end of the row. */
  trailing?: ReactNode;
}
/** A knowledge item in the library: its type, title, status, who can see it, tags, the assistant's confidence, how
 *  fresh it is and where it came from. A dense row for the table, a card for the grid. */
export function KnowledgeItemRow({ title, type, status, audiences = [], tags = [], confidence, freshness, source, href, onOpen, variant = 'row', trailing, className, ...props }: KnowledgeItemRowProps) {
  if (!title.trim()) reportContentProblem('KnowledgeItemRow requires a title.');
  const name = href ? <EasmLink href={href} className="easm-ui-knowledge-title">{title}</EasmLink>
    : onOpen ? <button type="button" className="easm-ui-knowledge-title" onClick={onOpen}>{title}</button> : <span className="easm-ui-knowledge-title">{title}</span>;
  return <article {...props} aria-label={title} className={cx('easm-ui easm-ui-knowledge-item', className)} data-variant={variant}>
    <span className="easm-ui-knowledge-type" title={type.label}><UIIcon name={type.icon} size={variant === 'card' ? 24 : 20} label={type.label} /></span>
    <div className="easm-ui-knowledge-main">
      {name}
      <span className="easm-ui-knowledge-meta">
        {source ? <span className="easm-ui-knowledge-source">{source}</span> : null}
        {freshness ? <span className="easm-ui-knowledge-fresh" data-state={freshness.state}><UIIcon name={freshness.state === 'fresh' ? 'clock' : 'stale-knowledge'} size={16} />{freshness.text}</span> : null}
      </span>
      {tags.length || audiences.length ? <span className="easm-ui-knowledge-tags">
        {audiences.map(a => <span key={a} className="easm-ui-knowledge-audience"><UIIcon name={`audience-${a}` as IconName} size={16} />{audienceText[a]}</span>)}
        {tags.map(t => <span key={t} className="easm-ui-knowledge-tag">{t}</span>)}
      </span> : null}
    </div>
    <span className="easm-ui-knowledge-side">
      <StatusChip status="s" statuses={{ s: status }} size="sm" />
      {confidence !== undefined ? <ScorePill value={confidence} scale={1} /> : null}
      {trailing}
    </span>
  </article>;
}

/* ------------------------------------------------------------------ RetrievalTrace */

export interface RetrievalStage {
  id: string;
  label: string;
  /** Milliseconds the stage took. */
  ms?: number;
  /** A number or words under the label ("20 → 5", "2 sources"). */
  detail?: ReactNode;
  state?: 'ok' | 'skipped' | 'handoff' | 'failed';
  icon?: IconName;
}
/** The assistant's usual answer path, for callers that only fill in times and details. */
export const retrievalStages: readonly Omit<RetrievalStage, 'ms' | 'detail' | 'state'>[] = [
  { id: 'rewrite', label: 'Rewrite', icon: 'sparkle' },
  { id: 'search', label: 'Hybrid search', icon: 'hybrid-search' },
  { id: 'rerank', label: 'Rerank', icon: 'arrow-sort' },
  { id: 'window', label: 'Parent window', icon: 'layers' },
  { id: 'gate', label: 'Grounding gate', icon: 'shield-check' },
  { id: 'answer', label: 'Answer', icon: 'chat-sparkle' },
];
export interface RetrievalTraceProps extends HTMLAttributes<HTMLElement> {
  label: string;
  stages: readonly RetrievalStage[];
  /** Why the assistant handed over or failed, shown under the flow. */
  outcome?: ReactNode;
}
/** How the assistant reached (or did not reach) an answer: each stage with its time and detail, left to right, the
 *  stage that caused a hand-over or failure marked. The total time leads. */
export function RetrievalTrace({ label, stages, outcome, className, ...props }: RetrievalTraceProps) {
  const total = stages.reduce((sum, s) => sum + (s.ms ?? 0), 0);
  const stopped = stages.find(s => s.state === 'handoff' || s.state === 'failed');
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-retrieval', className)} data-stopped={stopped ? stopped.state : undefined}>
    <p className="easm-ui-retrieval-total">{label}<span>{duration(total)}</span></p>
    <ol className="easm-ui-retrieval-flow">
      {stages.map(s => <li key={s.id} data-state={s.state ?? 'ok'}>
        <span className="easm-ui-retrieval-node" aria-hidden="true"><UIIcon name={s.state === 'handoff' ? 'event-handoff-to-human' : s.state === 'failed' ? 'state-failed' : s.icon ?? 'state-done'} size={16} /></span>
        <span className="easm-ui-retrieval-label">{s.label}{s.state && s.state !== 'ok' ? <span className="easm-ui-sr-only">, {s.state === 'handoff' ? 'handed over here' : s.state}</span> : null}</span>
        <span className="easm-ui-retrieval-ms">{s.state === 'skipped' ? 'Skipped' : s.ms !== undefined ? duration(s.ms) : ''}</span>
        {s.detail ? <span className="easm-ui-retrieval-detail">{s.detail}</span> : null}
      </li>)}
    </ol>
    {outcome ? <p className="easm-ui-retrieval-outcome"><UIIcon name={stopped?.state === 'failed' ? 'state-failed' : stopped ? 'event-handoff-to-human' : 'state-done'} size={16} /><span>{outcome}</span></p> : null}
  </section>;
}

/* ------------------------------------------------------------------ ChunkResult */

export interface ChunkScores { dense?: number; keyword?: number; rerank?: number }
export interface ChunkResultProps extends HTMLAttributes<HTMLElement> {
  rank?: number;
  /** The retrieved passage. */
  excerpt: string;
  /** Words to mark in the passage (the query's terms). */
  highlight?: readonly string[];
  /** Each score from 0 to 1. */
  scores?: ChunkScores;
  source: { title: string; icon?: IconName; href?: string };
  audiences?: readonly AudienceId[];
  /** The text around the chunk the assistant also read (the parent window). */
  context?: string;
  /** Used in the answer, or below the grounding gate. */
  used?: boolean;
}
const scoreText: Record<keyof ChunkScores, string> = { dense: 'Meaning', keyword: 'Keywords', rerank: 'Rerank' };
/** One retrieved passage: the text with the query's words marked, its three scores as small bars, its source and who
 *  may see it, and the wider context behind Show more. Used and unused chunks are told apart. */
export function ChunkResult({ rank, excerpt, highlight = [], scores = {}, source, audiences = [], context, used, className, ...props }: ChunkResultProps) {
  const [open, setOpen] = useState(false);
  const words = highlight.map(w => w.trim()).filter(w => w.length > 1).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const marked = words.length ? excerpt.split(new RegExp(`(${words.join('|')})`, 'gi')).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part) : excerpt;
  return <article {...props} className={cx('easm-ui easm-ui-chunk', className)} data-used={used === undefined ? undefined : used} aria-label={`${rank ? `Result ${rank}: ` : ''}${source.title}`}>
    <header className="easm-ui-chunk-head">
      {rank ? <span className="easm-ui-chunk-rank">{rank}</span> : null}
      <span className="easm-ui-chunk-source"><UIIcon name={source.icon ?? 'document-text'} size={16} />{source.href ? <EasmLink href={source.href}>{source.title}</EasmLink> : source.title}</span>
      {used !== undefined ? <span className="easm-ui-chunk-used">{used ? 'Used in the answer' : 'Not used'}</span> : null}
    </header>
    <p className="easm-ui-chunk-text">{marked}</p>
    <div className="easm-ui-chunk-foot">
      <dl className="easm-ui-chunk-scores">
        {(Object.keys(scoreText) as (keyof ChunkScores)[]).filter(k => scores[k] !== undefined).map(k => <div key={k}>
          <dt>{scoreText[k]}</dt>
          <dd><span className="easm-ui-chunk-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(1, scores[k]!)) * 100}%` }} /></span>{scores[k]!.toFixed(2)}</dd>
        </div>)}
      </dl>
      {audiences.length ? <span className="easm-ui-chunk-audience">{audiences.map(a => <span key={a}><UIIcon name={`audience-${a}` as IconName} size={16} />{audienceText[a]}</span>)}</span> : null}
    </div>
    {context ? <div className="easm-ui-chunk-context">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Hide the wider context' : 'Show the wider context'}</button>
      {open ? <p>{context}</p> : null}
    </div> : null}
  </article>;
}

/* ------------------------------------------------------------------ QAPairs */

export interface QAPair { question: string; answer: string }
export interface QAPairsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  pairs: readonly QAPair[];
  /** How many show before "Show all" (2). */
  shown?: number;
}
/** The questions an item answers, as the refiner wrote them: each question, and its answer cut at three lines;
 *  the rest behind Show all. */
export function QAPairs({ pairs, shown = 2, className, ...props }: QAPairsProps) {
  const [all, setAll] = useState(false);
  const list = all ? pairs : pairs.slice(0, shown);
  return <div {...props} className={cx('easm-ui easm-ui-qa-pairs', className)}>
    <dl>{list.map((p, i) => <div key={i} className="easm-ui-qa-pair"><dt>{p.question}</dt><dd>{p.answer}</dd></div>)}</dl>
    {pairs.length > shown ? <Button variant="secondary" size="sm" className="easm-ui-qa-more" aria-expanded={all} trailingIcon={all ? 'chevron-up' : 'chevron-down'}
      onClick={() => setAll(a => !a)}>{all ? 'Show fewer' : `Show all ${pairs.length} questions`}</Button> : null}
  </div>;
}
