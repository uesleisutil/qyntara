# Requirements Document

## Introduction

Este documento especifica os requisitos para a refatoração completa do sistema de recomendações de ações ML, com foco em governança de dados, monitoramento de performance e visualização através de um dashboard redesenhado. O sistema atual possui problemas críticos de segurança (chaves expostas), falta de visibilidade sobre o fluxo de dados, ausência de governança adequada e monitoramento insuficiente de performance e custos.

O objetivo é criar um sistema robusto que:
- Colete dados diários da API BRAPI de forma segura e confiável
- Implemente governança completa sobre dados históricos e novos dados ingeridos
- Monitore a performance do modelo em produção com múltiplas métricas
- Forneça visibilidade total sobre custos da infraestrutura AWS
- Apresente todas essas informações em um dashboard intuitivo com 3 abas principais

## Glossary

- **Data_Pipeline**: Sistema responsável pela coleta, ingestão, validação e armazenamento de dados de mercado
- **BRAPI**: API brasileira de dados de mercado financeiro (brapi.dev) usada como fonte de dados
- **Historical_Data**: Dados de cotações dos últimos 2 anos para 50 tickers da B3, armazenados no S3
- **Daily_Ingestion**: Processo de coleta de dados de mercado que executa diariamente durante o horário de pregão
- **Data_Governance_System**: Sistema que controla qualidade, linhagem e validação de dados
- **Model_Ensemble**: Conjunto de modelos de ML (XGBoost, LSTM, Prophet, DeepAR) que geram recomendações
- **Daily_Recommendations**: Recomendações de ações geradas uma vez por dia ao final do pregão
- **Performance_Monitor**: Sistema que monitora métricas de performance do modelo (MAPE, acurácia direcional, drift)
- **Cost_Monitor**: Sistema que rastreia gastos diários da infraestrutura AWS
- **Dashboard**: Interface React com 3 abas (Recomendações, Monitoramento de Dados, Custos)
- **Secrets_Manager**: Serviço AWS para armazenamento seguro de credenciais e chaves de API
- **Data_Quality_Metrics**: Métricas que avaliam completude, consistência e validade dos dados ingeridos
- **Model_Drift**: Degradação da performance do modelo ao longo do tempo
- **Data_Lineage**: Rastreamento da origem e transformações aplicadas aos dados
- **Cost_Threshold**: Limite de R$500 por mês para gastos totais da infraestrutura

## Requirements

### Requirement 1: Secure API Credentials Management

**User Story:** Como desenvolvedor do sistema, eu quero que todas as credenciais e chaves de API sejam armazenadas de forma segura, para que não haja exposição de informações confidenciais no código ou logs.

#### Acceptance Criteria

1. THE Secrets_Manager SHALL armazenar todas as chaves de API e credenciais
2. WHEN o Data_Pipeline necessita de credenciais, THE Secrets_Manager SHALL fornecer as credenciais sem expô-las em logs
3. THE Sistema SHALL validar que nenhuma chave ou credencial está presente no código-fonte
4. THE Sistema SHALL validar que nenhuma chave ou credencial está presente em variáveis de ambiente commitadas no repositório
5. WHEN uma credencial é rotacionada, THE Secrets_Manager SHALL atualizar a credencial sem necessidade de redeploy do código

### Requirement 2: Daily Market Data Ingestion

**User Story:** Como analista de dados, eu quero que o sistema colete dados de mercado diariamente da BRAPI, para que as recomendações sejam baseadas em informações atualizadas.

#### Acceptance Criteria

1. THE Daily_Ingestion SHALL executar durante o horário de pregão da B3 (10:00-18:00 BRT)
2. WHEN o Daily_Ingestion executa, THE Data_Pipeline SHALL coletar cotações de 5 minutos para os 50 tickers configurados
3. THE Daily_Ingestion SHALL respeitar os limites de rate da API BRAPI (máximo 20 tickers por request, 500ms entre requests)
4. WHEN a API BRAPI retorna erro, THE Daily_Ingestion SHALL realizar retry com backoff exponencial (máximo 3 tentativas)
5. THE Daily_Ingestion SHALL armazenar dados brutos no S3 com particionamento por data (formato: quotes_5m/dt=YYYY-MM-DD/)
6. WHEN a ingestão é concluída, THE Daily_Ingestion SHALL registrar metadados da execução (timestamp, records ingeridos, status)

### Requirement 3: Historical Data Validation

**User Story:** Como engenheiro de ML, eu quero validar a integridade dos dados históricos dos últimos 2 anos, para que o treinamento do modelo use dados confiáveis.

#### Acceptance Criteria

1. THE Data_Governance_System SHALL validar a completude dos dados históricos para os 50 tickers nos últimos 2 anos
2. WHEN dados históricos são validados, THE Data_Governance_System SHALL verificar ausência de gaps maiores que 5 dias úteis consecutivos
3. THE Data_Governance_System SHALL validar que valores de preço (open, high, low, close) são positivos e high >= low
4. THE Data_Governance_System SHALL validar que volume é não-negativo
5. WHEN inconsistências são detectadas, THE Data_Governance_System SHALL gerar relatório detalhado com tickers e datas afetadas
6. THE Data_Governance_System SHALL calcular score de qualidade (0-100) para cada ticker baseado em completude e consistência

### Requirement 4: Data Quality Monitoring

**User Story:** Como engenheiro de dados, eu quero monitorar a qualidade dos dados ingeridos diariamente, para que problemas sejam detectados rapidamente.

#### Acceptance Criteria

1. WHEN novos dados são ingeridos, THE Data_Governance_System SHALL calcular Data_Quality_Metrics
2. THE Data_Quality_Metrics SHALL incluir: completude (% de tickers com dados), latência de ingestão, e taxa de erro
3. WHEN completude cai abaixo de 90%, THE Data_Governance_System SHALL gerar alerta de qualidade
4. THE Data_Governance_System SHALL comparar dados ingeridos com dados do dia anterior para detectar anomalias (variações > 50% em volume ou preço)
5. WHEN anomalias são detectadas, THE Data_Governance_System SHALL registrar evento de anomalia com detalhes do ticker e métrica afetada
6. THE Data_Governance_System SHALL armazenar histórico de Data_Quality_Metrics no S3 (formato: monitoring/data_quality/dt=YYYY-MM-DD/)

### Requirement 5: Data Lineage Tracking

**User Story:** Como auditor de dados, eu quero rastrear a origem e transformações de todos os dados, para que seja possível auditar o pipeline completo.

#### Acceptance Criteria

1. THE Data_Governance_System SHALL registrar Data_Lineage para cada dado ingerido
2. THE Data_Lineage SHALL incluir: fonte (BRAPI), timestamp de coleta, timestamp de armazenamento, e versão do pipeline
3. WHEN dados são transformados, THE Data_Governance_System SHALL registrar a transformação aplicada e timestamp
4. THE Data_Governance_System SHALL manter histórico de Data_Lineage acessível via API
5. THE Data_Lineage SHALL ser armazenada em formato JSON no S3 (formato: monitoring/lineage/dt=YYYY-MM-DD/)

### Requirement 6: Daily Recommendations Generation

**User Story:** Como usuário do sistema, eu quero receber recomendações de ações uma vez por dia ao final do pregão, para que possa tomar decisões de investimento.

#### Acceptance Criteria

1. THE Model_Ensemble SHALL gerar Daily_Recommendations uma vez por dia após o fechamento do mercado (18:30 BRT)
2. WHEN Daily_Recommendations são geradas, THE Model_Ensemble SHALL usar dados ingeridos do mesmo dia
3. THE Model_Ensemble SHALL gerar predições de preço para horizonte de 20 dias (t+20)
4. THE Daily_Recommendations SHALL incluir: ticker, preço atual, preço predito, retorno esperado, score de confiança, e ranking
5. THE Model_Ensemble SHALL selecionar top 50 ações com maior score de confiança
6. WHEN recomendações são geradas, THE Model_Ensemble SHALL armazenar resultado no S3 (formato: recommendations/dt=YYYY-MM-DD/)

### Requirement 7: Multi-Metric Model Performance Monitoring

**User Story:** Como cientista de dados, eu quero monitorar a performance do modelo com múltiplas métricas, para que possa diagnosticar problemas de forma precisa.

#### Acceptance Criteria

1. THE Performance_Monitor SHALL calcular MAPE (Mean Absolute Percentage Error) comparando predições de 20 dias atrás com preços reais
2. THE Performance_Monitor SHALL calcular acurácia direcional (% de vezes que o modelo acertou a direção do movimento)
3. THE Performance_Monitor SHALL calcular MAE (Mean Absolute Error) em valores absolutos de preço
4. THE Performance_Monitor SHALL calcular Sharpe Ratio das recomendações (retorno ajustado por risco)
5. THE Performance_Monitor SHALL calcular taxa de acerto (% de recomendações que geraram retorno positivo)
6. THE Performance_Monitor SHALL executar diariamente após geração de Daily_Recommendations
7. THE Performance_Monitor SHALL armazenar histórico de métricas no S3 (formato: monitoring/performance/dt=YYYY-MM-DD/)

### Requirement 8: Model Drift Detection

**User Story:** Como engenheiro de ML, eu quero detectar quando o modelo está degradando, para que possa retreinar antes que a performance caia significativamente.

#### Acceptance Criteria

1. THE Performance_Monitor SHALL detectar Model_Drift comparando MAPE dos últimos 5 dias com MAPE dos 5 dias anteriores
2. WHEN MAPE recente é 50% maior que MAPE baseline, THE Performance_Monitor SHALL sinalizar Model_Drift
3. THE Performance_Monitor SHALL calcular drift score (0-1) baseado na magnitude da degradação
4. WHEN Model_Drift é detectado, THE Performance_Monitor SHALL gerar alerta com recomendação de retreinamento
5. THE Performance_Monitor SHALL monitorar drift de features individuais comparando distribuições
6. WHEN mais de 30% das features apresentam drift, THE Performance_Monitor SHALL sinalizar feature drift crítico

### Requirement 9: Cost Monitoring and Alerting

**User Story:** Como gestor do projeto, eu quero monitorar os custos diários da infraestrutura, para que não ultrapasse o orçamento de R$500 por mês.

#### Acceptance Criteria

1. THE Cost_Monitor SHALL coletar custos diários de todos os serviços AWS (Lambda, S3, SageMaker, CloudWatch)
2. THE Cost_Monitor SHALL calcular projeção mensal baseada em custos dos últimos 7 dias
3. WHEN projeção mensal ultrapassa Cost_Threshold, THE Cost_Monitor SHALL gerar alerta crítico
4. THE Cost_Monitor SHALL detalhar custos por serviço e por componente (training, inference, storage, compute)
5. THE Cost_Monitor SHALL calcular custo por recomendação gerada
6. THE Cost_Monitor SHALL executar diariamente e armazenar histórico no S3 (formato: monitoring/costs/dt=YYYY-MM-DD/)
7. WHEN custos de um serviço aumentam mais de 50% em relação à média dos últimos 7 dias, THE Cost_Monitor SHALL gerar alerta de anomalia de custo

### Requirement 10: Recommendations Dashboard Tab

**User Story:** Como usuário do sistema, eu quero visualizar as recomendações diárias em um dashboard intuitivo, para que possa tomar decisões rapidamente.

#### Acceptance Criteria

1. THE Dashboard SHALL exibir aba de Recomendações como primeira aba
2. WHEN aba de Recomendações é acessada, THE Dashboard SHALL carregar Daily_Recommendations mais recentes
3. THE Dashboard SHALL exibir tabela com: ticker, preço atual, preço predito (t+20), retorno esperado (%), score de confiança, e ranking
4. THE Dashboard SHALL permitir ordenação por qualquer coluna da tabela
5. THE Dashboard SHALL exibir KPIs de recomendação: número de ações recomendadas, retorno médio esperado, e score médio de confiança
6. THE Dashboard SHALL exibir gráfico de distribuição de retornos esperados
7. WHEN usuário clica em um ticker, THE Dashboard SHALL exibir detalhes da predição incluindo contribuição de cada modelo do ensemble

### Requirement 11: Data Monitoring Dashboard Tab

**User Story:** Como engenheiro de dados, eu quero visualizar o status dos dados e do modelo em um dashboard, para que possa identificar problemas rapidamente.

#### Acceptance Criteria

1. THE Dashboard SHALL exibir aba de Monitoramento de Dados
2. WHEN aba de Monitoramento é acessada, THE Dashboard SHALL exibir status da última ingestão (sucesso/falha, timestamp, records ingeridos)
3. THE Dashboard SHALL exibir score de qualidade dos dados históricos para cada ticker
4. THE Dashboard SHALL exibir Data_Quality_Metrics dos últimos 30 dias em gráfico de linha
5. THE Dashboard SHALL exibir status do modelo: última execução, se rodou com sucesso, e timestamp
6. THE Dashboard SHALL exibir métricas de performance do modelo: MAPE, acurácia direcional, MAE, Sharpe Ratio, e taxa de acerto
7. THE Dashboard SHALL exibir gráfico de evolução de MAPE dos últimos 30 dias com linha de baseline
8. WHEN Model_Drift é detectado, THE Dashboard SHALL exibir alerta visual com severidade (warning/critical)
9. THE Dashboard SHALL exibir lista de features com drift detectado e respectivos drift scores
10. THE Dashboard SHALL exibir eventos de drift dos últimos 30 dias em timeline

### Requirement 12: Costs Dashboard Tab

**User Story:** Como gestor do projeto, eu quero visualizar os custos da infraestrutura em um dashboard, para que possa controlar o orçamento.

#### Acceptance Criteria

1. THE Dashboard SHALL exibir aba de Custos
2. WHEN aba de Custos é acessada, THE Dashboard SHALL exibir custo total do mês atual
3. THE Dashboard SHALL exibir projeção de custo para o mês completo
4. THE Dashboard SHALL exibir gráfico de pizza com distribuição de custos por serviço AWS
5. THE Dashboard SHALL exibir gráfico de linha com evolução de custos diários dos últimos 30 dias
6. THE Dashboard SHALL exibir tabela detalhada com custos por componente (training, inference, storage, compute)
7. THE Dashboard SHALL exibir custo por recomendação gerada
8. WHEN projeção mensal ultrapassa 80% do Cost_Threshold, THE Dashboard SHALL exibir alerta visual
9. WHEN projeção mensal ultrapassa 100% do Cost_Threshold, THE Dashboard SHALL exibir alerta crítico
10. THE Dashboard SHALL permitir filtrar custos por período (últimos 7 dias, 30 dias, mês atual)

### Requirement 13: Dashboard Real-Time Updates

**User Story:** Como usuário do sistema, eu quero que o dashboard atualize automaticamente, para que sempre veja informações atualizadas.

#### Acceptance Criteria

1. THE Dashboard SHALL atualizar dados automaticamente a cada 5 minutos
2. WHEN dados são atualizados, THE Dashboard SHALL exibir indicador visual de atualização
3. THE Dashboard SHALL exibir timestamp da última atualização em cada aba
4. WHEN atualização falha, THE Dashboard SHALL exibir mensagem de erro e manter dados anteriores visíveis
5. THE Dashboard SHALL permitir atualização manual via botão de refresh

### Requirement 14: Historical Data Validation Report

**User Story:** Como engenheiro de ML, eu quero um relatório detalhado da validação dos dados históricos, para que possa corrigir problemas antes do treinamento.

#### Acceptance Criteria

1. THE Data_Governance_System SHALL gerar relatório de validação dos dados históricos
2. THE relatório SHALL incluir: período analisado (últimos 2 anos), número de tickers validados (50), e score de qualidade geral
3. THE relatório SHALL listar todos os gaps detectados com ticker, data inicial, data final, e duração em dias
4. THE relatório SHALL listar todas as inconsistências detectadas com ticker, data, campo afetado, e valor inválido
5. THE relatório SHALL incluir recomendações de ação para cada problema detectado
6. THE relatório SHALL ser armazenado no S3 (formato: monitoring/validation/historical_data_report_YYYY-MM-DD.json)
7. THE relatório SHALL ser acessível via Dashboard na aba de Monitoramento de Dados

### Requirement 15: Automated Model Retraining Trigger

**User Story:** Como cientista de dados, eu quero que o sistema sugira retreinamento automaticamente quando necessário, para que o modelo mantenha boa performance.

#### Acceptance Criteria

1. WHEN Model_Drift é detectado, THE Performance_Monitor SHALL avaliar necessidade de retreinamento
2. THE Performance_Monitor SHALL recomendar retreinamento WHEN MAPE ultrapassa 20% OU drift score ultrapassa 0.5 OU mais de 30% das features apresentam drift
3. WHEN retreinamento é recomendado, THE Performance_Monitor SHALL gerar notificação com justificativa detalhada
4. THE notificação SHALL incluir: métricas atuais, métricas baseline, drift score, e comando para iniciar retreinamento
5. THE Performance_Monitor SHALL registrar todas as recomendações de retreinamento no S3 (formato: monitoring/retrain_recommendations/dt=YYYY-MM-DD/)

### Requirement 16: API Response Time Monitoring

**User Story:** Como desenvolvedor, eu quero monitorar o tempo de resposta da API BRAPI, para que possa detectar problemas de latência.

#### Acceptance Criteria

1. WHEN Daily_Ingestion faz request para BRAPI, THE Data_Pipeline SHALL medir tempo de resposta
2. THE Data_Pipeline SHALL calcular latência média, p50, p95, e p99 para cada batch de requests
3. WHEN latência p95 ultrapassa 5 segundos, THE Data_Pipeline SHALL registrar evento de latência alta
4. THE Data_Pipeline SHALL armazenar métricas de latência no S3 (formato: monitoring/api_latency/dt=YYYY-MM-DD/)
5. THE Dashboard SHALL exibir métricas de latência da API na aba de Monitoramento de Dados

### Requirement 17: Data Completeness Validation

**User Story:** Como engenheiro de dados, eu quero validar que todos os tickers configurados foram ingeridos, para que não haja dados faltantes nas recomendações.

#### Acceptance Criteria

1. WHEN Daily_Ingestion é concluída, THE Data_Governance_System SHALL validar que dados foram coletados para todos os 50 tickers configurados
2. THE Data_Governance_System SHALL calcular taxa de completude (% de tickers com dados)
3. WHEN taxa de completude é menor que 95%, THE Data_Governance_System SHALL gerar alerta de completude
4. THE Data_Governance_System SHALL identificar quais tickers específicos faltam dados
5. THE Data_Governance_System SHALL registrar histórico de completude no S3 (formato: monitoring/completeness/dt=YYYY-MM-DD/)

### Requirement 18: Ensemble Model Weights Tracking

**User Story:** Como cientista de dados, eu quero rastrear os pesos de cada modelo no ensemble ao longo do tempo, para que possa entender qual modelo está contribuindo mais.

#### Acceptance Criteria

1. WHEN Daily_Recommendations são geradas, THE Model_Ensemble SHALL registrar pesos de cada modelo (XGBoost, LSTM, Prophet, DeepAR)
2. THE Model_Ensemble SHALL armazenar histórico de pesos no S3 (formato: monitoring/ensemble_weights/dt=YYYY-MM-DD/)
3. THE Dashboard SHALL exibir gráfico de evolução dos pesos dos modelos nos últimos 30 dias na aba de Monitoramento de Dados
4. THE Dashboard SHALL exibir contribuição de cada modelo para as recomendações atuais

### Requirement 19: Error Handling and Retry Logic

**User Story:** Como engenheiro de confiabilidade, eu quero que o sistema trate erros gracefully e faça retry quando apropriado, para que falhas temporárias não causem perda de dados.

#### Acceptance Criteria

1. WHEN Daily_Ingestion encontra erro de rede, THE Data_Pipeline SHALL fazer retry com backoff exponencial (1s, 2s, 4s)
2. WHEN Daily_Ingestion encontra erro 429 (rate limit), THE Data_Pipeline SHALL aguardar tempo especificado no header Retry-After antes de retry
3. WHEN Daily_Ingestion encontra erro 5xx, THE Data_Pipeline SHALL fazer retry até 3 vezes
4. WHEN Daily_Ingestion encontra erro 4xx (exceto 429), THE Data_Pipeline SHALL registrar erro e pular para próximo ticker
5. WHEN todos os retries falham, THE Data_Pipeline SHALL registrar falha completa e enviar alerta
6. THE Data_Pipeline SHALL registrar todos os erros e retries no S3 (formato: monitoring/errors/dt=YYYY-MM-DD/)

### Requirement 20: Dashboard Performance Optimization

**User Story:** Como usuário do sistema, eu quero que o dashboard carregue rapidamente, para que possa acessar informações sem demora.

#### Acceptance Criteria

1. THE Dashboard SHALL carregar dados iniciais em menos de 2 segundos
2. THE Dashboard SHALL usar cache local para dados que não mudam frequentemente (dados históricos)
3. THE Dashboard SHALL carregar dados de forma lazy (apenas aba ativa)
4. WHEN usuário troca de aba, THE Dashboard SHALL carregar dados da nova aba em menos de 1 segundo
5. THE Dashboard SHALL usar paginação para tabelas com mais de 100 linhas
6. THE Dashboard SHALL comprimir dados transferidos da API usando gzip

