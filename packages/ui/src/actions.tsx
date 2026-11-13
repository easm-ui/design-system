'use client';

import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cx, UIIcon, iconSizeFor, reportContentProblem, type ComponentSize, type UIIconName } from './shared';
import { DropdownMenu, type MenuItem } from './overlays';
import { ControlIcon } from './control-icon';

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'destructive';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ComponentSize;
  leadingIcon?: UIIconName;
  trailingIcon?: UIIconName;
  loading?: boolean;
  block?: boolean;
  selected?: boolean;
  /** Overrides the icon size the button's size implies (sm 16, md 20, lg 24). */
  iconSize?: 16 | 20 | 24;
}

const blank = (children: ReactNode) => children === undefined || children === null || children === false || typeof children === 'string' && !children.trim();

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary', size = 'md', leadingIcon, trailingIcon, loading = false,
  block = false, selected, disabled, children, className, type = 'button', iconSize: suppliedIconSize,
  onClick, onKeyDown, 'aria-disabled': ariaDisabled, ...props
}, ref) {
  if (blank(children) && !props['aria-label']?.trim() && !props['aria-labelledby']?.trim()) {
    reportContentProblem('Button requires visible content or an accessible name. Use IconButton for an icon-only action.');
  }
  const blocked = disabled || loading || ariaDisabled === true || ariaDisabled === 'true';
  const iconSize = suppliedIconSize ?? iconSizeFor(size);
  return <button {...props} ref={ref} type={type} disabled={disabled}
    aria-disabled={blocked || undefined} aria-busy={loading || undefined}
    aria-pressed={selected === undefined ? props['aria-pressed'] : selected}
    data-size={size} data-variant={variant} data-loading={loading || undefined}
    data-selected={selected || undefined}
    className={cx('easm-ui easm-ui-button', block && 'easm-ui-button-block', className)}
    onClick={event => { if (blocked) { event.preventDefault(); event.stopPropagation(); return; } onClick?.(event); }}
    onKeyDown={event => { if (blocked && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); return; } onKeyDown?.(event); }}>
    {leadingIcon ? <ControlIcon name={leadingIcon} size={iconSize} /> : null}
    <span className="easm-ui-button-label">{children}</span>
    {trailingIcon ? <ControlIcon name={trailingIcon} size={iconSize} /> : null}
    {loading ? <span className="easm-ui-button-busy-indicator" aria-hidden="true"><UIIcon name="spinner" size={iconSize} data-motion="spin" data-active="true" data-repeat="true" className="easm-ui-button-spinner" /></span> : null}
  </button>;
});

export type IconButtonFeedback = 'success' | 'error' | 'warning';
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leadingIcon' | 'trailingIcon' | 'block'> {
  icon: UIIconName;
  label: string;
  /** A short-lived result of the action, shown as a small status mark on the button and announced
   * (an error assertively). Requires feedbackLabel. Clear it when the result no longer applies. */
  feedback?: IconButtonFeedback;
  /** What the feedback mark means, for assistive technology ("Copied", "Could not copy"). */
  feedbackLabel?: string;
}
const feedbackIcons: Record<IconButtonFeedback, UIIconName> = { success: 'checkmark-circle', error: 'error-circle', warning: 'warning' };

/* Feedback is announced from one pair of page-level live regions. A status region inside the button would never
   be read (a button's children are presentational), and a region that appears together with its text is often
   missed. The regions carry aria-live, so a modal's aria-hidden pass (Radix hideOthers) leaves them exposed. */
type FeedbackPoliteness = 'polite' | 'assertive';
let feedbackRegions: Record<FeedbackPoliteness, HTMLElement> | undefined;
function ensureFeedbackRegions() {
  if (typeof document === 'undefined' || !document.body) return undefined;
  if (feedbackRegions?.polite.isConnected) return feedbackRegions;
  const container = document.createElement('div');
  container.setAttribute('data-easm-ui-announcer', '');
  Object.assign(container.style, { position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: '0' });
  const region = (role: string, live: FeedbackPoliteness) => {
    const element = document.createElement('div');
    element.setAttribute('role', role); element.setAttribute('aria-live', live); element.setAttribute('aria-atomic', 'true');
    container.append(element);
    return element;
  };
  feedbackRegions = { polite: region('status', 'polite'), assertive: region('alert', 'assertive') };
  document.body.append(container);
  return feedbackRegions;
}
/** Clears, then writes after a beat, so a region created just now is in the tree first and a repeat is read again. */
function announceFeedback(message: string, politeness: FeedbackPoliteness) {
  const target = ensureFeedbackRegions()?.[politeness];
  if (!target) return;
  target.textContent = '';
  setTimeout(() => { target.textContent = message; }, 100);
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ icon, label, variant = 'subtle', feedback, feedbackLabel, className, 'aria-describedby': describedBy, ...props }, ref) {
  const named = typeof label === 'string' && !!label.trim();
  if (!named) reportContentProblem('IconButton requires a meaningful label.');
  if (feedback && !feedbackLabel?.trim()) reportContentProblem('IconButton feedback requires feedbackLabel.');
  const name = named ? label : icon;
  const showFeedback = !!feedback && !!feedbackLabel?.trim() && !props.loading;
  const message = showFeedback ? feedbackLabel!.trim() : '';
  const feedbackId = useId();
  // A button that can show feedback creates the regions on mount, ahead of its first message.
  const feedbackCapable = feedback !== undefined || feedbackLabel !== undefined;
  useEffect(() => { if (feedbackCapable) ensureFeedbackRegions(); }, [feedbackCapable]);
  useEffect(() => { if (message) announceFeedback(message, feedback === 'error' ? 'assertive' : 'polite'); }, [message, feedback]);
  return <Button {...props} ref={ref} variant={variant} leadingIcon={icon} aria-label={name}
    aria-describedby={[describedBy, showFeedback ? feedbackId : undefined].filter(Boolean).join(' ') || undefined}
    data-feedback={showFeedback ? feedback : undefined}
    className={cx('easm-ui-icon-button', className)}>
    <span className="easm-ui-sr-only">{name}</span>
    {showFeedback ? <>
      <span className="easm-ui-icon-button-feedback" data-tone={feedback} aria-hidden="true"><UIIcon name={feedbackIcons[feedback]} size={16} /></span>
      {/* While shown, the feedback is also the button's description, so it is read again on focus. */}
      <span className="easm-ui-sr-only" id={feedbackId}>{feedbackLabel}</span>
    </> : null}
  </Button>;
});

export interface SplitButtonProps extends Omit<ButtonProps, 'trailingIcon'> {
  items: MenuItem[];
  menuLabel?: string;
}
/** The ref reaches the main action button. `block` stretches the whole split button; the main action takes the room. */
export const SplitButton = forwardRef<HTMLButtonElement, SplitButtonProps>(function SplitButton({ items, menuLabel = 'More actions', size = 'md', variant = 'primary', disabled, loading, block = false, className, 'aria-disabled': ariaDisabled, ...props }, ref) {
  const blocked = disabled || loading || ariaDisabled === true || ariaDisabled === 'true';
  // The menu spans the whole split button so both edges line up; a primary action opens the dark panel.
  const group = useRef<HTMLDivElement>(null);
  const [menuWidth, setMenuWidth] = useState<number>();
  return <div ref={group} className={cx('easm-ui-split-button', className)} data-variant={variant} data-block={block || undefined}>
    <Button {...props} ref={ref} size={size} variant={variant} disabled={disabled} loading={loading} aria-disabled={ariaDisabled} />
    <DropdownMenu items={items} label={menuLabel} surface={variant === 'primary' ? 'ink' : 'auto'} width={menuWidth}
      onOpenChange={open => { if (open) setMenuWidth(group.current?.getBoundingClientRect().width); }}
      trigger={<IconButton icon="chevron-down" label={menuLabel} size={size} variant={variant} disabled={blocked} />} />
  </div>;
});

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  children: ReactNode;
  attached?: boolean;
  orientation?: 'horizontal' | 'vertical';
}
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup({ label, attached = false, orientation = 'horizontal', className, children, ...props }, ref) {
  return <div {...props} ref={ref} role="group" aria-label={label} data-attached={attached || undefined} data-orientation={orientation}
    className={cx('easm-ui-button-group', className)}>{children}</div>;
});
