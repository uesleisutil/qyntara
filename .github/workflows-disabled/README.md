# Workflows Desabilitados

Estes workflows foram temporariamente desabilitados para simplificar o deploy inicial.

## Workflows Movidos

- `ci.yml` - Continuous Integration
- `codeql.yml` - Code scanning
- `data-quality.yml` - Data quality checks
- `dependabot.yml` - Dependency updates
- `deploy-oidc.yml` - OIDC deployment
- `deploy.yml` - Infrastructure deployment
- `monitoring.yml` - Monitoring checks
- `performance.yml` - Performance tests
- `release.yml` - Release automation

## Workflow Ativo

Apenas o workflow essencial está ativo:
- `deploy-dashboard.yml` - Deploy do dashboard para GitHub Pages

## Reativar Workflows

Para reativar um workflow, mova-o de volta para `.github/workflows/`:

```bash
mv .github/workflows-disabled/WORKFLOW.yml .github/workflows/
```

## Quando Reativar

Reative os workflows conforme necessário:

1. **ci.yml** - Quando tiver testes automatizados
2. **codeql.yml** - Para análise de segurança
3. **deploy.yml** - Para deploy automático da infraestrutura
4. **release.yml** - Para automação de releases

Os outros workflows podem ser reativados conforme a necessidade do projeto.
