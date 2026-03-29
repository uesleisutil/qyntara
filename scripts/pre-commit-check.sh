#!/bin/bash
# Pre-commit security check — run before every commit
# Install: cp scripts/pre-commit-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔐 Running pre-commit security checks..."

ERRORS=0

# 1. Check for .env files being committed
ENV_FILES=$(git diff --cached --name-only | grep -E '\.env$|\.env\.local$|\.env\.production$' | grep -v '.env.example' || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}❌ Attempting to commit .env files:${NC}"
    echo "$ENV_FILES"
    ERRORS=1
fi

# 2. Check for hardcoded secrets in staged files
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(py|ts|tsx|js|json|yml|yaml)$' || true)
if [ -n "$STAGED" ]; then
    for file in $STAGED; do
        # Stripe keys
        if grep -qE 'sk_(live|test)_[a-zA-Z0-9]{20,}' "$file" 2>/dev/null; then
            echo -e "${RED}❌ Stripe secret key found in $file${NC}"
            ERRORS=1
        fi
        # AWS keys
        if grep -qE 'AKIA[0-9A-Z]{16}' "$file" 2>/dev/null; then
            echo -e "${RED}❌ AWS access key found in $file${NC}"
            ERRORS=1
        fi
        # Private keys
        if grep -q 'BEGIN.*PRIVATE KEY' "$file" 2>/dev/null; then
            # Ignorar arquivos de CI que contêm a regex como padrão de detecção
            if [[ "$file" != *"workflows"* ]] && [[ "$file" != *"pre-commit"* ]]; then
                echo -e "${RED}❌ Private key found in $file${NC}"
                ERRORS=1
            fi
        fi
    done
fi

# 3. Check for database files
DB_FILES=$(git diff --cached --name-only | grep -E '\.(db|sqlite|sqlite3)$' || true)
if [ -n "$DB_FILES" ]; then
    echo -e "${RED}❌ Database files being committed:${NC}"
    echo "$DB_FILES"
    ERRORS=1
fi

# 4. Python syntax check
PY_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.py$' || true)
if [ -n "$PY_FILES" ]; then
    for file in $PY_FILES; do
        python3 -c "import ast; ast.parse(open('$file').read())" 2>/dev/null || {
            echo -e "${RED}❌ Syntax error in $file${NC}"
            ERRORS=1
        }
    done
fi

# 5. Check for eval/exec in Python
if [ -n "$PY_FILES" ]; then
    for file in $PY_FILES; do
        if grep -n 'eval(' "$file" 2>/dev/null | grep -v '# nosec' | grep -v '#.*eval'; then
            echo -e "${YELLOW}⚠️  eval() usage in $file — ensure this is safe${NC}"
        fi
    done
fi

if [ $ERRORS -eq 1 ]; then
    echo -e "\n${RED}❌ Pre-commit checks FAILED. Fix issues above before committing.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All pre-commit checks passed${NC}"
