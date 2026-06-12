#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repo."
  exit 1
fi

git add .

if git diff --staged --quiet; then
  echo "Nothing to deploy — no changes."
  exit 0
fi

MESSAGE="${1:-update site}"
git commit -m "$MESSAGE"
git push origin main

echo "Done — Vercel will update jacksandersuperstar.com in about a minute."
