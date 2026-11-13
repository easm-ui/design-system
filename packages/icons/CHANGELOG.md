# @easm-ui/icons (formerly @easm/icons)

Entries from 1.3.2 onward are written by Changesets. Earlier releases are summarised from `brand-assets/icons/library/README.md` and `brand-assets/design-system/README.md`.

## 1.14.0

### Minor Changes

- Everything universal in one place: the pieces the dashboards, the widget and the forms used to draw for themselves.
  
  - **Brand:** `EasmMascot` (and the framework-free `EasmMascotEngine`), the EASM mascot as a brand character any product can place: expressions, moods, activities and acts, a corner or stage placement, reduced motion and a fallback without WebGL 2. She never makes a sound; lip sync follows audio the host plays. `EasmDotField` takes `contained` to fill its positioned parent instead of the window.
  - **UI, the dashboards' own pieces:** `ProductHomeHero` and `ProductHomeBody` (the dashboard front: the day's numbers, greeting and headline, one large search, chips), `BrandLockup`, `LoadingMark`, `LiveWaveform`, `IconTapMotion`, `ExplainTip`, `PrimaryAction`, `ComingSoon`, `ErrorScreen`.
  - **UI, the apps' pictures:** `FileKindArt` (document, picture, audio, video), `FormQuestionIcon`, `FormTopicPicture` and `ThanksBurst` for public forms.
  - **Icons:** six new drawings (bus, flask, trophy, heart, lightbulb, briefcase; 682 ids), `WIDGET_ICON_NAMES` / `widgetIconName` (`@easm-ui/icons/widget-icons`) for the Ask widget board, and `FORM_FIELD_ICON_NAMES` / `FORM_TOPIC_ICON_NAMES` (`@easm-ui/icons/form-icons`).

## 1.13.3

### Patch Changes

- Seventeen glyphs that read as heavy beside the line-drawn set are lighter, and two motions follow their refined drawings.
  
  - **Pause, stop and the checked box** are outlined and tinted like play, not solid ink; the checked box is the unchecked one with a check. Where a screen wants them solid (a primary button, the widget's `data-solid`), they fill from the tint as before.
  - **An unfinished response** is a circle with half of it tinted, not a half-inked disc.
  - **"Live for everyone" and "pilot"** draw a person as a solid head over a tinted body (someone left out is the same outline, thin), not a solid figure.
  - **Priority signal bars, the four credit-model bar sets and the text block's bar** use a 2-unit stroke (lit) and 1 (unlit) instead of 2.6 and 1.1, so they stop outweighing the 1.6 line beside them.
  - **Motion:** the Support and Forms dashboard glyphs were refined in 1.13.1 and 1.13.2, but their motions still pointed at the old drawings: Support's whole front message turned a quarter turn and Forms' did not move at all, which also failed the directed-motion test. Support's front message now hops and the one behind it answers; Forms' dots pop and its lines slide along.
  - **Counts:** the package description and README say what ships, 676 ids, 619 preferred names, 532 drawings and 309 directed motions (they still said 330, 273, 262 and 120).

## 1.13.2

### Patch Changes

- The Support glyph's back message stops short of the front one, so nothing shows through a transparent tint; the Forms glyph marks each question with a small dot instead of a ring.

## 1.13.1

### Patch Changes

- The five dashboard glyphs, refined: one tinted shape each and plain strokes, with no solid ink. Support is two messages without the spark and text lines, Knowledge the open book without the verified badge, Marketing's sources and Automation's connectors are outlined, and Forms shows three outlined rows instead of a solid choice and a solid button. They read as heavy at 20–24 px beside the line-drawn sidebar.

## 1.13.0

### Minor Changes

- The dashboards' demand list, wave 4a: the side panel, and the P1 parts still open.
  
  - **The side panel:** `DetailPanel` is the frame a record opens in: its kind, own name, state and source in the header with Previous, Next and More; what needs someone first; removal in More, never a red footer button; the whole screen on a phone. `Dialog` and `Drawer` take `lead`, `headerDetail` and `headerActions`. Its parts: `DetailSection` (one heading style, a count, an action, collapsible), `ContentPreview` (stored markdown drawn readably, cut at whole lines, Copy), `AttachmentPreview` (a picture, recording, video or document card), `AudiencePicker` with `knowledgeAudiences` (who can find or fill something, as a ladder with what the choice means), and `QAPairs`. `DescriptionList` rows take a `hint` and an `action`; `PipelineProgress` stages take `at`, a date shown in place of the duration.
  - **Open P1 parts:** `ConnectorCard` and `SourceCard` (indexed and failed, 14 days of sync health, the sync direction), `SetupChecklist` (steps with what each still needs), `CreditsMeter` (days left, low, paused and what people are told), `ShiftStrip` (a day or a week of online, idle and away).
  - **Icons (22):** work queue, announcement and megaphone, the website snippet, server events, Lead Ads form, funnel, drop-off and yield, the four rule triggers, a form's five states (a plain page with a pencil for a draft and outlined badges for the others, never a solid badge), AI credits (low, used up); `source-crawl` is the site-crawl drawing.
  - **Fixes:** a long Fix it in ReadinessChecklist wraps; DescriptionList column labels are 12 px.
- The dashboards' demand list, wave 4b: colour roles and the shared parts every dashboard built for itself.
  
  - **Colour roles:** lead temperature, sentiment, priority, consent, delivery, sensitivity, freshness, tool effect and attention ("Needs you") each have one colour and one glyph. Tokens `--easm-ui-<role>`, `-tint` and `-ink` point at palette hues (so contrast is the hue's); vocabularies `temperatureStatuses`, `sentimentStatuses`, `priorityStatuses`, `consentStatuses`, `deliveryStatuses`, `sensitivityStatuses`, `freshnessStatuses`, `toolEffectStatuses`, `attentionStatuses`; `StatusTone` takes a role or a palette hue; `colourRoles`, `roleTone`, `roleStyle`. None is the success green or the danger red.
  - **Twelve chart colours:** `chartTones` gains plum, rose, lime and indigo, and its order changes to blue, teal, amber, sky, green, plum, rose, violet, lime, indigo, honey, coral so neighbours stay apart for people with red-green colour blindness (blue then violet nearly merged for them). Charts that let the library choose colours show their second and later series in new colours; charts that name their tones, and channel colours, are unchanged. `test/palette.cjs` measures it.
  - **Shared parts:** `TagInput` (a list typed one item at a time: paste splits, repeats and refusals said in words, reorder), `ChoiceCards` (one choice out of a few as cards, the recommended one marked), `PageScaffold` with `PageSection` and `StatGrid` (one page rhythm), `Callout` (a caveat smaller than an Alert), `SelectionBar` (acting on picked rows), `WeeklyScheduleGrid` with `scheduleProblems` (a week of hours with breaks, copying, holidays and bounds a department may only narrow), and `Tree` (open, pick with cascade, rename, reorder, counts; one ARIA tree).
  - **Icons (29):** temperature, sentiment faces, priority bars, consent and delivery outcomes, sensitivity, freshness and tool effect.
- The dashboards' demand list, wave 4c: the P2 parts each dashboard still drew for itself, and their icons.
  
  - **Support:** `CaptureGrid` (a lead's profile: each answer and where it came from), `ConversionStrip` (a call campaign's funnel on one line), `ExtensionPool` with `extensionStates` (a line's extensions as cells, picked for a bulk action), `BridgeHealth` (heartbeat, revision and update, the campus lock, calls now), `ApplicantStepper` with `applicantStages` and `paymentStatuses`. `LeadCard` takes `temperature`, `source`, `stageAge` and `nextAction`.
  - **Knowledge:** `DiffCompare` and `diffLines` (raw against cleaned, side by side or inline, folded runs), `ChangePreview` (an import's new, changed, removed and problems with Apply in a sentence), `ProgrammeTree` (schemes, semesters with credit hours, courses with kind, level and prerequisites; the scheme for new students marked).
  - **Marketing:** `GatePipeline` (the four collection gates with what each refused and why), `RoutingMatrix` with `routingStates`, `OutboxBoard` (the delivery states side by side, why held back, Send again), `CohortBuilder` (include and leave-out rules as sentences, the live count, a stop for only exclusions), `TargetBar` (no percentage without a target), `RecommendationCard` with `recommendationSeverities`.
  - **Automation:** `ResolverResult` (must use, may use, left out, the rules and their wording), `GoLiveGate` (the checks, Go live, and a recorded way past them), `ToolCallRow` with `toolCallOutcomes`.
  - **Forms:** `PreviewTiles`, `DropOffStrip`, `PublishChannels` (link, QR, embed, campaign link, pre-filled link, the assistant), `CollectionStatus`.
  - **Admin:** `LevelLadder`, `NotificationMatrix` (events against bell, email and push; locks with why; quiet hours), `RegistryTree` with `registryStates` (what stops before a disconnect).
  - **Icons (97):** calling (counsellor, extension, SIP line, the bridge, call purposes, office hours), the Academic Advisor (scheme of study, course kinds, credit hours, eligibility, equivalence), knowledge states (published, source sync, query rewrite, confidence gate, office, review due), the collection gates and event outcomes, campaign links, cohorts and rules, intake cycles, plan against actual, recommendations and anomalies, conversation signals, provider capabilities, form outputs, types and who can fill, quizzes, go live and test users, systems, directories and SCIM, the four access levels, email delivery states, notification channels and the platform's own surfaces.
  - **Shared:** secondary buttons on honey surfaces take white so they still read as buttons; icons beside wrapping labels stay on the first line in every new part.
- The dashboards' demand list, wave 4d: verbs that move when the action lands, and empty places that say why.
  
  - **Motions (23 new, `MotionIcon`):** claim, return to queue, pause and hand back to the assistant, reopen, answer, hold, dial, move to the next stage, draft with AI, publish and unpublish, mark reviewed, apply an import, send again, add to an audience, hold back, erase a person (slow and final), go live, and the Support, Marketing, Automation and Forms marks. Each tells its three beats with the drawing's own parts in about 0.6 s and rests on the drawing; badge rings never move. With the motions that already existed (resolve and approve through check-circle, retry through refresh, reject, mark as spam, take over, the Knowledge mark, saved replies, internal notes, hang up, mute, callbacks, tours, merge, connect, rotate a key, test a tool, reorder, reveal, correct, copy and download), all 40 verbs of the demand list move.
  - **Icons (3):** `claim`, `ai-draft`, `stage-advance`.
  - **Illustrations:** `EmptyIllustration` with sixteen calm two-tone scenes (`emptyIllustrationNames`: nothing yet, all done, no results, no access, not set up, offline, error, coming soon, no conversations, no data, no files, and a first run for each dashboard in its accent). `EmptyState` takes `illustration`, shown in place of the symbol except when compact.

## 1.12.0

### Minor Changes

- The dashboards' demand list, wave 3: Marketing and Automation in depth.
  
  - **Marketing:** `ProvenanceFigure` and `ProvenanceKey` (how sure a figure is: verified, external, self-reported, provisional, not measured, with the reason), `CreditComparison` (the five attribution models side by side, unattributed at the foot), `JourneyStrip` (one person's touches on a time axis, the lookback window shaded, first and last marked), `TwoBandFunnel` (browsers above, people below, no rate across the line) and `ConnectionCard` (an ad platform whose reporting, conversions and audience sync keep their own state, so data that stopped days ago shows as behind).
  - **Automation:** `InputSourceRow` (who fills an input: the assistant, the signed-in person, a fixed value or EASM; built-in inputs locked with the reason), `RequestBuilder` (the request with each `{slot}` in its source's colour and the request exactly as sent; changing data says so in amber), `JsonView` (a response read-only, shape-only when masked, cut-off output said), `ResponsePicker` (the fields the assistant keeps, in order) and `RuleSentence` (a rule as one editable sentence, with what will happen or what is missing).
  - **Icons (32):** touches and journeys, credit models, how sure a figure is, who fills an input, what a tool does to data, pilot and everyone rollout, and the five kinds of nothing a tool returns.

## 1.11.0

### Minor Changes

- The dashboards' demand list, waves 1 and 2: the parts every dashboard had been building for itself.
  
  - Workflow: StatusChip (a vocabulary declared once with defineStatuses, each status with its own glyph), StageChip
    (one lead-stage ramp), Presence (with idle and on a call), IdentityLevel, SlaClock, Timeline, Stepper,
    ReadinessChecklist, UnmeasuredValue (and StatCard `unmeasured`), FilterChip and PersonJourney.
  - Calling: CallButton and CallControls, Keypad, CallBar (docked and page), CallDeviceLine, CallElapsed, CallRowMeta,
    TranscriptViewer, CallResultCard and ThreadEvent.
  - Forms builder: QuestionTypeTile, FieldCard, RuleChip and RuleRow, and the Responses cells (ResponseStatusCell,
    ResponseSourceCell, ResponseScoreCell, SealedCell, FilesCell).
  - Knowledge: PipelineProgress, KnowledgeItemRow, RetrievalTrace and ChunkResult.
  - Colour: the AI role, the lead-stage ramp, idle and on-a-call presence, plum, the five dashboards' accents
    (productTones, ModuleIcon `product`) and a fixed colour per marketing channel (channelTone). Charts, bar lists,
    funnels and stat cards say where a figure comes from: verified solid, self-reported outlined, provisional dashed,
    not measured a hollow dashed track, always in words too.
  - Icons: about 140 new names, among them the status and identity families, the five dashboards' glyphs, who did it,
    who it is for, where the assistant runs, lead stages, programme levels, every Forms question type, call states,
    conversation events, the knowledge pipeline, content types, form responses and rules, and a drag handle.
  - Brand: EASM Support, EASM Knowledge, EASM Marketing and EASM Automation join the product family (lockups, marks
    and app icons).

## 1.10.0

### Minor Changes

- Directed motion, quieter colour and phone layouts. Every icon's motion is now the object doing its own job (a bell
  rings, a lid lifts, an arrow pushes the way it points), built from one set of verbs, never adding a part the drawing
  does not have and always ending on the approved drawing; `@easm-ui/icons/motion-icon` exposes `MotionIcon` on its own.
  Components move with intent: menus and dropdowns open from where they were asked for, lists and values settle into
  place, and reduced motion turns all of it off. A compact tab bar takes less room on phones and small screens. Avatars,
  tags and chips can carry a named accent tone (`data-easm-tone`, contrast checked), colour for people and categories
  only. Scroll edges are hard lines with paging buttons, never a white fade. On phones, compact cards put the time beside
  the name, chart tooltips stay inside the screen, and the thread header gives its actions their own row with a
  two-line subtitle.
- 0bf32a4: Smaller client bundles. `@easm-ui/ui` no longer ships the icon motion system with every app: the Toast success tick and
  the ring Spinner load `AnimatedIcon` on first use and draw the same pictogram (already spinning, for the ring) until it
  arrives. UI components now import `Icon` and `BrandIcon` from new subpaths, `@easm-ui/icons/icon` and
  `@easm-ui/icons/brand-icon`, so the icons entry (which re-exports the motion system) stays out of the first download;
  `@easm-ui/icons/animated` exposes `AnimatedIcon` on its own. For an app using Button, Select, TextField, Alert, Spinner
  and eight more components, the first download drops from 105 KB to 77 KB gzipped, with 29 KB of motion loaded on demand.
  Apps can take the same saving by importing `Icon` from `@easm-ui/icons/icon`.

## 1.9.0

### Minor Changes

- 1367a4b: Thirteen new icons for reading, display and sharing: `sun` and `moon` (light and dark themes), `fullscreen` and `fullscreen-exit`, `zoom-in` and `zoom-out`, `print`, `share`, `bookmark` (a saved place, distinct from the `ribbon` award), `devices` (signed-in devices), `user-remove` (user-add's construction with a minus badge), `crown` (owner or host) and `mosque` (prayer). Each is an original drawing on the 24-unit grid with names and search terms; no existing id, drawing or meaning changes.

## 1.8.0

### Minor Changes

- Twelve add icons, so a screen's main "new" action says what it adds: `tag-add`, `campaign-add`, `building-add`, `connector-add`, `integrations-add`, `form-add`, `library-add`, `book-add`, `calendar-add`, `link-add`, `call-add` and `question-add`. Each is its object's own glyph with the add badge, built the way `user-add` and `document-add` are (`modifier(…, mark.add)` in the catalog), with display names and search terms.
- Every add icon wears `user-add`'s approved badge: centred at (18, 17.5), half a unit higher than before, with the plus centred in it. `document-add` and `emoji-add` move up to match, so no plus sits low against its glyph.

## 1.7.0

### Minor Changes

- `MotionIcon`, opt-in directed icon motion: 120 icons each act out what they mean in parts (preparation, the operation, a readable result) instead of arbitrary excursions, with 40 shared-artwork ids, three-beat metadata, authored continuous cycles (`loopParts`, `loopDurationMs`, `loopStory`) and pointer, keyboard and acknowledged-action playback in `MotionInteraction`. The artwork at rest is exactly the original. Manual playback stays server-renderable; reduced motion and disabled controls suppress it. Seven `AnimatedIcon` presets take the recipes' timing; the loading spinner and preset loop guards are unchanged.
- Foreground occlusion is independent of colour and tint (scoped, synchronized SVG masks), and background brushes are real alpha cutouts in the static and motion renderers, so custom palettes and patterned surfaces stay clean.
- New stylesheet export `@easm-ui/icons/part-motion.css`. Review gallery in `brand-assets/icons/motion-lab` (`pnpm preview:icons`); `pnpm test:icon-motion` checks the motion, the original artwork and the interaction states.

## 1.6.0

### Minor Changes

- 48 more brand marks, so every system a university connects shows the mark people recognise (64 in all).
  
  - **Campus:** Blackboard, D2L Brightspace and Ellucian (monograms: none publishes a mark for reuse), OCLC WorldShare, BigBlueButton.
  - **Business:** Oracle (Fusion Cloud, HCM), Salesforce, HubSpot, Zoho, Workday (monogram), ADP, Make.
  - **Sign-in, meetings and forms:** Okta, Webex, Calendly, Google Forms.
  - **Websites and files:** WordPress, Drupal, Joomla, TYPO3, Sitecore, Webflow, Wix, Squarespace, Google Drive, Dropbox, Box, Notion.
  - **Marketing:** Meta, Google Ads, Google Analytics, Google Tag Manager, TikTok, LinkedIn, Snapchat, X, YouTube, Mailchimp.
  - **Payments:** Visa, Mastercard, American Express, Stripe, PayPal, and for Pakistan 1LINK (also 1BILL), JazzCash and Easypaisa, drawn from the logos on their own sites.
  - **Channels:** WeChat, Viber.
  
  `BrandIconCategory` gains `business`, `content`, `marketing` and `payments`. A definition can mark itself `monogram`, and a path can be a `backdrop` (1LINK's orange oval) that the mono appearance leaves out, so the mark stays legible in one colour. `@easm-ui/ui` re-exports the new marks.

## 1.5.0

### Minor Changes

- 19a9bfa: Lighter name-based icons, Tailwind 4 layering, token colours and accessibility fixes.
  
  - **Smaller bundles.** `<Icon name>`, `IconButton`, `AnimatedIcon` and every glyph in `@easm-ui/ui` now read a geometry-only registry (id to drawing; ids that share a drawing share one array). Search metadata and legacy aliases are no longer shipped with them, and those tables are tree-shakeable. Rendering by name drops from 164.5 KB to 68.6 KB minified (26.0 to 13.4 KB gzip, 20.4 to 11.1 KB brotli); a `Button` from `@easm-ui/ui` drops from 26.9 to 18.2 KB gzip; `resolveLegacyIcon` alone from 27.4 to 2.5 KB gzip. Every name, export and the `./data` subpath (`definitions`, `iconMetadata`, `legacyAliases`) are unchanged, including their types (`definitions.inbox` still satisfies `IconDefinition`).
  - **New exports:** `createIcon` (build a product glyph on the same contract) and the `NamedIconProps` and `IconNode` types.
  - **Tailwind CSS 4:** glyph defaults (display, colour, tone, state) sit in `@layer base`, so `text-*`, `hidden`/`inline` and size utilities on an icon win. Component rules stay unlayered.
  - **Tokens:** icon and IconButton colours (white on a primary fill reads `--easm-ui-on-primary-fill`, white on dark `--easm-ui-on-ink-strong`), the control radius and the transition follow the EASM UI tokens when they are loaded, and fall back to the original palette when they are not.
  - **IconButton (now deprecated; use `IconButton` from `@easm-ui/ui`):** one focus ring from `--easm-ui-focus-ring` instead of an offset outline (no double ring inside `.easm-ui`; without the tokens the fallback ring stays visible on the dark theme and on a primary fill); selected and focused buttons stay distinguishable in forced colours; 44 px hit area on coarse pointers; hover colours only where a pointer can hover; feedback is announced through a page-level live region (errors assertively) and kept as the button's description, instead of a live region inside the button that screen readers did not announce.
  - **Icon:** `aria-label` and `aria-labelledby` now name an icon (they were silently hidden); `aria-hidden` and `role` are respected; a blank label no longer renders an empty `aria-label`. `fill`, `stroke`, `viewBox`, `focusable` and the stroke style are marked deprecated because the renderer fixes them. In production an unknown name logs once and renders an empty box instead of throwing (development still throws).
  - **Lookups:** `Icon`, `isIconName`, `BrandIcon`, `AnimatedIcon` and `resolveLegacyIcon` ignore inherited names such as `toString` and `constructor`.
  - **BrandIcon:** accepts a ref and is named like `Icon`: `label`, `aria-label` or `aria-labelledby` (blank ones stay decorative; `aria-label` was silently dropped before), and `aria-hidden` hides it. Tile backgrounds follow the surface and track tokens.
  - **Forced colours:** glyphs follow their parent's system colour instead of a fixed CanvasText.
  - `data-easm-motion="off"` now stops the busy spinner with only `styles.css` loaded.
  - Regenerating the icon library keeps hand-written exports such as `BrandIcon` (they live in `index.base.ts`), and the React distribution build finds esbuild.
  - README corrected (metadata fields, server components, ESM only, counts).

## 1.4.0

### Minor Changes

- a3520d5: First release under the easm-ui organisation on GitHub Packages: the packages are now `@easm-ui/ui` and `@easm-ui/icons` (previously `@easm/ui` and `@easm/icons`, never published) and ship compiled JavaScript with types.
  
  Honey milk theme, approved 13 October 2026. All values live in `tokens/easm.tokens.json`.
  
  - **Colour:** Honey milk page (`#FBF8F0`); near-black honey text; honey outlines that meet 3:1; bright Enterprise Blue (`primary-fill`, `#2F6BEB`) for filled actions, with text-safe `primary` (`#2563EB`) for links and selected text; pastel status badges with coloured icons; a dark honey panel (`ink-panel`) for toasts.
  - **Depth by fill, not outlines or shadows:** cards, panels, charts, tables, alerts, the sidebar and the top header have no borders; `shadow-card` and `shadow-overlay` are `none`.
  - **Focus:** one solid 2px edge plus a soft halo (`focus-ring`, `field-focus-ring`) replaces the offset double ring. Keyboard focus inside menus and dropdowns keeps an inset outline.
  - **Tabs and SegmentedControl:** honey track with a white selected pill. Overflowing tab rows now show fade edges and paging buttons on the side that hides tabs, scroll with a vertical mouse wheel, and keep the selected tab in view.
  - **Menus and popovers:** new `surface` prop (`auto` | `page` | `card` | `ink`, default `auto`): a white sheet over the page, a honey panel over cards, a dark panel for primary actions. New `matchTriggerWidth` (DropdownMenu, Popover) and `width` (DropdownMenu). SplitButton menus span the whole button; primary ones use the dark panel. OverflowMenu accepts `surface`.
  - **Field dropdowns:** compact honey panel with a white selected pill.
  - **New components:** `DatePicker` (day, month and year views; `min`/`max`), `DateRangePicker` (presets; `appearance="button"` for headers) and `TimePicker` (12- or 24-hour, configurable step). They replace the browser's native pickers where theming matters. Exported in `pickerComponentNames`, separate from the 47 core names.
  - **TopHeader:** new `titleLevel` (1 | 2) renders the title as a heading.
  - **FilterControl:** a compact checklist popover that opens from its trigger's start edge, as wide as the trigger unless an option needs more.
  - **FilterBar:** keeps its controls in proportion: one row when wide, search on its own row at medium widths, stacked when narrow; every field and button inside takes the bar's size.
  - **Chart:** "View data table" is a filled toggle with a chevron, over a compact table with a rounded header and right-aligned values.
  - **Menus and popovers:** never narrower than their trigger.
  - **Buttons:** disabled buttons drop their outline; a disabled subtle button stays transparent.
  - **Charts layer (`chartComponentNames`):** SeriesChart (area, line, stacked area, grouped and stacked bars; comparison lines; legend toggles; pointer tooltip; keyboard reading), Sparkline, DonutChart, ProportionBar, BarList, Heatmap, Funnel and Gauge. Eight-colour chart palette with tints and inks.
  - **Reporting layer (`insightComponentNames`):** Meter, ProgressRing, MetricTile, MetricGroup, InlineStats, SectionHeading, DescriptionList, CellStack and InfoHint.
  - **Product layer (`productComponentNames`):** StatusPill, Kbd, NotificationButton, QuickFilters, ScorePill, ConversationList, ConversationListItem, ThreadHeader, MessageThread, MessageDivider, Message, Composer and ContactHeader.
  - **Existing components:**
    - StatCard: `tone`, `info`, `spark`; the trend is now a pill.
    - Card, Panel: `icon`, `iconTone`.
    - Collapsible: `appearance="card"`.
    - DataTable: `title`, `description`, `actions`, `toolbar`.
    - Sidebar: `group`.
    - Select: `appearance="inline"`, `icon`.
    - SearchField: `hideLabel`.
    - CommandBar: `appearance="search"`, `shortcut`.
  - **Tables:** tags and chips in cells no longer wrap; user chips in cells are plain. UserChip loses its outline.
  - **Settings layer (`settingsComponentNames`):** Slider, SettingsLayout, SettingsNav, SettingsSection, SettingRow, PromptEditor and AdvancedSettings.
  - **Pipeline layer (`pipelineComponentNames`):** KanbanBoard, KanbanColumn and LeadCard, with mouse dragging and a Move menu on every card for keyboard, touch and screen readers.
  - **No one-sided lines:** the selected conversation loses its side bar; table rows use soft banding instead of rules; accordion items become separate filled blocks; card, drawer and AI-result footers and description-list rows are separated by space; the chat date divider is a pill; the pattern list is filled rows.
  - **Responsive contract (`responsive.css`):**
    - Composite parts are size containers and adapt to their own width.
    - Dialogs become bottom sheets on phones.
    - Coarse pointers get 44px targets and 16px field text.
    - Hover-only actions show on touch.
    - InfoHint opens on tap.
    - Charts keep a tapped reading and resize their plot height with their width.
  - **More additions:** DataTable `narrowLayout="cards"`; SeriesChart `fixedHeight`; Select `hideLabel`; ThreadHeader `onBack`; Tooltip `openOnClick`; `useHorizontalOverflow` takes `{ wheel: false }`.
  - **Fixes found while rebuilding the EASM One cards:**
    - Scrolling rows (board, tables, heatmap, tabs, quick filters, composer toolbar, settings menu) now contain absolutely positioned content, which had escaped and made pages scroll sideways.
    - NotificationButton shows its count badge again; it was clipped with the hidden label.
    - SplitButton halves are separated by a 2 px gap instead of a line.
    - FileUpload's drop zone is a honey fill instead of a dashed outline.
    - Checkbox, Radio and Switch descriptions sit right under their label.
    - Neutral ModuleIcon tiles use the honey track.
    - Approval, AI action and notification patterns and the form error summary lose their outlines.
    - Search results, empty states, filter bars and removable user chips are white on the page and honey inside cards, instead of a fill that disappears on the page.
    - SegmentedControl no longer stretches in stacked layouts.
    - Funnel bars use a square-root scale so small late stages stay visible.
  - **Icons beside wrapping text:**
    - StatCard's ⓘ is pinned to the end of the heading instead of following the last word onto a new line. Below 180 px the tile and the ⓘ share the top row and the label takes the full width.
    - Badges, notices, the funnel step, prompt variables, the advanced-settings toggle, chart titles and metric labels keep their icons on the first line of a wrapped label and never squash them.
  - **One corner scale:** new `radius-mark` (4), `radius-inner` (6) and `radius-float` (8) tokens. Menus, popovers, date and time pickers, select lists and tooltips now use 8 px, the same corner as the control they open from, so the corners line up when a panel opens over a button. Nested corners are concentric. Stray 9, 10, 14, 18 and 20 px values move onto the scale.
  - **Notifications:** new `NotificationCenter` (bell + panel). NotificationPattern items take `priority` and are grouped Needs attention, New and Earlier; `onReadAll` and `appearance="plain"` added.
  - **Inbox and reporting polish:**
    - Selected quick filters and tabs keep their selected look on hover.
    - Scroll regions, tab panels and the message log no longer draw a focus ring after a click inside them; Tab focus still shows it.
    - A drawer opens on its first field, or on its panel when it has none, instead of highlighting its first button.
    - ThreadHeader in a narrow pane moves its actions up beside the back button. ContactHeader lays out avatar and details side by side.
    - Funnel steps read "33% of profiled continued · 174 dropped", with losses in red.
    - MetricGroup `columns` is a maximum (4 → 2 → 1) and its tiles share rows, so labels, figures and captions line up.
  - **Brand marks:** `@easm-ui/icons` adds `BrandIcon` (16 marks: WhatsApp, Messenger, Instagram, Facebook, Telegram, Gmail, Oracle PeopleSoft, Moodle, Koha, SAP, Canvas, Google Classroom, Microsoft 365, Google, Zoom, Google Meet) in tile, solid, glyph and mono appearances, re-exported from `@easm-ui/ui`. `@easm-ui/ui` adds `ChannelMark`; ConversationListItem and ThreadHeader take `channel`; Tag takes `brand`.

## 1.3.1

- Larger, more readable detail for clocks, user and access modifiers, keys, search, education, currency, storage and audio artwork.

## 1.3.0

- Adds `easm-one`: 330 compatible IDs, 273 preferred names and 262 distinct drawings. Corrects contour defects in Webhook, Agent group and Wallet.
