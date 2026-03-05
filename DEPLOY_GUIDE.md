# 🚀 Guia de Deploy do Dashboard - GitHub Pages

## Passo 1: Push para o GitHub

```bash
git push origin main
```

## Passo 2: Configurar GitHub Secrets

1. Acesse seu repositório no GitHub: https://github.com/uesleisutil/b3-tactical-ranking
2. Vá em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**
4. Adicione os seguintes secrets:

### Secrets Necessários:

| Nome do Secret | Valor | Onde Encontrar |
|----------------|-------|----------------|
| `AWS_REGION` | `us-east-1` | Região do seu bucket S3 |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | Credenciais AWS (veja abaixo) |
| `AWS_SECRET_ACCESS_KEY` | `wJalr...` | Credenciais AWS (veja abaixo) |
| `S3_BUCKET` | `b3tr-200093399689-us-east-1` | Nome do seu bucket S3 |

### Como Criar Credenciais AWS (IAM User):

```bash
# 1. Criar usuário IAM (via AWS Console ou CLI)
aws iam create-user --user-name dashboard-readonly

# 2. Criar política inline com permissões mínimas
cat > dashboard-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::b3tr-200093399689-us-east-1",
        "arn:aws:s3:::b3tr-200093399689-us-east-1/*"
      ]
    }
  ]
}
EOF

# 3. Anexar política ao usuário
aws iam put-user-policy \
  --user-name dashboard-readonly \
  --policy-name DashboardReadOnlyPolicy \
  --policy-document file://dashboard-policy.json

# 4. Criar access keys
aws iam create-access-key --user-name dashboard-readonly
```

**Importante:** Guarde o `AccessKeyId` e `SecretAccessKey` que aparecerem!

## Passo 3: Habilitar GitHub Pages

1. No seu repositório, vá em **Settings** → **Pages**
2. Em **Source**, selecione **GitHub Actions**
3. Clique em **Save**

## Passo 4: Configurar CORS no S3

Execute este comando para configurar CORS no bucket S3:

```bash
cat > cors-config.json << 'EOF'
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://uesleisutil.github.io"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3600
  },
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3600
  }
]
EOF

aws s3api put-bucket-cors \
  --bucket b3tr-200093399689-us-east-1 \
  --cors-configuration file://cors-config.json
```

## Passo 5: Fazer o Deploy

O deploy acontece automaticamente! Você tem duas opções:

### Opção A: Deploy Automático (Recomendado)
Já foi feito! O push para `main` já disparou o workflow.

### Opção B: Deploy Manual
1. Vá em **Actions** no GitHub
2. Selecione **Deploy Dashboard to GitHub Pages**
3. Clique em **Run workflow**
4. Selecione a branch `main`
5. Clique em **Run workflow**

## Passo 6: Acompanhar o Deploy

1. Vá em **Actions** no GitHub
2. Clique no workflow que está rodando
3. Acompanhe os logs:
   - **Build**: Instala dependências e compila o React
   - **Deploy**: Publica no GitHub Pages

⏱️ O deploy leva cerca de 2-3 minutos.

## Passo 7: Acessar o Dashboard

Após o deploy concluir, acesse:

🌐 **https://uesleisutil.github.io/b3-tactical-ranking**

## ✅ Checklist de Verificação

Após o deploy, verifique:

- [ ] Dashboard carrega sem erros
- [ ] Tabela de recomendações exibe dados
- [ ] Gráfico de qualidade do modelo aparece
- [ ] Gráfico de ingestão aparece
- [ ] Status do sistema mostra indicadores
- [ ] Botão "Atualizar" funciona
- [ ] Não há erros no console do navegador (F12)
- [ ] Design responsivo funciona no mobile

## 🔧 Troubleshooting

### Erro: "Configuration error: Missing environment variables"
**Solução:** Verifique se todos os secrets estão configurados no GitHub.

### Erro: "Unable to connect to data source"
**Solução:** Verifique se o CORS está configurado no S3.

### Erro: "Authentication failed"
**Solução:** Verifique se as credenciais AWS estão corretas e têm permissões.

### Dashboard não carrega
**Solução:** 
1. Verifique se o workflow completou com sucesso
2. Aguarde 1-2 minutos após o deploy
3. Limpe o cache do navegador (Ctrl+Shift+R)

## 📱 Testar Localmente (Opcional)

Se quiser testar antes do deploy:

```bash
cd dashboard

# Criar arquivo .env com suas credenciais
cat > .env << 'EOF'
REACT_APP_AWS_REGION=us-east-1
REACT_APP_AWS_ACCESS_KEY_ID=sua-access-key
REACT_APP_AWS_SECRET_ACCESS_KEY=sua-secret-key
REACT_APP_S3_BUCKET=b3tr-200093399689-us-east-1
EOF

# Instalar dependências
npm install

# Rodar localmente
npm start
```

Acesse: http://localhost:3000

## 🔄 Atualizações Futuras

Para fazer atualizações no dashboard:

```bash
# 1. Faça suas mudanças no código
# 2. Commit e push
git add .
git commit -m "feat: sua mudança"
git push origin main

# 3. O deploy acontece automaticamente!
```

## 💰 Custos

- **GitHub Pages:** GRÁTIS ✅
- **S3 (armazenamento):** ~$0.50/mês
- **S3 (requests):** ~$0.10/mês
- **Total:** ~$0.60/mês (muito mais barato que QuickSight!)

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs no GitHub Actions
2. Verifique o console do navegador (F12)
3. Consulte `dashboard/DEPLOYMENT_TESTING.md` para troubleshooting detalhado
4. Consulte `dashboard/S3_CORS_CONFIGURATION.md` para problemas de CORS

---

**Pronto!** Seu dashboard está no ar! 🎉
