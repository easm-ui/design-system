# @easm-ui/brand

Entries are written by Changesets.

## 1.4.0

### Minor Changes

- Everything universal in one place: the pieces the dashboards, the widget and the forms used to draw for themselves.
  
  - **Brand:** `EasmMascot` (and the framework-free `EasmMascotEngine`), the EASM mascot as a brand character any product can place: expressions, moods, activities and acts, a corner or stage placement, reduced motion and a fallback without WebGL 2. She never makes a sound; lip sync follows audio the host plays. `EasmDotField` takes `contained` to fill its positioned parent instead of the window.
  - **UI, the dashboards' own pieces:** `ProductHomeHero` and `ProductHomeBody` (the dashboard front: the day's numbers, greeting and headline, one large search, chips), `BrandLockup`, `LoadingMark`, `LiveWaveform`, `IconTapMotion`, `ExplainTip`, `PrimaryAction`, `ComingSoon`, `ErrorScreen`.
  - **UI, the apps' pictures:** `FileKindArt` (document, picture, audio, video), `FormQuestionIcon`, `FormTopicPicture` and `ThanksBurst` for public forms.
  - **Icons:** six new drawings (bus, flask, trophy, heart, lightbulb, briefcase; 682 ids), `WIDGET_ICON_NAMES` / `widgetIconName` (`@easm-ui/icons/widget-icons`) for the Ask widget board, and `FORM_FIELD_ICON_NAMES` / `FORM_TOPIC_ICON_NAMES` (`@easm-ui/icons/form-icons`).

## 1.3.0

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

## 1.2.0

### Minor Changes

- `EasmParticleField`, an opt-in dashboard atmosphere: a coherent perspective particle mesh with a periodic travelling wave, restrained EASM orange/rust and steel lighting, subtle material highlights and stationary grain, in charcoal, paper and steel treatments, with a server-rendered vector poster and a framework-free painter. It expresses Connect · Check · Act as separated input streams joining a shared amber layer and leaving in a coordinated flow, with optional mouse response. The clock freezes when paused, hidden or offscreen; reduced motion and the global motion switch show a still; rendering cost is bounded; the layer stays out of focus and assistive technology and passes all input through. Review gallery in `brand-assets/dashboard-atmosphere`.
- `EasmDotField`: the dot field behind a product's home page, moved here from the EASM One web app. It is a fine field of dots drawn on the GPU: a cursor lens, ripples on a click, and the living EASM mark drawn in dots wherever the page places an element with `data-easm-mark-anchor`. It reads its colours from the EASM UI tokens, paints one still frame under reduced motion, and paints nothing without WebGL.

## 1.1.0

### Minor Changes

- 9baf936: Brand and motion fixes:
  
  - EASM's speech can no longer go silent: an `<audio>`/`<video>` passed as `level` is only routed through Web Audio while a voice state animates (never under reduced motion), the shared AudioContext resumes on the element's `play` event and on the first click or key press, and media from another origin without CORS is never captured (it plays unchanged). New `primeEasmAudio()` for the click that starts a voice session, and `meter.onError` reports a source that cannot be measured.
  - `EasmDots` and `mountDots` animate inside a shadow root (the chat widget): their CSS is added to that root as an adopted stylesheet, and nothing lands in the host page's head. `tokens/easm-dots.css` ships the same CSS for server-rendered pages.
  - `EasmDots` is now announced: the status region holds its label as visually hidden text, filled in a moment after the region appears (a live region that arrives already holding its text is often not read). An `aria-label` you pass is the name and the announced text. New `announce={false}` makes it a named image for chats that own one live region.
  - Names: `title=""` or `label=""` makes `EasmLogo`, `EasmMark`, `EasmIcon` and `EasmWaveform` decorative; an `aria-label` or `role` you pass is no longer overwritten on the logo; `mountIcon` and `mountWaveform` name themselves after their state and mode (new `label` option and `setLabel()`); `EasmMark product="One"` is named "EASM One".
  - Removing `data-easm-motion="off"` starts frozen icons and waveforms again; the switch also works on the dots element itself.
  - `EasmIcon` no longer replays its state on mount under React StrictMode, paints its state on mount without a fade from the still mark, keeps an inline `level` function without rebuilding the meter on every render, and keeps a `railColor` override when the theme changes.
  - Stacked, wordmark and descriptor lockups ignore `product` (no lit rail beside the full name), with a development warning.
  - `EasmLogo` scales down to fit a narrow container instead of overflowing a phone screen.
  - Colours and names placed in SVG markup are escaped.
  - The animated SVG files (`svg/icon`, `svg/waveform`, `svg/frames`) are scoped per file, so several can be inlined on one page and their reduced-motion rule no longer stops every animation on the page.
  - PNG files are losslessly recompressed (about 17% smaller, identical pixels).
  - `FULL_NAME` is `BRAND.fullName`; `ICON_TIMING.blendOneShot` and `DOTS_HEIGHT` are exported; the motion tokens, the artwork and the SVG scoping can be regenerated and checked from the package (`motion-tokens`, `artwork:check`, `scope-svg`, `test`).

## 1.0.0

- First release: the EASM logo v6 (`EasmLogo`, `EasmMark`, the artwork builders and the SVG, PNG and favicon files), the brand data (`BRAND`, `PRODUCTS`, `BRAND_COLOURS`, `LOGO_RULES`) and the app motion kit 1.1 (`EasmIcon` in twelve states, `EasmWaveform`, `EasmDots`, `EasmTypingDots`, the engines and the motion tokens).
