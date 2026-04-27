#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT_DIR/certs"
CERT_FILE="$CERT_DIR/dev-cert.pem"
KEY_FILE="$CERT_DIR/dev-key.pem"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert 未安装。请先执行：brew install mkcert nss"
  exit 1
fi

mkdir -p "$CERT_DIR"

LOCAL_IP="${1:-}"
if [[ "$LOCAL_IP" == "--" ]]; then
  LOCAL_IP="${2:-}"
fi
if [[ -z "$LOCAL_IP" ]]; then
  LOCAL_IP="$(ipconfig getifaddr en0 || true)"
fi

if [[ -z "$LOCAL_IP" ]]; then
  echo "无法自动识别局域网 IP，请手动传参：pnpm https:cert -- 192.168.x.x"
  exit 1
fi

echo "使用 IP: $LOCAL_IP 生成本地 HTTPS 证书"
if ! mkcert -install; then
  echo "提示：mkcert -install 需要本机管理员授权，当前终端未完成授权。"
  echo "请在你自己的终端手动执行一次：mkcert -install"
fi
mkcert -key-file "$KEY_FILE" -cert-file "$CERT_FILE" localhost 127.0.0.1 "$LOCAL_IP"

echo "证书生成完成："
echo "  cert: $CERT_FILE"
echo "  key : $KEY_FILE"
echo "提示：iPhone 访问前需安装并信任 mkcert 根证书（mkcert -CAROOT）"
