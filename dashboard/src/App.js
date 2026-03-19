import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, RefreshCw, AlertCircle, CheckCircle, TrendingDown, ArrowUpRight, ArrowDownRight, Moon, Sun, AlertTriangle, Info, BarChart3 } from 'lucide-react';
import { API_BASE_URL, API_KEY } from './config';
import { ExplainabilityTab } from './components/explainability';
import { BacktestingTab } from './components/backtesting';
import { initializeSentry, trackPageView } from './services/monitoring';

// Importar novos componentes
import { 
  TemporalComparisonProvider,
  TemporalComparisonToggle,
  TemporalKPICard,
  NotificationCenter,
  Breadcrumb,
  OfflineIndicator,
} from './components/shared';

function App() {
  const [activeTab, setActiveTab] = useState('recommendations');
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsHistory, setRecommendationsHistory] = useState({ tickers: [], data: {} });
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [validation, setValidation] = useState(null);
  const [costs, setCosts] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [driftDetection, setDriftDetection] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [ensembleWeights, setEnsembleWeights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [tooltipData, setTooltipData] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Novos estados para comparação temporal
  // eslint-disable-next-line no-unused-vars
  const [previousRecommendations, setPreviousRecommendations] = useState([]);
  
  // Initialize monitoring on app load
  useEffect(() => {
    initializeSentry();
    trackPageView('app_load');
  }, []);

  // Track page views when tab changes
  useEffect(() => {
    if (activeTab) {
      trackPageView(activeTab);
    }
  }, [activeTab]);

  // Detectar mudanças no tamanho da tela
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f8fafc',
    tableBg: darkMode ? '#0f172a' : '#f8fafc',
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (activeTab === 'recommendations') {
        // Buscar recomendações atuais
        const response = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
          setLastUpdate(new Date());
        } else {
          throw new Error('Falha ao carregar recomendações');
        }
        
        // Buscar histórico (não crítico - não quebra se falhar)
        try {
          const historyResponse = await fetch(`${API_BASE_URL}/api/recommendations/history?days=30`, {
            headers: { 'x-api-key': API_KEY }
          });
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setRecommendationsHistory(historyData);
            // Selecionar os 5 primeiros tickers por padrão
            if (historyData.tickers && historyData.tickers.length > 0) {
              setSelectedTickers(historyData.tickers.slice(0, 5));
            }
          }
        } catch (historyError) {
          console.warn('Failed to load recommendations history:', historyError);
          // Não mostra erro ao usuário, apenas não exibe o gráfico
        }
      } else if (activeTab === 'performance') {
        // Buscar performance dos modelos
        try {
          const perfResponse = await fetch(`${API_BASE_URL}/api/monitoring/model-performance?days=30`, {
            headers: { 'x-api-key': API_KEY }
          });
          if (perfResponse.ok) {
            const perfData = await perfResponse.json();
            setPerformance(perfData);
          } else {
            // Não há dados de performance ainda
            setPerformance(null);
          }
        } catch (perfError) {
          console.warn('Performance data not available:', perfError);
          setPerformance(null);
        }
        
        // Buscar pesos do ensemble
        try {
          const weightsResponse = await fetch(`${API_BASE_URL}/api/monitoring/ensemble-weights?days=30`, {
            headers: { 'x-api-key': API_KEY }
          });
          if (weightsResponse.ok) {
            const weightsData = await weightsResponse.json();
            setEnsembleWeights(weightsData);
          } else {
            setEnsembleWeights(null);
          }
        } catch (weightsError) {
          console.warn('Ensemble weights not available:', weightsError);
          setEnsembleWeights(null);
        }
        
        setLastUpdate(new Date());
      } else if (activeTab === 'validation') {
        // Buscar validação das recomendações
        try {
          const validationResponse = await fetch(`${API_BASE_URL}/api/recommendations/validation?days=30`, {
            headers: { 'x-api-key': API_KEY }
          });
          if (validationResponse.ok) {
            const validationData = await validationResponse.json();
            setValidation(validationData);
          } else {
            setValidation(null);
          }
        } catch (validationError) {
          console.warn('Validation data not available:', validationError);
          setValidation(null);
        }
        
        setLastUpdate(new Date());
      } else if (activeTab === 'costs') {
        const response = await fetch(`${API_BASE_URL}/api/monitoring/costs?days=30`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          setCosts(data);
          setLastUpdate(new Date());
        } else {
          throw new Error('Falha ao carregar custos');
        }
      } else if (activeTab === 'dataQuality') {
        const response = await fetch(`${API_BASE_URL}/api/monitoring/data-quality?days=30`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          setDataQuality(data);
          setLastUpdate(new Date());
        } else {
          throw new Error('Falha ao carregar métricas de qualidade de dados');
        }
      } else if (activeTab === 'driftDetection') {
        const response = await fetch(`${API_BASE_URL}/api/monitoring/drift?days=90`, {
          headers: { 'x-api-key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          setDriftDetection(data);
          setLastUpdate(new Date());
        } else {
          throw new Error('Falha ao carregar métricas de drift detection');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <TemporalComparisonProvider>
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      transition: 'background-color 0.3s ease',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: theme.cardBg,
        borderBottom: `1px solid ${theme.border}`,
        padding: isMobile ? '1rem' : '1.5rem 2rem',
        boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.3s ease',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? '1.25rem' : '1.75rem',
              fontWeight: '700',
              color: theme.text,
              letterSpacing: '-0.025em'
            }}>
              B3 Tactical Ranking
            </h1>
            <p style={{
              margin: '0.25rem 0 0 0',
              color: theme.textSecondary,
              fontSize: isMobile ? '0.75rem' : '0.875rem',
              display: isMobile ? 'none' : 'block'
            }}>
              Dashboard de Monitoramento MLOps
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <NotificationCenter />
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: isMobile ? '0.625rem' : '0.75rem',
                backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                WebkitTapHighlightColor: 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
            >
              {darkMode ? <Sun size={isMobile ? 18 : 20} color="#fbbf24" /> : <Moon size={isMobile ? 18 : 20} color="#64748b" />}
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>
        {/* Offline Indicator */}
        <OfflineIndicator />
        
        {/* Breadcrumb */}
        <Breadcrumb 
          segments={[
            { label: 'Dashboard', path: '/' },
            { 
              label: activeTab === 'recommendations' ? 'Recomendações' : 
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
        
        {/* Status Banner */}
        {error && (
          <div style={{
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={20} color="#dc2626" />
            <span style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: '500' }}>
              {error}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '0.25rem' : '0.5rem',
          marginBottom: isMobile ? '1rem' : '2rem',
          backgroundColor: theme.cardBg,
          padding: isMobile ? '0.25rem' : '0.5rem',
          borderRadius: '12px',
          boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <button
            onClick={() => setActiveTab('recommendations')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'recommendations' ? '#3b82f6' : 'transparent',
              color: activeTab === 'recommendations' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'recommendations' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <TrendingUp size={isMobile ? 16 : 18} />
            {isMobile ? 'Rec.' : 'Recomendações'}
          </button>
          
          <button
            onClick={() => setActiveTab('performance')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'performance' ? '#3b82f6' : 'transparent',
              color: activeTab === 'performance' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'performance' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <CheckCircle size={isMobile ? 16 : 18} />
            {isMobile ? 'Perf.' : 'Performance'}
          </button>
          
          <button
            onClick={() => setActiveTab('validation')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'validation' ? '#3b82f6' : 'transparent',
              color: activeTab === 'validation' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'validation' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <CheckCircle size={isMobile ? 16 : 18} />
            {isMobile ? 'Valid.' : 'Validação'}
          </button>
          
          <button
            onClick={() => setActiveTab('costs')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'costs' ? '#3b82f6' : 'transparent',
              color: activeTab === 'costs' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'costs' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <DollarSign size={isMobile ? 16 : 18} />
            Custos
          </button>
          
          <button
            onClick={() => setActiveTab('dataQuality')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'dataQuality' ? '#3b82f6' : 'transparent',
              color: activeTab === 'dataQuality' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'dataQuality' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <CheckCircle size={isMobile ? 16 : 18} />
            {isMobile ? 'Quality' : 'Data Quality'}
          </button>
          
          <button
            onClick={() => setActiveTab('driftDetection')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'driftDetection' ? '#3b82f6' : 'transparent',
              color: activeTab === 'driftDetection' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'driftDetection' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <TrendingDown size={isMobile ? 16 : 18} />
            {isMobile ? 'Drift' : 'Drift Detection'}
          </button>
          
          <button
            onClick={() => setActiveTab('explainability')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'explainability' ? '#3b82f6' : 'transparent',
              color: activeTab === 'explainability' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'explainability' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <Info size={isMobile ? 16 : 18} />
            {isMobile ? 'Explain' : 'Explainability'}
          </button>
          
          <button
            onClick={() => setActiveTab('backtesting')}
            style={{
              flex: 1,
              minWidth: isMobile ? '100px' : 'auto',
              padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
              background: activeTab === 'backtesting' ? '#3b82f6' : 'transparent',
              color: activeTab === 'backtesting' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.8125rem' : '0.9375rem',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'backtesting' ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap'
            }}
          >
            <BarChart3 size={isMobile ? 16 : 18} />
            {isMobile ? 'Backtest' : 'Backtesting'}
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            backgroundColor: theme.cardBg,
            padding: '4rem 2rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <RefreshCw
              size={40}
              color="#3b82f6"
              style={{
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }}
            />
            <p style={{ color: theme.textSecondary, margin: 0, fontSize: '0.9375rem' }}>
              Carregando dados...
            </p>
          </div>
        )}

        {/* Recommendations Tab */}
        {!loading && activeTab === 'recommendations' && (
          <div>
            {/* KPIs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: isMobile ? '1rem' : '1.25rem',
              marginBottom: isMobile ? '1.5rem' : '2rem'
            }}>
              {recommendations.length > 0 && (() => {
                const validReturns = recommendations
                  .map(r => ({ ticker: r.ticker, return: r.exp_return_20 }))
                  .filter(item => item.return !== null && item.return !== undefined && !isNaN(item.return));
                
                const returns = validReturns.map(item => item.return);
                const positiveReturns = returns.filter(val => val > 0);
                const negativeReturns = returns.filter(val => val < 0);
                
                const maxReturn = returns.length > 0 ? Math.max(...returns) : 0;
                const minReturn = returns.length > 0 ? Math.min(...returns) : 0;
                const avgPositive = positiveReturns.length > 0
                  ? positiveReturns.reduce((acc, val) => acc + val, 0) / positiveReturns.length
                  : 0;
                const avgNegative = negativeReturns.length > 0
                  ? negativeReturns.reduce((acc, val) => acc + val, 0) / negativeReturns.length
                  : 0;
                
                const bestTicker = validReturns.find(item => item.return === maxReturn)?.ticker || 'N/A';
                const worstTicker = validReturns.find(item => item.return === minReturn)?.ticker || 'N/A';

                return (
                  <>
                    <TemporalKPICard
                      title="Total de Ativos"
                      current={recommendations.length}
                      previous={previousRecommendations?.length || recommendations.length}
                      icon={<CheckCircle size={18} />}
                    />

                    <TemporalKPICard
                      title="Melhor Ativo"
                      current={maxReturn}
                      previous={maxReturn}
                      unit="%"
                      format={(v) => `${bestTicker} (${(v * 100).toFixed(2)}%)`}
                      icon={<ArrowUpRight size={18} />}
                    />

                    <TemporalKPICard
                      title="Pior Ativo"
                      current={minReturn}
                      previous={minReturn}
                      unit="%"
                      format={(v) => `${worstTicker} (${(v * 100).toFixed(2)}%)`}
                      icon={<ArrowDownRight size={18} />}
                    />

                    <TemporalKPICard
                      title="Ativos Positivos"
                      current={positiveReturns.length}
                      previous={positiveReturns.length}
                      subtitle={`Média: ${formatPercent(avgPositive)}`}
                      icon={<ArrowUpRight size={18} />}
                    />

                    <TemporalKPICard
                      title="Ativos Negativos"
                      current={negativeReturns.length}
                      previous={negativeReturns.length}
                      subtitle={`Média: ${formatPercent(avgNegative)}`}
                      icon={<ArrowDownRight size={18} />}
                    />
                  </>
                );
              })()}
            </div>

            {/* Gráficos de Performance por Ticker */}
            {recommendationsHistory.tickers && recommendationsHistory.tickers.length > 0 && (
              <div style={{
                backgroundColor: theme.cardBg,
                borderRadius: '12px',
                padding: isMobile ? '1rem' : '1.5rem',
                marginBottom: isMobile ? '1.5rem' : '2rem',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: isMobile ? '1.125rem' : '1.25rem', fontWeight: '700', color: theme.text }}>
                  Evolução por Ticker (30 dias)
                </h2>
                
                {/* Seletor de Tickers - Simplificado */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.5rem',
                    maxHeight: isMobile ? '120px' : '150px',
                    overflowY: 'auto',
                    padding: '0.75rem',
                    backgroundColor: theme.tableBg,
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    {recommendationsHistory.tickers.slice(0, 20).map(ticker => {
                      const isSelected = selectedTickers.includes(ticker);
                      return (
                        <button
                          key={ticker}
                          onClick={() => {
                            const maxTickers = isMobile ? 3 : 5;
                            if (isSelected) {
                              setSelectedTickers(selectedTickers.filter(t => t !== ticker));
                            } else if (selectedTickers.length < maxTickers) {
                              setSelectedTickers([...selectedTickers, ticker]);
                            }
                          }}
                          style={{
                            padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
                            backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                            color: isSelected ? 'white' : theme.text,
                            border: `1px solid ${isSelected ? '#3b82f6' : theme.border}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: isMobile ? '0.8125rem' : '0.875rem',
                            fontWeight: isSelected ? '600' : '500',
                            transition: 'all 0.2s',
                            WebkitTapHighlightColor: 'transparent'
                          }}
                        >
                          {ticker}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: isMobile ? '0.75rem' : '0.8125rem', color: theme.textSecondary, textAlign: 'center' }}>
                    {selectedTickers.length} de {isMobile ? '3' : '5'} selecionados
                  </p>
                </div>

                {selectedTickers.length > 0 && (() => {
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

                  return (
                    <div>
                      <h3 style={{ margin: '0 0 1rem 0', fontSize: isMobile ? '0.9375rem' : '1rem', fontWeight: '600', color: theme.text }}>
                        Retorno Esperado e Score
                      </h3>
                      
                      {/* Legenda */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '1rem' : '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {selectedTickers.map((ticker, idx) => (
                          <div key={ticker} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ 
                              width: '16px', 
                              height: '3px', 
                              backgroundColor: colors[idx % colors.length],
                              borderRadius: '2px'
                            }} />
                            <span style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', fontWeight: '500', color: theme.text }}>
                              {ticker}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Gráfico Unificado */}
                      <div 
                        style={{ position: 'relative', height: isMobile ? '250px' : '350px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                        onMouseLeave={() => setTooltipData(null)}
                      >
                        {/* Tooltip HTML */}
                        {tooltipData && (
                          <div style={{
                            position: 'absolute',
                            left: tooltipData.x > 500 ? `${(tooltipData.x / 1000) * 100 - 20}%` : `${(tooltipData.x / 1000) * 100 + 5}%`,
                            top: '10%',
                            backgroundColor: theme.cardBg,
                            border: `2px solid ${theme.border}`,
                            borderRadius: '8px',
                            padding: '0.75rem',
                            boxShadow: darkMode ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '180px',
                            pointerEvents: 'none'
                          }}>
                            <div style={{ 
                              fontSize: isMobile ? '0.75rem' : '0.8125rem', 
                              fontWeight: '600', 
                              color: theme.text,
                              marginBottom: '0.5rem',
                              paddingBottom: '0.5rem',
                              borderBottom: `1px solid ${theme.border}`
                            }}>
                              {new Date(tooltipData.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </div>
                            {tooltipData.tickers.map((t, idx) => (
                              <div key={idx} style={{ marginBottom: idx < tooltipData.tickers.length - 1 ? '0.5rem' : 0 }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.5rem',
                                  marginBottom: '0.25rem'
                                }}>
                                  <div style={{ 
                                    width: '12px', 
                                    height: '12px', 
                                    backgroundColor: t.color,
                                    borderRadius: '2px'
                                  }} />
                                  <span style={{ 
                                    fontSize: isMobile ? '0.75rem' : '0.8125rem', 
                                    fontWeight: '600', 
                                    color: theme.text 
                                  }}>
                                    {t.ticker}
                                  </span>
                                </div>
                                <div style={{ paddingLeft: '1.25rem' }}>
                                  <div style={{ 
                                    fontSize: isMobile ? '0.6875rem' : '0.75rem', 
                                    color: theme.textSecondary,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '1rem'
                                  }}>
                                    <span>Retorno:</span>
                                    <span style={{ 
                                      fontWeight: '600',
                                      color: t.return > 0 ? '#10b981' : '#dc2626'
                                    }}>
                                      {formatPercent(t.return)}
                                    </span>
                                  </div>
                                  <div style={{ 
                                    fontSize: isMobile ? '0.6875rem' : '0.75rem', 
                                    color: theme.textSecondary,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '1rem'
                                  }}>
                                    <span>Score:</span>
                                    <span style={{ fontWeight: '600', color: theme.text }}>
                                      {t.score.toFixed(4)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <svg 
                          width={isMobile ? '100%' : '100%'} 
                          height="100%" 
                          viewBox="0 0 1000 350" 
                          preserveAspectRatio="xMidYMid meet" 
                          style={{ overflow: 'visible' }}
                        >
                          {(() => {
                            const width = 1000;
                            const height = 350;
                            const padding = { top: 30, right: 70, bottom: 50, left: 70 };
                            const chartWidth = width - padding.left - padding.right;
                            const chartHeight = height - padding.top - padding.bottom;
                            
                            // Coletar dados
                            let allReturns = [];
                            let allScores = [];
                            let allDates = new Set();
                            
                            selectedTickers.forEach(ticker => {
                              const data = recommendationsHistory.data[ticker] || [];
                              data.forEach(d => {
                                allReturns.push(d.exp_return_20);
                                allScores.push(d.score);
                                allDates.add(d.date);
                              });
                            });
                            
                            const dates = Array.from(allDates).sort();
                            
                            // Escalas para retorno (eixo Y esquerdo)
                            const maxReturn = Math.max(...allReturns, 0);
                            const minReturn = Math.min(...allReturns, 0);
                            const rangeReturn = maxReturn - minReturn || 1;
                            
                            // Escalas para score (eixo Y direito)
                            const maxScore = Math.max(...allScores, 1);
                            const minScore = Math.min(...allScores, 0);
                            const rangeScore = maxScore - minScore || 1;
                            
                            const scaleYReturn = (value) => padding.top + chartHeight - ((value - minReturn) / rangeReturn) * chartHeight;
                            const scaleYScore = (value) => padding.top + chartHeight - ((value - minScore) / rangeScore) * chartHeight;
                            const scaleX = (dateIndex) => padding.left + (dateIndex / (dates.length - 1 || 1)) * chartWidth;
                            
                            return (
                              <g>
                                {/* Grid horizontal */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                  const y = padding.top + chartHeight * ratio;
                                  return (
                                    <line
                                      key={i}
                                      x1={padding.left}
                                      y1={y}
                                      x2={padding.left + chartWidth}
                                      y2={y}
                                      stroke={darkMode ? '#334155' : '#e2e8f0'}
                                      strokeWidth="1"
                                      strokeDasharray="4 2"
                                    />
                                  );
                                })}
                                
                                {/* Eixo Y esquerdo (Retorno) */}
                                <text
                                  x={padding.left - 50}
                                  y={padding.top - 10}
                                  fill={theme.textSecondary}
                                  fontSize="12"
                                  fontWeight="600"
                                >
                                  Retorno (%)
                                </text>
                                {[0, 0.5, 1].map((ratio, i) => {
                                  const y = padding.top + chartHeight * ratio;
                                  const value = maxReturn - (rangeReturn * ratio);
                                  return (
                                    <text
                                      key={i}
                                      x={padding.left - 10}
                                      y={y + 4}
                                      textAnchor="end"
                                      fill={theme.textSecondary}
                                      fontSize="11"
                                    >
                                      {(value * 100).toFixed(1)}
                                    </text>
                                  );
                                })}
                                
                                {/* Eixo Y direito (Score) */}
                                <text
                                  x={padding.left + chartWidth + 50}
                                  y={padding.top - 10}
                                  fill={theme.textSecondary}
                                  fontSize="12"
                                  fontWeight="600"
                                  textAnchor="middle"
                                >
                                  Score
                                </text>
                                {[0, 0.5, 1].map((ratio, i) => {
                                  const y = padding.top + chartHeight * ratio;
                                  const value = maxScore - (rangeScore * ratio);
                                  return (
                                    <text
                                      key={i}
                                      x={padding.left + chartWidth + 10}
                                      y={y + 4}
                                      textAnchor="start"
                                      fill={theme.textSecondary}
                                      fontSize="11"
                                    >
                                      {value.toFixed(3)}
                                    </text>
                                  );
                                })}
                                
                                {/* Linha zero para retorno */}
                                {minReturn < 0 && maxReturn > 0 && (
                                  <line
                                    x1={padding.left}
                                    y1={scaleYReturn(0)}
                                    x2={padding.left + chartWidth}
                                    y2={scaleYReturn(0)}
                                    stroke={darkMode ? '#64748b' : '#94a3b8'}
                                    strokeWidth="2"
                                    strokeDasharray="6 3"
                                  />
                                )}
                                
                                {/* Linhas dos tickers - Retorno (sólido) */}
                                {selectedTickers.map((ticker, tickerIdx) => {
                                  const tickerData = recommendationsHistory.data[ticker] || [];
                                  const color = colors[tickerIdx % colors.length];
                                  
                                  const path = tickerData.map((d, i) => {
                                    const dateIndex = dates.indexOf(d.date);
                                    if (dateIndex === -1) return '';
                                    const x = scaleX(dateIndex);
                                    const y = scaleYReturn(d.exp_return_20);
                                    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                                  }).join(' ');
                                  
                                  return (
                                    <g key={`return-${ticker}`}>
                                      <path
                                        d={path}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth="2.5"
                                      />
                                    </g>
                                  );
                                })}
                                
                                {/* Linhas dos tickers - Score (tracejado) */}
                                {selectedTickers.map((ticker, tickerIdx) => {
                                  const tickerData = recommendationsHistory.data[ticker] || [];
                                  const color = colors[tickerIdx % colors.length];
                                  
                                  const path = tickerData.map((d, i) => {
                                    const dateIndex = dates.indexOf(d.date);
                                    if (dateIndex === -1) return '';
                                    const x = scaleX(dateIndex);
                                    const y = scaleYScore(d.score);
                                    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                                  }).join(' ');
                                  
                                  return (
                                    <path
                                      key={`score-${ticker}`}
                                      d={path}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth="1.5"
                                      strokeDasharray="4 2"
                                      opacity="0.6"
                                    />
                                  );
                                })}
                                
                                {/* Áreas invisíveis para hover - uma por data */}
                                {dates.map((date, dateIdx) => {
                                  const x = scaleX(dateIdx);
                                  const prevX = dateIdx > 0 ? scaleX(dateIdx - 1) : padding.left;
                                  const nextX = dateIdx < dates.length - 1 ? scaleX(dateIdx + 1) : padding.left + chartWidth;
                                  const areaWidth = (nextX - prevX) / 2 + (x - prevX) / 2;
                                  const areaX = x - areaWidth / 2;
                                  
                                  return (
                                    <rect
                                      key={`hover-${dateIdx}`}
                                      x={areaX}
                                      y={padding.top}
                                      width={areaWidth}
                                      height={chartHeight}
                                      fill="transparent"
                                      style={{ cursor: 'crosshair' }}
                                      onMouseEnter={() => {
                                        const tickersData = selectedTickers.map((ticker, idx) => {
                                          const tickerData = recommendationsHistory.data[ticker] || [];
                                          const dataPoint = tickerData.find(d => d.date === date);
                                          return {
                                            ticker,
                                            color: colors[idx % colors.length],
                                            return: dataPoint?.exp_return_20,
                                            score: dataPoint?.score
                                          };
                                        }).filter(d => d.return !== undefined);
                                        
                                        if (tickersData.length > 0) {
                                          setTooltipData({
                                            date,
                                            x,
                                            tickers: tickersData
                                          });
                                        }
                                      }}
                                    />
                                  );
                                })}
                                
                                {/* Linha vertical do tooltip */}
                                {tooltipData && (
                                  <>
                                    <line
                                      x1={tooltipData.x}
                                      y1={padding.top}
                                      x2={tooltipData.x}
                                      y2={padding.top + chartHeight}
                                      stroke={darkMode ? '#94a3b8' : '#64748b'}
                                      strokeWidth="1.5"
                                      strokeDasharray="4 2"
                                    />
                                    {/* Pontos nos valores */}
                                    {tooltipData.tickers.map((t, idx) => (
                                      <g key={idx}>
                                        <circle
                                          cx={tooltipData.x}
                                          cy={scaleYReturn(t.return)}
                                          r="5"
                                          fill={t.color}
                                          stroke="white"
                                          strokeWidth="2"
                                        />
                                        <circle
                                          cx={tooltipData.x}
                                          cy={scaleYScore(t.score)}
                                          r="4"
                                          fill={t.color}
                                          stroke="white"
                                          strokeWidth="1.5"
                                          opacity="0.8"
                                        />
                                      </g>
                                    ))}
                                  </>
                                )}
                                
                                {/* Eixo X - datas */}
                                {dates.filter((_, i) => i % Math.ceil(dates.length / 5) === 0).map((date, i) => {
                                  const index = dates.indexOf(date);
                                  const x = scaleX(index);
                                  const d = new Date(date);
                                  const label = `${d.getDate()}/${d.getMonth() + 1}`;
                                  return (
                                    <text
                                      key={i}
                                      x={x}
                                      y={padding.top + chartHeight + 25}
                                      textAnchor="middle"
                                      fill={theme.textSecondary}
                                      fontSize="11"
                                    >
                                      {label}
                                    </text>
                                  );
                                })}
                                
                                {/* Legenda do gráfico */}
                                <g transform={`translate(${padding.left + 10}, ${padding.top + 10})`}>
                                  <rect width="140" height="50" fill={theme.cardBg} opacity="0.95" rx="4" />
                                  <line x1="10" y1="15" x2="30" y2="15" stroke={theme.text} strokeWidth="2.5" />
                                  <text x="35" y="19" fill={theme.text} fontSize="11">Retorno (sólido)</text>
                                  <line x1="10" y1="35" x2="30" y2="35" stroke={theme.text} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6" />
                                  <text x="35" y="39" fill={theme.text} fontSize="11">Score (tracejado)</text>
                                </g>
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Recommendations Table */}
            <div style={{
              backgroundColor: theme.cardBg,
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: isMobile ? '1rem' : '1.5rem', borderBottom: `1px solid ${theme.border}` }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? '1.125rem' : '1.25rem', fontWeight: '700', color: theme.text }}>
                  Top 20 Recomendações
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: theme.textSecondary, fontSize: isMobile ? '0.8125rem' : '0.875rem' }}>
                  Ativos ranqueados por retorno esperado
                </p>
              </div>

              {recommendations.length === 0 ? (
                <div style={{ padding: isMobile ? '2rem 1rem' : '3rem 2rem', textAlign: 'center' }}>
                  <TrendingDown size={isMobile ? 40 : 48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ color: theme.textSecondary, margin: 0, fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                    Nenhuma recomendação disponível no momento
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '500px' : 'auto' }}>
                    <thead>
                      <tr style={{ backgroundColor: theme.tableBg, borderBottom: `1px solid ${theme.border}` }}>
                        <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'left', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Rank
                        </th>
                        <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'left', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Ticker
                        </th>
                        <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Retorno
                        </th>
                        <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations
                        .sort((a, b) => {
                          const returnA = a.exp_return_20 || 0;
                          const returnB = b.exp_return_20 || 0;
                          return returnB - returnA;
                        })
                        .slice(0, 20)
                        .map((rec, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: `1px solid ${theme.border}`,
                            transition: 'background-color 0.15s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', fontSize: isMobile ? '0.8125rem' : '0.875rem', color: theme.textSecondary, fontWeight: '500' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', fontSize: isMobile ? '0.875rem' : '0.9375rem', fontWeight: '600', color: theme.text }}>
                            {rec.ticker}
                          </td>
                          <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right' }}>
                            {rec.exp_return_20 !== null && rec.exp_return_20 !== undefined && !isNaN(rec.exp_return_20) ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: isMobile ? '0.25rem 0.5rem' : '0.25rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                fontWeight: '600',
                                backgroundColor: rec.exp_return_20 > 0 ? '#dcfce7' : '#fee2e2',
                                color: rec.exp_return_20 > 0 ? '#166534' : '#991b1b'
                              }}>
                                {rec.exp_return_20 > 0 ? <ArrowUpRight size={isMobile ? 12 : 14} /> : <ArrowDownRight size={isMobile ? 12 : 14} />}
                                {formatPercent(rec.exp_return_20)}
                              </span>
                            ) : (
                              <span style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', color: theme.textSecondary }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right', fontSize: isMobile ? '0.8125rem' : '0.875rem', color: theme.textSecondary, fontWeight: '500' }}>
                            {rec.score?.toFixed(4) || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {!loading && activeTab === 'performance' && (
          <div>
            {performance && performance.latest && (
              <>
                {/* Performance KPIs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: isMobile ? '1rem' : '1.25rem',
                  marginBottom: isMobile ? '1.5rem' : '2rem'
                }}>
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        MAPE
                      </span>
                      <TrendingDown size={isMobile ? 16 : 18} color={performance.latest.mape < 0.15 ? '#10b981' : '#f59e0b'} />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {formatPercent(performance.latest.mape || 0)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      Erro Médio Absoluto
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        Acurácia Direcional
                      </span>
                      <CheckCircle size={isMobile ? 16 : 18} color={performance.latest.directional_accuracy > 0.5 ? '#10b981' : '#dc2626'} />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {formatPercent(performance.latest.directional_accuracy || 0)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      Previsão de Direção
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        Sharpe Ratio
                      </span>
                      <TrendingUp size={isMobile ? 16 : 18} color={performance.latest.sharpe_ratio > 1 ? '#10b981' : '#f59e0b'} />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {(performance.latest.sharpe_ratio || 0).toFixed(2)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      Retorno Ajustado ao Risco
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        Hit Rate
                      </span>
                      <CheckCircle size={isMobile ? 16 : 18} color={performance.latest.hit_rate > 0.5 ? '#10b981' : '#dc2626'} />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {formatPercent(performance.latest.hit_rate || 0)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      Taxa de Acerto
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        MAE
                      </span>
                      <TrendingDown size={isMobile ? 16 : 18} color='#3b82f6' />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {(performance.latest.mae || 0).toFixed(4)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      Erro Absoluto Médio
                    </p>
                  </div>
                </div>

                {/* Gráfico de Evolução de Performance */}
                {performance.time_series && performance.time_series.mape && performance.time_series.mape.length > 0 && performance.time_series.directional_accuracy && performance.time_series.directional_accuracy.length > 0 && (
                  <div style={{
                    backgroundColor: theme.cardBg,
                    borderRadius: '12px',
                    padding: isMobile ? '1rem' : '1.5rem',
                    marginBottom: isMobile ? '1.5rem' : '2rem',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <h2 style={{ margin: '0 0 1.5rem 0', fontSize: isMobile ? '1.125rem' : '1.25rem', fontWeight: '700', color: theme.text }}>
                      Evolução de Performance (30 dias)
                    </h2>
                    
                    {/* Gráfico MAPE */}
                    <div style={{ marginBottom: isMobile ? '1.5rem' : '2rem' }}>
                      <h3 style={{ margin: '0 0 1rem 0', fontSize: isMobile ? '0.9375rem' : '1rem', fontWeight: '600', color: theme.text }}>
                        MAPE ao Longo do Tempo
                      </h3>
                      <div style={{ position: 'relative', height: isMobile ? '200px' : '250px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <svg width={isMobile ? '600px' : '100%'} height="100%" style={{ overflow: 'visible', minWidth: isMobile ? '600px' : 'auto' }}>
                          {(() => {
                            const width = 1000;
                            const height = 250;
                            const padding = { top: 20, right: 20, bottom: 40, left: 60 };
                            const chartWidth = width - padding.left - padding.right;
                            const chartHeight = height - padding.top - padding.bottom;
                            
                            const mapeData = performance.time_series.mape;
                            const values = mapeData.map(d => d.mape);
                            const maxValue = Math.max(...values);
                            const minValue = Math.min(...values);
                            const range = maxValue - minValue || 0.01;
                            
                            const scaleY = (value) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
                            const scaleX = (index) => padding.left + (index / (mapeData.length - 1 || 1)) * chartWidth;
                            
                            const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
                              const y = padding.top + chartHeight * ratio;
                              const value = maxValue - (range * ratio);
                              return { y, value };
                            });
                            
                            const path = mapeData.map((d, i) => {
                              const x = scaleX(i);
                              const y = scaleY(d.mape);
                              return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                            }).join(' ');
                            
                            return (
                              <g>
                                {gridLines.map((line, i) => (
                                  <g key={i}>
                                    <line
                                      x1={padding.left}
                                      y1={line.y}
                                      x2={padding.left + chartWidth}
                                      y2={line.y}
                                      stroke={darkMode ? '#334155' : '#e2e8f0'}
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={padding.left - 10}
                                      y={line.y + 4}
                                      textAnchor="end"
                                      fill={theme.textSecondary}
                                      fontSize="11"
                                    >
                                      {formatPercent(line.value)}
                                    </text>
                                  </g>
                                ))}
                                
                                <path
                                  d={path}
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="2"
                                />
                                
                                {mapeData.map((d, i) => (
                                  <circle
                                    key={i}
                                    cx={scaleX(i)}
                                    cy={scaleY(d.mape)}
                                    r="3"
                                    fill="#3b82f6"
                                  />
                                ))}
                                
                                {mapeData.filter((_, i) => i % Math.ceil(mapeData.length / 6) === 0).map((d, i) => {
                                  const index = mapeData.indexOf(d);
                                  const x = scaleX(index);
                                  const date = new Date(d.date);
                                  const label = `${date.getDate()}/${date.getMonth() + 1}`;
                                  return (
                                    <text
                                      key={i}
                                      x={x}
                                      y={padding.top + chartHeight + 20}
                                      textAnchor="middle"
                                      fill={theme.textSecondary}
                                      fontSize="11"
                                    >
                                      {label}
                                    </text>
                                  );
                                })}
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>

                    {/* Gráfico Acurácia Direcional */}
                    <div>
                      <h3 style={{ margin: '0 0 1rem 0', fontSize: isMobile ? '0.9375rem' : '1rem', fontWeight: '600', color: theme.text }}>
                        Acurácia Direcional ao Longo do Tempo
                      </h3>
                      <div style={{ position: 'relative', height: isMobile ? '200px' : '250px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <svg width={isMobile ? '600px' : '100%'} height="100%" style={{ overflow: 'visible', minWidth: isMobile ? '600px' : 'auto' }}>
                          {(() => {
                            const width = 1000;
                            const height = 250;
                            const padding = { top: 20, right: 20, bottom: 40, left: 60 };
                            const chartWidth = width - padding.left - padding.right;
                            const chartHeight = height - padding.top - padding.bottom;
                            
                            const accData = performance.time_series.directional_accuracy;
                            const values = accData.map(d => d.accuracy);
                            const maxValue = Math.max(...values, 1);
                            const minValue = Math.min(...values, 0);
                            const range = maxValue - minValue || 0.01;
                            
                            const scaleY = (value) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
                            const scaleX = (index) => padding.left + (index / (accData.length - 1 || 1)) * chartWidth;
                            
                            const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
                              const y = padding.top + chartHeight * ratio;
                              const value = maxValue - (range * ratio);
                              return { y, value };
                            });
                            
                            const path = accData.map((d, i) => {
                              const x = scaleX(i);
                              const y = scaleY(d.accuracy);
                              return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                            }).join(' ');
                            
                            return (
                              <g>
                                {gridLines.map((line, i) => (
                                  <g key={i}>
                                    <line
                                      x1={padding.left}
                                      y1={line.y}
                                      x2={padding.left + chartWidth}
                                      y2={line.y}
                                      stroke={darkMode ? '#334155' : '#e2e8f0'}
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={padding.left - 10}
                                      y={line.y + 4}
                                      textAnchor="end"
                                      fill={theme.textSecondary}
                                      fontSize="11"
                                    >
                                      {formatPercent(line.value)}
                                    </text>
                                  </g>
                                ))}
                                
                                <line
                                  x1={padding.left}
                                  y1={scaleY(0.5)}
                                  x2={padding.left + chartWidth}
                                  y2={scaleY(0.5)}
                                  stroke="#f59e0b"
                                  strokeWidth="2"
                                  strokeDasharray="4 4"
                                />
                                
                                <path
                                  d={path}
                                  fill="none"
                                  stroke="#10b981"
                                  strokeWidth="2"
                                />
                                
                                {accData.map((d, i) => (
                                  <circle
                                    key={i}
                                    cx={scaleX(i)}
                                    cy={scaleY(d.accuracy)}
                                    r="3"
                                    fill="#10b981"
                                  />
                                ))}
                                
                                {accData.filter((_, i) => i % Math.ceil(accData.length / 6) === 0).map((d, i) => {
                                  const index = accData.indexOf(d);
                                  const x = scaleX(index);
                                  const date = new Date(d.date);
                                  const label = `${date.getDate()}/${date.getMonth() + 1}`;
                                  return (
                                    <text
                                      key={i}
                                      x={x}
                                      y={padding.top + chartHeight + 20}
                                      textAnchor="middle"
                                      fill={theme.textSecondary}
                                      fontSize="11"
                                    >
                                      {label}
                                    </text>
                                  );
                                })}
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pesos do Ensemble */}
                {ensembleWeights && ensembleWeights.latest && ensembleWeights.latest.weights && (
                  <div style={{
                    backgroundColor: theme.cardBg,
                    borderRadius: '12px',
                    padding: isMobile ? '1rem' : '1.5rem',
                    marginBottom: isMobile ? '1.5rem' : '2rem',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <h2 style={{ margin: '0 0 1rem 0', fontSize: isMobile ? '1.125rem' : '1.25rem', fontWeight: '700', color: theme.text }}>
                      Pesos do Ensemble
                    </h2>
                    <p style={{ margin: '0 0 1.5rem 0', color: theme.textSecondary, fontSize: isMobile ? '0.8125rem' : '0.875rem' }}>
                      Contribuição de cada modelo no ensemble
                    </p>
                    
                    <div style={{ display: 'grid', gap: isMobile ? '0.75rem' : '1rem' }}>
                      {Object.entries(ensembleWeights.latest.weights)
                        .sort(([, a], [, b]) => b - a)
                        .map(([model, weight]) => (
                          <div key={model}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', fontWeight: '500', color: theme.text }}>
                                {model}
                              </span>
                              <span style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', fontWeight: '600', color: theme.text }}>
                                {formatPercent(weight)}
                              </span>
                            </div>
                            <div style={{
                              height: isMobile ? '6px' : '8px',
                              backgroundColor: darkMode ? '#334155' : '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${weight * 100}%`,
                                height: '100%',
                                backgroundColor: '#3b82f6',
                                borderRadius: '4px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {(!performance || !performance.latest) && (
              <div style={{
                backgroundColor: theme.cardBg,
                padding: isMobile ? '2rem 1rem' : '3rem 2rem',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <CheckCircle size={isMobile ? 40 : 48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: theme.text, margin: '0 0 0.5rem 0', fontSize: isMobile ? '1rem' : '1.125rem', fontWeight: '600' }}>
                  Dados de Performance em Preparação
                </p>
                <p style={{ color: theme.textSecondary, margin: 0, fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                  As métricas de performance serão calculadas após o primeiro ciclo de treinamento e validação dos modelos.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Validation Tab */}
        {!loading && activeTab === 'validation' && (
          <div>
            {validation && validation.summary && (
              <>
                {/* Validation KPIs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: isMobile ? '1rem' : '1.25rem',
                  marginBottom: isMobile ? '1.5rem' : '2rem'
                }}>
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        Total de Previsões
                      </span>
                      <CheckCircle size={isMobile ? 16 : 18} color="#3b82f6" />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {validation.summary.total_predictions}
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        Validações Completas
                      </span>
                      <CheckCircle size={isMobile ? 16 : 18} color="#10b981" />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: '#10b981' }}>
                      {validation.summary.completed_validations}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      {validation.summary.pending_validations} pendentes
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        Acurácia Direcional
                      </span>
                      <CheckCircle size={isMobile ? 16 : 18} color={validation.summary.directional_accuracy > 0.5 ? '#10b981' : '#dc2626'} />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {formatPercent(validation.summary.directional_accuracy)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      Direção Correta
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        Erro Médio Absoluto
                      </span>
                      <TrendingDown size={isMobile ? 16 : 18} color="#f59e0b" />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {formatPercent(validation.summary.mean_absolute_error)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      MAE
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: '500' }}>
                        RMSE
                      </span>
                      <TrendingDown size={isMobile ? 16 : 18} color="#f59e0b" />
                    </div>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                      {formatPercent(validation.summary.rmse)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: isMobile ? '0.6875rem' : '0.75rem', color: theme.textSecondary }}>
                      Root Mean Squared Error
                    </p>
                  </div>
                </div>

                {/* Validation Table */}
                <div style={{
                  backgroundColor: theme.cardBg,
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: isMobile ? '1rem' : '1.5rem', borderBottom: `1px solid ${theme.border}` }}>
                    <h2 style={{ margin: 0, fontSize: isMobile ? '1.125rem' : '1.25rem', fontWeight: '700', color: theme.text }}>
                      Esperado vs Realizado
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: theme.textSecondary, fontSize: isMobile ? '0.8125rem' : '0.875rem' }}>
                      Validação das previsões após 20 dias
                    </p>
                  </div>

                  {validation.validations && validation.validations.length > 0 ? (
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '600px' : 'auto' }}>
                        <thead>
                          <tr style={{ backgroundColor: theme.tableBg, borderBottom: `1px solid ${theme.border}` }}>
                            <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'left', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Ticker
                            </th>
                            <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'left', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Data Previsão
                            </th>
                            <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Esperado
                            </th>
                            <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Realizado
                            </th>
                            <th style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'center', fontSize: isMobile ? '0.6875rem' : '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {validation.validations.slice(0, 50).map((val, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: `1px solid ${theme.border}`,
                                transition: 'background-color 0.15s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', fontSize: isMobile ? '0.875rem' : '0.9375rem', fontWeight: '600', color: theme.text }}>
                                {val.ticker}
                              </td>
                              <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', fontSize: isMobile ? '0.8125rem' : '0.875rem', color: theme.textSecondary }}>
                                {new Date(val.prediction_date).toLocaleDateString('pt-BR')}
                              </td>
                              <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: isMobile ? '0.25rem 0.5rem' : '0.25rem 0.75rem',
                                  borderRadius: '6px',
                                  fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                  fontWeight: '600',
                                  backgroundColor: val.predicted_return > 0 ? '#dcfce7' : '#fee2e2',
                                  color: val.predicted_return > 0 ? '#166534' : '#991b1b'
                                }}>
                                  {val.predicted_return > 0 ? <ArrowUpRight size={isMobile ? 12 : 14} /> : <ArrowDownRight size={isMobile ? 12 : 14} />}
                                  {formatPercent(val.predicted_return)}
                                </span>
                              </td>
                              <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'right' }}>
                                {val.actual_return !== null ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: isMobile ? '0.25rem 0.5rem' : '0.25rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                    fontWeight: '600',
                                    backgroundColor: val.actual_return > 0 ? '#dcfce7' : '#fee2e2',
                                    color: val.actual_return > 0 ? '#166534' : '#991b1b'
                                  }}>
                                    {val.actual_return > 0 ? <ArrowUpRight size={isMobile ? 12 : 14} /> : <ArrowDownRight size={isMobile ? 12 : 14} />}
                                    {formatPercent(val.actual_return)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', color: theme.textSecondary }}>
                                    D+{val.days_elapsed}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', textAlign: 'center' }}>
                                {val.status === 'completed' ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: isMobile ? '0.25rem 0.5rem' : '0.25rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                    fontWeight: '600',
                                    backgroundColor: val.direction_correct ? '#dcfce7' : '#fee2e2',
                                    color: val.direction_correct ? '#166534' : '#991b1b'
                                  }}>
                                    {val.direction_correct ? '✓ Acertou' : '✗ Errou'}
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    padding: isMobile ? '0.25rem 0.5rem' : '0.25rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                    fontWeight: '600',
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e'
                                  }}>
                                    Pendente
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: isMobile ? '2rem 1rem' : '3rem 2rem', textAlign: 'center' }}>
                      <CheckCircle size={isMobile ? 40 : 48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                      <p style={{ color: theme.textSecondary, margin: 0, fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                        Nenhuma validação disponível
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {(!validation || !validation.summary) && (
              <div style={{
                backgroundColor: theme.cardBg,
                padding: isMobile ? '2rem 1rem' : '3rem 2rem',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <CheckCircle size={isMobile ? 40 : 48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: theme.text, margin: '0 0 0.5rem 0', fontSize: isMobile ? '1rem' : '1.125rem', fontWeight: '600' }}>
                  Validação em Andamento
                </p>
                <p style={{ color: theme.textSecondary, margin: 0, fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                  Os dados de validação estarão disponíveis após 20 dias das primeiras recomendações.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Costs Tab */}
        {!loading && activeTab === 'costs' && (
          <div>
            {costs && costs.latest && (
              <>
                {/* Cost KPIs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.875rem', fontWeight: '500' }}>
                        Custo Total (7 dias)
                      </span>
                      <DollarSign size={20} color="#3b82f6" />
                    </div>
                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: theme.text }}>
                      {formatCurrency(costs.latest.total_7_days?.brl || 0)}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
                      ${costs.latest.total_7_days?.usd?.toFixed(2) || '0.00'} USD
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.875rem', fontWeight: '500' }}>
                        Projeção Mensal
                      </span>
                      <TrendingUp size={20} color={costs.latest.threshold?.exceeded ? '#dc2626' : '#10b981'} />
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '2rem',
                      fontWeight: '700',
                      color: costs.latest.threshold?.exceeded ? '#dc2626' : '#0f172a'
                    }}>
                      {formatCurrency(costs.latest.monthly_projection?.brl || 0)}
                    </p>
                    {costs.latest.threshold?.exceeded && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#dc2626', fontWeight: '500' }}>
                        ⚠️ Acima do limite
                      </p>
                    )}
                  </div>
                </div>

                {/* Costs by Service */}
                <div style={{
                  backgroundColor: theme.cardBg,
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '1.5rem', borderBottom: `1px solid ${theme.border}` }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: theme.text }}>
                      Custos por Serviço AWS
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: theme.textSecondary, fontSize: '0.875rem' }}>
                      Últimos 7 dias
                    </p>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: theme.tableBg, borderBottom: `1px solid ${theme.border}` }}>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Serviço
                          </th>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Custo (USD)
                          </th>
                          <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            % do Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(costs.latest.costs_by_service || {})
                          .sort(([, a], [, b]) => b - a)
                          .map(([service, cost]) => {
                            const total = Object.values(costs.latest.costs_by_service).reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? (cost / total) * 100 : 0;
                            return (
                              <tr
                                key={service}
                                style={{
                                  borderBottom: `1px solid ${theme.border}`,
                                  transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.hover}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <td style={{ padding: '1rem 1.5rem', fontSize: '0.9375rem', fontWeight: '500', color: theme.text }}>
                                  {service}
                                </td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9375rem', fontWeight: '600', color: theme.text }}>
                                  ${cost.toFixed(2)}
                                </td>
                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <div style={{
                                      flex: '0 0 60px',
                                      height: '6px',
                                      backgroundColor: '#e2e8f0',
                                      borderRadius: '3px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${percentage}%`,
                                        height: '100%',
                                        backgroundColor: '#3b82f6',
                                        borderRadius: '3px'
                                      }} />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: theme.textSecondary, minWidth: '45px', textAlign: 'right' }}>
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!costs && (
              <div style={{
                backgroundColor: theme.cardBg,
                padding: '3rem 2rem',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <DollarSign size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: theme.textSecondary, margin: 0, fontSize: '0.9375rem' }}>
                  Nenhum dado de custo disponível
                </p>
              </div>
            )}
          </div>
        )}

        {/* Data Quality Tab */}
        {!loading && activeTab === 'dataQuality' && (
          <div>
            {dataQuality ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
                {/* KPI Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: isMobile ? '1rem' : '1.25rem'
                }}>
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        Overall Completeness
                      </span>
                      <CheckCircle size={18} color="#10b981" />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#10b981' }}>
                      {dataQuality.completeness ? (dataQuality.completeness.overallCompleteness * 100).toFixed(1) : 0}%
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        Anomalies Detected
                      </span>
                      <AlertTriangle size={18} color="#f59e0b" />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: theme.text }}>
                      {dataQuality.anomalies ? dataQuality.anomalies.totalAnomalies : 0}
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        Data Freshness
                      </span>
                      <CheckCircle size={18} color="#10b981" />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#10b981' }}>
                      {dataQuality.freshness ? (dataQuality.freshness.currentSourcesPercentage * 100).toFixed(0) : 0}%
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        Universe Coverage
                      </span>
                      <TrendingUp size={18} color="#10b981" />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#10b981' }}>
                      {dataQuality.coverage ? (dataQuality.coverage.coverageRate * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                {/* Completeness Summary */}
                {dataQuality.completeness && (
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.5rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                      Data Completeness by Ticker
                    </h3>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                      Date Range: {dataQuality.completeness.dateRange?.start} to {dataQuality.completeness.dateRange?.end}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary }}>
                      Tickers below 95%: {dataQuality.completeness.tickers?.filter(t => t.completenessRate < 0.95).length || 0}
                    </p>
                  </div>
                )}

                {/* Anomalies Summary */}
                {dataQuality.anomalies && (
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.5rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                      Detected Anomalies
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                          High Severity
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                          {dataQuality.anomalies.bySeverity?.high || 0}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                          Data Gaps
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
                          {dataQuality.anomalies.byType?.gap || 0}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                          Outliers
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
                          {dataQuality.anomalies.byType?.outlier || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Coverage Summary */}
                {dataQuality.coverage && (
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.5rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                      Universe Coverage
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                          Universe Size
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: theme.text }}>
                          {dataQuality.coverage.universeSize || 0}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                          Covered Tickers
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                          {dataQuality.coverage.coveredTickers || 0}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                          Excluded Tickers
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                          {dataQuality.coverage.excludedTickers?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                backgroundColor: theme.cardBg,
                padding: '2rem',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.9375rem' }}>
                  Nenhum dado de qualidade disponível
                </p>
              </div>
            )}
          </div>
        )}

        {/* Drift Detection Tab */}
        {!loading && activeTab === 'driftDetection' && (
          <div>
            {driftDetection ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
                {/* KPI Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: isMobile ? '1rem' : '1.25rem'
                }}>
                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        Drifted Features
                      </span>
                      <TrendingDown size={18} color="#f59e0b" />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: theme.text }}>
                      {driftDetection.drifted_features?.length || 0} / {driftDetection.all_features?.length || 0}
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
                      {driftDetection.all_features?.length > 0 
                        ? ((driftDetection.drifted_features?.length || 0) / driftDetection.all_features.length * 100).toFixed(1)
                        : 0}% of features
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        Performance Status
                      </span>
                      <AlertTriangle size={18} color={driftDetection.performance_drift ? '#dc2626' : '#10b981'} />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: driftDetection.performance_drift ? '#dc2626' : '#10b981' }}>
                      {driftDetection.performance_drift ? 'Degraded' : 'Stable'}
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        MAPE Change
                      </span>
                      <TrendingDown size={18} color={Math.abs(driftDetection.mape_change_percentage || 0) < 20 ? '#10b981' : '#dc2626'} />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: theme.text }}>
                      {driftDetection.mape_change_percentage >= 0 ? '+' : ''}{(driftDetection.mape_change_percentage || 0).toFixed(1)}%
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
                      vs baseline
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.cardBg,
                    padding: isMobile ? '1rem' : '1.25rem',
                    borderRadius: '12px',
                    boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: theme.textSecondary, fontSize: '0.8125rem', fontWeight: '500' }}>
                        Retraining Status
                      </span>
                      <RefreshCw size={18} color={
                        (driftDetection.drifted_features?.length || 0) / (driftDetection.all_features?.length || 1) > 0.3 || driftDetection.performance_drift
                          ? '#f59e0b'
                          : '#10b981'
                      } />
                    </div>
                    <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: theme.text }}>
                      {(driftDetection.drifted_features?.length || 0) / (driftDetection.all_features?.length || 1) > 0.3 || driftDetection.performance_drift
                        ? 'Recommended'
                        : 'Not Needed'}
                    </p>
                  </div>
                </div>

                {/* Drift Summary */}
                <div style={{
                  backgroundColor: theme.cardBg,
                  padding: isMobile ? '1rem' : '1.5rem',
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                    Drift Detection Summary
                  </h3>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                    Baseline MAPE: {formatPercent(driftDetection.baseline_mape || 0)}
                  </p>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: theme.textSecondary }}>
                    Current MAPE: {formatPercent(driftDetection.current_mape || 0)}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary }}>
                    Features with drift detected: {driftDetection.drifted_features?.length || 0}
                  </p>
                </div>

                {/* Placeholder sections for sub-tasks */}
                <div style={{
                  backgroundColor: theme.cardBg,
                  padding: isMobile ? '1rem' : '1.5rem',
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                    Data Drift Detection
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary, textAlign: 'center', padding: '2rem' }}>
                    Detailed drift charts will be implemented in sub-task 9.2
                  </p>
                </div>

                <div style={{
                  backgroundColor: theme.cardBg,
                  padding: isMobile ? '1rem' : '1.5rem',
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                    Concept Drift Detection
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary, textAlign: 'center', padding: '2rem' }}>
                    Concept drift heatmap will be implemented in sub-task 9.4
                  </p>
                </div>

                <div style={{
                  backgroundColor: theme.cardBg,
                  padding: isMobile ? '1rem' : '1.5rem',
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                    Performance Degradation Alerts
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary, textAlign: 'center', padding: '2rem' }}>
                    Degradation alerts will be implemented in sub-task 9.6
                  </p>
                </div>

                <div style={{
                  backgroundColor: theme.cardBg,
                  padding: isMobile ? '1rem' : '1.5rem',
                  borderRadius: '12px',
                  boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
                    Retraining Recommendations
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary, textAlign: 'center', padding: '2rem' }}>
                    Retraining recommendations will be implemented in sub-task 9.8
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: theme.cardBg,
                padding: '2rem',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.9375rem' }}>
                  Nenhum dado de drift detection disponível
                </p>
              </div>
            )}
          </div>
        )}

        {/* Explainability Tab */}
        {!loading && activeTab === 'explainability' && (
          <ExplainabilityTab darkMode={darkMode} />
        )}

        {/* Backtesting Tab */}
        {!loading && activeTab === 'backtesting' && (
          <BacktestingTab darkMode={darkMode} />
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: theme.cardBg,
          borderRadius: '12px',
          boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            {lastUpdate && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary }}>
                Última atualização: {lastUpdate.toLocaleString('pt-BR')}
              </p>
            )}
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              Atualização automática a cada 5 minutos
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: loading ? '#e2e8f0' : '#3b82f6',
              color: loading ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.2)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#2563eb';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Atualizando...' : 'Atualizar Agora'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
    </TemporalComparisonProvider>
  );
}

export default App;
