#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[render-build] clean install..."
rm -rf node_modules

export NPM_CONFIG_PRODUCTION=false
export NODE_ENV=development
export RENDER="${RENDER:-true}"

npm ci
npm run build

# Verify Express stack installed completely
test -f node_modules/body-parser/lib/utils.js
test -f node_modules/.prisma/client/default.js

echo "[render-build] done"
