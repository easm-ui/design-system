# @easm-ui/brand: the EASM brand kit

Logo v6 (locked October 2026) and the EASM One app motion kit, ready to place. Every value comes from the EASM brand guidelines and the motion kit 1.1.0. Nothing here is redrawn: place it, don't recreate it.

`@easm-ui/ui` re-exports the components (`EasmLogo`, `EasmMark`, `EasmIcon`, `EasmWaveform`, `EasmDots`, `EasmTypingDots`, `EasmParticleField`) and the brand data (`BRAND`, `PRODUCTS`, `BRAND_COLOURS`, `LOGO_RULES`), so an app that only places those needs no second install. Everything else needs `@easm-ui/brand` installed directly: the artwork builders (`logoArt`, `svgFile`…), the engines and `mountIcon`/`mountWaveform`/`mountDots`, the motion metadata, `primeEasmAudio`, and the `svg/`, `png/` and `tokens/` files.

```tsx
import { EasmLogo, EasmMark, EasmIcon, EasmWaveform, EasmDots } from '@easm-ui/ui'; // or '@easm-ui/brand'
```

**Server components:** `EasmLogo` and `EasmMark` render on the server. `EasmIcon`, `EasmWaveform` and `EasmDots` imported from `@easm-ui/brand` must sit in a `'use client'` module (`@easm-ui/ui` already is one).

## The name

- **EASM** stands for Enterprise Applications & Systems Management (with the ampersand).
- **EASM One** is the platform: the AI layer for universities.
- The products are **EASM Forms, EASM Calling, EASM Ask, EASM Kiosk, EASM Library and EASM Clouds**, and EASM One's dashboards **EASM Support, EASM Knowledge, EASM Marketing and EASM Automation** (Forms is both). `PRODUCTS` lists them with one-line descriptions. Every product shares the mark and its lit rail; in the interface the dashboards are told apart by their glyphs in `@easm-ui/icons` (`dashboard-support`, `dashboard-knowledge`, `dashboard-marketing`, `dashboard-automation`, `dashboard-forms`).

## Logo

```tsx
<EasmLogo />                                // EASM, horizontal, 24 px tall, full colour
<EasmLogo product="One" />                  // EASM One (the platform: core only)
<EasmLogo product="Forms" />                // a product lights the right-hand rail
<EasmLogo product="One" theme="dark" />     // reversed, on dark grounds
<EasmLogo variant="stacked" height={96} />  // square spaces, profiles, signage
<EasmLogo variant="wordmark" />             // when the icon is already nearby
<EasmLogo variant="descriptor" />           // EASM + its full name: letterheads, footers, first contact
<EasmMark size={32} />                      // the icon alone: collapsed sidebar, avatars
<EasmMark tile product="Calling" />         // the app icon / favicon tile
```

| Prop | Values |
|---|---|
| `product` | `One`, `Forms`, `Calling`, `Ask`, `Kiosk`, `Library`, `Clouds`, `Support`, `Knowledge`, `Marketing`, `Automation`, or any future name (set in Geist Regular; load the font) |
| `variant` | `horizontal` (default), `stacked`, `wordmark`, `descriptor`, `descriptor-under` |
| `theme` | `light` full colour (default) · `dark` reversed · `ink` one colour · `white` one colour, for photo and video watermarks |
| `height` | px or CSS length; width follows the artwork's proportions. In a narrower container the lockup scales down whole instead of overflowing |
| `title` | the accessible name (default: the lockup's text). `""` makes it decorative, for when text beside it already says it. An `aria-label` you pass wins |

Only the horizontal lockup carries a product: `stacked`, `wordmark`, `descriptor` and `descriptor-under` are EASM's own and ignore `product` (a development warning says so). `EasmMark product="One"` is named "EASM One".

**Rules.**
- **Minimum sizes:** icon 16 px, EASM lockup 20 px tall, product lockup 24 px tall, wordmark 48 px wide.
- **On a 320 px phone** (288 px of content): product lockups up to 42 px tall, the descriptor up to 39 px; anything larger scales down to fit.
- **Clear space:** half the cap height on every side.
- **Sidebar:** the lockup is 24 px tall, inset 16 px, on white. Collapsed, the icon stands alone at 32 px. Inside a product, use that product's lockup at the same size.
- **Never** stretch it, recolour it, type it in a font, place it on Enterprise Blue or a busy ground, light more than the right-hand rail, add effects, or pair the full name with a product lockup.

`LOGO_RULES` holds all of these, and `BRAND_COLOURS` the palette.

### Files

Ready-made artwork, for places that are not React. Every file is generated from the same builder as the components.

| Folder | What |
|---|---|
| `svg/logo/` | `easm-{light,dark,ink,white}.svg`, `easm-one-…`, `easm-forms-…` and each product; `easm-wordmark-…`, `easm-stacked-…`, `easm-descriptor-…`, `easm-descriptor-under-…`; `easm-mark-…` and `easm-<product>-mark-{light,dark}.svg` |
| `svg/app-icon/` | `easm.svg` and `easm-<product>.svg` tiles |
| `png/app-icon/` | the tiles at 512, 192 and 180 px (losslessly compressed) |
| `png/favicon/` | `favicon.svg`, `favicon.ico` (16, 32, 48) and PNGs |
| `png/logo/` | EASM and EASM One lockups at 96 px tall, light and dark |

Use them like this:

```html
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/easm-180.png">
```

If code needs the raw markup, `logoArt()`, `markArt()`, `tileArt()` and `svgFile()` return it. Colours and names passed to the builders are escaped.

`pnpm --filter @easm-ui/brand artwork` regenerates every file from the builder; `artwork:check` (part of `pnpm test`) fails when a file on disk differs.

## Motion

The animated icon, the voice waveform and the dots come from the app motion kit 1.1.

```tsx
<EasmIcon state="thinking" />                               // 24 px; mount one icon and change its state
<EasmIcon state="speaking" level={ttsAudio} />              // the core glows with EASM's real voice
<EasmIcon state="listening" level={micStream} />            // the user's voice pours in along their rail
<EasmIcon state="done" onComplete={() => setState('idle')} />
<EasmWaveform mode="listening" level={micStream} height={28} />
<EasmWaveform mode="loading" bars={12} />
<EasmDots />                                                // typing, in the text colour
<EasmDots variant="searching" color="#FF6A00" size={5} />
```

- **`EasmIcon` states:** `idle`, `connecting`, `thinking`, `searching`, `toolCalling`, `writing`, `awaiting`, `listening`, `speaking`, `done`, `error`, `offline`. Changes between states blend over 0.5 s, or 0.28 s into `done` and `error`. `theme="dark"` gives paper rails for dark grounds; `railColor="currentColor"` makes the rails follow the text colour.
- **`EasmWaveform` modes:** `idle`, `loading`, `listening`, `speaking`.
- **`EasmDots` variants:** `typing`, `searching`, `thinking`.

**Names.** Each component names itself after its state, mode or variant; `title` (icon) or `label` (waveform, dots) replaces the name, an `aria-label` you pass wins over both, and `""` makes the icon or waveform decorative. `EasmDots` is a status live region holding its label as text (filled in a moment after the region appears, which is when screen readers reliably hear a live region), so it is announced when it appears or changes; `announce={false}` makes it a named image instead, for a chat that announces progress in one live region of its own (the better pattern when messages stream in).

**Audio.** Prefer an `AnalyserNode` from your own playback context, the microphone `MediaStream`, or a 0–1 number/function for `level`. An `<audio>`/`<video>` element works, but once measured it is heard through the page's shared AudioContext for good, so:
- it is only captured when a voice state (`speaking`, `listening`) actually animates, never under reduced motion;
- the shared context resumes on the element's `play` event and on the first click or key press; call `primeEasmAudio()` in the click handler that starts a voice session to be sure (Safari);
- media from another origin without CORS (`crossOrigin` unset) is never captured, because Web Audio would mute it: it plays unchanged and the animation follows its fallback. `meter={{ onError }}` reports this.

**Reduced motion:** everything stops under `prefers-reduced-motion`, or inside an element with `data-easm-motion="off"` (on an ancestor, or on the dots themselves). Removing the attribute starts the animations again.

**Shadow DOM:** `EasmDots` and `mountDots` add their CSS to the shadow root they render in (as an adopted stylesheet, which a strict CSP allows), so the chat widget's dots animate. For server-rendered pages, include `tokens/easm-dots.css` (the same CSS as `DOTS_CSS`).

**Without React:** `mountIcon`, `mountWaveform` and `mountDots` from `@easm-ui/brand/engines`. Their names follow the state and mode; pass `label` to fix one (`''` for decorative).

**Matching CSS:** the timing tokens are in `tokens/easm-motion.css` (`--easm-motion-*`). Static poster frames of every state are in `svg/icon/`, `svg/frames/`, `svg/waveform/` and `svg/dots/`. Their classes, keyframes and ids carry the file's own prefix, so several can be inlined on one page, and their reduced-motion rule only stops their own animation.

**Generated files:** `pnpm --filter @easm-ui/brand motion-tokens` writes `tokens/*` (and the state tables in the kit's README) from the engines; `scope-svg` scopes newly exported motion SVGs. `pnpm --filter @easm-ui/brand test` checks all of them against a fresh build, plus server rendering, names and escaping.


## Dashboard atmosphere

`EasmParticleField` is an opt-in decorative background: separate incoming system streams that join through a shared amber intelligence layer and continue as an ordered particle surface, restrained EASM orange/rust lighting, muted steel light and stationary fine grain. Two translucent material highlights follow the same sheet. It contains no text, logos or floating objects. It does not replace the identity mark or a real activity indicator.

```tsx
'use client';
import { EasmParticleField } from '@easm-ui/ui'; // also @easm-ui/brand

export function WelcomeSurface() {
  return <section style={{ position: 'relative', isolation: 'isolate', minHeight: 480 }}>
    <EasmParticleField variant="charcoal" intensity={.65} />
    <div style={{ position: 'relative', zIndex: 1, padding: 32 }}>
      {/* Use readable foregrounds and opaque controls; keep the logo on a quiet neutral surface. */}
    </div>
  </section>;
}
```

| Prop | Default | Purpose |
| --- | --- | --- |
| `variant` | `charcoal` | `charcoal`, `light` (paper) or `steel` atmospheric ground |
| `interactive` | true | Smooth pointer attraction, local lighting and subtle camera response; controls keep their input |
| `intensity` | `.82` | Particle and gel visibility, clamped to 0–1; atmosphere remains present |
| `speed` | `1` | 32-second natural cycle; `.5` gives 64 seconds; clamped to .25–2 |
| `paused` | false | Freeze the current frame; continue from it on resume |
| `phase` | unset | Fixed inspection pose in turns; 0 and 1 match exactly |
| `style`, `className`, `ref` | unset | Surface placement and normal container access |

The abstract sequence expresses EASM’s Connect · Check · Act vision: separate systems feed a shared intelligence layer before continuing in a coordinated flow. This is illustrative, not live activity telemetry.

The component is a client boundary, but server-renders a vector poster using the same projected particle positions. Canvas rendering uses no third-party graphics library or network assets. Passive pointer listeners steer a smoothed local deformation and light response; they never capture or prevent input. Paused/fixed inspection poses and reduced/off motion settings also suppress pointer animation. It is always decorative, hidden from assistive technology and unable to intercept pointer events. The containing surface owns its size, content and readable foregrounds. Paper uses muted steel particles for contrast; dark treatments use luminous warm-white dots. These are atmospheric palettes, not new UI control or logo tokens.

`prefers-reduced-motion`, `[data-easm-motion="off"]` and `[data-easm-motion="reduced"]` restore a static phase 0. Pausing, hidden documents and offscreen surfaces freeze the clock and cancel animation scheduling. Resuming does not jump by the time spent away. Resize and unmount clean up observers and listeners. Rendering is limited to 30 fps, DPR 1.5 and a 2400×1600 backing-store budget. Local browser timings do not certify every device; prefer one ambient surface per workspace and use a still where animation adds no value.

For non-React surfaces, `renderParticleField(ctx,width,height,phase,options)` and `getParticleFieldPoints(...)` from `@easm-ui/brand/engines` expose the deterministic painter and geometry; the caller owns canvas sizing, DPR, visibility and the clock. `EASM_BACKGROUND_PALETTES` and `EASM_PARTICLE_LOOP_MS` are exported from both package entries.



## The mascot

`EasmMascot` is the EASM mascot: a fluffy WebGL 2 character drawn entirely in code (no images), with 69 expressions (the expression library's four sheets of sixteen plus `love`, `starstruck`, `sulky`, `sassy`, `dreamy`), short acts (wink, giggle, yawn, twirl…), feelings that rise and fade, gaze that follows the pointer, and soft-body physics. Like the logo, she belongs to the brand: any EASM product may host her. She is not an assistant, has no name, and never makes a sound; a host that plays audio may lend her its level for lip sync.

```tsx
'use client';
import { EasmMascot } from '@easm-ui/ui'; // also @easm-ui/brand

// In a box: she fills it.
<div style={{ width: 280, height: 280 }}><EasmMascot expression="happy" activity="greeting" /></div>

// Over the page, in a corner, opening something when clicked:
<EasmMascot placement="corner" corner={{ right: 24, bottom: 22 }} size={46} color="#1F6FEB" onActivate={openChat} />
```

| Prop | Default | Purpose |
| --- | --- | --- |
| `placement` | `stage` | `stage` fills its element; `corner` floats her over the page (fixed for the mount) |
| `expression`, `expressionHold` | unset, for ever | A held pose (`MASCOT_EXPRESSIONS`), or `null` to let her feelings choose |
| `mood`, `activity` | unset | Broad mood; what she is doing (idle, greeting, thinking, writing, listening, speaking) |
| `corner`, `perch`, `size`, `layer` | `{ right: 24, bottom: 22 }`, null, 46, 2147482900 | Corner placement: her home, a ledge to stand on, skin radius, z-index |
| `color` | crimson | Coat colour, `#rrggbb` |
| `paused`, `reducedMotion`, `personality`, `light`, `mouthZipped` | false, system, true, coarse pointer, false | Frame loop, motion, feelings, lighter coat, zipped mouth |
| `onActivate`, `onEvent`, `onReady`, `onUnavailable`, `fallback` | unset | Click/Enter; interaction names; the engine; no WebGL 2 and what to render then |
| `audioLevel`, `viseme` | unset | Host-driven lip sync |

`onReady` hands over the engine (`EasmMascotEngine`, also usable without React: `new EasmMascotEngine(canvas, options)`) for `play(act)`, `hop()`, `lookAt(x, y | 'viewer' | null)`, `notice('snubbed' | 'unanswered' | 'attended')`, `setTalking`, `moodWord()`, `onFrame(listener)` (her position each frame, for a bubble beside her), `setDropFloor`, `dropOnto`, `setBadge`, `attachAudio`/`feedSpeech`, `getSnapshot()`.

**Behaviour.** Reduced motion (the system preference, or `reducedMotion`) removes travel, squash, roll, coat motion and symbol drift; expressions, gaze and blinks remain. Without WebGL 2 nothing is drawn: `fallback` renders and `onUnavailable` fires. In `stage` she is `role="img"` with `label`; in `corner` an invisible focusable button carries the name and Enter activates her. The canvas is created on mount, so server rendering emits only the empty host.

**Rules.** One mascot per page. She is a companion beside a product's own interface, never a replacement for its controls, a loading indicator, or the logo. Never give her a name, a voice or an assistant's words in code; what she says belongs to the host, in its own bubble. Source notes on the motion and physics: `src/mascot/PHYSICS-REFERENCES.md`.
