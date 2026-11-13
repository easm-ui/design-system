'use client';

import { useEffect, useRef, useState, type ComponentPropsWithRef } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Icon } from '@easm-ui/icons/icon';
import { Button, IconButton } from './actions';
import { DropdownMenu, type MenuItem, type OverlaySurface } from './overlays';
import { cx, type ComponentSize } from './shared';
import { accentFor, type ChartTone, type ProductId } from './palette';

const graphemeSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
function firstGrapheme(word: string) {
  return graphemeSegmenter?.segment(word)[Symbol.iterator]().next().value?.segment || Array.from(word)[0] || '?';
}

/** Presence word in the accessible name when no statusLabel is given. */
const presenceWords = { online: 'online', idle: 'idle', away: 'away', offline: 'offline' } as const;

export interface AvatarProps extends ComponentPropsWithRef<'span'> {
  name: string; src?: string; size?: 'sm' | 'md' | 'lg'; decorative?: boolean;
  shape?: 'circle' | 'rounded';
  /** Presence. The dot differs in shape as well as colour: online filled, away half-filled, offline a hollow ring. */
  status?: 'online' | 'idle' | 'away' | 'offline';
  /** Words for the status in the accessible name (for translation). Defaults to the status itself. */
  statusLabel?: string;
  /** The initials' colour. `auto` (the default) gives each name its own accent, the same one everywhere;
   *  `brand` keeps the single blue. */
  tone?: ChartTone | 'auto' | 'brand';
}
export function Avatar({ name, src, size = 'md', shape = 'circle', decorative = false, status, statusLabel, tone = 'auto', className, 'aria-label': ariaLabel, ...props }: AvatarProps) {
  if (!name.trim()) throw new Error('Avatar requires a meaningful name. Use Unknown user if identity is unavailable.');
  const image = useRef<HTMLImageElement>(null);
  const [imageState, setImageState] = useState<{ source?: string; state: 'loading' | 'loaded' | 'fallback' }>({ source: src, state: src ? 'loading' : 'fallback' });
  const state = imageState.source === src ? imageState.state : src ? 'loading' : 'fallback';
  useEffect(() => {
    // A changed source is a new attempt. Cached image events can precede hydration.
    const cached = image.current;
    setImageState(current => current.source === src && current.state !== 'loading' ? current : {
      source: src, state: src ? cached?.complete ? cached.naturalWidth > 0 ? 'loaded' : 'fallback' : 'loading' : 'fallback',
    });
  }, [src]);
  // toUpperCase, not toLocaleUpperCase: the server and the browser must produce the same initials (hydration).
  const initials = name.trim().split(/\s+/).filter(Boolean).filter((_, index, words) => index === 0 || index === words.length - 1).map(word => firstGrapheme(firstGrapheme(word).toUpperCase())).join('') || '?';
  const statusWords = status ? statusLabel?.trim() || presenceWords[status] : '';
  const label = ariaLabel ?? `${name.trim()}${statusWords ? `, ${statusWords}` : ''}`;
  return <span {...props} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} className={cx('easm-ui easm-ui-avatar', className)} data-size={size} data-shape={shape} data-image-state={state}
    data-easm-tone={tone === 'brand' ? undefined : tone === 'auto' ? accentFor(name) : tone}>
    <span className="easm-ui-avatar-initials" aria-hidden="true" hidden={state === 'loaded'}>{initials}</span>
    {src && state !== 'fallback' ? <img key={src} ref={image} src={src} alt="" onLoad={event => { if (image.current === event.currentTarget) setImageState({ source: src, state: 'loaded' }); }} onError={event => { if (image.current === event.currentTarget) setImageState({ source: src, state: 'fallback' }); }} /> : null}
    {status ? <span className="easm-ui-avatar-status" data-status={status} aria-hidden="true" /> : null}
  </span>;
}

export interface UserChipProps extends ComponentPropsWithRef<'span'> {
  name: string; description?: string; src?: string; status?: AvatarProps['status'];
  /** Words for the status (for translation). Defaults to the status itself. */
  statusLabel?: string;
  size?: 'sm' | 'md'; onRemove?: () => void; disabled?: boolean;
  /** Accessible name of the remove action. Defaults to "Remove <name>". */
  removeLabel?: string;
}
export function UserChip({ name, description, src, status, statusLabel, size = 'md', onRemove, disabled, removeLabel, className, ...props }: UserChipProps) {
  const statusWords = status ? statusLabel?.trim() || presenceWords[status] : '';
  return <span {...props} className={cx('easm-ui easm-ui-user-chip', className)} data-size={size} data-disabled={disabled || undefined} data-removable={Boolean(onRemove)}>
    <Avatar name={name} src={src} status={status} decorative shape="rounded" size={size === 'sm' ? 'sm' : 'md'} />
    <span className="easm-ui-user-chip-copy"><span className="easm-ui-user-chip-name">{name}</span>{description ? <span className="easm-ui-user-chip-description">{description}</span> : null}{statusWords ? <span className="easm-ui-sr-only">{statusWords}</span> : null}</span>
    {onRemove ? <IconButton icon="close" label={removeLabel?.trim() || `Remove ${name.trim()}`} size="sm" variant="secondary" className="easm-ui-user-chip-remove" disabled={disabled} onClick={onRemove} /> : null}
  </span>;
}

export interface ModuleIconProps extends ComponentPropsWithRef<'span'> {
  icon: IconName; label?: string; size?: ComponentSize; tone?: 'brand' | 'neutral' | 'signature';
  /** A dashboard's own accent (support, knowledge, marketing, automation, forms) in place of the tone. */
  product?: ProductId;
}
export function ModuleIcon({ icon, label, size = 'md', tone = 'brand', product, className, ...props }: ModuleIconProps) {
  return <span {...props} className={cx('easm-ui easm-ui-module-icon', className)} data-size={size} data-tone={product ? 'product' : tone} data-easm-product={product}>
    <Icon name={icon} size={size === 'sm' ? 20 : size === 'lg' ? 32 : 24} label={label} tone="inherit" />
  </span>;
}

export interface CopyControlProps extends Omit<ComponentPropsWithRef<'span'>, 'onCopy' | 'children'> {
  text: string; label?: string; size?: ComponentSize; iconOnly?: boolean; disabled?: boolean; onCopy?: (text: string) => void; className?: string;
  /** Label shown after a successful copy (for translation). Defaults to "Copied". */
  copiedLabel?: string;
  /** Announced after a successful copy. Defaults to "Copied to clipboard." */
  copiedMessage?: string;
  /** Shown and announced when the clipboard refuses the write. */
  errorMessage?: string;
}
export function CopyControl({ text, label = 'Copy', size = 'md', iconOnly = false, disabled, onCopy, className, copiedLabel = 'Copied', copiedMessage = 'Copied to clipboard.', errorMessage = 'Copy failed. Select the text and copy it manually.', ...props }: CopyControlProps) {
  if (!label.trim()) throw new Error('CopyControl requires a meaningful action label.');
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const operation = useRef(0);
  useEffect(() => { operation.current += 1; setState('idle'); return () => { operation.current += 1; }; }, [text]);
  const copy = async () => {
    if (state === 'copying') return;
    const currentOperation = ++operation.current;
    setState('copying');
    try { await navigator.clipboard.writeText(text); } catch { if (operation.current === currentOperation) setState('error'); return; }
    if (operation.current !== currentOperation) return;
    setState('copied'); onCopy?.(text);
  };
  const controlLabel = state === 'copied' ? copiedLabel : label;
  return <span {...props} className={cx('easm-ui easm-ui-copy-control', className)}>
    {/* Icon-only sits inline beside the value it copies: a ghost icon, not a filled box (it keeps its touch target). */}
    {iconOnly ? <IconButton label={controlLabel} icon={state === 'copied' ? 'check' : 'copy'} variant="subtle" size={size} disabled={disabled} loading={state === 'copying'} onClick={copy} /> : <Button aria-label={controlLabel} variant="secondary" size={size} leadingIcon={state === 'copied' ? 'check' : 'copy'} disabled={disabled} loading={state === 'copying'} onClick={copy}>
      <span className="easm-ui-copy-labels"><span className="easm-ui-copy-measure" aria-hidden="true">{label}</span><span className="easm-ui-copy-measure" aria-hidden="true">{copiedLabel}</span><span className="easm-ui-copy-label">{controlLabel}</span></span>
    </Button>}
    <span role="status" aria-live="polite" className={state === 'error' ? 'easm-ui-copy-error' : 'easm-ui-sr-only'}>{state === 'error' ? errorMessage : state === 'copied' ? copiedMessage : ''}</span>
  </span>;
}

export interface OverflowMenuProps { items: readonly MenuItem[]; label?: string; size?: ComponentSize; disabled?: boolean; className?: string; surface?: OverlaySurface }
export function OverflowMenu({ items, label = 'More actions', size = 'md', disabled, className, surface }: OverflowMenuProps) {
  return <DropdownMenu label={label} items={items as MenuItem[]} surface={surface} trigger={<IconButton icon="more-horizontal" label={label} size={size} disabled={disabled} className={className} />} />;
}
