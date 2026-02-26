#!/bin/bash
# migrate.sh — Apply pending Supabase migrations to production
#
# Usage:
#   bash scripts/migrate.sh "$SUPABASE_DB_URL"
#
# The DB URL format is:
#   postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
# Get it from: Supabase Dashboard → Project Settings → Database → URI

set -e

DB_URL="${1:-$SUPABASE_DB_URL}"

if [ -z "$DB_URL" ]; then
  echo "❌ Error: DB URL not provided."
  echo "   Usage: bash scripts/migrate.sh \"postgresql://...\""
  echo "   Or set SUPABASE_DB_URL environment variable."
  exit 1
fi

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ Error: migrations directory not found at $MIGRATIONS_DIR"
  exit 1
fi

echo "📦 CircleHood — Migration Runner"
echo "   DB: $(echo "$DB_URL" | sed 's/:[^@]*@/:*****@/')"
echo ""

# Create tracking schema + table if not exists
psql "$DB_URL" -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS _migrations;
CREATE TABLE IF NOT EXISTS _migrations.applied (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# Sort migration files alphabetically (ensures correct order)
MIGRATION_FILES=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATION_FILES" ]; then
  echo "⚠️  No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

APPLIED=0
SKIPPED=0
FAILED=0

for filepath in $MIGRATION_FILES; do
  name=$(basename "$filepath")

  # Check if this migration was already applied
  count=$(psql "$DB_URL" -tAq -c "SELECT COUNT(*) FROM _migrations.applied WHERE name = '$name'")

  if [ "$count" -gt 0 ]; then
    echo "  ⏭  $name (already applied)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  ▶  Applying: $name ..."

  # Apply migration in a transaction; on failure, do not mark as applied
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$filepath"; then
    psql "$DB_URL" -q -c "INSERT INTO _migrations.applied (name) VALUES ('$name') ON CONFLICT (name) DO NOTHING"
    echo "  ✅ $name"
    APPLIED=$((APPLIED + 1))
  else
    echo "  ❌ $name FAILED — stopping"
    FAILED=$((FAILED + 1))
    exit 1
  fi
done

echo ""
echo "✅ Done. Applied: $APPLIED | Skipped: $SKIPPED | Failed: $FAILED"
