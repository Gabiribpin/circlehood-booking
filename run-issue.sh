#!/bin/bash
# Uso: ./run-issue.sh [número da issue]
# Exemplo: ./run-issue.sh 42

ISSUE_NUMBER=$1

if [ -z "$ISSUE_NUMBER" ]; then
  echo "❌ Informe o número da issue: ./run-issue.sh 42"
  exit 1
fi

echo "🔍 Buscando issue #$ISSUE_NUMBER..."

ISSUE_TITLE=$(gh issue view $ISSUE_NUMBER --json title -q '.title')
ISSUE_BODY=$(gh issue view $ISSUE_NUMBER --json body -q '.body')

PROMPT="# EXECUTION MODE — Corrigir Issue em Foco

## Issue #$ISSUE_NUMBER: $ISSUE_TITLE

$ISSUE_BODY

## Passos obrigatórios
1. Leia a issue completamente antes de tocar em qualquer arquivo
2. Crie uma branch: git checkout -b fix/issue-$ISSUE_NUMBER
3. Faça APENAS as alterações que a issue descreve
4. Rode os testes locais antes de commitar
5. Commit: fix: $ISSUE_TITLE (#$ISSUE_NUMBER)
6. Abra o PR com gh pr create linkando Closes #$ISSUE_NUMBER no body
7. Rode: gh pr merge --auto --squash imediatamente após criar o PR
8. Se CI falhar, corrija e faça novo push até ficar verde"

echo "$PROMPT" | pbcopy
echo "✅ Prompt da issue #$ISSUE_NUMBER copiado para a área de transferência!"
echo "📋 Cole no Claude Code agora."
