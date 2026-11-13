import { useState } from "react";
import {
  Sidebar,
  TopHeader,
  Breadcrumbs,
  CommandBar,
  WorkspaceSwitcher,
  ButtonLink,
  type NavigationItem,
} from "../../../src/navigation";
import { Button } from "../../../src/actions";
import { UserChip } from "../../../src/utility";
import { LibraryExample, ModuleIntro } from "../shared";
import registry from "./specs.json";
const items: NavigationItem[] = [
  { id: "inbox", label: "Inbox", href: "#Sidebar", icon: "inbox", badge: 12 },
  { id: "knowledge", label: "Knowledge", href: "#Sidebar", icon: "knowledge" },
  { id: "reports", label: "Reports", href: "#Sidebar", icon: "analytics" },
  { id: "settings", label: "Settings", href: "#Sidebar", icon: "settings" },
  {
    id: "restricted",
    label: "Restricted example",
    href: "#Sidebar",
    icon: "shield-lock",
    disabled: true,
  },
];
const specs = registry.components;
const Example = (
  props: Omit<Parameters<typeof LibraryExample>[0], "specs">,
) => <LibraryExample {...props} specs={specs} />;
export default function NavigationModuleDemo() {
  const [collapsed, setCollapsed] = useState(false),
    [active, setActive] = useState("inbox"),
    [workspace, setWorkspace] = useState("support"),
    [command, setCommand] = useState("No command selected");
  return (
    <div className="ds-experience-module">
      <ModuleIntro
        layer={4}
        title="Navigation System"
        description="A clear route through every EASM workspace. Shared navigation, contextual headers and searchable actions with predictable keyboard behavior."
        specs={specs}
      />
      <Example
        name="Sidebar"
        description="Select a destination or collapse the rail. This example updates its local active state without navigating to application screens."
      >
        <div className="ds-navigation-frame">
          <div className="ds-navigation-rail-slot">
            <Sidebar
              items={items}
              activeId={active}
              collapsed={collapsed}
              onCollapsedChange={setCollapsed}
              onNavigate={(item, event) => {
                event.preventDefault();
                setActive(item.id);
              }}
              footer={!collapsed && "Example workspace"}
            />
          </div>
          <div className="ds-navigation-context">
            <p className="ds-eyebrow">Workspace content</p>
            <h3>{items.find((item) => item.id === active)?.label}</h3>
            <p>
              One current destination, visible text labels and a compact rail
              when space is limited.
            </p>
            <p role="status">Selected: {active}</p>
          </div>
        </div>
      </Example>
      <Example
        name="TopHeader"
        description="A contextual title and explicit actions wrap into a second row at reduced widths."
      >
        <TopHeader
          title="Conversations"
          breadcrumb={
            <Breadcrumbs
              items={[
                { label: "Support", href: "#TopHeader" },
                { label: "Conversations" },
              ]}
            />
          }
          actions={
            <>
              <Button
                size="sm"
                variant="secondary"
                leadingIcon="download"
                onClick={() => setCommand("Example export selected")}
              >
                Export
              </Button>
              <ButtonLink size="sm" variant="subtle" href="#TopHeader" trailingIcon="arrow-right">
                Open settings
              </ButtonLink>
              <UserChip name="Aisha Khan" description="Support lead" />
            </>
          }
        />
        <p className="ds-example-note" role="status">
          {command}
        </p>
      </Example>
      <Example
        name="Breadcrumbs"
        description="Parent links preserve route context. Long paths scroll internally rather than widening the whole page."
      >
        <Breadcrumbs
          items={[
            { label: "EASM One", href: "#Breadcrumbs" },
            { label: "Knowledge", href: "#Breadcrumbs" },
            { label: "Sources", href: "#Breadcrumbs" },
            { label: "Admissions handbook · example" },
          ]}
        />
      </Example>
      <Example
        name="CommandBar"
        description="Open the command dialog, type a query, then use arrow keys and Enter to choose an available action. Escape returns focus to the trigger."
      >
        <CommandBar
          commands={[
            {
              id: "inbox",
              label: "Open inbox",
              description: "Example Support workspace",
              icon: "inbox",
              onSelect: () => {
                setActive("inbox");
                setCommand("Open inbox selected");
              },
            },
            {
              id: "knowledge",
              label: "Search knowledge",
              description: "Example Knowledge workspace",
              icon: "knowledge",
              onSelect: () => {
                setActive("knowledge");
                setCommand("Search knowledge selected");
              },
            },
            {
              id: "restricted",
              label: "Restricted command",
              description: "Unavailable in this example",
              icon: "shield-lock",
              disabled: true,
              onSelect: () => setCommand("Unavailable"),
            },
            {
              id: "reports",
              label: "View reports",
              icon: "analytics",
              onSelect: () => setCommand("View reports selected"),
            },
          ]}
        />
        <p className="ds-example-note" role="status">
          {command}
        </p>
      </Example>
      <Example
        name="WorkspaceSwitcher"
        description="A controlled, labelled workspace picker. Availability belongs to the consuming product; the inactive example stays disabled."
      >
        <WorkspaceSwitcher
          options={[
            { value: "support", label: "Support workspace" },
            { value: "knowledge", label: "Knowledge workspace" },
            { value: "marketing", label: "Marketing workspace" },
            { value: "inactive", label: "Unavailable example", disabled: true },
          ]}
          value={workspace}
          onValueChange={setWorkspace}
        />
        <p className="ds-example-note" role="status">
          Current example workspace: {workspace}
        </p>
      </Example>
    </div>
  );
}
