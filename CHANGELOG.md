# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.0.0] - 2026-03-07

### 🎉 Lançamento Principal

Versão 2.0 com pipeline MLOps completo, dashboard moderno e otimizações de custo.

### ✨ Adicionado

#### Pipeline de ML
- **Feature Engineering**: Criação automática de features técnicas
- **Hyperparameter Optimization**: Otimização automática mensal de hiperparâmetros
- **Model Training**: Treinamento semanal de modelos DeepAR
- **Ensemble Prediction**: Predições usando ensemble de múltiplos modelos
- **Drift Detection**: Monitoramento de mudanças na distribuição dos dados
- **Walk-Forward Validation**: Validação robusta de modelos

#### Dashboard
- Dashboard React moderno hospedado no GitHub Pages (gratuito)
- Visualização de recomendações diárias (top 10 ações)
- Gráficos de qualidade do modelo (MAPE, cobertura, intervalos)
- Monitoramento de ingestão em tempo real
- Análise de feature importance
- Detecção de drift visual
- Pesos do ensemble
- Design responsivo (mobile-friendly)
- Auto-refresh a cada 5 minutos

#### Infraestrutura
- Lambda para feature engineering com trigger S3
- Lambda para otimização de hiperparâmetros
- Lambda para treinamento de modelos
- Lambda para ensemble prediction
- Lambda para monitoramento e drift detection
- CloudWatch Dashboard para pipeline de ML
- Alarmes para falhas em cada etapa do pipeline
- S3 event notifications para automação

#### Monitoramento
- Métricas customizadas no CloudWatch
- Alertas via SNS para falhas
- Dashboard de monitoramento do pipeline
- Logs estruturados para debugging

### 🔄 Modificado

- **Infraestrutura**: Refatorada para suportar pipeline MLOps completo
- **Lambda Functions**: Timeout aumentado para 10-15 minutos (treinamento)
- **S3 Structure**: Reorganizada para incluir features, hyperparameters, etc
- **EventBridge Rules**: Adicionados schedules para pipeline de ML
- **Documentation**: Completamente reescrita e expandida

### 🗑️ Removido

- **QuickSight**: Substituído por dashboard React no GitHub Pages
  - Economia: ~$18-24/mês (~$216-288/ano)
- **32+ arquivos de documentação redundante**
- **Arquivos .gitkeep desnecessários**
- **READMEs internos redundantes**
- **Scripts duplicados**

### 🐛 Corrigido

- Timeout em Lambdas de treinamento
- Permissões IAM para SageMaker
- CORS no S3 para dashboard
- Validação de dados de entrada

### 📚 Documentação

- README.md completamente reescrito
- Guia de contribuição (CONTRIBUTING.md)
- Código de conduta (CODE_OF_CONDUCT.md)
- Documentação de arquitetura expandida
- Guia de troubleshooting atualizado
- Documentação da remoção do QuickSight

### 🔐 Segurança

- Credenciais AWS com permissões mínimas para dashboard
- CORS configurado apenas para GitHub Pages
- Secrets Manager para tokens sensíveis
- S3 encryption habilitado

## [1.0.0] - 2025-12-15

### 🎉 Lançamento Inicial

Primeira versão estável do B3 Tactical Ranking.

### ✨ Adicionado

- Ingestão automática de cotações da B3 via BRAPI Pro
- Bootstrap de 10 anos de dados históricos
- Treinamento de modelos DeepAR no SageMaker
- Geração de rankings diários
- Monitoramento de qualidade de dados
- Alertas via SNS
- Infraestrutura completa com AWS CDK
- Dashboard QuickSight (posteriormente removido)

### 📊 Métricas

- MAPE médio: ~4.5%
- Cobertura de intervalos: 85%
- Disponibilidade: 99.9%
- Custo mensal: ~$45-67 (com QuickSight)

## [0.1.0] - 2025-10-01

### 🚀 Versão Beta

Versão inicial de testes e validação.

### ✨ Adicionado

- Proof of concept do pipeline de ML
- Ingestão manual de dados
- Treinamento básico de modelos
- Scripts de teste

---

## Tipos de Mudanças

- `✨ Adicionado` para novas funcionalidades
- `🔄 Modificado` para mudanças em funcionalidades existentes
- `🗑️ Removido` para funcionalidades removidas
- `🐛 Corrigido` para correções de bugs
- `🔐 Segurança` para vulnerabilidades corrigidas
- `📚 Documentação` para mudanças na documentação
- `⚡ Performance` para melhorias de performance

## Links

- [2.0.0]: https://github.com/uesleisutil/b3-tactical-ranking/releases/tag/v2.0.0
- [1.0.0]: https://github.com/uesleisutil/b3-tactical-ranking/releases/tag/v1.0.0
- [0.1.0]: https://github.com/uesleisutil/b3-tactical-ranking/releases/tag/v0.1.0
