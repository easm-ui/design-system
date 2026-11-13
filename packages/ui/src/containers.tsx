'use client';

import { useId, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx, reportContentProblem, UIIcon, useControllableState, type UIIconName } from './shared';
import { ToneIcon, type ChartTone } from './insights';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'outlined' | 'elevated' | 'plain'; padding?: 'none' | 'sm' | 'md' | 'lg';
  title?: string; description?: string; actions?: ReactNode; footer?: ReactNode;
  /** An icon in a soft square before the title; tone tints it. */
  icon?: UIIconName; iconTone?: ChartTone;
  /** Level of the title's heading, to fit the page outline. Defaults to 3. */
  headingLevel?: 2 | 3 | 4;
}
export function Card({ variant = 'outlined', padding = 'md', title, description, actions, footer, icon, iconTone, headingLevel = 3, children, className, ...props }: CardProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return <div {...props} className={cx('easm-ui easm-ui-card', className)} data-variant={variant} data-padding={padding}>
    {title || actions ? <div className="easm-ui-container-header" data-has-icon={icon && title ? true : undefined}>{icon && title ? <ToneIcon icon={icon} tone={iconTone} /> : null}<div>{title ? <Heading className="easm-ui-container-title">{title}</Heading> : null}{description ? <p className="easm-ui-container-description">{description}</p> : null}</div>{actions ? <div className="easm-ui-container-actions">{actions}</div> : null}</div> : description ? <p className="easm-ui-container-description">{description}</p> : null}
    <div className="easm-ui-container-body">{children}</div>
    {footer ? <div className="easm-ui-container-footer">{footer}</div> : null}
  </div>;
}

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  title: string; description?: string; actions?: ReactNode; footer?: ReactNode;
  padding?: 'sm' | 'md' | 'lg'; headingLevel?: 2 | 3 | 4;
  icon?: UIIconName; iconTone?: ChartTone;
}
export function Panel({ title, description, actions, footer, children, padding = 'md', headingLevel = 2, icon, iconTone, className, ...props }: PanelProps) {
  // A blank title throws in development; a production build warns and renders the panel untitled.
  if (typeof title !== 'string' || !title.trim()) reportContentProblem('Panel requires a meaningful title.');
  const uid = useId(); const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return <section {...props} aria-labelledby={`${uid}-title`} className={cx('easm-ui easm-ui-panel', className)} data-padding={padding}>
    <div className="easm-ui-container-header" data-has-icon={icon ? true : undefined}>{icon ? <ToneIcon icon={icon} tone={iconTone} /> : null}<div><Heading id={`${uid}-title`} className="easm-ui-container-title">{title}</Heading>{description ? <p className="easm-ui-container-description">{description}</p> : null}</div>{actions ? <div className="easm-ui-container-actions">{actions}</div> : null}</div>
    <div className="easm-ui-container-body">{children}</div>{footer ? <div className="easm-ui-container-footer">{footer}</div> : null}
  </section>;
}

export interface CollapsibleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onChange'> {
  title: string; description?: string; icon?: UIIconName; open?: boolean; defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void; disabled?: boolean; headingLevel?: 2 | 3 | 4;
  /** card: a standalone white card with the icon in a soft square, as in a side panel. */
  appearance?: 'plain' | 'card';
  /** Tints the icon's soft square in the card appearance, as on Card and Panel. */
  iconTone?: ChartTone;
}
export function Collapsible({ title, description, icon, iconTone, open, defaultOpen = false, onOpenChange, disabled, headingLevel = 3, appearance = 'plain', children, className, ...props }: CollapsibleProps) {
  if (typeof title !== 'string' || !title.trim()) reportContentProblem('Collapsible requires a meaningful title.');
  const uid = useId(); const [expanded, expand] = useControllableState(open, defaultOpen, onOpenChange);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const focusWithin = useRef(false);
  useLayoutEffect(() => {
    if (!expanded) {
      const region = regionRef.current;
      if (focusWithin.current || region?.contains(region.ownerDocument.activeElement)) {
        // Native inert can clear activeElement before this effect. Capture focus
        // while expanded, then return it to a surviving, available destination.
        const destination = disabled ? containerRef.current : triggerRef.current;
        destination?.focus({ preventScroll: true });
      }
      focusWithin.current = false;
    }
  }, [expanded, disabled]);
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  // A named group: the name applies (ARIA does not name a plain div), and when focus has to fall back to the
  // wrapper (its trigger was disabled while focus was inside) the group's name is what is announced.
  return <div role="group" {...props} ref={containerRef} tabIndex={props.tabIndex ?? -1}
    aria-labelledby={props['aria-labelledby'] ?? (props['aria-label'] ? undefined : `${uid}-trigger`)}
    className={cx('easm-ui easm-ui-collapsible', className)} data-open={expanded || undefined} data-has-icon={Boolean(icon) || undefined} data-appearance={appearance}>
    <Heading className="easm-ui-collapsible-heading"><button ref={triggerRef} type="button" id={`${uid}-trigger`} aria-controls={`${uid}-content`} aria-expanded={expanded} disabled={disabled} onClick={() => expand(!expanded)} className="easm-ui-collapsible-trigger">
      <span className="easm-ui-collapsible-label">{icon ? appearance === 'card' ? <ToneIcon icon={icon} tone={iconTone} size="sm" /> : <UIIcon name={icon} className="easm-ui-collapsible-leading" /> : null}<span className="easm-ui-collapsible-copy"><span className="easm-ui-collapsible-title">{title}</span>{description ? <span className="easm-ui-collapsible-description">{description}</span> : null}</span></span><UIIcon name="chevron-down" className="easm-ui-collapsible-chevron" />
    </button></Heading>
    <div ref={regionRef} id={`${uid}-content`} aria-hidden={!expanded} inert={!expanded}
      onFocusCapture={() => { focusWithin.current = true; }}
      onBlurCapture={event => {
        if (expanded && !event.currentTarget.contains(event.relatedTarget as Node | null)) focusWithin.current = false;
      }} className="easm-ui-collapsible-region">
      <div className="easm-ui-collapsible-clip"><div className="easm-ui-collapsible-content">{children}</div></div>
    </div>
  </div>;
}

export interface AccordionItem { id: string; title: string; description?: string; icon?: UIIconName; content: ReactNode; disabled?: boolean }
export interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  items: AccordionItem[]; value?: string[]; defaultValue?: string[];
  onValueChange?: (value: string[]) => void; multiple?: boolean; headingLevel?: 2 | 3 | 4;
  /** Each item's appearance; see Collapsible. */
  appearance?: 'plain' | 'card';
}
export function Accordion({ items: givenItems, value, defaultValue = [], onValueChange, multiple = false, headingLevel = 3, appearance = 'plain', className, ...props }: AccordionProps) {
  // Items without a unique ID and a title throw in development; a production build warns and leaves them out.
  const seen = new Set<string>();
  const usable = givenItems.filter(item => {
    const valid = typeof item.id === 'string' && !!item.id.trim() && typeof item.title === 'string' && !!item.title.trim() && !seen.has(item.id);
    seen.add(item.id);
    return valid;
  });
  if (usable.length !== givenItems.length) reportContentProblem('Accordion items require unique, nonempty IDs and titles.');
  const items = usable.length === givenItems.length ? givenItems : usable;
  const [selected, select] = useControllableState(value, defaultValue, onValueChange);
  const available = [...new Set(selected.filter(id => items.some(item => item.id === id)))];
  return <div {...props} className={cx('easm-ui easm-ui-accordion', className)}>{items.map(item => <Collapsible key={item.id} title={item.title} description={item.description} icon={item.icon} disabled={item.disabled} headingLevel={headingLevel} appearance={appearance}
    open={available.includes(item.id) && (multiple || available[0] === item.id)} onOpenChange={open => select(open ? multiple ? [...available, item.id] : [item.id] : available.filter(id => id !== item.id))}>{item.content}</Collapsible>)}</div>;
}

export interface DividerProps extends HTMLAttributes<HTMLDivElement> { orientation?: 'horizontal' | 'vertical'; decorative?: boolean; label?: string }
export function Divider({ orientation = 'horizontal', decorative = true, label, className, ...props }: DividerProps) {
  return <div {...props} role={decorative && !label ? undefined : 'separator'} aria-hidden={decorative && !label || undefined} aria-orientation={decorative && !label ? undefined : orientation} aria-label={label} data-orientation={orientation} className={cx('easm-ui-divider', className)} />;
}
