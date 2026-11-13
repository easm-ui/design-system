import { useMemo, useState } from "react";
import {
  DataTable,
  StatCard,
  Chart,
  FilterBar,
  Pagination,
  DataStatus,
  type DataColumn,
  type DataStatusState,
} from "../../../src/data-display";
import { Button } from "../../../src/actions";
import { Select } from "../../../src/inputs";
import { StatusBadge } from "../../../src/feedback";
import specs from "./specs.json";
import { LibraryExample, ModuleIntro } from "../shared";
import "./demo.css";

type RecordRow = {
  id: string;
  name: string;
  team: string;
  conversations: number | null;
  status: "active" | "pending" | "inactive";
};
const records: RecordRow[] = [
  {
    id: "EASM-001",
    name: "Aisha Khan",
    team: "Support",
    conversations: 46,
    status: "active",
  },
  {
    id: "EASM-002",
    name: "Omar Ali",
    team: "Knowledge",
    conversations: 31,
    status: "active",
  },
  {
    id: "EASM-003",
    name: "Sara Ahmed",
    team: "Support",
    conversations: 0,
    status: "pending",
  },
  {
    id: "EASM-004",
    name: "Nadia Siddiqui",
    team: "Marketing",
    conversations: null,
    status: "inactive",
  },
  {
    id: "EASM-005",
    name: "Hassan Farooq",
    team: "Support",
    conversations: 12,
    status: "active",
  },
  {
    id: "EASM-006",
    name: "Example user with a deliberately long name to inspect content wrapping",
    team: "Knowledge",
    conversations: 19,
    status: "pending",
  },
];
const columns: DataColumn<RecordRow>[] = [
  {
    id: "name",
    label: "Agent",
    value: (row) => row.name,
    sortable: true,
    width: "wide",
  },
  { id: "team", label: "Team", value: (row) => row.team, sortable: true },
  {
    id: "conversations",
    label: "Conversations",
    value: (row) => row.conversations,
    sortable: true,
    align: "end",
    width: "compact",
  },
  {
    id: "status",
    label: "Status",
    value: (row) => row.status,
    render: (row) => <StatusBadge status={row.status} size="sm" />,
    width: "compact",
  },
];
const daily = [
  { id: "mon", label: "Mon", value: 36 },
  { id: "tue", label: "Tue", value: 42 },
  { id: "wed", label: "Wed", value: null },
  { id: "thu", label: "Thu", value: 30 },
  { id: "fri", label: "Fri", value: 48 },
  { id: "sat", label: "Sat", value: 21 },
];
const partLabel = (s: string) =>
  s.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
function Example({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <LibraryExample
      name={name}
      title={name === "StatCard" ? "KPI & stat cards" : undefined}
      description={description}
      specs={specs.components}
    >
      {children}
    </LibraryExample>
  );
}
export default function DataModuleDemo() {
  const [query, setQuery] = useState(""),
    [team, setTeam] = useState("all");
  const [tableState, setTableState] = useState("data");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [chartKind, setChartKind] = useState<"bar" | "line">("bar");
  const [chartState, setChartState] = useState("data");
  const [metricLoading, setMetricLoading] = useState(false);
  const [page, setPage] = useState(1),
    [total, setTotal] = useState(23);
  const [status, setStatus] = useState<DataStatusState>("ready");
  const filtered = useMemo(
    () =>
      records.filter(
        (row) =>
          (team === "all" || row.team === team) &&
          `${row.name} ${row.team} ${row.id}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, team],
  );
  const reset = () => {
    setQuery("");
    setTeam("all");
  };
  return (
    <div className="ds-data-module">
      <ModuleIntro
        layer={5}
        title="Data & Analytics Components"
        description="Clear records, trustworthy metrics and readable trends. Reusable data components with honest empty, loading and unavailable states."
        specs={[
          "FilterBar",
          "DataTable",
          "StatCard",
          "Chart",
          "Pagination",
          "DataStatus",
        ].map((name) => specs.components.find((item) => item.name === name)!)}
      />
      <Example
        name="FilterBar"
        description="Search and filter the agent table below; reset keeps the control group predictable."
      >
        <FilterBar
          label="Example agents"
          query={query}
          onQueryChange={setQuery}
          activeCount={team === "all" ? 0 : 1}
          onReset={reset}
        >
          <Select
            label="Team"
            value={team}
            onValueChange={setTeam}
            options={[
              { value: "all", label: "All teams" },
              ...["Support", "Knowledge", "Marketing"].map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
        </FilterBar>
        <p className="ds-data-note" role="status">
          {filtered.length} matching example records
        </p>
      </Example>
      <Example
        name="DataTable"
        description="Sort columns, select available rows and inspect long content. The inactive row cannot be selected."
      >
        <div className="ds-data-example-controls">
          <Select
            label="Table preview state"
            value={tableState}
            onValueChange={setTableState}
            options={["data", "empty", "loading", "error", "disabled"].map(
              (value) => ({ value, label: partLabel(value) }),
            )}
          />
          <span role="status" className="ds-demo-selection-status">
            {selected.length} selected keys retained
          </span>
        </div>
        <DataTable
          label="Example agent records"
          rows={tableState === "empty" ? [] : filtered}
          columns={columns}
          rowKey={(row) => row.id}
          rowLabel={(row) => row.name}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          isRowDisabled={(row) => row.status === "inactive"}
          loading={tableState === "loading"}
          disabled={tableState === "disabled"}
          error={
            tableState === "error"
              ? "Example source error. Choose Data to inspect the current records."
              : undefined
          }
          onRetry={() => setTableState("data")}
          emptyTitle="No matching agents"
          emptyDescription="Try another team or clear the search query."
        />
      </Example>
      <Example
        name="StatCard"
        description="A measured zero stays zero. An unavailable metric stays unknown. Trend direction does not decide whether a change is good."
      >
        <Button
          variant="secondary"
          size="sm"
          selected={metricLoading}
          onClick={() => setMetricLoading((value) => !value)}
        >
          Toggle loading preview
        </Button>
        <div className="ds-data-stat-grid">
          <StatCard
            label="Conversations handled"
            value={148}
            description="Example series · last 7 days"
            icon="chat"
            loading={metricLoading}
            trend={{
              direction: "up",
              sentiment: "positive",
              label: "12% more than the previous example period",
            }}
          />
          <StatCard
            label="Pending conversations"
            value={0}
            description="Measured zero in this example"
            icon="inbox"
            loading={metricLoading}
          />
          <StatCard
            label="Resolution rate"
            value={null}
            description="Unavailable in this example source"
            icon="analytics"
            loading={metricLoading}
          />
        </div>
      </Example>
      <Example
        name="Chart"
        description="One series, an honest zero baseline and an expandable table of full labels and values. Wednesday is unknown rather than zero."
      >
        <div className="ds-data-example-controls">
          <Select
            label="Chart type"
            value={chartKind}
            onValueChange={(value) => setChartKind(value as "bar" | "line")}
            options={[
              { value: "bar", label: "Bar" },
              { value: "line", label: "Line" },
            ]}
          />
          <Select
            label="Chart preview state"
            value={chartState}
            onValueChange={setChartState}
            options={["data", "empty", "loading", "error"].map((value) => ({
              value,
              label: partLabel(value),
            }))}
          />
        </div>
        <Chart
          title="Example daily conversations"
          description="Local example series · Monday to Saturday"
          data={chartState === "empty" ? [] : daily}
          kind={chartKind}
          valueLabel="Conversations"
          loading={chartState === "loading"}
          error={
            chartState === "error"
              ? "The example source is unavailable. Choose Data to restore this preview."
              : undefined
          }
        />
      </Example>
      <Example
        name="Pagination"
        description="Page ranges require a known total. Try an empty result or request an unavailable page; recovery is an explicit action."
      >
        <div className="ds-data-example-controls">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTotal(total ? 0 : 23);
              setPage(1);
            }}
          >
            <span className="ds-demo-stable-label">
              <span aria-hidden="true">Restore example records</span>
              <span>
                {total ? "Preview zero records" : "Restore example records"}
              </span>
            </span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTotal(23);
              setPage(99);
            }}
          >
            Request page 99
          </Button>
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={5}
          onPageChange={setPage}
        />
        <p className="ds-data-note">
          This standalone control previews pagination bounds. The example table
          above is a complete local collection.
        </p>
      </Example>
      <Example
        name="DataStatus"
        description="Freshness and availability are distinct from the business outcome of a record."
      >
        <Select
          label="Data status"
          value={status}
          onValueChange={(value) => setStatus(value as DataStatusState)}
          options={["ready", "loading", "empty", "error", "stale"].map(
            (value) => ({ value, label: partLabel(value) }),
          )}
        />
        <DataStatus
          state={status}
          live
          description={
            status === "ready"
              ? "This example source is available."
              : status === "stale"
                ? "This example source requires refresh."
                : "Preview state supplied by the local control."
          }
        />
      </Example>
    </div>
  );
}
