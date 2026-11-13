'use client';

import type { HTMLAttributes } from 'react';
import { cx, reportContentProblem, UIIcon } from './shared';

export interface InlineValidationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role' | 'aria-live'> {
  children: string;
  tone?: 'error' | 'success' | 'info';
  appearance?: 'plain' | 'surface';
  live?: 'off' | 'polite' | 'assertive';
}

/** Link its id from a field; opt into live announcements only for real updates. */
export function InlineValidation({ children, tone = 'error', appearance = 'plain', live = 'off', className, ...props }: InlineValidationProps) {
  if (!children.trim()) {
    reportContentProblem('InlineValidation requires useful message text.');
    return null; // Production: an empty message is not shown.
  }
  return <div {...props} className={cx('easm-ui easm-ui-inline-validation', className)} data-tone={tone} data-appearance={appearance}
    role={live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined} aria-live={live === 'off' ? undefined : live} aria-atomic={live === 'off' ? undefined : true}>
    <UIIcon name={tone === 'error' ? 'error-circle' : tone === 'success' ? 'check-circle' : 'info-circle'} size={16} />
    <span>{children}</span>
  </div>;
}
