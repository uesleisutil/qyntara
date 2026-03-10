// Dashboard v2.0.0 - MLOps Pipeline Completo - 2026-03-07
import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Database, 
  CheckCircle,
  RefreshCw,
  BarChart3,
  GitBranch,
  Zap,
  Target,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { validateCredentials, readS3Object, listS3Objects } from './utils/s3Config';

// Componentes básicos
import RecommendationsTable from './components/RecommendationsTable';
import ModelQualityPanel from './components/ModelQualityPanel';
import IngestionStatusPanel from './components/IngestionStatusPanel';
import SystemStatusPanel from './components/SystemStatusPanel';
import ErrorBanner from './components/ErrorBanner';

// Charts avançados
import MAPETimeSeriesChart from './components/charts/MAPETimeSeriesChart';
import PredictionIntervalChart from './components/charts/PredictionIntervalChart';
import FeatureImportanceChart from './components/charts/FeatureImportanceChart';
import DriftDetectionChart from './components/charts/DriftDetectionChart';
import EnsembleWeightsChart from './components/charts/EnsembleWeightsChart';
import ModelComparisonChart from './components/charts/ModelComparisonChart';

// Panels avançados
import ModelPerformancePanel from './components/panels/ModelPerformancePanel';
import EnsembleInsightsPanel from './components/panels/EnsembleInsightsPanel';
import DriftMonitoringPanel from './components/panels/DriftMonitoringPanel';
import FeatureAnalysisPanel from './components/panels/FeatureAnalysisPanel';
import HyperparameterPanel from './components/panels/HyperparameterPanel';
import ExplainabilityPanel from './components/panels/ExplainabilityPanel';
import ModelPerformancePanelNew from './components/panels/ModelPerformancePanel';
import { CostMonitoringPanel } from './components/panels/CostMonitoringPanel';
import { SageMakerMonitoringPanel } from './components/panels/SageMakerMonitoringPanel';

function App() {
  // Estados básicos
  const [recommendations, setRecommendations] = useState([]);
  const [qualityData, setQualityData] = useState([]);
  const [ingestionData, setIngestionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState('general');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Estados avançados para métricas de ML
  const [driftData, setDriftData] = useState([]);
  const [ensembleData, setEnsembleData] = useState(null);
  const [featureImportance, setFeatureImportance] = useState([]);
  const [hyperparameters, setHyperparameters] = useState(null);
  const [modelMetrics, setModelMetrics] = useState([]);
  const [predictionIntervals, setPredictionIntervals] = useState([]);
  
  // Estado para controlar visualização
  const [activeTab, setActiveTab] = useState('overview'); // overview, performance, monitoring, advanced, costs
  
  // Estado para S3 client (para novos painéis)
  const [s3Client, setS3Client] = useState(null);
  const [bucket, setBucket] = useState(null);
  
  useEffect(() => {
    // Inicializar S3 client
    const AWS = window.AWS;
    if (AWS) {
      const s3 = new AWS.S3({
        region: process.env.REACT_APP_AWS_REGION,
        credentials: new AWS.Credentials({
          accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
        })
      });
      setS3Client(s3);
      setBucket(process.env.REACT_APP_S3_BUCKET);
    }
  }, []);

  // Validate credentials on component mount
  useEffect(() => {
    const validation = validateCredentials();
    if (!validation.isValid) {
      setError(`Configuration error: Missing environment variables: ${validation.missingVars.join(', ')}`);
      setErrorType('config');
      setLoading(false);
    }
  }, []);

  // Carregar recomendações
  const loadRecommendations = async () => {
    try {
      const objects = await listS3Objects('recommendations/');
      if (objects.length === 0) return;

      const latestObject = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))[0];

      if (latestObject) {
        const data = await readS3Object(latestObject.Key);
        // API retorna 'items' para recomendações, não 'recommendations'
        if (data && (data.items || data.recommendations)) {
          setRecommendations(data.items || data.recommendations);
        }
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      throw error;
    }
  };

  // Carregar dados de qualidade
  const loadQualityData = async () => {
    try {
      const objects = await listS3Objects('monitoring/model_quality/');
      if (objects.length === 0) return;

      const qualityFiles = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
        .slice(0, 30);

      const qualityPromises = qualityFiles.map(obj => readS3Object(obj.Key));
      const qualityResults = await Promise.all(qualityPromises);
      
      const validQuality = qualityResults
        .filter(data => data && (data.dt || data.dt_eval))
        .map(data => ({
          ...data,
          dt: data.dt || data.dt_eval,
          status: data.ok ? 'good' : 'warning'
        }))
        .sort((a, b) => new Date(a.dt) - new Date(b.dt));
      
      setQualityData(validQuality);
    } catch (error) {
      console.error('Error loading quality data:', error);
      throw error;
    }
  };

  // Carregar dados de ingestão
  const loadIngestionData = async () => {
    try {
      const objects = await listS3Objects('monitoring/ingestion/');
      if (objects.length === 0) return;

      const ingestionFiles = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
        .slice(0, 48);

      const ingestionPromises = ingestionFiles.map(obj => readS3Object(obj.Key));
      const ingestionResults = await Promise.all(ingestionPromises);
      
      const validIngestion = ingestionResults
        .filter(data => data && (data.timestamp || data.ts_utc))
        .map(data => ({
          ...data,
          timestamp: data.timestamp || data.ts_utc,
          status: data.status || (data.ok ? 'success' : 'error'),
          records_ingested: data.records_ingested || 0
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      setIngestionData(validIngestion);
    } catch (error) {
      console.error('Error loading ingestion data:', error);
      throw error;
    }
  };

  // Carregar dados de drift
  const loadDriftData = async () => {
    try {
      const objects = await listS3Objects('monitoring/drift/');
      if (objects.length === 0) return;

      const driftFiles = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
        .slice(0, 30);

      const driftPromises = driftFiles.map(obj => readS3Object(obj.Key));
      const driftResults = await Promise.all(driftPromises);
      
      const validDrift = driftResults
        .filter(data => data && data.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      setDriftData(validDrift);
    } catch (error) {
      console.error('Error loading drift data:', error);
    }
  };

  // Carregar dados de ensemble
  const loadEnsembleData = async () => {
    try {
      const objects = await listS3Objects('models/ensemble/');
      if (objects.length === 0) return;

      const latestObject = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))[0];

      if (latestObject) {
        const data = await readS3Object(latestObject.Key);
        setEnsembleData(data);
      }
    } catch (error) {
      console.error('Error loading ensemble data:', error);
    }
  };

  // Carregar feature importance
  const loadFeatureImportance = async () => {
    try {
      const objects = await listS3Objects('features/importance/');
      if (objects.length === 0) return;

      const latestObject = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))[0];

      if (latestObject) {
        const data = await readS3Object(latestObject.Key);
        if (data && data.features) {
          setFeatureImportance(data.features);
        }
      }
    } catch (error) {
      console.error('Error loading feature importance:', error);
    }
  };

  // Carregar hiperparâmetros
  const loadHyperparameters = async () => {
    try {
      const objects = await listS3Objects('hyperparameters/');
      if (objects.length === 0) return;

      const latestObject = objects
        .filter(obj => obj.Key.includes('best_params') && obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))[0];

      if (latestObject) {
        const data = await readS3Object(latestObject.Key);
        setHyperparameters(data);
      }
    } catch (error) {
      console.error('Error loading hyperparameters:', error);
    }
  };

  // Carregar métricas de modelos
  const loadModelMetrics = async () => {
    try {
      const objects = await listS3Objects('models/metrics/');
      if (objects.length === 0) return;

      const metricsFiles = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
        .slice(0, 10);

      const metricsPromises = metricsFiles.map(obj => readS3Object(obj.Key));
      const metricsResults = await Promise.all(metricsPromises);
      
      const validMetrics = metricsResults.filter(data => data && data.model_name);
      setModelMetrics(validMetrics);
    } catch (error) {
      console.error('Error loading model metrics:', error);
    }
  };

  // Carregar intervalos de predição
  const loadPredictionIntervals = async () => {
    try {
      const objects = await listS3Objects('predictions/intervals/');
      if (objects.length === 0) return;

      const latestObject = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))[0];

      if (latestObject) {
        const data = await readS3Object(latestObject.Key);
        if (data && data.intervals) {
          setPredictionIntervals(data.intervals);
        }
      }
    } catch (error) {
      console.error('Error loading prediction intervals:', error);
    }
  };

  // Carregar todos os dados
  const loadData = useCallback(async () => {
    const validation = validateCredentials();
    if (!validation.isValid) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setErrorType('general');
    
    const timeoutWarning = setTimeout(() => {
      setError('A busca de dados está demorando mais que o esperado. Por favor, aguarde...');
      setErrorType('timeout');
    }, 10000);
    
    try {
      const results = await Promise.allSettled([
        loadRecommendations(),
        loadQualityData(),
        loadIngestionData(),
        loadDriftData(),
        loadEnsembleData(),
        loadFeatureImportance(),
        loadHyperparameters(),
        loadModelMetrics(),
        loadPredictionIntervals(),
      ]);
      
      clearTimeout(timeoutWarning);
      
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        const firstError = failures[0].reason;
        
        if (firstError && firstError.type) {
          setErrorType(firstError.type);
          setError(firstError.message);
        } else {
          setErrorType('general');
          setError('Alguns dados não puderam ser carregados. Dados anteriores foram preservados.');
        }
        
        console.error('Some data sources failed to load:', failures);
      } else {
        setError(null);
        setErrorType('general');
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      clearTimeout(timeoutWarning);
      console.error('Error loading data:', err);
      
      if (err.type) {
        setErrorType(err.type);
        setError(err.message);
      } else {
        setErrorType('general');
        setError(`Erro ao carregar dados: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Calcular métricas
  const currentQuality = qualityData.length > 0 ? qualityData[qualityData.length - 1] : null;
  const recentIngestion = ingestionData.filter(d => 
    new Date(d.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const successRate = recentIngestion.length > 0 
    ? (recentIngestion.filter(d => d.status === 'success').length / recentIngestion.length * 100)
    : 0;

  if (loading && !lastUpdated) {
    return (
      <div className="container">
        <div className="loading">
          <RefreshCw className="animate-spin" size={48} />
          <p>Carregando dados do dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>B3 Tactical Ranking - MLOps Dashboard</h1>
        <p>Monitoramento Completo de Performance e Métricas</p>
        {loading && (
          <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '1rem', color: '#3b82f6' }}>
            <RefreshCw className="animate-spin" size={20} style={{ marginRight: '0.5rem' }} />
            <span>Atualizando...</span>
          </div>
        )}
      </header>

      {error && (
        <ErrorBanner 
          error={error} 
          errorType={errorType}
          onDismiss={() => setError(null)}
        />
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
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'overview' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'overview' ? 'bold' : 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <TrendingUp size={20} />
          Visão Geral
        </button>
        
        <button
          onClick={() => setActiveTab('performance')}
          style={{
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'performance' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'performance' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'performance' ? 'bold' : 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <BarChart3 size={20} />
          Performance do Modelo
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
          onClick={() => setActiveTab('advanced')}
          style={{
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'advanced' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'advanced' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'advanced' ? 'bold' : 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Settings size={20} />
          Avançado
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
          <Activity size={20} />
          Custos & Performance
        </button>
      </div>

      {/* Conteúdo baseado na tab ativa */}
      {activeTab === 'overview' && (
        <div className="dashboard-grid">
          <div className="card">
            <h3>
              <TrendingUp size={20} />
              Top 50 Recomendações
              {recommendations.length > 0 && (
                <span className="status-indicator status-good"></span>
              )}
            </h3>
            <RecommendationsTable recommendations={recommendations} />
          </div>

          <div className="card">
            <h3>
              <Activity size={20} />
              Qualidade do Modelo
              {currentQuality && (
                <span className={`status-indicator status-${currentQuality.status}`}></span>
              )}
            </h3>
            <ModelQualityPanel qualityData={qualityData} />
          </div>

          <div className="card">
            <h3>
              <Database size={20} />
              Ingestão de Dados
              <span className={`status-indicator ${successRate >= 90 ? 'status-good' : successRate >= 70 ? 'status-warning' : 'status-critical'}`}></span>
            </h3>
            <IngestionStatusPanel ingestionData={ingestionData} />
          </div>

          <div className="card">
            <h3>
              <CheckCircle size={20} />
              Status do Sistema
            </h3>
            <SystemStatusPanel 
              recommendations={recommendations}
              qualityData={qualityData}
              ingestionData={ingestionData}
            />
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="dashboard-grid">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <Target size={20} />
              Performance Geral dos Modelos
            </h3>
            <ModelPerformancePanel 
              qualityData={qualityData}
              modelMetrics={modelMetrics}
            />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <BarChart3 size={20} />
              MAPE ao Longo do Tempo
            </h3>
            <MAPETimeSeriesChart data={qualityData} />
          </div>

          <div className="card">
            <h3>
              <GitBranch size={20} />
              Comparação de Modelos
            </h3>
            <ModelComparisonChart data={modelMetrics} />
          </div>

          <div className="card">
            <h3>
              <Zap size={20} />
              Intervalos de Predição
            </h3>
            <PredictionIntervalChart data={predictionIntervals} />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <GitBranch size={20} />
              Insights do Ensemble
            </h3>
            <EnsembleInsightsPanel data={ensembleData} />
          </div>

          <div className="card">
            <h3>
              <BarChart3 size={20} />
              Pesos do Ensemble
            </h3>
            <EnsembleWeightsChart data={ensembleData} />
          </div>
        </div>
      )}

      {activeTab === 'monitoring' && (
        <div className="dashboard-grid">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <AlertTriangle size={20} />
              Detecção de Drift
            </h3>
            <DriftMonitoringPanel data={driftData} />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <Activity size={20} />
              Drift ao Longo do Tempo
            </h3>
            <DriftDetectionChart data={driftData} />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <Zap size={20} />
              Importância das Features
            </h3>
            <FeatureImportanceChart data={featureImportance} />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <BarChart3 size={20} />
              Análise de Features
            </h3>
            <FeatureAnalysisPanel data={featureImportance} />
          </div>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="dashboard-grid">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <Settings size={20} />
              Hiperparâmetros Otimizados
            </h3>
            <HyperparameterPanel data={hyperparameters} />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>
              <Target size={20} />
              Explicabilidade das Predições
            </h3>
            <ExplainabilityPanel 
              featureImportance={featureImportance}
              recommendations={recommendations}
            />
          </div>
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="dashboard-grid">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <SageMakerMonitoringPanel s3Client={s3Client} bucket={bucket} />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <ModelPerformancePanelNew s3Client={s3Client} bucket={bucket} />
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <CostMonitoringPanel s3Client={s3Client} bucket={bucket} />
          </div>
        </div>
      )}

      {lastUpdated && (
        <div className="last-updated">
          Última atualização: {format(lastUpdated, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
          <button 
            onClick={loadData} 
            disabled={loading}
            style={{ 
              marginLeft: '1rem', 
              padding: '0.5rem 1rem', 
              background: loading ? '#94a3b8' : '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
