# 🔒 Documentação de Segurança

## Workflows de Segurança Implementados

### 1. CodeQL Analysis (`security-codeql.yml`)
**Frequência**: Push, PR, Segunda-feira 6h UTC

Análise estática de código para detectar vulnerabilidades:
- Python: Análise de segurança e qualidade
- JavaScript/TypeScript: Análise de segurança e qualidade
- Queries: `security-extended`, `security-and-quality`

### 2. Dependency Scanning (`security-dependency-scan.yml`)
**Frequência**: Push, PR, Diariamente 8h UTC

Verificação de vulnerabilidades em dependências:
- **Python**: Safety + pip-audit
- **JavaScript**: npm audit (dashboard + infra)
- **Dependency Review**: Análise em PRs com bloqueio para severidade moderada+

### 3. Secrets Scanning (`security-secrets-scan.yml`)
**Frequência**: Push, PR

Detecção de credenciais vazadas:
- **Gitleaks**: Scanner de secrets
- **TruffleHog**: Busca no histórico Git
- **AWS Credentials Check**: Padrões específicos AWS
- **Env File Check**: Verifica .env commitados

### 4. SAST - Static Analysis (`security-sast.yml`)
**Frequência**: Push, PR, Terça-feira 10h UTC

Análise estática de segurança:
- **Bandit**: Python security linter
- **Semgrep**: Multi-language SAST (Python, JS, React, AWS Lambda)
- **ESLint Security**: JavaScript/React security
- **cfn-lint**: CloudFormation/CDK security

### 5. Container & Lambda Scanning (`security-container-scan.yml`)
**Frequência**: Push (ml/**), PR, Quarta-feira 12h UTC

Análise de containers e Lambda:
- **Trivy**: Filesystem vulnerability scanner
- **pip-audit**: Python requirements scanning
- **Lambda Security Check**: Best practices Lambda
- **IAM Policy Check**: Análise de políticas IAM

### 6. Compliance & Best Practices (`security-compliance.yml`)
**Frequência**: Push, PR, Quinta-feira 14h UTC

Conformidade e boas práticas:
- **License Compliance**: Verificação de licenças
- **OpenSSF Scorecard**: Avaliação de segurança do projeto
- **AWS Security Best Practices**: S3, Lambda, CloudWatch
- **Code Quality**: Radon, Pylint, complexidade
- **Git Security**: Arquivos grandes, binários, assinaturas

---

## Estrutura de Segurança

```
.github/workflows/
├── security-codeql.yml              # CodeQL Analysis
├── security-dependency-scan.yml     # Dependency Scanning
├── security-secrets-scan.yml        # Secrets Detection
├── security-sast.yml                # Static Analysis
├── security-container-scan.yml      # Container/Lambda Scanning
├── security-compliance.yml          # Compliance Checks
└── deploy-dashboard.yml             # Deploy (mantido)

SECURITY.md                          # Política de Segurança
docs/security.md                     # Esta documentação
```

---

## Calendário de Execução

| Dia | Horário UTC | Workflow | Descrição |
|-----|-------------|----------|-----------|
| Segunda | 06:00 | CodeQL | Análise de código |
| Terça | 10:00 | SAST | Análise estática |
| Quarta | 12:00 | Container | Scan de containers |
| Quinta | 14:00 | Compliance | Conformidade |
| Diário | 08:00 | Dependencies | Scan de dependências |
| Push/PR | - | Todos | Verificação completa |

---

## Níveis de Severidade

### Crítico (CRITICAL)
- **Ação**: Correção imediata (< 24h)
- **Exemplos**: SQL Injection, RCE, credenciais expostas
- **Bloqueio**: Sim (em PRs)

### Alto (HIGH)
- **Ação**: Correção urgente (< 7 dias)
- **Exemplos**: XSS, CSRF, deserialização insegura
- **Bloqueio**: Sim (em PRs)

### Médio (MEDIUM)
- **Ação**: Correção planejada (< 30 dias)
- **Exemplos**: Weak crypto, path traversal
- **Bloqueio**: Não

### Baixo (LOW)
- **Ação**: Correção oportunística
- **Exemplos**: Information disclosure, deprecated APIs
- **Bloqueio**: Não

---

## Ferramentas de Segurança

### Análise de Código
- **CodeQL**: GitHub native, multi-language
- **Semgrep**: Rules-based SAST
- **Bandit**: Python-specific security
- **ESLint Security**: JavaScript/React

### Dependências
- **Dependabot**: Atualizações automáticas
- **Safety**: Python vulnerability DB
- **pip-audit**: Python package auditing
- **npm audit**: JavaScript vulnerability scanning

### Secrets
- **Gitleaks**: Fast secret scanner
- **TruffleHog**: Deep history scanning
- **Custom checks**: AWS-specific patterns

### Containers
- **Trivy**: Comprehensive vulnerability scanner
- **cfn-lint**: CloudFormation linting

### Compliance
- **OpenSSF Scorecard**: Security posture
- **License Checker**: License compliance

---

## Configuração de Secrets

### GitHub Secrets Necessários

```yaml
AWS_REGION: us-east-1
AWS_ACCESS_KEY_ID: AKIA...
AWS_SECRET_ACCESS_KEY: ...
S3_BUCKET: b3tr-data-...
GITLEAKS_LICENSE: (opcional)
```

### AWS Secrets Manager

```python
# Lambda functions usam:
- BRAPI_SECRET_NAME: brapi-credentials
```

---

## Checklist de Segurança

### Para Desenvolvedores

- [ ] Nenhuma credencial no código
- [ ] Nenhum arquivo .env commitado
- [ ] Dependências atualizadas
- [ ] Testes de segurança passando
- [ ] Code review realizado
- [ ] Documentação atualizada

### Para Reviewers

- [ ] Verificar mudanças em IAM policies
- [ ] Validar uso de secrets
- [ ] Revisar permissões Lambda
- [ ] Verificar configurações S3
- [ ] Aprovar apenas se workflows passarem

### Para Deploy

- [ ] Todos os workflows de segurança passando
- [ ] Nenhum alerta crítico ou alto
- [ ] Dependências atualizadas
- [ ] Logs de segurança configurados
- [ ] Monitoramento ativo

---

## Resposta a Incidentes

### 1. Detecção
- Alertas do GitHub Security
- Notificações de workflows
- Monitoramento CloudWatch

### 2. Avaliação
- Severidade da vulnerabilidade
- Impacto no sistema
- Dados afetados

### 3. Contenção
- Revogar credenciais comprometidas
- Bloquear acesso se necessário
- Isolar componentes afetados

### 4. Correção
- Aplicar patches
- Atualizar dependências
- Modificar código

### 5. Recuperação
- Validar correção
- Deploy da correção
- Monitorar sistema

### 6. Pós-Incidente
- Documentar incidente
- Atualizar processos
- Comunicar stakeholders

---

## Métricas de Segurança

### KPIs

- **Vulnerabilidades Críticas**: 0
- **Vulnerabilidades Altas**: < 5
- **Tempo de Correção Crítica**: < 24h
- **Tempo de Correção Alta**: < 7 dias
- **OpenSSF Scorecard**: > 7.0
- **Cobertura de Testes**: > 80%

### Dashboards

- GitHub Security Overview
- Dependabot Alerts
- CodeQL Results
- Workflow Status

---

## Recursos Adicionais

### Documentação
- [SECURITY.md](../SECURITY.md) - Política de segurança
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

### Treinamento
- AWS Security Fundamentals
- OWASP Secure Coding Practices
- GitHub Security Features

### Contato
- **Security Issues**: Use GitHub Security Advisories
- **Geral**: GitHub Issues

---

**Última atualização**: 07/03/2026  
**Versão**: 2.0.1
