'use client';

import { Fragment, useCallback, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { IconName } from '@easm-ui/icons';
import { Button, IconButton } from './actions';
import { cx, interactionOrigin, reportContentProblem, UIIcon, useControllableState, useOpenerLocale, type ComponentSize, type WritingDirection } from './shared';
import { OverlayLayerContext, useOverlayLayer } from './overlay-layer';

interface OverlayStateProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type AnchorSide = 'top' | 'right' | 'bottom' | 'left';
type AnchorAlign = 'start' | 'center' | 'end';

/* Content problems throw in development and tests. In a production build they warn once and the overlay degrades:
   a blank label falls back to its default, and menu items without a usable ID or label are left out. */
/** The label when it is usable, else the fallback (after reporting the problem). */
function requireText(value: string, subject: string, fallback = '') {
  if (typeof value === 'string' && value.trim()) return value;
  reportContentProblem(`${subject} must have a nonempty label.`);
  return fallback;
}
function requireTitle(title: ReactNode, subject: string) {
  if (title == null || typeof title === 'boolean' || typeof title === 'string' && !title.trim()) {
    reportContentProblem(`${subject} requires a meaningful title.`);
  }
}
function hasDescription(description: ReactNode) {
  return description != null && typeof description !== 'boolean' && !(typeof description === 'string' && !description.trim());
}

/** Form controls a person fills in. A Radix Select keeps a hidden native select for forms (aria-hidden, tabindex -1);
 * its real control is the combobox button. */
const FIELD_SELECTOR = ':is(input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="combobox"])';
/** The first field a person can use in a modal's content, or null. */
function firstField(panel: HTMLElement | null) {
  if (!panel) return null;
  for (const element of panel.querySelectorAll<HTMLElement>(`.easm-ui-overlay-content ${FIELD_SELECTOR}`)) {
    if (element.matches(':disabled, [tabindex="-1"], [aria-hidden="true"], [aria-disabled="true"]')) continue;
    if (element.closest('[inert], [aria-hidden="true"], [hidden]')) continue;
    return element;
  }
  return null;
}

/** Initial focus and focus return for Dialog, Drawer and ConfirmationDialog. Radix restores its trigger;
 * externally opened modals can supply the equivalent reference. `initial` decides where focus starts when no
 * initialFocusRef is given: 'tabbable' is Radix's first tabbable element, 'field' is the first field, else the panel. */
function useModalFocus(trigger: ReactElement | undefined, restoreFocusRef: RefObject<HTMLElement | null> | undefined,
  initialFocusRef: RefObject<HTMLElement | null> | undefined, initial: 'tabbable' | 'field') {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const requested = initialFocusRef?.current;
      if (requested?.isConnected) {
        event.preventDefault();
        requested.focus({ preventScroll: true });
        return;
      }
      if (initial === 'field') {
        // A drawer opens on its first field when it holds a form; otherwise on its panel, not its first button,
        // so no action looks chosen before the reader acts.
        const panel = event.currentTarget as HTMLElement | null;
        event.preventDefault();
        (firstField(panel) ?? panel)?.focus({ preventScroll: true });
      }
    },
    onCloseAutoFocus: (event: Event) => {
      const target = restoreFocusRef?.current ?? (!trigger ? opener.current : null);
      if (target?.isConnected) {
        event.preventDefault();
        target.focus({ preventScroll: true });
      }
    },
  };
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  /** A second, quieter line under the label. Items with one are drawn larger, their icon on a tile. */
  description?: string;
  /** The current choice (the dashboard you are in): tinted, with a check at the end. */
  selected?: boolean;
  /** Draws a divider above the item, to set it apart from the ones before. */
  separatorBefore?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: (event: Event) => void;
}

/**
 * The panel colour of a menu or popover. Floating layers are told apart by fill, not shadow:
 * 'page' is a white sheet over the white page, 'card' a grey panel over white cards, and 'ink'
 * the dark panel used for a primary action. 'auto' (the default) reads where the trigger sits: the nearest
 * container that declares a surface (a card, a panel, a dialog, another popover) or an ancestor pinned with
 * data-easm-surface="page" | "card" | "ink".
 */
export type OverlaySurface = 'auto' | 'page' | 'card' | 'ink';
type ResolvedSurface = Exclude<OverlaySurface, 'auto'>;
/** White containers, read when the stylesheet's surface declarations are not available. */
const CARD_CONTAINERS = [
  '.easm-ui-card', '.easm-ui-panel', '.easm-ui-data-table', '.easm-ui-chart', '.easm-ui-stat-card', '.easm-ui-overlay-panel',
  '.easm-ui-settings-section', '.easm-ui-series-chart[data-appearance="card"]', '.easm-ui-notification-pattern', '.easm-ui-ai-action',
  '.easm-ui-collapsible', '.easm-ui-popover:not([data-surface="card"]):not([data-surface="ink"])',
].join(', ');
function isSurface(value: string | undefined): value is ResolvedSurface {
  return value === 'page' || value === 'card' || value === 'ink';
}
function resolveSurface(surface: OverlaySurface, trigger: HTMLElement | null): ResolvedSurface {
  if (surface !== 'auto') return surface;
  if (!trigger) return 'page';
  // One declaration per container: the stylesheet sets --easm-ui-surface-context on each container and on
  // [data-easm-surface] pins, and the nearest one wins.
  const declared = trigger.ownerDocument.defaultView?.getComputedStyle(trigger).getPropertyValue('--easm-ui-surface-context').trim();
  if (isSurface(declared)) return declared;
  const pinned = trigger.closest<HTMLElement>('[data-easm-surface]')?.dataset.easmSurface;
  if (isSurface(pinned)) return pinned;
  return trigger.closest(CARD_CONTAINERS) ? 'card' : 'page';
}

/** The panel colour, resolved once the trigger is in the document and kept while the panel animates out. */
function useOverlaySurface(surface: OverlaySurface, open: boolean, triggerRef: RefObject<HTMLElement | null>) {
  const [resolved, setResolved] = useState<ResolvedSurface>();
  useLayoutEffect(() => {
    if (!open || surface !== 'auto') return;
    const next = resolveSurface(surface, triggerRef.current);
    setResolved(current => current === next ? current : next);
  }, [open, surface, triggerRef]);
  return surface === 'auto' ? resolved : surface;
}

export interface DropdownMenuProps extends OverlayStateProps {
  trigger: ReactElement;
  items: MenuItem[];
  /** Names the menu. Without it the trigger's own name does, as for any menu button. */
  label?: string;
  side?: AnchorSide;
  align?: AnchorAlign;
  className?: string;
  /** Panel colour; see OverlaySurface. */
  surface?: OverlaySurface;
  /** Give the menu its trigger's exact width so both edges line up (cards, workspace switchers). */
  matchTriggerWidth?: boolean;
  /** Fixed menu width in pixels, for compound triggers such as SplitButton. */
  width?: number;
  /** A quiet heading inside the menu, above its items ("Switch dashboard"). */
  heading?: string;
  /** Dims the page behind the open menu. Defaults to on for a menu whose items carry descriptions (a dashboard
   * switcher), off for a plain command menu. */
  dim?: boolean;
}

/** A command menu. Radix owns keyboard navigation, focus restoration and dismissal. */
export function DropdownMenu({ trigger, items, label, side = 'bottom', align = 'end',
  open, defaultOpen, onOpenChange, className, surface = 'auto', matchTriggerWidth = false, width, heading, dim }: DropdownMenuProps) {
  const layer = useOverlayLayer('anchor');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const panelSurface = useOverlaySurface(surface, isOpen, triggerRef);
  // Radix stamps the menu with its root's direction, so the root takes the trigger's (read from its parent).
  const locale = useOpenerLocale(isOpen, () => triggerRef.current?.parentElement);
  const menuLabel = requireText(label ?? 'Actions', 'DropdownMenu', 'Actions');
  if (new Set(items.map(item => item.id)).size !== items.length) reportContentProblem('DropdownMenu item IDs must be unique.');
  const seen = new Set<string>();
  const usable = items.filter(item => {
    const valid = !!requireText(item.id, 'DropdownMenu item ID') && !!requireText(item.label, 'DropdownMenu item') && !seen.has(item.id);
    seen.add(item.id);
    return valid;
  });
  if (usable.length !== items.length) items = usable;
  const hasIcons = items.some(item => item.icon != null);
  // Items with a description are drawn larger: the icon on a tile, the label over its line.
  const rich = items.some(item => item.description?.trim());
  return <MenuPrimitive.Root open={isOpen} onOpenChange={setOpen} dir={locale.dir}>
    <MenuPrimitive.Trigger asChild ref={triggerRef}>{trigger}</MenuPrimitive.Trigger>
    {/* Each overlay's content is its portal's direct child, with the layer context inside it, so Radix can keep the
        panel mounted for its exit animation. */}
    {(dim ?? rich) ? <MenuPrimitive.Portal><div className="easm-ui-overlay-scrim" aria-hidden="true" style={layer.style} /></MenuPrimitive.Portal> : null}
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content className={cx('easm-ui easm-ui-dropdown-menu', className)} data-rich={rich || undefined} lang={locale.lang}
        style={width ? { ...layer.style, width, minWidth: 0, maxWidth: 'calc(100vw - 24px)' } : layer.style}
        data-surface={panelSurface} data-match-width={matchTriggerWidth || undefined}
        side={side} align={align} sideOffset={6} collisionPadding={12} hideWhenDetached loop aria-label={menuLabel}
        // Radix names the menu by its trigger with aria-labelledby, which outranks aria-label; an explicit label wins.
        {...(label !== undefined ? { 'aria-labelledby': undefined } : {})}>
        <OverlayLayerContext.Provider value={layer.scope}>
          {heading?.trim() ? <MenuPrimitive.Label className="easm-ui-menu-heading">{heading}</MenuPrimitive.Label> : null}
          {items.map(item => <Fragment key={item.id}>
            {item.separatorBefore ? <MenuPrimitive.Separator className="easm-ui-menu-separator" /> : null}
            <MenuPrimitive.Item textValue={item.label} disabled={item.disabled}
              onSelect={item.onSelect} data-destructive={item.destructive || undefined} data-selected={item.selected || undefined}
              aria-current={item.selected ? 'true' : undefined} className="easm-ui-menu-item">
              {rich
                ? <span className="easm-ui-menu-tile" aria-hidden="true">{item.icon ? <UIIcon name={item.icon} size={20} /> : null}</span>
                : item.icon ? <UIIcon name={item.icon} size={16} /> : hasIcons ? <span className="easm-ui-menu-icon-slot" aria-hidden="true" /> : null}
              {rich
                ? <span className="easm-ui-menu-copy"><span className="easm-ui-menu-label">{item.label}</span>{item.description?.trim() ? <small>{item.description}</small> : null}</span>
                : <span>{item.label}</span>}
              {item.selected ? <UIIcon name="checkmark" size={16} className="easm-ui-menu-check" /> : null}
            </MenuPrimitive.Item>
          </Fragment>)}
        </OverlayLayerContext.Provider>
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  </MenuPrimitive.Root>;
}

export interface PopoverProps extends OverlayStateProps {
  trigger: ReactElement;
  title?: ReactNode;
  /** Required when a visible title is omitted. */
  label?: string;
  children: ReactNode;
  side?: AnchorSide;
  align?: AnchorAlign;
  className?: string;
  /** Panel colour; see OverlaySurface. */
  surface?: OverlaySurface;
  /** Give the popover its trigger's exact width. */
  matchTriggerWidth?: boolean;
  /** The panel's width (pixels or any CSS length), never wider than the screen less a 12px margin each side. For a
   * panel with more in it than the 320px default (a status panel, a list of alerts). */
  width?: number | string;
  /** Dims the page behind the open panel, so it has the reader's attention (the default). Off for a popover that
   * works like part of a form field: a date or time picker, a filter list. */
  dim?: boolean;
  /** Level of the visible title's heading, to fit the page outline. Defaults to 3. */
  headingLevel?: 2 | 3 | 4;
}

export function Popover({ trigger, title, label, children, side = 'bottom', align = 'end',
  open, defaultOpen, onOpenChange, className, surface = 'auto', matchTriggerWidth = false, width, dim = true, headingLevel = 3 }: PopoverProps) {
  const layer = useOverlayLayer('anchor');
  const titleId = useId();
  const titled = hasDescription(title);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const panelSurface = useOverlaySurface(surface, isOpen, triggerRef);
  const locale = useOpenerLocale(isOpen, () => triggerRef.current);
  if (!titled && !label?.trim()) {
    reportContentProblem('Popover requires a visible title or a nonempty label.');
    label = 'Details';
  }
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return <PopoverPrimitive.Root open={isOpen} onOpenChange={setOpen}>
    <PopoverPrimitive.Trigger asChild ref={triggerRef}>{trigger}</PopoverPrimitive.Trigger>
    {/* A light shade over the page while the panel is open; a press on it closes the panel (it is outside it). Its
        own portal: a Radix portal takes exactly one child. */}
    {dim ? <PopoverPrimitive.Portal><div className="easm-ui-overlay-scrim" aria-hidden="true" style={layer.style} /></PopoverPrimitive.Portal> : null}
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content side={side} align={align} sideOffset={8} collisionPadding={12} hideWhenDetached
        style={width !== undefined ? { ...layer.style, width, maxWidth: 'calc(100vw - 24px)' } : layer.style}
        data-surface={panelSurface} data-match-width={matchTriggerWidth || undefined}
        aria-labelledby={titled ? titleId : undefined} aria-label={titled ? undefined : label} {...locale}
        className={cx('easm-ui easm-ui-popover', className)}>
        <OverlayLayerContext.Provider value={layer.scope}>
          {titled ? <Heading id={titleId} className="easm-ui-popover-title">{title}</Heading> : null}
          <div className="easm-ui-popover-body">{children}</div>
        </OverlayLayerContext.Provider>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}

export interface DialogProps extends OverlayStateProps {
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ComponentSize;
  closeLabel?: string;
  /** Explicit focus destination for a controlled modal opened without its built-in trigger. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** Where focus starts when the modal opens. Without it a Dialog starts on its first focusable element and a
   * Drawer on its first field, else its panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** The panel's writing direction. By default it takes the direction (and language) of the place it was opened
   * from: its trigger, restoreFocusRef, or the element last pressed or typed in. 'start' and 'end' sides follow it. */
  dir?: WritingDirection;
  className?: string;
  /** Before the title in the header: what kind of thing the panel shows (a type tile, DetailPanel). */
  lead?: ReactNode;
  /** Under the title, still in the header: its state and a quiet line of facts. */
  headerDetail?: ReactNode;
  /** Beside the close button: Previous and Next, a More menu. */
  headerActions?: ReactNode;
}

/** Closes the Dialog or Drawer it sits in, for the footer of an uncontrolled modal:
 * `footer={<DialogClose><Button>Done</Button></DialogClose>}`. The child must be one element that takes a ref. */
export function DialogClose({ children }: { children: ReactElement }) {
  return <DialogPrimitive.Close asChild>{children}</DialogPrimitive.Close>;
}
/** Closes the Drawer it sits in; the same component as DialogClose. */
export const DrawerClose = DialogClose;

/** What a modal showed while it was open, kept through its closing animation. A caller that clears the state its
 * content reads as it closes (`{answering && <form />}`) would otherwise leave an empty panel fading out over the
 * page; the panel leaves the way it looked. */
function useHeldWhileClosing<T>(open: boolean, value: T): T {
  const held = useRef(value);
  if (open) held.current = value;
  return open ? value : held.current;
}

/** Dialog and Drawer are one modal: the same panel, header, scrolling body, footer and close button. They differ in
 * their class, the drawer's side and where focus starts. */
function ModalPanel({ kind, trigger, title, description, children, footer, size = 'md', side, closeLabel,
  open, defaultOpen = false, onOpenChange, restoreFocusRef, initialFocusRef, dir, className, lead, headerDetail, headerActions }: DrawerProps & { kind: 'dialog' | 'drawer' }) {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const layer = useOverlayLayer('modal', isOpen);
  const triggerRef = useRef<HTMLElement>(null);
  const locale = useOpenerLocale(isOpen, () => triggerRef.current ?? restoreFocusRef?.current ?? interactionOrigin(), dir);
  const subject = kind === 'dialog' ? 'Dialog' : 'Drawer';
  requireTitle(title, subject);
  const view = useHeldWhileClosing(isOpen, { title, description, children, footer, lead, headerDetail, headerActions });
  const rich = !!(view.lead || view.headerDetail || view.headerActions);
  const closeName = requireText(closeLabel ?? '', `${subject} close action`, kind === 'dialog' ? 'Close dialog' : 'Close drawer');
  const described = hasDescription(view.description);
  const focus = useModalFocus(trigger, restoreFocusRef, initialFocusRef, kind === 'dialog' ? 'tabbable' : 'field');
  return <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen}>
    {trigger ? <DialogPrimitive.Trigger asChild ref={triggerRef as RefObject<HTMLButtonElement>}>{trigger}</DialogPrimitive.Trigger> : null}
    {layer.ready ? <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="easm-ui-overlay-backdrop" style={layer.style} />
      <DialogPrimitive.Content {...(described ? {} : { 'aria-describedby': undefined })}
        {...focus} ref={layer.ref} {...locale}
        style={layer.style} data-size={size} data-side={kind === 'drawer' ? side : undefined}
        className={cx('easm-ui easm-ui-overlay-panel', kind === 'dialog' ? 'easm-ui-dialog' : 'easm-ui-drawer', className)}>
        <OverlayLayerContext.Provider value={layer.scope}>
          {rich ? <header className="easm-ui-overlay-header" data-rich="true">
            {view.lead ? <span className="easm-ui-overlay-lead">{view.lead}</span> : null}
            <span className="easm-ui-overlay-heading">
              <DialogPrimitive.Title className="easm-ui-overlay-title">{view.title}</DialogPrimitive.Title>
              {view.headerDetail ? <span className="easm-ui-overlay-header-detail">{view.headerDetail}</span> : null}
            </span>
            {view.headerActions ? <span className="easm-ui-overlay-header-actions">{view.headerActions}</span> : null}
          </header> : <header className="easm-ui-overlay-header">
            <DialogPrimitive.Title className="easm-ui-overlay-title">{view.title}</DialogPrimitive.Title>
          </header>}
          <div className={cx('easm-ui-overlay-body', described && 'easm-ui-overlay-body-described')}>
            {described ? <DialogPrimitive.Description asChild><div className="easm-ui-overlay-description">{view.description}</div></DialogPrimitive.Description> : null}
            <div className="easm-ui-overlay-content">{view.children}</div>
          </div>
          {view.footer ? <footer className="easm-ui-overlay-footer">{view.footer}</footer> : null}
          <DialogPrimitive.Close asChild><IconButton icon="close" label={closeName} size="sm" className="easm-ui-overlay-close" /></DialogPrimitive.Close>
        </OverlayLayerContext.Provider>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal> : null}
  </DialogPrimitive.Root>;
}

export function Dialog({ closeLabel = 'Close dialog', ...props }: DialogProps) {
  return <ModalPanel {...props} kind="dialog" closeLabel={closeLabel} />;
}

export interface DrawerProps extends DialogProps {
  /** The edge the drawer slides from. 'start' and 'end' follow the reading direction (the end is on the left in
   * Urdu or Arabic); 'left' and 'right' are fixed. */
  side?: 'left' | 'right' | 'start' | 'end';
}

export function Drawer({ side = 'right', closeLabel = 'Close drawer', ...props }: DrawerProps) {
  return <ModalPanel {...props} kind="drawer" side={side} closeLabel={closeLabel} />;
}

export interface ConfirmationDialogProps extends OverlayStateProps {
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** The panel's writing direction; by default that of the place it was opened from, as for Dialog. */
  dir?: WritingDirection;
  className?: string;
}

/** Confirmation never closes itself after a business action; the caller owns async completion. */
export function ConfirmationDialog({ trigger, title, description, children, onConfirm, onCancel,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, loading = false,
  open, defaultOpen = false, onOpenChange, restoreFocusRef, dir, className }: ConfirmationDialogProps) {
  requireTitle(title, 'ConfirmationDialog');
  confirmLabel = requireText(confirmLabel, 'Confirmation action', 'Confirm');
  cancelLabel = requireText(cancelLabel, 'Cancel action', 'Cancel');
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const layer = useOverlayLayer('modal', isOpen);
  const triggerRef = useRef<HTMLElement>(null);
  const locale = useOpenerLocale(isOpen, () => triggerRef.current ?? restoreFocusRef?.current ?? interactionOrigin(), dir);
  const view = useHeldWhileClosing(isOpen, { title, description, children, confirmLabel, cancelLabel });
  const described = hasDescription(view.description);
  const focus = useModalFocus(trigger, restoreFocusRef, undefined, 'tabbable');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const layerRef = layer.ref;
  const setPanel = useCallback((node: HTMLDivElement | null) => { panelRef.current = node; layerRef(node); }, [layerRef]);
  const changeOpen = (next: boolean) => {
    if (!next && loading) return;
    if (!next && isOpen) onCancel?.();
    setOpen(next);
  };
  return <AlertDialogPrimitive.Root open={isOpen} onOpenChange={changeOpen}>
    {trigger ? <AlertDialogPrimitive.Trigger asChild ref={triggerRef as RefObject<HTMLButtonElement>}>{trigger}</AlertDialogPrimitive.Trigger> : null}
    {layer.ready ? <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="easm-ui-overlay-backdrop" style={layer.style} />
      <AlertDialogPrimitive.Content {...(described ? {} : { 'aria-describedby': undefined })}
        {...focus} {...locale}
        ref={setPanel}
        style={layer.style}
        onOpenAutoFocus={event => {
          focus.onOpenAutoFocus(event);
          if (loading) {
            event.preventDefault();
            panelRef.current?.focus({ preventScroll: true });
          }
        }}
        onEscapeKeyDown={event => { if (loading) event.preventDefault(); }} aria-busy={loading || undefined}
        className={cx('easm-ui easm-ui-overlay-panel easm-ui-dialog easm-ui-confirmation-dialog', className)} data-size="sm">
        <OverlayLayerContext.Provider value={layer.scope}>
          <header className="easm-ui-overlay-header">
            {destructive ? <span className="easm-ui-confirmation-indicator" aria-hidden="true"><UIIcon name="warning" size={24} /></span> : null}
            <AlertDialogPrimitive.Title className="easm-ui-overlay-title">{view.title}</AlertDialogPrimitive.Title>
          </header>
          {described || view.children ? <div className={cx('easm-ui-overlay-body', described && 'easm-ui-overlay-body-described')}>
            {described ? <AlertDialogPrimitive.Description asChild><div className="easm-ui-overlay-description">{view.description}</div></AlertDialogPrimitive.Description> : null}
            {view.children ? <div className="easm-ui-overlay-content">{view.children}</div> : null}
          </div> : null}
          <footer className="easm-ui-overlay-footer">
            <AlertDialogPrimitive.Cancel asChild><Button variant="secondary" disabled={loading}>{view.cancelLabel}</Button></AlertDialogPrimitive.Cancel>
            <Button variant={destructive ? 'destructive' : 'primary'} loading={loading}
              onClick={() => { if (!loading) onConfirm(); }}>{view.confirmLabel}</Button>
          </footer>
        </OverlayLayerContext.Provider>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal> : null}
  </AlertDialogPrimitive.Root>;
}
