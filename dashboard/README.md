# B3TR Dashboard

**Versão:** 2.0.0  
**Data:** 07/03/2026  
**Status:** ✅ Produção

Dashboard web para monitoramento do sistema B3 Tactical Ranking MLOps.

## 🚀 Características

- **100% Serverless**: Hospedado no GitHub Pages
- **Custo Zero**: Solução gratuita sem custos de hospedagem
- **Tempo Real**: Atualização automática a cada 5 minutos
- **Responsivo**: Funciona em desktop, tablet e mobile
- **Dados Diretos**: Lê dados diretamente do S3

## 📊 Métricas Monitoradas

### Recomendações de Ações
- Top 10 ações recomendadas diariamente
- Score de confiança e retorno previsto
- Classificação por setor
- Indicadores visuais com cores (verde para retornos positivos, vermelho para negativos)

### Qualidade do Modelo
- MAPE (Mean Absolute Percentage Error)
- Cobertura das predições
- Tendência histórica de performance (últimos 14 dias)
- Alertas quando MAPE > 15% ou cobertura < 80%

### Ingestão de Dados
- Taxa de sucesso das execuções (últimas 24 horas)
- Volume de dados processados
- Monitoramento de erros
- Gráfico de barras com histórico de ingestão

### Status Geral
- Saúde geral do sistema
- Indicadores de status para cada subsistema
- Alertas e notificações
- Última atualização

## 🛠️ Tecnologias

- **Frontend**: React 18.2
- **Gráficos**: Recharts 2.12
- **AWS SDK**: @aws-sdk/client-s3 v3
- **Ícones**: lucide-react 0.460
- **Data/Hora**: date-fns 3.6
- **Hospedagem**: GitHub Pages
- **CI/CD**: GitHub Actions

## 🔧 Desenvolvimento Local

### Pré-requisitos

- Node.js 18 ou superior
- npm ou yarn
- Credenciais AWS com acesso de leitura ao bucket S3

### Configuração

1. Clone o repositório e navegue até o diretório do dashboard:
```bash
cd dashboard
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Edite o arquivo `.env` com suas configurações:
```bash
# AWS Configuration
REACT_APP_AWS_REGION=us-east-1
REACT_APP_S3_BUCKET=b3tr-YOUR_ACCOUNT_ID-us-east-1

# AWS Credentials (para desenvolvimento local)
REACT_APP_AWS_ACCESS_KEY_ID=your_access_key_here
REACT_APP_AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

### Variáveis de Ambiente Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `REACT_APP_AWS_REGION` | Região AWS do bucket S3 | `us-east-1` |
| `REACT_APP_S3_BUCKET` | Nome do bucket S3 | `b3tr-200093399689-us-east-1` |
| `REACT_APP_AWS_ACCESS_KEY_ID` | Access Key ID da AWS | `AKIA...` |
| `REACT_APP_AWS_SECRET_ACCESS_KEY` | Secret Access Key da AWS | `...` |

**Importante**: As credenciais AWS devem ter permissões de leitura (`s3:GetObject`, `s3:ListBucket`) para os seguintes prefixos no bucket:
- `recommendations/`
- `monitoring/model_quality/`
- `monitoring/ingestion/`

### Executar Localmente

```bash
npm start
```

O dashboard estará disponível em `http://localhost:3000`

### Executar Testes

```bash
npm test
```

### Build de Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados no diretório `build/`.

## 📦 Deploy para GitHub Pages

### Configuração Inicial

1. Configure o GitHub Pages no repositório:
   - Vá em Settings > Pages
   - Source: GitHub Actions

2. Configure os secrets do repositório (Settings > Secrets and variables > Actions):
   - `AWS_REGION`: Região AWS (ex: `us-east-1`)
   - `AWS_ACCESS_KEY_ID`: Access Key ID da AWS
   - `AWS_SECRET_ACCESS_KEY`: Secret Access Key da AWS
   - `S3_BUCKET`: Nome do bucket S3

### Deploy Automático

O deploy é automático via GitHub Actions quando há push para a branch `main` que modifica arquivos no diretório `dashboard/`:

```bash
git add dashboard/
git commit -m "Update dashboard"
git push origin main
```

O workflow `.github/workflows/deploy-dashboard.yml` irá:
1. Instalar dependências
2. Fazer build da aplicação com as variáveis de ambiente
3. Fazer deploy para GitHub Pages

### Deploy Manual

Você também pode fazer deploy manual usando o script npm:

```bash
npm run deploy
```

**Nota**: Para deploy manual, as variáveis de ambiente devem estar configuradas no arquivo `.env`.

### Verificar Deploy

Após o deploy, o dashboard estará disponível em:
```
https://<seu-usuario>.github.io/<nome-do-repositorio>/
```

Exemplo: `https://uesleisutil.github.io/b3-tactical-ranking/`

## 🔐 Segurança

### Credenciais AWS

- **Desenvolvimento Local**: Use arquivo `.env` (nunca commite este arquivo!)
- **GitHub Pages**: Use GitHub Secrets para armazenar credenciais
- **Permissões Mínimas**: As credenciais devem ter apenas acesso de leitura ao S3

### IAM Policy Recomendada

```json
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
        "arn:aws:s3:::b3tr-*",
        "arn:aws:s3:::b3tr-*/recommendations/*",
        "arn:aws:s3:::b3tr-*/monitoring/*"
      ]
    }
  ]
}
```

### CORS no S3

O bucket S3 deve ter CORS configurado para permitir requisições do GitHub Pages. Veja `S3_CORS_CONFIGURATION.md` para detalhes.

### HTTPS

- GitHub Pages fornece HTTPS automaticamente
- Todas as requisições ao S3 usam HTTPS

## 💰 Custos

- **GitHub Pages**: Gratuito para repositórios públicos
- **S3**: ~$0.50/mês (armazenamento de dados + requisições GET)
- **Total**: Solução praticamente gratuita e escalável

## 🔄 Atualizações

O dashboard se atualiza automaticamente:
- **Auto-refresh**: A cada 5 minutos durante uso
- **Refresh Manual**: Botão "Atualizar" para atualização imediata
- **Timestamp**: Exibe horário da última atualização
- **Dados Sincronizados**: Sempre busca os arquivos mais recentes do S3

## 🐛 Troubleshooting

### Erro: "Unable to connect to data source"

**Causa**: Problema de conectividade com S3 ou CORS não configurado.

**Solução**:
1. Verifique se o bucket S3 existe e está acessível
2. Verifique a configuração CORS do bucket (veja `S3_CORS_CONFIGURATION.md`)
3. Verifique sua conexão com a internet

### Erro: "Authentication failed"

**Causa**: Credenciais AWS inválidas ou sem permissões.

**Solução**:
1. Verifique se as variáveis de ambiente estão corretas
2. Verifique se as credenciais têm permissões de leitura no S3
3. Verifique se as credenciais não expiraram

### Erro: "Data parsing failed"

**Causa**: Formato dos dados no S3 está incorreto.

**Solução**:
1. Verifique se os arquivos JSON no S3 estão bem formatados
2. Verifique se os arquivos seguem o schema esperado
3. Verifique os logs do navegador (F12 > Console) para mais detalhes

### Dashboard não atualiza

**Causa**: Problema com o auto-refresh ou dados não estão sendo gerados.

**Solução**:
1. Clique no botão "Atualizar" manualmente
2. Verifique se há novos arquivos sendo gerados no S3
3. Verifique se o sistema de ranking está executando corretamente

## 📚 Estrutura de Dados

O dashboard espera os seguintes arquivos no S3:

### Recomendações
- **Path**: `s3://{bucket}/recommendations/YYYY-MM-DD.json`
- **Atualização**: Diária
- **Conteúdo**: Top 10 ações recomendadas

### Qualidade do Modelo
- **Path**: `s3://{bucket}/monitoring/model_quality/YYYY-MM-DD.json`
- **Atualização**: Diária
- **Conteúdo**: Métricas de performance do modelo

### Ingestão de Dados
- **Path**: `s3://{bucket}/monitoring/ingestion/YYYY-MM-DD-HH-MM.json`
- **Atualização**: A cada execução (5 minutos)
- **Conteúdo**: Status e métricas de ingestão

Para detalhes completos do schema, consulte o arquivo `design.md` na especificação do projeto.
<!-- Last deploy: Sat Mar  7 12:20:50 -03 2026 -->
