# @easm-ui/ui (formerly @easm/ui)

Entries from 2.0.2 onward are written by Changesets. Earlier releases are summarised from the release notes in `brand-assets/components/library/README.md` and `brand-assets/design-system/README.md`.

## 3.14.0

### Minor Changes

- Everything universal in one place: the pieces the dashboards, the widget and the forms used to draw for themselves.
  
  - **Brand:** `EasmMascot` (and the framework-free `EasmMascotEngine`), the EASM mascot as a brand character any product can place: expressions, moods, activities and acts, a corner or stage placement, reduced motion and a fallback without WebGL 2. She never makes a sound; lip sync follows audio the host plays. `EasmDotField` takes `contained` to fill its positioned parent instead of the window.
  - **UI, the dashboards' own pieces:** `ProductHomeHero` and `ProductHomeBody` (the dashboard front: the day's numbers, greeting and headline, one large search, chips), `BrandLockup`, `LoadingMark`, `LiveWaveform`, `IconTapMotion`, `ExplainTip`, `PrimaryAction`, `ComingSoon`, `ErrorScreen`.
  - **UI, the apps' pictures:** `FileKindArt` (document, picture, audio, video), `FormQuestionIcon`, `FormTopicPicture` and `ThanksBurst` for public forms.
  - **Icons:** six new drawings (bus, flask, trophy, heart, lightbulb, briefcase; 682 ids), `WIDGET_ICON_NAMES` / `widgetIconName` (`@easm-ui/icons/widget-icons`) for the Ask widget board, and `FORM_FIELD_ICON_NAMES` / `FORM_TOPIC_ICON_NAMES` (`@easm-ui/icons/form-icons`).

### Patch Changes

- Updated dependencies
  - @easm-ui/icons@1.14.0
  - @easm-ui/brand@1.4.0

## 3.13.0

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

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @easm-ui/icons@1.13.0

## 3.12.0

### Minor Changes

- The dashboards' demand list, wave 3: Marketing and Automation in depth.
  
  - **Marketing:** `ProvenanceFigure` and `ProvenanceKey` (how sure a figure is: verified, external, self-reported, provisional, not measured, with the reason), `CreditComparison` (the five attribution models side by side, unattributed at the foot), `JourneyStrip` (one person's touches on a time axis, the lookback window shaded, first and last marked), `TwoBandFunnel` (browsers above, people below, no rate across the line) and `ConnectionCard` (an ad platform whose reporting, conversions and audience sync keep their own state, so data that stopped days ago shows as behind).
  - **Automation:** `InputSourceRow` (who fills an input: the assistant, the signed-in person, a fixed value or EASM; built-in inputs locked with the reason), `RequestBuilder` (the request with each `{slot}` in its source's colour and the request exactly as sent; changing data says so in amber), `JsonView` (a response read-only, shape-only when masked, cut-off output said), `ResponsePicker` (the fields the assistant keeps, in order) and `RuleSentence` (a rule as one editable sentence, with what will happen or what is missing).
  - **Icons (32):** touches and journeys, credit models, how sure a figure is, who fills an input, what a tool does to data, pilot and everyone rollout, and the five kinds of nothing a tool returns.

### Patch Changes

- Updated dependencies
  - @easm-ui/icons@1.12.0

- Fixes from the Live Preview: the select's option panel no longer draws a focus ring of its own when the pointer moves between its rows or into its padding (it flickered on and off). The arrows that page Tabs, QuickFilters, ScrollRow and SegmentedControl are calm pale blue discs with a blue arrow that read on any background, with no half-hidden chip peeking past them, and a press on their top half now counts: a press used to drop them half their height, out from under the finger. Kanban page arrows stay mirrored in right-to-left layouts while pressed.

- `Breadcrumbs` gains `size="line"`: one 18 px line under a page title that is never cut (its links keep a full tap area that takes no room), a long trail folds its middle into "…" (`maxItems`, default 4), and in a phone-width box it becomes one "‹ Parent" link.

## 3.11.0

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

### Patch Changes

- Updated dependencies
  - @easm-ui/icons@1.11.0
  - @easm-ui/brand@1.3.0

## 3.10.0

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

### Patch Changes

- Updated dependencies
- Updated dependencies [0bf32a4]
  - @easm-ui/icons@1.10.0

## 3.9.1

### Patch Changes

- 5081215: A selected item on an ink menu (`DropdownMenu` with `surface="ink"`, or opened inside `data-easm-surface="ink"`) is readable. Ink items are drawn in on-ink text, and the selected item took the pale primary-surface every other panel uses, so the current choice was light text on a light tint (1.03:1). It now deepens the panel with the on-ink brand blue instead (hover a step deeper), with the strongest on-ink text (9.4:1 or better) and an on-ink brand check (4.9:1 or better); browsers without `color-mix` get `ink-panel-hover`.

## 3.9.0

### Minor Changes

- 16c2cbf: `ButtonLink`: a link that looks exactly like a `Button` (the same `variant`, `size`, `leadingIcon`, `trailingIcon`, `block` and `iconSize`), for an action that goes somewhere. It renders through `EasmLink`, so `EasmUIProvider`'s router link keeps navigation client-side. Listed in `navigationComponentNames`.
  
  Overlays follow the direction and language of the place they open from. Menus, selects, comboboxes, popovers, tooltips, dialogs, drawers and confirmation dialogs render at the end of `<body>`, so they used to take the page's direction: a drawer opened from an English region of an Urdu page came out mirrored. Each now reads `dir` and `lang` from its trigger (or, for a modal opened from code, `restoreFocusRef` or the element last pressed or typed in, since Safari does not focus a clicked button) when it opens, and sets them on its panel, so `side="start"` and `"end"` follow too. `Dialog`, `Drawer` and `ConfirmationDialog` take an explicit `dir`. This also fixes `Select` and `DropdownMenu` in right-to-left pages: Radix stamped their trigger and list left-to-right unless told otherwise.

## 3.8.0

### Minor Changes

- The clean white look is the default. The page is white instead of the warm honey paper (`#FBF8F0`), with a cool neutral ramp for surfaces, tracks, borders and text, brighter status colours, a crimson danger that never reads as the brand orange, and brighter chart colours. Blue stays the control colour.
  
  - **Orange for attention:** new tokens `orange`, `orange-hover`, `orange-surface`, `orange-border`, `orange-fill` and `on-orange-fill`, and `orange-ink` now reaches CSS and the runtime. Orange marks what is new or waiting, never a control. The notification count is solid orange with white text (`orange-fill`, 4.5:1), and a sidebar count is orange ink on an orange tint.
  - **Re-exports:** `EasmParticleField` and `EasmDotField` from @easm-ui/brand, so one import covers the product.
  - **Contrast:** the look ran in the EASM One web app as a trial override, where ten pairings fell under WCAG AA. Each failing colour is now darkened just enough to pass every check in `tokens/contrast.mjs`: placeholder, the border (and so the offline presence ring), the success, warning and danger status icons, and the teal and amber chart colours.

## 3.7.23

### Patch Changes

- Ready for an installed app on a phone: a bottom tab bar, safe areas, and stylesheets written mobile-first.
  
  - **`MobileTabBar`:** the phone's navigation, fixed to the bottom in thumb reach: up to four places (`NavigationItem`, as Sidebar takes) and an optional More. It shows below 768px only, stays clear of the home indicator, steps aside while the on-screen keyboard is up, and reserves its own height through `--easm-ui-tabbar-space` (0 without a bar), which pages, toasts and any other bottom-fixed element add to their offset. The current place sits in a soft primary fill; badges use the notification count's colours.
  - **Installed app (PWA):** `--easm-ui-safe-top/right/bottom/left` are the room to keep clear under the notch and the home indicator (0 in a browser tab); a drawer keeps its top clear of the notch; in standalone mode the page no longer rubber-bands, and long-pressing a link or button no longer opens the browser's preview or selects its text.
  - **Mobile-first stylesheets:** a component's phone values are now its base rule, and wider screens add theirs with `min-width` queries beside it (settings sections, the date range picker, the notification popover, empty states and approval cards, the filter bar and pagination, overlays and menu items, the top header, cards, panels, charts, stat cards and their figures, data table headers and toolbars, the message thread, the search trigger, status pill meta). What stays phone-scoped has no wider counterpart: a dialog presented as a bottom sheet and a full-screen drawer, the tab bar, and the 16px text fields that stop iOS zooming. Nothing renders differently at any width: every component preview and an open-overlay fixture were compared property by property before and after, at 15 widths from 320 to 1440px, with a mouse and a touch pointer.

## 3.7.22

### Patch Changes

- A `processing` status turns its spinner, and a badge in a table cell never runs over the next column.
  
  - `StatusBadge status="processing"` (and any Badge whose icon is `spinner`) spins like the Button's busy indicator, so work under way no longer reads as stuck. Reduced motion and `data-easm-motion="off"` keep it still. Keep a status label one stable word ("Building", not "Building · api") and put the step under the badge: a label that changes with each step re-flows its column.
  - A DataTable cell whose content IS a badge, tag or chip is no longer capped below that content. The badge never wraps or squeezes, so under a compact column's cap it spilled over the next cell ("Building · ai-worker" over "no tenant" on the master portal's Releases page); the column now takes its width, as button cells already did.

## 3.7.21

### Patch Changes

- 48 more brand marks, so every system a university connects shows the mark people recognise (64 in all).
  
  - **Campus:** Blackboard, D2L Brightspace and Ellucian (monograms: none publishes a mark for reuse), OCLC WorldShare, BigBlueButton.
  - **Business:** Oracle (Fusion Cloud, HCM), Salesforce, HubSpot, Zoho, Workday (monogram), ADP, Make.
  - **Sign-in, meetings and forms:** Okta, Webex, Calendly, Google Forms.
  - **Websites and files:** WordPress, Drupal, Joomla, TYPO3, Sitecore, Webflow, Wix, Squarespace, Google Drive, Dropbox, Box, Notion.
  - **Marketing:** Meta, Google Ads, Google Analytics, Google Tag Manager, TikTok, LinkedIn, Snapchat, X, YouTube, Mailchimp.
  - **Payments:** Visa, Mastercard, American Express, Stripe, PayPal, and for Pakistan 1LINK (also 1BILL), JazzCash and Easypaisa, drawn from the logos on their own sites.
  - **Channels:** WeChat, Viber.
  
  `BrandIconCategory` gains `business`, `content`, `marketing` and `payments`. A definition can mark itself `monogram`, and a path can be a `backdrop` (1LINK's orange oval) that the mono appearance leaves out, so the mark stays legible in one colour. `@easm-ui/ui` re-exports the new marks.
- Updated dependencies
  - @easm-ui/icons@1.6.0

## 3.7.20

### Patch Changes

- Fields side by side line up their controls; dialogs close cleanly; ListPane; call recordings draw both voices (3.7.20).
  
  - Labelled fields that are the only children of a grid share a label row: a label that wraps no longer pushes its control below its neighbours'. The control and its messages are one `.easm-ui-field-body` (no box of its own elsewhere).
  - Dialog, Drawer and ConfirmationDialog keep what they showed through their closing animation, and a dialog fades as it moves, so closing never leaves an empty panel over the page.
  - ListPane: a list beside a detail, its card holding the title, search and main filters; secondary filters slide away while the list is read downwards and slide back when it is scrolled up.
  - AudioPlayer reads every channel of a recording (a call is stereo: caller on one channel, the assistant on the other).
  - A row of QuickFilters sits inside a FilterBar at its own width.

## 3.7.19

### Patch Changes

- Alert takes `onDismiss` (and `dismissLabel`): a close button in the alert's top corner, as on a toast, with a quiet tint of the alert's own colour on hover. A close button passed as `action` sat under the text.

## 3.7.18

### Patch Changes

- Popover takes a `width` (for a panel with more in it than the 320px default; a width class lost to the popover's own rule) and dims the page behind it while it is open, so the panel has the reader's attention (`dim`, on by default; off for date and time pickers and the filter list, which work like part of a field). A DropdownMenu whose items carry descriptions (the dashboard switcher) dims too. The shade is lighter than a dialog's backdrop and a press on it closes the panel.

## 3.7.17

### Patch Changes

- Sidebar: the collapse control sits at the foot beside the account card (above it in the rail) instead of a row of its own under the brand. Menus: items may carry a `description`, a `selected` mark and a `separatorBefore` divider, and DropdownMenu takes a `heading`; items with descriptions are drawn larger with their icon on a tile. SidebarSwitcher's menu is a 340px panel headed by its label, not a strip the card's width.

## 3.7.16

### Patch Changes

- New AudioPlayer (product layer): a voice message as a pill whose bars are the recording's own loudness and fill in step with the sound as it plays; the bars are the seek bar (drag, click, arrow keys); the length is the file's true length, also for browser recordings whose header carries none; a compact speed control; where the file cannot be read for its loudness the bars are even and still fill with the playback. ConversationListItem takes `actions`: quick actions beside the row's link, shown on hover or focus over a fade in the row's own colour instead of a tile on top of it. The Composer's note placeholder loses its dash.

## 3.7.15

### Patch Changes

- NotificationPattern holds each description to two lines with a Read more / Show less toggle when there is more, takes `onOpen` (also on NotificationCenter) so a whole item opens its page while Read more and Mark read keep their own actions, and spaces items further apart. The notification panel has a hairline edge and takes the screen's width with even margins on a phone.

## 3.7.14

### Patch Changes

- Phone table cards show two fields to a row (label over value), leave empty fields out, put a lone icon action in the card's corner, and keep row actions on one line; a value never pushes a card wider than the screen. In card rows a table's sort controls sit beside Reset filters in its FilterBar, the direction as an arrow. Cells of buttons or end-aligned figures are never capped below their content, and a secondary button stays visible on a hovered row. Select popups are as wide as their longest option (up to 360px) and fade where more options lie. TopHeader actions stay on the menu row on a phone. Choice fields (switch, checkbox, radio) are only as wide as their control, and a CellStack's second line is regular weight.

## 3.7.13

### Patch Changes

- Words never split between letters to make room. Every `overflow-wrap: anywhere` is now `break-word`: a word breaks only when it alone is wider than its space, so table columns, description terms and button labels are no longer squeezed to one letter wide ("Reh/man"); a table that cannot fit scrolls inside its card. Buttons are never narrower than their longest word, whatever their row allows. The phone card layout of a data table still lets a long email or link break anywhere.

## 3.7.12

### Patch Changes

- Badge, Chip and Tag stay on one line. A badge used to break between any two letters and shrink like any flex item, so beside a long title it became one letter wide ("Publis/hed"); it now keeps its own width and the text beside it truncates. A label longer than its whole container ends in an ellipsis, and a long badge label carries its full text as a tip.

## 3.7.11

### Patch Changes

- 6a72ffd: DataTable takes `pageSize`: a long list already in the client shows that many rows at a time with page controls under the table. Sorting covers every row and then pages, and the page resets when the order or the rows change. On a phone, where each row is a card, an 86-row report table was 16,000px tall.

## 3.7.10

### Patch Changes

- d8b7627: From the phone audit on live data:
  - KanbanColumn takes a `footer` (a "Show more" control for a stage shown a page at a time).
  - MetricGroup with three columns pairs an even number of tiles two to a row when narrow (six tiles were six full-width rows), and narrow groups take their figures down to 18px.
  - Stat figures cap at 28px on phones (a full-width card scaled to 34px).
  - An icon-only CopyControl is a subtle ghost icon beside its value, not a filled box.
  - Card-view controls: "Select all" keeps its own width, so the sort control is no longer crushed to 0px wide.

## 3.7.9

### Patch Changes

- afbaf11: `.easm-ui-sticky-fade` for a sticky bar over the page: once the page has scrolled, a short fade in the page colour hangs below the bar so content dissolves under it instead of vanishing at its edge. Scroll-driven CSS; none at the top of the page.

## 3.7.8

### Patch Changes

- 03ce5c6: A narrow FilterBar pairs its filters two to a row (each at least 140px) instead of stacking every filter full width, so a phone shows Stage and Sort side by side.

## 3.7.7

### Patch Changes

- 0c54513: Scroll edges: content leaving a scrolling box fades out at the edge instead of being cut at a hard line, only at an edge with more beyond it. Scroll-driven CSS (no script) on the message thread, command results and overlay bodies; `.easm-ui-scroll-fade` opts any scroller in. Browsers without scroll timelines keep the hard edge.

## 3.7.6

### Patch Changes

- 774097f: Pagination and FilterBar claim their row: as size containers they had no intrinsic width, and in a flex row (a table footer beside "Rows per page") pagination shrank to nothing and set its text one letter per line. On touch screens only text fields grow to 16px (iOS zoom); a dropdown's trigger is a button and keeps the control size. Narrow stat cards without an ⓘ keep the label beside a smaller tile and size the figure's row to the figure, so a phone's 2×2 grid of stats is a third shorter.

## 3.7.5

### Patch Changes

- 29ac23d: The sidebar's current page is blue again: the shared sliding-indicator rule is now zero-specificity (`:where()`), so it no longer outranks the sidebar's primary fill (since 3.7.3 it painted the fill white under white text). A settings nav inside a card slides the track colour, as its current item had before.

## 3.7.4

### Patch Changes

- cf63a74: A FilterBar in a DataTable toolbar is part of the table's card: no panel of its own, the search label is visually hidden (still named for assistive technology), and the toolbar gives an even 16px frame (12px on phones) so the controls sit on one row aligned with the first column.

## 3.7.3

### Patch Changes

- c2ba226: SegmentedControl pages with arrows when it is wider than its space (as Tabs do) and keeps every label whole,
  instead of shortening every segment to an ellipsis. Its outer element is now `.easm-ui-segmented-frame`; the
  radiogroup inside keeps `.easm-ui-segmented`.

## 3.7.2

### Patch Changes

- c8ff185: One-line controls: a SegmentedControl never wraps (its segments narrow, labels end in an ellipsis with the full
  label as the title), a narrow settings layout's section list pages with arrows like Tabs (and its sliding fill
  scrolls with it), a card-layout table keeps Select all and Sort on one line, and the composer's tools fit a
  phone's width.

## 3.7.1

### Patch Changes

- 2bebe22: Scroll containers (message thread, data table, charts, kanban, quick filters, scroll row, composer tools, command
  results, overlay body) contain their absolutely positioned content, so a long list no longer stretches the page
  and makes a full-height screen scroll as a whole.

## 3.7.0

### Minor Changes

- f6849e7: ScrollRow: a single row of chips, filters or thumbnails wider than its space. It never wraps and shows no
  scrollbar; the hidden side fades and arrow buttons page it, like Tabs and QuickFilters, and a vertical wheel
  scrolls it sideways.

## 3.6.2

### Patch Changes

- ebf919f: Motion: entrances leave nothing behind once they finish (backwards fill), so an arrived block holds no transform
  that would trap a fixed bar or start a stacking context; chat messages too. The settings rail's current section
  slides like the sidebar's.

## 3.6.1

### Patch Changes

- 1369ed4: Motion: cards and statistics side by side arrive one after another, the inbox conversation list cascades in
  and a conversation moving to the top rises into place, a new notification rings the bell once and pops its
  count, and a sidebar count pops when it changes.

## 3.6.0

### Minor Changes

- f991277: Motion: one stylesheet for how things arrive, move and settle. A sliding indicator for tabs, segments and the
  sidebar (`useSlidingIndicator`), page and content entrances (`easm-ui-page-head`, `easm-ui-page-flow`,
  `easm-ui-stagger`, `easm-ui-enter`), cascading table rows, rising statistic values, toast and alert entrances,
  shimmering skeletons by default, meters that fill from empty and pressed buttons. `Spinner` now draws the brand
  loaders (`variant="ring"` keeps the ring). New tokens: motion `enter` and `stagger`, eases `ease-out` and `ease-in`.

## 3.5.0

### Minor Changes

- ab29f11: ContactHeader: new `details` prop for several contact lines (email, phone, student id), each with its own icon, stacked under the name. Links in the contact lines are primary-coloured and underline on hover.

## 3.4.1

### Patch Changes

- 11dd5ae: Cards, panels and card-style Collapsibles inside a drawer, dialog or popover now take the honey page fill, so each section stays a distinct block instead of white on white (as in the Support demo's contact drawer).

## 3.4.0

### Minor Changes

- 333ee09: - New `SidebarSwitcher`: the card at the top of a sidebar (initials tile, workspace, and the product under it) whose menu switches workspaces, products or dashboards; a tile alone in a collapsed rail.
  - New `SidebarAccount`: the matching account card for the sidebar footer (avatar with presence, name and role) with the account menu opening upwards.
  - Sidebar: a brand slot holding a switcher stacks the logo above it; links are 36 px tall for mouse and trackpad (touch keeps 44 px).

## 3.3.0

### Minor Changes

- e25b449: Foundation: Tailwind CSS 4 coexistence, one focus treatment, accessible presence and more tokens.
  
  - **Cascade layers.** Rules in `styles.css` that reach bare elements or generic descendants (the box-sizing reset, control typography, `[hidden]` and the focus ring on elements EASM does not own) now sit in `@layer base`, below Tailwind's utilities, so product utilities on product elements win. Component class rules stay unlayered, so Tailwind's preflight never breaks a component. On elements EASM does not own, the focus edge is drawn as an outline over the ring, so a product utility that replaces `box-shadow` (such as `shadow-sm`) no longer hides focus; `outline-none` still removes it.
  - **Focus.** One focus treatment for every focusable element, links and `<summary>` included. In forced-colours (high contrast) mode, focus is now a solid system outline outside the control, even where a component sets `outline: none`. Selection is an inset outline, so focus and selection no longer look the same. A selected item that also has focus shows a double outline.
  - `[hidden]` no longer hides `hidden="until-found"` content.
  - **Presence.** Avatar and UserChip presence dots now differ in shape as well as colour: online is a filled dot, away is half filled and offline is a hollow ring. The offline ring now meets 3:1. The dots stay visible in forced-colours mode.
  - Avatar initials are the same on the server and in the browser, which removes a hydration mismatch in Turkish and Azerbaijani locales.
  - A consumer's `aria-label` on Avatar is respected.
  - New props: `statusLabel` on Avatar and UserChip, `removeLabel` on UserChip, and `copiedLabel`, `copiedMessage` and `errorMessage` on CopyControl. Avatar, UserChip, ModuleIcon and CopyControl accept `ref` and the usual span attributes.
  - OverflowMenu accepts readonly item arrays.
  - **New tokens:**
    - `on-primary-fill`, `on-primary-fill-muted`, `on-danger` and `on-ink-strong`.
    - Toast icon tones: `on-ink-brand`, `on-ink-success`, `on-ink-warning` and `on-ink-danger`.
    - `row-hover`, `switch-hover`, `danger-highlight`, `danger-halo` and `range-fill`.
    - `presence-online`, `presence-away` and `presence-offline`.
    - Font sizes `text-xs` (12 px) and `text-xl` (20 px).
    - Focus rings `--easm-ui-focus-ring-inset` and `--easm-ui-field-error-focus-ring`.
    - Screen size classes, as `tokens.breakpoint` and as the Tailwind variants `easm-medium:`, `easm-expanded:`, `easm-large:` and `easm-wide:`. The variants are in rem (600 px is 37.5rem), the unit of Tailwind's own screens, so they sort correctly with `sm:`, `md:` and `lg:`.
  - Spacing, control size, icon size, line height and label weight are now CSS variables: `--easm-ui-space-*`, `--easm-ui-size-*`, `--easm-ui-icon-size-*`, `--easm-ui-icon-stroke`, `--easm-ui-line-height` and `--easm-ui-weight-label`.
  - `--easm-ui-hit-min` is the touch minimum: 0 on fine pointers and 44 px on coarse ones.
  - The focus ring and halo follow `primary-fill`, so a theme that changes `primary-fill` also changes focus.
  - The badge status icon colours (`icon-success`, `icon-warning` and `icon-danger`) are slightly darker and now meet 3:1 on their badge fills.
  - `tokens.spacing` is keyed by token name: `tokens.spacing[8]` is 32. `tokens.space` is deprecated because `space[8]` is 40.
  - `tokens.z` is new and replaces the deprecated `tokens.layer`.
  - In development, a component warns once if it switches between controlled and uncontrolled.
  - The token build checks more contrast pairs: coloured text and outlines on the honey float panel, presence dots, badge and toast icons, and hovered rows. It also fails when a token reaches no output.
  - `FOUNDATIONS.md` now generates its colour and scale tables from the token source and describes the current focus ring and backdrop.
- b50ddec: Actions and inputs:
  
  - Bad content no longer unmounts a page in production. A blank label, a blank or repeated option value, an empty InlineValidation, a non-finite NumberField value or an invalid FileUpload `accept`/`maxBytes` still throws in development and tests. In a production build it logs one warning and the component carries on: the bad option is dropped, a blank option label shows its value, an empty InlineValidation renders nothing, and a bad NumberField bound is ignored.
  - Combobox: the row you reach with the arrow keys now has the same 2 px inset outline as Select rows. In forced colours it uses the system highlight. The selected row is a white pill, as in Select. The "No matching options." status stays in the DOM, so screen readers announce it. New `openOnFocus` prop (default `true`).
  - Checkbox, Radio and Switch show the full focus ring (a 2 px edge plus halo). Before, they showed only a faint halo, which was invisible on checked controls. The off Switch has its 1 px border (3:1) again. Their required asterisk is now red, like every other field.
  - Buttons keep their focus ring when they are selected or `aria-disabled`. Pressed subtle buttons keep 4.5:1 text contrast. Attached ButtonGroups show a 1 px seam between buttons. Primary and destructive buttons, the Switch hover and the error focus halo now take their colours from tokens.
  - SplitButton and ButtonGroup forward a ref (to the main button and to the group). `block` on SplitButton now stretches the whole split button.
  - IconButton gains `feedback`/`feedbackLabel`, a short success, error or warning mark. The label is announced through one hidden page-level live region (`[data-easm-ui-announcer]`, appended to `body` by a button that uses feedback; errors assertively), because a status inside a button is never read, and it stays the button's description while shown. Button and IconButton gain `iconSize`. This is everything `@easm-ui/icons`' IconButton could do, so move to the `@easm-ui/ui` IconButton.
  - Select: the value truncates on one line, including with `icon` or `appearance="inline"`. When several required Selects are empty, focus goes to the first invalid one and scrolls it into view.
  - FileUpload: removing a file moves focus to the next remove button (or the previous one, or the file input), and the remaining rows keep their place. `error=""` or `error={false}` no longer hides FileUpload's own messages. If every file in a drop is rejected, the earlier selection stays. Rejection bullets now show under Tailwind's preflight.
  - PasswordField's toggle keeps one name, "Show password", and its pressed state says whether the password is visible. The text selection survives the type switch.
  - NumberField: the stepper buttons are out of the tab order (arrow keys already step the value). A field that accepts negative numbers no longer forces a phone keypad without a minus key. A new `inputMode` prop overrides the keypad.
  - Description, error and success now render in a `div`, so block content no longer breaks HTML or hydration.
  - New `hideLabel` on every field, including Checkbox, Radio and Switch. New `DateTimeField` (datetime-local). SearchField now sets `enterKeyHint="search"`.
  - Touch: field text is 16 px on touch screens at every width, so iOS no longer zooms on a phone in landscape. Control heights, icon sizes and touch targets now come from the size tokens.
- c7cebad: Selection, feedback, containers and overlays:
  
  - **Exit animations play.** DropdownMenu, Popover, Tooltip, Dialog, Drawer and ConfirmationDialog stay on screen while they animate out. Before, the panel vanished at once while the scrim was still fading. A menu or popover keeps its surface colour while it fades.
  - **Layering.** The first open dialog now sits above every page menu, popover and tooltip. Modals take z-index bands from 2000 (`--easm-ui-z-dialog` + 1000 per open level), and the bands are released when a modal has finished closing, so z-index no longer climbs by 1000 with every dialog opened in a session. A modal opened while another is still animating out goes above it. Page menus, popovers and tooltips keep 1100 and 1200. An app layer meant to cover dialogs (a toast host) needs a z-index above the modal bands.
  - **Phones.** A Card or Panel with an icon and text actions no longer overflows below 420 px: the actions move to their own row under the title. A single icon button still stays beside the title.
  - **Touch targets of 44 px** on coarse pointers for the Toast dismiss button, FilterControl options and its Clear filters button, and large SegmentedControl segments.
  - **Accessibility.**
    - Body text in a `surface="ink"` Popover now has 10:1 contrast (it was 2.5:1).
    - Destructive DropdownMenu items keep a danger colour on the ink surface, and focus on ink rows is visible. Disabled rows on ink are muted again (they looked enabled).
    - FilterControl's trigger is no longer announced as a toggle button. Active filters still tint it and show their count; in forced-colours mode they keep an inset outline.
    - A DropdownMenu `label` now names the menu; without one, the trigger's name does.
    - Collapsible is a named group, so focus that falls back to it (when its trigger is disabled) announces its title.
    - Drawer's first-field focus skips Radix Select's hidden form control and reaches the Select itself.
    - Accordion focus is visible in forced-colours mode.
  - **Surfaces.** `surface="auto"` reads one declaration per container, `--easm-ui-surface-context`, set on Card, Panel, Collapsible, dialogs, popovers, menus and `data-easm-surface` pins, so the nearest container wins. A `data-easm-surface` pin now applies down to the nearest container inside it: a Card inside a pinned region decides for its own content (before, the pin overrode it). Accordion items inside a white container (honey blocks) open the white sheet. A menu or popover that is open on mount inside a card now gets the honey panel on its first paint. It also recognises SettingsSection, card-style SeriesChart, NotificationPattern, AIActionPattern, Collapsible and Popover as white containers.
  - A neutral Alert inside a white container takes the faint honey fill, like other blocks, instead of vanishing, and its secondary action keeps the usual track fill (it was white on the white alert).
  - Skeleton: `height` with `lines > 1` sets each line's height and the block grows to hold them (the lines used to collapse). A circle given only a width stays round.
  - DropdownMenu `width` above 320 px is no longer capped.
  - Tab and filter rows fade the correct edge in right-to-left pages. Tabs and filter rows follow items that are replaced without their number changing.
  - Dialog and Drawer close buttons and headers use logical sides, so they mirror in right-to-left pages.
  - `data-easm-motion="off"` also freezes the overlay, tooltip, skeleton, progress, spinner and disclosure animations, and the tab, segment and filter-chevron transitions.
  - Bad content no longer unmounts a page in production. A blank label or title, a repeated or blank option ID, an unknown StatusBadge status or an out-of-range Progress value still throws in development and tests. In a production build it logs one warning and the component carries on: the bad option or menu item is dropped, an empty Badge, Chip, Tag, Toast or Alert renders nothing, a Tooltip without text renders only its trigger, a blank label falls back to its default, and Progress and Skeleton values are clamped.
  - Colours on ink (toast tone icons, highlighted menu rows) and the danger highlight now come from tokens; type sizes use the `text-*` tokens.
  - **New props and exports:**
    - `DialogClose` and `DrawerClose`: wrap a footer button to close an uncontrolled Dialog or Drawer.
    - `TooltipProvider`: shares the open delay across a group of tooltips, so moving between neighbouring icons opens the next tip at once.
    - `initialFocusRef` on Dialog and Drawer.
    - `side="start" | "end"` on Drawer, which follows the reading direction.
    - `headingLevel` on Card and Popover.
    - `iconTone` on Collapsible and `appearance` on Accordion.
- 36aa368: Navigation, patterns and pickers:
  
  - Router links: Sidebar, Breadcrumbs and SearchPattern results render through `EasmLink`, so `<EasmUIProvider linkComponent={Link}>` makes their navigation client-side. `aria-current="page"` still marks the current destination.
  - Sidebar: `onNavigate` now runs only for plain primary clicks, so Cmd/Ctrl/Shift-click opens a new tab or window again. Collapsing or expanding keeps keyboard focus on the toggle, and the toggle reports `aria-expanded`. A disabled destination is announced as an unavailable link, and the badge count is read as text. New `id` and `className` props.
  - Breadcrumbs is a Tab stop only while the trail overflows. Its separators and the calendar's previous/next chevrons mirror in right-to-left layouts.
  - CommandBar: the ⌘K / Ctrl K hint no longer causes a hydration mismatch. Pressing the shortcut while the bar is open keeps the original focus-return target. An editor that already handled ⌘K (`defaultPrevented`) or an IME composition keeps the key.
  - FilterPattern and NotificationPattern: after removing a chip, Clear filters, Mark read or Mark all read, focus moves to the next sensible control instead of the page body.
  - SearchPattern shows nothing (or the new `idleContent`) before anything has been searched, instead of "No matching records". SearchPattern and AIActionPattern keep one status region mounted, so screen readers announce each update.
  - EmptyState: optional `description`, plus new `icon`, `compact`, `headingLevel` and `className`. ApprovalPattern, AIActionPattern and NotificationPattern accept `headingLevel` (2–6, default 3).
  - NotificationPattern moves the mark-read action beneath the message in a narrow container, as documented.
  - Pickers: the trigger's accessible name now includes the chosen value as well as the label. The calendar always opens on, and pages within, `min`/`max`, and Previous/Next stop at the bounds. Weekday heads stay distinct in every locale (ur-PK, ar). Reopening DateRangePicker no longer shows an abandoned selection. DatePicker and TimePicker accept `hideLabel`. Clear on an empty picker only closes it.
  - TimePicker: arrow keys, Home/End and PageUp/PageDown move a highlight. Enter, a click, leaving the column or Done commits it, so `onValueChange` no longer runs on every key press; Escape, a click outside, Clear and Now discard it. The highlight ring shows while the column has keyboard focus. You can type to jump (for example "45" or "p").
  - Touch: day cells, times, quick ranges, the month title and the range button are 44 px on coarse pointers.
  - Visible focus on filled items (the current sidebar link, the selected day or month) and in forced-colours mode. Outside-month days use secondary text (at least 4.5:1). Picker colours and type sizes come from tokens.
  - FormPattern styles only its own fieldset and keeps error-summary bullets under Tailwind preflight. TopHeader no longer adds 16 px of padding on phones.
  - In production builds, blank labels, duplicate ids and invalid counts in these components now warn once instead of throwing; development and tests still throw.
  - New exported types: `BreadcrumbsProps`, `CommandBarProps`, `WorkspaceSwitcherProps` and `FilterPatternProps`. WorkspaceSwitcher passes `hideLabel`, `size`, `appearance`, `icon`, `name` and `className` through.
- 582d832: Data display, insights and charts:
  
  - Numbers: values between 0 and 1 keep their significant digits everywhere (legends, tooltips, keyboard read-outs, data tables, `formatDataValue`), so a rate of 0.02 no longer shows as "0". Axis labels get as many decimals as the tick step needs (0.25, not "0.3").
  - SeriesChart: the y-axis follows the data instead of stretching to at least 1, so small rates fill the plot. Charts whose values are all whole numbers get whole-number ticks (no more 0.25 steps on a count axis). New `integerTicks` prop to force this on or off.
  - SeriesChart: an area no longer turns black when a series id contains a space. A stacked area stops at a category where a shown series is missing, instead of dipping as if it were zero (and draws no hover dots there). While loading, the legend stays and the data-table toggle's space is kept, so the card no longer changes height when data arrives. The tooltip opens towards the side with more room and stays inside the plot. The keyboard instructions are a description, not part of the chart's name. The last visible legend chip says why it cannot be hidden (`aria-disabled` plus a description).
  - Chart titles: the figure is named by the title alone; the ⓘ button is no longer part of its name.
  - DonutChart states its centre total for screen readers. Heatmap reports the real peak (0.4 stays 0.4, and "no measured values" when nothing was measured) and colours levels against it.
  - ProgressRing, Gauge and Funnel draw nothing at zero (no dot from a round cap, no minimum-width bar). ProgressRing has a new `kind="level"` prop for measured amounts, read as a meter; the default stays a progress bar.
  - Missing values ("—") are read as "Not available" (BarList: "Not measured") through visually hidden text, instead of an `aria-label` on a plain span that screen readers could skip. DataTable cells without a `render` use the same element for a missing value. StatCard, MetricTile and DescriptionList treat a blank string as missing.
  - Caller labels keep their case in built-in text ("of WhatsApp continued", "Search WhatsApp filters", "Loading Conversations.").
  - Keyboard focus: Pagination's Previous and Next, DataTable sort buttons and select-all are soft-disabled (`aria-disabled`) at the first or last page and while loading, so focus stays on them instead of falling to the page. Soft-disabled controls keep their disabled look on hover and read as disabled (GrayText) in forced-colours mode. Focus rings use a transparent outline that forced-colours mode shows.
  - DataTable `narrowLayout="cards"`: when the card rows are showing, sorting and select-all move to a visible control row ("Select all", "Sort by", direction), and the hidden column headings keep their text but no hidden focusable controls. The table re-renders only when its width crosses the card threshold, not on every resize.
  - DataTable: a `description` shows without a `title`. Scroll regions are a region and a Tab stop only when they actually scroll (also in chart data tables, Heatmap and Chart). Rows hover with a token colour. Badges and buttons in a table keep their own size. New props: `headingLevel`, `maxHeight` (rows scroll inside the card under sticky column headings) and `timeZone` for dates.
  - `formatDataValue(value, locale, { timeZone })` takes an optional time zone (new `FormatDataValueOptions` type), so a server and a browser in different zones print the same date.
  - StatCard is a named group instead of a landmark region, and accepts `headingLevel`. Chart accepts `headingLevel`; its bars are sized from their category, so long series keep readable bars. Its loading placeholder rule no longer reaches SeriesChart.
  - Pagination: new `locale` prop; record counts are formatted for it (1,250).
  - FilterBar no longer announces its name twice.
  - MetricGroup steps its columns down (4 → 2 → 1) and BarList switches to its narrow layout by their own width, so both adapt outside a Card or Panel too.
  - InfoHint has a 24 px target on a mouse and 44 px on touch, with the same 20 px glyph. Links in BarList and CellStack are 44 px tall on touch.
  - BarList and CellStack links render through `EasmLink`, so `<EasmUIProvider linkComponent={Link}>` makes them client-side.
  - In production builds, blank labels, repeated ids and out-of-range values in these components now warn once and render what they can (a value is drawn at the nearest end of its scale, a negative share as zero) instead of throwing; development and tests still throw.
  - New exports `chartToneStyle(tone)` and `chartToneColor(tone)`, the tone plumbing the charts use, for product-owned chart chrome. DescriptionList supports the documented `data-banded` rows.
- 2af679d: Inbox, settings and pipeline:
  
  - Router links: ConversationListItem, SettingsNav and LeadCard render through `EasmLink`, so `<EasmUIProvider linkComponent={Link}>` makes their navigation client-side.
  - Refs are typed on every component in these layers (`ref` prop, React 19). Composer and PromptEditor give you their text field; Slider adds `inputRef` for its range input.
  - Composer: `rows` and `ref` now work. `onFormat(format, selection)` and `onTemplate(selection)` receive the field and its selection, so a caller can wrap the selected text or insert at the caret. `disabled` also disables the Reply / Internal note switch. The field is described by `notice` and by the send shortcut (`aria-keyshortcuts`). The hint shows ⌘ on Apple devices, decided after mount so there is no hydration mismatch. Ctrl/⌘+Enter leaves an IME composition and a handler that already took the key alone. The focus ring is a solid edge plus the halo, and the field no longer draws a second ring inside it. In note mode, icons no longer show a white disc. Draft with AI, the tool buttons and Save note keep Button's disabled, hover and pressed fills.
  - Message: new `delivered` state, a clock for `sending`, and `onRetry` (with `retryLabel`) for an always-visible Retry on a failed message. A failed message keeps its actions visible. `streaming` marks a reply busy while it is written. Lists, code and long `pre` lines inside a message are styled and scroll inside the bubble. Links in a message are underlined and lists keep their markers, also under Tailwind's preflight; these content rules sit in `@layer base`, so a Tailwind utility on your own element inside a message wins. The footer wraps on a phone instead of overflowing.
  - MessageDivider is plain text, so screen readers read "Today" inside the log. MessageThread no longer smooth-scrolls programmatic jumps.
  - QuickFilters: counts are formatted the same on the server and the client. The selected chip is scrolled into view when the value changes from outside.
  - ScorePill: `scale={1}` takes a 0–1 fraction, and `level` sets the level from your own source of truth (`high`, `medium`, `low`, `hot`, `warm`, `cool`, `cold`). It warns once when a fraction is passed on the 0–100 scale.
  - ConversationListItem forwards `ref`, `id`, `style` and data attributes to its `li`, for virtualised lists, and `onSelect` receives the click event.
  - SettingsNav: Cmd, Ctrl, Shift or Alt-click and middle-click on a linked item open the link again, instead of being turned into an in-page switch.
  - SettingRow: `descriptionId` lets a control named through `htmlFor` reference the description in its `aria-describedby`.
  - Slider: a disabled slider's filled track is grey in every browser. Marks sit correctly in right-to-left layouts. The input box no longer draws a focus rectangle, because the thumb carries the ring.
  - PromptEditor keeps your `aria-describedby` and `onSelect`. Variable chips update after a selection change, are 44 px on touch, and take their hover colour from tokens.
  - KanbanBoard: the drop slot is drawn where the card will land and stays still under a still pointer. A card dropped back where it was is not reported or announced. New `reorder={false}` for stages that sort themselves, and `onDraggingChange` for pausing refreshes during a drag. A repeated move is announced again. Empty stages on a read-only board say "Nothing here yet" (`readOnlyEmptyLabel`). Fades sit on the correct side in right-to-left layouts. Column header actions keep Button's disabled colour. A lead card's name link shows its whole focus ring (it was clipped by the ellipsis).
  - Focus: these components use the shared focus treatment. In forced-colours mode, the current conversation and the current settings section show an inset ring, and with focus they also show a double ring.
  - Radii come from the scale (the settings menu icon tile is now `radius-control`). Translucent white overlays are replaced by token mixes, so icon cut-outs match their fill. White ink on primary and danger fills (agent messages, the pressed quick filter, the notification count, the channel mark, the current settings icon) uses `--easm-ui-on-primary-fill`, `--easm-ui-on-primary-fill-muted` and `--easm-ui-on-danger`.
- cc1a5c8: - New `EasmUIProvider` (`linkComponent`), `EasmLink` and `useEasmLink`: pass your router's link once (Next.js `Link`) and every link EASM UI renders navigates client-side.
  - README: router-link setup for Next.js, and how the base rules now sit in `@layer base` so Tailwind utilities on your own elements win.

### Patch Changes

- Updated dependencies [19a9bfa]
- Updated dependencies [9baf936]
  - @easm-ui/icons@1.5.0
  - @easm-ui/brand@1.1.0

## 3.2.0

### Minor Changes

- Brand kit: `@easm-ui/ui` now depends on and re-exports `@easm-ui/brand` 1.0.0, the EASM logo v6 (`EasmLogo`, `EasmMark`, `BRAND`, `PRODUCTS`, `BRAND_COLOURS`, `LOGO_RULES`) and the app motion kit 1.1 (`EasmIcon` in twelve states, `EasmWaveform`, `EasmDots`, `EasmTypingDots`). Logo files (SVG, PNG, favicon) ship in `@easm-ui/brand`.

## 3.1.0

### Minor Changes

- Ready to use in any EASM app:
  
  - `easm-ui-page`: an opt-in page class with the honey page, Inter and the body text colour.
  - `@easm-ui/ui/tailwind.css`: a Tailwind CSS v4 theme generated from the tokens (`bg-easm-surface`, `text-easm-text-secondary`, `rounded-easm-card`, `font-easm`…).
  - Install guide covering the GitHub Packages token, Next.js, Vite, Tailwind, CI and Docker; verified by installing the published packages into fresh Next.js 16 and Vite apps.

## 3.0.0

### Major Changes

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

### Patch Changes

- Updated dependencies [a3520d5]
  - @easm-ui/icons@1.4.0

## 2.0.2

### Patch Changes

- Token values are now generated from `tokens/easm.tokens.json` (DTCG format) by `pnpm tokens`. `tokens.css` and the `tokens` export keep the same names and values.

## 2.0.1

- Retains all 47 core and 18 higher-layer component names and Icons 1.3.1.

## 2.0.0

### Major changes

- `Select` uses the same branded popup as `DropdownSelect`. Breaking for native `Select` consumers: replace `onChange={event => setValue(event.target.value)}` with `onValueChange={setValue}`, and change refs and trigger event types from `HTMLSelectElement` to `HTMLButtonElement`. `name`, `form`, `required`, `autoComplete`, uncontrolled reset and disabled/read-only behaviour are unchanged.

## 1.2.2

- Vendored icons refreshed to `@easm/icons` 1.3.1. Component APIs, tokens and responsive behaviour unchanged.

## 1.2.1

- Responsive revision: fields fit narrow panels; dialogs and drawers use dynamic viewport height; narrow coarse-pointer fields use 16px text and 44px minimum targets; tables keep column minimums and charts keep 12px labels.

## 1.2.0

- Adds five navigation controls, six data components and seven interaction patterns.

## 1.1.1

- Fixes a disabled `SplitButton` menu that could still be activated.
