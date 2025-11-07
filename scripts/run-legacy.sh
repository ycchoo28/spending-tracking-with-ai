#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEGACY_DIR="$REPO_ROOT/archive/receipt-agent-v1"
TS_NODE_BIN=${TS_NODE_BIN:-$(npm bin --global 2>/dev/null || true)}
TS_NODE=${TS_NODE:-npx ts-node}

if [[ ! -d "$LEGACY_DIR" ]]; then
  echo "Legacy directory not found at $LEGACY_DIR" >&2
  exit 1
fi

export NODE_PATH="$REPO_ROOT/node_modules"
export TS_NODE_PROJECT="$REPO_ROOT/tsconfig.legacy.json"

pushd "$REPO_ROOT" >/dev/null
$TS_NODE "$LEGACY_DIR/index-console.ts" "$@"
popd >/dev/null
