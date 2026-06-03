#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[render-build] clean install..."
rm -rf node_modules

export NPM_CONFIG_PRODUCTION=false
export NODE_ENV=development

npm ci
npm run build

echo "[render-build] done"
