# EASM UI

The design system behind [EASM One](https://easm.co), the AI platform for universities: one token source, React components, an icon set with directed motion, and the EASM brand kit.

| Package | What it is |
| --- | --- |
| [`@easm-ui/ui`](packages/ui) | React 19 components: core controls, navigation, data, charts, forms, overlays and the product patterns EASM One is built from. Ships its stylesheet, tokens and a Tailwind v4 theme. |
| [`@easm-ui/icons`](packages/icons) | 682 icon ids as React components on one 24 px grid, `MotionIcon` with 309 directed recipes, and `BrandIcon` for the services a product connects to. |
| [`@easm-ui/brand`](packages/brand) | The EASM logo, the animated app icon, voice waveform and typing dots, the particle and dot fields, and the mascot. Re-exported by `@easm-ui/ui`. |
| [`tokens/`](tokens) | `easm.tokens.json` (DTCG format), the single source of every colour, size and motion value, with its build and WCAG 2.2 contrast checks. |

The components, icons and tokens are MIT licensed. The EASM name, logo and mascot are not: see [TRADEMARKS.md](TRADEMARKS.md).

## Install

```bash
npm install @easm-ui/ui @easm-ui/icons
```

`@easm-ui/ui` brings `@easm-ui/brand` with it. The packages are compiled ES modules with TypeScript types and work in any React 19 app: Next.js (App Router), Vite, Remix or plain Node.

**Load the styles once and mark the page:**

```tsx
// Next.js: app/layout.tsx · Vite: src/main.tsx
import '@easm-ui/ui/styles.css';

<body className="easm-ui easm-ui-page">…</body>
```

`easm-ui` scopes the components' styles; `easm-ui-page` adds the page background, type and text colour. Load Inter yourself (`next/font/google` or a Google Fonts link); without it text falls back to the system font.

**Use the components:**

```tsx
import { Button, Card, DataTable, BrandIcon } from '@easm-ui/ui';
import { Icon } from '@easm-ui/icons';

<Card title="Fee vouchers" icon="fee-voucher">
  <Button leadingIcon="download">Export</Button>
  <BrandIcon name="whatsapp" label="WhatsApp" />
</Card>
```

Icons are named, not imported: `leadingIcon="save"`, `icon="inbox"`. Every component's API, states and rules are in [`packages/ui/docs/COMPONENT-SPECS.md`](packages/ui/docs/COMPONENT-SPECS.md); the tokens are in [`FOUNDATIONS.md`](packages/ui/docs/FOUNDATIONS.md).

A row of chips, filters or thumbnails that can be wider than its space is a `ScrollRow` (or `QuickFilters` for one-of-many view filters with counts): it never wraps and never shows a scrollbar; the hidden side fades and arrow buttons page it.

### Next.js

- No `transpilePackages` needed; the packages are compiled.
- The components are client components (the package starts with `'use client'`), so they render inside server components too. Props that are functions (a DataTable's column `value`, `onValueChange`, `onClick`) cannot cross from a server component: put that part of the page in a file that starts with `'use client'`.
- **Router links.** Mount `EasmUIProvider` once with your router's link, so every link EASM UI renders navigates client-side:

  ```tsx
  // app/providers.tsx
  'use client';
  import Link from 'next/link';
  import { EasmUIProvider } from '@easm-ui/ui';

  export function Providers({ children }: { children: React.ReactNode }) {
    return <EasmUIProvider linkComponent={Link}>{children}</EasmUIProvider>;
  }
  ```

  Your own links can use `EasmLink` (`<EasmLink href="/inbox">Inbox</EasmLink>`).

### Right-to-left and mixed-language pages

Set `dir` and `lang` on `<html>` and on any region in another language (an English screen inside an Urdu app). Menus, selects, popovers, tooltips, dialogs and drawers render at the end of `<body>`, so each one takes the direction and language of the place it opens from and sets them on its panel; a drawer's `side="start"` follows that direction.

### Tailwind CSS v4

Tailwind and EASM UI work side by side. Component rules are unlayered, so Tailwind's reset never overrides a component; the base rules sit in `@layer base`, so a utility on your own element always wins. To style your own layout with the same tokens:

```css
@import "tailwindcss";
@import "@easm-ui/ui/tailwind.css";
```

Then `bg-easm-surface`, `text-easm-text-secondary`, `rounded-easm-card`, `font-easm` and the rest follow the tokens. Without Tailwind, use the CSS variables (`var(--easm-ui-surface)`) or import `@easm-ui/ui/tokens.css` alone.

### Motion

`MotionIcon` provides 309 authored recipes: each shows a preparation, an operation and its result (receiving a download, discarding paper, delivering a workflow packet) and returns to the exact artwork at rest. Manual playback renders on the server; `trigger="interaction"` adds a small client boundary for pointer and keyboard hints.

The component stylesheet adds quiet motion where components are used: the selected tab slides, table rows cascade in, a new statistic rises in, skeletons shimmer, buttons press. `easm-ui-page-head`, `easm-ui-enter`, `easm-ui-stagger` and the `--easm-ui-motion-*` tokens give your own pages the same timing. `prefers-reduced-motion` and `data-easm-motion="off"` on any ancestor turn all of it off.

## Develop

```bash
pnpm install
pnpm check
```

`pnpm check` verifies the generated token files, builds, type-checks, runs the component and icon tests, the axe accessibility checks (WCAG 2.2 A/AA) and the icon motion test. CI runs the same on every pull request. Token values live only in `tokens/easm.tokens.json`; after editing it, run `pnpm tokens`.

Commits follow Conventional Commits and versions come from Changesets. See [CONTRIBUTING.md](CONTRIBUTING.md), which also holds the deprecation policy. Security reports: [SECURITY.md](SECURITY.md).

## Licence

Code, tokens, documentation and the icon set: [MIT](LICENSE). The EASM name, logo, wordmark and mascot: all rights reserved, see [TRADEMARKS.md](TRADEMARKS.md). Third-party marks drawn by `BrandIcon` belong to their owners.
