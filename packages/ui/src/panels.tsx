'use client';

// The detail panel (demand list wave 4a): the side panel a record opens in, and the parts that fill it. The header
// says which record it is (its kind, name, state and source), the one thing that needs someone sits right under it,
// sections hold the facts, and the footer keeps the main actions calm with removal in the More menu. The parts:
// DetailSection (one heading style), ContentPreview (readable text, not raw markdown), AttachmentPreview (a picture,
// recording, video or document) and AudiencePicker (who can see or use something, with what that means).
import { Fragment, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { IconButton, Button } from './actions';
import { Skeleton } from './feedback';
import { Drawer, DropdownMenu, type DrawerProps, type MenuItem } from './overlays';
import { AudioPlayer } from './product';
import { cx, UIIcon } from './shared';
import { CopyControl } from './utility';

export const panelComponentNames = ['DetailPanel', 'DetailSection', 'ContentPreview', 'AttachmentPreview', 'AudiencePicker'] as const;

/* ------------------------------------------------------------------ DetailPanel */

export interface DetailPanelProps extends Omit<DrawerProps, 'title' | 'description' | 'footer' | 'children' | 'lead' | 'headerDetail' | 'headerActions'> {
  /** The record's own name ("B.E. Technology (Biomedical)"), never "Item details". */
  title: string;
  /** What kind of thing it is: a glyph in a tile and its word ("Web page", "PDF", "Response"). */
  kind?: { icon: IconName; label: string };
  /** Its state, as a StatusChip. */
  status?: ReactNode;
  /** One quiet line of facts after the kind: the source, a language, a date. */
  meta?: ReactNode;
  /** The one thing that needs someone, first in the body: why it failed and the fix. */
  attention?: ReactNode;
  /** The footer's actions, main first. Removal belongs in `more`, not here. */
  actions?: ReactNode;
  /** Everything else, in the More menu: copying a link, removing the record (destructive). */
  more?: MenuItem[];
  /** Moving through the list the panel was opened from. */
  position?: { index: number; count: number; onPrevious?: () => void; onNext?: () => void; noun?: string };
  /** The record is loading: the frame shows, its body is a placeholder. */
  loading?: boolean;
  children?: ReactNode;
}
/** A record in a side panel: the header names it (kind, title, state, source) with Previous, Next and More beside the
 *  close button; what needs someone comes first; sections follow; the footer holds the main actions. Wide on a desk,
 *  the whole screen on a phone. */
export function DetailPanel({ title, kind, status, meta, attention, actions, more, position, loading, children, size = 'lg', side = 'end',
  closeLabel = 'Close', className, ...props }: DetailPanelProps) {
  const noun = position?.noun ?? 'item';
  const facts = kind || meta ? <span className="easm-ui-detail-meta">{kind ? <span>{kind.label}</span> : null}{meta ? <span>{meta}</span> : null}</span> : null;
  const tools = position || more?.length ? <>
    {position ? <span className="easm-ui-detail-nav">
      <span className="easm-ui-detail-position" aria-hidden="true">{position.index} of {position.count}</span>
      <IconButton icon="chevron-up" size="sm" variant="secondary" label={`Previous ${noun}`} disabled={!position.onPrevious || position.index <= 1} onClick={position.onPrevious} />
      <IconButton icon="chevron-down" size="sm" variant="secondary" label={`Next ${noun} (${position.index} of ${position.count} now)`} disabled={!position.onNext || position.index >= position.count} onClick={position.onNext} />
    </span> : null}
    {more?.length ? <DropdownMenu label="More actions" align="end" items={more} trigger={<IconButton icon="more-horizontal" size="sm" variant="secondary" label="More actions" />} /> : null}
  </> : null;
  return <Drawer {...props} side={side} size={size} closeLabel={closeLabel} title={title} className={cx('easm-ui-detail-panel', className)}
    lead={kind ? <span className="easm-ui-detail-kind" aria-hidden="true"><UIIcon name={kind.icon} size={24} /></span> : undefined}
    headerDetail={status || facts ? <>{status}{facts}</> : undefined}
    headerActions={tools ?? undefined}
    footer={actions ? <div className="easm-ui-detail-actions">{actions}</div> : undefined}>
    {loading ? <div className="easm-ui-detail-loading" aria-busy="true" aria-label="Loading">
      <Skeleton shape="rect" height={72} animated /><Skeleton shape="text" width="60%" animated /><Skeleton shape="rect" height={120} animated /><Skeleton shape="rect" height={88} animated />
    </div> : <>
      {attention ? <div className="easm-ui-detail-attention">{attention}</div> : null}
      {children}
    </>}
  </Drawer>;
}

/* ------------------------------------------------------------------ DetailSection */

export interface DetailSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  icon?: IconName;
  /** How many things it holds, beside the title ("Keywords 12"). */
  count?: number;
  /** One small action at the end of the heading: Edit, Show all. */
  action?: ReactNode;
  /** The heading opens and closes the section. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** fill: its content on a soft fill (facts, text). plain: straight on the panel (chips, a picture). */
  surface?: 'fill' | 'plain';
  children: ReactNode;
}
/** One section of a panel or page: a sentence-case heading with its glyph, a count and one action, and the content
 *  under it. Collapsible sections remember nothing between visits; open what matters by default. */
export function DetailSection({ title, icon, count, action, collapsible = false, defaultOpen = true, surface = 'fill', children, className, ...props }: DetailSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const heading = <>{icon ? <UIIcon name={icon} size={16} /> : null}<span>{title}</span>{count !== undefined ? <span className="easm-ui-detail-count">{count.toLocaleString('en')}</span> : null}</>;
  const shown = !collapsible || open;
  return <section {...props} aria-labelledby={id} className={cx('easm-ui easm-ui-detail-section', className)} data-surface={surface} data-open={shown || undefined}>
    <div className="easm-ui-detail-section-head">
      <h3 id={id} className="easm-ui-detail-section-title">
        {collapsible ? <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>{heading}<UIIcon name="chevron-down" size={16} className="easm-ui-detail-chevron" /></button> : heading}
      </h3>
      {action ? <span className="easm-ui-detail-section-action">{action}</span> : null}
    </div>
    {shown ? <div className="easm-ui-detail-section-body">{children}</div> : null}
  </section>;
}

/* ------------------------------------------------------------------ ContentPreview */

/** **bold**, *italic*, `code` and [text](link) inside one line, as elements. */
function inline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|`([^`]+)`|\[([^\]]+)\]\([^)]+\)/g;
  let last = 0, n = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] || m[2]) parts.push(<strong key={k}>{m[1] ?? m[2]}</strong>);
    else if (m[3]) parts.push(<em key={k}>{m[3]}</em>);
    else if (m[4]) parts.push(<code key={k}>{m[4]}</code>);
    else parts.push(<span key={k} className="easm-ui-preview-link">{m[5]}</span>);
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}
/** Markdown-ish text as readable blocks: headings, paragraphs and lists; rules and empty lines dropped. */
function blocks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => { if (list) { const L = list.ordered ? 'ol' : 'ul'; out.push(<L key={`l${out.length}`}>{list.items.map((t, i) => <li key={i}>{inline(t, `li${out.length}-${i}`)}</li>)}</L>); list = null; } };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || /^([-*_])\1{2,}$/.test(line)) { flush(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (h) { flush(); out.push(<p key={`h${out.length}`} className="easm-ui-preview-heading" data-level={Math.min(h[1].length, 3)}>{inline(h[2], `h${out.length}`)}</p>); }
    else if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else { flush(); out.push(<p key={`p${out.length}`}>{inline(line, `p${out.length}`)}</p>); }
  }
  flush();
  return out;
}
export interface ContentPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** The text as stored (markdown from the cleaner, or plain text). */
  text: string;
  /** markdown: headings, bold and lists drawn as such. plain: the text as it is, kept readable. */
  format?: 'markdown' | 'plain';
  /** How tall it stands before "Show all", in lines (8). */
  lines?: number;
  /** Offer to copy the stored text. */
  copyable?: boolean;
}
/** Stored content as people read it: headings, emphasis and lists drawn, rules and markdown signs gone, cut after a
 *  few lines with Show all. Copy gives the text exactly as stored. */
export function ContentPreview({ text, format = 'markdown', lines = 8, copyable = true, className, style, ...props }: ContentPreviewProps) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  // Folded, the text stops after the last whole block or list item that fits in `lines` lines, never through a line.
  const [cut, setCut] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const limit = lines * 21;
    const top = el.getBoundingClientRect().top;
    let fit = 0;
    for (const unit of el.querySelectorAll(':scope > p, :scope > ul > li, :scope > ol > li')) {
      const bottom = unit.getBoundingClientRect().bottom - top;
      if (bottom <= limit + 1) fit = Math.max(fit, bottom); else break;
    }
    setCut(fit > 0 ? Math.ceil(fit) : undefined);
    setLong(el.scrollHeight > (fit > 0 ? fit : limit) + 2);
  }, [text, lines, format]);
  const empty = !text.trim();
  return <div {...props} className={cx('easm-ui easm-ui-content-preview', className)} data-open={open || undefined} data-format={format}>
    <div ref={box} className="easm-ui-content-preview-text" style={{ ...style, ['--easm-preview-lines' as string]: lines, ...(cut && !open ? { maxHeight: cut } : {}) }}>
      {empty ? <p className="easm-ui-content-preview-empty">No text was kept from this source.</p> : format === 'plain' ? <p className="easm-ui-content-preview-plain">{text}</p> : blocks(text)}
    </div>
    {long || open || (copyable && !empty) ? <div className="easm-ui-content-preview-foot">
      {long || open ? <Button variant="secondary" size="sm" trailingIcon={open ? 'chevron-up' : 'chevron-down'} onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Show less' : 'Show all'}</Button> : <span />}
      {copyable && !empty ? <CopyControl text={text} label="Copy text" size="sm" /> : null}
    </div> : null}
  </div>;
}

/* ------------------------------------------------------------------ AttachmentPreview */

export interface AttachmentPreviewProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  href: string;
  name: string;
  kind: 'image' | 'audio' | 'video' | 'document';
  /** The document's type, in words and glyph ("PDF", type-pdf). */
  type?: { label: string; icon: IconName };
  /** A short line after the type: "2.4 MB", "12 pages". */
  detail?: ReactNode;
}
/** The file behind a record: a picture shown whole, a recording you can play, a video, or a document as a card that
 *  opens it. */
export function AttachmentPreview({ href, name, kind, type, detail, className, ...props }: AttachmentPreviewProps) {
  if (kind === 'image') return <figure {...props} className={cx('easm-ui easm-ui-attachment', className)} data-kind="image">
    <a href={href} target="_blank" rel="noreferrer" className="easm-ui-attachment-picture"><img src={href} alt={name} loading="lazy" /></a>
    <figcaption>{name}</figcaption>
  </figure>;
  if (kind === 'audio') return <figure {...props} className={cx('easm-ui easm-ui-attachment', className)} data-kind="audio">
    <AudioPlayer src={href} label={name} /><figcaption>{name}</figcaption>
  </figure>;
  if (kind === 'video') return <figure {...props} className={cx('easm-ui easm-ui-attachment', className)} data-kind="video">
    <video src={href} controls preload="metadata" playsInline aria-label={name} /><figcaption>{name}</figcaption>
  </figure>;
  return <a {...(props as HTMLAttributes<HTMLAnchorElement>)} href={href} target="_blank" rel="noreferrer" className={cx('easm-ui easm-ui-attachment', className)} data-kind="document">
    <span className="easm-ui-attachment-tile" aria-hidden="true"><UIIcon name={type?.icon ?? 'document'} size={24} /></span>
    <span className="easm-ui-attachment-copy"><strong>{name}</strong><span>{type?.label ?? 'Document'}{detail ? <> · {detail}</> : null}</span></span>
    <span className="easm-ui-attachment-open"><UIIcon name="open-external" size={16} />Open</span>
  </a>;
}

/* ------------------------------------------------------------------ AudiencePicker */

export interface AudienceOption {
  id: string;
  label: string;
  icon?: IconName;
  /** What choosing it means, in one sentence ("Visitors on the website chat will hear this"). */
  description: string;
}
/** Who can retrieve a knowledge item, widest first: the access policy's four stops. */
export const knowledgeAudiences: readonly AudienceOption[] = [
  { id: 'PUBLIC', label: 'Everyone', icon: 'audience-public', description: 'Anyone may be told this: visitors on the website chat, WhatsApp and callers.' },
  { id: 'STUDENT', label: 'Students', icon: 'audience-student', description: 'Only students signed in to the portal assistant are told this.' },
  { id: 'FACULTY', label: 'Faculty', icon: 'audience-faculty', description: 'Only faculty signed in to the portal assistant are told this.' },
  { id: 'INTERNAL', label: 'Staff only', icon: 'audience-staff', description: 'Only staff see it, in the dashboard. No assistant quotes it.' },
];
export interface AudiencePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  /** The stops, widest reach first (knowledgeAudiences by default). */
  options?: readonly AudienceOption[];
  value: string;
  /** Without it the picker only shows the choice. */
  onValueChange?: (id: string) => void;
  disabled?: boolean;
}
/** Who can see or use something, as a ladder from the widest reach to the narrowest, each stop with its audience mark,
 *  and under it what the choice means. One picker for knowledge access, Forms' who can fill and Automation's scope. */
export function AudiencePicker({ label, options = knowledgeAudiences, value, onValueChange, disabled, className, ...props }: AudiencePickerProps) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(o => o.id === value));
  const chosen = options[index];
  const editable = !!onValueChange && !disabled;
  const move = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft');
    const next = (i + (rtl ? -step : step) + options.length) % options.length;
    onValueChange?.(options[next].id);
    refs.current[next]?.focus();
  };
  return <div {...props} className={cx('easm-ui easm-ui-audience-picker', className)} data-readonly={!editable || undefined}>
    <span id={id} className="easm-ui-audience-label">{label}</span>
    <div role="radiogroup" aria-labelledby={id} aria-describedby={`${id}-means`} aria-disabled={disabled || undefined} className="easm-ui-audience-stops">
      {options.map((o, i) => <Fragment key={o.id}>
        <button ref={node => { refs.current[i] = node; }} type="button" role="radio" aria-checked={i === index} tabIndex={i === index ? 0 : -1}
          disabled={!editable && i !== index} className="easm-ui-audience-stop" onClick={() => editable && onValueChange?.(o.id)} onKeyDown={event => editable && move(event, i)}>
          {o.icon ? <UIIcon name={o.icon} size={20} /> : null}<span>{o.label}</span>
        </button>
      </Fragment>)}
    </div>
    <p id={`${id}-means`} className="easm-ui-audience-means"><UIIcon name="info" size={16} /><span>{chosen?.description}</span></p>
  </div>;
}
