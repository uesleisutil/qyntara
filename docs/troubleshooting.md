# Troubleshooting B3TR

## 🚨 Problemas Comuns

### 1. Lambda Import Errors

#### Erro: "Unable to import module pandas"
**Causa**: Problema com Lambda layer
**Solução**: 
- Verificar se está na região us-east-1
- O sistema usa AWS managed layer automaticamente

#### Erro: "No module named 'ml'"
**Causa**: Estrutura de imports incorreta
**Solução**: Verificar se o código Lambda está no diretório correto

### 2. Problemas de Permissão

#### Erro: "AccessDenied on brapi/pro/token"
**Causa**: Lambda não tem permissão para acessar Secrets Manager
**Solução**:
```bash
# Verificar se o secret existe
aws secretsmanager describe-secret --secret-id brapi/pro/token

# Recriar se necessário
aws secretsmanager create-secret \
  --name "brapi/pro/token" \
  --secret-string '{"token":"SEU_TOKEN"}'
```

#### Erro: "Access Denied" no S3
**Causa**: IAM role da Lambda sem permissões adequadas
**Solução**: Verificar políticas IAM no CDK

### 3. Problemas de Dados

#### Nenhum dado no S3
**Verificações**:
1. Horário de execução (apenas durante pregão)
2. Token BRAPI válido
3. Universe.txt configurado corretamente

```bash
# Testar manualmente
aws lambda invoke \
  --function-name $(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'Ingest')].FunctionName" \
    --output text) \
  --payload '{}' /tmp/test.json
```

#### Bootstrap não completa
**Causa**: Timeout ou erro na API BRAPI
**Solução**:
```bash
# Verificar logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/B3Tactical"

# Verificar estado do bootstrap
aws s3 ls s3://SEU-BUCKET/curated/daily_monthly/_bootstrap/
```

### 4. Problemas de Modelo

#### Erro no treinamento SageMaker
**Verificações**:
1. Dados suficientes no S3
2. Formato JSONL correto
3. Permissões SageMaker

```bash
# Verificar jobs SageMaker
aws sagemaker list-training-jobs --status-equals Failed
```

#### MAPE muito alto
**Causas possíveis**:
- Dados insuficientes
- Parâmetros do modelo inadequados
- Mudança no regime de mercado

**Soluções**:
- Aumentar `B3TR_CONTEXT_LENGTH`
- Ajustar `B3TR_MIN_POINTS`
- Re-treinar com dados mais recentes

### 5. Problemas de Monitoramento

#### Alarmes não disparam
**Verificações**:
1. Email confirmado no SNS
2. Métricas sendo publicadas
3. Threshold do alarme adequado

```bash
# Verificar subscrições SNS
aws sns list-subscriptions-by-topic \
  --topic-arn $(aws cloudformation describe-stacks \
    --stack-name B3TacticalRankingStack \
    --query 'Stacks[0].Outputs[?OutputKey==`AlertsTopicArn`].OutputValue' \
    --output text)
```

#### Métricas não aparecem
**Causa**: Lambda não está publicando métricas
**Solução**: Verificar logs da Lambda de monitoramento

## 🔍 Comandos de Diagnóstico

### Verificar Status Geral
```bash
# Listar todas as funções Lambda
aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'B3Tactical')].{Name:FunctionName,Runtime:Runtime,LastModified:LastModified}"

# Verificar schedules EventBridge
aws events list-rules \
  --query "Rules[?contains(Name, 'B3Tactical')].{Name:Name,State:State,Schedule:ScheduleExpression}"

# Verificar alarmes CloudWatch
aws cloudwatch describe-alarms \
  --query "MetricAlarms[?contains(AlarmName, 'B3Tactical')].{Name:AlarmName,State:StateValue}"
```

### Verificar Dados S3
```bash
export BUCKET=$(aws cloudformation describe-stacks \
  --stack-name B3TacticalRankingStack \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

# Verificar estrutura de dados
aws s3 ls s3://$BUCKET/ --recursive | head -20

# Verificar dados recentes
aws s3 ls s3://$BUCKET/raw/quotes_5m/ --recursive | tail -10
```

### Verificar Logs
```bash
# Logs mais recentes de uma Lambda
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/B3TacticalRankingStack-BootstrapHistoryDaily*" \
  --order-by LastEventTime --descending --max-items 1

# Tail logs em tempo real
aws logs tail "/aws/lambda/B3TacticalRankingStack-Quotes5mIngest*" --follow
```

## 📞 Suporte

### Logs Importantes
1. **Lambda Logs**: `/aws/lambda/B3TacticalRankingStack-*`
2. **SageMaker Logs**: `/aws/sagemaker/TrainingJobs`
3. **EventBridge**: Não tem logs diretos, verificar execuções Lambda

### Métricas de Saúde
- `B3TR/IngestionOK`: Deve ser 1 durante pregão
- `B3TR/ModelMAPE`: Deve ser < 0.20 (configurável)
- `AWS/Lambda/Duration`: Tempo de execução das Lambdas
- `AWS/Lambda/Errors`: Erros nas Lambdas

### Contatos
- Issues: GitHub Issues
- Documentação: `/docs`
- Logs: CloudWatch