# Política de Segurança

## Versões Suportadas

| Versão | Suporte |
|--------|---------|
| 3.x    | ✅ Ativo |
| 2.x    | ⚠️ Apenas correções críticas |
| < 2.0  | ❌ Sem suporte |

## Reportando Vulnerabilidades

**Não abra issues públicas para vulnerabilidades de segurança.**

Envie um email para o maintainer com:
- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (se tiver)

Responderemos em até 48 horas com um plano de ação.

## Práticas de Segurança

Este projeto implementa:

- **Secrets Management**: AWS Secrets Manager para tokens e credenciais
- **WAF**: AWS WAF com regras OWASP (SQLi, XSS, rate limiting)
- **Encryption**: S3 encryption at rest, TLS em trânsito
- **Auth**: JWT com rotação, rate limiting por IP
- **Scanning**: Gitleaks, Trivy, Bandit, CodeQL, Dependabot
- **IAM**: Least privilege para todas as Lambda functions
- **Input Validation**: Sanitização em todas as APIs
