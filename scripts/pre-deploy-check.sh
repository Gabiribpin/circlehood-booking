#!/bin/bash
# Pre-deploy validation script
# Run before every deploy: ./scripts/pre-deploy-check.sh

set -e

echo ""
echo "==============================="
echo " Pre-deploy Validation"
echo "==============================="
echo ""

# 1. Unit tests
echo "Running unit tests..."
TEST_OUTPUT=$(npx vitest run 2>&1)
TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ passed' | head -1)
if echo "$TEST_OUTPUT" | grep -q "Tests.*passed"; then
  echo "  Unit tests: $TEST_COUNT"
else
  echo "  Unit tests FAILED"
  echo "$TEST_OUTPUT" | tail -20
  exit 1
fi

# 2. TypeScript
echo "Running TypeScript check..."
if NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1; then
  echo "  TypeScript: 0 errors"
else
  echo "  TypeScript errors found"
  exit 1
fi

# 3. Check migrations exist
echo "Checking migrations..."
MIGRATION_COUNT=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "  Migrations found: $MIGRATION_COUNT"

LATEST=$(ls supabase/migrations/*.sql | tail -1 | xargs basename)
echo "  Latest: $LATEST"

echo ""
echo "==============================="
echo " Ready to deploy!"
echo "==============================="
echo ""
echo "Next steps:"
echo "  1. git add . && git commit"
echo "  2. git push origin main"
echo "  3. vercel --scope circlehood-tech (preview)"
echo "  4. Run migration on preview DB"
echo "  5. npm run test:e2e:bot-only"
echo ""
