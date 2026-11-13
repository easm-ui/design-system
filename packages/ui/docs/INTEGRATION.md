# Integration and migration — Component Library v2.0.1

Use `@easm-ui/ui` v2.0.1 and `@easm-ui/icons` v1.3.1 for 47 core primitives and 18 additional navigation, data and interaction building blocks across EASM One. Add `@easm-ui/ui: workspace:*` to each consumer package when migrating it. Import `@easm-ui/ui/styles.css` once at the application's CSS entry point; it includes all three additional layers and branded functional icon styles. No separate icon stylesheet is required for UI components. For custom icons use the approved `@easm-ui/icons` package and preserve its 16/20/24/32/48 px size contract.

The original application and `@easm/brand` variables are unchanged in this phase. New controls use namespaced `--easm-ui-*` tokens. Migrate one complete feature/form at a time after checking the source inventory and migration map; switching every old variable globally would alter operator and tenant themes without reviewing those surfaces.

## Standard names

Design labels use `Component / Variant / Size / State`, with omitted inapplicable segments. For example: `Button / Primary / Medium`, `TextField / Medium / Error`, `Badge / Status / Success`, `Dialog / Confirmation`, `Switch / Selected`. Runtime exports use predictable PascalCase names. Core exports are not named after business screens. Do not add an `AdmissionsButton`, `SupportModal` or a second unrelated `Input` abstraction.

## Platform identity

Use the adopted `easm-one` glyph for EASM One itself, alongside the normal module icons:

```tsx
import { ModuleIcon } from '@easm-ui/ui';

// Standalone named identity tile:
<ModuleIcon icon="easm-one" tone="signature" size="md" label="EASM One" />

// Decorative tile beside an existing visible name:
<span><ModuleIcon icon="easm-one" tone="signature" /> EASM One</span>
```

Signature uses the `#FFF0E5` tile, dark `#161616` rails and a restrained orange `#FF6A00` core. The identity mapping introduced in Core v1.1.1 and retained in v2.0.0 sets `--easm-icon-core: var(--easm-ui-signature)` for the EASM One glyph; its fallback is `currentColor`. The solid core remains intact across all eight icon treatments, including outline, preserving rail-to-core separation at 16 px. Other functional icons retain their state palette and meaning.

ModuleIcon is a noninteractive, static graphic; wrap it in the application's named navigation control when navigation is required. It does not animate, expose selected state or act as a generic loading indicator. Use Spinner and real process text for generic pending work. Marketing's heavier 64-unit mark, wordmarks, favicon and brand motion remain separate assets in `brand-assets/design-system/assets/brand/`; do not substitute those drawings for product controls or add marketing glow to them.

## Accessibility responsibilities

Components supply native semantics, label/description association, keyboard interactions, visible focus and guarded disabled/loading states. Consumers supply meaningful labels and content, document heading order, group legends, validation timing, error recovery, and accurate process state. A component package cannot determine the outcome of a server operation. Test complete tasks with representative users and assistive technologies as part of each feature migration.

Tabs have manual activation by default: arrows move focus; Enter/Space chooses a tab. Automatic activation is available only when panel updates are immediate. SegmentedControl uses radio-group selection. Use Checkbox for multiple independent choices and Switch for settings applied immediately. Disabled options remain visibly unavailable. Select/Combobox require unique nonempty option values; Tabs/menus/accordions use unique IDs.

Modal/Dialog and Drawer are Radix-backed modal surfaces. Their trigger must forward props/ref to a real Button or IconButton. For externally controlled launchers use `restoreFocusRef`. ConfirmationDialog uses safe initial cancel focus. `onConfirm` calls the operation but does not force close; pass `loading` while pending, close on successful completion, and show an actionable error when failure occurs. Avoid stacking modal surfaces unless the workflow genuinely requires it.

Uncontrolled native form resets are synchronized for text search, single selection, combobox and local file state; controlled parents must reset their values. DateField values are calendar dates (`YYYY-MM-DD`) and TimeField values are local clock strings; timezone conversion belongs to business logic. FileUpload returns accepted/rejected File objects, validates extension/MIME guidance and maximum size, and keeps the native FileList aligned. Repeat selection, cancel, removal and reset are supported; the application owns transfer and server validation. No real network upload is performed by the library.

## Select migration in v2.0.0

`Select` now delegates the shared `DropdownSelect` implementation. Both show the EASM rounded opaque listbox, collision-aware portal, complete option text and reserved selection check. The native select retained by the primitive is a hidden form bridge, not a device-owned visible menu. Use `Select` for ordinary finite fields; existing `DropdownSelect` calls remain valid. Use `Combobox` for searchable choices and `DropdownMenu` for commands.

The public contract changes from native select events/ref to the visible button trigger and semantic committed values:

| Previous Select usage | v2 usage |
| --- | --- |
| `onChange={event => setAgentId(event.target.value)}` | `onValueChange={setAgentId}` or `(value, option) => ...` |
| `useRef<HTMLSelectElement>(null)` | `useRef<HTMLButtonElement>(null)` |
| Read `ref.current.value` or native selected-option methods | Read the controlled value or `onValueChange` option argument |
| Native-select `onKeyDown` / `onPointerDown` event types | Button-trigger event types targeting `HTMLButtonElement` |
| Native select `multiple` or numeric `size` | Unsupported; use the finite single-choice API and density `sm` / `md` / `lg` |

```tsx
import { useRef, useState } from 'react';
import { Select } from '@easm-ui/ui';

function AssignmentField() {
  const [agentId, setAgentId] = useState('aisha');
  const trigger = useRef<HTMLButtonElement>(null);
  return <Select ref={trigger} label="Assigned agent" name="agentId" required
    options={[{ value: 'aisha', label: 'Aisha Khan' }, { value: 'omar', label: 'Omar Ali' }]}
    value={agentId} onValueChange={setAgentId} />;
}
```

`value`, `defaultValue`, `name`, `form`, `required`, `autoComplete`, `disabled`, `readOnly` and standard field messages remain available. `open`, `defaultOpen`, `onOpenChange` and `dir` match `DropdownSelect`. The public ref supports focusing the visible trigger; do not query or focus the hidden native select. Uncontrolled form reset restores its configured default; controlled owners must reset their value. Confirm required/unavailable validation, form serialization, keyboard selection, dismissal and focus return in each migrated consumer. This major-version change is a library contract update; existing application screens are not automatically migrated.

## Distribution

Within the authoring library, `source-package/` mirrors the workspace package. `distribution/react/` is a compiled private ESM package with declarations, bundled runtime dependencies, CSS, and a local approved icon package for TypeScript dependency resolution. Install that compiled folder into a React 19 consumer with `pnpm add /absolute/path/to/distribution/react`. In the v2.0.0 engineering archive these folders are named `source/` and `react/`; install its extracted `react/` folder instead. The package is deliberately private. CSS and React component exports match the source APIs. `tokens.mjs` has no client directive or DOM dependence. Third-party notices are included.

The interactive catalog is an offline static website. Serve the `brand-assets` directory to preserve the Icons link and neighboring ZIP download: `python3 -m http.server 8773 --bind 127.0.0.1 --directory brand-assets`. No user data, providers or API are required. Files selected in the demo stay local.

## Responsive integration contract

Let containers shrink with `min-width: 0` and choose a layout based on their actual available width. Do not apply a blanket descendant `min-width: 0` rule: it overrides DataTable's intentional column minima. Tables keep useful column widths and use their named local scrolling region; sort labels, numeric values and status badges stay intact. Empty and error recovery live outside the wide scroll content. Charts measure the containing panel, retain 12 px axis text and expose a focusable local plot-scrolling region when necessary; preserve the visible scroll guidance and data-table alternative.

FilterBar, Pagination and NotificationPattern use their own container width to adapt within narrow desktop or tablet cards. Allow action labels and supporting text to wrap where documented. Do not introduce fixed preview tracks wider than the parent panel or absolute widths on workspace controls. Breadcrumbs can scroll locally; preserve their focus clearance and named navigation semantics.

Dialog/Drawer panels use dynamic viewport height and compact spacing in windows up to 500 px high. The body scrolls independently; unusually long custom titles or action groups can use the outer panel's fallback scroll. CommandBar keeps the search field in place while results scroll. Preserve these flex and overflow relationships rather than nesting another fixed-height wrapper. Native field text uses 16 px on narrow coarse-pointer devices to prevent focus-driven Safari zoom; this does not change the label/supporting text density. Native date/time pickers retain browser and locale behavior.

The portal's compact route menu applies at up to 760 px width, or up to 1000 px width with a height of 500 px or less. Its fixed menu and the component directory begin below the shared 118 px header/navigation inset. Both contain keyboard focus while open and restore their previous body-scroll policy after dismissal or resize. Applications embedding the controls must supply their own responsive navigation shell; these portal-directory behaviors are catalog integration rather than product routing APIs.

## Evidence and limits

Repository-relative `brand-assets/components/library/qa/report.json` records core SSR/DOM checks and token/specification contracts; read its version before treating it as current evidence. `brand-assets/design-system/modules/qa/navigation-patterns.json`, `modules/data/qa/verification.json` and `modules/qa/demo-verification.json` under the same design-system directory record new-layer source and integrated-example checks. Before packaging, `brand-assets/design-system/qa/browser.json` must identify Portal 1.3.3 / UI 2.0.0 and exact matching build hashes for this release. Previous Portal 1.3.2 / UI 1.2.2 and Portal 1.3.1 / UI 1.2.1 reviews remain evidence of those builds; they do not establish acceptance of the new Select contract. The prior Portal 1.3.0 report is preserved as `brand-assets/design-system/qa/browser-v1.3.0.json` and is not current responsive acceptance. The component library's own `qa/browser.json` and `qa/component-review-2026-10-04.json` remain historical 1.1.0 and 1.1.1 evidence. Source, distribution and browser checks must be completed for the current version before a readiness claim. Readiness concerns local library handoff and documented integration; current application screens have not been migrated or deployed. Desktop-browser viewport checks do not certify touch devices, OS pickers, screen-reader speech or every browser engine.

In the engineering archive, the current central reports are `qa/portal-browser.json` and `qa/portal-site.json`; the module checks remain under `modules/`. Archive paths differ from the repository authoring paths above.

Behavior references: [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Radix Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu), [WAI-ARIA Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

## Historical Core v1.1 polish · 1 October 2026

The original v1.1 polish preserved the 43 public component names; the subsequent input expansion brought the library to 47. Accordion items and Collapsible accept an optional `icon: UIIconName`. That historical release used @easm-ui/icons v1.2; the current library uses Icons v1.3.1 while action names remain compatible. Expanded content gains consistent white surfaces and spacing. Combobox lists use a collision-aware portal, so ancestor selectors must not be used to style list options. Modal descriptions now live inside the scrollable body so long content cannot push the footer out of view. Nested overlays share scoped layer bands.

Review [final polish audit](../qa/final-polish.md) and [interactive stress compositions](../qa/interaction-audit.html) before migrating a consumer. The previous v1.0 archive is retained beside the new v1.1 archive.

## Historical Core v1.1.1 adoption · 4 October 2026

Core v1.1.1 retained all 47 public component names, adopted Icons v1.3.0 and the EASM One signature ModuleIcon, and guarded both SplitButton halves when unavailable. Its historical browser review retains that exact version scope. Previously packaged Core v1.0 and v1.1.0 ZIPs remain frozen and are not rebuilt in place.

## Historical layers 4–6 in v1.2.1 · 4 October 2026

The package now exports `Sidebar`, `TopHeader`, `Breadcrumbs`, `CommandBar` and `WorkspaceSwitcher`; `DataTable`, `StatCard`, `Chart`, `FilterBar`, `Pagination` and `DataStatus`; and `SearchPattern`, `FilterPattern`, `FormPattern`, `ApprovalPattern`, `AIActionPattern`, `NotificationPattern` and `EmptyState`. `KPI` aliases `StatCard`. All 18 primary building blocks have fifteen-part specifications and interactive examples under `brand-assets/design-system/modules/` in the repository and `modules/` in the engineering archive.

Consumers own route and workspace changes, server sorting/pagination, data freshness, validation errors, permission checks and persisted outcomes. Tables distinguish zero from unavailable values and apply local sorting only to supplied rows unless the consumer selects server-controlled behavior. Approval callbacks can return actual promises; AI actions receive an abort signal and require explicit review before applying output. Wire those contracts to real services and state rather than treating local examples as application integrations. Never introduce artificial completion delays to match an animation.

## Historical responsive revision in v1.2.1 · 4 October 2026

The revision retains all public names and Icons 1.3.0. It repairs table column compression, measured chart label scaling, narrow panel layouts and short landscape overlay geometry. Its source reports distinguish DOM/state checks from the current central browser pass. Existing ZIPs stay frozen; package and portal updates use separate versioned releases.

## Historical vendored icon revision in v1.2.2 · 4 October 2026

Icons 1.3.1 refines the requested small modifiers and compound glyphs; the compiled UI distribution carries the same refreshed artwork as the standalone SVG library. All component names, state semantics, tokens and layout contracts remain compatible. Use 20–24 px with a visible contextual label for detailed icons; an improved 16 px outline still cannot communicate every secondary meaning without text. Previous engineering archives remain frozen.
