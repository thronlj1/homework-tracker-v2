#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_FILE="$ROOT_DIR/certs/dev-cert.pem"
KEY_FILE="$ROOT_DIR/certs/dev-key.pem"
TARGET_PORT="${TARGET_PORT:-5001}"
HTTPS_PORT="${HTTPS_PORT:-5443}"
HOSTNAME="${HTTPS_HOSTNAME:-0.0.0.0}"

if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "未找到 HTTPS 证书，请先执行：pnpm https:cert -- <你的局域网IP>"
  exit 1
fi

echo "启动 HTTPS 代理: https://$HOSTNAME:$HTTPS_PORT -> http://localhost:$TARGET_PORT"
pnpm local-ssl-proxy \
  --source "$HTTPS_PORT" \
  --target "$TARGET_PORT" \
  --cert "$CERT_FILE" \
  --key "$KEY_FILE" \
  --hostname "$HOSTNAME"
