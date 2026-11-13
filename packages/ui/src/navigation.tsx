"use client";
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type MouseEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type AnchorHTMLAttributes,
} from "react";
import type { IconName } from "@easm-ui/icons";
// The /icon subpath: the package entry also re-exports the motion system, which must load on demand.
import { Icon } from "@easm-ui/icons/icon";
import { useFlip } from "./motion-hooks";
import { Button, IconButton, type ButtonVariant } from "./actions";
import { DropdownSelect, SearchField } from "./inputs";
import { Dialog, DropdownMenu, type MenuItem } from "./overlays";
import { Tooltip } from "./feedback";
import { Avatar, ModuleIcon, type AvatarProps } from "./utility";
import { Kbd } from "./product";
import { cx, UIIcon, iconSizeFor, quietPointerFocus, reportContentProblem, requireNonBlankText, requireUniqueItemIds, useOverflowing, type ComponentSize } from "./shared";
import { useSlidingIndicator } from './motion';
import { EasmLink } from "./link";

export const navigationComponentNames = [
  "Sidebar",
  "TopHeader",
  "Breadcrumbs",
  "CommandBar",
  "WorkspaceSwitcher",
  "SidebarSwitcher",
  "SidebarAccount",
  "MobileTabBar",
  "ButtonLink",
] as const;
const requireText = requireNonBlankText;

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ComponentSize;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  block?: boolean;
  /** Overrides the icon size the size implies (sm 16, md 20, lg 24), as on Button. */
  iconSize?: 16 | 20 | 24;
}

/**
 * A link that looks exactly like a Button, for an action that goes somewhere: "Continue reading", "Open settings",
 * "Return to sign in". It renders through EasmLink, so EasmUIProvider's router link keeps navigation client-side.
 * Use Button for an action that does something on the page; a link has no disabled or loading state.
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink({
  href, variant = "primary", size = "md", leadingIcon, trailingIcon, block = false, iconSize: suppliedIconSize,
  children, className, ...props
}, ref) {
  requireText(href, "ButtonLink destination");
  const blankChildren = children === undefined || children === null || children === false
    || typeof children === "string" && !children.trim();
  if (blankChildren && !props["aria-label"]?.trim() && !props["aria-labelledby"]?.trim()) {
    reportContentProblem("ButtonLink requires visible content or an accessible name.");
  }
  const iconSize = suppliedIconSize ?? iconSizeFor(size);
  return <EasmLink {...props} ref={ref} href={href} data-size={size} data-variant={variant}
    className={cx("easm-ui easm-ui-button easm-ui-button-link", block && "easm-ui-button-block", className)}>
    {leadingIcon ? <UIIcon name={leadingIcon} size={iconSize} /> : null}
    <span className="easm-ui-button-label">{children}</span>
    {trailingIcon ? <UIIcon name={trailingIcon} size={iconSize} /> : null}
  </EasmLink>;
});
function plainCommandKey(event: KeyboardEvent) {
  return (
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.nativeEvent.isComposing &&
    event.nativeEvent.keyCode !== 229
  );
}
/** A plain primary click: no modifier key, so the browser is not opening the link in a new tab or window. */
function plainPrimaryClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  badge?: number;
  disabled?: boolean;
  /** Consecutive items with the same group sit under one small heading. */
  group?: string;
}
export interface SidebarProps {
  items: readonly NavigationItem[];
  activeId?: string;
  collapsed?: boolean;
  onCollapsedChange?: (value: boolean) => void;
  /** Called for a plain primary click on a destination. Cmd/Ctrl/Shift/Alt-clicks are left to the browser
   * (new tab or window). For client-side routing, prefer `EasmUIProvider linkComponent`, which keeps prefetch. */
  onNavigate?: (
    item: NavigationItem,
    event: MouseEvent<HTMLAnchorElement>,
  ) => void;
  label?: string;
  brand?: ReactNode;
  footer?: ReactNode;
  /** Id of the navigation landmark, e.g. for TopHeader `menuControls`. */
  id?: string;
  className?: string;
}
export function Sidebar({
  items,
  activeId,
  collapsed = false,
  onCollapsedChange,
  label = "Product navigation",
  brand,
  footer,
  onNavigate,
  id,
  className,
}: SidebarProps) {
  requireUniqueItemIds(items, "Sidebar item");
  requireText(label, "Sidebar label");
  for (const item of items) {
    requireText(item.label, "Sidebar item label");
    requireText(item.href, "Sidebar destination");
    if (
      item.badge !== undefined &&
      (!Number.isSafeInteger(item.badge) || item.badge < 0)
    )
      reportContentProblem("Sidebar badge must be a nonnegative safe integer.");
  }
  const uid = useId();
  const navRef = useRef<HTMLElement>(null);
  useSlidingIndicator(navRef, '.easm-ui-sidebar-link[aria-current="page"]', `${activeId ?? ''}|${collapsed}`);
  // The collapse and expand buttons swap places when the state flips; keyboard focus follows the toggle
  // instead of dropping to the page body.
  const toggle = useRef<HTMLButtonElement>(null),
    refocusToggle = useRef(false);
  useLayoutEffect(() => {
    if (!refocusToggle.current) return;
    refocusToggle.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) toggle.current?.focus();
  }, [collapsed]);
  const flip = (next: boolean, event: MouseEvent<HTMLButtonElement>) => {
    refocusToggle.current = document.activeElement === event.currentTarget;
    onCollapsedChange?.(next);
  };
  const groups: { key: string; label?: string; items: NavigationItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.label === item.group) last.items.push(item);
    else groups.push({ key: `${item.group ?? ""}-${groups.length}`, label: item.group, items: [item] });
  }
  return (
    <nav
      ref={navRef}
      id={id}
      className={cx("easm-ui easm-ui-sidebar", className)}
      aria-label={label}
      data-collapsed={collapsed}
    >
      <div className="easm-ui-sidebar-brand">
        {brand ?? (
          <>
            <ModuleIcon
              icon="easm-one"
              size="sm"
              tone="signature"
              label={collapsed ? "EASM One" : undefined}
            />
            {!collapsed && <strong>EASM One</strong>}
          </>
        )}
      </div>
      {groups.map((group, index) => (
        <div
          key={group.key}
          className="easm-ui-sidebar-group"
          role={group.label ? "group" : undefined}
          aria-labelledby={group.label ? `${uid}-group-${index}` : undefined}
        >
          {group.label && (
            <p className="easm-ui-sidebar-group-label" id={`${uid}-group-${index}`} hidden={collapsed}>
              {group.label}
            </p>
          )}
      <ul>
        {group.items.map((item) => {
          const count = item.badge != null && Number.isFinite(item.badge) && item.badge > 0 ? item.badge : 0;
          const content = (
            <>
              <Icon name={item.icon} size={20} tone="inherit" />
              <span className="easm-ui-sidebar-copy">{item.label}</span>
              {count > 0 && (
                <span key={count} className="easm-ui-sidebar-count">
                  <span aria-hidden="true">{count > 999 ? "999+" : count}</span>
                  <span className="easm-ui-sr-only">{`, ${count} ${count === 1 ? "item" : "items"}`}</span>
                </span>
              )}
            </>
          );
          // A disabled destination is a link with no address (the APG disabled-link pattern), so assistive
          // technology announces it as an unavailable link rather than plain text.
          const control = item.disabled ? (
            <a className="easm-ui-sidebar-link" role="link" aria-disabled="true">
              {content}
            </a>
          ) : (
            <EasmLink
              className="easm-ui-sidebar-link"
              href={item.href}
              aria-current={activeId === item.id ? "page" : undefined}
              onClick={(event) => {
                if (plainPrimaryClick(event)) onNavigate?.(item, event);
              }}
            >
              {content}
            </EasmLink>
          );
          return (
            <li key={item.id}>
              {collapsed ? (
                <Tooltip
                  trigger={control}
                >{`${item.label}${count ? `, ${count} ${count === 1 ? "item" : "items"}` : ""}`}</Tooltip>
              ) : (
                control
              )}
            </li>
          );
        })}
      </ul>
        </div>
      ))}
      {/* The collapse control sits at the foot, beside the account card (above it in the rail), not on a row of its
          own under the brand, where it left a gap for one small icon (2026-10-15). */}
      {(footer || onCollapsedChange) && (
        <div className="easm-ui-sidebar-footer" data-toggle={onCollapsedChange ? true : undefined}>
          {footer}
          {onCollapsedChange && (
            <IconButton
              ref={toggle}
              icon={collapsed ? "menu" : "sidebar-right-collapse"}
              label={collapsed ? "Expand navigation" : "Collapse navigation"}
              variant="subtle"
              aria-expanded={!collapsed}
              className="easm-ui-sidebar-toggle"
              onClick={(event) => flip(!collapsed, event)}
            />
          )}
        </div>
      )}
    </nav>
  );
}
export interface TopHeaderProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  onMenuToggle?: () => void;
  menuExpanded?: boolean;
  menuControls?: string;
  /** Render the title as the page heading (h1) or a section heading (h2). Defaults to plain text. */
  titleLevel?: 1 | 2;
}
export function TopHeader({
  title,
  breadcrumb,
  actions,
  onMenuToggle,
  menuExpanded,
  menuControls,
  titleLevel,
  children,
  className,
  ...props
}: TopHeaderProps) {
  return (
    <header
      {...props}
      className={["easm-ui easm-ui-top-header", className]
        .filter(Boolean)
        .join(" ")}
    >
      {onMenuToggle && (
        <IconButton
          icon="menu"
          label="Toggle product navigation"
          variant="subtle"
          onClick={onMenuToggle}
          aria-expanded={menuExpanded}
          aria-controls={menuControls}
        />
      )}
      <div className="easm-ui-top-header-context">
        {breadcrumb}
        {title && (titleLevel === 1 ? <h1 className="easm-ui-top-header-title">{title}</h1>
          : titleLevel === 2 ? <h2 className="easm-ui-top-header-title">{title}</h2>
          : <span className="easm-ui-top-header-title">{title}</span>)}
        {children}
      </div>
      {actions && <div className="easm-ui-top-header-actions">{actions}</div>}
    </header>
  );
}
export interface BreadcrumbItem {
  label: string;
  href?: string;
}
export interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  label?: string;
  /** md: a navigation row of its own. line: one 18 px line of 13 px text, to sit under a page title; its links keep
   * a full tap area that takes no room, and in a narrow box (a phone) the trail becomes one "‹ Parent" link. */
  size?: "md" | "line";
  /** The most items shown before the middle folds into "…", which shows them when pressed. Default 4 for line. */
  maxItems?: number;
}
export function Breadcrumbs({
  items,
  label = "Breadcrumb",
  size = "md",
  maxItems = size === "line" ? 4 : Infinity,
}: BreadcrumbsProps) {
  requireText(label, "Breadcrumbs label");
  for (const item of items) {
    requireText(item.label, "Breadcrumb item label");
    if (item.href !== undefined)
      requireText(item.href, "Breadcrumb destination");
  }
  const [unfolded, setUnfolded] = useState(false);
  // The trail is a Tab stop only while it overflows and has to be scrolled with the keyboard.
  const [trail, scrollable] = useOverflowing<HTMLElement>();
  const keep = Math.max(3, maxItems);
  const folded = !unfolded && items.length > keep;
  const hidden = folded ? items.length - (keep - 1) : 0;
  const shown = folded ? [items[0], null, ...items.slice(items.length - (keep - 2))] : items;
  const parent = [...items.slice(0, -1)].reverse().find((item) => item.href);
  return (
    <nav
      ref={trail}
      className="easm-ui easm-ui-breadcrumbs"
      data-size={size}
      aria-label={label}
      tabIndex={scrollable && size === "md" ? 0 : undefined}
      {...quietPointerFocus()}
    >
      <ol>
        {shown.map((item, index) => (
          <li key={item ? `${index}-${item.label}` : "fold"}>
            {index > 0 && (
              <Icon name="chevron-right" size={16} tone="inherit" />
            )}
            {item === null ? (
              <button type="button" className="easm-ui-breadcrumbs-fold" aria-label={`Show ${hidden} more ${hidden === 1 ? "page" : "pages"} in the trail`}
                onClick={() => setUnfolded(true)}>…</button>
            ) : index === shown.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : item.href ? (
              <EasmLink className="easm-ui-breadcrumb-link" href={item.href}>{item.label}</EasmLink>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      {size === "line" && parent?.href ? (
        <EasmLink className="easm-ui-breadcrumbs-back" href={parent.href}>
          <Icon name="chevron-left" size={16} tone="inherit" />{parent.label}
        </EasmLink>
      ) : null}
    </nav>
  );
}
export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: IconName;
  disabled?: boolean;
  onSelect: () => void;
}
export interface CommandBarProps {
  commands: readonly CommandItem[];
  label?: string;
  triggerLabel?: string;
  /** search: a wide, field-like trigger for a top bar. */
  appearance?: "button" | "search";
  /** Open with ⌘K or Ctrl+K from anywhere on the page, and show the hint. */
  shortcut?: boolean;
}
const noSubscription = () => () => {};
/** Whether the shortcut hint should read ⌘K. Null on the server and during hydration, so the server's
 * markup (which cannot know the visitor's platform) always matches the first client render. */
function useMacShortcut() {
  return useSyncExternalStore(
    noSubscription,
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => null,
  );
}
export function CommandBar({
  commands,
  label = "Find a command",
  triggerLabel = "Search commands",
  appearance = "button",
  shortcut = false,
}: CommandBarProps) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const isOpen = useRef(open);
  // The results narrow as you type; the commands that stay glide into place (new ones rise in from CSS).
  const resultsRef = useRef<HTMLDivElement>(null);
  useFlip(resultsRef, ':scope > button', { enter: false });
  isOpen.current = open;
  const input = useRef<HTMLInputElement>(null),
    controls = useRef<(HTMLButtonElement | null)[]>([]),
    selecting = useRef(false),
    // What had focus when ⌘K/Ctrl+K opened the dialog; focus returns there on close. A click on the
    // trigger clears it, so focus then returns to the trigger as usual.
    shortcutOpener = useRef<HTMLElement | null>(null),
    id = useId();
  requireUniqueItemIds(commands, "Command");
  requireText(label, "CommandBar label");
  requireText(triggerLabel, "CommandBar trigger label");
  for (const command of commands) requireText(command.label, "Command label");
  const results = commands.filter((c) =>
    (c.label + " " + (c.description ?? ""))
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase().trim()),
  );
  const eligible = results
    .map((c, i) => (c.disabled ? -1 : i))
    .filter((i) => i >= 0);
  const move = (index: number, key: string) => {
    let next: number | undefined;
    if (key === "Home") next = eligible[0];
    else if (key === "End") next = eligible.at(-1);
    else if (key === "ArrowDown")
      next = eligible[(eligible.indexOf(index) + 1) % eligible.length];
    else if (key === "ArrowUp")
      next =
        eligible[
          (eligible.indexOf(index) - 1 + eligible.length) % eligible.length
        ];
    if (next !== undefined) controls.current[next]?.focus();
  };
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      // An editor that already handled ⌘K/Ctrl+K (it called preventDefault) keeps it, and so does an IME.
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        // Already open: keep the original opener as the focus-return target.
        if (isOpen.current) return;
        selecting.current = false;
        const active = document.activeElement;
        shortcutOpener.current = active instanceof HTMLElement && active !== document.body ? active : null;
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);
  const mac = useMacShortcut();
  const select = (command: CommandItem) => {
    if (command.disabled || selecting.current) return;
    selecting.current = true;
    setOpen(false);
    setQuery("");
    command.onSelect();
  };
  return (
    <Dialog
      className="easm-ui-command-dialog"
      title={label}
      description="Search available actions. Use the arrow keys to move, Enter to choose, and Escape to close."
      trigger={
        appearance === "search" ? (
          <button type="button" className="easm-ui-command-trigger" aria-keyshortcuts={shortcut ? "Meta+K Control+K" : undefined}>
            <Icon name="search" size={20} tone="inherit" />
            <span>{triggerLabel}</span>
            {shortcut && mac !== null && <Kbd aria-hidden="true">{mac ? "⌘K" : "Ctrl K"}</Kbd>}
          </button>
        ) : (
          <Button variant="secondary" leadingIcon="search" aria-keyshortcuts={shortcut ? "Meta+K Control+K" : undefined}>
            {triggerLabel}
          </Button>
        )
      }
      open={open}
      restoreFocusRef={shortcutOpener}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) { selecting.current = false; shortcutOpener.current = null; }
        else setQuery("");
      }}
    >
      <SearchField
        ref={input}
        label="Search commands"
        hideLabel
        placeholder="Search commands…"
        className="easm-ui-command-search"
        value={query}
        onValueChange={setQuery}
        aria-controls={id}
        onKeyDown={(event) => {
          if (!plainCommandKey(event)) return;
          if (["ArrowDown", "ArrowUp"].includes(event.key) && eligible.length) {
            event.preventDefault();
            controls.current[
              event.key === "ArrowDown"
                ? eligible[0]
                : eligible[eligible.length - 1]
            ]?.focus();
          }
          if (event.key === "Enter" && eligible.length) {
            event.preventDefault();
            select(results[eligible[0]]);
          }
        }}
      />
      <div
        ref={resultsRef}
        className="easm-ui-command-results"
        id={id}
        role="region"
        aria-label="Commands"
      >
        <p className="easm-ui-sr-only" role="status">
          {eligible.length} available{" "}
          {eligible.length === 1 ? "command" : "commands"}
          {results.length > eligible.length
            ? `; ${results.length - eligible.length} unavailable`
            : ""}
        </p>
        {!results.length && <p>No commands found. Try another search.</p>}
        {results.map((command, index) => (
          <button
            type="button"
            key={command.id}
            ref={(node) => {
              controls.current[index] = node;
            }}
            disabled={command.disabled}
            onClick={() => select(command)}
            onKeyDown={(event) => {
              if (
                plainCommandKey(event) &&
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                move(index, event.key);
              }
            }}
          >
            {command.icon && (
              <Icon name={command.icon} size={20} tone="inherit" />
            )}
            <span>
              <strong>{command.label}</strong>
              {command.description && <small>{command.description}</small>}
            </span>
          </button>
        ))}
      </div>
      {/* Pointer users read the keys once; touch screens have no keyboard to hint at. */}
      <p className="easm-ui-command-hint" aria-hidden="true">
        <span><Kbd>↑</Kbd><Kbd>↓</Kbd> Move</span>
        <span><Kbd>↵</Kbd> Open</span>
        <span><Kbd>Esc</Kbd> Close</span>
      </p>
    </Dialog>
  );
}
export interface WorkspaceOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface WorkspaceSwitcherProps {
  options: readonly WorkspaceOption[];
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  /** Keep the label for assistive technology but do not show it, e.g. in a sidebar. */
  hideLabel?: boolean;
  size?: ComponentSize;
  /** inline: a compact pill that shows its label inside the trigger. */
  appearance?: "field" | "inline";
  /** A leading icon inside the trigger. */
  icon?: IconName;
  /** Form field name, when the switcher sits in a form. */
  name?: string;
  className?: string;
}
export function WorkspaceSwitcher({
  options,
  value,
  onValueChange,
  disabled = false,
  label = "Workspace",
  hideLabel,
  size,
  appearance,
  icon,
  name,
  className,
}: WorkspaceSwitcherProps) {
  return (
    <div className={cx("easm-ui-workspace-switcher", className)}>
      <DropdownSelect
        label={label}
        options={options}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        placeholder="Choose a workspace"
        hideLabel={hideLabel}
        size={size}
        appearance={appearance}
        icon={icon}
        name={name}
      />
    </div>
  );
}

/** Up to two letters from a name: "Demo University" -> "DU", "Admissions" -> "AD". */
function initialsOf(text: string) {
  const words = text.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return "?";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
}

export interface SidebarSwitcherProps {
  /** First line: the workspace or institution. */
  title: string;
  /** Second line: the product or dashboard you are in. */
  subtitle?: string;
  /** Up to two letters for the tile. Taken from `title` when omitted. */
  initials?: string;
  /** The places to switch to (workspaces, products or dashboards). Mark the current one with `selected` (or the
   * older `icon: "checkmark"`); give each a `description` for the roomy menu. With no items the card is shown
   * without a menu. */
  items: MenuItem[];
  /** Names the menu. */
  label?: string;
  /** Rail mode: the tile alone, opening its menu to the side. */
  collapsed?: boolean;
  className?: string;
}

/** The card at the top of a Sidebar's `brand` slot that says where you are and switches it: a blue
 * initials tile, the workspace and, under it, the product. Its menu is exactly as wide as the card. */
export function SidebarSwitcher({ title, subtitle, initials, items, label = "Switch workspace", collapsed = false, className }: SidebarSwitcherProps) {
  requireText(title, "SidebarSwitcher title");
  requireText(label, "SidebarSwitcher label");
  const tile = (initials?.trim() || initialsOf(title)).slice(0, 2).toUpperCase();
  const name = subtitle?.trim() ? `${title}, ${subtitle}` : title;
  const body = (
    <>
      <span className="easm-ui-sidebar-selector-tile" aria-hidden="true">{tile}</span>
      {collapsed ? null : (
        <span className="easm-ui-sidebar-selector-copy">
          <strong>{title}</strong>
          {subtitle?.trim() ? <small>{subtitle}</small> : null}
        </span>
      )}
      {collapsed || items.length === 0 ? null : <UIIcon name="chevron-up-down" size={20} />}
    </>
  );
  if (items.length === 0) {
    return (
      <div className={cx("easm-ui-sidebar-selector", className)} data-collapsed={collapsed || undefined} data-static="true"
        role={collapsed ? "img" : undefined} aria-label={collapsed ? name : undefined} title={collapsed ? name : undefined}>
        {body}
      </div>
    );
  }
  return (
    <DropdownMenu
      label={label}
      heading={label}
      items={items}
      side={collapsed ? "right" : "bottom"}
      align="start"
      className="easm-ui-switcher-menu"
      trigger={
        <button type="button" className={cx("easm-ui-sidebar-selector", className)} data-collapsed={collapsed || undefined}
          aria-label={collapsed ? `${name}. ${label}` : undefined} title={collapsed ? name : undefined}>
          {body}
        </button>
      }
    />
  );
}

export interface SidebarAccountProps {
  /** The signed-in person. */
  name: string;
  /** Second line, e.g. "Admin · Support lead". */
  description?: string;
  /** Photo URL; initials otherwise. */
  src?: string;
  /** Presence dot on the avatar. */
  status?: AvatarProps["status"];
  /** Words for the status (for translation). Defaults to the status itself. */
  statusLabel?: string;
  /** Profile, settings, status and sign-out actions. */
  items: MenuItem[];
  /** Names the menu. */
  label?: string;
  /** Rail mode: the avatar alone, opening its menu to the side. */
  collapsed?: boolean;
  className?: string;
}

/** The account card for a Sidebar's `footer` slot: avatar with presence, name and role, and the account
 * menu opening upwards, exactly as wide as the card. The same card as SidebarSwitcher, so the two ends of
 * the sidebar match. */
export function SidebarAccount({ name, description, src, status, statusLabel, items, label = "Account options", collapsed = false, className }: SidebarAccountProps) {
  requireText(name, "SidebarAccount name");
  requireText(label, "SidebarAccount label");
  const spoken = status ? `${name}, ${statusLabel?.trim() || status}` : name;
  return (
    <DropdownMenu
      label={label}
      items={items}
      side={collapsed ? "right" : "top"}
      align="start"
      matchTriggerWidth={!collapsed}
      trigger={
        <button type="button" className={cx("easm-ui-sidebar-selector", className)} data-kind="account" data-collapsed={collapsed || undefined}
          aria-label={collapsed ? `${spoken}. ${label}` : undefined} title={collapsed ? name : undefined}>
          <Avatar name={name} src={src} size="md" status={status} statusLabel={statusLabel} decorative />
          {collapsed ? null : (
            <span className="easm-ui-sidebar-selector-copy">
              <strong>{name}</strong>
              {description?.trim() ? <small>{description}</small> : null}
              {status ? <span className="easm-ui-sr-only">, {statusLabel?.trim() || status}</span> : null}
            </span>
          )}
          {collapsed ? null : <UIIcon name="chevron-up-down" size={20} />}
        </button>
      }
    />
  );
}

export interface MobileTabBarProps {
  /** The dashboard's main places, at most four; the bar keeps one more slot for More. */
  items: readonly NavigationItem[];
  activeId?: string;
  /** The fifth slot: opens everything else (usually the full sidebar in a drawer). */
  more?: {
    label?: string;
    onClick: () => void;
    /** True while what it opens is open, or while the current page is one of the places it holds. */
    active?: boolean;
    /** Id of the drawer or menu it opens, for aria-controls. */
    controls?: string;
    expanded?: boolean;
  };
  onNavigate?: (item: NavigationItem, event: MouseEvent<HTMLAnchorElement>) => void;
  label?: string;
  className?: string;
  /** Shrink to a compact strip of icons while the page scrolls down, and return on scrolling up or reaching the
   *  end. On by default; reduced motion keeps the bar at full size. */
  minimizeOnScroll?: boolean;
}

/**
 * The phone's navigation: a bar fixed to the bottom of the screen, in thumb reach, with up to four places and
 * More. It shows below 768px only (a rail or sidebar takes over above), sits clear of the home indicator in an
 * installed app, steps aside while the on-screen keyboard is up, and reserves its own height at the foot of the
 * page through `--easm-ui-tabbar-space`, which any other bottom-fixed element adds to its offset.
 */
/** True while the reader is scrolling down through a page (past its first 48 px, not at its end): the tab bar
 *  folds to its icons and gives the screen to the content. Scrolling up, the top or the end bring it back. Listens
 *  in the capture phase, so it follows whatever scrolls (the window or an app's own scrolling pane). */
function useScrollCompact(enabled: boolean) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const last = new WeakMap<EventTarget, number>();
    let frame = 0;
    const read = (target: EventTarget | null) => {
      const box = target instanceof Element ? target : document.scrollingElement;
      if (!box || reduced.matches) { setCompact(false); return; }
      // A small scroller (a menu, a list in a card) is not the page being read.
      if (box !== document.scrollingElement && box.clientHeight < window.innerHeight * .5) return;
      const top = box.scrollTop, before = last.get(box) ?? top;
      last.set(box, top);
      const end = top + box.clientHeight >= box.scrollHeight - 2;
      if (top < 48 || end) setCompact(false);
      else if (top - before > 6) setCompact(true);
      else if (before - top > 6) setCompact(false);
    };
    const onScroll = (event: Event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; read(event.target === document ? null : event.target); });
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => { document.removeEventListener("scroll", onScroll, { capture: true }); cancelAnimationFrame(frame); };
  }, [enabled]);
  return compact;
}

export function MobileTabBar({ items, activeId, more, onNavigate, label = "Main", className, minimizeOnScroll = true }: MobileTabBarProps) {
  requireUniqueItemIds(items, "MobileTabBar item");
  requireText(label, "MobileTabBar label");
  if (items.length > (more ? 4 : 5)) reportContentProblem("MobileTabBar holds at most five slots, More included.");
  for (const item of items) {
    requireText(item.label, "MobileTabBar item label");
    requireText(item.href, "MobileTabBar destination");
  }
  const moreLabel = more?.label ?? "More";
  // The current place is a fill that slides from tab to tab (as tabs, segments and the sidebar do).
  const listRef = useRef<HTMLUListElement>(null);
  useSlidingIndicator(listRef, '.easm-ui-tabbar-link:is([aria-current="page"], [data-active])', `${activeId ?? ""}|${more?.active ?? ""}`);
  const compact = useScrollCompact(minimizeOnScroll);
  return (
    <nav className={cx("easm-ui easm-ui-tabbar", className)} aria-label={label} data-compact={compact || undefined}>
      <ul ref={listRef} style={{ gridTemplateColumns: `repeat(${items.length + (more ? 1 : 0)}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const current = item.id === activeId;
          return (
            <li key={item.id}>
              <EasmLink
                href={item.href}
                className="easm-ui-tabbar-link"
                aria-current={current ? "page" : undefined}
                aria-disabled={item.disabled || undefined}
                tabIndex={item.disabled ? -1 : undefined}
                onClick={(event) => {
                  if (item.disabled) { event.preventDefault(); return; }
                  if (onNavigate && plainPrimaryClick(event)) onNavigate(item, event);
                }}
              >
                <span className="easm-ui-tabbar-icon" aria-hidden="true">
                  <Icon name={item.icon} size={24} tone="inherit" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="easm-ui-tabbar-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                  )}
                </span>
                <span className="easm-ui-tabbar-label">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && <span className="easm-ui-sr-only">, {item.badge} waiting</span>}
              </EasmLink>
            </li>
          );
        })}
        {more && (
          <li>
            <button
              type="button"
              className="easm-ui-tabbar-link"
              data-active={more.active || undefined}
              aria-controls={more.controls}
              aria-expanded={more.expanded}
              onClick={more.onClick}
            >
              <span className="easm-ui-tabbar-icon" aria-hidden="true">
                <Icon name="more-horizontal" size={24} tone="inherit" />
              </span>
              <span className="easm-ui-tabbar-label">{moreLabel}</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
