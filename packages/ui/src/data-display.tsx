"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./actions";
import { Checkbox, SearchField, Select } from "./inputs";
import { Skeleton, StatusBadge, type StatusBadgeStatus } from "./feedback";
import { InfoHint, ToneIcon, type ChartTone } from "./insights";
import { Sparkline } from "./charts";
import { useElementWidth } from "./palette";
import { useFlip } from "./motion-hooks";
import { UnmeasuredValue } from "./workflow";
import {
  checkLabel,
  cx,
  formatReadableNumber,
  MissingValue,
  quietPointerFocus,
  reportContentProblem,
  UIIcon,
  useControllableState,
  useOverflowing,
  type ComponentSize,
  type UIIconName,
} from "./shared";

export const dataComponentNames = [
  "DataTable",
  "StatCard",
  "Chart",
  "FilterBar",
  "Pagination",
  "DataStatus",
] as const;
export type DataValue = string | number | Date | null | undefined;
export type DataSort = {
  column: string;
  direction: "ascending" | "descending";
} | null;
export interface DataColumn<Row> {
  id: string;
  label: string;
  value?: (row: Row) => DataValue;
  /** Supplied interactive content must respect the disabled context. */
  render?: (
    row: Row,
    context: { disabled: boolean; selected: boolean },
  ) => ReactNode;
  sortable?: boolean;
  compare?: (a: Row, b: Row) => number;
  align?: "start" | "end";
  width?: "compact" | "regular" | "wide";
  /** Underlines each number with a thin bar of the column's tone, as long as its share of the column's largest value
   * (or of `max`), so rows can be compared at a glance. Needs `value` to return a number. */
  meter?: boolean | { tone?: ChartTone; max?: number };
  /** Where the value sits when rows become cards on a narrow screen (narrowLayout "cards"). "title" is the card's
   * heading (the first column by default); "aside" sits on the title's line at the end, such as a time; "subtitle"
   * is a full-width line under the title without a label; "badge" joins one row of tags and pills without a label
   * (a column whose value is a lone Tag, Badge, Chip or ScorePill does this by default); "field" shows its label
   * beside the value; "hidden" leaves the value out of the card. Screen readers hear every column's heading. */
  card?: "title" | "aside" | "subtitle" | "badge" | "field" | "hidden";
}
type HeadingLevel = 2 | 3 | 4;
// Content problems (a blank label, a repeated key, an invalid count) throw in development and tests. In a
// production build they warn once and the component renders what it can, so one bad record never blanks a page.
const requireLabel = checkLabel;
/** A column that can actually sort: in production a sortable column without a value or comparator is not. */
const canSort = <Row,>(column: DataColumn<Row>) => !!column.sortable && !!(column.value || column.compare);
const heading = (level: HeadingLevel) => `h${level}` as "h2" | "h3" | "h4";
/** A value that is there to show. Null, non-finite numbers, invalid dates and blank text are not: they read as
 * "—" (never as zero) and sort last. */
function known(value: DataValue): value is string | number | Date {
  return (
    value != null &&
    !(typeof value === "number" && !Number.isFinite(value)) &&
    !(typeof value === "string" && !value.trim()) &&
    !(value instanceof Date && !Number.isFinite(value.getTime()))
  );
}
export interface FormatDataValueOptions {
  /** IANA time zone for dates, such as "Asia/Karachi". Set it when pages render on a server in another zone,
   * so the server and the browser print the same date and hydration does not mismatch. */
  timeZone?: string;
}
/** Text for one value. Numbers keep up to two decimals, and values between zero and one keep their significant
 * digits (0.002 stays 0.002); dates follow the locale; missing values are "—". */
export function formatDataValue(
  value: DataValue,
  locale = "en",
  options: FormatDataValueOptions = {},
): string {
  if (!known(value)) return "—";
  if (value instanceof Date)
    return value.toLocaleDateString(
      locale,
      options.timeZone ? { timeZone: options.timeZone } : undefined,
    );
  return typeof value === "number"
    ? formatReadableNumber(value, locale, 2)
    : value;
}
/** Whether an element is at most `limit` pixels wide, kept current as it resizes. Only a change of the answer
 * re-renders, so resizing a window does not re-render every row of a long table on each frame. */
function useAtMostWidth<T extends HTMLElement>(limit: number, enabled: boolean) {
  const [narrow, setNarrow] = useState(false);
  const ref = useCallback(
    (node: T | null) => {
      if (!node || !enabled) return;
      const measure = () => {
        const width = Math.floor(node.clientWidth);
        setNarrow(width > 0 && width <= limit);
      };
      measure();
      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
      }
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    },
    [limit, enabled],
  );
  return [ref, enabled && narrow] as const;
}
/** A table cell's value: its text, or the shared missing-value element, so a screen reader hears
 * "Not available" rather than "dash" (or nothing) for a value that was not measured. */
function cellValue(value: DataValue, locale: string, timeZone?: string): ReactNode {
  return known(value) ? formatDataValue(value, locale, { timeZone }) : <MissingValue />;
}
export interface DataTableProps<Row> {
  label: string;
  rows: readonly Row[];
  columns: readonly DataColumn<Row>[];
  rowKey: (row: Row) => string;
  rowLabel?: (row: Row) => string;
  size?: ComponentSize;
  sort?: DataSort;
  defaultSort?: DataSort;
  onSortChange?: (sort: DataSort) => void;
  /** Manual delegates ordering to the caller; only client mode sorts supplied rows. */
  sortMode?: "client" | "manual";
  selectable?: boolean;
  selectedKeys?: readonly string[];
  defaultSelectedKeys?: readonly string[];
  onSelectionChange?: (keys: string[]) => void;
  isRowDisabled?: (row: Row) => boolean;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  footer?: ReactNode;
  /** A visible heading above the table; the label stays the accessible name when omitted. */
  title?: string;
  /** The level of the visible title, so it fits the page outline. Defaults to 3. */
  headingLevel?: HeadingLevel;
  description?: ReactNode;
  actions?: ReactNode;
  /** Controls between the heading and the table, such as a FilterBar. */
  toolbar?: ReactNode;
  /** What happens when the table itself is narrower than 600px. "scroll" keeps the columns and scrolls
   * sideways; "cards" turns each row into a card of label and value pairs (and keeps table roles). In cards,
   * sorting and select-all move to a visible control row above the cards. */
  narrowLayout?: "scroll" | "cards";
  /** A maximum height (pixels or any CSS length). The rows scroll inside it and the column headings stay
   * in view. Long tables are best paged on the server (100–200 rows a page). */
  maxHeight?: number | string;
  /** Show this many rows at a time, with page controls under the table. Sorting covers every row, then the
   * rows are paged. For a long list already in the client (a report, an evidence log); tables paged on the
   * server pass their own Pagination as `footer`. */
  pageSize?: number;
  locale?: string;
  /** IANA time zone for Date values, such as "Asia/Karachi" (see formatDataValue). */
  timeZone?: string;
  className?: string;
}
/** Semantic table. Row actions belong in explicit links/buttons, never clickable rows. */
export function DataTable<Row>({
  label,
  rows,
  columns,
  rowKey,
  rowLabel,
  size = "md",
  narrowLayout = "scroll",
  sort,
  defaultSort = null,
  onSortChange,
  sortMode = "client",
  selectable = false,
  selectedKeys,
  defaultSelectedKeys = [],
  onSelectionChange,
  isRowDisabled,
  loading = false,
  disabled = false,
  error,
  emptyTitle = "No records",
  emptyDescription = "There are no records to display.",
  onRetry,
  footer,
  title,
  headingLevel = 3,
  description,
  actions,
  toolbar,
  maxHeight,
  pageSize,
  locale = "en",
  timeZone,
  className,
}: DataTableProps<Row>) {
  requireLabel(label, "DataTable");
  const headingId = useId();
  // A metered column's bars are scaled to its largest value on the page (or the column's own max).
  const meterMax = useMemo(() => Object.fromEntries(columns.filter(column => column.meter && column.value).map(column => {
    const given = typeof column.meter === "object" ? column.meter.max : undefined;
    const largest = Math.max(0, ...rows.map(row => column.value!(row)).filter((v): v is number => typeof v === "number" && Number.isFinite(v)));
    return [column.id, given ?? largest];
  })), [columns, rows]);
  // A sort, a filter or a new page moves the rows that stay; they glide to their places (new rows rise in from CSS).
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useFlip(bodyRef, ':scope > tr[data-row-key]', { enter: false });
  if (
    !columns.length ||
    new Set(columns.map((c) => c.id)).size !== columns.length
  )
    reportContentProblem("DataTable requires unique columns.");
  for (const column of columns) {
    requireLabel(column.id, "DataTable column ID");
    requireLabel(column.label, "DataTable column");
    if (column.sortable && !column.value && !column.compare)
      reportContentProblem(
        "Sortable columns require a value accessor or comparator.",
      );
  }
  const keys = rows.map(rowKey);
  if (keys.some((k) => !String(k).trim()) || new Set(keys).size !== keys.length)
    reportContentProblem("DataTable requires unique stable row keys.");
  const [currentSort, setSort] = useControllableState<DataSort>(
    sort,
    defaultSort,
    onSortChange,
  );
  const [selection, setSelection] = useControllableState<readonly string[]>(
    selectedKeys,
    defaultSelectedKeys,
    (next) => onSelectionChange?.([...next]),
  );
  const cards = narrowLayout === "cards";
  // Card rows apply (in CSS) when the table is 600px or narrower. The same width decides which controls are
  // reachable: the visually hidden header keeps its text for screen readers but loses its buttons, and a
  // visible control row takes over sorting and select-all.
  const [rootRef, cardsActive] = useAtMostWidth<HTMLElement>(600, cards);
  // A FilterBar in the toolbar claims that control row and shows it beside Reset filters.
  const [controlsInToolbar, setControlsInToolbar] = useState(false);
  const [scrollRef, scrolls] = useOverflowing<HTMLDivElement>();
  const activeColumn = columns.find(
    (c) => c.id === currentSort?.column && canSort(c),
  );
  const sortColumn = currentSort?.column,
    sortDirection = currentSort?.direction;
  const ordered = useMemo(() => {
    if (!activeColumn || !sortDirection || sortMode === "manual")
      return [...rows];
    const direction = sortDirection === "ascending" ? 1 : -1;
    const collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: "base",
    });
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        if (activeColumn.compare) {
          const result = activeColumn.compare(a.row, b.row);
          return (
            (Number.isFinite(result) ? result * direction : 0) ||
            a.index - b.index
          );
        }
        const av = activeColumn.value!(a.row),
          bv = activeColumn.value!(b.row);
        if (!known(av) || !known(bv))
          return !known(av) && !known(bv)
            ? a.index - b.index
            : !known(av)
              ? 1
              : -1;
        const result =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : av instanceof Date && bv instanceof Date
              ? av.getTime() - bv.getTime()
              : collator.compare(String(av), String(bv));
        return result * direction || a.index - b.index;
      })
      .map((item) => item.row);
    // The sort's fields, not its object, so an inline `sort={{…}}` does not re-sort on every render.
  }, [rows, activeColumn, sortColumn, sortDirection, sortMode, locale]);
  // Client paging: a page of the sorted rows. Back to the first page whenever the order or the set changes.
  const paging = !!pageSize && pageSize > 0 && ordered.length > pageSize;
  const pages = paging ? Math.ceil(ordered.length / pageSize!) : 1;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length, sortColumn, sortDirection]);
  const currentPage = Math.min(page, pages);
  const shown = paging ? ordered.slice((currentPage - 1) * pageSize!, currentPage * pageSize!) : ordered;
  const available = rows.filter((row) => !isRowDisabled?.(row)).map(rowKey);
  const chosen = new Set(selection);
  const selectedVisible = available.filter((key) => chosen.has(key)).length;
  const blocked = disabled || loading;
  // Busy (loading) or failed: sort and select-all keep keyboard focus but do nothing, rather than being
  // natively disabled, which would drop focus to the page every time a server-side sort starts loading.
  const busy = loading || !!error;
  const selectAll = (checked: boolean) => {
    if (blocked || error) return;
    const next = new Set(selection);
    for (const key of available) checked ? next.add(key) : next.delete(key);
    setSelection([...next]);
  };
  const toggleRow = (key: string, checked: boolean) => {
    if (blocked) return;
    const next = new Set(selection);
    checked ? next.add(key) : next.delete(key);
    setSelection([...next]);
  };
  const sortBy = (column: string) => {
    if (busy || disabled) return;
    setSort({
      column,
      direction:
        currentSort?.column === column && currentSort.direction === "ascending"
          ? "descending"
          : "ascending",
    });
  };
  const count = columns.length + (selectable ? 1 : 0);
  const sortable = columns.filter(canSort);
  const ascending = !activeColumn || currentSort?.direction !== "descending";
  // Card rows change the table's display, which drops native table semantics in some browsers, so the
  // roles are stated explicitly in that mode.
  const roles = {
    table: cards ? { role: "table" } : {},
    group: cards ? { role: "rowgroup" } : {},
    row: cards ? { role: "row" } : {},
    head: cards ? { role: "columnheader" } : {},
    cell: cards ? { role: "cell" } : {},
  } as const;
  const minimumWidth = columns.reduce(
    (width, column) => width + ({ compact: 88, regular: 144, wide: 216 }[column.width || "regular"]),
    selectable ? 56 : 0,
  );
  const Heading = heading(headingLevel);
  const allChecked = available.length > 0 && selectedVisible === available.length;
  const someChecked = selectedVisible > 0 && selectedVisible < available.length;
  const cardControls = cardsActive && (selectable || sortable.length > 0) ? (
    <div className="easm-ui-data-card-controls">
      {selectable && (
        <Checkbox
          label="Select all"
          size="sm"
          checked={allChecked}
          indeterminate={someChecked}
          disabled={disabled || !available.length}
          aria-disabled={busy || undefined}
          onCheckedChange={selectAll}
        />
      )}
      {sortable.length > 0 && (
        <div className="easm-ui-data-card-sort">
          <Select
            label="Sort by"
            appearance="inline"
            size="sm"
            placeholder="None"
            value={activeColumn?.id ?? ""}
            options={sortable.map((column) => ({
              value: column.id,
              label: column.label,
            }))}
            disabled={disabled}
            onValueChange={(column) => {
              if (busy || disabled) return;
              setSort({
                column,
                direction:
                  currentSort?.column === column
                    ? currentSort.direction
                    : "ascending",
              });
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            className="easm-ui-data-card-direction"
            title={ascending ? "Ascending" : "Descending"}
            leadingIcon={ascending ? "arrow-up" : "arrow-down"}
            disabled={disabled}
            aria-disabled={busy || !activeColumn || undefined}
            onClick={() =>
              activeColumn &&
              setSort({
                column: activeColumn.id,
                direction: ascending ? "descending" : "ascending",
              })
            }
          >
            <span className="easm-ui-sr-only">Sort direction: </span>
            <span className="easm-ui-data-card-direction-label">{ascending ? "Ascending" : "Descending"}</span>
          </Button>
        </div>
      )}
    </div>
  ) : null;
  const toolbarContext = useMemo<TableToolbarContext>(
    () => ({ trailing: cardControls, claim: setControlsInToolbar }),
    [cardControls],
  );
  return (
    <section
      ref={rootRef}
      className={cx("easm-ui easm-ui-data-table", className)}
      data-size={size}
      data-narrow={narrowLayout}
      data-disabled={disabled || undefined}
      aria-label={title ? undefined : label}
      aria-labelledby={title ? `${headingId}-title` : undefined}
      aria-busy={loading || undefined}
    >
      {(title || description || actions) && (
        <div className="easm-ui-data-table-header">
          <div>
            {title && <Heading id={`${headingId}-title`}>{title}</Heading>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="easm-ui-data-table-actions">{actions}</div>}
        </div>
      )}
      {toolbar && (
        <div className="easm-ui-data-table-toolbar">
          <InTableToolbar.Provider value={toolbarContext}>{toolbar}</InTableToolbar.Provider>
        </div>
      )}
      {!controlsInToolbar && cardControls}
      <div
        ref={scrollRef}
        className="easm-ui-data-table-scroll"
        data-max-height={maxHeight !== undefined || undefined}
        style={maxHeight !== undefined ? { maxHeight } : undefined}
        // A region and a Tab stop only when the table actually scrolls.
        {...(scrolls
          ? {
              role: "region",
              "aria-label": `${label} table; scroll to see more`,
              tabIndex: 0,
            }
          : {})}
        {...quietPointerFocus()}
      >
        <table style={{ minWidth: minimumWidth }} {...roles.table}>
          <caption className="easm-ui-sr-only">{label}</caption>
          <thead {...roles.group}>
            <tr {...roles.row}>
              {selectable && (
                <th scope="col" className="easm-ui-data-check" {...roles.head}>
                  {cardsActive ? (
                    <span className="easm-ui-sr-only">Select</span>
                  ) : (
                    <Checkbox
                      label={
                        <span className="easm-ui-sr-only">
                          Select all available rows on this page
                        </span>
                      }
                      size="sm"
                      checked={allChecked}
                      indeterminate={someChecked}
                      disabled={disabled || !available.length}
                      aria-disabled={busy || undefined}
                      onCheckedChange={selectAll}
                    />
                  )}
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  {...roles.head}
                  data-align={column.align}
                  data-width={column.width || "regular"}
                  aria-sort={
                    activeColumn?.id === column.id
                      ? currentSort?.direction
                      : canSort(column)
                        ? "none"
                        : undefined
                  }
                >
                  {canSort(column) && !cardsActive ? (
                    <button
                      type="button"
                      className="easm-ui-data-sort"
                      disabled={disabled}
                      aria-disabled={busy || undefined}
                      onClick={() => sortBy(column.id)}
                      aria-label={`Sort ${column.label} ${currentSort?.column === column.id && currentSort.direction === "ascending" ? "descending" : "ascending"}`}
                    >
                      {column.label}
                      <UIIcon
                        name={
                          activeColumn?.id === column.id
                            ? currentSort?.direction === "ascending"
                              ? "arrow-up"
                              : "arrow-down"
                            : "sort"
                        }
                        size={16}
                      />
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody {...roles.group} ref={bodyRef}>
            {error || (!loading && !rows.length) ? (
              <tr aria-hidden="true">
                <td colSpan={count} className="easm-ui-data-state-cell" />
              </tr>
            ) : loading ? (
              <>
                {[0, 1, 2].map((row) => (
                  <tr key={row} aria-hidden="true">
                    {Array.from({ length: count }, (_, cell) => (
                      <td key={cell}>
                        <Skeleton />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ) : (
              shown.map((row) => {
                const key = rowKey(row),
                  rowDisabled = disabled || !!isRowDisabled?.(row);
                return (
                  <tr
                    key={key}
                    {...roles.row}
                    data-row-key={key}
                    data-selected={(selectable && chosen.has(key)) || undefined}
                    data-disabled={rowDisabled || undefined}
                  >
                    {selectable && (
                      <td className="easm-ui-data-check" {...roles.cell}>
                        <Checkbox
                          label={
                            <span className="easm-ui-sr-only">
                              Select {rowLabel?.(row) || key}
                            </span>
                          }
                          size="sm"
                          checked={chosen.has(key)}
                          disabled={rowDisabled}
                          onCheckedChange={(checked) => toggleRow(key, checked)}
                        />
                      </td>
                    )}
                    {columns.map((column, ci) => (
                      <td
                        key={column.id}
                        {...roles.cell}
                        data-label={cards ? column.label : undefined}
                        data-primary={(cards && (column.card ? column.card === "title" : ci === 0)) || undefined}
                        data-card={cards && column.card && column.card !== "title" ? column.card : undefined}
                        data-align={column.align}
                        data-width={column.width || "regular"}
                      >
                        {meterCell(column, row, meterMax[column.id], column.render
                          ? column.render(row, {
                              disabled: rowDisabled,
                              selected: selectable && chosen.has(key),
                            })
                          : cellValue(column.value?.(row), locale, timeZone))}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {error ? (
        <div className="easm-ui-data-message" role="alert">
          <UIIcon name="error-circle" />
          <strong>Could not load records</strong>
          <p>{error}</p>
          {onRetry && (
            <Button size="sm" variant="secondary" disabled={disabled} onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : !loading && !rows.length ? (
        <div className="easm-ui-data-message">
          <UIIcon name="table" />
          <strong>{emptyTitle}</strong>
          <p>{emptyDescription}</p>
        </div>
      ) : null}
      {/* Always mounted, so screen readers announce the change instead of missing a region that appears with its text. */}
      <p className="easm-ui-sr-only" role="status">
        {loading ? `Loading ${label}.` : ""}
      </p>
      {selectable && !loading && !error && (
        <p className="easm-ui-data-selection" role="status">
          {selectedVisible} of {available.length} available rows on this page
          selected
        </p>
      )}
      {(paging || footer) && (
        <div className="easm-ui-data-table-footer">
          {paging && (
            <Pagination
              page={currentPage}
              pageSize={pageSize!}
              total={ordered.length}
              onPageChange={setPage}
              label={`${label}, pages`}
              size="sm"
              locale={locale}
            />
          )}
          {footer}
        </div>
      )}
    </section>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  description?: string;
  icon?: UIIconName;
  /** With an icon, shows it in a tinted square before the label. */
  tone?: ChartTone;
  /** How the figure is measured, behind an ⓘ next to the label. */
  info?: string;
  /** Recent values drawn as a small trend line under the figure, in the card's tone. */
  spark?: readonly number[];
  /** The figure as a share of another ("59% of attempts"): a small ring in the card's tone and the percentage.
   * For the steps of a funnel shown side by side. Only for numeric values. */
  share?: { of: number; label: string };
  size?: ComponentSize;
  loading?: boolean;
  error?: string;
  trend?: {
    label: string;
    direction: "up" | "down" | "flat";
    sentiment?: "positive" | "negative" | "neutral";
  };
  /** The level of the label heading, so it fits the page outline. Defaults to 3. */
  headingLevel?: HeadingLevel;
  locale?: string;
  /** Why there is no figure, when value is null because nothing measures it ("No ad account connected"):
   * shown as "Not measured" with the reason, never as zero. */
  unmeasured?: string;
  /** Where the figure comes from when it is not verified: self-reported figures are outlined, provisional ones
   * (a provider still adjusting its last ~72 h) dashed, and both are said under the figure. */
  provenance?: "external" | "self-reported" | "provisional";
  className?: string;
}
/** A headline figure. A named group rather than a landmark region, so a dashboard of cards does not fill the
 * landmark list. */
export function StatCard({
  label,
  value,
  description,
  icon,
  tone,
  info,
  spark,
  share,
  size = "md",
  loading = false,
  error,
  trend,
  headingLevel = 3,
  locale = "en",
  unmeasured,
  provenance,
  className,
}: StatCardProps) {
  requireLabel(label, "StatCard");
  if (trend) requireLabel(trend.label, "StatCard trend");
  const id = useId();
  const Heading = heading(headingLevel);
  return (
    <section
      className={cx("easm-ui easm-ui-stat-card", className)}
      data-size={size}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-busy={loading || undefined}
    >
      <div className="easm-ui-stat-heading" data-toned={tone && icon ? true : undefined}>
        {tone && icon && <ToneIcon icon={icon} tone={tone} size={size === "lg" ? "lg" : "md"} />}
        <Heading id={`${id}-label`}>{label}</Heading>
        {info && <InfoHint label={`About ${label}`}>{info}</InfoHint>}
        {!tone && icon && <UIIcon name={icon} size={size === "sm" ? 16 : 20} />}
      </div>
      <div className="easm-ui-stat-value">
        {loading ? (
          <Skeleton />
        ) : error ? (
          <MissingValue label="Unavailable" />
        ) : known(value) ? (
          // Keyed by the value: a new figure rises in, an unchanged one (a refresh) stays still.
          <span key={String(value)} className="easm-ui-stat-number">{formatDataValue(value, locale)}</span>
        ) : (
          unmeasured ? <UnmeasuredValue reason={unmeasured} showWord /> : <MissingValue />
        )}
      </div>
      {provenance && known(value) && !loading && !error && (
        <span className="easm-ui-stat-source" data-provenance={provenance}>
          {provenance === "self-reported" ? "Self-reported" : provenance === "provisional" ? "Provisional, may still change" : "External"}
        </span>
      )}
      {spark && spark.length > 1 && !loading && !error && (
        <Sparkline
          className="easm-ui-stat-spark"
          label={`${label} trend`}
          data={spark}
          tone={tone ?? "blue"}
          locale={locale}
        />
      )}
      {error ? (
        <p className="easm-ui-stat-error" role="alert">
          {error}
        </p>
      ) : (
        description && <p>{description}</p>
      )}
      {/* After the description, so every card's description sits at the same height in a row. */}
      {share && typeof value === "number" && share.of > 0 && !loading && !error && (() => {
        const percent = Math.round((value / share.of) * 100);
        return <div className="easm-ui-stat-share" style={{ "--easm-ui-share-tone": `var(--easm-ui-chart-${tone ?? "blue"})`, "--easm-ui-share-ink": `var(--easm-ui-chart-${tone ?? "blue"}-ink)` } as CSSProperties}>
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" className="easm-ui-stat-share-ring">
            <circle cx="10" cy="10" r="7.5" pathLength="100" className="easm-ui-stat-share-track" />
            <circle cx="10" cy="10" r="7.5" pathLength="100" className="easm-ui-stat-share-arc" style={{ strokeDasharray: `${Math.min(100, percent)} 100` }} />
          </svg>
          <span><b>{percent}%</b> {share.label}</span>
        </div>;
      })()}
      {trend && !loading && !error && (
        <div
          className="easm-ui-stat-trend"
          data-sentiment={trend.sentiment || "neutral"}
        >
          <UIIcon
            name={
              trend.direction === "up"
                ? "arrow-up"
                : trend.direction === "down"
                  ? "arrow-down"
                  : "subtract"
            }
            size={16}
          />
          <span>{trend.label}</span>
        </div>
      )}
      <span className="easm-ui-sr-only" role="status">
        {loading ? `Loading ${label}.` : ""}
      </span>
    </section>
  );
}
/** A metered cell: the content over a thin bar of the column's tone, as long as the value's share of the column. */
function meterCell<Row>(column: DataColumn<Row>, row: Row, max: number | undefined, content: ReactNode) {
  if (!column.meter || !column.value || !max) return content;
  const value = column.value(row);
  // Not a number ("—", not applicable): no track at all. Zero or less: the empty track, aligned with its row.
  if (typeof value !== "number" || !Number.isFinite(value)) return content;
  const tone = (typeof column.meter === "object" && column.meter.tone) || "blue";
  return <span className="easm-ui-data-meter" data-empty={value <= 0 || undefined} style={{ "--easm-ui-meter-share": Math.max(0, Math.min(1, value / max)), "--easm-ui-meter-tone": `var(--easm-ui-chart-${tone})` } as CSSProperties}>{content}</span>;
}
/** KPI is an explicit API alias; StatCard is the primary documented component. */
export const KPI = StatCard;

export interface ChartPoint {
  id: string;
  label: string;
  value: number | null;
}
export interface ChartProps {
  title: string;
  data: readonly ChartPoint[];
  kind?: "bar" | "line";
  description?: string;
  valueLabel?: string;
  size?: ComponentSize;
  loading?: boolean;
  error?: string;
  domain?: readonly [number, number];
  /** The level of the title heading, so it fits the page outline. Defaults to 3. */
  headingLevel?: HeadingLevel;
  locale?: string;
  className?: string;
}
/** One series, linear scale, honest zero baseline. Complex charts need a dedicated pattern. */
export function Chart({
  title,
  data: given,
  kind = "bar",
  description,
  valueLabel = "Value",
  size = "md",
  loading = false,
  error,
  domain,
  headingLevel = 3,
  locale = "en",
  className,
}: ChartProps) {
  requireLabel(title, "Chart");
  requireLabel(valueLabel, "Chart value");
  const id = useId();
  const [viewportRef, viewportWidth] = useElementWidth<HTMLDivElement>();
  const [tableRef, tableScrolls] = useOverflowing<HTMLDivElement>();
  if (
    new Set(given.map((p) => p.id)).size !== given.length ||
    given.some((p) => !p.id.trim() || !p.label.trim())
  )
    reportContentProblem("Chart requires unique IDs and meaningful data labels.");
  if (given.some((p) => p.value !== null && !Number.isFinite(p.value)))
    reportContentProblem(
      "Chart values must be finite numbers or null for unknown values.",
    );
  // (In production a non-finite value is drawn as a missing one.)
  const data = given.map((p) =>
    p.value !== null && !Number.isFinite(p.value) ? { ...p, value: null } : p,
  );
  const finite = data
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  // Loops rather than Math.min(...values), which throws on very long series.
  let low = 0,
    high = 0;
  for (const value of finite) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  const domainValid =
    !domain ||
    (Number.isFinite(domain[0]) &&
      Number.isFinite(domain[1]) &&
      domain[1] > domain[0] &&
      domain[0] <= low &&
      domain[1] >= high);
  if (!domainValid)
    reportContentProblem("Chart domain must include zero and every known value.");
  // (In production an invalid domain is ignored and the scale follows the data.)
  const minimum = domain && domainValid ? domain[0] : low,
    maximum = domain && domainValid ? domain[1] : high;
  const max = maximum === minimum ? minimum + 1 : maximum;
  const ticks = [minimum, (minimum + max) / 2, max];
  const left = Math.max(64, ...ticks.map((tick) => formatDataValue(tick, locale).length * 7 + 16));
  const axisLabel = (label: string) => label.length > 12 ? `${label.slice(0, 11)}…` : label;
  let longestLabel = 44;
  if (data.length <= 8)
    for (const point of data)
      longestLabel = Math.max(longestLabel, axisLabel(point.label).length * 7 + 16);
  const categoryWidth = longestLabel;
  const intrinsicWidth = Math.max(360, left + categoryWidth * data.length + 24);
  const canvasWidth = Math.max(intrinsicWidth, viewportWidth);
  const plotWidth = canvasWidth - left - 24;
  // Bars take a share of their own category, so a long series keeps readable bars instead of slivers.
  const barWidth = Math.min(34, (plotWidth / Math.max(1, data.length)) * 0.6);
  const canvasHeight = size === "lg" ? 304 : 224;
  const bottom = canvasHeight - 34;
  const y = (value: number) =>
    bottom - ((value - minimum) / (max - minimum)) * (bottom - 30);
  const x = (index: number) =>
    left + ((index + 0.5) / Math.max(1, data.length)) * plotWidth;
  const segments: string[] = [];
  let segment = "";
  data.forEach((p, index) => {
    if (p.value === null) {
      if (segment) segments.push(segment);
      segment = "";
    } else segment += `${segment ? "L" : "M"}${x(index)} ${y(p.value)} `;
  });
  if (segment) segments.push(segment);
  const unavailable = !finite.length;
  const scrolls = viewportWidth > 0 && canvasWidth > viewportWidth;
  const Heading = heading(headingLevel);
  return (
    <figure
      className={cx("easm-ui easm-ui-chart", className)}
      data-size={size}
      aria-labelledby={`${id}-title`}
      aria-busy={loading || undefined}
    >
      <figcaption>
        <Heading id={`${id}-title`}>{title}</Heading>
        {description && <p>{description}</p>}
      </figcaption>
      {/* Always mounted so resize observation survives loading/error changes. */}
      <div className="easm-ui-chart-measure" ref={viewportRef} aria-hidden="true" />
      {error ? (
        <div className="easm-ui-data-message" role="alert">
          <UIIcon name="error-circle" />
          <p>{error}</p>
        </div>
      ) : loading ? (
        <div className="easm-ui-chart-placeholder">
          <Skeleton shape="rect" />
        </div>
      ) : unavailable ? (
        <div className="easm-ui-data-message">
          <UIIcon name="analytics" />
          <strong>No measured values</strong>
          <p>Values are unavailable for this series.</p>
        </div>
      ) : (
        <>
          <p className="easm-ui-chart-scale">
            {valueLabel} · scale {formatDataValue(minimum, locale)} to{" "}
            {formatDataValue(max, locale)}
            {data.some((p) => p.value === null)
              ? " · missing values appear as gaps"
              : ""}
          </p>
          {scrolls && (
            <p className="easm-ui-chart-scroll-hint" id={`${id}-scroll`}>
              Scroll horizontally to see the full chart, or view its data table.
            </p>
          )}
          <div
            className="easm-ui-chart-viewport"
            // A region and a Tab stop only when the plot is wider than its box.
            {...(scrolls
              ? {
                  role: "region",
                  "aria-label": `${title} plot; scroll horizontally when needed`,
                  "aria-describedby": `${id}-scroll`,
                  tabIndex: 0,
                }
              : {})}
            {...quietPointerFocus()}
          >
            <svg
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              width={canvasWidth}
              height={canvasHeight}
              style={{ width: canvasWidth, height: canvasHeight }}
              aria-hidden="true"
              focusable="false"
            >
              {ticks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={left}
                    x2={canvasWidth - 24}
                    y1={y(tick)}
                    y2={y(tick)}
                    className="easm-ui-chart-grid"
                  />
                  <text x={left - 10} y={y(tick) + 4} textAnchor="end">
                    {formatDataValue(tick, locale)}
                  </text>
                </g>
              ))}
              <line
                x1={left}
                x2={canvasWidth - 24}
                y1={y(0)}
                y2={y(0)}
                className="easm-ui-chart-axis"
              />
              {kind === "bar"
                ? data.map((p, index) =>
                    p.value === null ? null : (
                      <rect
                        key={p.id}
                        x={x(index) - barWidth / 2}
                        y={Math.min(y(p.value), y(0))}
                        width={barWidth}
                        height={Math.abs(y(0) - y(p.value))}
                        rx="2"
                        className="easm-ui-chart-bar"
                      />
                    ),
                  )
                : segments.map((d, i) => (
                    <path key={i} d={d} className="easm-ui-chart-line" />
                  ))}
              {kind === "line" &&
                data.map((p, index) =>
                  p.value === null ? null : (
                    <circle
                      key={p.id}
                      cx={x(index)}
                      cy={y(p.value)}
                      r="3"
                      className="easm-ui-chart-point"
                    />
                  ),
                )}
              {data.map((p, index) => (
                <text key={p.id} x={x(index)} y={canvasHeight - 10} textAnchor="middle">
                  {data.length <= 8
                    ? axisLabel(p.label)
                    : index === 0 || index === data.length - 1
                      ? axisLabel(p.label)
                      : ""}
                </text>
              ))}
            </svg>
          </div>
        </>
      )}
      {!loading && !error && (
        <details className="easm-ui-chart-data">
          <summary>
            <UIIcon name="table" size={16} />
            <span>View data table</span>
            <UIIcon name="chevron-down" size={16} />
          </summary>
          <div
            ref={tableRef}
            className="easm-ui-data-table-scroll"
            {...(tableScrolls
              ? { role: "region", "aria-label": `${title} values`, tabIndex: 0 }
              : {})}
            {...quietPointerFocus()}
          >
            <table>
              <caption className="easm-ui-sr-only">{title} data</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" data-align="end">{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.label}</th>
                    <td data-align="end">
                      {p.value === null ? (
                        <MissingValue />
                      ) : (
                        formatDataValue(p.value, locale)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <span className="easm-ui-sr-only" role="status">
        {loading ? `Loading ${title}.` : ""}
      </span>
    </figure>
  );
}

/* A FilterBar in a table's toolbar is part of the table's card: it drops its own panel and its visible search
   label, so the card shows one even 16px frame and the controls sit on one row with the column headings below.
   In card rows the table's own controls (Sort by, its direction, Select all) ride in the bar too, on the row of
   Reset filters, instead of a row of their own under it (Master Portal → Tenants on a phone, 2026-10-14). The bar
   claims them on mount, so a toolbar without a FilterBar keeps them in the table's control row. */
interface TableToolbarContext {
  trailing: ReactNode;
  claim: (claimed: boolean) => void;
}
const InTableToolbar = createContext<TableToolbarContext | null>(null);
const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

export interface FilterBarProps {
  label: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  children?: ReactNode;
  onReset?: () => void;
  activeCount?: number;
  disabled?: boolean;
  size?: ComponentSize;
  className?: string;
}
export function FilterBar({
  label,
  query,
  onQueryChange,
  children,
  onReset,
  activeCount = 0,
  disabled = false,
  size = "md",
  className,
}: FilterBarProps) {
  requireLabel(label, "FilterBar");
  if (!Number.isInteger(activeCount) || activeCount < 0)
    reportContentProblem("FilterBar active count must be a nonnegative integer.");
  const active = Number.isInteger(activeCount) && activeCount > 0 ? activeCount : 0;
  const toolbar = useContext(InTableToolbar);
  const inToolbar = toolbar !== null;
  const claim = toolbar?.claim;
  useIsoLayoutEffect(() => {
    if (!claim) return;
    claim(true);
    return () => claim(false);
  }, [claim]);
  return (
    <div
      className={cx("easm-ui easm-ui-filter-bar", className)}
      role="group"
      aria-label={label}
      data-size={size}
      data-placement={inToolbar ? "toolbar" : undefined}
    >
      {onQueryChange && (
        <SearchField
          className="easm-ui-filter-search"
          label={`Search ${label}`}
          value={query || ""}
          onValueChange={onQueryChange}
          size={size}
          disabled={disabled}
          hideLabel={inToolbar}
          placeholder="Search records…"
        />
      )}
      {/* The fieldset only carries `disabled` to every filter; the bar's group already names them, so it has
          no legend of its own (one would announce the same name twice). */}
      <fieldset className="easm-ui-filter-controls" disabled={disabled}>
        {children}
      </fieldset>
      {onReset && (
        <Button
          variant="subtle"
          size={size}
          disabled={disabled || (!active && !query)}
          leadingIcon="reset"
          onClick={onReset}
        >
          Reset filters{active ? ` (${active})` : ""}
        </Button>
      )}
      {toolbar?.trailing}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  size?: ComponentSize;
  disabled?: boolean;
  /** Locale for the record counts (1,250). Defaults to "en". */
  locale?: string;
  className?: string;
}
export function Pagination({
  page: givenPage,
  pageSize: givenPageSize,
  total: givenTotal,
  onPageChange,
  label = "Results pagination",
  size = "md",
  disabled = false,
  locale = "en",
  className,
}: PaginationProps) {
  requireLabel(label, "Pagination");
  if (
    !Number.isInteger(givenPage) ||
    !Number.isInteger(givenPageSize) ||
    givenPageSize < 1 ||
    !Number.isInteger(givenTotal) ||
    givenTotal < 0
  )
    reportContentProblem(
      "Pagination requires an integer page, positive page size and nonnegative total.",
    );
  // (In production invalid numbers are rounded into range: page 1, a page size of 1, no records.)
  const page = Number.isFinite(givenPage) ? Math.round(givenPage) : 1,
    pageSize =
      Number.isFinite(givenPageSize) && givenPageSize >= 1
        ? Math.floor(givenPageSize)
        : 1,
    total =
      Number.isFinite(givenTotal) && givenTotal >= 0 ? Math.floor(givenTotal) : 0;
  const pages = Math.ceil(total / pageSize),
    current = Math.min(Math.max(1, page), Math.max(1, pages));
  const start = total ? (current - 1) * pageSize + 1 : 0,
    end = Math.min(current * pageSize, total);
  const number = (value: number) => value.toLocaleString(locale);
  return (
    <nav
      className={cx("easm-ui easm-ui-pagination", className)}
      aria-label={label}
      data-size={size}
    >
      <p>
        {total
          ? `${number(start)}–${number(end)} of ${number(total)} records`
          : "0 records"}
      </p>
      <div className="easm-ui-pagination-controls">
        {/* The first and last page soft-disable Previous and Next (aria-disabled), so pressing Next onto the
            last page keeps focus on the button instead of dropping it to the page. */}
        <Button
          size={size}
          variant="secondary"
          leadingIcon="chevron-left"
          disabled={disabled}
          aria-disabled={!pages || current === 1 || undefined}
          onClick={() => onPageChange(current - 1)}
        >
          Previous
        </Button>
        <span className="easm-ui-pagination-page" aria-live="polite" aria-atomic="true">
          {pages ? `Page ${number(current)} of ${number(pages)}` : "No pages"}
        </span>
        <Button
          size={size}
          variant="secondary"
          trailingIcon="chevron-right"
          disabled={disabled}
          aria-disabled={!pages || current === pages || undefined}
          onClick={() => onPageChange(current + 1)}
        >
          Next
        </Button>
      </div>
      {total > 0 && current !== page && (
        <div className="easm-ui-pagination-stale">
          <p role="status">
            Requested page {page} is unavailable. The valid range above belongs
            to page {current}; update the data query before displaying those
            records.
          </p>
          <Button
            size={size}
            variant="secondary"
            disabled={disabled}
            onClick={() => onPageChange(current)}
          >
            Go to page {current}
          </Button>
        </div>
      )}
    </nav>
  );
}

export type DataStatusState = "ready" | "loading" | "empty" | "error" | "stale";
export interface DataStatusProps {
  state: DataStatusState;
  label?: string;
  description?: string;
  live?: boolean;
  size?: "sm" | "md";
  className?: string;
}
const statusSpec: Record<
  DataStatusState,
  { status: StatusBadgeStatus; label: string }
> = {
  ready: { status: "active", label: "Up to date" },
  loading: { status: "processing", label: "Loading" },
  empty: { status: "inactive", label: "No data" },
  error: { status: "error", label: "Unavailable" },
  stale: { status: "warning", label: "Out of date" },
};
export function DataStatus({
  state,
  label,
  description,
  live = false,
  size = "md",
  className,
}: DataStatusProps) {
  if (!statusSpec[state]) reportContentProblem("Unknown DataStatus state.");
  const spec = statusSpec[state] ?? statusSpec.ready;
  if (label !== undefined) requireLabel(label, "DataStatus");
  return (
    <div
      className={cx("easm-ui easm-ui-data-status", className)}
      role={live ? (state === "error" ? "alert" : "status") : undefined}
    >
      <StatusBadge status={spec.status} size={size}>
        {label || spec.label}
      </StatusBadge>
      {description && <span>{description}</span>}
    </div>
  );
}
