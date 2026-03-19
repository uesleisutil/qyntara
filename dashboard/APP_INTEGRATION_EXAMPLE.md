# Exemplo Prático de Integração no App.js

Este documento mostra exatamente como integrar os novos componentes no App.js existente.

---

## 📝 Mudanças Necessárias no App.js

### 1. Adicionar Imports no Topo

```javascript
// No início do arquivo, adicione:
import { 
  // Comparação Temporal
  TemporalComparisonProvider,
  TemporalComparisonToggle,
  TemporalKPICard,
  ComparisonValue,
  
  // Visualizações
  StatusBadge,
  Sparkline,
  GoalProgressBar,
  
  // UX
  NotificationCenter,
  Breadcrumb,
  OfflineIndicator,
  FavoriteIcon,
} from './components/shared';

import { 
  CandlestickChart,
} from './components/charts';
```

---

### 2. Envolver o App com Provider

```javascript
// ANTES
function App() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      {/* conteúdo */}
    </div>
  );
}

// DEPOIS
function App() {
  return (
    <TemporalComparisonProvider>
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        {/* conteúdo */}
      </div>
    </TemporalComparisonProvider>
  );
}
```

---

### 3. Adicionar Componentes no Header

```javascript
// ANTES
<header style={{ /* ... */ }}>
  <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <h1>B3 Tactical Ranking</h1>
      <p>Dashboard de Monitoramento MLOps</p>
    </div>
    
    <button onClick={() => setDarkMode(!darkMode)}>
      {darkMode ? <Sun /> : <Moon />}
    </button>
  </div>
</header>

// DEPOIS
<header style={{ /* ... */ }}>
  <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <h1>B3 Tactical Ranking</h1>
      <p>Dashboard de Monitoramento MLOps</p>
    </div>
    
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <NotificationCenter />
      <button onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </div>
  </div>
</header>
```

---

### 4. Adicionar Indicadores Globais

```javascript
// Logo após o header, adicione:
<div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>
  {/* Offline Indicator */}
  <OfflineIndicator />
  
  {/* Breadcrumb */}
  <Breadcrumb 
    items={[
      { label: 'Dashboard', path: '/' },
      { label: activeTab === 'recommendations' ? 'Recomendações' : 
               activeTab === 'performance' ? 'Performance' :
               activeTab === 'validation' ? 'Validação' :
               activeTab === 'costs' ? 'Custos' :
               activeTab === 'dataQuality' ? 'Data Quality' :
               activeTab === 'driftDetection' ? 'Drift Detection' :
               activeTab === 'explainability' ? 'Explainability' :
               'Backtesting', 
        path: `/${activeTab}` 
      }
    ]}
  />
  
  {/* Temporal Comparison Toggle */}
  <div style={{ marginBottom: '1.5rem' }}>
    <TemporalComparisonToggle />
  </div>
  
  {/* Resto do conteúdo */}
</div>
```

---

### 5. Substituir KPI Cards por TemporalKPICard

#### ANTES (Recommendations Tab):
```javascript
<div style={{
  backgroundColor: theme.cardBg,
  padding: isMobile ? '1rem' : '1.25rem',
  borderRadius: '12px',
  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
}}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
    <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
      Total de Ativos
    </span>
    <CheckCircle size={isMobile ? 16 : 18} color="#10b981" />
  </div>
  <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
    {recommendations.length}
  </p>
</div>
```

#### DEPOIS:
```javascript
<TemporalKPICard
  title="Total de Ativos"
  current={recommendations.length}
  previous={previousRecommendations?.length || recommendations.length}
  icon={<CheckCircle size={18} />}
/>
```

---

### 6. Adicionar Sparklines na Tabela de Recomendações

#### ANTES:
```javascript
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
  <thead>
    <tr>
      <th>Rank</th>
      <th>Ticker</th>
      <th>Retorno</th>
      <th>Score</th>
    </tr>
  </thead>
  <tbody>
    {recommendations.map((rec, idx) => (
      <tr key={idx}>
        <td>#{idx + 1}</td>
        <td>{rec.ticker}</td>
        <td>{formatPercent(rec.exp_return_20)}</td>
        <td>{rec.score?.toFixed(4)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

#### DEPOIS:
```javascript
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
  <thead>
    <tr>
      <th>Rank</th>
      <th>Ticker</th>
      <th>Retorno</th>
      <th>Score</th>
      <th>Tendência</th> {/* Nova coluna */}
      <th>Status</th> {/* Nova coluna */}
    </tr>
  </thead>
  <tbody>
    {recommendations.map((rec, idx) => {
      // Buscar histórico do ticker
      const tickerHistory = recommendationsHistory.data[rec.ticker] || [];
      const scoreHistory = tickerHistory.map(h => h.score).slice(-30);
      
      return (
        <tr key={idx}>
          <td>#{idx + 1}</td>
          <td>{rec.ticker}</td>
          <td>{formatPercent(rec.exp_return_20)}</td>
          <td>{rec.score?.toFixed(4)}</td>
          <td>
            {scoreHistory.length > 0 && (
              <Sparkline 
                data={scoreHistory}
                width={100}
                height={30}
                label="Score"
                showTooltip={true}
              />
            )}
          </td>
          <td>
            <StatusBadge 
              status="good"
              label="OK"
              size="sm"
            />
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
```

---

### 7. Adicionar Metas de Performance (Performance Tab)

```javascript
// No início da Performance Tab, adicione:
{activeTab === 'performance' && (
  <div>
    {/* Seção de Metas */}
    <div style={{
      backgroundColor: theme.cardBg,
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.5rem',
      marginBottom: isMobile ? '1.5rem' : '2rem',
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <h2 style={{ margin: '0 0 1.5rem 0', fontSize: isMobile ? '1.125rem' : '1.25rem', fontWeight: '700', color: theme.text }}>
        Metas de Performance
      </h2>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        <GoalProgressBar
          goal={{
            id: 'annual-return',
            metric: 'Retorno Anual',
            target: 15,
            current: performance?.latest?.annual_return || 0,
            unit: '%',
            deadline: '2024-12-31',
            historicalAchievementRate: 75,
          }}
          onEditTarget={(goalId, newTarget) => {
            console.log(`Meta ${goalId} atualizada para ${newTarget}`);
            // Implementar lógica de atualização
          }}
          editable={true}
        />
        
        <GoalProgressBar
          goal={{
            id: 'sharpe-ratio',
            metric: 'Sharpe Ratio',
            target: 2.0,
            current: performance?.latest?.sharpe_ratio || 0,
            unit: '',
            deadline: '2024-12-31',
            historicalAchievementRate: 60,
          }}
          onEditTarget={(goalId, newTarget) => {
            console.log(`Meta ${goalId} atualizada para ${newTarget}`);
          }}
          editable={true}
        />
        
        <GoalProgressBar
          goal={{
            id: 'accuracy',
            metric: 'Acurácia Direcional',
            target: 60,
            current: (performance?.latest?.directional_accuracy || 0) * 100,
            unit: '%',
            deadline: '2024-12-31',
            historicalAchievementRate: 80,
          }}
          onEditTarget={(goalId, newTarget) => {
            console.log(`Meta ${goalId} atualizada para ${newTarget}`);
          }}
          editable={true}
        />
      </div>
    </div>
    
    {/* Resto do conteúdo da Performance Tab */}
  </div>
)}
```

---

### 8. Adicionar Status Badges (Data Quality Tab)

```javascript
{activeTab === 'dataQuality' && dataQuality && (
  <div>
    {/* KPIs com Status Badges */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem'
    }}>
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
          <span style={{ color: theme.textSecondary, fontSize: '0.875rem', fontWeight: '500' }}>
            Completeness
          </span>
          <StatusBadge 
            status={dataQuality.completeness > 0.95 ? "good" : 
                   dataQuality.completeness > 0.8 ? "warning" : "critical"}
            label={dataQuality.completeness > 0.95 ? "Excelente" : 
                  dataQuality.completeness > 0.8 ? "Atenção" : "Crítico"}
            tooltip={`Taxa de completude: ${(dataQuality.completeness * 100).toFixed(1)}%`}
            size="sm"
          />
        </div>
        <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: theme.text }}>
          {formatPercent(dataQuality.completeness)}
        </p>
      </div>
      
      <div style={{
        backgroundColor: theme.cardBg,
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
          <span style={{ color: theme.textSecondary, fontSize: '0.875rem', fontWeight: '500' }}>
            Freshness
          </span>
          <StatusBadge 
            status={dataQuality.freshness_hours < 24 ? "current" : 
                   dataQuality.freshness_hours < 48 ? "warning" : "stale"}
            label={dataQuality.freshness_hours < 24 ? "Atual" : 
                  dataQuality.freshness_hours < 48 ? "Atenção" : "Desatualizado"}
            tooltip={`Última atualização: ${dataQuality.freshness_hours}h atrás`}
            size="sm"
          />
        </div>
        <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: theme.text }}>
          {dataQuality.freshness_hours}h
        </p>
      </div>
    </div>
  </div>
)}
```

---

## 🎯 Exemplo Completo de Uma Seção

Aqui está um exemplo completo de como ficaria a seção de KPIs da Recommendations Tab:

```javascript
{!loading && activeTab === 'recommendations' && (
  <div>
    {/* KPIs com Comparação Temporal */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: isMobile ? '1rem' : '1.25rem',
      marginBottom: isMobile ? '1.5rem' : '2rem'
    }}>
      <TemporalKPICard
        title="Total de Ativos"
        current={recommendations.length}
        previous={previousRecommendations?.length || recommendations.length}
        icon={<CheckCircle size={18} />}
      />
      
      <TemporalKPICard
        title="Retorno Médio"
        current={avgReturn}
        previous={previousAvgReturn || avgReturn}
        unit="%"
        format={(v) => (v * 100).toFixed(2)}
        icon={<TrendingUp size={18} />}
      />
      
      <TemporalKPICard
        title="Ativos Positivos"
        current={positiveCount}
        previous={previousPositiveCount || positiveCount}
        icon={<ArrowUpRight size={18} />}
      />
      
      <TemporalKPICard
        title="Score Médio"
        current={avgScore}
        previous={previousAvgScore || avgScore}
        format={(v) => v.toFixed(4)}
        icon={<BarChart3 size={18} />}
      />
    </div>
    
    {/* Resto do conteúdo */}
  </div>
)}
```

---

## 🔄 Estado Necessário

Adicione estes estados no início do componente App:

```javascript
function App() {
  // Estados existentes...
  
  // Novos estados para comparação temporal
  const [previousRecommendations, setPreviousRecommendations] = useState([]);
  const [previousPerformance, setPreviousPerformance] = useState(null);
  const [previousValidation, setPreviousValidation] = useState(null);
  
  // Estado para favoritos
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Estado para metas
  const [performanceGoals, setPerformanceGoals] = useState(() => {
    const saved = localStorage.getItem('performanceGoals');
    return saved ? JSON.parse(saved) : {
      'annual-return': { target: 15, current: 0 },
      'sharpe-ratio': { target: 2.0, current: 0 },
      'accuracy': { target: 60, current: 0 },
    };
  });
  
  // ... resto do código
}
```

---

## 📝 Funções Auxiliares

Adicione estas funções auxiliares:

```javascript
// Toggle de favoritos
const toggleFavorite = (ticker) => {
  setFavorites(prev => {
    const newFavorites = prev.includes(ticker)
      ? prev.filter(t => t !== ticker)
      : [...prev, ticker];
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
    return newFavorites;
  });
};

// Atualizar meta
const updateGoal = (goalId, newTarget) => {
  setPerformanceGoals(prev => {
    const updated = {
      ...prev,
      [goalId]: { ...prev[goalId], target: newTarget }
    };
    localStorage.setItem('performanceGoals', JSON.stringify(updated));
    return updated;
  });
};

// Buscar dados anteriores para comparação
const fetchPreviousData = async (period) => {
  // Implementar lógica para buscar dados do período anterior
  // period pode ser: 'day', 'week', 'month', 'quarter', 'year'
  try {
    const response = await fetch(`${API_BASE_URL}/api/recommendations/previous?period=${period}`, {
      headers: { 'x-api-key': API_KEY }
    });
    if (response.ok) {
      const data = await response.json();
      setPreviousRecommendations(data.recommendations || []);
    }
  } catch (error) {
    console.error('Error fetching previous data:', error);
  }
};
```

---

## ✅ Checklist de Implementação

Use esta checklist ao implementar:

- [ ] Imports adicionados no topo do arquivo
- [ ] App envolvido com `TemporalComparisonProvider`
- [ ] `NotificationCenter` adicionado no header
- [ ] `OfflineIndicator` adicionado
- [ ] `Breadcrumb` adicionado
- [ ] `TemporalComparisonToggle` adicionado
- [ ] Estados novos criados (previousData, favorites, goals)
- [ ] Funções auxiliares implementadas
- [ ] KPI cards substituídos por `TemporalKPICard`
- [ ] Sparklines adicionados nas tabelas
- [ ] Status badges adicionados onde apropriado
- [ ] Metas de performance adicionadas na Performance Tab
- [ ] Testado em modo claro e escuro
- [ ] Testado em mobile e desktop
- [ ] Console sem erros

---

## 🚀 Deploy

Após implementar todas as mudanças:

1. **Teste localmente:**
   ```bash
   cd dashboard
   npm start
   ```

2. **Verifique exports:**
   ```bash
   node verify-exports.js
   ```

3. **Build de produção:**
   ```bash
   npm run build
   ```

4. **Deploy:**
   ```bash
   # Seu comando de deploy aqui
   ```

---

## 📞 Troubleshooting

### Erro: "Cannot find module"
- Verifique se todos os imports estão corretos
- Execute `node verify-exports.js`
- Verifique se os arquivos existem nos caminhos especificados

### Componentes não aparecem
- Verifique se o Provider está envolvendo o App
- Verifique o console para erros
- Verifique se os dados estão sendo passados corretamente

### Estilos quebrados
- Verifique se o tema está sendo passado corretamente
- Verifique se darkMode está funcionando
- Verifique conflitos de CSS

### Performance lenta
- Verifique se há muitos sparklines renderizando simultaneamente
- Considere virtualização para tabelas grandes
- Use React.memo para componentes pesados

---

**Boa sorte com a integração! 🚀**
