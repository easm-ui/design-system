# @easm-ui/icons

EASM One's SVG icon set as React components: `npm install @easm-ui/icons`. The version is in `package.json` and the changes in `CHANGELOG.md`.

```tsx
import { Icon, InboxIcon } from '@easm-ui/icons';
import '@easm-ui/icons/styles.css';

<InboxIcon size={20} tone="neutral" />
<Icon name="send" size={20} label="Send" />
```

For icon-only buttons use `IconButton` from `@easm-ui/ui` (variants, sizes, the honey theme, the focus halo and 44 px targets on touch). The `IconButton` in this package is deprecated and kept only for compatibility.

The library has 676 ids: 532 distinct drawings, 619 preferred names and 57 compatibility names that keep older ids working with their existing meaning. Prefer intuitive ids such as `download`, `sync`, `sliders`, `graduation-cap`, `users` and `speaker-volume`. `more-horizontal` (More actions) is the shared overflow glyph. `subtract` shares the exact horizontal bar of `add`.

## Names, metadata and bundle size

- `<Icon name>` reads only the geometry registry (id to drawing, with ids that share a drawing sharing one array). It does not ship search metadata or legacy aliases. Measured with esbuild (React external, minified): about 68.5 KB raw, 13.4 KB gzip, 11.1 KB brotli for every id. `IconButton`, `AnimatedIcon` and every glyph in `@easm-ui/ui` use the same registry.
- Individual exports (`InboxIcon`) and `@easm-ui/icons/icons/<id>` modules carry only their own drawing, about 1 KB gzip each. Prefer them in the embedded widget and other size-critical bundles.
- `isIconName` and `iconNames` come from the same registry. Validate names that come from data (manifests, the database) with `isIconName` before rendering: an unknown name throws in development, and in production it is logged once and renders an empty box of the requested size.
- `getIconMetadata(name)` returns `displayName`, `preferredName`, `compatibilityOnly`, `sharingType`, `searchTerms` and `family`; `preferredIconNames` lists the preferred ids; `resolveLegacyIcon(provider, name)` maps a Fluent or Lucide name to its EASM id. These tables are only bundled where they are used. `@easm-ui/icons/data` also exports `definitions`, `iconMetadata` and `legacyAliases` for pickers and migration tools.
- `createIcon({ name, body })` builds a glyph that follows the same contract (24-unit grid, 1.6 stroke, `currentColor`, tone and state styling, accessible naming) for product-specific drawings.

## Accessibility

Unlabelled SVGs are decorative (`aria-hidden`). `label`, `aria-label` or `aria-labelledby` names an icon (`role="img"`); a blank label stays decorative, and `aria-hidden` hides even a named icon. `BrandIcon` follows the same rules. `fill`, `stroke`, `viewBox`, `focusable` and the stroke style are fixed by the renderer: colour an icon with `color` or `tone`.

## EASM One identity

`easm-one` is the platform identity, distinct from `ai-agent`, generic AI activity and functional actions. It redraws the approved Junction mark on the product's 24-unit grid with 1.6-unit rails and a solid 6 × 6 core. The core stays solid across all eight treatments, including `outline`, to preserve separation at 16 px. Rail-to-core gaps are intentional.

```tsx
<Icon name="easm-one" size={24} label="EASM One" />
```

The inline renderer and sprite use `--easm-icon-core`, falling back to `currentColor`. For static signature identity, `@easm-ui/ui` supplies the approved dark rails and orange core through `<ModuleIcon icon="easm-one" tone="signature" />`; routine icons retain their normal state colours. Keep the separate 64-unit marketing artwork, favicon and brand animations under `brand-assets/design-system/assets/brand/`. Do not stretch the marketing mark into a functional glyph or use the identity as a generic loader.

## Motion

`MotionIcon` supplies 309 authored recipes, one for every icon it supports. The first 96 scenes have been reviewed for smoother timing, readable results and clean handoffs; 24 more cover visibility, images, typing, scheduling, support workflows and other important controls. It preserves approved artwork at rest and after bounded playback; stable housings and connected moving parts retain the icon's meaning. The review gallery compares hover/keyboard hints, action playback, timelines, five states and actual 16–32 px sizes. It also compares tinted fill, outline, monochrome, inverse and custom colors on light, dark, tinted and patterned surfaces. See [the complete motion contract](../../brand-assets/icons/motion-lab/README.md).

```tsx
import { MotionIcon } from '@easm-ui/icons';
import '@easm-ui/icons/styles.css';
import '@easm-ui/icons/animation.css';

// The parent button supplies focus and the action's accessible name.
<button aria-label="Download report">
  <MotionIcon name="download" trigger="interaction" size={20} tone="inherit" outline />
</button>

// A fresh acknowledged event key replays a bounded action. Idle remains static.
<MotionIcon key={saveEventId} name="save" active={saveEventId > 0} size={20} />

// Every authored icon supports a continuous cycle. Stop with active=false.
<MotionIcon name="send" active={isAnimating} repeat size={20} />
```

`getIconMotion(name)` returns a recipe (including supported compatibility IDs) or undefined; unsupported `MotionIcon` names render the original static icon. `motionIconNames` lists authored names; `iconMotionRecipes` exposes the parts, timing and stories. `paused` pauses the tracks. `onMotionComplete` is optional visual cleanup, never proof that an operation succeeded. It does not fire when reduced-motion/off/disabled suppresses animation; do not wait for it before completing app work.

Each recipe performs an operation with preparation, action and a visible result. Event-only paper, messages, packets and confirmation marks can appear during a sequence; stationary clipping windows let them pass into containers without changing the approved resting drawing. `getIconMotion(name).beats` describes the three stages. Hover hints finish their cycle after exit and preserve exact operation routes; the 45% hint amplitude only softens secondary gestures. Connected parts retain their attachments, and continuous cycles use one scene clock. `repeat` chooses `loopParts` and `loopDurationMs` when provided, including the designed return/rearm. `loopStory` explains that return. Stopping restores the exact original drawing. See `durationMs` for bounded playback and `loopDurationMs` for continuous pacing.

The existing eight `AnimatedIcon` presets remain supported. Seven use the authored sequences and resolve their `durationMs` from the same recipe as the renderer; the single-stroke loading spinner retains its 900 ms rotation. Static catalog downloads and historical motion assets are not regenerated, and consuming applications adopt this feature through their own package update and integration.

Optional motion uses `AnimatedIcon` and `@easm-ui/icons/animation.css` alongside the base stylesheet:

```tsx
import { AnimatedIcon } from '@easm-ui/icons';
import '@easm-ui/icons/animation.css';

<AnimatedIcon preset="confirm" active={saved} label="Saved" />
<AnimatedIcon preset="listen" active={listening} repeat label="Listening" />
```

Eight bounded presets are inactive by default. Only loading, listening and audio activity can repeat. Each preset's `label` in `motionPresets` is a suggested accessible name; pass it as `label` when nothing else names the event. Reduced-motion preferences, disabled states and `data-easm-motion="off"` stop motion while preserving static artwork. Detailed or badged icons benefit from 20–24 px and context labels.

## Styles, colours and Tailwind CSS 4

Import `styles.css` once. Glyph defaults (display, colour, tone and state) sit in `@layer base`, below Tailwind's utilities and below any unlayered app CSS, so `text-*`, `hidden`/`inline` and size utilities on an icon win. Component rules (the deprecated `IconButton`, `BrandIcon`) stay unlayered. Import the stylesheet as it is, not into another layer.

Colours follow the EASM UI tokens (`--easm-ui-primary`, `--easm-ui-primary-surface`, `--easm-ui-text` and the rest) when `@easm-ui/ui`'s tokens are loaded, and fall back to the original icon palette when they are not. In EASM One screens, `tone="inherit"` with `outline` (as `@easm-ui/ui` uses) makes glyphs follow the text colour. Foreground faces and `background` brushes use instance-scoped SVG masks: cutouts reveal the actual surface, including gradients and patterns. `contrast` is a painted detail (for example, a check inside a solid badge); set `--easm-icon-contrast` to the appropriate contrasting color. Functional “filled” icons use the original tinted `surface` brush; they are not a separate solid-silhouette icon set. Multicolor brand marks retain their separate `BrandIcon` contract.

For custom colors, use `tone="inherit"` and set the enclosing text color. Supply `--easm-icon-fill` for a custom tint, or `outline` for strokes. To keep brand-tone hover/pressed/selected colors in a custom palette, override the corresponding `--easm-ui-primary*` tokens rather than setting one fixed color on the SVG.

## Server components and module format

`Icon` and the per-icon components use React’s server-safe `useId` to scope mask definitions; they use no effects. `BrandIcon` also remains server-renderable. These components are safe in React Server Components. When composing several independent server-rendered roots into one document, pass distinct React `identifierPrefix` values and use the matching prefix when hydrating. Manual `MotionIcon` playback and the compatible `AnimatedIcon` presets also render on the server without an interaction controller. `MotionIcon trigger="interaction"` renders through the small `MotionInteraction` client boundary in `motion-interaction.tsx`, whose hooks attach pointer/focus listeners and let a hint finish after exit; React does not redraw animation frames on a timer. Event callbacks such as `onMotionComplete` belong in a client component.

The deprecated `IconButton` is a client component (`'use client'`). `@easm-ui/icons/data` and `@easm-ui/icons/motion` export data and lookups usable from server code.

The package is ESM only (`import` and `types` conditions). Use Vitest or ESM Jest; CommonJS Jest cannot load it.

## Build and verification

Build: `pnpm --filter @easm-ui/icons build`. Typecheck: `pnpm --filter @easm-ui/icons lint`. Tests: `pnpm --filter @easm-ui/icons test`. `registry.ts`, `data.ts`, `index.ts` and `icons/*` are generated from the icon catalogue, which is maintained outside this repository: do not hand-edit them. Hand-written exports go in `src/index.base.ts`.

Third-party marks drawn by `BrandIcon` (WhatsApp, Google, Microsoft and the rest) belong to their owners; see [TRADEMARKS.md](../../TRADEMARKS.md).
