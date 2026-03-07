#!/bin/bash
# Script para forçar deploy do dashboard no GitHub Pages
# Autor: B3TR Team
# Data: 2026-03-07

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Forçar Deploy do Dashboard - GitHub Pages${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}📋 Este script irá:${NC}"
echo "  1. Fazer commit das mudanças no dashboard"
echo "  2. Push para o GitHub (trigger do workflow)"
echo "  3. Verificar status do deploy"
echo ""

# Verificar se há mudanças
if [[ -z $(git status -s dashboard/) ]]; then
    echo -e "${YELLOW}⚠️  Nenhuma mudança detectada no dashboard${NC}"
    echo -e "${YELLOW}   Criando mudança trivial para forçar deploy...${NC}"
    
    # Adicionar timestamp ao README
    echo "" >> dashboard/README.md
    echo "<!-- Last deploy: $(date) -->" >> dashboard/README.md
fi

echo ""
echo -e "${YELLOW}📦 Fazendo commit das mudanças...${NC}"

git add dashboard/
git commit -m "chore(dashboard): force deploy v2.0.0 - $(date +%Y-%m-%d)"

echo ""
echo -e "${YELLOW}🚀 Fazendo push para GitHub...${NC}"

git push origin main

echo ""
echo -e "${GREEN}✅ Push concluído!${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Próximos Passos${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "1. Aguarde 2-3 minutos para o GitHub Actions processar"
echo ""
echo "2. Verifique o status do workflow:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo ""
echo "3. Após o deploy, acesse o dashboard:"
echo "   https://$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | cut -d'/' -f1).github.io/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | cut -d'/' -f2)/"
echo ""
echo "4. Limpe o cache do navegador se necessário:"
echo "   - Chrome/Edge: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)"
echo "   - Firefox: Ctrl+F5 (Windows) ou Cmd+Shift+R (Mac)"
echo "   - Safari: Cmd+Option+R (Mac)"
echo ""

echo -e "${GREEN}🎉 Deploy iniciado com sucesso!${NC}"
echo ""
