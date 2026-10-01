#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

python3 generate-release-pages.py
