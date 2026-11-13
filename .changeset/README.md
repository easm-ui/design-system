# Changesets

Every pull request that changes what a package ships adds a changeset: run `pnpm changeset`, pick the packages and the bump (patch, minor or major), and write one or two sentences for the changelog. Releases run `pnpm release:version`, which applies the pending changesets, bumps versions and writes each package's `CHANGELOG.md`. See `CONTRIBUTING.md` for the rules on bumps and deprecations.
