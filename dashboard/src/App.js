// Dashboard v2.0.0 - MLOps Pipeline Completo - 2026-03-07
import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Database, 
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { validateCredentials, readS3Object, listS3Objects } from './utils/s3Config';
import RecommendationsTable from './components/RecommendationsTable';
import ModelQualityPanel from './components/ModelQualityPanel';
import IngestionStatusPanel from './components/IngestionStatusPanel';
import SystemStatusPanel from './components/SystemStatusPanel';
import ErrorBanner from './components/ErrorBanner';

function App() {
  const [recommendations, setRecommendations] = useState([]);
  const [qualityData, setQualityData] = useState([]);
  const [ingestionData, setIngestionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState('general');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Validate credentials on component mount
  useEffect(() => {
    const validation = validateCredentials();
    if (!validation.isValid) {
      setError(`Configuration error: Missing environment variables: ${validation.missingVars.join(', ')}`);
      setErrorType('config');
      setLoading(false);
    }
  }, []);

  // Carregar recomendações mais recentes
  const loadRecommendations = async () => {
    try {
      const objects = await listS3Objects('recommendations/');
      if (objects.length === 0) return;

      // Pegar o arquivo mais recente
      const latestObject = objects
        .filter(obj => obj.Key.endsWith('.json'))
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))[0];

      if (latestObject) {
        const data = await readS3Object(latestObject.Key);
        if (data && data.recommendations) {
          // Validate data structure
          if (!Array.isArray(data.recommendations)) {
            throw new Error('Invalid data format: recommendations is not an array');
          }
          setRecommendations(data.recommendations);
        }
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      throw error; // Re-throw to be caught by loadData
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
        .slice(0, 30); // Últimos 30 dias

      const qualityPromises = qualityFiles.map(obj => readS3Object(obj.Key));
      const qualityResults = await Promise.all(qualityPromises);
      
      const validQuality = qualityResults
        .filter(data => data && data.dt)
        .sort((a, b) => new Date(a.dt) - new Date(b.dt));
      
      setQualityData(validQuality);
    } catch (error) {
      console.error('Error loading quality data:', error);
      throw error; // Re-throw to be caught by loadData
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
        .slice(0, 48); // Últimas 48 horas

      const ingestionPromises = ingestionFiles.map(obj => readS3Object(obj.Key));
      const ingestionResults = await Promise.all(ingestionPromises);
      
      const validIngestion = ingestionResults
        .filter(data => data && data.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      setIngestionData(validIngestion);
    } catch (error) {
      console.error('Error loading ingestion data:', error);
      throw error; // Re-throw to be caught by loadData
    }
  };

  // Carregar todos os dados
  const loadData = useCallback(async () => {
    // Skip loading if there's a configuration error
    const validation = validateCredentials();
    if (!validation.isValid) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setErrorType('general');
    
    // Set up timeout warning (10 seconds)
    const timeoutWarning = setTimeout(() => {
      setError('A busca de dados está demorando mais que o esperado. Por favor, aguarde...');
      setErrorType('timeout');
    }, 10000);
    
    try {
      const results = await Promise.allSettled([
        loadRecommendations(),
        loadQualityData(),
        loadIngestionData(),
      ]);
      
      // Clear timeout warning if data loads successfully
      clearTimeout(timeoutWarning);
      
      // Check for any failures and categorize errors
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        // Get the first error to determine error type
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
        // Clear any timeout warnings if all data loaded successfully
        setError(null);
        setErrorType('general');
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      // Clear timeout warning
      clearTimeout(timeoutWarning);
      
      // Handle unexpected errors
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
    // Atualizar a cada 5 minutos
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Calcular métricas de qualidade atual
  const currentQuality = qualityData.length > 0 ? qualityData[qualityData.length - 1] : null;
  
  // Calcular taxa de sucesso da ingestão (últimas 24h) - for ingestion status panel
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
        <h1>B3 Tactical Ranking</h1>
        <p>Dashboard de Monitoramento MLOps - Mercado Brasileiro</p>
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

      <div className="dashboard-grid">
        {/* Recomendações Atuais */}
        <div className="card">
          <h3>
            <TrendingUp size={20} />
            Top 10 Recomendações
            {recommendations.length > 0 && (
              <span className="status-indicator status-good"></span>
            )}
          </h3>
          
          <RecommendationsTable recommendations={recommendations} />
        </div>

        {/* Qualidade do Modelo */}
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

        {/* Status da Ingestão */}
        <div className="card">
          <h3>
            <Database size={20} />
            Ingestão de Dados
            <span className={`status-indicator ${successRate >= 90 ? 'status-good' : successRate >= 70 ? 'status-warning' : 'status-critical'}`}></span>
          </h3>
          
          <IngestionStatusPanel ingestionData={ingestionData} />
        </div>

        {/* Status Geral do Sistema */}
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