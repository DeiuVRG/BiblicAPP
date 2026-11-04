#!/usr/bin/env bash
# Serialises pnpm installs across parallel agents.
set -euo pipefail
cd "$(dirname "$0")/.."
exec flock /tmp/biblicapp-install.lock pnpm install "$@"
