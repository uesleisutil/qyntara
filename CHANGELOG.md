# Changelog

Todas as mudanças notáveis do projeto Qyntara são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [3.0.0] — 2026-03-24

Rebranding para Qyntara e reorganização completa do repositório.

### Changed
- Renomeado projeto de "B3 Tactical Ranking" para **Qyntara**
- README reescrito em português com foco no produto
- Consolidados 5 workflows de segurança em 2 (security.yml + secrets-scan.yml)
- Atualizada documentação de arquitetura com lambdas reais deployadas
- Renomeado workflow de deploy para `deploy.yml`

### Added
- `CONTRIBUTING.md` com guidelines de contribuição
- `SECURITY.md` com política de segurança e disclosure
- Badges de status no README

### Removed
- 27 Lambda functions não deployadas (dead code)
- ~50 arquivos de teste espalhados pelo projeto
- Arquivos de exemplo e configurações de teste obsoletas
- 5 workflows de segurança redundantes (consolidados em 1)
- Referências a docs inexistentes

---

## [2.0.1] — 2026-03-15

Release de lançamento com onboarding e feedback.

### Added
- Widget de feedback in-app (rating + comentários)
- Serviço de tracking de adoção (DAU, sessão, retenção)
- Endpoint de feedback (`/api/feedback`)
- Template de email de lançamento
- User guide e runbook de monitoramento de lançamento

---

## [2.0.0] — 2026-03-12

Major release: expansão de 4 para 8 tabs com monitoramento MLOps completo.

### Added
- Tabs: Data Quality, Drift Detection, Explainability, Backtesting
- Visualizações avançadas (candlestick, sparklines, heatmaps, waterfall, Sankey)
- Cross-filtering, zoom, anotações, notificações, WebSocket real-time
- Acessibilidade WCAG 2.1 AA
- Sistema de ajuda (tour guiado, FAQ, glossário)
- API REST com 15+ endpoints e autenticação por API key
- Autenticação com RBAC (admin/analyst/viewer)
- Infra: ElastiCache Redis, CloudFront CDN, WAF, DR cross-region

### Changed
- Frontend migrado para TypeScript + React 18
- Recharts + D3.js, TanStack Table v8

---

## [1.0.0] — 2025-01-15

Release inicial.

### Added
- Ensemble ML (XGBoost, LightGBM, DeepAR) com 50+ features técnicas
- Dashboard com 4 tabs, ranking diário automatizado
- Infraestrutura AWS CDK, deploy via GitHub Pages
