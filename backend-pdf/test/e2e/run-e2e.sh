#!/usr/bin/env bash
#
# Orkiestrator testu e2e backend-pdf.
#
#   1. podnosi infrastrukturę (MongoDB + Mailpit) z docker-compose
#   2. startuje serwis backend-pdf lokalnie (node) z konfiguracją .env.e2e
#   3. uruchamia test e2e.test.js (seed -> POST -> PDF -> mail -> asercje)
#   4. sprząta: zatrzymuje serwis i usuwa kontenery (zawsze, także po błędzie)
#
# Wymagania: docker (z pluginem compose) oraz node >=18, zainstalowane zależności
# (`npm install` w katalogu backend-pdf).
#
# Użycie:
#   ./test/e2e/run-e2e.sh              # pełny cykl
#   KEEP_UP=1 ./test/e2e/run-e2e.sh   # zostaw infrastrukturę po teście (debug)

set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PDF_DIR="$(cd "${E2E_DIR}/../.." && pwd)"
COMPOSE_FILE="${E2E_DIR}/docker-compose.yml"
ENV_FILE="${E2E_DIR}/.env.e2e"

# Wykryj 'docker compose' vs 'docker-compose'
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "💥 Brak docker compose. Zainstaluj Docker." >&2
  exit 1
fi

SERVICE_PID=""
SERVICE_LOG="${E2E_DIR}/.service.log"

cleanup() {
  local code=$?
  echo ""
  echo "🧹 Sprzątanie..."
  if [[ -n "${SERVICE_PID}" ]] && kill -0 "${SERVICE_PID}" 2>/dev/null; then
    kill "${SERVICE_PID}" 2>/dev/null || true
    wait "${SERVICE_PID}" 2>/dev/null || true
  fi
  if [[ "${KEEP_UP:-0}" != "1" ]]; then
    ${DC} -f "${COMPOSE_FILE}" down -v >/dev/null 2>&1 || true
  else
    echo "   KEEP_UP=1 — infrastruktura zostaje (UI Mailpit: http://localhost:8025)"
  fi
  exit "${code}"
}
trap cleanup EXIT INT TERM

echo "🐳 Podnoszę infrastrukturę (MongoDB + Mailpit)..."
${DC} -f "${COMPOSE_FILE}" up -d --wait

echo "🚀 Startuję backend-pdf z ${ENV_FILE}..."
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

( cd "${PDF_DIR}" && node src/index.js ) >"${SERVICE_LOG}" 2>&1 &
SERVICE_PID=$!

echo "⏳ Czekam aż serwis odpowie na /health..."
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT:-3001}/health" >/dev/null 2>&1; then
    echo "   serwis gotowy."
    break
  fi
  if ! kill -0 "${SERVICE_PID}" 2>/dev/null; then
    echo "💥 Serwis backend-pdf padł przy starcie. Logi:" >&2
    cat "${SERVICE_LOG}" >&2
    exit 1
  fi
  sleep 1
  if [[ "${i}" == "30" ]]; then
    echo "💥 Serwis nie wystartował w czasie. Logi:" >&2
    cat "${SERVICE_LOG}" >&2
    exit 1
  fi
done

echo "🧪 Uruchamiam test e2e..."
export MONGODB_URI PDF_BASE_URL="http://localhost:${PORT:-3001}" MAILPIT_URL="http://localhost:8025"
node "${E2E_DIR}/e2e.test.js"
