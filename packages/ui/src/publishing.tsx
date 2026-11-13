'use client';

// Forms parts (demand list wave 4c, 2026-10-29): a choice made by looking at it (PreviewTiles, C-FRM-05: form types,
// themes, look shapes, starters), where people stop on a form (DropOffStrip, C-FRM-06), every way to share a form as
// cards with a live preview and Copy (PublishChannels, C-FRM-07), and who is collecting a form right now
// (CollectionStatus, C-FRM-08).
import { useId, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button } from './actions';
import { TextField } from './inputs';
import { CopyControl } from './utility';
import { cx, reportContentProblem, UIIcon, useControllableState } from './shared';

export const publishingComponentNames = ['PreviewTiles', 'DropOffStrip', 'PublishChannels', 'CollectionStatus'] as const;

/* ------------------------------------------------------------------ PreviewTiles */

export interface PreviewTileOption { id: string; label: string; description?: string; /** The picture: a sketch, a swatch, a shape. */ preview: ReactNode; badge?: string; disabled?: boolean }
export interface PreviewTilesProps extends Omit<HTMLAttributes<HTMLFieldSetElement>, 'onChange' | 'defaultValue'> {
  label: string;
  hideLabel?: boolean;
  options: readonly PreviewTileOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string) => void;
  /** The narrowest a tile may get, in px. */
  min?: number;
  name?: string;
}
/** A choice made by looking: each option a tile with its picture above its name (form types, themes, corner and
 *  button shapes, starters). Native radios underneath. Replaces Forms' hand-made Sketch and ThemeSwatch tiles. */
export function PreviewTiles({ label, hideLabel, options, value, defaultValue = null, onValueChange, min = 148, name, className, style, ...props }: PreviewTilesProps) {
  if (!label.trim()) reportContentProblem('PreviewTiles requires a meaningful label.');
  const id = useId();
  const [chosen, choose] = useControllableState<string | null>(value, defaultValue, next => { if (next) onValueChange?.(next); });
  return <fieldset {...props} className={cx('easm-ui easm-ui-preview-tiles', className)} style={{ ...style, ['--_tile-min' as string]: `${min}px` }}>
    <legend className={cx('easm-ui-field-label', hideLabel && 'easm-ui-sr-only')}>{label}</legend>
    <div className="easm-ui-preview-tiles-grid">
      {options.map(option => <label key={option.id} className="easm-ui-preview-tile" data-checked={chosen === option.id || undefined} data-disabled={option.disabled || undefined}>
        <input type="radio" className="easm-ui-preview-tile-input" name={name ?? id} value={option.id} checked={chosen === option.id} disabled={option.disabled}
          aria-describedby={option.description ? `${id}-${option.id}` : undefined} onChange={() => choose(option.id)} />
        <span className="easm-ui-preview-tile-picture" aria-hidden="true">{option.preview}</span>
        <span className="easm-ui-preview-tile-name">{option.label}{option.badge ? <span className="easm-ui-preview-tile-badge">{option.badge}</span> : null}</span>
        {option.description ? <span className="easm-ui-preview-tile-line" id={`${id}-${option.id}`}>{option.description}</span> : null}
      </label>)}
    </div>
  </fieldset>;
}

/* ------------------------------------------------------------------ DropOffStrip */

export interface DropOffQuestion { id: string; label: string; reached: number }
export interface DropOffStripProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  label: string;
  /** People who started the form. */
  started: number;
  questions: readonly DropOffQuestion[];
  finished?: number;
  onSelect?: (id: string) => void;
  locale?: string;
}
/** Where people stop on a form: the questions in order, each bar as tall as the share of starters who reached it,
 *  and the question most of them stopped at marked and said in words. Replaces the drop-off list on Analytics. */
export function DropOffStrip({ label, started, questions, finished, onSelect, locale, className, ...props }: DropOffStripProps) {
  const id = useId();
  const pct = (n: number) => started ? Math.round((n / started) * 100) : 0;
  const worst = useMemo(() => {
    let at = -1, lost = 0;
    questions.forEach((q, i) => { const before = i ? questions[i - 1].reached : started; if (before - q.reached > lost) { lost = before - q.reached; at = i; } });
    return at < 0 ? null : { index: at, lost };
  }, [questions, started]);
  return <section {...props} aria-labelledby={`${id}-title`} className={cx('easm-ui easm-ui-dropoff', className)}>
    <header className="easm-ui-dropoff-head">
      <h4 id={`${id}-title`}>{label}</h4>
      <span>{started.toLocaleString(locale)} started{finished !== undefined ? ` · ${finished.toLocaleString(locale)} finished (${pct(finished)}%)` : ''}</span>
    </header>
    {worst ? <p className="easm-ui-dropoff-worst"><UIIcon name="drop-off" size={16} />Most stop at question {worst.index + 1}, <b>{questions[worst.index].label}</b>: {worst.lost.toLocaleString(locale)} people ({pct(worst.lost)}% of starters).</p> : null}
    <ol className="easm-ui-dropoff-bars">
      {questions.map((q, i) => {
        const body = <>
          <span className="easm-ui-dropoff-bar" aria-hidden="true"><i style={{ blockSize: `${Math.max(2, pct(q.reached))}%` }} /></span>
          <span className="easm-ui-dropoff-number" aria-hidden="true">{i + 1}</span>
          <span className="easm-ui-sr-only">Question {i + 1}, {q.label}: {q.reached.toLocaleString(locale)} reached it ({pct(q.reached)}%){worst?.index === i ? ', where most stop' : ''}</span>
        </>;
        return <li key={q.id} data-worst={worst?.index === i || undefined} title={`${i + 1}. ${q.label}: ${pct(q.reached)}%`}>
          {onSelect ? <button type="button" className="easm-ui-dropoff-question" onClick={() => onSelect(q.id)}>{body}</button> : <span className="easm-ui-dropoff-question">{body}</span>}
        </li>;
      })}
    </ol>
  </section>;
}

/* ------------------------------------------------------------------ PublishChannels */

export interface PublishChannelsProps extends HTMLAttributes<HTMLElement> {
  /** The form's public link. */
  url: string;
  /** The QR code drawn by the app (an <svg> or <img>), and its download. */
  qr?: ReactNode;
  onDownloadQr?: (format: 'png' | 'svg') => void;
  /** The embed snippet. */
  embed?: string;
  /** A link that fills questions in: the link itself and which questions it fills. */
  prefill?: { url: string; fields: readonly string[]; onEdit?: () => void };
  /** The assistant collecting the form in conversations. */
  assistant?: { on: boolean; channels: readonly ('chat' | 'whatsapp' | 'calls')[]; onSetUp?: () => void };
}
const channelWords = { chat: 'website chat', whatsapp: 'WhatsApp', calls: 'calls' } as const;
/** Every way to share a form as cards side by side: the link, its QR code, the embed snippet, a campaign link built
 *  from its source, medium and campaign, a pre-filled link, and the assistant collecting it in conversations. Each
 *  shows what will be shared and copies it. Replaces the stacked sections of Publish. */
export function PublishChannels({ url, qr, onDownloadQr, embed, prefill, assistant, className, ...props }: PublishChannelsProps) {
  const [utm, setUtm] = useState({ source: '', medium: '', campaign: '' });
  const campaignUrl = useMemo(() => {
    const clean = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '_');
    const params = Object.entries(utm).filter(([, v]) => v.trim()).map(([k, v]) => `utm_${k}=${encodeURIComponent(clean(v))}`);
    return params.length ? `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}` : '';
  }, [url, utm]);
  const card = (key: string, icon: IconName, title: string, line: string, body: ReactNode, actions?: ReactNode) =>
    <section key={key} className="easm-ui-publish-card" aria-label={title}>
      <header><span className="easm-ui-publish-icon"><UIIcon name={icon} size={20} /></span><div><h4>{title}</h4><p>{line}</p></div></header>
      <div className="easm-ui-publish-preview">{body}</div>
      {actions ? <footer>{actions}</footer> : null}
    </section>;
  return <div {...props} className={cx('easm-ui easm-ui-publish', className)}>
    {card('link', 'via-link', 'Link', 'Anyone with it can open the form.', <code>{url}</code>, <CopyControl text={url} label="Copy link" size="sm" />)}
    {qr ? card('qr', 'via-qr', 'QR code', 'For posters, flyers and the admissions desk.', <span className="easm-ui-publish-qr">{qr}</span>,
      onDownloadQr ? <><Button size="sm" variant="secondary" leadingIcon="arrow-download" onClick={() => onDownloadQr('png')}>PNG</Button><Button size="sm" variant="secondary" leadingIcon="arrow-download" onClick={() => onDownloadQr('svg')}>SVG</Button></> : null) : null}
    {embed ? card('embed', 'via-embed', 'Embed', 'Put the form inside a page of your website.', <code className="easm-ui-publish-code">{embed}</code>, <CopyControl text={embed} label="Copy code" size="sm" />) : null}
    {card('campaign', 'via-campaign-link', 'Campaign link', 'Tells Marketing which campaign sent each response.', <div className="easm-ui-publish-utm">
      <TextField label="Source" size="sm" placeholder="facebook" value={utm.source} onChange={e => setUtm({ ...utm, source: e.target.value })} />
      <TextField label="Medium" size="sm" placeholder="paid_social" value={utm.medium} onChange={e => setUtm({ ...utm, medium: e.target.value })} />
      <TextField label="Campaign" size="sm" placeholder="fall_admissions" value={utm.campaign} onChange={e => setUtm({ ...utm, campaign: e.target.value })} />
      {campaignUrl ? <code>{campaignUrl}</code> : <p className="easm-ui-publish-hint">Fill any of the three to build the link.</p>}
    </div>, campaignUrl ? <CopyControl text={campaignUrl} label="Copy campaign link" size="sm" /> : null)}
    {prefill ? card('prefill', 'via-prefilled', 'Pre-filled link', prefill.fields.length ? `Fills ${prefill.fields.join(', ')}.` : 'Choose the questions it fills.', <code>{prefill.url}</code>,
      <>{prefill.onEdit ? <Button size="sm" variant="secondary" leadingIcon="edit" onClick={prefill.onEdit}>Choose questions</Button> : null}<CopyControl text={prefill.url} label="Copy" size="sm" /></>) : null}
    {assistant ? card('assistant', 'via-assistant-chat', 'The assistant', assistant.on ? `Collects it in ${assistant.channels.map(c => channelWords[c]).join(', ') || 'no channel yet'}.` : 'Off: the assistant does not know this form.',
      <span className="easm-ui-publish-assistant" data-on={assistant.on || undefined}><UIIcon name={assistant.on ? 'state-live' : 'state-paused'} size={16} />{assistant.on ? 'On' : 'Off'}</span>,
      assistant.onSetUp ? <Button size="sm" variant="secondary" onClick={assistant.onSetUp}>{assistant.on ? 'Change' : 'Set up'}</Button> : null) : null}
  </div>;
}

/* ------------------------------------------------------------------ CollectionStatus */

export interface CollectionStatusProps extends HTMLAttributes<HTMLElement> {
  /** The link takes responses. */
  link: boolean;
  /** The assistant collects it on these channels. */
  assistant?: { chat?: boolean; whatsapp?: boolean; calls?: boolean };
  /** What the assistant cannot take on this form (a required file upload; staff and student forms). */
  cannotTake?: ReactNode;
  variant?: 'banner' | 'chips';
}
/** Who is collecting a form right now: the link, and the assistant in the website chat, WhatsApp and calls, each on
 *  or off, with what the assistant cannot take. A chip row on a list; a banner on the form. */
export function CollectionStatus({ link, assistant = {}, cannotTake, variant = 'banner', className, ...props }: CollectionStatusProps) {
  const ways: [string, IconName, boolean][] = [['Link', 'via-link', link], ['Website chat', 'via-assistant-chat', !!assistant.chat], ['WhatsApp', 'chat-multiple', !!assistant.whatsapp], ['Calls', 'via-assistant-call', !!assistant.calls]];
  const on = ways.filter(w => w[2]).length;
  return <section {...props} className={cx('easm-ui easm-ui-collection', className)} data-variant={variant} aria-label={`Collecting: ${on ? ways.filter(w => w[2]).map(w => w[0]).join(', ') : 'nowhere'}`}>
    {variant === 'banner' ? <p className="easm-ui-collection-title"><UIIcon name={on ? 'state-live' : 'state-paused'} size={16} />{on ? `Collecting in ${on} ${on === 1 ? 'place' : 'places'}` : 'Not collecting anywhere'}</p> : null}
    <ul>{ways.map(([name, icon, isOn]) => <li key={name} data-on={isOn || undefined}><UIIcon name={icon} size={16} /><span>{name}</span><b>{isOn ? 'On' : 'Off'}</b></li>)}</ul>
    {cannotTake && variant === 'banner' ? <p className="easm-ui-collection-note"><UIIcon name="info" size={16} /><span>{cannotTake}</span></p> : null}
  </section>;
}
