#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "Checking cache..."
CACHE_DIR="/tmp/pnpm-cache"
if [ -d "$CACHE_DIR" ]; then
    echo "Using cached dependencies..."
    export PNPM_CACHE_DIR="$CACHE_DIR"
    pnpm install --prefer-frozen-lockfile --no-optional
else
    echo "Installing dependencies..."
    mkdir -p "$CACHE_DIR"
    pnpm install --prefer-frozen-lockfile --no-optional
fi

echo "Building the Next.js project..."
pnpm next build

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
