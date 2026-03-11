# Checkpoint 3: Validação de Ingestão de Dados

Este documento descreve como validar que a implementação da ingestão de dados está funcionando corretamente.

## Pré-requisitos

- AWS CLI configurado
- Infraestrutura deployada (Task 1)
- Token BRAPI configurado no Secrets Manager
- Bucket S3 criado

## Validações

### 1. Executar Ingest Lambda Manualmente

```bash
# Via AWS CLI
aws lambda invoke \
  --function-name Quotes5mIngest \
  --payload '{}' \
  response.json

cat response.json
```

Resultado esperado:
```json
{
  "ok": true,
  "records_saved": 150,
  "tickers_processed": 50,
  "errors_count": 0,
  "latency_p95_ms": 1234.56
}
```

### 2. Validar que Credenciais Não Aparecem em Logs

```bash
# Buscar logs da Lambda
aws logs tail /aws/lambda/Quotes5mIngest --follow

# Verificar que NÃO aparecem:
# - Token BRAPI
# - AWS Access Keys
# - Qualquer credencial
```

✅ **Critério de Sucesso**: Logs mostram "BRAPI token loaded successfully" mas NÃO mostram o token.

### 3. Verificar Retry Logic

Para testar retry logic, você pode:

**Opção A: Simular erro 429 (rate limit)**
- Fazer múltiplas chamadas rápidas à Lambda
- Verificar logs para ver retry com Retry-After

**Opção B: Simular erro 5xx**
- Temporariamente modificar URL da API para endpoint inválido
- Verificar logs para ver backoff exponencial (1s, 2s, 4s)

```bash
# Verificar logs de retry
aws logs filter-log-events \
  --log-group-name /aws/lambda/Quotes5mIngest \
  --filter-pattern "retry"
```

✅ **Critério de Sucesso**: Logs mostram tentativas de retry com delays corretos.

### 4. Verificar Dados no S3

```bash
# Listar dados de hoje
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://b3tr-{account-id}-{region}/quotes_5m/dt=$TODAY/ | head -10

# Exemplo de saída:
# 2024-01-15 14:05:23    456 PETR4_140500.json
# 2024-01-15 14:05:24    432 VALE3_140500.json
# ...
```

✅ **Critério de Sucesso**: Arquivos existem com formato `{TICKER}_{HHMMSS}.json`.

**Verificar conteúdo de um arquivo:**

```bash
aws s3 cp s3://b3tr-{account-id}-{region}/quotes_5m/dt=$TODAY/PETR4_140500.json - | jq .
```

Estrutura esperada:
```json
{
  "ticker": "PETR4",
  "timestamp": "2024-01-15T14:05:00Z",
  "open": 30.0,
  "high": 31.0,
  "low": 29.5,
  "close": 30.5,
  "volume": 1000000,
  "ingested_at": "2024-01-15T14:05:23Z"
}
```

✅ **Critério de Sucesso**: Dados contêm todos os campos obrigatórios.

### 5. Verificar Metadados de Ingestão

```bash
# Listar metadados de hoje
aws s3 ls s3://b3tr-{account-id}-{region}/monitoring/ingestion/dt=$TODAY/

# Ler último metadado
aws s3 cp s3://b3tr-{account-id}-{region}/monitoring/ingestion/dt=$TODAY/ingestion_140523.json - | jq .
```

Estrutura esperada:
```json
{
  "timestamp": "2024-01-15T14:05:23Z",
  "status": "success",
  "records_ingested": 150,
  "tickers_processed": 50,
  "tickers_requested": 50,
  "errors_count": 0,
  "latency_metrics": {
    "avg": 1234.56,
    "p50": 1200.0,
    "p95": 1500.0,
    "p99": 1800.0
  },
  "source": "brapi"
}
```

✅ **Critério de Sucesso**: Metadados incluem todas as métricas.

### 6. Verificar Métricas de Latência

```bash
# Listar métricas de latência
aws s3 ls s3://b3tr-{account-id}-{region}/monitoring/api_latency/dt=$TODAY/

# Ler métricas
aws s3 cp s3://b3tr-{account-id}-{region}/monitoring/api_latency/dt=$TODAY/latency_140523.json - | jq .
```

Estrutura esperada:
```json
{
  "timestamp": "2024-01-15T14:05:23Z",
  "latencies_ms": [1234.5, 1456.7, 1123.4],
  "metrics": {
    "avg": 1271.53,
    "p50": 1234.5,
    "p95": 1456.7,
    "p99": 1456.7
  },
  "num_requests": 3
}
```

✅ **Critério de Sucesso**: Latências são medidas e percentis calculados.

### 7. Verificar Registro de Erros

Se houver erros durante a ingestão:

```bash
# Listar erros
aws s3 ls s3://b3tr-{account-id}-{region}/monitoring/errors/dt=$TODAY/

# Ler erros
aws s3 cp s3://b3tr-{account-id}-{region}/monitoring/errors/dt=$TODAY/errors_140523.json - | jq .
```

Estrutura esperada:
```json
{
  "timestamp": "2024-01-15T14:05:23Z",
  "errors": [
    {
      "timestamp": "2024-01-15T14:05:20Z",
      "batch": 2,
      "tickers": ["TICKER1", "TICKER2"],
      "error": "Client error 404: Not found",
      "url": "https://brapi.dev/api/quote/..."
    }
  ],
  "total_errors": 1
}
```

✅ **Critério de Sucesso**: Erros são registrados com detalhes completos.

### 8. Verificar CloudWatch Metrics

```bash
# Verificar métrica IngestionOK
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name IngestionOK \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Minimum

# Verificar métrica RecordsIngested
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name RecordsIngested \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

✅ **Critério de Sucesso**: Métricas são publicadas no CloudWatch.

## Teste Local (Opcional)

Para testar localmente antes de deploy:

```bash
# Configurar variáveis de ambiente
export BUCKET=b3tr-{account-id}-{region}
export BRAPI_SECRET_ID=brapi/pro/token

# Executar script de teste
python ml/scripts/test_ingest_local.py
```

## Testes Unitários

```bash
# Executar testes unitários
cd ml
pytest tests/test_ingest_quotes.py -v

# Executar com coverage
pytest tests/test_ingest_quotes.py --cov=src.lambdas.ingest_quotes --cov-report=html
```

✅ **Critério de Sucesso**: Todos os testes passam.

## Checklist de Validação

- [ ] Lambda executa sem erros
- [ ] Credenciais NÃO aparecem em logs
- [ ] Retry logic funciona (verificado em logs)
- [ ] Dados salvos no S3 com particionamento correto
- [ ] Metadados de ingestão salvos
- [ ] Métricas de latência calculadas
- [ ] Erros registrados (se houver)
- [ ] CloudWatch metrics publicadas
- [ ] Testes unitários passam

## Troubleshooting

### Lambda retorna erro "Access denied" ao acessar Secrets Manager

**Solução**: Verificar IAM role da Lambda tem permissão `secretsmanager:GetSecretValue`.

```bash
aws lambda get-function --function-name Quotes5mIngest | jq .Configuration.Role
aws iam get-role-policy --role-name <role-name> --policy-name <policy-name>
```

### Nenhum dado salvo no S3

**Possíveis causas**:
1. Token BRAPI inválido ou expirado
2. Rate limit da API BRAPI
3. Tickers no universe.txt inválidos

**Solução**: Verificar logs da Lambda para detalhes do erro.

### Latência muito alta (p95 > 5s)

**Possíveis causas**:
1. API BRAPI lenta
2. Muitos tickers por batch
3. Problemas de rede

**Solução**: Verificar `monitoring/api_latency/` para detalhes.

## Próximos Passos

Após validação bem-sucedida:

1. ✅ Task 3 completa
2. ⏭️ Task 4: Implementar Data Governance - Validação e Qualidade
3. ⏭️ Task 5: Implementar Data Lineage Tracking
