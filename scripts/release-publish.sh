#!/usr/bin/env bash
# Build and publish with Changesets, then repeat the tail of the output as a run annotation, so the
# outcome is readable from the run's summary as well as its log. The output holds no secrets.
set -uo pipefail
log=$(mktemp)
{ pnpm build && pnpm exec changeset publish; } 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
# What the registry says about each package, as this token sees it.
{ echo "npm $(npm --version)"; for p in ui icons brand; do
  echo "@easm-ui/$p: $(npm view "@easm-ui/$p" versions dist-tags --json 2>&1 | tr -d '\n' | cut -c1-300)"; done; } >> "$log"
tail -n 40 "$log" | grep -v '^\s*$' | sed -e 's/%/%25/g' | awk 'BEGIN{ORS="%0A"}{print}' > "$log.tail"
echo "::notice title=Publish output (exit $rc)::$(cat "$log.tail")"
exit "$rc"
