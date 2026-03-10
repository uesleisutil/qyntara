import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import Card from '../shared/Card';
import LoadingSpinner from '../shared/LoadingSpinner';

/**
 * Painel de Performance do Modelo
 * 
 * Mostra:
 * - MAPE diário (últimos 30 dias)
 * - Acurácia direcional
 * - Detecção de drift
 * - Necessidade de re-treino
 */
const ModelPerformancePanel = ({ s3Client, bucket }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    loadPerformanceData();
  }, [s3Client, bucket]);

  const loadPerformanceData = async () => {
    if (!s3Client || !bucket) return;

    try {
      setLoading(true);
      setError(null);

      // Listar arquivos de performance dos últimos 30 dias
      const prefix = 'monitoring/performance/';
      const response = await s3Client.listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 100
      }).promise();

      if (!response.Contents || response.Contents.length === 0) {
        setPerformanceData([]);
        setLoading(false);
        return;
      }

      // Carregar métricas de cada dia
      const metricsPromises = response.Contents
        .filter(obj => obj.Key.endsWith('metrics.json'))
        .slice(-30) // Últimos 30 arquivos
        .map(async (obj) => {
          try {
            const data = await s3Client.getObject({
              Bucket: bucket,
              Key: obj.Key
            }).promise();
            
            return JSON.parse(data.Body.toString('utf-8'));
          } catch (err) {
            console.error(`Erro ao carregar ${obj.Key}:`, err);
            return null;
          }
        });

      const metrics = (await Promise.all(metricsPromises))
        .filter(m => m !== null)
        .sort((a, b) => a.date.localeCompare(b.date));

      setPerformanceData(metrics);
      
      // Última métrica
      if (metrics.length > 0) {
        setCurrentMetrics(metrics[metrics.length - 1]);
      }

      // Carregar info do modelo
      await loadModelInfo();

      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar performance:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const loadModelInfo = async () => {
    try {
      // Listar modelos disponíveis
      const response = await s3Client.listObjectsV2({
        Bucket: bucket,
        Prefix: 'models/ensemble/',
        Delimiter: '/'
      }).promise();

      if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
        return;
      }

      // Pegar o mais recente
      const modelDates = response.CommonPrefixes
        .map(p => p.Prefix.split('/')[2])
        .filter(d => d && d.match(/^\d{4}-\d{2}-\d{2}$/))
        .sort()
        .reverse();

      if (modelDates.length === 0) return;

      const latestDate = modelDates[0];

      // Carregar métricas do modelo
      try {
        const metricsData = await s3Client.getObject({
          Bucket: bucket,
          Key: `models/ensemble/${latestDate}/metrics.json`
        }).promise();

        const modelMetrics = JSON.parse(metricsData.Body.toString('utf-8'));
        
        setModelInfo({
          date: latestDate,
          ...modelMetrics
        });
      } catch (err) {
        console.error('Erro ao carregar métricas do modelo:', err);
      }
    } catch (err) {
      console.error('Erro ao listar modelos:', err);
    }
  };

  const getStatusColor = (mape) => {
    if (!mape) return 'gray';
    if (mape < 10) return 'green';
    if (mape < 15) return 'blue';
    if (mape < 20) return 'yellow';
    return 'red';
  };

  const getStatusText = (mape) => {
    if (!mape) return 'N/A';
    if (mape < 10) return 'Excelente';
    if (mape < 15) return 'Bom';
    if (mape < 20) return 'Aceitável';
    return 'Crítico';
  };

  if (loading) {
    return (
      <Card title="Performance do Modelo">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Performance do Modelo">
        <div className="text-red-600">Erro: {error}</div>
      </Card>
    );
  }

  if (performanceData.length === 0) {
    return (
      <Card title="Performance do Modelo">
        <div className="text-gray-500">
          Sem dados de performance disponíveis. Aguarde validação das primeiras predições (20 dias após treino).
        </div>
      </Card>
    );
  }

  const avgMape = performanceData.reduce((sum, d) => sum + (d.mape || 0), 0) / performanceData.length;
  const avgDirectional = performanceData.reduce((sum, d) => sum + (d.directional_accuracy || 0), 0) / performanceData.length;

  return (
    <div className="space-y-6">
      {/* Métricas Atuais */}
      <Card title="Métricas Atuais">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* MAPE */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">MAPE Atual</div>
            <div className={`text-3xl font-bold text-${getStatusColor(currentMetrics?.mape)}-600`}>
              {currentMetrics?.mape ? `${currentMetrics.mape.toFixed(2)}%` : 'N/A'}
            </div>
            <div className={`text-xs mt-1 text-${getStatusColor(currentMetrics?.mape)}-600`}>
              {getStatusText(currentMetrics?.mape)}
            </div>
          </div>

          {/* Acurácia Direcional */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Acurácia Direcional</div>
            <div className="text-3xl font-bold text-blue-600">
              {currentMetrics?.directional_accuracy ? `${currentMetrics.directional_accuracy.toFixed(1)}%` : 'N/A'}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {currentMetrics?.directional_accuracy > 60 ? 'Excelente' : 
               currentMetrics?.directional_accuracy > 55 ? 'Bom' : 
               currentMetrics?.directional_accuracy > 50 ? 'Aceitável' : 'Ruim'}
            </div>
          </div>

          {/* MAE */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">MAE</div>
            <div className="text-3xl font-bold text-gray-700">
              {currentMetrics?.mae ? `R$ ${currentMetrics.mae.toFixed(2)}` : 'N/A'}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              Erro Absoluto Médio
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <div className={`text-2xl font-bold ${currentMetrics?.needs_retrain ? 'text-red-600' : 'text-green-600'}`}>
              {currentMetrics?.needs_retrain ? '⚠️ Re-treinar' : '✓ OK'}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {currentMetrics?.drift_detected ? 'Drift detectado' : 'Sem drift'}
            </div>
          </div>
        </div>
      </Card>

      {/* Gráfico de MAPE */}
      <Card title="MAPE - Últimos 30 Dias">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            />
            <YAxis 
              label={{ value: 'MAPE (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
              formatter={(value) => [`${value.toFixed(2)}%`, 'MAPE']}
            />
            <Legend />
            <ReferenceLine y={10} stroke="green" strokeDasharray="3 3" label="Excelente" />
            <ReferenceLine y={15} stroke="blue" strokeDasharray="3 3" label="Bom" />
            <ReferenceLine y={20} stroke="red" strokeDasharray="3 3" label="Crítico" />
            <Line 
              type="monotone" 
              dataKey="mape" 
              stroke="#8884d8" 
              strokeWidth={2}
              dot={{ r: 4 }}
              name="MAPE"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-gray-600">
          Média (30 dias): {avgMape.toFixed(2)}%
        </div>
      </Card>

      {/* Gráfico de Acurácia Direcional */}
      <Card title="Acurácia Direcional - Últimos 30 Dias">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            />
            <YAxis 
              label={{ value: 'Acurácia (%)', angle: -90, position: 'insideLeft' }}
              domain={[0, 100]}
            />
            <Tooltip 
              labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
              formatter={(value) => [`${value.toFixed(1)}%`, 'Acurácia']}
            />
            <Legend />
            <ReferenceLine y={50} stroke="gray" strokeDasharray="3 3" label="Aleatório" />
            <ReferenceLine y={60} stroke="green" strokeDasharray="3 3" label="Excelente" />
            <Line 
              type="monotone" 
              dataKey="directional_accuracy" 
              stroke="#82ca9d" 
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Acurácia Direcional"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-gray-600">
          Média (30 dias): {avgDirectional.toFixed(1)}%
        </div>
      </Card>

      {/* Info do Modelo */}
      {modelInfo && (
        <Card title="Informações do Modelo">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Data de Treino</div>
              <div className="text-lg font-semibold">
                {new Date(modelInfo.date).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">MAPE de Treino</div>
              <div className="text-lg font-semibold">
                {modelInfo.xgboost?.mape ? `${modelInfo.xgboost.mape.toFixed(2)}%` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">CV MAPE</div>
              <div className="text-lg font-semibold">
                {modelInfo.walk_forward_cv?.avg_mape ? `${modelInfo.walk_forward_cv.avg_mape.toFixed(2)}%` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Features Selecionadas</div>
              <div className="text-lg font-semibold">
                {modelInfo.feature_selection?.n_features_selected || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Amostras de Treino</div>
              <div className="text-lg font-semibold">
                {modelInfo.train_samples?.toLocaleString('pt-BR') || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Método</div>
              <div className="text-lg font-semibold">
                XGBoost + Walk-Forward CV
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Alerta de Re-treino */}
      {currentMetrics?.needs_retrain && (
        <Card>
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Re-treino Necessário
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    O modelo está com performance degradada. Motivos:
                  </p>
                  <ul className="list-disc list-inside mt-2">
                    {currentMetrics.mape > 20 && (
                      <li>MAPE muito alto ({currentMetrics.mape.toFixed(2)}% &gt; 20%)</li>
                    )}
                    {currentMetrics.drift_detected && (
                      <li>Drift detectado (performance degradou 50%)</li>
                    )}
                  </ul>
                  <p className="mt-2 font-mono text-xs bg-red-100 p-2 rounded">
                    aws lambda invoke --function-name TrainSageMaker --payload '&#123;"lookback_days": 365&#125;' output.json
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ModelPerformancePanel;
