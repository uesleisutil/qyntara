import React, { useState, useEffect } from 'react';
import Card from '../shared/Card';
import LoadingSpinner from '../shared/LoadingSpinner';

/**
 * Painel de Monitoramento do SageMaker
 * 
 * Monitora:
 * - Training Jobs ativos
 * - Endpoints ativos (ALERTA: custo 24/7)
 * - Transform Jobs ativos
 * - Tempo de execução
 * - Custos estimados
 */
export const SageMakerMonitoringPanel = ({ s3Client, bucket }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sagemakerStatus, setSagemakerStatus] = useState(null);
  const [trainingJobs, setTrainingJobs] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [transformJobs, setTransformJobs] = useState([]);

  useEffect(() => {
    loadSageMakerStatus();
    // Atualizar a cada 2 minutos
    const interval = setInterval(loadSageMakerStatus, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [s3Client, bucket]);

  const loadSageMakerStatus = async () => {
    if (!s3Client || !bucket) return;

    try {
      setLoading(true);
      setError(null);

      // Carregar status mais recente do S3
      const prefix = 'monitoring/sagemaker/';
      const response = await s3Client.listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 10
      }).promise();

      if (!response.Contents || response.Contents.length === 0) {
        setSagemakerStatus(null);
        setLoading(false);
        return;
      }

      // Pegar o mais recente
      const latestFile = response.Contents
        .filter(obj => obj.Key.endsWith('status.json'))
        .sort((a, b) => b.LastModified - a.LastModified)[0];

      if (latestFile) {
        const data = await s3Client.getObject({
          Bucket: bucket,
          Key: latestFile.Key
        }).promise();

        const status = JSON.parse(data.Body.toString('utf-8'));
        setSagemakerStatus(status);
        setTrainingJobs(status.training_jobs || []);
        setEndpoints(status.endpoints || []);
        setTransformJobs(status.transform_jobs || []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar status do SageMaker:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const statusMap = {
      'InProgress': 'blue',
      'Completed': 'green',
      'Failed': 'red',
      'Stopped': 'gray',
      'Stopping': 'yellow',
      'InService': 'green',
      'Creating': 'blue',
      'Updating': 'blue',
      'SystemUpdating': 'blue',
      'RollingBack': 'yellow',
      'Deleting': 'yellow',
      'Failed': 'red'
    };
    return statusMap[status] || 'gray';
  };

  const getStatusIcon = (status) => {
    if (status === 'InProgress' || status === 'Creating' || status === 'Updating') {
      return '🔄';
    } else if (status === 'Completed' || status === 'InService') {
      return '✅';
    } else if (status === 'Failed') {
      return '❌';
    } else if (status === 'Stopped' || status === 'Stopping') {
      return '⏸️';
    }
    return '⚪';
  };

  const calculateCost = (instanceType, hours) => {
    // Custos aproximados por hora (us-east-1)
    const costs = {
      'ml.t2.medium': 0.065,
      'ml.t2.large': 0.13,
      'ml.m5.large': 0.134,
      'ml.m5.xlarge': 0.269,
      'ml.m5.2xlarge': 0.538,
      'ml.c5.xlarge': 0.238,
      'ml.c5.2xlarge': 0.476,
      'ml.c5.4xlarge': 0.952,
      'ml.p3.2xlarge': 3.825
    };

    const costPerHour = costs[instanceType] || 0.2;
    return (costPerHour * hours).toFixed(4);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) {
    return (
      <Card title="Monitoramento SageMaker">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Monitoramento SageMaker">
        <div className="text-red-600">Erro: {error}</div>
      </Card>
    );
  }

  if (!sagemakerStatus) {
    return (
      <Card title="Monitoramento SageMaker">
        <div className="text-gray-500">
          Sem dados de monitoramento disponíveis. Lambda de monitoramento roda a cada 5 minutos.
        </div>
      </Card>
    );
  }

  const hasActiveEndpoints = endpoints.some(e => e.status === 'InService');
  const hasActiveTraining = trainingJobs.some(j => j.status === 'InProgress');
  const hasActiveTransform = transformJobs.some(j => j.status === 'InProgress');

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card title="Status Geral do SageMaker">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Training Jobs */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Training Jobs</div>
            <div className={`text-3xl font-bold ${hasActiveTraining ? 'text-blue-600' : 'text-gray-400'}`}>
              {trainingJobs.filter(j => j.status === 'InProgress').length}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {hasActiveTraining ? 'Em execução' : 'Nenhum ativo'}
            </div>
          </div>

          {/* Endpoints */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Endpoints</div>
            <div className={`text-3xl font-bold ${hasActiveEndpoints ? 'text-red-600' : 'text-green-600'}`}>
              {endpoints.filter(e => e.status === 'InService').length}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {hasActiveEndpoints ? '⚠️ Custo 24/7' : '✅ Nenhum ativo'}
            </div>
          </div>

          {/* Transform Jobs */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Transform Jobs</div>
            <div className={`text-3xl font-bold ${hasActiveTransform ? 'text-blue-600' : 'text-gray-400'}`}>
              {transformJobs.filter(j => j.status === 'InProgress').length}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              {hasActiveTransform ? 'Em execução' : 'Nenhum ativo'}
            </div>
          </div>

          {/* Custo Estimado */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Custo Estimado (24h)</div>
            <div className="text-3xl font-bold text-gray-700">
              ${sagemakerStatus.estimated_daily_cost?.toFixed(2) || '0.00'}
            </div>
            <div className="text-xs mt-1 text-gray-500">
              Baseado em recursos ativos
            </div>
          </div>
        </div>

        {/* Última atualização */}
        <div className="mt-4 text-sm text-gray-500">
          Última verificação: {new Date(sagemakerStatus.timestamp).toLocaleString('pt-BR')}
        </div>
      </Card>

      {/* Alerta de Endpoints Ativos */}
      {hasActiveEndpoints && (
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
                  ⚠️ Endpoints SageMaker Ativos Detectados
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    Endpoints SageMaker geram custo 24/7 (~$47/mês por endpoint ml.t2.medium).
                    O sistema foi projetado para inferência in-memory (sem endpoints).
                  </p>
                  <p className="mt-2 font-semibold">
                    Ação Recomendada: Deletar endpoints não utilizados
                  </p>
                  {endpoints.filter(e => e.status === 'InService').map(endpoint => (
                    <div key={endpoint.name} className="mt-2 font-mono text-xs bg-red-100 p-2 rounded">
                      aws sagemaker delete-endpoint --endpoint-name {endpoint.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Training Jobs */}
      {trainingJobs.length > 0 && (
        <Card title="Training Jobs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instância</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duração</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo Est.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trainingJobs.map((job, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(job.status)}-100 text-${getStatusColor(job.status)}-800`}>
                        {getStatusIcon(job.status)} {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                      {job.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.instance_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(job.duration_seconds)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      ${calculateCost(job.instance_type, job.duration_seconds / 3600)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.creation_time).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Endpoints */}
      {endpoints.length > 0 && (
        <Card title="Endpoints">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instância</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo/Mês</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {endpoints.map((endpoint, index) => {
                  const monthlyCost = calculateCost(endpoint.instance_type, 730); // 730h/mês
                  return (
                    <tr key={index} className={endpoint.status === 'InService' ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(endpoint.status)}-100 text-${getStatusColor(endpoint.status)}-800`}>
                          {getStatusIcon(endpoint.status)} {endpoint.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                        {endpoint.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {endpoint.instance_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        <span className="text-red-600">${monthlyCost}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(endpoint.creation_time).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {endpoint.status === 'InService' && (
                          <span className="text-red-600 font-semibold">⚠️ Deletar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transform Jobs */}
      {transformJobs.length > 0 && (
        <Card title="Transform Jobs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instância</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duração</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo Est.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transformJobs.map((job, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${getStatusColor(job.status)}-100 text-${getStatusColor(job.status)}-800`}>
                        {getStatusIcon(job.status)} {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                      {job.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.instance_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(job.duration_seconds)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      ${calculateCost(job.instance_type, job.duration_seconds / 3600)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.creation_time).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recomendações */}
      <Card title="Recomendações">
        <div className="space-y-3">
          <div className="flex items-start p-3 bg-green-50 rounded-lg">
            <svg className="h-5 w-5 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                <strong>Inferência In-Memory:</strong> O sistema usa inferência in-memory (sem endpoints) para economia de ~$47/mês.
              </p>
            </div>
          </div>
          
          <div className="flex items-start p-3 bg-blue-50 rounded-lg">
            <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                <strong>Training Jobs:</strong> Devem completar em 5-15 minutos. Se demorar mais, verificar logs.
              </p>
            </div>
          </div>
          
          <div className="flex items-start p-3 bg-yellow-50 rounded-lg">
            <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Endpoints Órfãos:</strong> Se encontrar endpoints ativos, deletar imediatamente para evitar custos.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
