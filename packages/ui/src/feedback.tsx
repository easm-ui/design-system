'use client';

import { createContext, forwardRef, useContext, useId, useRef, useState, type CSSProperties, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ProgressHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { IconName } from '@easm-ui/icons';
import { LazyAnimatedIcon } from './animated-icon';
import { EasmDots, EasmIcon } from '@easm-ui/brand';
import { cx, reportContentProblem, UIIcon, useOpenerLocale } from './shared';
import { OverlayLayerContext, useOverlayLayer } from './overlay-layer';

export type FeedbackTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
const toneIcons: Record<FeedbackTone, IconName> = {
  neutral: 'info', brand: 'info', success: 'check-circle', warning: 'warning', danger: 'error-circle',
};
/** Whether text can be shown. Blank text is reported: it throws in development and tests, and in a production build
 * it warns once and the component degrades (renders nothing or its default text) instead of unmounting the page. */
function meaningful(value: ReactNode, subject: string) {
  if (value == null || typeof value === 'boolean' || typeof value === 'string' && !value.trim()) {
    reportContentProblem(`${subject} requires meaningful text.`);
    return false;
  }
  return true;
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: FeedbackTone;
  size?: 'sm' | 'md';
  icon?: IconName;
}
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge({ children, tone = 'neutral', size = 'md', icon, className, title, ...props }, ref) {
  if (!meaningful(children, 'Badge')) return null;
  // One line, never squeezed (feedback.css). A label long enough that it may meet its container's
  // edge carries its full text as a tip, so an ellipsis never hides a word for good.
  const tip = title ?? (typeof children === 'string' && children.length > 24 ? children : undefined);
  // The spinner glyph says work is under way, so it turns like the Button's busy indicator; drawn still it
  // read as stuck (master portal → Releases, "Building", 2026-10-16). Reduced motion and
  // data-easm-motion="off" keep it still (@easm-ui/icons animation.css).
  const glyph = icon === 'spinner'
    ? <UIIcon name="spinner" size={16} data-motion="spin" data-active="true" data-repeat="true" />
    : icon ? <UIIcon name={icon} size={16} /> : null;
  return <span {...props} ref={ref} title={tip} data-tone={tone} data-size={size} className={cx('easm-ui easm-ui-badge', className)}>
    {glyph}<span className="easm-ui-badge-label">{children}</span>
  </span>;
});

export type StatusBadgeStatus = 'active' | 'pending' | 'inactive' | 'success' | 'warning' | 'error' | 'processing';
const statuses: Record<StatusBadgeStatus, { label: string; tone: FeedbackTone; icon: IconName }> = {
  active: { label: 'Active', tone: 'success', icon: 'check-circle' },
  pending: { label: 'Pending', tone: 'warning', icon: 'clock' },
  inactive: { label: 'Inactive', tone: 'neutral', icon: 'pause' },
  success: { label: 'Success', tone: 'success', icon: 'check-circle' },
  warning: { label: 'Warning', tone: 'warning', icon: 'warning' },
  error: { label: 'Error', tone: 'danger', icon: 'error-circle' },
  processing: { label: 'Processing', tone: 'brand', icon: 'spinner' },
};
export interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'icon' | 'children'> {
  status: StatusBadgeStatus;
  children?: ReactNode;
}
/** Distinct symbols and text expose status. Only `processing`, work actually under way, moves: its spinner turns
 *  (still under reduced motion). Keep the label one stable word per status ("Building", not "Building · api"):
 *  a label that changes with each step re-flows its table column; put the step beside or under the badge. */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge({ status, children, ...props }, ref) {
  let spec = statuses[status];
  if (!spec) {
    reportContentProblem(`Unknown status: ${status}`);
    spec = { label: typeof status === 'string' && (status as string).trim() ? status : 'Unknown', tone: 'neutral', icon: 'info' };
  }
  return <Badge {...props} ref={ref} tone={spec.tone} icon={spec.icon}>{children ?? spec.label}</Badge>;
});

const SharedTooltipProvider = createContext(false);

export interface TooltipProviderProps {
  children: ReactNode;
  /** How long a pointer rests on a trigger before its tip opens, in milliseconds. A Tooltip's own delayDuration wins. */
  delayDuration?: number;
  /** After one tip closes, how long the next trigger opens its tip at once, in milliseconds. */
  skipDelayDuration?: number;
}
/** Shares tooltip timing across a group of triggers (a toolbar, a collapsed sidebar): once one tip has opened, moving to
 * the next trigger opens its tip without the delay. Mount it once near the root; Tooltips use the nearest one. */
export function TooltipProvider({ children, delayDuration = 350, skipDelayDuration = 300 }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
    <SharedTooltipProvider.Provider value={true}>{children}</SharedTooltipProvider.Provider>
  </TooltipPrimitive.Provider>;
}

export interface TooltipProps {
  /** One element that takes a ref and pointer and focus events. A disabled button fires neither, so its tip never
   * opens: wrap it in a focusable element (`<span tabIndex={0}>`) or explain the reason beside it instead. */
  trigger: ReactElement;
  /** Tooltips are supplemental, noninteractive text; the trigger already needs an accessible name. */
  children: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  /** Also open on click or tap. Touch screens never hover, so a tip that carries information (as in
   * InfoHint) needs this; a tip that only repeats a button's name does not. */
  openOnClick?: boolean;
  className?: string;
}
export function Tooltip({ trigger, children, side = 'top', align = 'center', delayDuration, openOnClick = false, className }: TooltipProps) {
  const layer = useOverlayLayer('tooltip');
  const shared = useContext(SharedTooltipProvider);
  const [open, setOpen] = useState(false);
  const press = useRef<{ open: boolean; type: string } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Read once the trigger is in place: a tooltip speaks in the language of what it describes.
  const locale = useOpenerLocale(true, () => triggerRef.current);
  // Without usable text (production only; development throws) the trigger renders alone.
  if (typeof children !== 'string') {
    reportContentProblem('Tooltip content must be noninteractive text.');
    return trigger;
  }
  if (!meaningful(children, 'Tooltip')) return trigger;
  if (delayDuration !== undefined && (!Number.isFinite(delayDuration) || delayDuration < 0)) {
    reportContentProblem('Tooltip delay must be a nonnegative duration.');
    delayDuration = undefined;
  }
  // Radix closes a tooltip on pointer down and on click; for a toggletip a mouse click keeps it open,
  // a tap toggles it and Enter or Space toggles it.
  const clickProps = openOnClick ? {
    onPointerDown: (event: ReactPointerEvent) => { press.current = { open, type: event.pointerType }; },
    onClick: (event: ReactMouseEvent) => {
      event.preventDefault();
      const pressed = press.current;
      press.current = null;
      setOpen(pressed?.type === 'mouse' ? true : !(pressed ? pressed.open : open));
    },
  } : {};
  const root = <TooltipPrimitive.Root {...(openOnClick ? { open, onOpenChange: setOpen } : {})} {...(shared && delayDuration === undefined ? {} : { delayDuration: delayDuration ?? 350 })}>
    <TooltipPrimitive.Trigger asChild ref={triggerRef} {...clickProps}>{trigger}</TooltipPrimitive.Trigger>
    {/* Content is the portal's direct child so Radix keeps it mounted for its exit animation. */}
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content side={side} align={align} sideOffset={6} collisionPadding={12} hideWhenDetached style={layer.style}
        className={cx('easm-ui easm-ui-tooltip', className)} {...locale}>
        <OverlayLayerContext.Provider value={layer.scope}>{children}</OverlayLayerContext.Provider>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>;
  // Inside a TooltipProvider the shared timing applies; a lone Tooltip brings its own.
  return shared ? root : <TooltipPrimitive.Provider delayDuration={delayDuration ?? 350} skipDelayDuration={300}>{root}</TooltipPrimitive.Provider>;
}

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children' | 'role' | 'aria-live' | 'aria-atomic'> {
  title: ReactNode;
  description?: ReactNode;
  tone?: FeedbackTone;
  onDismiss?: () => void;
  dismissLabel?: string;
  action?: ReactNode;
}
/** Remains visible until the consumer dismisses it. Only the message is a live region. */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast({ title, description, tone = 'neutral', onDismiss,
  dismissLabel = 'Dismiss notification', action, className, ...props }, ref) {
  if (!meaningful(title, 'Toast')) return null;
  if (onDismiss && !meaningful(dismissLabel, 'Toast dismissal')) dismissLabel = 'Dismiss notification';
  return <div {...props} ref={ref} data-tone={tone} className={cx('easm-ui easm-ui-toast', className)}>
    {tone === 'success'
      // Success ticks once as the toast arrives (the confirm preset), then rests on the same check.
      ? <LazyAnimatedIcon preset="confirm" icon="check-circle" effect="confirm" active size={20} tone="inherit" className="easm-ui-feedback-icon" aria-hidden="true" />
      : <UIIcon name={toneIcons[tone]} size={20} className="easm-ui-feedback-icon" />}
    <div className="easm-ui-feedback-content">
      <div role={tone === 'danger' ? 'alert' : 'status'} aria-atomic="true">
        <div className="easm-ui-feedback-title">{title}</div>
        {description ? <div className="easm-ui-feedback-description">{description}</div> : null}
      </div>
      {action ? <div className="easm-ui-feedback-action">{action}</div> : null}
    </div>
    {onDismiss ? <button type="button" className="easm-ui-feedback-dismiss" aria-label={dismissLabel} onClick={onDismiss}><UIIcon name="close" size={16} /></button> : null}
  </div>;
});

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role' | 'aria-live' | 'aria-atomic'> {
  title: ReactNode;
  description?: ReactNode;
  tone?: FeedbackTone;
  /** Enable only for a newly inserted or changing message that needs an announcement. */
  live?: boolean;
  action?: ReactNode;
  /** Shows a close button in the alert's top corner, as on a toast. (A close button passed as `action` sat under
   * the text.) */
  onDismiss?: () => void;
  dismissLabel?: string;
}
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert({ title, description, children, tone = 'brand', live = false,
  action, onDismiss, dismissLabel = 'Dismiss', className, ...props }, ref) {
  if (!meaningful(title, 'Alert')) return null;
  if (onDismiss && !meaningful(dismissLabel, 'Alert dismissal')) dismissLabel = 'Dismiss';
  return <div {...props} ref={ref} data-tone={tone} className={cx('easm-ui easm-ui-alert', className)}>
    <UIIcon name={toneIcons[tone]} size={20} className="easm-ui-feedback-icon" />
    <div className="easm-ui-feedback-content">
      <div role={live ? tone === 'danger' ? 'alert' : 'status' : undefined} aria-atomic={live || undefined}>
        <div className="easm-ui-feedback-title">{title}</div>
        {description ? <div className="easm-ui-feedback-description">{description}</div> : null}
        {children ? <div className="easm-ui-feedback-description">{children}</div> : null}
      </div>
      {action ? <div className="easm-ui-feedback-action">{action}</div> : null}
    </div>
    {onDismiss ? <button type="button" className="easm-ui-feedback-dismiss" aria-label={dismissLabel} onClick={onDismiss}><UIIcon name="close" size={16} /></button> : null}
  </div>;
});

export interface ProgressProps extends Omit<ProgressHTMLAttributes<HTMLProgressElement>, 'value' | 'max' | 'children' | 'role' | 'aria-valuenow' | 'aria-valuemin' | 'aria-valuemax'> {
  label: string;
  value?: number;
  max?: number;
  state?: 'default' | 'success' | 'error';
  description?: string;
  showValue?: boolean;
}
export const Progress = forwardRef<HTMLProgressElement, ProgressProps>(function Progress({ label, value, max = 100,
  state = 'default', description, showValue = false, className, id, ...props }, ref) {
  const generatedId = useId();
  // Out-of-range data is reported (development throws); a production build clamps it and keeps the bar.
  if (!meaningful(label, 'Progress')) label = 'Progress';
  if (!Number.isFinite(max) || max <= 0) {
    reportContentProblem('Progress max must be a finite positive number.');
    max = 100;
  }
  if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > max)) {
    reportContentProblem('Progress value must be between zero and max.');
    value = Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : undefined;
  }
  if (state === 'error' && value === undefined) reportContentProblem('Failed progress requires its last recorded value.');
  if (state === 'success' && value !== undefined && value !== max) {
    reportContentProblem('Successful progress must be complete.');
    value = max;
  }
  const progressId = id || generatedId;
  const descriptionId = progressId + '-description';
  const actualValue = value === undefined && state === 'success' ? max : value;
  const describedBy = [props['aria-describedby'], description ? descriptionId : undefined].filter(Boolean).join(' ') || undefined;
  return <div className={cx('easm-ui easm-ui-progress', className)} data-state={state}>
    <div className="easm-ui-progress-label-row"><label htmlFor={progressId}>{label}</label>
      {showValue && actualValue !== undefined ? <span aria-hidden="true">{Math.round(actualValue / max * 100)}%</span> : null}
    </div>
    <progress {...props} ref={ref} id={progressId} value={actualValue} max={max} aria-label={props['aria-label'] || label}
      aria-describedby={describedBy} className="easm-ui-progress-track" />
    {description ? <p id={descriptionId} className="easm-ui-progress-description">{description}</p> : null}
  </div>;
});

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'role' | 'aria-live'> {
  label?: string;
  size?: 16 | 20 | 24 | 32;
  /** `brand` (default) draws the EASM loaders: at 24 and 32 the EASM mark connecting, at 16 and 20 the searching
   *  dots. `ring` is the plain rotating ring, for places that must not carry the brand. */
  variant?: 'brand' | 'ring';
}
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner({ label = 'Loading', size = 20, variant = 'brand', className, ...props }, ref) {
  if (!meaningful(label, 'Spinner')) label = 'Loading';
  const art = variant === 'ring'
    ? <LazyAnimatedIcon preset="loading" icon="spinner" effect="spin" active repeat size={size} tone="inherit" outline aria-hidden="true" />
    : size >= 24
      ? <EasmIcon state="connecting" size={size === 32 ? 40 : 28} railColor="currentColor" title="" aria-hidden="true" />
      : <EasmDots variant="searching" size={size === 20 ? 5 : 4} announce={false} label="" aria-hidden="true" />;
  return <span {...props} ref={ref} role="status" className={cx('easm-ui easm-ui-spinner', className)} data-variant={variant} data-size={size}>
    {art}
    <span className="easm-ui-sr-only">{label}</span>
  </span>;
});

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: 'text' | 'rect' | 'circle';
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  lines?: number;
  animated?: boolean;
}
/** A decorative, inert placeholder. It shimmers while it waits (pass animated={false} for a still one); reduced
 *  motion keeps it still. */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton({ shape = 'text', width, height,
  lines = 1, animated = true, children, className, style, ...props }, ref) {
  if (!Number.isInteger(lines) || lines < 1 || lines > 20) {
    reportContentProblem('Skeleton lines must be an integer from one to twenty.');
    lines = Number.isFinite(lines) ? Math.min(20, Math.max(1, Math.round(lines))) : 1;
  }
  const multiline = shape === 'text' && lines > 1 && children == null;
  // Several lines: height is each line's, and the block grows to hold them all.
  return <div {...props} ref={ref} aria-hidden="true" inert data-shape={shape} data-animated={animated || undefined}
    className={cx('easm-ui easm-ui-skeleton', children != null && 'easm-ui-skeleton-content', multiline && 'easm-ui-skeleton-multiline', className)}
    style={{ width, ...(height !== undefined && !multiline ? { height } : {}), ...style }}>
    {children ?? (multiline ? Array.from({ length: lines }, (_, index) => <span key={index} className="easm-ui-skeleton-line" style={height !== undefined ? { height } : undefined} />) : null)}
  </div>;
});
