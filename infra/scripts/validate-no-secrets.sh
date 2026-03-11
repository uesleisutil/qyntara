#!/bin/bash
# Script para validar que não há credenciais expostas no código
# Valida Requirements 1.3 e 1.4

set -e

echo "🔍 Validando que não há credenciais expostas no código..."
echo ""

# Padrões suspeitos de credenciais
PATTERNS=(
  "AKIA[0-9A-Z]{16}"                    # AWS Access Key ID
  "aws_secret_access_key\s*=\s*['\"]"  # AWS Secret Key
  "['\"][0-9a-zA-Z/+=]{40}['\"]"       # Possível secret de 40 chars
  "password\s*=\s*['\"][^'\"]+['\"]"   # Password hardcoded
  "token\s*=\s*['\"][^'\"]+['\"]"      # Token hardcoded
  "api_key\s*=\s*['\"][^'\"]+['\"]"    # API key hardcoded
  "secret\s*=\s*['\"][^'\"]+['\"]"     # Secret hardcoded
)

# Credenciais de exemplo conhecidas (AWS documentation examples)
KNOWN_EXAMPLES=(
  "AKIAIOSFODNN7EXAMPLE"
  "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
)

FOUND_ISSUES=0

# Arquivos a verificar (excluir node_modules, .venv, etc)
FILES=$(find . -type f \
  -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \
  | grep -v node_modules \
  | grep -v .venv \
  | grep -v __pycache__ \
  | grep -v .git \
  | grep -v cdk.out \
  | grep -v build \
  | grep -v dist)

for pattern in "${PATTERNS[@]}"; do
  echo "Verificando padrão: $pattern"
  
  # Buscar matches
  MATCHES=$(echo "$FILES" | xargs grep -E "$pattern" 2>/dev/null || true)
  
  if [ -n "$MATCHES" ]; then
    # Filtrar matches que são exemplos conhecidos
    FILTERED_MATCHES=""
    while IFS= read -r line; do
      IS_EXAMPLE=false
      for example in "${KNOWN_EXAMPLES[@]}"; do
        if echo "$line" | grep -q "$example"; then
          IS_EXAMPLE=true
          break
        fi
      done
      
      if [ "$IS_EXAMPLE" = false ]; then
        FILTERED_MATCHES="$FILTERED_MATCHES$line\n"
      fi
    done <<< "$MATCHES"
    
    if [ -n "$FILTERED_MATCHES" ] && [ "$FILTERED_MATCHES" != "\n" ]; then
      echo "$FILTERED_MATCHES"
      echo "❌ ALERTA: Possível credencial encontrada com padrão: $pattern"
      FOUND_ISSUES=$((FOUND_ISSUES + 1))
    fi
  fi
done

# Verificar arquivos .env commitados (exceto .env.example)
echo ""
echo "Verificando arquivos .env commitados..."
if git ls-files | grep -E "^\.env$|^.*/.env$" | grep -v ".env.example"; then
  echo "❌ ALERTA: Arquivo .env encontrado no git! Remova com:"
  echo "  git rm --cached .env"
  echo "  git commit -m 'Remove .env file'"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
  echo "✅ Nenhum arquivo .env commitado"
fi

echo ""
if [ $FOUND_ISSUES -eq 0 ]; then
  echo "✅ Validação concluída: Nenhuma credencial exposta encontrada!"
  exit 0
else
  echo "❌ Validação falhou: $FOUND_ISSUES problema(s) encontrado(s)"
  echo ""
  echo "AÇÃO NECESSÁRIA:"
  echo "1. Remova as credenciais hardcoded do código"
  echo "2. Use AWS Secrets Manager para armazenar credenciais"
  echo "3. Use variáveis de ambiente (não commitadas) para desenvolvimento local"
  exit 1
fi
