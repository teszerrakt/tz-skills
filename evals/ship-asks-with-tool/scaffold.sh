#!/usr/bin/env bash
# Copies this case's fixture into the run's workspace.
set -euo pipefail
cp -R "$(dirname "$0")/fixture/." "${1:-.}"
