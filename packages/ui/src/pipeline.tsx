'use client';

import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type DragEvent, type HTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react';
import { IconButton } from './actions';
import { useHorizontalOverflow } from './selection';
import { DropdownMenu, type MenuItem } from './overlays';
import { Avatar } from './utility';
import { Meter } from './insights';
import { ScorePill } from './product';
import { cx, quietPointerFocus, UIIcon, type UIIconName } from './shared';
import { fullNumber, requireLabel, toneStyle, type ChartTone } from './palette';
import { EasmLink } from './link';
import { StatusChip } from './workflow';
import { temperatureStatuses } from './roles';

/* Pipeline layer: a board of stages and the lead cards in them. Stages are told apart by a tinted
   header, cards are white on the white page, and the drop zone is a fill rather than a dashed line.
   A mouse can drag; every card also has a Move menu, which is the keyboard, touch and screen reader
   path and works the same everywhere. */

export const pipelineComponentNames = ['KanbanBoard', 'KanbanColumn', 'LeadCard'] as const;

/* Counts render the same on the server and in every browser, whatever the runtime's default locale. */
const formatCount = fullNumber('en');
const cardIdOf = (card: ReactElement) => String((card as ReactElement<{ id: string }>).props.id);

interface ColumnInfo { id: string; title: string; accepts: boolean; cardIds: string[] }
interface BoardContextValue {
  columns: ColumnInfo[];
  /** False without onMove: cards are not draggable and offer no move commands, since nothing would move them. */
  movable: boolean;
  /** False when stages sort themselves: cards move between stages only, never within one. */
  reorder: boolean;
  move: (cardId: string, name: string, to: string, index: number) => void;
  dragging: string | null;
  setDragging: (id: string | null) => void;
  focusId: string | null;
  clearFocus: () => void;
}
const BoardContext = createContext<BoardContextValue | null>(null);
const ColumnContext = createContext<string | null>(null);

/* ------------------------------------------------------------- KanbanBoard */

export interface KanbanBoardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  /** Called when a card is dropped or moved from its menu. The board does not reorder by itself, so without
   * onMove cards are not draggable and their menus offer no move commands. toIndex is the card's position in the
   * stage once moved, counted among the other cards. */
  onMove?: (cardId: string, toColumnId: string, toIndex: number) => void;
  /** Set to false when each stage sorts its own cards (by score or recency): cards then move between stages only,
   * the menus offer no Move up or Move down, and a drop shows no position. toIndex is then the end of the stage. */
  reorder?: boolean;
  /** Called with a card's id when a drag starts and with null when it ends, for example to pause refreshing the
   * board while a card is in the air. */
  onDraggingChange?: (cardId: string | null) => void;
  /** KanbanColumn elements. */
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}
/** Columns side by side that scroll sideways. Wide screens share the width between columns, phones
 * show one column at a time with the next one peeking, snapping as you swipe. */
export function KanbanBoard({ label, onMove, reorder = true, onDraggingChange, children, className, ...props }: KanbanBoardProps) {
  requireLabel(label, 'KanbanBoard');
  const [dragging, setDraggingState] = useState<string | null>(null);
  // A drop and the drag's end both clear the drag: report each change once.
  const reported = useRef<string | null>(null);
  const setDragging = useCallback((id: string | null) => {
    setDraggingState(id);
    if (reported.current !== id) { reported.current = id; onDraggingChange?.(id); }
  }, [onDraggingChange]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const count = Children.count(children);
  const overflow = useHorizontalOverflow(true, count, '[data-none]', { wheel: false });
  const columns = useMemo(() => Children.toArray(children).filter(isValidElement).map(child => {
    const p = (child as ReactElement<KanbanColumnProps>).props;
    return { id: p.id, title: p.title, accepts: p.acceptsDrop !== false,
      cardIds: Children.toArray(p.children).filter(isValidElement).map(card => String((card as ReactElement<{ id: string }>).props.id)) };
  }), [children]);
  const value = useMemo<BoardContextValue>(() => ({
    columns, movable: !!onMove, reorder, dragging, setDragging, focusId, clearFocus: () => setFocusId(null),
    move: (cardId, name, to, index) => {
      const column = columns.find(c => c.id === to);
      if (!column || !onMove) return;
      onMove(cardId, to, index);
      setFocusId(cardId);
      const message = reorder ? `${name} moved to ${column.title}, position ${index + 1}.` : `${name} moved to ${column.title}.`;
      // The same words twice in a row would not be announced again: vary the text invisibly.
      setAnnounce(previous => previous === message ? `${message}\u00A0` : message);
    },
  }), [columns, dragging, setDragging, focusId, onMove, reorder]);
  return <BoardContext.Provider value={value}>
    <div {...props} className={cx('easm-ui easm-ui-kanban', className)} data-dragging={dragging ? true : undefined}
      data-overflow-start={overflow.edges.start} data-overflow-end={overflow.edges.end}>
      {/* The columns are direct children of the scrolling row so its edges can be watched. */}
      <div ref={overflow.ref} className="easm-ui-kanban-scroll" role="region" aria-label={label} tabIndex={0} {...quietPointerFocus()}>{children}</div>
      {overflow.edges.start ? <IconButton icon="chevron-left" label="Show earlier stages" variant="secondary" tabIndex={-1}
        className="easm-ui-kanban-page" data-side="start" onClick={() => overflow.page(-1)} /> : null}
      {overflow.edges.end ? <IconButton icon="chevron-right" label="Show later stages" variant="secondary" tabIndex={-1}
        className="easm-ui-kanban-page" data-side="end" onClick={() => overflow.page(1)} /> : null}
      <span className="easm-ui-sr-only" role="status" aria-live="polite">{announce}</span>
    </div>
  </BoardContext.Provider>;
}

/* ------------------------------------------------------------ KanbanColumn */

export interface KanbanColumnProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  id: string;
  title: string;
  tone?: ChartTone;
  /** Total in this stage; defaults to the number of cards shown. */
  count?: number;
  /** A tag beside the title, such as a lock for stages that only change by hand. */
  badge?: ReactNode;
  description?: string;
  actions?: ReactNode;
  /** Set to false for a stage that cards cannot be moved into. */
  acceptsDrop?: boolean;
  /** What an empty stage says while cards can be dropped into it. */
  emptyLabel?: string;
  /** What an empty stage says when nothing can be dropped into it (a read-only board, or acceptsDrop false). */
  readOnlyEmptyLabel?: string;
  /** LeadCard elements. */
  children?: ReactNode;
  /** Below the cards: a "Show more" control for a stage that shows its cards a page at a time. */
  footer?: ReactNode;
  ref?: Ref<HTMLElement>;
}
export function KanbanColumn({ id, title, tone = 'blue', count, badge, description, actions, acceptsDrop = true,
  emptyLabel = 'Drop leads here', readOnlyEmptyLabel = 'Nothing here yet', children, footer, className, style, ...props }: KanbanColumnProps) {
  requireLabel(title, 'KanbanColumn');
  const board = useContext(BoardContext);
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  // The drop position, counted among the cards other than the one being dragged (the index onMove receives).
  const [slot, setSlot] = useState<number | null>(null);
  const cards = Children.toArray(children).filter(isValidElement);
  const cardIds = cards.map(cardIdOf);
  const total = count ?? cards.length;
  const dragging = board?.dragging ?? null;
  const reorder = board?.reorder ?? true;
  // A drag that ends anywhere (dropped elsewhere, or cancelled with Escape) clears this stage's slot.
  useEffect(() => { if (dragging === null) setSlot(null); }, [dragging]);
  const indexAt = (y: number) => {
    // The slot is not a card and the dragged card is not counted, so inserting the slot never moves a midpoint
    // above the pointer and the position holds still under a still pointer.
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>(':scope > .easm-ui-kanban-item:not([data-dragging])') ?? [])];
    if (!reorder) return items.length;
    const i = items.findIndex(item => { const box = item.getBoundingClientRect(); return y < box.top + box.height / 2; });
    return i < 0 ? items.length : i;
  };
  const droppable = acceptsDrop && !!board?.movable;
  // Without reordering, a card's own stage is not a destination.
  const canDrop = droppable && dragging != null && (reorder || !cardIds.includes(dragging));
  const over = (event: DragEvent<HTMLElement>) => {
    if (!canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setSlot(indexAt(event.clientY));
  };
  const drop = (event: DragEvent<HTMLElement>) => {
    if (!canDrop || !board) return;
    event.preventDefault();
    const cardId = event.dataTransfer.getData('text/plain');
    const name = event.dataTransfer.getData('application/x-easm-name') || 'Card';
    const index = indexAt(event.clientY);
    setSlot(null);
    board.setDragging(null);
    // Dropped back where it was: nothing moved, so nothing is reported or announced.
    if (!cardId || cardIds.indexOf(cardId) === index) return;
    board.move(cardId, name, id, index);
  };
  const placeholder = <li className="easm-ui-kanban-placeholder" aria-hidden="true" key="__slot" />;
  // The slot goes before the slot-th card that is not being dragged (the dragged card stays in place, dimmed).
  const showSlot = slot !== null && reorder;
  const items: ReactNode[] = [];
  let others = 0, placed = false;
  cards.forEach((card, i) => {
    const isDragging = dragging === cardIds[i];
    if (showSlot && !placed && !isDragging && others === slot) { items.push(placeholder); placed = true; }
    if (!isDragging) others++;
    items.push(<li key={card.key ?? undefined} className="easm-ui-kanban-item" data-dragging={isDragging || undefined}>{card}</li>);
  });
  if (showSlot && !placed) items.push(placeholder);
  return <ColumnContext.Provider value={id}>
    <section {...props} aria-labelledby={headingId} className={cx('easm-ui-kanban-column', className)} data-drop={slot !== null || undefined}
      style={{ ...toneStyle(tone), ...style }} onDragOver={over} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setSlot(null); }} onDrop={drop}>
      <header className="easm-ui-kanban-column-header">
        <span className="easm-ui-kanban-column-dot" aria-hidden="true" />
        <h3 id={headingId} className="easm-ui-kanban-column-title">{title}<span className="easm-ui-sr-only">, {total} {total === 1 ? 'card' : 'cards'}</span></h3>
        <span className="easm-ui-kanban-column-count" aria-hidden="true">{formatCount(total)}</span>
        {badge ? <span className="easm-ui-kanban-column-badge">{badge}</span> : null}
        {actions ? <span className="easm-ui-kanban-column-actions">{actions}</span> : null}
      </header>
      {description ? <p className="easm-ui-kanban-column-description">{description}</p> : null}
      <ul ref={listRef} className="easm-ui-kanban-list" aria-labelledby={headingId}>
        {items}
        {!cards.length && !showSlot ? <li className="easm-ui-kanban-empty"><UIIcon name="board" size={20} />{droppable ? emptyLabel : readOnlyEmptyLabel}</li> : null}
      </ul>
      {footer ? <div className="easm-ui-kanban-column-footer">{footer}</div> : null}
    </section>
  </ColumnContext.Provider>;
}

/* ---------------------------------------------------------------- LeadCard */

export interface LeadCardDetail { icon: UIIconName; label: ReactNode }
export interface LeadCardProps extends Omit<HTMLAttributes<HTMLElement>, 'id' | 'title'> {
  id: string;
  name: string;
  /** Opens the lead. A link when given an href (through the app's router link when EasmUIProvider sets one), a
   * button with onOpen, plain text otherwise. */
  href?: string;
  onOpen?: () => void;
  /** The programme or interest, under the name. */
  subtitle?: ReactNode;
  /** Lead score, 0–100: hot, warm or cool. */
  score?: number;
  details?: readonly LeadCardDetail[];
  /** Application fields captured, shown as a small meter. */
  progress?: { value: number; max: number; label?: string };
  /** Tags at the foot of the card, such as the channel. */
  tags?: ReactNode;
  /** When the lead last moved or spoke, such as "2 h". */
  time?: string;
  /** Who owns the lead. */
  owner?: string;
  /** How warm the lead is (a colour role): a dot beside the name with its word in a tip. */
  temperature?: 'hot' | 'warm' | 'cold';
  /** How long it has been in this stage ("6 days in stage"). */
  stageAge?: string;
  /** What happens next and when; overdue tints it amber. */
  nextAction?: { label: string; due?: string; overdue?: boolean };
  /** Where the lead came from (a Lead Ads form, the website chat, a campaign upload). */
  source?: { label: string; icon?: UIIconName };
  /** Extra commands for the card menu, after the move commands. */
  menuItems?: readonly MenuItem[];
  ref?: Ref<HTMLElement>;
}
export function LeadCard({ id, name, href, onOpen, subtitle, score, details, progress, tags, time, owner, temperature, stageAge, nextAction, source, menuItems = [], className, ...props }: LeadCardProps) {
  requireLabel(name, 'LeadCard');
  const board = useContext(BoardContext);
  const columnId = useContext(ColumnContext);
  const menuRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const column = board?.columns.find(c => c.id === columnId);
  const index = column?.cardIds.indexOf(id) ?? -1;
  useEffect(() => {
    if (board?.focusId === id) { menuRef.current?.focus(); board.clearFocus(); }
  }, [board?.focusId, id]);
  const movable = !!board?.movable;
  const moves: MenuItem[] = board && movable && column ? [
    ...(board.reorder && index > 0 ? [{ id: 'up', label: 'Move up', icon: 'arrow-up' as const, onSelect: () => board.move(id, name, column.id, index - 1) }] : []),
    ...(board.reorder && index >= 0 && index < column.cardIds.length - 1 ? [{ id: 'down', label: 'Move down', icon: 'arrow-down' as const, onSelect: () => board.move(id, name, column.id, index + 1) }] : []),
    ...board.columns.filter(c => c.id !== column.id && c.accepts).map(c => ({ id: `to-${c.id}`, label: `Move to ${c.title}`, icon: 'arrow-right' as const,
      onSelect: () => board.move(id, name, c.id, c.cardIds.length) })),
  ] : [];
  const items = [...moves, ...menuItems];
  const Name = href ? <EasmLink href={href} id={titleId} className="easm-ui-lead-card-link">{name}</EasmLink>
    : onOpen ? <button type="button" id={titleId} className="easm-ui-lead-card-link" onClick={onOpen}>{name}</button> : <span id={titleId}>{name}</span>;
  return <article {...props} aria-labelledby={titleId} className={cx('easm-ui easm-ui-lead-card', className)}
    draggable={movable ? true : undefined}
    onDragStart={board && movable ? (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.setData('application/x-easm-name', name);
      board.setDragging(id);
    } : undefined}
    onDragEnd={board && movable ? () => board.setDragging(null) : undefined}>
    <header className="easm-ui-lead-card-head">
      <Avatar name={name} size="sm" decorative />
      <div className="easm-ui-lead-card-title">
        <div className="easm-ui-lead-card-name"><h4>{Name}</h4>{score !== undefined ? <ScorePill value={score} kind="lead" /> : null}{temperature ? <StatusChip status={temperature} statuses={temperatureStatuses} variant="dot" size="sm" className="easm-ui-lead-card-temperature" /> : null}</div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {items.length ? <DropdownMenu label={`Actions for ${name}`} items={items} align="end"
        trigger={<IconButton ref={menuRef} icon="more-horizontal" label={`Actions for ${name}`} size="sm" className="easm-ui-lead-card-menu" />} /> : null}
    </header>
    {details?.length ? <ul className="easm-ui-lead-card-details">
      {details.map((d, i) => <li key={i}><UIIcon name={d.icon} size={16} /><span>{d.label}</span></li>)}
    </ul> : null}
    {source || stageAge ? <p className="easm-ui-lead-card-meta">
      {source ? <span><UIIcon name={source.icon ?? 'lead-form'} size={16} />{source.label}</span> : null}
      {stageAge ? <span><UIIcon name="calendar" size={16} />{stageAge}</span> : null}
    </p> : null}
    {nextAction ? <p className="easm-ui-lead-card-next" data-overdue={nextAction.overdue || undefined}>
      <UIIcon name="calendar-clock" size={16} /><span><strong>{nextAction.overdue ? 'Overdue: ' : 'Next: '}</strong>{nextAction.label}{nextAction.due ? ` · ${nextAction.due}` : ''}</span>
    </p> : null}
    {progress ? <Meter inline size="sm" tone="blue" label={progress.label ?? 'Application fields captured'} value={progress.value} max={progress.max}
      valueText={`${progress.value}/${progress.max}`} className="easm-ui-lead-card-progress" /> : null}
    {(tags || time || owner) ? <footer className="easm-ui-lead-card-foot">
      {tags ? <span className="easm-ui-lead-card-tags">{tags}</span> : null}
      {time ? <span className="easm-ui-lead-card-time"><UIIcon name="clock" size={16} />{time}</span> : null}
      {owner ? <Avatar name={owner} size="sm" className="easm-ui-lead-card-owner" /> : null}
    </footer> : null}
  </article>;
}
