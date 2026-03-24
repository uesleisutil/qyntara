# Contribuindo com o Qyntara

Obrigado pelo interesse em contribuir! Aqui estão as guidelines para manter o projeto organizado.

## Workflow

1. Fork o repositório
2. Crie uma branch a partir de `main`: `git checkout -b feat/minha-feature`
3. Faça suas alterações seguindo os padrões abaixo
4. Commit com mensagens convencionais (veja abaixo)
5. Abra um Pull Request para `main`

## Convenção de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(dashboard): adiciona filtro por setor
fix(ml): corrige cálculo de stop-loss
chore(deps): atualiza react para 18.3
docs: atualiza API reference
refactor(infra): simplifica IAM policies
```

Prefixos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`.

## Padrões de Código

### Python (ml/)
- Python 3.11+
- Formatação: Black (line-length=100)
- Linting: Ruff
- Type hints obrigatórios em funções públicas

### TypeScript (dashboard/)
- React 18 + TypeScript strict
- Componentes funcionais com hooks
- Nomes de componentes em PascalCase
- Arquivos de componente em PascalCase (ex: `MyComponent.tsx`)

### Infra (infra/)
- AWS CDK em TypeScript
- Nomes de recursos com prefixo `B3TR` ou `Qyntara`

## Estrutura de PRs

- Título descritivo seguindo Conventional Commits
- Descrição do que foi alterado e por quê
- Screenshots para mudanças visuais
- Sem arquivos de teste quebrados

## Reportando Bugs

Abra uma issue com:
- Descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs. atual
- Screenshots se aplicável
