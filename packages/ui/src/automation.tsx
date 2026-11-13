'use client';

// Automation parts (demand list wave 3, C-AUT-01…04, with C-X-10 JsonView, which ResponsePicker draws on): who fills
// each input of a tool, the request a tool sends with its {slots} shown as what fills them, the response with the
// fields the assistant keeps, and a rule written as the sentence it is. Each replaces a page's own version in
// the Automation dashboard, so a source, a slot or a trigger reads the same everywhere.
import { useId, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import type { IconName } from '@easm-ui/icons';
import { Button, IconButton } from './actions';
import { Checkbox, DropdownSelect, Switch, TextArea, TextField, type InputOption } from './inputs';
import { DropdownMenu, Popover } from './overlays';
import { Tabs } from './selection';
import { cx, UIIcon } from './shared';

export const automationComponentNames = ['InputSourceRow', 'RequestBuilder', 'JsonView', 'ResponsePicker', 'RuleSentence'] as const;

/* ------------------------------------------------------------------ InputSourceRow */

export type InputSource = 'assistant' | 'signin' | 'fixed' | 'easm';
export const inputSources: Readonly<Record<InputSource, { label: string; icon: IconName; description: string }>> = {
  assistant: { label: 'The assistant', icon: 'input-from-assistant', description: 'Filled from the conversation, by what the input means.' },
  signin: { label: 'The signed-in person', icon: 'input-from-signin', description: 'Taken from the verified sign-in. It always beats what the assistant says.' },
  fixed: { label: 'A fixed value', icon: 'input-fixed', description: 'The same value on every call.' },
  easm: { label: 'EASM', icon: 'input-filled-by-easm', description: 'EASM fills it, for example once for each term.' },
};
export interface ToolInput {
  name: string;
  /** text, number, date, yes-no, list: one of the row's kinds. */
  kind: string;
  source: InputSource;
  /** The wording the assistant reads (assistant). */
  meaning?: string;
  required?: boolean;
  /** The value sent every time (fixed). */
  value?: string;
  /** Which fact of the sign-in fills it (signin), as subject.id. */
  from?: string;
}
export type ToolInputField = 'source' | 'name' | 'kind' | 'meaning' | 'required' | 'value' | 'from';
const defaultKinds: readonly InputOption[] = [{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' }, { value: 'yes-no', label: 'Yes or no' }, { value: 'list', label: 'List' }];
const defaultFacts: readonly InputOption[] = [{ value: 'subject.id', label: 'Their ID (student or staff)' }, { value: 'subject.email', label: 'Their email' }, { value: 'subject.name', label: 'Their name' }];
export interface InputSourceRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: ToolInput;
  onChange?: (next: ToolInput) => void;
  /** A built-in input: what is locked (by default its source, name and kind; the wording and Required stay
   *  editable) and why, in the person's words. Inputs EASM fills are locked whole. */
  locked?: { reason: string; fields?: readonly ToolInputField[] };
  /** The sources this tool may use (all four by default). */
  sources?: readonly InputSource[];
  kinds?: readonly InputOption[];
  /** What a sign-in can fill an input with. */
  signinFacts?: readonly InputOption[];
  onRemove?: () => void;
}
/** One input of a tool, led by who fills it: the assistant (from what the input means), the signed-in person, a
 *  fixed value, or EASM. Then its name, kind and the part that source needs. A built-in input is drawn locked and
 *  says why. */
export function InputSourceRow({ value, onChange, locked, sources = ['assistant', 'signin', 'fixed', 'easm'], kinds = defaultKinds, signinFacts = defaultFacts, onRemove, className, ...props }: InputSourceRowProps) {
  const lockedFields = new Set<ToolInputField>(value.source === 'easm' ? ['source', 'name', 'kind', 'meaning', 'required', 'value', 'from'] : locked ? locked.fields ?? ['source', 'name', 'kind'] : []);
  const can = (f: ToolInputField) => !!onChange && !lockedFields.has(f);
  const set = (patch: Partial<ToolInput>) => onChange?.({ ...value, ...patch });
  const source = inputSources[value.source];
  const name = value.name || 'New input';
  const picker = can('source')
    ? <DropdownMenu label={`Who fills ${name}`} heading="Who fills it" align="start" items={sources.map(id => ({ id, label: inputSources[id].label, icon: inputSources[id].icon, description: inputSources[id].description, selected: id === value.source, onSelect: () => set({ source: id }) }))}
      trigger={<Button variant="secondary" size="sm" leadingIcon={source.icon} trailingIcon="chevron-up-down" className="easm-ui-input-source-button" aria-label={`Filled by ${source.label}: change`}>{source.label}</Button>} />
    : <span className="easm-ui-input-source-fixed"><UIIcon name={source.icon} size={20} />{source.label}</span>;
  // A locked part reads as a value, not as a field that only refuses to change.
  const fixed = (label: string, text: ReactNode, mono = false) => <div className="easm-ui-input-static"><span className="easm-ui-input-static-label">{label}</span>
    <span className="easm-ui-input-static-value" data-mono={mono || undefined}>{text || '—'}</span></div>;
  const optionLabel = (options: readonly InputOption[], v?: string) => options.find(o => o.value === v)?.label ?? v;
  const detail = value.source === 'assistant'
    ? can('meaning') ? <TextArea label="What it means" description="The wording the assistant reads." size="sm" rows={2} value={value.meaning ?? ''} onChange={e => set({ meaning: e.target.value })} /> : fixed('What it means', value.meaning)
    : value.source === 'signin'
      ? can('from') ? <DropdownSelect label="From their sign-in" size="sm" options={signinFacts} value={value.from} onValueChange={v => set({ from: v })} placeholder="Choose what fills it" /> : fixed('From their sign-in', optionLabel(signinFacts, value.from))
      : value.source === 'fixed'
        ? can('value') ? <TextField label="Value" size="sm" value={value.value ?? ''} onChange={e => set({ value: e.target.value })} /> : fixed('Value', value.value, true)
        : <p className="easm-ui-input-source-note">{source.description}</p>;
  return <div {...props} role="group" aria-label={`Input ${name}`} className={cx('easm-ui easm-ui-input-source', className)} data-source={value.source} data-locked={locked || value.source === 'easm' ? true : undefined}><div className="easm-ui-input-source-grid">
    <div className="easm-ui-input-source-who"><span className="easm-ui-input-source-caption">Filled by</span>{picker}</div>
    <div className="easm-ui-input-source-what">
      {can('name') ? <TextField label="Name" size="sm" value={value.name} onChange={e => set({ name: e.target.value })} spellCheck={false} className="easm-ui-input-source-name" /> : fixed('Name', value.name, true)}
      {can('kind') ? <DropdownSelect label="Kind" size="sm" options={kinds} value={value.kind} onValueChange={v => set({ kind: v })} /> : fixed('Kind', optionLabel(kinds, value.kind))}
    </div>
    <div className="easm-ui-input-source-detail">{detail}</div>
    <div className="easm-ui-input-source-end">
      {value.source !== 'assistant' ? null : can('required') ? <Switch label="Required" size="sm" checked={!!value.required} onCheckedChange={v => set({ required: v })} />
        : <span className="easm-ui-input-source-required">{value.required ? 'Required' : 'Optional'}</span>}
      {onRemove && !locked ? <IconButton icon="delete" label={`Remove ${name}`} variant="subtle" size="sm" onClick={onRemove} /> : null}
    </div>
    {locked || value.source === 'easm' ? <p className="easm-ui-input-source-lock"><UIIcon name="lock-closed" size={16} /><span>{locked?.reason ?? 'EASM fills this input; it cannot be changed here.'}</span></p> : null}
  </div></div>;
}

/* ------------------------------------------------------------------ RequestBuilder */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface RequestPair { key: string; value: string }
export interface RequestSlot {
  source: InputSource;
  /** A value to show in the preview: a sample, or a mask ("•••4521"). */
  sample?: string;
}
const SLOT = /\{([A-Za-z_][\w.]*)\}/g;
const slotWords: Record<InputSource, string> = { assistant: 'filled by the assistant', signin: 'from the sign-in', fixed: 'a fixed value', easm: 'filled by EASM' };
const slotsIn = (text: string) => [...text.matchAll(SLOT)].map(m => m[1]);
function SlotText({ text, slots, fill }: { text: string; slots: Readonly<Record<string, RequestSlot>>; fill?: boolean }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(SLOT)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const slot = slots[m[1]];
    parts.push(<mark key={m.index} className="easm-ui-slot" data-source={slot?.source ?? 'unknown'}>{fill && slot?.sample !== undefined ? slot.sample : m[0]}</mark>);
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
/** A text field whose {slots} are drawn in the colour of what fills them, under the text being typed. */
function SlotInput({ label, value, onChange, slots, readOnly, placeholder }: { label: string; value: string; onChange?: (v: string) => void; slots: Readonly<Record<string, RequestSlot>>; readOnly?: boolean; placeholder?: string }) {
  const mirror = useRef<HTMLDivElement>(null);
  return <span className="easm-ui-slot-input" data-readonly={readOnly || !onChange || undefined}>
    <span ref={mirror} className="easm-ui-slot-mirror" aria-hidden="true"><SlotText text={value} slots={slots} />{'​'}</span>
    <input aria-label={label} value={value} placeholder={placeholder} readOnly={readOnly || !onChange} spellCheck={false} autoComplete="off"
      onChange={e => onChange?.(e.target.value)} onScroll={e => { if (mirror.current) mirror.current.scrollLeft = e.currentTarget.scrollLeft; }} />
  </span>;
}
function PairsEditor({ label, pairs, onChange, slots, readOnly, keyLabel, addLabel }: { label: string; pairs: readonly RequestPair[]; onChange?: (next: RequestPair[]) => void; slots: Readonly<Record<string, RequestSlot>>; readOnly?: boolean; keyLabel: string; addLabel: string }) {
  const edit = !readOnly && !!onChange;
  const set = (i: number, patch: Partial<RequestPair>) => onChange?.(pairs.map((p, j) => j === i ? { ...p, ...patch } : p));
  return <div className="easm-ui-pairs" role="group" aria-label={label}>
    {pairs.length ? <div className="easm-ui-pair easm-ui-pair-head" aria-hidden="true"><span>{keyLabel}</span><span>Value</span></div> : null}
    {pairs.length ? pairs.map((p, i) => <div key={i} className="easm-ui-pair">
      <SlotInput label={`${keyLabel} ${i + 1}`} value={p.key} onChange={edit ? v => set(i, { key: v }) : undefined} slots={slots} placeholder={keyLabel} />
      <SlotInput label={`Value of ${p.key || `${keyLabel} ${i + 1}`}`} value={p.value} onChange={edit ? v => set(i, { value: v }) : undefined} slots={slots} placeholder="Value or {input}" />
      {edit ? <IconButton icon="delete" label={`Remove ${p.key || `${keyLabel} ${i + 1}`}`} variant="subtle" size="sm" onClick={() => onChange?.(pairs.filter((_, j) => j !== i))} /> : null}
    </div>) : <p className="easm-ui-pairs-empty">None.</p>}
    {edit ? <Button variant="secondary" size="sm" leadingIcon="add" onClick={() => onChange?.([...pairs, { key: '', value: '' }])} className="easm-ui-pairs-add">{addLabel}</Button> : null}
  </div>;
}
export interface RequestBuilderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  label: string;
  method: HttpMethod;
  onMethodChange?: (method: HttpMethod) => void;
  /** Where the path is sent: shown, never edited here ("PeopleSoft gateway", https://api.example.edu). */
  base?: string;
  path: string;
  onPathChange?: (path: string) => void;
  query?: readonly RequestPair[];
  onQueryChange?: (next: RequestPair[]) => void;
  headers?: readonly RequestPair[];
  onHeadersChange?: (next: RequestPair[]) => void;
  body?: string;
  onBodyChange?: (body: string) => void;
  /** How each {slot} is filled: by an input's source, with a sample for the preview. */
  slots?: Readonly<Record<string, RequestSlot>>;
  /** The authorisation line the preview shows, in words: "Bearer ‹the person's own sign-in›". */
  auth?: string;
  readOnly?: boolean;
}
const methods: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
/** The request a tool sends: the method, the address with each {slot} in the colour of what fills it, the query
 *  values, headers and body in tabs, and a live preview of the exact request with the samples put in. A method that
 *  changes data says so, calmly. */
export function RequestBuilder({ label, method, onMethodChange, base, path, onPathChange, query = [], onQueryChange, headers = [], onHeadersChange, body = '', onBodyChange, slots = {}, auth, readOnly, className, ...props }: RequestBuilderProps) {
  const writes = method !== 'GET';
  const used = [...new Set([path, ...query.flatMap(p => [p.key, p.value]), ...headers.flatMap(p => [p.key, p.value]), writes ? body : ''].flatMap(slotsIn))];
  const qs = query.filter(p => p.key);
  const tabs = [
    { id: 'query', label: `Query values${query.length ? ` (${query.length})` : ''}`, content: <PairsEditor label="Query values" keyLabel="Name" addLabel="Add a query value" pairs={query} onChange={onQueryChange} slots={slots} readOnly={readOnly} /> },
    { id: 'headers', label: `Headers${headers.length ? ` (${headers.length})` : ''}`, content: <PairsEditor label="Headers" keyLabel="Header" addLabel="Add a header" pairs={headers} onChange={onHeadersChange} slots={slots} readOnly={readOnly} /> },
    ...(writes ? [{ id: 'body', label: 'Body', content: <TextArea label="Body" hideLabel size="sm" rows={5} value={body} readOnly={readOnly || !onBodyChange} onChange={e => onBodyChange?.(e.target.value)} spellCheck={false} controlClassName="easm-ui-request-body" /> }] : []),
  ];
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-request', className)} data-writes={writes || undefined}>
    <div className="easm-ui-request-line">
      {onMethodChange && !readOnly
        ? <DropdownSelect label="Method" hideLabel options={methods.map(m => ({ value: m, label: m }))} value={method} onValueChange={v => onMethodChange(v as HttpMethod)} className="easm-ui-request-method-select" />
        : <span className="easm-ui-request-method">{method}</span>}
      <span className="easm-ui-request-address">
        {base ? <span className="easm-ui-request-base" title={base}>{base}</span> : null}
        <SlotInput label="Address" value={path} onChange={readOnly ? undefined : onPathChange} slots={slots} placeholder="/path/{input}" />
      </span>
    </div>
    {writes ? <p className="easm-ui-request-writes"><UIIcon name="tool-writes" size={20} /><span><strong>This tool changes data.</strong> Only verified people can use it, and every use is recorded.</span></p> : null}
    {used.length ? <ul className="easm-ui-request-slots" aria-label="Inputs in this request">
      {used.map(s => <li key={s} data-source={slots[s]?.source ?? 'unknown'}>
        <UIIcon name={slots[s] ? inputSources[slots[s].source].icon : 'warning'} size={16} />
        <code>{`{${s}}`}</code><span>{slots[s] ? slotWords[slots[s].source] : 'not an input of this tool'}</span>
      </li>)}
    </ul> : null}
    <Tabs label="Request parts" items={tabs} size="sm" />
    <figure className="easm-ui-request-preview">
      <figcaption>The request, as sent</figcaption>
      <pre><code>
        <span className="easm-ui-request-method-word">{method}</span> {base ? /^https?:/.test(base) ? base : `‹${base}›` : ''}<SlotText text={path} slots={slots} fill />
        {qs.length ? <>?{qs.map((p, i) => <span key={i}>{i ? '&' : ''}<SlotText text={p.key} slots={slots} fill />=<SlotText text={p.value} slots={slots} fill /></span>)}</> : null}
        {auth ? <>{'\n'}<span className="easm-ui-request-header-name">Authorization:</span> {auth}</> : null}
        {headers.filter(p => p.key).map((p, i) => <span key={i}>{'\n'}<span className="easm-ui-request-header-name"><SlotText text={p.key} slots={slots} fill />:</span> <SlotText text={p.value} slots={slots} fill /></span>)}
        {writes && body ? <>{'\n\n'}<SlotText text={body} slots={slots} fill /></> : null}
      </code></pre>
    </figure>
  </section>;
}

/* ------------------------------------------------------------------ JsonView */

type JsonKind = 'text' | 'number' | 'yes-no' | 'empty' | 'list' | 'group';
const kindOf = (v: unknown): JsonKind => v === null || v === undefined ? 'empty' : Array.isArray(v) ? 'list' : typeof v === 'object' ? 'group'
  : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'yes-no' : 'text';
const kindWords: Record<JsonKind, string> = { text: 'text', number: 'number', 'yes-no': 'yes/no', empty: 'empty', list: 'list', group: 'group' };
/** The type of the value at a path ("vouchers[].amount"), following the first item of each list. */
export function jsonKindAt(value: unknown, path: string): string {
  let at: unknown = value;
  for (const part of path.split('.')) {
    const list = part.endsWith('[]');
    const key = list ? part.slice(0, -2) : part;
    if (key) at = at && typeof at === 'object' && !Array.isArray(at) ? (at as Record<string, unknown>)[key] : undefined;
    if (list) at = Array.isArray(at) ? at[0] : undefined;
  }
  return kindWords[kindOf(at)];
}
interface JsonTreeContext { masked: boolean; openDepth: number; shown: number; picked: ReadonlySet<string>; onToggle?: (path: string, picked: boolean) => void }
function JsonLeafValue({ v, masked }: { v: unknown; masked: boolean }) {
  const k = kindOf(v);
  if (masked && k !== 'empty') return <span className="easm-ui-json-masked">•••</span>;
  return <span className="easm-ui-json-value" data-kind={k}>{k === 'text' ? `“${String(v)}”` : k === 'empty' ? 'empty' : k === 'yes-no' ? (v ? 'yes' : 'no') : String(v)}</span>;
}
function JsonNode({ name, v, path, depth, ctx }: { name: ReactNode; v: unknown; path: string; depth: number; ctx: JsonTreeContext }) {
  const k = kindOf(v);
  const holdsPicked = [...ctx.picked].some(p => p.startsWith(k === 'list' ? `${path}[]` : `${path}.`));
  const [open, setOpen] = useState(depth < ctx.openDepth || holdsPicked);
  if (k === 'group' || k === 'list') {
    const entries: [string, unknown, string][] = k === 'list'
      ? (v as unknown[]).slice(0, ctx.shown).map((item, i) => [`${i + 1}`, item, `${path}[]`])
      : Object.entries(v as Record<string, unknown>).map(([key, item]) => [key, item, path ? `${path}.${key}` : key]);
    const count = k === 'list' ? (v as unknown[]).length : entries.length;
    return <li className="easm-ui-json-node" data-kind={k}>
      <button type="button" className="easm-ui-json-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <UIIcon name="chevron-right" size={16} /><span className="easm-ui-json-key">{name}</span>
        <span className="easm-ui-json-kind">{k === 'list' ? `list of ${count}` : `${count} ${count === 1 ? 'field' : 'fields'}`}</span>
      </button>
      {open ? <ul className="easm-ui-json-children">
        {entries.map(([key, item, p]) => <JsonNode key={key} name={k === 'list' ? <span className="easm-ui-json-index">{key}</span> : key} v={item} path={p} depth={depth + 1} ctx={ctx} />)}
        {k === 'list' && count > ctx.shown ? <li className="easm-ui-json-more">{count - ctx.shown} more {count - ctx.shown === 1 ? 'item' : 'items'} with the same fields</li> : null}
      </ul> : null}
    </li>;
  }
  const on = ctx.picked.has(path);
  return <li className="easm-ui-json-leaf" data-picked={on || undefined}>
    {ctx.onToggle ? <Checkbox label={`Keep ${path}`} hideLabel size="sm" checked={on} onCheckedChange={c => ctx.onToggle?.(path, c)} className="easm-ui-json-check" /> : null}
    <span className="easm-ui-json-key">{name}</span><span className="easm-ui-json-kind">{kindWords[k]}</span><JsonLeafValue v={v} masked={ctx.masked} />
  </li>;
}
export interface JsonViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onToggle'> {
  label: string;
  value: unknown;
  /** Only the shape is shown: every value is hidden (a sample that names a student). */
  masked?: boolean;
  /** Levels open at first (2; 3 while picking). A group holding a picked value starts open. */
  openDepth?: number;
  /** The output was cut off: true, or the words to say. */
  truncated?: boolean | string;
  /** Picking fields: the picked paths, and a box on every value. */
  selected?: readonly string[];
  onToggle?: (path: string, picked: boolean) => void;
  /** Items shown of each list (3; 1 while picking, since every item has the same fields). */
  itemsShown?: number;
}
/** A response, read-only: groups and lists open and close, each value says its type, masked values keep their
 *  shape only, a cut-off output says so. With onToggle every value can be picked by its path. */
export function JsonView({ label, value, masked = false, openDepth, truncated, selected, onToggle, itemsShown, className, ...props }: JsonViewProps) {
  const picking = !!onToggle;
  const shown = itemsShown ?? (picking ? 1 : 3);
  const ctx: JsonTreeContext = { masked, openDepth: openDepth ?? (picking ? 3 : 2), shown, picked: new Set(selected ?? []), onToggle };
  const root = kindOf(value);
  return <div {...props} role="group" aria-label={label} className={cx('easm-ui easm-ui-json', className)} data-picking={picking || undefined}>
    {root === 'group' || root === 'list'
      ? <ul className="easm-ui-json-children" data-root="true">{root === 'list'
        ? <JsonNode name="Response" v={value} path="" depth={0} ctx={ctx} />
        : Object.entries(value as Record<string, unknown>).map(([key, item]) => <JsonNode key={key} name={key} v={item} path={key} depth={1} ctx={ctx} />)}</ul>
      : <p className="easm-ui-json-scalar"><JsonLeafValue v={value} masked={masked} /></p>}
    {truncated ? <p className="easm-ui-json-truncated"><UIIcon name="result-truncated" size={16} />{typeof truncated === 'string' ? truncated : 'Cut off here: the rest of the response is not shown.'}</p> : null}
  </div>;
}

/* ------------------------------------------------------------------ ResponsePicker */

export interface ResponsePickerProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  label: string;
  /** A sample response from a test call. */
  sample: unknown;
  /** The paths the assistant keeps, in the order it reads them. */
  value: readonly string[];
  onChange: (paths: string[]) => void;
  /** The sample names a student: values hidden, shape kept. */
  masked?: boolean;
  truncated?: boolean | string;
}
/** Which fields of a response the assistant keeps: pick them in the response, read them in order beside it, and
 *  move or drop them there. Nothing picked means the assistant reads the whole response. */
export function ResponsePicker({ label, sample, value, onChange, masked, truncated, className, ...props }: ResponsePickerProps) {
  const headingId = useId();
  const move = (i: number, by: number) => { const next = [...value]; const [p] = next.splice(i, 1); next.splice(i + by, 0, p); onChange(next); };
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-response-picker', className)}>
    {masked ? <p className="easm-ui-response-masked"><UIIcon name="lock-closed" size={16} /><span>This sample names a student, so only its shape is shown. Pick fields by name.</span></p> : null}
    <div className="easm-ui-response-panes">
      <div className="easm-ui-response-pane">
        <h4 className="easm-ui-response-heading">The response</h4>
        <JsonView label="Sample response" value={sample} masked={masked} truncated={truncated} selected={value}
          onToggle={(path, on) => onChange(on ? [...value.filter(p => p !== path), path] : value.filter(p => p !== path))} />
      </div>
      <div className="easm-ui-response-pane" data-kind="kept">
        <h4 className="easm-ui-response-heading" id={headingId}>Kept for the assistant{value.length ? <span>{value.length}</span> : null}</h4>
        {value.length ? <ol className="easm-ui-response-kept" aria-labelledby={headingId}>
          {value.map((p, i) => <li key={p}>
            <span className="easm-ui-response-order">{i + 1}</span>
            <span className="easm-ui-response-path"><code>{p.split('.').map((part, j) => <span key={j}>{j ? <>.<wbr /></> : null}{part}</span>)}</code><span>{jsonKindAt(sample, p)}</span></span>
            <span className="easm-ui-response-actions">
              <IconButton icon="arrow-up" label={`Move ${p} up`} variant="subtle" size="sm" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon="arrow-down" label={`Move ${p} down`} variant="subtle" size="sm" disabled={i === value.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon="dismiss" label={`Stop keeping ${p}`} variant="subtle" size="sm" onClick={() => onChange(value.filter(x => x !== p))} />
            </span>
          </li>)}
        </ol> : <p className="easm-ui-response-none">Nothing picked: the assistant reads the whole response.</p>}
      </div>
    </div>
  </section>;
}

/* ------------------------------------------------------------------ RuleSentence */

export type RuleTrigger = 'always' | 'keyword' | 'after-tool' | 'on-clarify';
export const ruleTriggers: Readonly<Record<RuleTrigger, { label: string; icon: IconName; lead: string }>> = {
  always: { label: 'Every question', icon: 'chat-multiple', lead: 'On every question' },
  keyword: { label: 'When the question mentions', icon: 'keyword-search', lead: 'When the question mentions' },
  'after-tool': { label: 'After the assistant uses a tool', icon: 'tool-call', lead: 'After the assistant uses' },
  'on-clarify': { label: 'When it must ask what was meant', icon: 'question-circle', lead: 'When it must ask what was meant' },
};
export interface RuleSentenceValue {
  trigger: RuleTrigger;
  words: readonly string[];
  tools: readonly string[];
  /** Where it applies; none means everywhere. */
  surfaces: readonly string[];
  /** Who it applies to; none means everyone. */
  audiences: readonly string[];
  /** What the assistant must do. */
  instruction: string;
}
export interface RuleChoice { id: string; label: string; icon?: IconName }
export interface RuleSentenceProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  label: string;
  value: RuleSentenceValue;
  onChange?: (next: RuleSentenceValue) => void;
  surfaces: readonly RuleChoice[];
  audiences: readonly RuleChoice[];
  tools?: readonly RuleChoice[];
  /** The rule triggers this surface allows (all four by default). */
  triggers?: readonly RuleTrigger[];
}
const listWords = (items: readonly string[], none: string, and = 'and') => !items.length ? none : items.length === 1 ? items[0]
  : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
/** A rule as the sentence it is: when it applies, where, for whom, and what the assistant must do, each part a chip
 *  that opens its picker. Under it, what will happen in plain words, or what is missing. */
export function RuleSentence({ label, value, onChange, surfaces, audiences, tools = [], triggers = ['always', 'keyword', 'after-tool', 'on-clarify'], className, ...props }: RuleSentenceProps) {
  const [word, setWord] = useState('');
  const edit = !!onChange;
  const set = (patch: Partial<RuleSentenceValue>) => onChange?.({ ...value, ...patch });
  const toggle = (list: readonly string[], id: string) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  const names = (ids: readonly string[], from: readonly RuleChoice[]) => ids.map(id => from.find(c => c.id === id)?.label ?? id);
  const addWord = () => { const w = word.trim(); if (w && !value.words.includes(w)) set({ words: [...value.words, w] }); setWord(''); };
  const chip = (id: string, text: ReactNode, title: string, empty: boolean, panel: ReactNode, icon?: IconName) => {
    const inner = <>{icon ? <UIIcon name={icon} size={16} /> : null}<span>{text}</span></>;
    if (!edit) return <span className="easm-ui-rule-slot" data-slot={id} data-empty={empty || undefined}>{inner}</span>;
    return <Popover title={title} align="start" dim={false}
      trigger={<button type="button" className="easm-ui-rule-slot" data-slot={id} data-empty={empty || undefined} aria-label={`${title}: ${typeof text === 'string' ? text : ''}`}>{inner}<UIIcon name="chevron-down" size={16} /></button>}>
      {panel}
    </Popover>;
  };
  const checkList = (from: readonly RuleChoice[], picked: readonly string[], onPick: (next: string[]) => void, noneText: string) =>
    <div className="easm-ui-rule-choices">
      {from.map(c => <Checkbox key={c.id} size="sm" label={<span className="easm-ui-rule-choice">{c.icon ? <UIIcon name={c.icon} size={20} /> : null}{c.label}</span>} checked={picked.includes(c.id)} onCheckedChange={() => onPick(toggle(picked, c.id))} />)}
      <p className="easm-ui-rule-hint">{noneText}</p>
    </div>;
  const where = names(value.surfaces, surfaces), who = names(value.audiences, audiences), used = names(value.tools, tools);
  const triggerChip = chip('trigger', ruleTriggers[value.trigger].lead, 'When it applies', false,
    <div className="easm-ui-rule-triggers" role="group" aria-label="When it applies">{triggers.map(t => <button key={t} type="button" aria-pressed={t === value.trigger} className="easm-ui-rule-trigger" onClick={() => set({ trigger: t })}>
      <UIIcon name={ruleTriggers[t].icon} size={20} /><span>{ruleTriggers[t].label}</span></button>)}</div>, ruleTriggers[value.trigger].icon);
  const subject = value.trigger === 'keyword'
    ? chip('words', value.words.length ? listWords(value.words.map(w => `“${w}”`), '', 'or') : 'choose words', 'Words that make it apply', !value.words.length,
      <div className="easm-ui-rule-words">
        {value.words.length ? <ul className="easm-ui-rule-word-list">{value.words.map(w => <li key={w}>{w}<IconButton icon="dismiss" label={`Remove ${w}`} variant="subtle" size="sm" onClick={() => set({ words: value.words.filter(x => x !== w) })} /></li>)}</ul> : null}
        <div className="easm-ui-rule-word-add">
          <TextField label="Add a word" size="sm" value={word} onChange={e => setWord(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }} />
          <Button variant="secondary" size="sm" onClick={addWord} disabled={!word.trim()}>Add</Button>
        </div>
      </div>)
    : value.trigger === 'after-tool'
      ? chip('tools', used.length ? listWords(used, '', 'or') : 'choose a tool', 'Which tools', !used.length, checkList(tools, value.tools, next => set({ tools: next }), 'Pick at least one.'))
      : null;
  const problems = [
    value.trigger === 'keyword' && !value.words.length ? 'Add a word: a rule that waits for words never applies without one.' : null,
    value.trigger === 'after-tool' && !value.tools.length ? 'Pick a tool: this rule applies after one is used.' : null,
    !value.instruction.trim() ? 'Say what the assistant must do.' : null,
  ].filter(Boolean) as string[];
  const when = value.trigger === 'keyword' ? `when they ask about ${listWords(value.words.map(w => `“${w}”`), '…', 'or')}`
    : value.trigger === 'after-tool' ? `after the assistant uses ${listWords(used, 'a tool', 'or')}` : value.trigger === 'on-clarify' ? 'when the assistant must ask what they meant' : 'on every question';
  const outcome = `Applies to ${who.length ? listWords(who.map(w => w.toLowerCase()), '') : 'everyone'} ${where.length ? `on ${listWords(where, '')}` : 'everywhere'}, ${when}. The assistant follows it before its own rules.`;
  return <section {...props} aria-label={label} className={cx('easm-ui easm-ui-rule-sentence', className)}>
    <p className="easm-ui-rule-line">
      {subject ? <>{triggerChip} <span className="easm-ui-rule-bit">{subject},</span></> : <span className="easm-ui-rule-bit">{triggerChip},</span>}{' '}
      <span className="easm-ui-rule-word">on</span> <span className="easm-ui-rule-bit">{chip('surfaces', where.length ? listWords(where, '') : 'everywhere', 'Where it applies', false, checkList(surfaces, value.surfaces, next => set({ surfaces: next }), 'None picked: everywhere.'))},</span>{' '}
      <span className="easm-ui-rule-word">for</span> <span className="easm-ui-rule-bit">{chip('audiences', who.length ? listWords(who, '') : 'everyone', 'Who it applies to', false, checkList(audiences, value.audiences, next => set({ audiences: next }), 'None picked: everyone.'))},</span>{' '}
      <span className="easm-ui-rule-word">the assistant must</span> {chip('instruction', value.instruction.trim() ? `“${value.instruction.trim()}”` : 'say what it must do', 'What the assistant must do', !value.instruction.trim(),
        <TextArea label="What the assistant must do" hideLabel rows={4} value={value.instruction} onChange={e => set({ instruction: e.target.value })} />)}
    </p>
    {problems.length ? <ul className="easm-ui-rule-problems">{problems.map(p => <li key={p}><UIIcon name="warning" size={16} />{p}</li>)}</ul>
      : <p className="easm-ui-rule-outcome" role="status"><UIIcon name="actor-ai" size={16} /><span>{outcome}</span></p>}
  </section>;
}
