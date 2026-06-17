#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NAMESPACE="sprawdzsluch"
TRAEFIK_NAMESPACE="traefik"
TRAEFIK_SERVICE="traefik"
PORT="8080"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] Missing command: $1"
    exit 1
  fi
}

require_cmd kubectl
require_cmd curl

PF_PID=""
cleanup() {
  if [[ -n "$PF_PID" ]]; then
    kill "$PF_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

ensure_port_forward() {
  if curl -sS --max-time 2 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    return
  fi

  kubectl port-forward -n "$TRAEFIK_NAMESPACE" "svc/${TRAEFIK_SERVICE}" "${PORT}:80" >/tmp/sprawdzsluch-local-smoke-pf.log 2>&1 &
  PF_PID=$!

  for _ in {1..25}; do
    if curl -sS --max-time 2 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  echo "[ERROR] Traefik port-forward did not start on :${PORT}"
  exit 1
}

assert_http_code() {
  local url="$1"
  local expected="$2"
  local code

  code="$(curl -sS -o /tmp/sprawdzsluch-smoke-body.txt -w "%{http_code}" "$url")"
  if [[ "$code" != "$expected" ]]; then
    echo "[ERROR] ${url} expected ${expected}, got ${code}"
    echo "--- response ---"
    cat /tmp/sprawdzsluch-smoke-body.txt
    echo
    exit 1
  fi
  echo "[OK] ${url} -> ${code}"
}

ensure_port_forward

# Frontend
assert_http_code "http://127.0.0.1:${PORT}/" "200"
if ! grep -qi "<html" /tmp/sprawdzsluch-smoke-body.txt; then
  echo "[ERROR] Frontend response does not look like HTML"
  exit 1
fi

# PDF service health via ingress
assert_http_code "http://127.0.0.1:${PORT}/health" "200"
if ! grep -qi '"status"\s*:\s*"OK"' /tmp/sprawdzsluch-smoke-body.txt; then
  echo "[ERROR] PDF health response does not contain status OK"
  exit 1
fi

# Payments happy-path check via ingress
PAYLOAD="{\"testId\":\"local-smoke-$(date +%s)\",\"paymentMethod\":\"VOUCHER\",\"voucherCode\":\"TEST123\"}"
PAY_CODE="$(curl -sS -o /tmp/sprawdzsluch-smoke-body.txt -w "%{http_code}" -X POST "http://127.0.0.1:${PORT}/api/payments/process" -H "Content-Type: application/json" -d "$PAYLOAD")"
if [[ "$PAY_CODE" != "200" ]]; then
  echo "[ERROR] POST /api/payments/process expected 200, got ${PAY_CODE}"
  cat /tmp/sprawdzsluch-smoke-body.txt
  echo
  exit 1
fi
if ! grep -qi '"success"\s*:\s*true' /tmp/sprawdzsluch-smoke-body.txt; then
  echo "[ERROR] Payments response does not contain success=true"
  cat /tmp/sprawdzsluch-smoke-body.txt
  echo
  exit 1
fi
echo "[OK] POST /api/payments/process -> 200"

# Payments status for unknown id should be 404 (known expected behavior)
assert_http_code "http://127.0.0.1:${PORT}/api/payments/status/non-existent-id" "404"

echo "[SUCCESS] Local smoke test passed"
