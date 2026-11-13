import { useEffect, useRef, useState } from "react";
import {
  SearchPattern,
  FilterPattern,
  FormPattern,
  ApprovalPattern,
  AIActionPattern,
  NotificationPattern,
  EmptyState,
  type NotificationItem,
  type SearchResult,
} from "../../../src/patterns";
import { TextField, Select } from "../../../src/inputs";
import { Button } from "../../../src/actions";
import { LibraryExample, ModuleIntro } from "../shared";
import registry from "./specs.json";
const allResults: SearchResult[] = [
  {
    id: "admissions",
    label: "Admissions handbook",
    description: "Example knowledge source",
    href: "foundations.html",
    icon: "knowledge",
  },
  {
    id: "support",
    label: "Support workspace",
    description: "Example navigation destination",
    href: "navigation.html",
    icon: "inbox",
  },
  {
    id: "agent",
    label: "Agent activity",
    description: "Example analytics component",
    href: "data.html",
    icon: "analytics",
  },
];
const filterRecords = [
  "support",
  "support",
  "support",
  "knowledge",
  "knowledge",
  "knowledge",
  "knowledge",
  "marketing",
  "marketing",
];
const initialNotifications: NotificationItem[] = [
  {
    id: "review",
    title: "Request needs review",
    description: "Example approval request for a knowledge source.",
    time: "Example · just now",
    unread: true,
    icon: "review-approve",
  },
  {
    id: "source",
    title: "Source is ready",
    description: "Example knowledge source can now be searched.",
    time: "Example · 10 minutes ago",
    unread: true,
    icon: "knowledge",
  },
  {
    id: "assignment",
    title: "Assignment updated",
    time: "Example · earlier",
    unread: false,
    icon: "user",
  },
];
const specs = registry.components;
const Example = (
  props: Omit<Parameters<typeof LibraryExample>[0], "specs">,
) => <LibraryExample {...props} specs={specs} />;
export default function PatternsModuleDemo() {
  const [query, setQuery] = useState(""),
    [searchState, setSearchState] = useState("ready"),
    [filters, setFilters] = useState<string[]>(["support"]);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [submitted, setSubmitted] = useState(false),
    [saved, setSaved] = useState(false),
    [approval, setApproval] = useState<"pending" | "approved" | "rejected">(
      "pending",
    ),
    [reason, setReason] = useState("");
  const [notifications, setNotifications] = useState(initialNotifications),
    [emptyKind, setEmptyKind] = useState<
      "empty" | "no-results" | "error" | "restricted"
    >("empty"),
    [applied, setApplied] = useState(""),
    [exampleSource, setExampleSource] = useState(false);
  const pending = useRef<{
      resolve: (value: string) => void;
      reject: (reason: Error) => void;
      signal: AbortSignal;
    } | null>(null),
    [waiting, setWaiting] = useState(false);
  useEffect(
    () => () => {
      pending.current?.reject(new Error("Example closed"));
      pending.current = null;
    },
    [],
  );
  const runExample = (signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject, signal };
      setWaiting(true);
      signal.addEventListener(
        "abort",
        () => {
          if (pending.current?.signal === signal) {
            pending.current = null;
            setWaiting(false);
          }
          reject(new Error("Cancelled"));
        },
        { once: true },
      );
    });
  const finishExample = (fail = false) => {
    const operation = pending.current;
    if (!operation) return;
    pending.current = null;
    setWaiting(false);
    if (fail)
      operation.reject(
        new Error("The local example returned an error. Retry generation."),
      );
    else
      operation.resolve(
        "Example draft: Thank you for contacting the support team. Please share your reference number so the assigned agent can review your request.",
      );
  };
  const errors = submitted
    ? [
        ...(!name.trim()
          ? [{ fieldId: "example-name", message: "Enter the contact name." }]
          : []),
        ...(!/^\S+@\S+\.\S+$/.test(email)
          ? [
              {
                fieldId: "example-email",
                message: "Enter an email address such as name@example.edu.",
              },
            ]
          : []),
      ]
    : [];
  const results = allResults.filter((item) =>
    (item.label + " " + item.description)
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <div className="ds-experience-module">
      <ModuleIntro
        layer={6}
        title="Interaction Patterns"
        description="Complete reusable flows built from the core library. Search, review, forms and AI actions make status and next steps explicit."
        specs={specs}
      />
      <Example
        name="SearchPattern"
        description="Queries filter this small local collection. Loading and error controls let you inspect caller-provided states."
      >
        <Select
          label="Search preview state"
          value={searchState}
          onValueChange={setSearchState}
          options={["ready", "loading", "error"].map((value) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
          }))}
        />
        <SearchPattern
          query={query}
          onQueryChange={setQuery}
          results={results}
          loading={searchState === "loading"}
          error={
            searchState === "error"
              ? "The example source is unavailable. Try again to restore these local records."
              : undefined
          }
          onRetry={() => setSearchState("ready")}
        />
      </Example>
      <Example
        name="FilterPattern"
        description="Choose filters, inspect selected chips and remove one independently. This example displays a matching count derived from the local selection."
      >
        <FilterPattern
          options={[
            { value: "support", label: "Support" },
            { value: "knowledge", label: "Knowledge" },
            { value: "marketing", label: "Marketing" },
            {
              value: "restricted",
              label: "Restricted example",
              disabled: true,
            },
          ]}
          value={filters}
          onValueChange={setFilters}
          resultCount={
            filterRecords.filter(
              (team) => !filters.length || filters.includes(team),
            ).length
          }
        />
      </Example>
      <Example
        name="FormPattern"
        description="Submit an empty form to inspect inline errors and its focusable error summary. Valid example data saves only to local page state."
      >
        <FormPattern
          label="Example contact form"
          submitLabel="Save example contact"
          errors={errors}
          success={saved ? "Example contact saved on this page." : undefined}
          onCancel={() => {
            setName("");
            setEmail("");
            setSubmitted(false);
            setSaved(false);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            setSaved(!!name.trim() && /^\S+@\S+\.\S+$/.test(email));
          }}
        >
          <TextField
            id="example-name"
            label="Contact name"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            error={
              submitted && !name.trim() ? "Enter the contact name." : undefined
            }
          />
          <TextField
            id="example-email"
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSaved(false);
            }}
            error={
              submitted && !/^\S+@\S+\.\S+$/.test(email)
                ? "Enter an email address such as name@example.edu."
                : undefined
            }
          />
        </FormPattern>
      </Example>
      <Example
        name="ApprovalPattern"
        description="Approve directly or add a reason and confirm a rejection. Business permissions and persisted decisions belong to the application."
      >
        <ApprovalPattern
          title="Review example source"
          description="Admissions handbook · example request"
          status={approval}
          onDecision={(decision, comment) => {
            setApproval(decision);
            setReason(comment);
          }}
        />
        <p className="ds-example-note" role="status">
          Example decision: {approval}
          {reason ? ` · ${reason}` : ""}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={approval === "pending"}
          onClick={() => {
            setApproval("pending");
            setReason("");
          }}
        >
          Reset example review
        </Button>
      </Example>
      <Example
        name="AIActionPattern"
        title="AI action with review"
        description="A cancellable async operation with explicit review. This manual demo does not call an AI service or invent a processing duration."
      >
        <div className="ds-demo-ai-action-slot">
          <AIActionPattern
            title="Draft a support reply"
            description="Generate, inspect and apply a reviewed draft."
            onRun={runExample}
            onApply={setApplied}
          />
        </div>
        <div
          className="ds-demo-process"
          role="group"
          aria-label="Manual example controls"
        >
          <p role="status">
            {waiting
              ? "This example is waiting for your manual completion action."
              : "Generate a draft to enable these manual example controls."}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={!waiting}
            onClick={() => finishExample()}
          >
            Complete example generation
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!waiting}
            onClick={() => finishExample(true)}
          >
            Return example error
          </Button>
        </div>
        <p className="ds-example-note" role="status">
          {applied
            ? "Reviewed draft applied to this local example."
            : "No reviewed draft has been applied to the local example."}
        </p>
      </Example>
      <Example
        name="NotificationPattern"
        description="Filter unread updates and mark one as read. Full text accompanies the visual indicator."
      >
        <NotificationPattern
          items={notifications}
          onRead={(id) =>
            setNotifications((items) =>
              items.map((item) =>
                item.id === id ? { ...item, unread: false } : item,
              ),
            )
          }
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setNotifications(initialNotifications)}
        >
          Reset example notifications
        </Button>
      </Example>
      <Example
        name="EmptyState"
        description="Distinct states explain whether a collection is new, filtered, unavailable or restricted."
      >
        <Select
          label="Empty state kind"
          value={emptyKind}
          onValueChange={(value) => {
            setEmptyKind(value as typeof emptyKind);
            setExampleSource(false);
          }}
          options={["empty", "no-results", "error", "restricted"].map(
            (value) => ({
              value,
              label: value
                .replace("-", " ")
                .replace(/^./, (s) => s.toUpperCase()),
            }),
          )}
        />
        <div className="ds-demo-empty-state-slot">
          {exampleSource ? (
            <div className="ds-demo-process">
              <p role="status">Example source added to this local preview.</p>
              <Button
                variant="secondary"
                onClick={() => setExampleSource(false)}
              >
                Reset empty collection
              </Button>
            </div>
          ) : (
            <EmptyState
              kind={emptyKind}
              title={
                emptyKind === "empty"
                  ? "No sources yet"
                  : emptyKind === "no-results"
                    ? "No matching sources"
                    : emptyKind === "error"
                      ? "Sources could not load"
                      : "Access is restricted"
              }
              description={
                emptyKind === "empty"
                  ? "Add your first source to begin organizing knowledge."
                  : emptyKind === "no-results"
                    ? "Try another query or remove a filter."
                    : emptyKind === "error"
                      ? "Check the source connection and try again."
                      : "Contact a workspace administrator if you need access."
              }
              action={
                emptyKind === "restricted" ? undefined : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (emptyKind === "empty") setExampleSource(true);
                      else setEmptyKind("empty");
                    }}
                  >
                    {emptyKind === "error"
                      ? "Try example again"
                      : emptyKind === "no-results"
                        ? "Clear example filters"
                        : "Add example source"}
                  </Button>
                )
              }
            />
          )}
        </div>
      </Example>
    </div>
  );
}
