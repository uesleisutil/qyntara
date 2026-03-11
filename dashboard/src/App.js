// Dashboard v3.0.0 - MLOps Pipeline com Dashboard API REST - 2026-03-10
import React, { useEffect } from 'react';
import { 
  TrendingUp, 
  Activity, 
  BarChart3,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Global store
import useGlobalStore from './store/globalStore';

// Hooks
import { 
  useRecommendations, 
  useDataQuality, 
  useModelPerformance, 
  useDrift,
  useCosts,
  useEnsembleWeights 
} from './hooks';

// Shared components
import { LoadingSpinner, ErrorBoundary } from './components/shared';

// Recommendations components
import RecommendationsTable from './components/RecommendationsTable';
import { RecommendationsKPIs, ReturnDistributionChart } from './components/recommendations';

// Monitoring components
import { 
  DataQualityPanel, 
  ModelPerformancePanel, 
  DriftMonitoringPanel 
} from './components/monitoring';

// Costs components
import { 
  CostsSummary, 
  CostsByServiceChart, 
  CostsEvolutionChart, 
  CostsTable 
} from './components/costs';

function App() {
  // Global state
  const { 
    activeTab, 
    setActiveTab, 
    lastUpdated, 
    setLastUpdated,
    isRefreshing,
    setIsRefreshing,
    error,
    setError,
    clearError
  } = useGlobalStore();

  // Fetch data with auto-refresh (5 minutes) - always fetch, control with enabled
  const recommendationsQuery = useRecommendations({ enabled: true });
  const dataQualityQuery = useDataQuality({ days: 30, enabled: true });
  const modelPerformanceQuery = useModelPerformance({ days: 30, enabled: true });
  const driftQuery = useDrift({ days: 30, enabled: true });
  const costsQuery = useCosts({ days: 30, enabled: true });
  const ensembleWeightsQuery = useEnsembleWeights({ days: 30, enabled: true });

  // Update last updated timestamp when any query succeeds
  useEffect(() => {
    const queries = [
      recommendationsQuery,
      dataQualityQuery,
      modelPerformanceQuery,
      driftQuery,
      costsQuery,
      ensembleWeightsQuery
    ];

    const anySuccess = queries.some(q => q.isSuccess && q.dataUpdatedAt);
    if (anySuccess) {
      const latestUpdate = Math.max(...queries.map(q => q.dataUpdatedAt || 0));
      setLastUpdated(new Date(latestUpdate));
    }
  }, [
    recommendationsQuery,
    dataQualityQuery,
    modelPerformanceQuery,
    driftQuery,
    costsQuery,
    ensembleWeightsQuery,
    setLastUpdated
  ]);

  // Track refreshing state
  useEffect(() => {
    const queries = [
      recommendationsQuery,
      dataQualityQuery,
      modelPerformanceQuery,
      driftQuery,
      costsQuery,
      ensembleWeightsQuery
    ];

    const anyFetching = queries.some(q => q.isFetching);
    setIsRefreshing(anyFetching);
  }, [
    recommendationsQuery,
    dataQualityQuery,
    modelPerformanceQuery,
    driftQuery,
    costsQuery,
    ensembleWeightsQuery,
    setIsRefreshing
  ]);

  // Handle errors (Req 13.4 - preserve previous data)
  useEffect(() => {
    const queries = [
      { query: recommendationsQuery, name: 'Recomendações' },
      { query: dataQualityQuery, name: 'Qualidade de Dados' },
      { query: modelPerformanceQuery, name: 'Performance do Modelo' },
      { query: driftQuery, name: 'Drift' },
      { query: costsQuery, name: 'Custos' },
      { query: ensembleWeightsQuery, name: 'Pesos do Ensemble' }
    ];

    const failedQueries = queries.filter(q => q.query.isError);
    
    if (failedQueries.length > 0) {
      const errorMessages = failedQueries.map(q => q.name).join(', ');
      setError(`Erro ao carregar: ${errorMessages}. Dados anteriores foram preservados.`);
    } else {
      clearError();
    }
  }, [
    recommendationsQuery,
    dataQualityQuery,
    modelPerformanceQuery,
    driftQuery,
    costsQuery,
    ensembleWeightsQuery,
    setError,
    clearError
  ]);

  // Manual refresh function
  const handleManualRefresh = () => {
    recommendationsQuery.refetch();
    dataQualityQuery.refetch();
    modelPerformanceQuery.refetch();
    driftQuery.refetch();
    costsQuery.refetch();
    ensembleWeightsQuery.refetch();
  };

  // Initial loading state - simplified
  const isInitialLoading = (
    (activeTab === 'recommendations' && recommendationsQuery.isLoading) ||
    (activeTab === 'monitoring' && (dataQualityQuery.isLoading || modelPerformanceQuery.isLoading || driftQuery.isLoading)) ||
    (activeTab === 'costs' && costsQuery.isLoading)
  );

  // Log for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Dashboard State:', {
      isInitialLoading,
      lastUpdated,
      activeTab,
      queries: {
        recommendations: { isLoading: recommendationsQuery.isLoading, isError: recommendationsQuery.isError, data: !!recommendationsQuery.data },
        dataQuality: { isLoading: dataQualityQuery.isLoading, isError: dataQualityQuery.isError, data: !!dataQualityQuery.data },
        modelPerformance: { isLoading: modelPerformanceQuery.isLoading, isError: modelPerformanceQuery.isError, data: !!modelPerformanceQuery.data },
        drift: { isLoading: driftQuery.isLoading, isError: driftQuery.isError, data: !!driftQuery.data },
        costs: { isLoading: costsQuery.isLoading, isError: costsQuery.isError, data: !!costsQuery.data },
        ensembleWeights: { isLoading: ensembleWeightsQuery.isLoading, isError: ensembleWeightsQuery.isError, data: !!ensembleWeightsQuery.data }
      }
    });
  }

  if (isInitialLoading) {
    return (
      <div className="container">
        <div className="header">
          <h1>B3 Tactical Ranking - MLOps Dashboard</h1>
          <p>Monitoramento Completo de Performance e Métricas</p>
        </div>
        <LoadingSpinner 
          size="lg" 
          text="Carregando dashboard..." 
          centered 
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container">
        <header className="header">
          <h1>B3 Tactical Ranking - MLOps Dashboard</h1>
          <p>Monitoramento Completo de Performance e Métricas</p>
          {isRefreshing && (
            <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '1rem', color: '#3b82f6' }}>
              <RefreshCw className="animate-spin" size={20} style={{ marginRight: '0.5rem' }} />
              <span>Atualizando...</span>
            </div>
          )}
        </header>

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <p style={{ margin: 0, color: '#991b1b', fontSize: '0.875rem' }}>
              {error}
            </p>
            <button
              onClick={clearError}
              style={{
                background: 'none',
                border: 'none',
                color: '#991b1b',
                cursor: 'pointer',
                fontSize: '1.25rem',
                padding: '0.25rem'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs de Navegação */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem', 
          borderBottom: '2px solid #e2e8f0',
          padding: '0 1rem'
        }}>
          <button
            onClick={() => setActiveTab('recommendations')}
            style={{
              padding: '1rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'recommendations' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'recommendations' ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === 'recommendations' ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <TrendingUp size={20} />
            Recomendações
          </button>
          
          <button
            onClick={() => setActiveTab('monitoring')}
            style={{
              padding: '1rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'monitoring' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'monitoring' ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === 'monitoring' ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Activity size={20} />
            Monitoramento
          </button>
          
          <button
            onClick={() => setActiveTab('costs')}
            style={{
              padding: '1rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'costs' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'costs' ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === 'costs' ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <DollarSign size={20} />
            Custos
          </button>
        </div>

        {/* Conteúdo baseado na tab ativa - Lazy loading (Req 20.1, 20.2) */}
        {activeTab === 'recommendations' && (
          <div className="dashboard-grid">
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <RecommendationsKPIs 
                recommendations={recommendationsQuery.data?.recommendations || []} 
              />
            </div>

            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={20} />
                Top 50 Recomendações
              </h3>
              <RecommendationsTable 
                recommendations={recommendationsQuery.data?.recommendations || []} 
              />
            </div>

            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={20} />
                Distribuição de Retornos Esperados
              </h3>
              <ReturnDistributionChart 
                recommendations={recommendationsQuery.data?.recommendations || []} 
              />
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="dashboard-grid">
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} />
                Qualidade de Dados
              </h3>
              <DataQualityPanel 
                data={dataQualityQuery.data}
                isLoading={dataQualityQuery.isLoading}
              />
            </div>

            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={20} />
                Performance do Modelo
              </h3>
              <ModelPerformancePanel 
                data={modelPerformanceQuery.data}
                isLoading={modelPerformanceQuery.isLoading}
              />
            </div>

            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} />
                Detecção de Drift
              </h3>
              <DriftMonitoringPanel 
                driftData={driftQuery.data}
                ensembleData={ensembleWeightsQuery.data}
                isLoading={driftQuery.isLoading || ensembleWeightsQuery.isLoading}
              />
            </div>
          </div>
        )}

        {activeTab === 'costs' && (
          <div className="dashboard-grid">
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <CostsSummary 
                data={costsQuery.data}
                isLoading={costsQuery.isLoading}
              />
            </div>

            <div className="card">
              <CostsByServiceChart 
                data={costsQuery.data}
                isLoading={costsQuery.isLoading}
              />
            </div>

            <div className="card">
              <CostsEvolutionChart 
                data={costsQuery.data}
                isLoading={costsQuery.isLoading}
              />
            </div>

            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <CostsTable 
                data={costsQuery.data}
                isLoading={costsQuery.isLoading}
              />
            </div>
          </div>
        )}

        {/* Footer com timestamp e botão de refresh */}
        {lastUpdated && (
          <div className="last-updated" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            marginTop: '2rem',
            borderTop: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Última atualização: {format(lastUpdated, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
            </span>
            <button 
              onClick={handleManualRefresh} 
              disabled={isRefreshing}
              style={{ 
                padding: '0.5rem 1rem', 
                background: isRefreshing ? '#94a3b8' : '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
