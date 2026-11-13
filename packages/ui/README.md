# @easm-ui/ui

React components for EASM One: 47 core components, 7 navigation controls, 6 data components and the product patterns, styled by the EASM One tokens and drawn with `@easm-ui/icons`. Every component has a fifteen-part specification in [`docs/COMPONENT-SPECS.md`](docs/COMPONENT-SPECS.md); the tokens are documented in [`docs/FOUNDATIONS.md`](docs/FOUNDATIONS.md).

Install with `npm install @easm-ui/ui` (React 19). Setup for Next.js, Vite and Tailwind is in the root README.

```tsx
import { Button, TextField, Dialog } from '@easm-ui/ui';
import '@easm-ui/ui/styles.css';

<TextField label="Full name" autoComplete="name" required />
<Button leadingIcon="save" onClick={save} loading={saving}>Save changes</Button>
```

## White theme (2.1.0)

The page is White (`--easm-ui-background`). Surfaces are told apart by fill, not outlines or shadows. Filled actions use the bright `primary-fill`; links and selected text use the text-safe `primary`. Focus is one solid edge plus a soft halo. All values come from `tokens/easm.tokens.json`.

**Menus and popovers** take their panel colour from where they open (`surface="auto"`): a white sheet over the page, a grey panel over cards (Card, Panel, DataTable, Chart, StatCard, dialogs). Set `surface="page" | "card" | "ink"` to override, or pin a region with `data-easm-surface`. Use `matchTriggerWidth` when a full-width trigger opens the menu (a workspace or account card). SplitButton handles its own width, and a primary SplitButton uses the dark `ink` panel.

```tsx
<DropdownMenu trigger={<button className="account-card">…</button>} items={items} side="top" align="start" matchTriggerWidth />
```

**Pickers** replace the browser's native date and time pickers. Values are ISO strings.

```tsx
<DatePicker label="Follow up on" value={date} onValueChange={setDate} min={todayISO} />
<TimePicker label="At" value={time} onValueChange={setTime} step={15} />
<DateRangePicker label="Date range" hideLabel appearance="button" value={range} onValueChange={setRange} max={todayISO} />
```

In a DatePicker, clicking the month title switches to a month grid, and clicking again shows a twelve-year grid. Escape steps back one view. Arrow keys, Home/End and PageUp/PageDown (Shift for years) navigate. Pass `name` to submit the value with a native form.

**Tabs** that overflow show fade edges and paging buttons on the side that hides tabs, scroll with a vertical mouse wheel, and keep the selected tab in view. Mouse users without horizontal scrolling can reach every tab. Keyboard users reach them with the arrow keys.

## Charts, reporting and inbox layers (2.1.0)

Three layers sit beside the 47 core components, each with its own name list.

**Charts (`chartComponentNames`).** Every chart states its numbers in text (a legend, a list or a data table), so the drawing is decorative. Marks animate in briefly and stay still under reduced motion.

```tsx
<SeriesChart title="Conversation volume" kind="area" valueLabel="Conversations"
  summary={<InlineStats items={[{ id: 't', label: 'conversations', value: '2,729' }]} />}
  series={[{ id: 'now', label: 'This period' }, { id: 'ai', label: 'AI handled', tone: 'teal' }, { id: 'last', label: 'Previous period', tone: 'honey', dashed: true }]}
  data={days} />
<Heatmap label="Busy hours" rows={weekdays} columns={hours} values={counts} tone="violet" />
<Funnel label="Admissions" stages={[{ id: 'i', label: 'Inquiry', value: 1597 }, { id: 'a', label: 'Applied', value: 87 }]} />
<Gauge label="SLA attainment" value={92} target={95} />
```

- **SeriesChart:** `area`, `line`, `stacked-area`, `bar` or `stacked-bar`.
  - Lines are smooth and never overshoot.
  - `dashed` series are comparisons, drawn without fill.
  - Legend chips show and hide series.
  - The tooltip follows the pointer and flips at the edge.
  - Arrow keys read a category aloud, and a data table is always one click away.
  - Axes use compact numbers (1.2K).
- **Sparkline:** a small trend for tiles and table rows. StatCard takes `spark`.
- **DonutChart:** rounded segments; hovering one fills the centre with its value. Its side legend moves underneath when the space is narrow.
- **ProportionBar:** one bar split into shares, a calmer alternative to a donut for 2–6 parts.
- **BarList:** ranked horizontal bars (`ranked` numbers the rows); `scale` sets what a full bar means.
- **Heatmap:** intensity across two dimensions, as a real table.
- **Funnel:** stages with conversion between each.
- **Gauge:** a level against a target on a half ring.

**Reporting parts (`insightComponentNames`).**
- **Measures:** Meter (with `inline` for table cells) and ProgressRing.
- **Figures:** MetricTile, MetricGroup and InlineStats.
- **Structure:** SectionHeading, DescriptionList, CellStack and InfoHint.

**Product layer (`productComponentNames`).** The support inbox and top bar:
- **Status and alerts:** StatusPill (live pulse) and NotificationButton (count in its name).
- **Shortcuts:** Kbd.
- **Filtering and scores:**
  - QuickFilters: single-choice filters with counts that overflow like tabs.
  - ScorePill: AI confidence or lead score, with the level in words.
- **Inbox:**
  - ConversationList and ConversationListItem (arrow keys move between conversations).
  - ThreadHeader.
  - MessageThread (a polite log), MessageDivider, and Message: `contact`, `agent`, `assistant`, `note` or `system`.
  - Composer: Reply and Internal note modes, Draft with AI, formatting, Ctrl/⌘ + Enter. Notes are tinted.
  - ContactHeader.

**Settings layer (`settingsComponentNames`).** The assistant settings screen and any long preference form:
- **SettingsLayout:** the menu beside the content when the layout is wider than 760px, and above it as a scrolling row of pills when it is narrower. It follows its own width, so it works in a page, a split view or a drawer. Set `--easm-settings-sticky-top` when a sticky app header sits above it.
- **SettingsNav:** sections with an icon, a title and a one-line description; the current one is a white tile and carries `aria-current`.
- **SettingsSection:** a white block with an icon, title, description, actions and an optional footer (a save bar).
- **SettingRow:** text at the start, the control at the end; it wraps when the section runs out of room, and fields, sliders and segmented controls take the full row in narrow sections. With `htmlFor` the title labels the control; otherwise the row is a labelled group.
- **Slider:** a native range input with a filled track, a value chip, optional words under the track (`marks`) and `formatValue` for both the chip and what screen readers hear. Coarse pointers get a 28px thumb and a 44px target.
- **PromptEditor:** a monospace editor with variable chips that insert `{{name}}` at the caret, and a character and token count.
- **AdvancedSettings:** a "Show advanced settings" disclosure.

**Pipeline layer (`pipelineComponentNames`).**
- **KanbanBoard:** stages side by side. Wide screens share the width between stages; narrower ones scroll sideways with a fade and a paging button on the hidden side; phones show one stage at a time with the next one peeking and snap as you swipe. The page still scrolls vertically over the board.
- **KanbanColumn:** a tinted header in the stage's chart colour with the count (read with the heading), an optional badge (such as a "Manual" lock) and actions. An empty stage is a filled drop zone; while dragging, the drop position is a filled slot. `acceptsDrop={false}` keeps cards out.
- **LeadCard:** name (link, button or text), lead score, programme, contact lines, capture progress, tags, time and owner. A mouse can drag it. Every card also has a menu with Move up, Move down and Move to each stage: the keyboard, touch and screen reader way to move. Focus follows the moved card and the move is announced. `onMove(cardId, toColumnId, toIndex)` reports the change; the board does not reorder by itself.

**Additions to existing components:**
- **Inputs:**
  - Select takes `appearance="inline"` (a filter pill showing "Dept · All") and `icon`.
  - SearchField and Select take `hideLabel`.
- **Navigation:**
  - CommandBar takes `appearance="search"` and `shortcut` (⌘K / Ctrl+K).
  - Sidebar items take `group`.
- **Cards and tables:**
  - StatCard takes `tone`, `info` and `spark`; its trend is a soft pill.
  - Card and Panel take `icon` and `iconTone`.
  - Collapsible takes `appearance="card"`.
  - DataTable takes `title`, `description`, `actions` and `toolbar`, and `narrowLayout="cards"`, which turns each row into a card of label and value pairs when the table is narrower than 600px (table roles are kept).
  - SeriesChart takes `fixedHeight`; otherwise the plot is shorter in narrow containers and taller in very wide ones.
- **Inbox:** ThreadHeader takes `onBack` for single-pane phone layouts.
- **Feedback:** Tooltip takes `openOnClick`; InfoHint uses it, so the hint opens on a tap as well as on hover and focus.

**No one-sided lines.** Components never draw a bar or rule on one side. A selected conversation is a blue fill; table rows are told apart by soft banding; accordion items are separate filled blocks; card, drawer and section footers are separated by space; the chat date divider is a pill. Divider remains for layouts that genuinely need a rule.

**Chart colours** are `blue, teal, amber, sky, green, plum, rose, violet, lime, indigo, honey, coral`, in that order when a caller does not choose: neighbours stay apart for people with red-green colour blindness (`test/palette.cjs` measures it), honey reads as "other", and coral comes last, so it only appears where "bad" is meant. Each colour has a mark colour (3:1 on card and page), a tint and an ink (4.5:1 on its tint): `--easm-ui-chart-<tone>`, `-tint` and `-ink`.

**Colour roles** give each meaning that recurs across dashboards one colour and one glyph: lead temperature, sentiment, priority, consent, delivery, sensitivity, freshness, tool effect and attention ("Needs you"). Use the vocabularies (`temperatureStatuses`, `consentStatuses`…) with `StatusChip`, `roleTone(role)` for a chart series or a Tag, and the tokens `--easm-ui-<role>`, `-tint`, `-ink` elsewhere. None is the success green or the danger red: a cold lead or a withdrawn consent is a fact to read, not a fault to fix.

In a Next.js app import the stylesheet once in the root layout and consume interactive components in a client boundary. The public component entry is a client module; the separate `@easm-ui/ui/tokens` entry is pure data. The library names its font stack but does not download a font; reuse the application's existing Inter loading. The catalog works offline with system fallbacks.

Variants and sizes are typed. Use `sm`, `md`, `lg` rather than custom heights: desktop controls use 32/40/48px; coarse pointers expand small and medium actions to a minimum 44px. Fields have explicit labels, descriptions and validation associations. Loading blocks activation while retaining focus; explicit disabled controls use native disabled behavior. Pass real operation state from the application. There are no artificial operation delays.

Use Radix-backed overlays for focus containment, keyboard commands, dismissal, collision handling and focus restoration. A modal opened externally requires a `restoreFocusRef` or the still-mounted opener to return focus to; normal triggers handle this automatically. ConfirmationDialog keeps confirmation/closure under the consumer's control; close only after success, and render an error on failure. Keep cancellation available when the operation supports it. Native date/time pickers intentionally retain browser/locale behavior; select a timezone in the application when needed.

Use `onValueChange` for SearchField/Select/Combobox semantic values. Combobox accepts a selected option ID, not arbitrary input; `onQueryChange` exposes search text. Radio options must share a name and live inside a fieldset with a legend. Controlled controls need their parent to reset state; native form reset synchronizes supported uncontrolled controls. FileUpload validates actual local files and keeps the native FileList aligned; uploading, persistence, cancellation and server-side validation belong to the application. `accept` is selection guidance, not a security boundary.

`Select` now uses the same branded popup as `DropdownSelect`, including within dialogs, workspace controls, filters and pagination. Both exports use an opaque rounded menu, collision handling, typeahead, selected checkmarks and keyboard focus restoration. The hidden native select is only the form bridge; it is not the visible interaction.

**App pieces (`appPieceComponentNames`).** Parts the dashboards made for themselves, now shared so every EASM app has them. None imports a framework: links go through `EasmLink`, so mount `EasmUIProvider` with the app's router link.
- **ProductHomeHero** and **ProductHomeBody:** the dashboard front (figures, greeting and headline, one large search, next-move chips) and the centred column under it. Pass `onOpenPalette` to make the search the command palette's door, or `search.onChange` for a page that filters its own list.
- **BrandLockup:** the EASM One lockup at 24 or 32 px, for light or dark grounds.
- **LoadingMark:** the page loader (the EASM icon connecting), shown after a 180 ms beat.
- **LiveWaveform:** five bars for a call happening now.
- **IconTapMotion:** mount once at the root; every pressed icon plays its motion (`iconTapPresets`, plus the `tap` preset in app-pieces.css).
- **ExplainTip:** what a page or section is for, behind an ⓘ that opens on a tap.
- **PrimaryAction:** a page's one main action; a round floating button below 768 px.
- **ComingSoon:** a parked feature, labelled. **ErrorScreen:** what a route shows when it throws (`showDetails` for development builds).

```tsx
<ProductHomeHero greetingName="Aisha" headline="Every student question, answered" metrics={figures}
  search={{ placeholder: 'Search contacts and conversations' }} onOpenPalette={openPalette}
  actions={[{ label: 'Inbox', icon: 'inbox', href: '/support/inbox', count: 12, attention: true }]} />
<ProductHomeBody>{content}</ProductHomeBody>
```

## Select migration in v2.0.0

This is a breaking change for previous native `Select` consumers. Replace `onChange={event => setValue(event.target.value)}` with `onValueChange={setValue}` (or `(value, option) => ...`). Change refs and trigger event types from `HTMLSelectElement` to `HTMLButtonElement`; focus the visible button through its public ref. Use controlled `value` and the semantic callback instead of reading a native select value or calling native select methods. `name`, `form`, `required`, `autoComplete`, uncontrolled reset and disabled/read-only behavior remain supported. `open`, `defaultOpen` and `onOpenChange` now follow the same contract as `DropdownSelect`. Existing `DropdownSelect` consumers retain their API.

```tsx
const selectRef = useRef<HTMLButtonElement>(null);

<Select ref={selectRef} label="Department" name="department"
  options={departments} value={department} onValueChange={setDepartment} />
```

CopyControl requires a secure context and clipboard permission. Failed copies produce a manual-copy instruction; stale completions never label new text as copied. Tooltip is supplemental text only and requires an independently named trigger. Toast persists until dismissed; accessible announcements contain message text rather than action controls. Progress is driven by measured values or genuine indeterminate work. Skeleton is static by default and hidden from screen readers; put a named loading status on its containing region.

Motion uses 140ms feedback, 200ms selections/menus/popovers and 280ms dialogs/drawers/expansion. Reduced motion removes spatial transitions and spinner motion; state information remains. Orange is used sparingly in signature ModuleIcon containers with dark ink. It is not the default action or semantic warning color.

For the platform identity, use the static signature module tile:

```tsx
import { ModuleIcon } from '@easm-ui/ui';

<ModuleIcon icon="easm-one" tone="signature" label="EASM One" />
```

The EASM One glyph uses a solid core in every icon treatment. Signature ModuleIcon resolves `--easm-icon-core` to `--easm-ui-signature`, giving dark rails and an orange core on the orange-tint surface. Use `easm-one` for EASM One itself; generic AI, knowledge, support and other modules keep their own functional metaphors. A ModuleIcon stays noninteractive and static; its parent owns navigation state, labels and target size. Omit its `label` when adjacent text already names it. Use the separate 64-unit marketing brand files for marketing, wordmark lockups and favicon; retain Spinner for generic loading.

Library v2.0.1 retains all 47 core and 18 higher-layer component names and Icons v1.3.1. Select changes its callback/ref contract as documented above. Previous published Core ZIPs, including v1.1.0 and v1.2.2, are frozen snapshots; rebuilding this source produces a separate versioned handoff.

The current application components remain in place. Migration is mapped in the audit directory, while the new navigation, data and patterns are available for deliberate adoption. Do not mix old and new buttons within one form or force old global variables to change merely by importing this library. Class/style escape hatches exist for integration layout; overriding core dimensions/colors falls outside the documented theme contract.

## Validation

```sh
pnpm --filter @easm-ui/ui build
pnpm --filter @easm-ui/ui test
pnpm --filter @easm-ui/ui lint
```

The detailed verification, integration and migration guidance ships beside the brand asset catalog. These checks cover the library locally, not deployed application behavior.

## Higher layers

Navigation exports `Sidebar`, `TopHeader`, `Breadcrumbs`, `CommandBar`, `WorkspaceSwitcher`. Data exports `DataTable`, `StatCard` (also `KPI`), `Chart`, `FilterBar`, `Pagination`, `DataStatus`. Patterns export `SearchPattern`, `FilterPattern`, `FormPattern`, `ApprovalPattern`, `AIActionPattern`, `NotificationPattern`, `EmptyState`. Each layer has fifteen-part specifications and real local examples under `brand-assets/design-system/modules/`. Separate name arrays keep the 47 core contract distinct from the 18 higher-layer exports.

Use controlled product data, permissions, routes and operation state. CommandBar executes supplied callbacks; WorkspaceSwitcher requests a value change. DataTable client sorting covers the supplied rows; server paging/sorting requires the manual adapter. Chart preserves unknown values and includes a readable table. AIActionPattern accepts an abort signal, guards late results and requires explicit reviewed application; server cancellation and persistence remain application responsibilities.

## Responsive contract

Rules live in `src/responsive.css` and beside each layer.

1. **Components follow the box they sit in, not the screen.** Cards, panels, stat cards, charts, tables, the composer, message threads, settings sections, the settings layout and the board are size containers, so the same part behaves the same in a sidebar, a drawer, a grid cell or a full page. Give them a width from the layout (a grid cell, a stack, a growing flex item); a size container does not size itself from its content.
   - Card and table headers move their actions under the title below 420px, except a lone icon button (a ••• menu), which stays beside it.
   - Chart headers do the same below 440px, legends wrap tighter, and an inline BarList puts each bar under its label.
   - Display numbers (StatCard values) scale with their card, from 24px in a narrow tile to 34px (44px for `lg`) in a wide one.
   - SeriesChart plots shorten below 440px and grow above 1000px.
   - Message bubbles widen to 90% and the composer hides its shortcut hint and scrolls its toolbar below 520px; below 360px "Draft with AI" becomes an icon.
   - Description list rows put the value under the label below 280px.
2. **The screen decides only what belongs to the screen.** Size classes: compact < 600px, medium 600–1023, expanded 1024–1439, large 1440–1919, wide ≥ 1920. Below 600px dialogs become bottom sheets with stacked full-width actions, drawers take the full width, cards use 16px padding, the search trigger shows only its icon (its name stays), and status pills drop their second line.
3. **Input type decides target size.** Coarse pointers get 44px targets, 16px text in fields (no iOS zoom), larger slider thumbs, and every action a mouse would reveal on hover. Hover tips that carry information (InfoHint) open on a tap. Chart hover survives the finger lift, and a tap or a sideways drag reads a chart category.
4. **Body text stays 13–14px on every screen.** Operating-system scaling and browser zoom already handle pixel density, so wide screens spend their room on layout: more columns, wider panes, taller charts and bigger display numbers, while long copy keeps a readable measure.

Tables keep minimum column widths, intact status badges and local horizontal scrolling unless `narrowLayout="cards"` is set; do not reset descendant minimum widths globally. Filters, pagination and notification actions adapt by container width, including narrow cards on wider screens.

Dialogs and drawers use dynamic viewport height, compact short-window spacing and independent body scrolling. CommandBar retains its search field while results scroll. On narrow coarse-pointer devices, native field text is 16 px and small/medium control targets expand to at least 44 px. Applications supply their responsive navigation shell, real content and device acceptance. The catalog's browser viewport audit establishes reflow and keyboard evidence; it does not certify physical touch hardware, mobile keyboards, OS pickers or screen-reader speech.

## Historical icon revision in v1.2.2

The v1.2.2 handoff refreshed vendored icons to Icons v1.3.1 while retaining its previous component API contracts. That compatibility statement applies to the historical v1.2.2 release; the v2 Select migration above is required for the current package.


`EasmParticleField` is also re-exported from the brand package for optional dashboard atmosphere. It supplies charcoal, paper and steel particle-wave backgrounds, with pause, reduced motion, static poster and offscreen suspension. Keep the supplied logo on a quiet neutral surface and place readable controls above the decorative layer. See [brand background usage](../brand/README.md#dashboard-atmosphere) and the [local review](../../brand-assets/dashboard-atmosphere/README.md).
