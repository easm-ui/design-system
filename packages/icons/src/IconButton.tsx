'use client';

import { forwardRef, useEffect, useId, type ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';
import type { IconName } from './registry';
import { announce, ensureLiveRegions } from './announce';

export interface IconButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'dangerouslySetInnerHTML' | 'aria-label' | 'aria-pressed' | 'aria-busy' | 'aria-disabled'> {
  icon: IconName;
  label: string;
  selected?: boolean;
  busy?: boolean;
  tone?: 'brand' | 'neutral' | 'primary';
  density?: 'compact' | 'normal' | 'comfortable';
  iconSize?: 16 | 20 | 24;
}
export type IconButtonProps = IconButtonBaseProps & (
  | { feedback?: undefined; feedbackLabel?: never }
  | { feedback: 'success' | 'error' | 'warning'; feedbackLabel: string }
);

/** States are controlled by native interaction; disabled and busy actions are guarded.
 * Feedback shows a badge, is announced through a page-level live region when it appears or changes
 * (errors assertively), and stays in the button's description while it is shown.
 * @deprecated Use `IconButton` from `@easm-ui/ui`: the product icon button (variant, size, honey theme
 * tokens, focus halo, 44 px targets on touch). This one stays for compatibility. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, selected, busy = false, feedback, feedbackLabel, tone = 'brand', density = 'normal', iconSize = 20,
    disabled = false, className, onClick, type = 'button', 'aria-describedby': describedBy, ...props }, ref,
) {
  const feedbackId = useId();
  const showFeedback = Boolean(feedback && !busy);
  const message = showFeedback ? feedbackLabel?.trim() : undefined;
  useEffect(() => { ensureLiveRegions(); }, []);
  useEffect(() => {
    if (message) announce(message, feedback === 'error' ? 'assertive' : 'polite');
  }, [message, feedback]);
  if (!label.trim()) throw new Error('IconButton requires a non-empty accessible label');
  if (feedback && !feedbackLabel?.trim()) throw new Error('IconButton feedback requires an accessible status label');
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      aria-busy={busy || undefined}
      aria-disabled={disabled || busy || undefined}
      aria-describedby={[describedBy, showFeedback ? feedbackId : undefined].filter(Boolean).join(' ') || undefined}
      className={['easm-icon-button', className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-density={density}
      data-selected={selected || undefined}
      data-busy={busy || undefined}
      data-feedback={feedback}
      onClick={event => {
        if (disabled || busy) { event.preventDefault(); return; }
        onClick?.(event);
      }}
    >
      <Icon name={busy ? 'spinner' : icon} size={iconSize} tone="inherit" className={busy ? 'easm-icon-spin' : undefined} />
      {showFeedback ? (
        <>
          <span className="easm-icon-feedback" aria-hidden="true">
            <Icon name={feedback === 'success' ? 'check-circle' : feedback === 'error' ? 'error-circle' : 'warning'} size={16} tone="inherit" outline />
          </span>
          <span className="easm-icon-sr-only" id={feedbackId}>{feedbackLabel}</span>
        </>
      ) : null}
    </button>
  );
});
