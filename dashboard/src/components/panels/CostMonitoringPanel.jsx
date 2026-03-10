import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Card from '../shared/Card';
import LoadingSpinner from '../shared/LoadingSpinner';

/**
 * Painel de Monitoramento de Custos
 * 
 * Mostra:
 * - Custo total mensal
 * - Breakdown por serviço
 * - Tendência de custos
 * - Alertas de orçamento
 */
export const CostMonitoringPanel = ({ s3Client, bucket }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [costData, setCostData] = useState(null);
  const [dailyCosts, setDailyCosts] = useState([]);

  useEffect(() => {
    loadCostData();
  }, [s3Client, bucket]);

  const loadCostData = async () => {
    if (!s3Client || !bucket) return;

    try {
      setLoading(true);
      setError(null);

      // Carregar relatório de custos mais recente
      const prefix = 'monitoring/costs/';
      const response = await s3Client.listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 50
      }).promise();

      if (!response.Contents || response.Contents.length === 0) {
        setCostData(null);
        setLoading(false);
        return;
      }

      // Pegar os últimos 30 relatórios
      const costFiles = response.Contents
        .filter(obj => obj.Key.endsWith('costs.json'))
        .sort((a, b) => b.LastModified - a.LastModified)
        .slice(0, 30);

      if (costFiles.length === 0) {
        setCostData(null);
        setLoading(false);
        return;
      }

      // Carregar último relatório
      const latestFile = costFiles[0];
      const data = await s3Client.getObject({
        Bucket: bucket,
        Key: latestFile.Key
      }).promise();

      const latestCost = JSON.parse(data.Body.toString('utf-8'));
      setCostData(latestCost);

      // Carregar custos diários
      const dailyPromises = costFiles.map(async (file) => {
        try {
          const fileData = await s3Client.getObject({
            Bucket: bucket,
            Key: file.Key
          }).promise();
          
          return JSON.parse(fileData.Body.toString('utf-8'));
        } catch (err) {
          console.error(`Erro ao carregar ${file.Key}:`, err);
          return null;
        }
      });

      const daily = (await Promise.all(dailyPromises))
        .filter(d => d !== null)
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyCosts(daily);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar custos:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card title="Monitoramento de Custos">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Monitoramento de Custos">
        <div className="text-red-600">Erro: {error}</div>
      </Card>
    );
  }

  if (!costData) {
    return (
      <Card title="Monitoramento de Custos">
        <div className="text-gray-500">
          Sem dados de custos disponíveis. O monitoramento roda diariamente às 08:00 UTC.
        </div>
      </Card>
    );
  }

  const totalCost = costData.total_cost || 0;
  const monthlyEstimate = costData.monthly_estimate || 0;
  const budget = costData.budget || 10;
  const budgetUsage = (monthlyEstimate / budget) * 100;

  // Preparar dados para gráfico de pizza
  const serviceBreakdown = Object.entries(costData.breakdown || {}).map(([service, cost]) => ({
    name: service,
    value: cost,
    percentage: ((cost / totalCost) * 100).toFixed(1)
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="space-y-6">
      {/* Resumo de Custos */}
      <Card title="Resumo de Custos">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Custo Hoje */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Custo Hoje</div>
            <div className="text-3xl font-bold text-blue-600">
              ${totalCost.toFixed(4)}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {new Date(costData.date).toLocaleDateString('pt-BR')}
            </div>
          </div>

          {/* Estimativa Mensal */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Estimativa Mensal</div>
            <div className={`text-3xl font-bold ${monthlyEstimate > budget ? 'text-red-600' : 'text-green-600'}`}>
              ${monthlyEstimate.toFixed(2)}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              Projeção baseada em uso atual
            </div>
          </div>

          {/* Orçamento */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Orçamento Mensal</div>
            <div className="text-3xl font-bold text-gray-700">
              ${budget.toFixed(2)}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              Meta definida
            </div>
          </div>

          {/* Uso do Orçamento */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Uso do Orçamento</div>
            <div className={`text-3xl font-bold ${budgetUsage > 100 ? 'text-red-600' : budgetUsage > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
              {budgetUsage.toFixed(1)}%
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {budgetUsage > 100 ? 'Acima do orçamento' : 'Dentro do orçamento'}
            </div>
          </div>
        </div>

        {/* Barra de Progresso do Orçamento */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Uso do Orçamento</span>
            <span>${monthlyEstimate.toFixed(2)} / ${budget.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className={`h-4 rounded-full ${budgetUsage > 100 ? 'bg-red-600' : budgetUsage > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(budgetUsage, 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Breakdown por Serviço */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <Card title="Custos por Serviço">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={serviceBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {serviceBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toFixed(4)}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Tabela de Serviços */}
        <Card title="Detalhamento">
          <div className="space-y-2">
            {serviceBreakdown.map((service, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{service.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">${service.value.toFixed(4)}</div>
                  <div className="text-xs text-gray-500">{service.percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tendência de Custos */}
      {dailyCosts.length > 0 && (
        <Card title="Tendência de Custos - Últimos 30 Dias">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyCosts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis 
                label={{ value: 'Custo ($)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
                formatter={(value) => [`$${value.toFixed(4)}`, 'Custo']}
              />
              <Legend />
              <Bar dataKey="total_cost" fill="#8884d8" name="Custo Diário" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-600">
            Média diária: ${(dailyCosts.reduce((sum, d) => sum + d.total_cost, 0) / dailyCosts.length).toFixed(4)}
          </div>
        </Card>
      )}

      {/* Alertas */}
      {costData.alerts && costData.alerts.length > 0 && (
        <Card title="Alertas de Custo">
          <div className="space-y-2">
            {costData.alerts.map((alert, index) => (
              <div key={index} className={`p-3 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-yellow-50 border-l-4 border-yellow-500'}`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {alert.severity === 'critical' ? (
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${alert.severity === 'critical' ? 'text-red-800' : 'text-yellow-800'}`}>
                      {alert.service}
                    </h3>
                    <div className={`mt-1 text-sm ${alert.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'}`}>
                      {alert.message}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recomendações */}
      <Card title="Recomendações de Otimização">
        <div className="space-y-3">
          <div className="flex items-start p-3 bg-blue-50 rounded-lg">
            <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                <strong>Lambda Memory:</strong> Ajuste a memória das Lambdas para otimizar custo/performance.
              </p>
            </div>
          </div>
          
          <div className="flex items-start p-3 bg-blue-50 rounded-lg">
            <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                <strong>CloudWatch Logs:</strong> Logs retidos por 7 dias. Considere reduzir se não necessário.
              </p>
            </div>
          </div>
          
          <div className="flex items-start p-3 bg-blue-50 rounded-lg">
            <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                <strong>S3 Lifecycle:</strong> Dados antigos movidos para Glacier após 90 dias (economia de 83%).
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
