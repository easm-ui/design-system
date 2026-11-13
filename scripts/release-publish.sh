#!/usr/bin/env bash
# Build and publish with Changesets, then repeat the tail of the output as a run annotation, so the
# outcome is readable from the run's summary as well as its log. The output holds no secrets.
set -uo pipefail
log=$(mktemp)
{ pnpm build && pnpm exec changeset publish; } 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
tail -n 40 "$log" | grep -v '^\s*$' | sed -e 's/%/%25/g' | awk 'BEGIN{ORS="%0A"}{print}' > "$log.tail"
echo "::notice title=Publish output (exit $rc)::$(cat "$log.tail")"
exit "$rc"
