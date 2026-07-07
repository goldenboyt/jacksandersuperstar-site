#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

slugs=(
  jacksandersuperstar
  prodigygenius
  cybertruck
  designer
  brainstorm
  catscash
)

for slug in "${slugs[@]}"; do
  cp release.html "$slug.html"
done

echo "Generated ${#slugs[@]} release pages."
