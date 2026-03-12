#!/usr/bin/env bash
set -euo pipefail

# Production deployment flow:
# 1) Apply Supabase vector schema (optional skip)
# 2) Deploy app to Vercel production
# 3) Sync knowledge chunks to Supabase (optional skip)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod.runtime}"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE="${ENV_FILE_FALLBACK:-.env}"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy-prod] Missing env file. Set ENV_FILE or create .env.prod.runtime/.env."
  exit 1
fi

echo "[deploy-prod] Loading environment from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[deploy-prod] Missing required command: $1"
    exit 1
  fi
}

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "[deploy-prod] Missing required env var: $name"
    exit 1
  fi
}

require_cmd npx
require_cmd npm

if [ "${SKIP_SUPABASE_SCHEMA:-0}" != "1" ]; then
  PSQL_BIN="${PSQL_BIN:-}"
  if [ -z "$PSQL_BIN" ]; then
    if command -v psql >/dev/null 2>&1; then
      PSQL_BIN="$(command -v psql)"
    elif [ -x "/opt/homebrew/opt/libpq/bin/psql" ]; then
      PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
    fi
  fi
  if [ -z "$PSQL_BIN" ]; then
    echo "[deploy-prod] Missing psql. Install PostgreSQL client or set PSQL_BIN."
    exit 1
  fi

  if [ -z "${SUPABASE_DB_URL:-}" ]; then
    if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
      PROJECT_REF="$(echo "$SUPABASE_URL" | sed -E 's#^https?://([^.]*)\.supabase\.co/?$#\1#')"
      SUPABASE_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"
      export SUPABASE_DB_URL
      echo "[deploy-prod] Derived SUPABASE_DB_URL from SUPABASE_URL + SUPABASE_DB_PASSWORD."
    fi
  fi

  require_var SUPABASE_DB_URL
  echo "[deploy-prod] Applying Supabase vector schema..."
  "$PSQL_BIN" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f script/supabase-vector-schema.sql
else
  echo "[deploy-prod] Skipping Supabase schema apply (SKIP_SUPABASE_SCHEMA=1)."
fi

echo "[deploy-prod] Deploying to Vercel production..."
npx vercel deploy --prod -y

if [ "${SKIP_KNOWLEDGE_SYNC:-0}" != "1" ]; then
  echo "[deploy-prod] Syncing knowledge chunks to Supabase..."
  npm run assistant:sync-knowledge
else
  echo "[deploy-prod] Skipping knowledge sync (SKIP_KNOWLEDGE_SYNC=1)."
fi

echo "[deploy-prod] Completed."
