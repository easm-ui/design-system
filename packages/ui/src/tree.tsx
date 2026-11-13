'use client';

// Tree (demand list C-X-20, wave 4b, 2026-10-29): a hierarchy people open and close, reorder, rename in place and
// pick from for a bulk action, with each branch's count. For the knowledge taxonomy first (CIMS's TaxonomyList), and
// any nested list after it. It is one ARIA tree: a single tab stop, arrow keys inside, the level and position of each
// row announced.
import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { DropdownMenu, type MenuItem } from './overlays';
import { IconButton } from './actions';
import { cx, reportContentProblem, UIIcon, useControllableState } from './shared';

export const treeComponentNames = ['Tree'] as const;

export interface TreeNode {
  id: string;
  label: string;
  /** A quieter word after the label (a slug, a code). */
  detail?: string;
  icon?: IconName;
  /** What the branch holds (items filed under it), shown at the row's end. */
  count?: number;
  children?: readonly TreeNode[];
  disabled?: boolean;
}
export interface TreeMove { id: string; parentId: string | null; index: number }
export interface TreeProps {
  /** Names the tree for assistive technology. */
  label: string;
  nodes: readonly TreeNode[];
  expanded?: readonly string[];
  defaultExpanded?: readonly string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Checkboxes for bulk actions. Picking a branch picks everything under it; a branch with some picked reads as mixed. */
  selectable?: boolean;
  selected?: readonly string[];
  defaultSelected?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
  /** The open row (its details beside the tree). Enter or a click opens it. */
  active?: string | null;
  onActiveChange?: (id: string) => void;
  /** Renaming in place (F2, a double click, or the row menu's Rename). Return a sentence to refuse a name. */
  onRename?: (id: string, label: string) => string | void;
  /** Moving by drag, or by Alt and Up or Down among its siblings. Drop on a row's middle to nest under it. */
  onMove?: (move: TreeMove) => void;
  /** The row's own actions, in its menu. */
  rowActions?: (node: TreeNode) => MenuItem[];
  /** The count's words for a screen reader ("12 documents"). */
  countLabel?: (count: number) => string;
  size?: 'sm' | 'md';
  /** Shown when there are no nodes. */
  empty?: ReactNode;
  className?: string;
}

interface Row { node: TreeNode; level: number; parentId: string | null; index: number; siblings: number }
const descendants = (node: TreeNode): string[] => (node.children ?? []).flatMap(child => [child.id, ...descendants(child)]);
function findNode(nodes: readonly TreeNode[], id: string): TreeNode | undefined {
  for (const node of nodes) { if (node.id === id) return node; const inner = findNode(node.children ?? [], id); if (inner) return inner; }
}
/** A branch is picked when everything under it is: keep the set consistent from the leaves up. */
function settle(nodes: readonly TreeNode[], picked: Set<string>) {
  const walk = (node: TreeNode): boolean => {
    if (!node.children?.length) return picked.has(node.id);
    const all = node.children.map(walk).every(Boolean);
    if (all) picked.add(node.id); else picked.delete(node.id);
    return all;
  };
  nodes.forEach(walk);
  return picked;
}

/** A hierarchy to open, reorder, rename and pick from. Arrow keys move (Right opens, Left closes or climbs), Home and
 *  End jump, Enter opens a row, Space picks it, F2 renames, Alt with Up or Down moves it among its siblings, and the
 *  context-menu key opens its menu. */
export function Tree({ label, nodes, expanded, defaultExpanded = [], onExpandedChange, selectable = false, selected, defaultSelected = [], onSelectedChange,
  active, onActiveChange, onRename, onMove, rowActions, countLabel = count => `${count.toLocaleString()} filed here`, size = 'md', empty, className }: TreeProps) {
  if (!label.trim()) reportContentProblem('Tree requires a meaningful label.');
  const [open, setOpen] = useControllableState<readonly string[]>(expanded, defaultExpanded, onExpandedChange as ((ids: readonly string[]) => void) | undefined);
  const [picked, setPicked] = useControllableState<readonly string[]>(selected, defaultSelected, onSelectedChange as ((ids: readonly string[]) => void) | undefined);
  const [focused, setFocused] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [refusal, setRefusal] = useState<string>();
  const [drag, setDrag] = useState<{ id: string; over?: string; where?: 'before' | 'after' | 'inside' } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const tree = useRef<HTMLUListElement>(null);
  const openSet = useMemo(() => new Set(open), [open]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (list: readonly TreeNode[], level: number, parentId: string | null) => list.forEach((node, index) => {
      out.push({ node, level, parentId, index, siblings: list.length });
      if (node.children?.length && openSet.has(node.id)) walk(node.children, level + 1, node.id);
    });
    walk(nodes, 1, null);
    return out;
  }, [nodes, openSet]);
  const current = rows.some(row => row.node.id === focused) ? focused : active && rows.some(row => row.node.id === active) ? active : rows[0]?.node.id ?? null;

  const focusRow = (id: string) => { setFocused(id); requestAnimationFrame(() => [...(tree.current?.querySelectorAll<HTMLElement>('[data-node-id]') ?? [])].find(row => row.dataset.nodeId === id)?.focus()); };
  const toggleOpen = (id: string, to?: boolean) => {
    const isOpen = openSet.has(id), next = to ?? !isOpen;
    if (next === isOpen) return;
    setOpen(next ? [...open, id] : open.filter(x => x !== id));
  };
  const checkState = (node: TreeNode): boolean | 'mixed' => {
    if (pickedSet.has(node.id)) return true;
    const under = descendants(node);
    return under.some(id => pickedSet.has(id)) ? 'mixed' : false;
  };
  const togglePick = (node: TreeNode) => {
    const next = new Set(picked);
    const on = checkState(node) !== true;
    for (const id of [node.id, ...descendants(node)]) if (on) next.add(id); else next.delete(id);
    const settled = [...settle(nodes, next)];
    setPicked(settled);
    setAnnouncement(`${on ? 'Picked' : 'Unpicked'} ${node.label}${node.children?.length ? ' and everything under it' : ''}. ${settled.length} picked.`);
  };
  const startRename = (node: TreeNode) => { if (!onRename || node.disabled) return; setRenaming(node.id); setDraft(node.label); setRefusal(undefined); };
  const finishRename = (node: TreeNode, keep: boolean) => {
    if (!keep || draft.trim() === node.label) { setRenaming(null); setRefusal(undefined); focusRow(node.id); return; }
    if (!draft.trim()) { setRefusal('A name cannot be empty.'); return; }
    const refused = onRename?.(node.id, draft.trim());
    if (refused) { setRefusal(refused); return; }
    setRenaming(null); setRefusal(undefined); setAnnouncement(`Renamed to ${draft.trim()}.`); focusRow(node.id);
  };
  const moveAmongSiblings = (row: Row, step: -1 | 1) => {
    const index = row.index + step;
    if (!onMove || index < 0 || index >= row.siblings) return;
    onMove({ id: row.node.id, parentId: row.parentId, index });
    setAnnouncement(`Moved ${row.node.label} to position ${index + 1} of ${row.siblings}.`);
    focusRow(row.node.id);
  };

  function onKey(event: KeyboardEvent<HTMLLIElement>, row: Row, at: number) {
    if (renaming) return;
    const { node } = row, branch = !!node.children?.length, rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const inward = rtl ? 'ArrowLeft' : 'ArrowRight', outward = rtl ? 'ArrowRight' : 'ArrowLeft';
    const go = (id: string | undefined) => { if (id) { event.preventDefault(); focusRow(id); } };
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); moveAmongSiblings(row, event.key === 'ArrowUp' ? -1 : 1); return; }
    switch (event.key) {
      case 'ArrowDown': return go(rows[at + 1]?.node.id);
      case 'ArrowUp': return go(rows[at - 1]?.node.id);
      case 'Home': return go(rows[0]?.node.id);
      case 'End': return go(rows[rows.length - 1]?.node.id);
      case inward: event.preventDefault(); if (branch && !openSet.has(node.id)) toggleOpen(node.id, true); else if (branch) go(node.children![0].id); return;
      case outward: event.preventDefault(); if (branch && openSet.has(node.id)) toggleOpen(node.id, false); else if (row.parentId) go(row.parentId); return;
      case 'Enter': event.preventDefault(); if (!node.disabled) onActiveChange?.(node.id); return;
      case ' ': if (selectable && !node.disabled) { event.preventDefault(); togglePick(node); } return;
      case 'F2': event.preventDefault(); startRename(node); return;
      case 'ContextMenu': case 'F10':
        if (event.key === 'F10' && !event.shiftKey) return;
        event.preventDefault(); event.currentTarget.querySelector<HTMLButtonElement>('.easm-ui-tree-menu button, button.easm-ui-tree-menu')?.click(); return;
      case '*': event.preventDefault(); setOpen([...new Set([...open, ...rows.filter(r => r.parentId === row.parentId && r.node.children?.length).map(r => r.node.id)])]); return;
    }
  }

  const canDropInto = (dragged: string, target: TreeNode) => dragged !== target.id && !descendants(findNode(nodes, dragged) ?? { id: '', label: '' }).includes(target.id);
  function onDragOver(event: DragEvent<HTMLLIElement>, row: Row) {
    if (!drag || !onMove || !canDropInto(drag.id, row.node)) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect(), y = (event.clientY - box.top) / box.height;
    const where = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
    if (drag.over !== row.node.id || drag.where !== where) setDrag({ ...drag, over: row.node.id, where });
  }
  function onDrop(event: DragEvent<HTMLLIElement>, row: Row) {
    event.preventDefault();
    if (!drag?.where || !onMove || !canDropInto(drag.id, row.node)) { setDrag(null); return; }
    const moving = findNode(nodes, drag.id);
    if (drag.where === 'inside') { onMove({ id: drag.id, parentId: row.node.id, index: row.node.children?.length ?? 0 }); toggleOpen(row.node.id, true); }
    else {
      const sameParent = rows.find(r => r.node.id === drag.id)?.parentId === row.parentId && (rows.find(r => r.node.id === drag.id)?.index ?? 0) < row.index;
      onMove({ id: drag.id, parentId: row.parentId, index: row.index + (drag.where === 'after' ? 1 : 0) - (sameParent ? 1 : 0) });
    }
    setAnnouncement(`Moved ${moving?.label ?? 'the row'} ${drag.where === 'inside' ? `into ${row.node.label}` : `${drag.where} ${row.node.label}`}.`);
    setDrag(null);
  }

  if (!nodes.length) return <div className={cx('easm-ui easm-ui-tree-empty', className)}>{empty ?? 'Nothing here yet.'}</div>;
  return <div className={cx('easm-ui easm-ui-tree-wrap', className)} data-size={size}>
    <ul ref={tree} role="tree" aria-label={label} aria-multiselectable={selectable || undefined} className="easm-ui-tree">
      {rows.map((row, at) => {
        const { node, level } = row;
        const branch = !!node.children?.length, isOpen = openSet.has(node.id), state = selectable ? checkState(node) : undefined;
        const menu = rowActions?.(node) ?? [];
        const items: MenuItem[] = onRename && !node.disabled ? [{ id: '__rename', label: 'Rename', icon: 'rename', onSelect: () => startRename(node) }, ...menu.map((m, i) => i === 0 ? { ...m, separatorBefore: true } : m)] : menu;
        const dropping = drag?.over === node.id ? drag.where : undefined;
        return <li key={node.id} role="treeitem" data-node-id={node.id} tabIndex={current === node.id && !renaming ? 0 : -1}
          aria-level={level} aria-posinset={row.index + 1} aria-setsize={row.siblings} aria-expanded={branch ? isOpen : undefined}
          aria-checked={selectable ? state === 'mixed' ? 'mixed' : !!state : undefined} aria-current={active === node.id ? 'true' : undefined} aria-disabled={node.disabled || undefined}
          className="easm-ui-tree-row" data-active={active === node.id || undefined} data-drop={dropping} data-dragging={drag?.id === node.id || undefined}
          style={{ ['--_level' as string]: level - 1 }}
          draggable={!!onMove && !node.disabled && renaming !== node.id}
          onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', node.label); setDrag({ id: node.id }); }}
          onDragOver={event => onDragOver(event, row)} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrag(d => d && d.over === node.id ? { id: d.id } : d); }}
          onDrop={event => onDrop(event, row)} onDragEnd={() => setDrag(null)}
          onFocus={event => { if (event.target === event.currentTarget) setFocused(node.id); }}
          onKeyDown={event => { if (event.target === event.currentTarget) onKey(event, row, at); }}
          onClick={event => { if ((event.target as HTMLElement).closest('button, input')) return; setFocused(node.id); if (!node.disabled) onActiveChange?.(node.id); }}
          onDoubleClick={() => startRename(node)}>
          <span className="easm-ui-tree-expander" aria-hidden="true" onClick={event => { event.stopPropagation(); if (branch) toggleOpen(node.id); }}>
            {branch ? <UIIcon name="chevron-right" size={16} /> : null}
          </span>
          {selectable ? <span className="easm-ui-tree-check" aria-hidden="true" data-state={state === 'mixed' ? 'mixed' : state ? 'on' : 'off'}
            onClick={event => { event.stopPropagation(); if (!node.disabled) togglePick(node); }}>
            {state === 'mixed' ? <UIIcon name="subtract" size={16} /> : state ? <UIIcon name="checkmark" size={16} /> : null}</span> : null}
          {node.icon ? <UIIcon name={node.icon} size={size === 'sm' ? 16 : 20} className="easm-ui-tree-icon" /> : null}
          {renaming === node.id ? <span className="easm-ui-tree-rename">
            <input autoFocus aria-label={`New name for ${node.label}`} value={draft} aria-invalid={refusal ? true : undefined} aria-describedby={refusal ? `${node.id}-refusal` : undefined}
              onChange={event => { setDraft(event.target.value); setRefusal(undefined); }} onFocus={event => event.target.select()}
              onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); finishRename(node, true); } else if (event.key === 'Escape') { event.preventDefault(); finishRename(node, false); } }}
              onBlur={() => finishRename(node, true)} />
            {refusal ? <span className="easm-ui-tree-refusal" id={`${node.id}-refusal`} role="alert">{refusal}</span> : null}
          </span> : <span className="easm-ui-tree-label">{node.label}{node.detail ? <span className="easm-ui-tree-detail">{node.detail}</span> : null}</span>}
          {typeof node.count === 'number' ? <span className="easm-ui-tree-count"><span aria-hidden="true">{node.count.toLocaleString()}</span><span className="easm-ui-sr-only">, {countLabel(node.count)}</span></span> : null}
          {items.length ? <span className="easm-ui-tree-menu" onClick={event => event.stopPropagation()}>
            <DropdownMenu label={`${node.label} actions`} items={items} trigger={<IconButton icon="more-horizontal" size="sm" label={`${node.label} actions`} tabIndex={-1} />} />
          </span> : null}
        </li>;
      })}
    </ul>
    <span className="easm-ui-sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
