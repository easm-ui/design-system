"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEventHandler,
  type MouseEvent,
} from "react";
import { Icon, type IconName } from "@easm-ui/icons";
import { Button, IconButton } from "./actions";
import { SearchField, TextArea } from "./inputs";
import { Chip, FilterControl } from "./selection";
import { Alert, StatusBadge, Spinner } from "./feedback";
import { ConfirmationDialog } from "./overlays";
import { ModuleIcon } from "./utility";
import { ToneIcon } from "./insights";
import type { ChartTone } from "./palette";
import { cx, reportContentProblem, requireNonBlankText, requireUniqueItemIds } from "./shared";
import { EasmLink } from "./link";
import { EmptyIllustration, type EmptyIllustrationName } from "./illustrations";
export const patternComponentNames = [
  "SearchPattern",
  "FilterPattern",
  "FormPattern",
  "ApprovalPattern",
  "AIActionPattern",
  "NotificationPattern",
  "EmptyState",
] as const;
const requireText = requireNonBlankText,
  requireUniqueIds = requireUniqueItemIds;
type PatternHeadingLevel = 2 | 3 | 4 | 5 | 6;
const headingTag = (level: PatternHeadingLevel) => `h${level}` as "h2" | "h3" | "h4" | "h5" | "h6";
/** When the control the user just activated unmounts (a removed chip, a cleared filter, a read
 * notification), focus falls to the page body. This sends it somewhere sensible inside the pattern
 * instead: set `pending` before the change, and the effect places focus once the control is gone. */
function useRefocusAfterRemoval<T>(
  container: { current: HTMLElement | null },
  place: (intent: T, root: HTMLElement) => HTMLElement | null | undefined,
) {
  const pending = useRef<T | null>(null);
  useLayoutEffect(() => {
    const intent = pending.current, root = container.current;
    if (intent === null || !root) return;
    const active = document.activeElement;
    if (active && active !== document.body) {
      // Still on the control (the change has not arrived yet), or the user has moved on.
      if (!root.contains(active)) pending.current = null;
      return;
    }
    pending.current = null;
    place(intent, root)?.focus();
  });
  return pending;
}

export interface EmptyStateProps {
  title: string;
  /** Supporting text under the title. Optional; when given it must not be blank. */
  description?: string;
  kind?: "empty" | "no-results" | "error" | "restricted";
  action?: ReactNode;
  /** A glyph in place of the kind's default symbol. */
  icon?: IconName;
  /** A small scene in place of the symbol, saying why the place is empty or what it is for on a first run. Not
   *  shown when compact. */
  illustration?: EmptyIllustrationName;
  /** Smaller padding and symbol, for a panel, card or popover. */
  compact?: boolean;
  /** Heading level of the title in the page outline. Defaults to 3. */
  headingLevel?: PatternHeadingLevel;
  className?: string;
}
export function EmptyState({
  title,
  description,
  kind = "empty",
  action,
  icon,
  illustration,
  compact = false,
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  requireText(title, "EmptyState title");
  if (description !== undefined) requireText(description, "EmptyState description");
  const icons: Record<NonNullable<EmptyStateProps["kind"]>, IconName> = {
    empty: "inbox",
    "no-results": "search",
    error: "error-circle",
    restricted: "shield-lock",
  };
  const Title = headingTag(headingLevel);
  return (
    <div className={cx("easm-ui easm-ui-empty-state", className)} data-kind={kind} data-compact={compact || undefined}>
      {illustration && !compact ? <EmptyIllustration name={illustration} size={136} /> : <span className="easm-ui-empty-symbol">
        <Icon name={icon ?? icons[kind]} size={compact ? 24 : 32} tone="inherit" />
      </span>}
      <Title className="easm-ui-empty-title">{title}</Title>
      {description !== undefined && <p className="easm-ui-empty-description">{description}</p>}
      {action && <div className="easm-ui-pattern-actions">{action}</div>}
    </div>
  );
}
export interface SearchResult {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon?: IconName;
}
export interface SearchPatternProps {
  query: string;
  onQueryChange: (value: string) => void;
  results: readonly SearchResult[];
  label?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Shown while the query is blank and there are no results, before anything has been searched.
   * Defaults to nothing; "No matching records" appears only once there is a query. */
  idleContent?: ReactNode;
}
export function SearchPattern({
  query,
  onQueryChange,
  results,
  label = "Search records",
  loading = false,
  error,
  onRetry,
  idleContent,
}: SearchPatternProps) {
  const id = useId();
  requireText(label, "SearchPattern label");
  requireUniqueIds(results, "Search result");
  for (const result of results) {
    requireText(result.label, "Search result label");
    requireText(result.href, "Search result destination");
  }
  const idle = !loading && !error && !results.length && !query.trim();
  const count = `${results.length} ${results.length === 1 ? "result" : "results"}`;
  // One status region stays mounted and only its text changes, so screen readers announce each update.
  const status = loading ? "Searching" : error || idle ? "" : count;
  return (
    <section className="easm-ui easm-ui-search-pattern" aria-label={label}>
      <SearchField
        label={label}
        value={query}
        onValueChange={onQueryChange}
        aria-controls={id}
      />
      <p role="status" className="easm-ui-sr-only">{status}</p>
      <div id={id} aria-busy={loading || undefined}>
        {loading ? (
          <div className="easm-ui-pattern-pending">
            <Spinner label="Searching" aria-hidden="true" />
            <span aria-hidden="true">Searching…</span>
          </div>
        ) : error ? (
          <Alert
            tone="danger"
            title="Search could not finish"
            description={error}
            action={
              onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                  Try again
                </Button>
              )
            }
            live
          />
        ) : idle ? (
          idleContent ?? null
        ) : !results.length ? (
          <EmptyState
            kind="no-results"
            title="No matching records"
            description="Try a different search or remove a filter."
          />
        ) : (
          <>
            <p className="easm-ui-pattern-support" aria-hidden="true">
              {count}
            </p>
            <ul className="easm-ui-pattern-list">
              {results.map((result) => (
                <li key={result.id}>
                  <EasmLink className="easm-ui-pattern-link" href={result.href}>
                    {result.icon && (
                      <Icon name={result.icon} size={20} tone="inherit" />
                    )}
                    <span>
                      <strong>{result.label}</strong>
                      {result.description && (
                        <small>{result.description}</small>
                      )}
                    </span>
                    <Icon name="chevron-right" size={16} tone="inherit" />
                  </EasmLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
export interface FilterPatternProps {
  options: readonly { value: string; label: string; disabled?: boolean }[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  resultCount?: number;
  label?: string;
  disabled?: boolean;
}
export function FilterPattern({
  options,
  value,
  onValueChange,
  resultCount,
  label = "Filter records",
  disabled = false,
}: FilterPatternProps) {
  const known = options.filter((o) => value.includes(o.value));
  // Removing a chip focuses the next chip's remove button (else the previous one, else the filter
  // trigger); Clear filters focuses the trigger.
  const section = useRef<HTMLElement>(null);
  const refocus = useRefocusAfterRemoval<number | "trigger">(section, (intent, root) => {
    const removes = root.querySelectorAll<HTMLButtonElement>(".easm-ui-chip-remove:not(:disabled)");
    return intent !== "trigger" && removes.length
      ? removes[Math.min(intent, removes.length - 1)]
      : root.querySelector<HTMLButtonElement>(".easm-ui-filter-control button");
  });
  requireText(label, "FilterPattern label");
  if (
    resultCount !== undefined &&
    (!Number.isSafeInteger(resultCount) || resultCount < 0)
  )
    reportContentProblem(
      "FilterPattern resultCount must be a nonnegative safe integer.",
    );
  return (
    <section className="easm-ui easm-ui-filter-pattern" aria-label={label} ref={section}>
      <div className="easm-ui-pattern-actions">
        <FilterControl
          label={label}
          options={options.map((option) => ({
            id: option.value,
            label: option.label,
            disabled: option.disabled,
          }))}
          value={[...value]}
          onValueChange={onValueChange}
          disabled={disabled}
        />
        {value.length > 0 && (
          <Button
            variant="subtle"
            disabled={disabled}
            onClick={() => {
              refocus.current = "trigger";
              onValueChange([]);
            }}
          >
            Clear filters
          </Button>
        )}
        {resultCount !== undefined && (
          <span role="status" className="easm-ui-pattern-support">
            {resultCount} matching {resultCount === 1 ? "record" : "records"}
          </span>
        )}
      </div>
      {known.length > 0 && (
        <div className="easm-ui-pattern-actions">
          {known.map((option, index) => (
            <Chip
              key={option.value}
              disabled={disabled}
              selected={!option.disabled}
              onRemove={() => {
                refocus.current = index;
                onValueChange(value.filter((v) => v !== option.value));
              }}
              removeLabel={`Remove ${option.label} filter`}
            >
              {option.label}
              {option.disabled ? " (unavailable)" : ""}
            </Chip>
          ))}
        </div>
      )}
    </section>
  );
}
export interface FormPatternProps {
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  busy?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  errors?: readonly { fieldId: string; message: string }[];
  success?: string;
  label: string;
}
export function FormPattern({
  children,
  onSubmit,
  busy = false,
  submitLabel = "Save changes",
  onCancel,
  errors = [],
  success,
  label,
}: FormPatternProps) {
  const summary = useRef<HTMLDivElement>(null),
    focusedAttempt = useRef(0),
    [attempt, setAttempt] = useState(0),
    id = useId();
  requireText(label, "FormPattern label");
  requireText(submitLabel, "FormPattern submit label");
  for (const error of errors) {
    requireText(error.fieldId, "Form error field identifier");
    requireText(error.message, "Form error message");
    if (/\s/.test(error.fieldId))
      reportContentProblem(
        "Form error field identifiers cannot contain whitespace.",
      );
  }
  const errorSignature = JSON.stringify(errors),
    fieldCount = new Set(errors.map((error) => error.fieldId)).size;
  useEffect(() => {
    if (attempt > focusedAttempt.current && !busy) {
      if (errorSignature !== "[]") {
        summary.current?.focus();
        focusedAttempt.current = attempt;
      } else if (success) focusedAttempt.current = attempt;
    }
  }, [attempt, busy, errorSignature, success]);
  return (
    <form
      className="easm-ui easm-ui-form-pattern"
      aria-label={label}
      noValidate
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setAttempt((value) => value + 1);
        onSubmit(event);
      }}
    >
      {!!errors.length && (
        <div
          className="easm-ui-form-errors"
          ref={summary}
          tabIndex={-1}
          role="alert"
          aria-labelledby={id}
        >
          <strong id={id}>
            Review {fieldCount} {fieldCount === 1 ? "field" : "fields"}
          </strong>
          <ul>
            {errors.map((error, index) => (
              <li key={`${error.fieldId}-${index}`}>
                <a
                  href={`#${error.fieldId}`}
                  onClick={(event) => {
                    const field = document.getElementById(error.fieldId);
                    if (field instanceof HTMLElement) {
                      event.preventDefault();
                      field.focus();
                    }
                  }}
                >
                  {error.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={busy}>{children}</fieldset>
      {success && !errors.length && (
        <Alert tone="success" title={success} live />
      )}
      <div className="easm-ui-pattern-actions">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
export interface ApprovalPatternProps {
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  onDecision: (
    decision: "approved" | "rejected",
    comment: string,
  ) => void | Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  /** Heading level of the title in the page outline. Defaults to 3. */
  headingLevel?: PatternHeadingLevel;
}
export function ApprovalPattern({
  title,
  description,
  status,
  onDecision,
  busy = false,
  disabled = false,
  headingLevel = 3,
}: ApprovalPatternProps) {
  const [comment, setComment] = useState(""),
    [confirm, setConfirm] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [decisionError, setDecisionError] = useState("");
  const deciding = useRef(false),
    decisionFocus = useRef(false),
    section = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    rejectTrigger = useRef<HTMLButtonElement>(null),
    restoreFocus = useRef<HTMLElement | null>(null),
    pending = busy || submitting,
    blocked = pending || disabled || status !== "pending";
  requireText(title, "ApprovalPattern title");
  requireText(description, "ApprovalPattern description");
  const Title = headingTag(headingLevel);
  useLayoutEffect(() => {
    restoreFocus.current =
      status === "pending" && !disabled
        ? rejectTrigger.current
        : heading.current;
    if (status !== "pending" && decisionFocus.current) {
      decisionFocus.current = false;
      const active = document.activeElement;
      if (active === document.body || section.current?.contains(active))
        heading.current?.focus();
    } else if (status === "pending" && !submitting)
      decisionFocus.current = false;
  }, [status, disabled, submitting]);
  useEffect(() => {
    if (status !== "pending" || disabled) setConfirm(false);
    if (status !== "pending") {
      setComment("");
      setDecisionError("");
    }
  }, [status, disabled]);
  const decide = async (decision: "approved" | "rejected") => {
    const reason = comment.trim();
    if (blocked || deciding.current || (decision === "rejected" && !reason))
      return;
    deciding.current = true;
    decisionFocus.current = true;
    setSubmitting(true);
    setDecisionError("");
    try {
      await onDecision(decision, reason);
      setConfirm(false);
    } catch (error) {
      decisionFocus.current = false;
      setDecisionError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "The decision could not be recorded. Try again.",
      );
      setConfirm(false);
    } finally {
      deciding.current = false;
      setSubmitting(false);
    }
  };
  return (
    <section
      className="easm-ui easm-ui-approval-pattern"
      ref={section}
      aria-label={title}
    >
      <div className="easm-ui-pattern-heading">
        <Title ref={heading} tabIndex={-1} className="easm-ui-pattern-title">
          {title}
        </Title>
        <StatusBadge
          role="status"
          status={
            status === "pending"
              ? "pending"
              : status === "approved"
                ? "success"
                : "error"
          }
        >
          {status === "pending"
            ? "Awaiting review"
            : status === "approved"
              ? "Approved"
              : "Rejected"}
        </StatusBadge>
      </div>
      <p>{description}</p>
      {status === "pending" && (
        <>
          <TextArea
            label="Review comment"
            description="A reason is required when rejecting. Maximum 500 characters."
            maxLength={500}
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 500))}
            disabled={pending || disabled}
          />
          {decisionError && (
            <Alert
              tone="danger"
              title="Decision could not be recorded"
              description={decisionError}
              live
            />
          )}
          <div className="easm-ui-pattern-actions">
            <Button
              leadingIcon="review-approve"
              loading={pending}
              disabled={disabled}
              onClick={() => {
                void decide("approved");
              }}
            >
              Approve request
            </Button>
            <ConfirmationDialog
              title="Reject this request?"
              description="The recorded reason will accompany this decision."
              open={confirm}
              onOpenChange={setConfirm}
              destructive
              confirmLabel="Reject request"
              loading={pending}
              restoreFocusRef={restoreFocus}
              trigger={
                <Button
                  ref={rejectTrigger}
                  variant="secondary"
                  leadingIcon="review-reject"
                  disabled={blocked || !comment.trim()}
                >
                  Reject request
                </Button>
              }
              onConfirm={() => {
                void decide("rejected");
              }}
            >
              <p>{comment.trim()}</p>
            </ConfirmationDialog>
          </div>
        </>
      )}
    </section>
  );
}
export interface AIActionPatternProps {
  title: string;
  description: string;
  onRun: (signal: AbortSignal) => Promise<string>;
  onApply?: (result: string) => void;
  disabled?: boolean;
  runLabel?: string;
  /** Heading level of the title in the page outline. Defaults to 3. */
  headingLevel?: PatternHeadingLevel;
}
export function AIActionPattern({
  title,
  description,
  onRun,
  onApply,
  disabled = false,
  runLabel = "Generate draft",
  headingLevel = 3,
}: AIActionPatternProps) {
  const [state, setState] = useState<
      "idle" | "pending" | "success" | "error" | "cancelled"
    >("idle"),
    [result, setResult] = useState(""),
    [error, setError] = useState("");
  const operation = useRef(0),
    controller = useRef<AbortController | null>(null),
    running = useRef(false);
  useEffect(
    () => () => {
      operation.current++;
      controller.current?.abort();
    },
    [],
  );
  requireText(title, "AIActionPattern title");
  requireText(description, "AIActionPattern description");
  requireText(runLabel, "AIActionPattern run label");
  const Title = headingTag(headingLevel);
  // One status region stays mounted and only its text changes, so each step is announced.
  const status =
    state === "pending"
      ? "Generating a draft. You can cancel while it is pending."
      : state === "cancelled"
        ? "Generation cancelled."
        : state === "success"
          ? "Draft ready for review"
          : "";
  const cancel = () => {
    operation.current++;
    controller.current?.abort();
    running.current = false;
    setState("cancelled");
  };
  const run = async () => {
    if (disabled || running.current) return;
    running.current = true;
    const generation = ++operation.current;
    controller.current = new AbortController();
    setState("pending");
    setError("");
    setResult("");
    try {
      const output = await onRun(controller.current.signal);
      if (operation.current !== generation) return;
      if (!output.trim()) throw new Error("No draft was returned. Try again.");
      setResult(output);
      setState("success");
    } catch (reason) {
      if (operation.current !== generation) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "The draft could not be generated. Try again.",
      );
      setState("error");
    } finally {
      if (operation.current === generation) running.current = false;
    }
  };
  return (
    <section className="easm-ui easm-ui-ai-action" aria-label={title}>
      <div className="easm-ui-pattern-heading">
        <ModuleIcon icon="easm-one" tone="signature" label="EASM One" />
        <div>
          <Title className="easm-ui-pattern-title">{title}</Title>
          <p>{description}</p>
        </div>
      </div>
      <div className="easm-ui-pattern-actions">
        <Button
          leadingIcon="ai-agent"
          onClick={run}
          disabled={disabled}
          loading={state === "pending"}
        >
          {runLabel}
        </Button>
        {state === "pending" && (
          <Button variant="secondary" onClick={cancel}>
            Cancel generation
          </Button>
        )}
      </div>
      <p role="status" className="easm-ui-sr-only">{status}</p>
      {(state === "pending" || state === "cancelled") && (
        <p className="easm-ui-pattern-support" aria-hidden="true">
          {status}
        </p>
      )}
      {state === "error" && (
        <Alert
          title="Generation failed"
          description={error}
          tone="danger"
          live
        />
      )}
      {state === "success" && (
        <div className="easm-ui-ai-result">
          <p aria-hidden="true">{status}</p>
          <div className="easm-ui-ai-result-copy">{result}</div>
          <p className="easm-ui-pattern-support">
            Review the draft and its sources before applying it.
          </p>
          {onApply && (
            <Button
              variant="secondary"
              disabled={disabled}
              leadingIcon="check"
              onClick={() => onApply(result)}
            >
              Use reviewed draft
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
export type NotificationPriority = "urgent" | "high" | "normal" | "low";
export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  time: string;
  unread: boolean;
  icon?: IconName;
  /** Orders the list and tints the icon tile: urgent (coral) and high (amber) unread items come first under "Needs attention". Defaults to normal. */
  priority?: NotificationPriority;
}
const notificationPriority: Record<NotificationPriority, { rank: number; tone?: ChartTone; icon: IconName; word?: string }> = {
  urgent: { rank: 0, tone: "coral", icon: "error-circle", word: "Urgent" },
  high: { rank: 1, tone: "amber", icon: "warning", word: "Needs attention" },
  normal: { rank: 2, tone: "blue", icon: "notification" },
  low: { rank: 3, icon: "info" },
};
export interface NotificationPatternProps {
  items: readonly NotificationItem[];
  onRead: (id: string) => void;
  /** Shows "Mark all read" while anything is unread. */
  onReadAll?: () => void;
  label?: string;
  /** "card" is a white card of its own; "plain" has no surface or padding, for a Popover, Drawer or panel. */
  appearance?: "card" | "plain";
  /** Heading level of the label; the group headings sit one level below. Defaults to 3. */
  headingLevel?: PatternHeadingLevel;
  /** Opens what an item is about (its page). The whole item is then the target; its Read more and Mark read
   * buttons keep their own actions. */
  onOpen?: (id: string) => void;
}

/**
 * A notification's words: the title, then the description held to two lines with a Read more that opens it in
 * place when there is more (a long message filled the panel and the items ran together, 2026-10-14).
 */
function NotificationText({ item, word, onOpen }: { item: NotificationItem; word?: string; onOpen?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);
  const descriptionId = useId();
  useLayoutEffect(() => {
    const node = text.current;
    if (!node || expanded) return;
    const measure = () => setClamped(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [item.description, expanded]);
  return (
    <div className="easm-ui-notification-text">
      {onOpen ? (
        <button type="button" className="easm-ui-notification-open" onClick={() => onOpen(item.id)}>
          <strong>{item.title}</strong>
        </button>
      ) : (
        <strong>{item.title}</strong>
      )}
      {item.description && (
        <p ref={text} id={descriptionId} data-expanded={expanded || undefined}>
          {item.description}
        </p>
      )}
      {item.description && (clamped || expanded) && (
        <button type="button" className="easm-ui-notification-more" aria-expanded={expanded} aria-controls={descriptionId} onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
      <small>
        {item.time}
        {item.unread && word ? <span className="easm-ui-notification-priority"> · {word}</span> : null}
        {item.unread ? <span className="easm-ui-sr-only">, unread</span> : null}
      </small>
    </div>
  );
}

/** A notification list ordered by priority: unread urgent and high items under "Needs attention", other unread under "New", read items under "Earlier". */
export function NotificationPattern({
  items,
  onRead,
  onReadAll,
  label = "Notifications",
  appearance = "card",
  headingLevel = 3,
  onOpen,
}: NotificationPatternProps) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Mark read focuses the next unread item's button (else the previous one, else the heading);
  // Mark all read focuses the heading.
  const section = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const refocus = useRefocusAfterRemoval<number | "heading">(section, (intent, root) => {
    const buttons = root.querySelectorAll<HTMLButtonElement>(".easm-ui-notification-read");
    return intent !== "heading" && buttons.length ? buttons[Math.min(intent, buttons.length - 1)] : heading.current;
  });
  const markRead = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    const buttons = Array.from(section.current?.querySelectorAll(".easm-ui-notification-read") ?? []);
    refocus.current = Math.max(0, buttons.indexOf(event.currentTarget));
    onRead(id);
  };
  const Title = headingTag(headingLevel),
    GroupTitle = headingTag(Math.min(6, headingLevel + 1) as PatternHeadingLevel);
  requireText(label, "NotificationPattern label");
  requireUniqueIds(items, "Notification");
  for (const item of items) {
    requireText(item.title, "Notification title");
    requireText(item.time, "Notification time");
  }
  const rank = (item: NotificationItem) => notificationPriority[item.priority ?? "normal"].rank;
  const unread = items.filter((i) => i.unread).length;
  const byRank = (list: NotificationItem[]) => list.map((item, i) => [item, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([item]) => item);
  const groups = [
    { id: "attention", title: "Needs attention", items: byRank(items.filter((i) => i.unread && rank(i) <= 1)) },
    { id: "new", title: "New", items: byRank(items.filter((i) => i.unread && rank(i) > 1)) },
    { id: "earlier", title: "Earlier", items: unreadOnly ? [] : items.filter((i) => !i.unread) },
  ].filter((g) => g.items.length);
  const titled = groups.length > 1;
  const headingId = useId();
  return (
    <section
      ref={section}
      className="easm-ui easm-ui-notification-pattern"
      data-appearance={appearance}
      aria-labelledby={headingId}
    >
      <div className="easm-ui-notification-head">
        <Title id={headingId} ref={heading} tabIndex={-1} className="easm-ui-notification-title">{label}</Title>
        {unread > 0 && <span className="easm-ui-notification-new">{unread} new</span>}
        {onReadAll && unread > 0 && (
          <Button variant="subtle" size="sm" leadingIcon="check" className="easm-ui-notification-read-all" onClick={() => { refocus.current = "heading"; onReadAll(); }}>
            Mark all read
          </Button>
        )}
      </div>
      <div className="easm-ui-notification-filter" role="group" aria-label="Show">
        <Button variant="subtle" size="sm" selected={!unreadOnly} onClick={() => setUnreadOnly(false)}>
          All
        </Button>
        <Button variant="subtle" size="sm" selected={unreadOnly} onClick={() => setUnreadOnly(true)}>
          Unread ({unread})
        </Button>
      </div>
      {!groups.length ? (
        <EmptyState
          title={unreadOnly ? "You are caught up" : "No notifications yet"}
          description={
            unreadOnly
              ? "There are no unread updates."
              : "Updates that need your attention will appear here."
          }
        />
      ) : (
        groups.map((group) => (
          <div key={group.id} className="easm-ui-notification-group" role="group" aria-labelledby={titled ? `${headingId}-${group.id}` : undefined} aria-label={titled ? undefined : group.title}>
            {titled && <GroupTitle id={`${headingId}-${group.id}`} className="easm-ui-notification-group-title">{group.title}</GroupTitle>}
            <ul className="easm-ui-notification-list">
              {group.items.map((item) => {
                const p = notificationPriority[item.priority ?? "normal"];
                return (
                  <li key={item.id} className="easm-ui-notification-item" data-unread={item.unread} data-priority={item.priority ?? "normal"} data-openable={onOpen ? true : undefined}>
                    <ToneIcon icon={item.icon ?? p.icon} tone={p.tone} size="sm" />
                    <NotificationText item={item} word={p.word} onOpen={onOpen} />
                    {item.unread ? (
                      <IconButton icon="check" label={`Mark ${item.title} as read`} variant="subtle" size="sm" className="easm-ui-notification-read" onClick={(event) => markRead(item.id, event)} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
