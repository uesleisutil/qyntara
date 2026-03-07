# Contribuindo para o B3 Tactical Ranking

Obrigado por considerar contribuir para o B3 Tactical Ranking! 🎉

## 📋 Código de Conduta

Este projeto adere a um código de conduta. Ao participar, você concorda em manter um ambiente respeitoso e inclusivo.

## 🚀 Como Contribuir

### Reportando Bugs

Se você encontrou um bug, por favor abra uma [issue](https://github.com/uesleisutil/b3-tactical-ranking/issues/new?template=bug_report.md) incluindo:

- Descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs atual
- Screenshots (se aplicável)
- Ambiente (OS, versões, etc)

### Sugerindo Melhorias

Para sugerir uma nova funcionalidade, abra uma [issue](https://github.com/uesleisutil/b3-tactical-ranking/issues/new?template=feature_request.md) com:

- Descrição clara da funcionalidade
- Motivação e casos de uso
- Exemplos de implementação (se possível)

### Pull Requests

1. **Fork o repositório**
   ```bash
   git clone https://github.com/SEU-USUARIO/b3-tactical-ranking.git
   cd b3-tactical-ranking
   ```

2. **Crie uma branch**
   ```bash
   git checkout -b feature/minha-funcionalidade
   # ou
   git checkout -b fix/meu-bug-fix
   ```

3. **Faça suas alterações**
   - Siga os padrões de código do projeto
   - Adicione testes se aplicável
   - Atualize a documentação

4. **Commit suas mudanças**
   ```bash
   git add .
   git commit -m "feat: adiciona nova funcionalidade X"
   ```
   
   Use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `docs:` mudanças na documentação
   - `style:` formatação, ponto e vírgula, etc
   - `refactor:` refatoração de código
   - `test:` adição de testes
   - `chore:` manutenção

5. **Push para o GitHub**
   ```bash
   git push origin feature/minha-funcionalidade
   ```

6. **Abra um Pull Request**
   - Descreva suas mudanças claramente
   - Referencie issues relacionadas
   - Aguarde review

## 🏗️ Estrutura do Projeto

```
b3-tactical-ranking/
├── infra/          # Infraestrutura AWS CDK (TypeScript)
├── ml/             # Código Machine Learning (Python)
├── dashboard/      # Dashboard React (JavaScript)
├── scripts/        # Scripts utilitários (Bash)
├── docs/           # Documentação
└── config/         # Configurações
```

## 💻 Ambiente de Desenvolvimento

### Pré-requisitos

- Python 3.11+
- Node.js 18+
- AWS CLI configurado
- Git

### Setup Local

```bash
# Clone o repositório
git clone https://github.com/uesleisutil/b3-tactical-ranking.git
cd b3-tactical-ranking

# Configure Python (opcional, para desenvolvimento ML)
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# ou .venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Configure Node.js (para infraestrutura)
cd infra
npm install

# Configure Dashboard (opcional)
cd ../dashboard
npm install
```

## 🧪 Testes

### Python (ML)
```bash
pytest ml/tests/
```

### TypeScript (Infraestrutura)
```bash
cd infra
npm test
```

### JavaScript (Dashboard)
```bash
cd dashboard
npm test
```

## 📝 Padrões de Código

### Python
- Siga [PEP 8](https://pep8.org/)
- Use type hints
- Docstrings em funções públicas
- Máximo 100 caracteres por linha

```python
def calculate_mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """
    Calculate Mean Absolute Percentage Error.
    
    Args:
        actual: Array of actual values
        predicted: Array of predicted values
        
    Returns:
        MAPE as percentage
    """
    return np.mean(np.abs((actual - predicted) / actual)) * 100
```

### TypeScript
- Use ESLint
- Interfaces para tipos complexos
- Comentários JSDoc

```typescript
/**
 * Creates a Lambda function with common configuration
 */
function createLambda(id: string, handler: string): lambda.Function {
  return new lambda.Function(this, id, {
    runtime: lambda.Runtime.PYTHON_3_11,
    handler,
    // ...
  });
}
```

### JavaScript/React
- Use ESLint + Prettier
- Componentes funcionais com hooks
- PropTypes ou TypeScript

```javascript
/**
 * Displays model quality metrics
 */
const ModelQualityPanel = ({ data }) => {
  const [metrics, setMetrics] = useState(null);
  // ...
};
```

## 📚 Documentação

- Atualize o README.md se necessário
- Adicione comentários em código complexo
- Documente novas funcionalidades em `docs/`
- Mantenha o CHANGELOG.md atualizado

## 🔍 Review Process

1. Automated checks devem passar (CI/CD)
2. Code review por mantenedores
3. Testes devem estar incluídos
4. Documentação deve estar atualizada
5. Sem conflitos com main branch

## 🎯 Áreas para Contribuir

### Fácil (Good First Issue)
- Melhorias na documentação
- Correção de typos
- Adição de testes
- Melhorias no dashboard

### Médio
- Novas features no ML pipeline
- Otimizações de performance
- Novos gráficos no dashboard
- Melhorias na infraestrutura

### Avançado
- Novos modelos de ML
- Integração com outras exchanges
- API REST
- Mobile app

## 💬 Comunicação

- **Issues**: Para bugs e features
- **Discussions**: Para perguntas e ideias
- **Pull Requests**: Para contribuições de código

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a Licença MIT.

## 🙏 Agradecimentos

Obrigado por contribuir para tornar o B3 Tactical Ranking melhor! 🚀

---

**Dúvidas?** Abra uma [discussion](https://github.com/uesleisutil/b3-tactical-ranking/discussions) ou entre em contato!
