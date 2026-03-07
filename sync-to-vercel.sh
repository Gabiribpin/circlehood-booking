#!/bin/bash
# Uso: ./sync-to-vercel.sh
# Analisa tudo que acumulou no main durante o modo local
# e verifica se esta seguro para deploy no Vercel

set -euo pipefail

echo "🔍 Analisando commits acumulados desde ultimo deploy Vercel..."

# 1. Buscar ultimo deploy bem-sucedido na Vercel
# (via git tag ou variavel configuravel)
LAST_VERCEL_DEPLOY=${LAST_VERCEL_DEPLOY:-$(git rev-list --max-parents=0 HEAD)}

# 2. Listar todos os commits desde entao
COMMIT_COUNT=$(git rev-list "$LAST_VERCEL_DEPLOY"..HEAD --count)
echo ""
echo "📋 Commits acumulados ($COMMIT_COUNT):"
git log "$LAST_VERCEL_DEPLOY"..HEAD --oneline

# 3. Verificar migracoes Supabase acumuladas
echo ""
echo "🗄️  Migracoes pendentes:"
MIGRATIONS=$(git diff "$LAST_VERCEL_DEPLOY"..HEAD --name-only -- supabase/migrations/ 2>/dev/null || true)
if [ -z "$MIGRATIONS" ]; then
  echo "  (nenhuma)"
else
  echo "$MIGRATIONS" | sed 's/^/  /'
fi
MIGRATION_COUNT=$(echo "$MIGRATIONS" | grep -c '.' 2>/dev/null || echo "0")

# 4. Verificar conflitos entre correcoes
echo ""
echo "⚠️  Arquivos alterados multiplas vezes (possivel conflito):"
CONFLICTS=$(git log "$LAST_VERCEL_DEPLOY"..HEAD --name-only --format="" | sort | uniq -d)
if [ -z "$CONFLICTS" ]; then
  echo "  (nenhum)"
else
  echo "$CONFLICTS" | sed 's/^/  /'
fi
CONFLICT_COUNT=$(echo "$CONFLICTS" | grep -c '.' 2>/dev/null || echo "0")

# 5. Verificar arquivos criticos alterados
echo ""
echo "🔐 Arquivos criticos alterados:"
CRITICAL=$(git diff "$LAST_VERCEL_DEPLOY"..HEAD --name-only | grep -iE "(stripe|auth|\.env|schema|migration)" 2>/dev/null || true)
if [ -z "$CRITICAL" ]; then
  echo "  (nenhum)"
else
  echo "$CRITICAL" | sed 's/^/  /'
fi
CRITICAL_COUNT=$(echo "$CRITICAL" | grep -c '.' 2>/dev/null || echo "0")

# 6. Verificar se CI local passou em todos os commits
echo ""
echo "✅ Status dos CI locais:"
if command -v gh &>/dev/null; then
  gh run list --workflow=ci-local.yml --limit=20 --json conclusion,headSha,createdAt \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('  (nenhum run encontrado)')
else:
    for r in data:
        sha = r['headSha'][:7]
        conclusion = r['conclusion'] or 'in_progress'
        created = r['createdAt'][:19].replace('T', ' ')
        icon = '✅' if conclusion == 'success' else '❌' if conclusion == 'failure' else '🔄'
        print(f'  {icon} {created} {sha} {conclusion}')
" 2>/dev/null || echo "  (gh CLI nao disponivel ou sem permissao)"
else
  echo "  (gh CLI nao instalado)"
fi

# 7. Relatorio final
echo ""
echo "================================================"
echo "📊 RELATORIO SYNC VERCEL"
echo "================================================"
echo "Commits acumulados: $COMMIT_COUNT"
echo "Migracoes pendentes: $MIGRATION_COUNT"
echo "Arquivos com multiplas alteracoes: $CONFLICT_COUNT"
echo "Arquivos criticos alterados: $CRITICAL_COUNT"
echo ""
echo "Recomendacao:"

if [ "$CONFLICT_COUNT" -gt 5 ] || [ "$CRITICAL_COUNT" -gt 3 ]; then
  echo "⚠️  REVISAR ANTES DE FAZER DEPLOY"
  echo "   Muitos conflitos potenciais: $CONFLICT_COUNT arquivos"
  echo "   Arquivos criticos: $CRITICAL_COUNT alterados"
  echo ""
  echo "   Sugestao: revisar cada arquivo critico manualmente"
elif [ "$MIGRATION_COUNT" -gt 0 ]; then
  echo "🗄️  DEPLOY COM ATENCAO — rode as migracoes antes"
  echo "   supabase db push"
  echo ""
  echo "   Ordem:"
  echo "   1. supabase db push (aplicar migracoes)"
  echo "   2. git push origin main (Vercel deploya)"
  echo "   3. Verificar logs no Vercel dashboard"
else
  echo "✅ SEGURO PARA DEPLOY — sem conflitos detectados"
fi

echo ""
echo "Quando pronto: git push origin main"
echo "O Vercel vai pegar automaticamente e deployar tudo."
