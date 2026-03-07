# 🚀 Instruções para Deploy do Dashboard v2.0.0

**Data:** 07/03/2026  
**Status:** Pronto para deploy

---

## 📋 Mudanças Realizadas no Dashboard

### Arquivos Atualizados

1. ✅ **dashboard/package.json** - Versão atualizada para 2.0.0
2. ✅ **dashboard/src/App.js** - Comentário de versão atualizado
3. ✅ **dashboard/README.md** - Documentação atualizada com versão 2.0.0

### Arquivos Removidos (Limpeza)

- ✅ dashboard/DASHBOARD_STRUCTURE.md
- ✅ dashboard/DEPLOYMENT_TESTING.md
- ✅ dashboard/S3_CORS_CONFIGURATION.md
- ✅ dashboard/setup_dashboard.sh
- ✅ dashboard/src/components/*/README.md (vários)
- ✅ dashboard/src/components/*/.gitkeep (vários)

---

## 🚀 Como Fazer o Deploy

### Opção 1: Script Automatizado (Recomendado)

```bash
./scripts/force-dashboard-deploy.sh
```

Este script irá:
1. Fazer commit das mudanças no dashboard
2. Push para o GitHub (trigger automático do workflow)
3. Mostrar instruções de verificação

### Opção 2: Manual

```bash
# 1. Adicionar mudanças
git add dashboard/

# 2. Commit
git commit -m "chore(dashboard): deploy v2.0.0"

# 3. Push (isso dispara o GitHub Actions)
git push origin main
```

---

## ⏱️ Tempo de Deploy

- **Build**: ~2-3 minutos
- **Deploy**: ~1 minuto
- **Total**: ~3-4 minutos

---

## 🔍 Verificar Status do Deploy

### Via GitHub Web

1. Vá para: https://github.com/uesleisutil/b3-tactical-ranking/actions
2. Procure pelo workflow "Deploy Dashboard to GitHub Pages"
3. Clique no workflow mais recente
4. Acompanhe o progresso

### Via GitHub CLI (opcional)

```bash
# Instalar GitHub CLI se necessário
# brew install gh  # macOS

# Ver status dos workflows
gh run list --workflow=deploy-dashboard.yml

# Ver logs do último run
gh run view --log
```

---

## 🌐 Acessar o Dashboard

### URL
```
https://uesleisutil.github.io/b3-tactical-ranking
```

### Limpar Cache do Navegador

Se o dashboard ainda mostrar a versão antiga:

**Chrome/Edge (Windows/Linux)**
```
Ctrl + Shift + R
```

**Chrome/Edge (Mac)**
```
Cmd + Shift + R
```

**Firefox (Windows/Linux)**
```
Ctrl + F5
```

**Firefox (Mac)**
```
Cmd + Shift + R
```

**Safari (Mac)**
```
Cmd + Option + R
```

### Modo Anônimo/Privado

Alternativamente, abra o dashboard em uma janela anônima/privada:
- Chrome/Edge: Ctrl+Shift+N (Windows) ou Cmd+Shift+N (Mac)
- Firefox: Ctrl+Shift+P (Windows) ou Cmd+Shift+P (Mac)
- Safari: Cmd+Shift+N (Mac)

---

## ✅ Checklist de Verificação

Após o deploy, verifique:

### Funcionalidades Básicas
- [ ] Dashboard carrega sem erros
- [ ] Tabela de recomendações aparece
- [ ] Gráficos de qualidade do modelo aparecem
- [ ] Status de ingestão aparece
- [ ] Indicadores de sistema aparecem

### Funcionalidades Avançadas
- [ ] Botão "Atualizar" funciona
- [ ] Auto-refresh está funcionando (aguarde 5 minutos)
- [ ] Timestamp de última atualização aparece
- [ ] Não há erros no console (F12 > Console)

### Design
- [ ] Layout responsivo funciona
- [ ] Cores e ícones corretos
- [ ] Fontes carregando corretamente
- [ ] Animações funcionando

### Dados
- [ ] Dados de recomendações carregando
- [ ] Dados de qualidade carregando
- [ ] Dados de ingestão carregando
- [ ] Datas e horários corretos

---

## 🐛 Troubleshooting

### Dashboard não atualiza após deploy

**Causa**: Cache do navegador ou CDN do GitHub Pages

**Solução**:
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Aguarde 5-10 minutos (propagação do CDN)
3. Tente em modo anônimo
4. Verifique se o workflow completou com sucesso

### Erro 404 no dashboard

**Causa**: GitHub Pages não configurado ou deploy falhou

**Solução**:
1. Verifique Settings > Pages no GitHub
2. Source deve ser "GitHub Actions"
3. Verifique se o workflow completou sem erros
4. Aguarde alguns minutos e tente novamente

### Erro "Unable to connect to data source"

**Causa**: Credenciais AWS não configuradas ou CORS não configurado

**Solução**:
1. Verifique GitHub Secrets (Settings > Secrets and variables > Actions)
2. Verifique CORS no bucket S3
3. Veja DEPLOY_GUIDE.md para instruções detalhadas

### Workflow falha no build

**Causa**: Erro no código ou dependências

**Solução**:
1. Verifique os logs do workflow no GitHub Actions
2. Teste o build localmente: `cd dashboard && npm install && npm run build`
3. Corrija os erros e faça novo commit

---

## 📊 Monitorar Deploy

### GitHub Actions

O workflow `deploy-dashboard.yml` tem 2 jobs:

1. **build** - Instala dependências e faz build
   - Duração: ~2-3 minutos
   - Cria artifact com os arquivos do build

2. **deploy** - Faz deploy para GitHub Pages
   - Duração: ~1 minuto
   - Publica os arquivos no GitHub Pages

### Logs Importantes

Procure por estas mensagens nos logs:

✅ **Sucesso**:
```
Build completed successfully
Artifact uploaded successfully
Deployment completed successfully
```

❌ **Erro**:
```
Error: Build failed
Error: Deployment failed
```

---

## 🔄 Rollback (se necessário)

Se o novo deploy tiver problemas:

### Via GitHub Web

1. Vá para Actions
2. Encontre o último workflow bem-sucedido
3. Clique em "Re-run jobs"

### Via Git

```bash
# Reverter último commit
git revert HEAD

# Push
git push origin main
```

---

## 📞 Suporte

Se tiver problemas:

1. **Logs do Workflow**: Verifique GitHub Actions
2. **Console do Navegador**: Pressione F12 e veja Console
3. **Documentação**: Consulte dashboard/README.md
4. **Issues**: Abra uma issue no GitHub

---

## 🎉 Próximos Passos

Após o deploy bem-sucedido:

1. ✅ Compartilhe o link do dashboard
2. ✅ Anuncie nas redes sociais
3. ✅ Monitore feedback dos usuários
4. ✅ Planeje melhorias para v2.1.0

---

## 📝 Notas Importantes

- O deploy é **automático** quando há push na pasta `dashboard/`
- O GitHub Pages pode levar **5-10 minutos** para propagar mudanças
- O cache do navegador pode mostrar versão antiga - **limpe o cache**
- O dashboard é **100% estático** - não requer servidor backend
- Todos os dados vêm **diretamente do S3**

---

**Pronto para fazer o deploy? Execute:**

```bash
./scripts/force-dashboard-deploy.sh
```

**Boa sorte! 🚀**
