#!/usr/bin/env bash
# Publish every package whose version is not on npm yet, with npm Trusted Publishing: GitHub Actions
# proves which repository and workflow is asking (OIDC) and npm answers with a one-time credential.
# No token is stored anywhere. Each package must name this repository and release.yml as its trusted
# publisher on npmjs.com (package → Settings → Trusted publishing).
#
# pnpm pack turns workspace:^ ranges into real versions; npm publish then publishes the tarball, since
# npm's own client is the one that speaks Trusted Publishing and attaches provenance.
#
# The output's last lines are repeated as a run annotation, readable without signing in to GitHub.
set -uo pipefail
cd "$(dirname "$0")/.."
log=$(mktemp)
clean_rc=$(mktemp) # an empty npm config: no stray token from a runner's .npmrc can be used
work=$(mktemp -d)

publish() {
  pnpm build || return 1
  # Dependencies first: ui depends on brand and icons.
  for dir in packages/brand packages/icons packages/ui; do
    name=$(node -p "require('./$dir/package.json').name")
    version=$(node -p "require('./$dir/package.json').version")
    if npm view "$name@$version" version --userconfig "$clean_rc" >/dev/null 2>&1; then
      echo "$name@$version is already on npm"
      continue
    fi
    tarball=$(cd "$dir" && pnpm pack --pack-destination "$work" | tail -n 1)
    npm publish "$tarball" --access public --provenance --userconfig "$clean_rc" || return 1
    git tag "$name@$version"
    # changesets/action reads these lines to push the tags and write the GitHub releases.
    echo "New tag: $name@$version"
  done
}

publish 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
tail -n 40 "$log" | grep -v '^\s*$' | sed -e 's/%/%25/g' | awk 'BEGIN{ORS="%0A"}{print}' > "$log.tail"
echo "::notice title=Publish output (exit $rc)::$(cat "$log.tail")"
exit "$rc"
