#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

mapfile -t slugs < <(
  grep -E '^\s+id: "' releases.js |
    sed -E 's/.*id: "([^"]+)".*/\1/' |
    tr -d '-'
)

for slug in "${slugs[@]}"; do
  cp release.html "$slug.html"
done

echo "Generated ${#slugs[@]} release pages from releases.js."
