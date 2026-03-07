#!/bin/bash
# Script para fazer push com instruções de autenticação
# Autor: B3TR Team
# Data: 2026-03-07

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Push para GitHub - B3TR v2.0.0${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}📋 Verificando configuração...${NC}"
echo ""

# Verificar remote
REMOTE_URL=$(git remote get-url origin)
echo -e "${GREEN}✅ Remote configurado: ${REMOTE_URL}${NC}"
echo ""

# Verificar se há commits para push
COMMITS_AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")

if [ "$COMMITS_AHEAD" -eq "0" ]; then
    echo -e "${GREEN}✅ Já está sincronizado com o GitHub!${NC}"
    echo ""
    echo -e "${BLUE}📊 Status:${NC}"
    git log --oneline -3
    echo ""
    echo -e "${GREEN}🎉 Nada para fazer! Tudo já está no GitHub.${NC}"
    exit 0
fi

echo -e "${YELLOW}📦 Há ${COMMITS_AHEAD} commit(s) para enviar${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Autenticação Necessária${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}🔑 Você precisará de um Personal Access Token do GitHub${NC}"
echo ""
echo "1. Abra este link no navegador:"
echo -e "${BLUE}   https://github.com/settings/tokens/new${NC}"
echo ""
echo "2. Configure o token:"
echo "   - Note: B3TR Deploy"
echo "   - Expiration: 90 days"
echo "   - Selecione: ✅ repo (todos os sub-items)"
echo ""
echo "3. Clique em 'Generate token'"
echo ""
echo "4. COPIE o token (você não verá novamente!)"
echo ""
echo "5. Quando o git pedir:"
echo "   - Username: uesleisutil"
echo "   - Password: [COLE O TOKEN AQUI]"
echo ""

read -p "Pressione Enter quando estiver pronto para fazer o push..."

echo ""
echo -e "${YELLOW}🚀 Fazendo push...${NC}"
echo ""

# Tentar fazer push
if git push origin main; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✅ Push Concluído com Sucesso!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    echo -e "${BLUE}📊 Próximos Passos:${NC}"
    echo ""
    echo "1. Verificar GitHub Actions (deploy automático):"
    echo "   https://github.com/uesleisutil/b3-tactical-ranking/actions"
    echo ""
    echo "2. Aguardar 3-4 minutos para o build completar"
    echo ""
    echo "3. Acessar o dashboard:"
    echo "   https://uesleisutil.github.io/b3-tactical-ranking"
    echo ""
    echo "4. Limpar cache do navegador se necessário:"
    echo "   - Mac: Cmd + Shift + R"
    echo "   - Windows: Ctrl + Shift + R"
    echo ""
    
    echo -e "${GREEN}🎉 Tudo pronto! O deploy automático foi iniciado!${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ❌ Erro no Push${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    echo -e "${YELLOW}💡 Possíveis soluções:${NC}"
    echo ""
    echo "1. Verifique se o token tem permissões 'repo'"
    echo "2. Verifique se o token não expirou"
    echo "3. Tente criar um novo token"
    echo "4. Verifique sua conexão com a internet"
    echo ""
    
    echo "Para criar novo token:"
    echo "https://github.com/settings/tokens/new"
    echo ""
    
    exit 1
fi
