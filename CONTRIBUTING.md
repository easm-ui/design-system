# Contributing

## Before you open a pull request

```bash
pnpm install
pnpm check
```

`pnpm check` runs everything CI runs:

| Step | Command | What it proves |
| --- | --- | --- |
| Tokens | `pnpm tokens:check` | Generated token files match `tokens/easm.tokens.json`, and every colour pair meets WCAG 2.2 AA contrast |
| Build | `pnpm build` | Every package compiles and emits declarations (the type-check reads them) |
| Types | `pnpm lint` | Every package type-checks under `strict` |
| Behaviour | `pnpm test` | Component and icon verifiers (SSR, DOM behaviour, specifications, icon geometry) |
| Accessibility | `pnpm test:a11y` | axe-core finds no WCAG A/AA violations in any component, state or module demo |
| Icon motion | `pnpm test:icon-motion` | Directed icon motion runs in a real browser (needs `pnpm exec playwright-core install chromium-headless-shell`) |

axe in jsdom cannot see layout, so it does not replace a keyboard-only pass or a screen-reader pass (VoiceOver and NVDA) on a new or changed component. Record those in the pull request.

## Tokens

Edit `tokens/easm.tokens.json` only, then run `pnpm tokens`. It regenerates:

- `packages/ui/src/tokens.css`
- `packages/ui/src/tokens.generated.ts`
- `packages/ui/src/tailwind.css`
- the token tables in `packages/ui/docs/FOUNDATIONS.md`

Never edit those files by hand; CI fails if they drift. A new colour pairing that components use belongs in `tokens/contrast.mjs`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, for example `fix(ui): keep Select focus after closing`.

- **Types:** `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scopes:** `ui`, `icons`, `tokens`, `brand`, `docs`, `ci`, `deps`, `release`.
- **Breaking changes:** add `!` after the type or scope (`feat(ui)!: …`) and a `BREAKING CHANGE:` footer.
- **Summary:** start it in lower case and keep the whole first line within 100 characters (`feat(brand): add the kiosk lockup`, not `feat(brand): Add the EASM Kiosk lockup and …`).

CI checks commit messages on pull requests with commitlint.

## Versions and changelogs

Packages follow [semantic versioning](https://semver.org). Add a changeset (`pnpm changeset`) to any pull request that changes what a package ships.

| Bump | When |
| --- | --- |
| **Major** | Removing or renaming a component, prop, export, token or CSS variable; changing a prop's type or a callback's signature; changing behaviour consumers rely on. Example: the `Select` `onChange` → `onValueChange` change in 2.0.0. |
| **Minor** | New components, props, variants, tokens or icons; deprecating something; a deliberate visual change to an existing token value. |
| **Patch** | Bug fixes, accessibility fixes that keep the API unchanged, documentation and internal refactors. |

Releases are automatic. After a pull request with changesets merges into `main`, the Release workflow opens a **chore: release packages** pull request that applies them, bumps versions and writes each `CHANGELOG.md`. Merging it publishes to npm (npmjs.com) with provenance. If the workflow ever cannot open that pull request, run `pnpm release:version` on a branch from `main` and open the pull request yourself.

## Deprecation policy

Nothing is removed without warning.

1. **Deprecate in a minor release.**
   - Mark the export or prop `@deprecated` in its JSDoc, naming the replacement.
   - Warn once per session in development (`process.env.NODE_ENV !== 'production'`).
   - Add a migration note to the changeset.
2. **Keep it working for at least one further minor release, and at least 60 days.** It must keep passing its tests and accessibility checks until it is removed.
3. **Remove it only in the next major release.** That release's changelog repeats the migration steps.

When a breaking change has no deprecation path (as with `Select` in 2.0.0, where the native element changed), ship it only in a major release, with a "Migration" section in the changelog and the package README.

## Generated files

- `dist/` and `test/**/.cache/` are build outputs.
- `packages/icons/src/registry.ts`, `data.ts`, `index.ts` and `icons/*` are generated from the icon catalogue, which is maintained by the EASM design team outside this repository. Propose icon changes in an issue; hand-written icon exports go in `src/index.base.ts`.

## Brand assets

Code contributions are accepted under the MIT licence. The EASM name, logo, wordmark and mascot are not open: see [TRADEMARKS.md](TRADEMARKS.md). Pull requests that change the brand artwork in `packages/brand/svg`, `png` or `src/logo` are reviewed by the EASM design team.
