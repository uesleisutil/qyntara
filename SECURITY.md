# Security Policy

## 🔒 Segurança do Projeto B3 Tactical Ranking

Este documento descreve as políticas de segurança, práticas recomendadas e como reportar vulnerabilidades.

---

## 📋 Versões Suportadas

| Versão | Suportada          |
| ------ | ------------------ |
| 2.x.x  | ✅ Sim             |
| 1.x.x  | ❌ Não             |
| < 1.0  | ❌ Não             |

---

## 🛡️ Práticas de Segurança Implementadas

### 1. Análise de Código Estática (SAST)

- **CodeQL**: Análise de segurança para Python e JavaScript
- **Semgrep**: Detecção de padrões de segurança
- **Bandit**: Linter de segurança Python
- **ESLint Security**: Análise de segurança JavaScript/React

### 2. Análise de Dependências

- **Dependabot**: Atualizações automáticas de dependências
- **Safety**: Verificação de vulnerabilidades Python
- **npm audit**: Verificação de vulnerabilidades JavaScript
- **Dependency Review**: Revisão de dependências em PRs

### 3. Detecção de Secrets

- **Gitleaks**: Detecção de credenciais vazadas
- **TruffleHog**: Busca de secrets no histórico Git
- **AWS Credentials Check**: Verificação específica de credenciais AWS

### 4. Análise de Containers e Lambda

- **Trivy**: Scanner de vulnerabilidades em filesystem
- **Lambda Security Check**: Verificação de boas práticas Lambda
- **IAM Policy Check**: Análise de políticas IAM

### 5. Compliance e Best Practices

- **OpenSSF Scorecard**: Avaliação de segurança do projeto
- **License Compliance**: Verificação de licenças
- **AWS Security Best Practices**: Conformidade com AWS Well-Architected

---

## 🚨 Reportando Vulnerabilidades

### Como Reportar

Se você descobrir uma vulnerabilidade de segurança, **NÃO** abra uma issue pública.

**Envie um email para:** [seu-email@exemplo.com]

**Inclua:**
- Descrição detalhada da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestões de correção (se houver)

### Tempo de Resposta

- **Confirmação inicial**: 48 horas
- **Avaliação**: 7 dias
- **Correção**: 30 dias (dependendo da severidade)

### Divulgação Responsável

Pedimos que você:
- Nos dê tempo razoável para corrigir antes de divulgar publicamente
- Não explore a vulnerabilidade além do necessário para demonstrá-la
- Não acesse, modifique ou delete dados de outros usuários

---

## 🔐 Segurança da Infraestrutura AWS

### Secrets Management

- **AWS Secrets Manager**: Armazenamento seguro de credenciais
- **Variáveis de ambiente**: Configurações sensíveis via Lambda environment
- **IAM Roles**: Autenticação sem credenciais hardcoded

### Criptografia

- **S3**: Criptografia em repouso (AES-256)
- **Lambda**: Variáveis de ambiente criptografadas
- **Secrets Manager**: Criptografia com KMS

### Controle de Acesso

- **IAM Policies**: Princípio do menor privilégio
- **S3 Bucket Policies**: Acesso restrito
- **Lambda Execution Roles**: Permissões mínimas necessárias

### Monitoramento

- **CloudWatch Logs**: Logs de todas as execuções
- **CloudWatch Alarms**: Alertas de anomalias
- **AWS CloudTrail**: Auditoria de ações (se habilitado)

---

## 🔍 Verificações de Segurança Automatizadas

### Executadas em Cada Push

- CodeQL Analysis (Python e JavaScript)
- Secret Scanning (Gitleaks, TruffleHog)
- SAST (Bandit, Semgrep, ESLint)

### Executadas em Pull Requests

- Dependency Review
- Code Quality Checks
- Security Compliance

### Executadas Periodicamente

- **Segunda-feira**: CodeQL Analysis
- **Terça-feira**: SAST completo
- **Quarta-feira**: Container Scanning
- **Quinta-feira**: Compliance Check
- **Diariamente**: Dependency Scanning

---

## 📝 Checklist de Segurança para Desenvolvedores

### Antes de Commitar

- [ ] Nenhuma credencial ou secret no código
- [ ] Nenhum arquivo `.env` commitado
- [ ] Dependências atualizadas
- [ ] Código revisado para vulnerabilidades óbvias

### Ao Adicionar Dependências

- [ ] Verificar licença compatível
- [ ] Verificar vulnerabilidades conhecidas
- [ ] Usar versões específicas (não `latest`)
- [ ] Documentar motivo da dependência

### Ao Modificar IAM Policies

- [ ] Seguir princípio do menor privilégio
- [ ] Evitar wildcards (`*`) quando possível
- [ ] Documentar permissões necessárias
- [ ] Revisar com time de segurança

### Ao Trabalhar com Dados Sensíveis

- [ ] Usar AWS Secrets Manager
- [ ] Nunca logar dados sensíveis
- [ ] Criptografar dados em repouso
- [ ] Validar e sanitizar inputs

---

## 🛠️ Ferramentas de Segurança Recomendadas

### Para Desenvolvimento Local

```bash
# Instalar ferramentas de segurança
pip install bandit safety pip-audit
npm install -g eslint-plugin-security

# Executar verificações locais
bandit -r ml/
safety check
npm audit
```

### Pre-commit Hooks

```bash
# Instalar pre-commit
pip install pre-commit

# Configurar hooks
pre-commit install

# Executar manualmente
pre-commit run --all-files
```

---

## 📚 Recursos de Segurança

### Documentação

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

### Treinamento

- [AWS Security Fundamentals](https://aws.amazon.com/training/course-descriptions/security-fundamentals/)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)

---

## 🔄 Atualizações de Segurança

### Dependências

- **Dependabot**: Atualizações automáticas semanais
- **Revisão manual**: Mensal
- **Atualizações críticas**: Imediatas

### Infraestrutura

- **Lambda Runtime**: Atualizar a cada 6 meses
- **CDK**: Atualizar trimestralmente
- **Node.js/Python**: Seguir LTS

---

## 📊 Métricas de Segurança

### Objetivos

- **Vulnerabilidades críticas**: 0
- **Vulnerabilidades altas**: < 5
- **Tempo de correção crítica**: < 24h
- **Tempo de correção alta**: < 7 dias
- **OpenSSF Scorecard**: > 7.0

### Monitoramento

- GitHub Security Advisories
- Dependabot Alerts
- CodeQL Alerts
- Workflow Reports

---

## 🚀 Melhorias Futuras

### Planejado

- [ ] Implementar AWS WAF
- [ ] Adicionar AWS GuardDuty
- [ ] Configurar AWS Security Hub
- [ ] Implementar rotação automática de secrets
- [ ] Adicionar testes de penetração automatizados
- [ ] Configurar SIEM (Security Information and Event Management)

---

## 📞 Contato

Para questões de segurança:
- **Email**: [seu-email@exemplo.com]
- **GitHub Security Advisories**: Use o recurso de Security Advisories do GitHub

Para questões gerais:
- **Issues**: https://github.com/uesleisutil/b3-tactical-ranking/issues

---

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**Última atualização**: 07/03/2026  
**Versão**: 2.0.1
