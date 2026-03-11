# Implementation Plan: ML Monitoring, Governance & Dashboard

## Overview

Este plano de implementação organiza a construção do sistema de monitoramento, governança e dashboard para o sistema de recomendações ML da B3. A implementação está dividida em 6 fases principais que constroem incrementalmente a funcionalidade, validando cada componente antes de avançar.

**Tecnologias**:
- Backend: Python 3.11 (AWS Lambda)
- Frontend: React 18.2 + TypeScript
- Infraestrutura: AWS (S3, Secrets Manager, SageMaker, EventBridge, CloudWatch)
- APIs: BRAPI (brapi.dev)

**Estratégia de Implementação**:
1. Começar com segurança e infraestrutura base
2. Construir pipeline de dados com governança
3. Implementar monitoramento de modelo e custos
4. Criar API e dashboard
5. Integrar tudo e validar end-to-end

## Tasks

- [x] 1. Setup de Infraestrutura e Segurança
  - Configurar AWS Secrets Manager para credenciais BRAPI
  - Criar estrutura de buckets S3 com particionamento por data
  - Configurar IAM roles e policies para Lambdas
  - Criar EventBridge schedules para execuções diárias
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.5_


- [ ]* 1.1 Write property test for credentials security
    - **Property 1: Credentials Never Exposed in Logs**
    - **Validates: Requirements 1.2**

- [x] 2. Implementar Data Pipeline - Ingestão de Dados
  - [x] 2.1 Criar Ingest Lambda com integração ao Secrets Manager
    - Implementar função para carregar token BRAPI do Secrets Manager
    - Implementar leitura de lista de 50 tickers do S3 (config/universe.txt)
    - Implementar lógica de batching (20 tickers por request)
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [x] 2.2 Implementar retry logic com backoff exponencial
    - Implementar tratamento de erro 429 com Retry-After header
    - Implementar retry para erros 5xx (máximo 3 tentativas)
    - Implementar skip para erros 4xx (exceto 429)
    - Adicionar jitter ao backoff exponencial
    - _Requirements: 2.4, 19.1, 19.2, 19.3, 19.4_

  - [ ]* 2.3 Write property tests for ingestion logic
    - **Property 2: Ingestion Respects Rate Limits**
    - **Validates: Requirements 2.3**
    - **Property 3: Retry with Exponential Backoff**
    - **Validates: Requirements 2.4, 19.1, 19.3**
    - **Property 41: Retry-After Header Respect**
    - **Validates: Requirements 19.2**
    - **Property 42: 4xx Error No Retry**
    - **Validates: Requirements 19.4**

  - [x] 2.4 Implementar salvamento de dados no S3
    - Salvar cotações brutas em quotes_5m/dt={date}/{ticker}_{time}.json
    - Salvar metadados de execução em monitoring/ingestion/
    - Implementar medição de latência (p50, p95, p99)
    - _Requirements: 2.5, 2.6, 16.1, 16.2_

  - [ ]* 2.5 Write property tests for S3 storage
    - **Property 4: S3 Path Format Consistency**
    - **Validates: Requirements 2.5, 2.6**
    - **Property 37: API Latency Percentile Calculation**
    - **Validates: Requirements 16.2**

  - [x] 2.6 Configurar EventBridge schedule para execução durante pregão
    - Configurar trigger a cada 5 minutos (10:00-18:00 BRT)
    - _Requirements: 2.1_

- [x] 3. Checkpoint - Validar ingestão de dados
  - Executar Ingest Lambda manualmente e verificar dados no S3
  - Validar que credenciais não aparecem em logs do CloudWatch
  - Verificar retry logic com simulação de erros
  - Ensure all tests pass, ask the user if questions arise.


- [x] 4. Implementar Data Governance - Validação e Qualidade
  - [x] 4.1 Criar Data Quality Lambda
    - Implementar cálculo de completude (% de tickers com dados)
    - Implementar identificação de tickers faltantes
    - Implementar validação de invariantes de cotações (high >= low, preços positivos, volume >= 0)
    - Implementar detecção de anomalias (variações > 50% vs dia anterior)
    - _Requirements: 3.3, 3.4, 4.1, 4.2, 4.4, 4.5_

  - [ ]* 4.2 Write property tests for data validation
    - **Property 5: Quote Data Validation Invariants**
    - **Validates: Requirements 3.3, 3.4**
    - **Property 8: Data Quality Metrics Completeness**
    - **Validates: Requirements 4.1, 4.2**
    - **Property 10: Anomaly Detection Sensitivity**
    - **Validates: Requirements 4.4, 4.5**

  - [x] 4.3 Implementar cálculo de métricas de qualidade
    - Calcular latência média de ingestão
    - Calcular taxa de erro (requests falhados / total)
    - Calcular quality score (0-100)
    - Gerar alertas quando completude < 90% (crítico) ou < 95% (warning)
    - _Requirements: 4.2, 4.3, 17.2, 17.3_

  - [ ]* 4.4 Write property tests for quality metrics
    - **Property 9: Completeness Alert Threshold**
    - **Validates: Requirements 4.3, 17.3**
    - **Property 39: Completeness Rate Calculation**
    - **Validates: Requirements 17.2**
    - **Property 40: Missing Tickers Identification**
    - **Validates: Requirements 17.4**

  - [x] 4.5 Implementar salvamento de métricas de qualidade
    - Salvar em monitoring/data_quality/dt={date}/
    - Salvar em monitoring/completeness/dt={date}/
    - _Requirements: 4.6, 17.5_

  - [x] 4.6 Criar Historical Data Validator Lambda
    - Implementar validação de 2 anos de dados históricos
    - Detectar gaps > 5 dias úteis consecutivos
    - Validar consistência de preços e volume
    - Calcular score de qualidade por ticker
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [ ]* 4.7 Write property tests for historical validation
    - **Property 6: Gap Detection Accuracy**
    - **Validates: Requirements 3.2**
    - **Property 7: Quality Score Range**
    - **Validates: Requirements 3.6**

  - [x] 4.8 Implementar geração de relatório de validação histórica
    - Gerar relatório com gaps, inconsistências e recomendações
    - Salvar em monitoring/validation/historical_data_report_{date}.json
    - _Requirements: 3.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 4.9 Write property test for validation report
    - **Property 34: Historical Validation Report Completeness**
    - **Validates: Requirements 14.2, 14.3, 14.4**
    - **Property 35: Problem Recommendations in Report**
    - **Validates: Requirements 14.5**

  - [x] 4.10 Configurar EventBridge schedule para Data Quality Lambda
    - Configurar trigger diário às 19:00 BRT
    - _Requirements: 4.1_


- [x] 5. Implementar Data Lineage Tracking
  - [x] 5.1 Adicionar tracking de lineage no Ingest Lambda
    - Registrar fonte, timestamps de coleta e armazenamento
    - Registrar versão do pipeline
    - Salvar em monitoring/lineage/dt={date}/
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.2 Write property tests for lineage tracking
    - **Property 11: Data Lineage Completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - **Property 12: Lineage Serialization Round-Trip**
    - **Validates: Requirements 5.5**

  - [x] 5.3 Adicionar tracking de transformações no Data Quality Lambda
    - Registrar transformações aplicadas aos dados
    - Atualizar registros de lineage existentes
    - _Requirements: 5.3_

- [x] 6. Checkpoint - Validar governança de dados
  - Executar Data Quality Lambda e verificar métricas geradas
  - Executar Historical Validator Lambda e revisar relatório
  - Validar que lineage está sendo registrada corretamente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implementar Model Ensemble - Geração de Recomendações
  - [x] 7.1 Criar Rank Lambda
    - Implementar carregamento de dados de cotações do dia
    - Implementar preparação de features (últimos 60 dias)
    - Implementar invocação do SageMaker endpoint
    - Implementar agregação de predições dos 4 modelos
    - _Requirements: 6.1, 6.2_

  - [x] 7.2 Implementar cálculo de recomendações
    - Calcular retorno esperado: (pred_price - current_price) / current_price
    - Calcular score de confiança baseado em concordância dos modelos
    - Ranquear ações por score de confiança
    - Selecionar top 50 ações
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 7.3 Write property tests for recommendations
    - **Property 13: Recommendations Required Fields**
    - **Validates: Requirements 6.4, 18.1**
    - **Property 14: Top 50 Selection and Ranking**
    - **Validates: Requirements 6.5**
    - **Property 15: Prediction Horizon Consistency**
    - **Validates: Requirements 6.3**

  - [x] 7.4 Implementar salvamento de recomendações e pesos do ensemble
    - Salvar recomendações em recommendations/dt={date}/
    - Salvar pesos do ensemble em monitoring/ensemble_weights/dt={date}/
    - _Requirements: 6.6, 18.1, 18.2_

  - [x] 7.5 Configurar EventBridge schedule para Rank Lambda
    - Configurar trigger diário às 18:30 BRT
    - _Requirements: 6.1_


- [x] 8. Implementar Performance Monitoring
  - [x] 8.1 Criar Performance Monitor Lambda
    - Implementar carregamento de predições de 20 dias atrás
    - Implementar carregamento de preços reais de hoje
    - Implementar cálculo de MAPE: mean(|pred - actual| / actual) * 100
    - _Requirements: 7.1, 7.6_

  - [ ]* 8.2 Write property test for MAPE calculation
    - **Property 16: MAPE Calculation Correctness**
    - **Validates: Requirements 7.1**

  - [x] 8.3 Implementar cálculo de métricas adicionais
    - Calcular acurácia direcional (% de direções corretas)
    - Calcular MAE: mean(|pred - actual|)
    - Calcular Sharpe Ratio: mean(returns) / std(returns)
    - Calcular taxa de acerto (% de retornos positivos)
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ]* 8.4 Write property tests for performance metrics
    - **Property 17: Directional Accuracy Range**
    - **Validates: Requirements 7.2**
    - **Property 18: MAE Non-Negativity**
    - **Validates: Requirements 7.3**
    - **Property 19: Sharpe Ratio Calculation**
    - **Validates: Requirements 7.4**
    - **Property 20: Hit Rate Range**
    - **Validates: Requirements 7.5**

  - [x] 8.5 Implementar salvamento de métricas de performance
    - Salvar em monitoring/performance/dt={date}/
    - _Requirements: 7.7_

  - [x] 8.6 Configurar EventBridge schedule para Performance Monitor Lambda
    - Configurar trigger diário às 20:00 BRT
    - _Requirements: 7.6_

- [x] 9. Implementar Drift Detection
  - [x] 9.1 Criar Drift Monitor Lambda
    - Implementar detecção de performance drift (comparar MAPE de 5 dias recentes vs 5 dias anteriores)
    - Implementar cálculo de drift score (0-1)
    - Implementar detecção de feature drift usando KL divergence simplificado
    - _Requirements: 8.1, 8.3, 8.5_

  - [ ]* 9.2 Write property tests for drift detection
    - **Property 21: Performance Drift Detection**
    - **Validates: Requirements 8.1, 8.2**
    - **Property 22: Drift Score Range**
    - **Validates: Requirements 8.3**
    - **Property 23: Feature Drift Critical Threshold**
    - **Validates: Requirements 8.6**
    - **Property 31: Drift Alert Severity Mapping**
    - **Validates: Requirements 11.8**

  - [x] 9.3 Implementar lógica de recomendação de retreinamento
    - Recomendar retreinamento se MAPE > 20% OU drift_score > 0.5 OU > 30% features com drift
    - Gerar notificação com justificativa detalhada
    - _Requirements: 8.2, 8.4, 15.1, 15.2, 15.3, 15.4_

  - [ ]* 9.4 Write property tests for retraining logic
    - **Property 24: Retraining Trigger Conditions**
    - **Validates: Requirements 15.2**
    - **Property 36: Retraining Notification Completeness**
    - **Validates: Requirements 15.3, 15.4**

  - [x] 9.5 Implementar salvamento de relatórios de drift
    - Salvar em monitoring/drift/dt={date}/
    - Salvar recomendações de retreinamento em monitoring/retrain_recommendations/
    - _Requirements: 8.1, 15.5_

  - [x] 9.6 Configurar EventBridge schedule para Drift Monitor Lambda
    - Configurar trigger diário às 20:30 BRT
    - _Requirements: 8.1_


- [x] 10. Checkpoint - Validar monitoramento de modelo
  - Executar Performance Monitor Lambda e verificar métricas calculadas
  - Executar Drift Monitor Lambda e verificar detecção de drift
  - Validar que recomendações de retreinamento são geradas corretamente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implementar Cost Monitoring
  - [x] 11.1 Criar Cost Monitor Lambda
    - Implementar coleta de custos via AWS Cost Explorer API
    - Implementar coleta de métricas via CloudWatch Metrics API
    - Implementar cálculo de custos por serviço (Lambda, S3, SageMaker, CloudWatch)
    - _Requirements: 9.1_

  - [x] 11.2 Implementar cálculo de custos detalhados
    - Calcular custos de SageMaker (training jobs + endpoints)
    - Calcular custos de Lambda (invocações + compute)
    - Calcular custos de S3 (storage + requests)
    - Calcular custos de CloudWatch (logs + métricas)
    - _Requirements: 9.1, 9.4_

  - [x] 11.3 Implementar projeção mensal e alertas
    - Calcular projeção mensal: (sum(last_7_days) / 7) * 30
    - Gerar alerta crítico se projeção > R$500
    - Gerar warning se projeção > R$400 (80% do limite)
    - _Requirements: 9.2, 9.3_

  - [ ]* 11.4 Write property tests for cost monitoring
    - **Property 25: Monthly Cost Projection**
    - **Validates: Requirements 9.2**
    - **Property 26: Cost Threshold Alerts**
    - **Validates: Requirements 9.3, 12.8, 12.9**
    - **Property 27: Cost Breakdown Completeness**
    - **Validates: Requirements 9.1, 9.4, 12.6**

  - [x] 11.5 Implementar cálculo de métricas adicionais
    - Calcular custo por recomendação: total_cost / num_recommendations
    - Detectar anomalias de custo (aumento > 50% vs média de 7 dias)
    - _Requirements: 9.5, 9.7_

  - [ ]* 11.6 Write property tests for cost metrics
    - **Property 28: Cost Per Recommendation**
    - **Validates: Requirements 9.5, 12.7**
    - **Property 29: Cost Anomaly Detection**
    - **Validates: Requirements 9.7**

  - [x] 11.7 Implementar salvamento de relatórios de custo
    - Salvar em monitoring/costs/dt={date}/
    - _Requirements: 9.6_

  - [x] 11.8 Configurar EventBridge schedule para Cost Monitor Lambda
    - Configurar trigger diário às 21:00 BRT
    - _Requirements: 9.1_

- [x] 12. Checkpoint - Validar monitoramento de custos
  - Executar Cost Monitor Lambda e verificar custos coletados
  - Validar cálculo de projeção mensal
  - Verificar geração de alertas quando thresholds são ultrapassados
  - Ensure all tests pass, ask the user if questions arise.


- [x] 13. Implementar Dashboard API
  - [x] 13.1 Criar Dashboard API Lambda
    - Implementar endpoint GET /api/recommendations/latest
    - Implementar endpoint GET /api/monitoring/data-quality
    - Implementar endpoint GET /api/monitoring/model-performance
    - Implementar endpoint GET /api/monitoring/drift
    - Implementar endpoint GET /api/monitoring/costs
    - Implementar endpoint GET /api/monitoring/ensemble-weights
    - _Requirements: 10.2, 11.2, 11.5, 12.2_

  - [x] 13.2 Implementar agregação de dados do S3
    - Carregar dados de múltiplos prefixos S3
    - Transformar dados em DTOs (RecommendationsDTO, DataQualityDTO, etc.)
    - Implementar filtros por período (query params: ?days=30)
    - _Requirements: 10.2, 11.2, 12.2_

  - [ ]* 13.3 Write property tests for API DTOs
    - **Property 30: Dashboard DTO Required Fields**
    - **Validates: Requirements 10.3, 10.5, 11.3, 11.5, 11.6, 12.3, 12.6, 12.7**

  - [x] 13.4 Implementar caching e otimizações
    - Implementar cache de 5 minutos (TTL)
    - Implementar compressão gzip de responses
    - Implementar ETag para validação de cache
    - _Requirements: 20.2, 20.6_

  - [ ]* 13.5 Write property test for API compression
    - **Property 45: API Response Compression**
    - **Validates: Requirements 20.6**

  - [x] 13.6 Configurar API Gateway para Dashboard API Lambda
    - Criar endpoints REST
    - Configurar CORS
    - _Requirements: 10.2, 11.2, 12.2_

- [x] 14. Implementar React Dashboard - Estrutura Base
  - [x] 14.1 Criar estrutura de projeto React
    - Configurar React 18.2 + TypeScript
    - Configurar Zustand para state management
    - Configurar TanStack Query para data fetching
    - Instalar dependências (Recharts, Plotly.js, Lucide React, Framer Motion)
    - _Requirements: 10.1, 11.1, 12.1_

  - [x] 14.2 Criar componentes comuns
    - Implementar Layout.tsx (estrutura de 3 abas)
    - Implementar Tabs.tsx (navegação entre abas)
    - Implementar LoadingSpinner.tsx
    - Implementar ErrorBoundary.tsx
    - _Requirements: 10.1, 11.1, 12.1_

  - [x] 14.3 Criar store Zustand para estado global
    - Implementar controle de aba ativa
    - Implementar controle de auto-refresh
    - Implementar controle de timestamp de última atualização
    - _Requirements: 13.1, 13.3_

  - [ ]* 14.4 Write property test for timestamp presence
    - **Property 32: Timestamp Presence in Dashboard**
    - **Validates: Requirements 13.3**

  - [x] 14.5 Criar serviço de API client
    - Implementar funções para chamar todos os endpoints da Dashboard API
    - Implementar error handling e retry logic
    - _Requirements: 10.2, 11.2, 12.2_


- [x] 15. Implementar Dashboard - Aba de Recomendações
  - [x] 15.1 Criar hook useRecommendations
    - Implementar fetching com TanStack Query
    - Configurar auto-refresh de 5 minutos
    - Implementar cache de 4 minutos
    - _Requirements: 10.2, 13.1_

  - [x] 15.2 Criar RecommendationsTable.tsx
    - Exibir colunas: ticker, preço atual, preço predito, retorno esperado, score, ranking
    - Implementar ordenação por qualquer coluna
    - Implementar paginação se > 100 linhas
    - _Requirements: 10.3, 10.4, 20.5_

  - [ ]* 15.3 Write property test for table pagination
    - **Property 44: Table Pagination Threshold**
    - **Validates: Requirements 20.5**

  - [x] 15.4 Criar RecommendationsKPIs.tsx
    - Exibir total de ações recomendadas
    - Exibir retorno médio esperado
    - Exibir score médio de confiança
    - _Requirements: 10.5_

  - [x] 15.5 Criar ReturnDistributionChart.tsx
    - Implementar histograma de distribuição de retornos esperados
    - Usar Recharts para visualização
    - _Requirements: 10.6_

  - [x] 15.6 Criar TickerDetailModal.tsx
    - Exibir detalhes da predição ao clicar em ticker
    - Mostrar contribuição de cada modelo do ensemble (XGBoost, LSTM, Prophet, DeepAR)
    - _Requirements: 10.7_

- [x] 16. Implementar Dashboard - Aba de Monitoramento de Dados
  - [x] 16.1 Criar hooks de data fetching
    - Implementar useDataQuality
    - Implementar useModelPerformance
    - Implementar useDrift
    - Configurar auto-refresh de 5 minutos
    - _Requirements: 11.2, 13.1_

  - [x] 16.2 Criar DataQualityPanel.tsx
    - Exibir status da última ingestão (timestamp, status, records)
    - Exibir score de qualidade dos dados históricos por ticker
    - Exibir gráfico de linha de Data Quality Metrics (últimos 30 dias)
    - _Requirements: 11.2, 11.3, 11.4_

  - [x] 16.3 Criar ModelPerformancePanel.tsx
    - Exibir status da última execução do modelo
    - Exibir 5 métricas: MAPE, Acurácia Direcional, MAE, Sharpe Ratio, Taxa de Acerto
    - Exibir gráfico de evolução do MAPE (últimos 30 dias) com linha de baseline
    - _Requirements: 11.5, 11.6, 11.7_

  - [x] 16.4 Criar DriftMonitoringPanel.tsx
    - Exibir alerta visual se drift detectado (warning/critical)
    - Exibir lista de features com drift e drift scores
    - Exibir timeline de eventos de drift (últimos 30 dias)
    - Exibir gráfico de evolução dos pesos do ensemble
    - _Requirements: 11.8, 11.9, 11.10, 18.3, 18.4_


- [x] 17. Implementar Dashboard - Aba de Custos
  - [x] 17.1 Criar hook useCosts
    - Implementar fetching com TanStack Query
    - Configurar auto-refresh de 5 minutos
    - Implementar filtros por período (7 dias, 30 dias, mês atual)
    - _Requirements: 12.2, 12.10, 13.1_

  - [x] 17.2 Criar CostsSummary.tsx
    - Exibir custo total do mês atual
    - Exibir projeção mensal
    - Exibir % do limite (R$500)
    - Exibir alerta visual se projeção > 80% ou > 100%
    - _Requirements: 12.2, 12.3, 12.8, 12.9_

  - [x] 17.3 Criar CostsByServiceChart.tsx
    - Implementar gráfico de pizza com distribuição por serviço AWS
    - Usar Recharts para visualização
    - _Requirements: 12.4_

  - [x] 17.4 Criar CostsEvolutionChart.tsx
    - Implementar gráfico de linha com evolução diária (últimos 30 dias)
    - Usar Recharts para visualização
    - _Requirements: 12.5_

  - [x] 17.5 Criar CostsTable.tsx
    - Exibir tabela detalhada com custos por componente (training, inference, storage, compute)
    - Exibir custo por recomendação
    - _Requirements: 12.6, 12.7_

- [x] 18. Implementar Dashboard - Features Globais
  - [x] 18.1 Implementar auto-refresh global
    - Configurar timer de 5 minutos
    - Exibir indicador visual de atualização
    - Implementar botão de refresh manual
    - _Requirements: 13.1, 13.2, 13.5_

  - [x] 18.2 Implementar error handling global
    - Exibir mensagem de erro quando atualização falha
    - Manter dados anteriores visíveis em caso de erro
    - Permitir retry manual
    - _Requirements: 13.4_

  - [ ]* 18.3 Write property test for failed update handling
    - **Property 33: Failed Update Data Preservation**
    - **Validates: Requirements 13.4**

  - [x] 18.4 Implementar otimizações de performance
    - Implementar lazy loading (carregar apenas aba ativa)
    - Implementar cache local para dados históricos
    - Garantir carregamento inicial < 2 segundos
    - Garantir troca de aba < 1 segundo
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 19. Checkpoint - Validar dashboard completo
  - Testar navegação entre as 3 abas
  - Validar que dados são carregados corretamente em cada aba
  - Testar auto-refresh e refresh manual
  - Validar error handling e preservação de dados
  - Verificar performance de carregamento
  - Ensure all tests pass, ask the user if questions arise.


- [x] 20. Integração e Validação End-to-End
  - [x] 20.1 Integrar todos os componentes
    - Verificar que todos os EventBridge schedules estão configurados
    - Verificar que todas as Lambdas têm IAM roles corretas
    - Verificar que API Gateway está roteando corretamente
    - _Requirements: 2.1, 4.1, 6.1, 7.6, 8.1, 9.1_

  - [x] 20.2 Executar fluxo completo de ingestão
    - Executar Ingest Lambda durante horário de pregão
    - Verificar que Data Quality Lambda é triggerada automaticamente
    - Verificar que dados e métricas são salvos no S3
    - _Requirements: 2.1, 4.1_

  - [x] 20.3 Executar fluxo completo de recomendações
    - Executar Rank Lambda ao final do pregão
    - Verificar que Performance Monitor Lambda é triggerada
    - Verificar que Drift Monitor Lambda é triggerada
    - Verificar que recomendações são salvas no S3
    - _Requirements: 6.1, 7.6, 8.1_

  - [x] 20.4 Executar fluxo completo de monitoramento
    - Executar Cost Monitor Lambda
    - Verificar que todos os custos são coletados
    - Verificar que alertas são gerados quando apropriado
    - _Requirements: 9.1_

  - [x] 20.5 Validar dashboard com dados reais
    - Acessar dashboard e verificar que todas as 3 abas carregam
    - Verificar que dados são exibidos corretamente
    - Testar auto-refresh e verificar que dados são atualizados
    - _Requirements: 10.1, 11.1, 12.1, 13.1_

  - [ ]* 20.6 Write integration tests
    - Testar fluxo completo de ingestão → qualidade → recomendações → performance
    - Testar que alertas são gerados corretamente
    - Testar que dashboard API retorna dados corretos

- [x] 21. Documentação e Finalização
  - [x] 21.1 Criar documentação de deployment
    - Documentar processo de deploy de Lambdas
    - Documentar configuração de Secrets Manager
    - Documentar configuração de EventBridge schedules
    - Documentar configuração de API Gateway

  - [x] 21.2 Criar documentação de operação
    - Documentar como executar validação histórica manualmente
    - Documentar como interpretar alertas
    - Documentar como responder a recomendações de retreinamento
    - Documentar como monitorar custos

  - [x] 21.3 Criar runbook de troubleshooting
    - Documentar problemas comuns e soluções
    - Documentar como debugar falhas de ingestão
    - Documentar como debugar falhas de geração de recomendações
    - Documentar como acessar logs no CloudWatch

- [x] 22. Final Checkpoint - Sistema completo
  - Executar todos os componentes em sequência
  - Validar que não há erros nos logs do CloudWatch
  - Validar que dashboard exibe dados corretos e atualizados
  - Validar que alertas são gerados quando apropriado
  - Validar que custos estão dentro do limite
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais (testes) e podem ser puladas para MVP mais rápido
- Cada task referencia requirements específicos para rastreabilidade
- Checkpoints garantem validação incremental antes de avançar
- Property tests validam propriedades universais de correção
- Unit tests (não listados) devem ser escritos para casos específicos e edge cases
- Implementação usa Python 3.11 para backend e TypeScript/React para frontend
- Todos os dados são armazenados no S3 com particionamento por data
- EventBridge schedules orquestram execuções diárias
- Dashboard atualiza automaticamente a cada 5 minutos

