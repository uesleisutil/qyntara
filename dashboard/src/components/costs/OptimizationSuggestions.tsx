/**
 * OptimizationSuggestions Component
 * 
 * Analyzes cost patterns and generates actionable optimization suggestions.
 * 
 * Features:
 * - Analyze cost patterns and generate suggestions
 * - Suggest Lambda memory optimization when execution time high
 * - Suggest S3 lifecycle policies when storage costs increase
 * - Suggest API Gateway caching when request costs high
 * - Prioritize by potential savings
 * - Display estimated monthly savings
 * - Provide implementation guidance
 * - Track implemented suggestions
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8
 */

import React, { useMemo, useState } from 'react';
import { useChartColors, formatters } from '../../lib/chartConfig';

interface OptimizationSuggestion {
  id: string;
  category: 'lambda' | 's3' | 'apiGateway' | 'other';
  title: string;
  description: string;
  estimatedSavings: number;
  priority: 'low' | 'medium' | 'high';
  implemented: boolean;
  implementationGuide: string[];
  detectedPattern: string;
}

interface CostMetrics {
  lambda?: {
    avgExecutionTime?: number;
    avgMemory?: number;
    totalCost?: number;
  };
  s3?: {
    storageGrowthRate?: number;
    totalCost?: number;
    avgObjectAge?: number;
  };
  apiGateway?: {
    requestCount?: number;
    cacheHitRate?: number;
    totalCost?: number;
  };
}

interface OptimizationSuggestionsData {
  cost_optimization?: {
    suggestions?: OptimizationSuggestion[];
    metrics?: CostMetrics;
  };
}

interface OptimizationSuggestionsProps {
  data: OptimizationSuggestionsData | null;
  isLoading?: boolean;
  onImplement?: (suggestionId: string) => void;
  onDismiss?: (suggestionId: string) => void;
}

const OptimizationSuggestions: React.FC<OptimizationSuggestionsProps> = ({
  data,
  isLoading = false,
  onImplement,
  onDismiss,
}) => {
  const colors = useChartColors();
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  // Generate suggestions based on cost patterns
  const suggestions = useMemo(() => {
    if (!data || !data.cost_optimization) {
      return [];
    }

    // Use provided suggestions or generate from metrics
    let allSuggestions: OptimizationSuggestion[] = [];
    
    if (data.cost_optimization.suggestions) {
      allSuggestions = data.cost_optimization.suggestions;
    } else {
      const generated: OptimizationSuggestion[] = [];
      const metrics = data.cost_optimization.metrics;

      if (!metrics) {
        return generated;
      }

    // Lambda optimization suggestions
    if (metrics.lambda) {
      const { avgExecutionTime, totalCost } = metrics.lambda;

      // Suggest memory optimization if execution time is high
      if (avgExecutionTime && avgExecutionTime > 5000) {
        // > 5 seconds
        const potentialSavings = (totalCost || 0) * 0.15; // Estimate 15% savings
        generated.push({
          id: 'lambda-memory-opt',
          category: 'lambda',
          title: 'Otimizar Memória do Lambda',
          description: `Tempo médio de execução de ${(avgExecutionTime / 1000).toFixed(1)}s indica que as funções Lambda podem estar com memória insuficiente. Aumentar a memória pode reduzir o tempo de execução e o custo total.`,
          estimatedSavings: potentialSavings,
          priority: potentialSavings > 100 ? 'high' : 'medium',
          implemented: false,
          implementationGuide: [
            'Analise as métricas de memória usada vs. alocada no CloudWatch',
            'Teste com incrementos de 128MB até encontrar o ponto ideal',
            'Use AWS Lambda Power Tuning para otimização automática',
            'Monitore o custo após mudanças por 7 dias',
          ],
          detectedPattern: `Tempo de execução médio: ${(avgExecutionTime / 1000).toFixed(1)}s`,
        });
      }

      // Suggest provisioned concurrency if cost is high
      if (totalCost && totalCost > 500) {
        const potentialSavings = totalCost * 0.10; // Estimate 10% savings
        generated.push({
          id: 'lambda-provisioned-concurrency',
          category: 'lambda',
          title: 'Avaliar Provisioned Concurrency',
          description: 'Custo elevado de Lambda pode indicar cold starts frequentes. Provisioned Concurrency pode reduzir latência e custos em horários de pico.',
          estimatedSavings: potentialSavings,
          priority: 'medium',
          implemented: false,
          implementationGuide: [
            'Identifique funções com alta latência de cold start',
            'Configure Provisioned Concurrency apenas para horários de pico',
            'Use Application Auto Scaling para ajustar dinamicamente',
            'Compare custos antes e depois da implementação',
          ],
          detectedPattern: `Custo mensal Lambda: ${formatters.currency(totalCost)}`,
        });
      }
    }

    // S3 optimization suggestions
    if (metrics.s3) {
      const { storageGrowthRate, totalCost, avgObjectAge } = metrics.s3;

      // Suggest lifecycle policies if storage is growing
      if (storageGrowthRate && storageGrowthRate > 0.10) {
        // > 10% growth
        const potentialSavings = (totalCost || 0) * 0.30; // Estimate 30% savings
        generated.push({
          id: 's3-lifecycle-policies',
          category: 's3',
          title: 'Implementar Políticas de Lifecycle no S3',
          description: `Crescimento de ${(storageGrowthRate * 100).toFixed(0)}% no armazenamento S3. Políticas de lifecycle podem mover dados antigos para classes de armazenamento mais baratas.`,
          estimatedSavings: potentialSavings,
          priority: potentialSavings > 150 ? 'high' : 'medium',
          implemented: false,
          implementationGuide: [
            'Identifique objetos com mais de 30 dias sem acesso',
            'Configure transição para S3 Intelligent-Tiering após 30 dias',
            'Mova para S3 Glacier após 90 dias para dados de arquivo',
            'Configure expiração para objetos temporários após 180 dias',
            'Use S3 Storage Lens para monitorar economia',
          ],
          detectedPattern: `Taxa de crescimento: ${(storageGrowthRate * 100).toFixed(0)}%/mês`,
        });
      }

      // Suggest Intelligent-Tiering if average object age is high
      if (avgObjectAge && avgObjectAge > 60) {
        // > 60 days
        const potentialSavings = (totalCost || 0) * 0.25; // Estimate 25% savings
        generated.push({
          id: 's3-intelligent-tiering',
          category: 's3',
          title: 'Ativar S3 Intelligent-Tiering',
          description: `Idade média dos objetos de ${avgObjectAge.toFixed(0)} dias indica dados raramente acessados. S3 Intelligent-Tiering move automaticamente objetos entre camadas de acesso.`,
          estimatedSavings: potentialSavings,
          priority: 'medium',
          implemented: false,
          implementationGuide: [
            'Habilite S3 Intelligent-Tiering para buckets de dados históricos',
            'Configure monitoramento automático de padrões de acesso',
            'Sem custo de recuperação para acesso frequente',
            'Economia automática sem gerenciamento manual',
          ],
          detectedPattern: `Idade média dos objetos: ${avgObjectAge.toFixed(0)} dias`,
        });
      }
    }

    // API Gateway optimization suggestions
    if (metrics.apiGateway) {
      const { requestCount, cacheHitRate, totalCost } = metrics.apiGateway;

      // Suggest caching if request count is high and cache hit rate is low
      if (requestCount && requestCount > 100000 && (!cacheHitRate || cacheHitRate < 0.5)) {
        const potentialSavings = (totalCost || 0) * 0.40; // Estimate 40% savings
        generated.push({
          id: 'apigateway-caching',
          category: 'apiGateway',
          title: 'Ativar Cache no API Gateway',
          description: `${(requestCount / 1000).toFixed(0)}k requisições/mês com taxa de cache de ${((cacheHitRate || 0) * 100).toFixed(0)}%. Ativar cache pode reduzir significativamente custos de requisição e latência.`,
          estimatedSavings: potentialSavings,
          priority: potentialSavings > 200 ? 'high' : 'medium',
          implemented: false,
          implementationGuide: [
            'Habilite cache no API Gateway com TTL de 300 segundos',
            'Configure cache keys baseadas em parâmetros de query relevantes',
            'Use cache de 0.5GB para começar (R$ 0.02/hora)',
            'Monitore taxa de hit/miss no CloudWatch',
            'Ajuste TTL baseado em padrões de atualização de dados',
          ],
          detectedPattern: `Requisições: ${(requestCount / 1000).toFixed(0)}k/mês, Cache hit rate: ${((cacheHitRate || 0) * 100).toFixed(0)}%`,
        });
      }

      // Suggest request throttling if cost is very high
      if (totalCost && totalCost > 300) {
        const potentialSavings = totalCost * 0.15; // Estimate 15% savings
        generated.push({
          id: 'apigateway-throttling',
          category: 'apiGateway',
          title: 'Configurar Throttling no API Gateway',
          description: 'Custo elevado de API Gateway pode indicar requisições excessivas. Implementar throttling e rate limiting pode prevenir uso desnecessário.',
          estimatedSavings: potentialSavings,
          priority: 'low',
          implemented: false,
          implementationGuide: [
            'Configure rate limit de 1000 requisições/segundo por padrão',
            'Implemente burst limit de 2000 requisições',
            'Use usage plans para diferentes níveis de clientes',
            'Configure alertas para throttling excessivo',
          ],
          detectedPattern: `Custo mensal API Gateway: ${formatters.currency(totalCost)}`,
        });
      }
    }

      allSuggestions = generated;
    }

    // Sort by priority and estimated savings
    return allSuggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedSavings - a.estimatedSavings;
    });
  }, [data]);

  const totalPotentialSavings = useMemo(() => {
    return suggestions
      .filter((s) => !s.implemented)
      .reduce((sum, s) => sum + s.estimatedSavings, 0);
  }, [suggestions]);

  const implementedCount = useMemo(() => {
    return suggestions.filter((s) => s.implemented).length;
  }, [suggestions]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.neutral }}>
        Analisando padrões de custo...
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: `${colors.success}10`,
          borderRadius: '8px',
          border: `1px solid ${colors.success}40`,
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: colors.success, fontSize: '1.125rem' }}>
          Custos Otimizados
        </h3>
        <p style={{ margin: 0, color: colors.text, fontSize: '0.875rem' }}>
          Nenhuma oportunidade de otimização detectada no momento.
        </p>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'lambda':
        return 'λ';
      case 's3':
        return '📦';
      case 'apiGateway':
        return '🌐';
      default:
        return '⚙️';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'lambda':
        return 'Lambda';
      case 's3':
        return 'S3';
      case 'apiGateway':
        return 'API Gateway';
      default:
        return 'Outros';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      default:
        return colors.info;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      default:
        return 'Baixa';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header with summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: colors.text }}>
          Sugestões de Otimização
        </h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {implementedCount > 0 && (
            <span
              style={{
                fontSize: '0.875rem',
                color: colors.success,
                fontWeight: '500',
                padding: '0.25rem 0.5rem',
                backgroundColor: `${colors.success}20`,
                borderRadius: '4px',
              }}
            >
              ✓ {implementedCount} implementada{implementedCount > 1 ? 's' : ''}
            </span>
          )}
          {totalPotentialSavings > 0 && (
            <span
              style={{
                fontSize: '0.875rem',
                color: colors.primary,
                fontWeight: '600',
                padding: '0.25rem 0.5rem',
                backgroundColor: `${colors.primary}20`,
                borderRadius: '4px',
              }}
            >
              Economia potencial: {formatters.currency(totalPotentialSavings)}/mês
            </span>
          )}
        </div>
      </div>

      {/* Suggestions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            style={{
              padding: '1rem',
              backgroundColor: suggestion.implemented
                ? `${colors.success}05`
                : colors.background === '#ffffff'
                ? '#ffffff'
                : '#374151',
              borderRadius: '8px',
              border: `1px solid ${
                suggestion.implemented
                  ? `${colors.success}40`
                  : expandedSuggestion === suggestion.id
                  ? colors.primary
                  : colors.grid
              }`,
              opacity: suggestion.implemented ? 0.7 : 1,
            }}
          >
            {/* Suggestion header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{getCategoryIcon(suggestion.category)}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: colors.neutral,
                      fontWeight: '500',
                      textTransform: 'uppercase',
                    }}
                  >
                    {getCategoryLabel(suggestion.category)}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: getPriorityColor(suggestion.priority),
                      fontWeight: '600',
                      padding: '0.125rem 0.375rem',
                      backgroundColor: `${getPriorityColor(suggestion.priority)}20`,
                      borderRadius: '4px',
                    }}
                  >
                    Prioridade {getPriorityLabel(suggestion.priority)}
                  </span>
                  {suggestion.implemented && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: colors.success,
                        fontWeight: '600',
                        padding: '0.125rem 0.375rem',
                        backgroundColor: `${colors.success}20`,
                        borderRadius: '4px',
                      }}
                    >
                      ✓ Implementada
                    </span>
                  )}
                </div>
                <h4
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: colors.text,
                  }}
                >
                  {suggestion.title}
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: colors.text, lineHeight: '1.5' }}>
                  {suggestion.description}
                </p>
              </div>
              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', color: colors.neutral }}>
                  Economia Estimada
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: colors.success,
                  }}
                >
                  {formatters.currency(suggestion.estimatedSavings)}
                </p>
                <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: colors.neutral }}>
                  por mês
                </p>
              </div>
            </div>

            {/* Detected pattern */}
            <div
              style={{
                padding: '0.5rem',
                backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#1f2937',
                borderRadius: '4px',
                marginBottom: '0.75rem',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.75rem', color: colors.neutral }}>
                <strong>Padrão Detectado:</strong> {suggestion.detectedPattern}
              </p>
            </div>

            {/* Implementation guide (expandable) */}
            <div>
              <button
                onClick={() =>
                  setExpandedSuggestion(expandedSuggestion === suggestion.id ? null : suggestion.id)
                }
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: colors.primary,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  width: '100%',
                }}
              >
                <span>{expandedSuggestion === suggestion.id ? '▼' : '▶'}</span>
                <span>Guia de Implementação</span>
              </button>

              {expandedSuggestion === suggestion.id && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: colors.background === '#ffffff' ? '#f8fafc' : '#1f2937',
                    borderRadius: '4px',
                  }}
                >
                  <ol style={{ margin: 0, paddingLeft: '1.25rem', color: colors.text }}>
                    {suggestion.implementationGuide.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.875rem', lineHeight: '1.5' }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!suggestion.implemented && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                {onImplement && (
                  <button
                    onClick={() => onImplement(suggestion.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: colors.primary,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Marcar como Implementada
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={() => onDismiss(suggestion.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'transparent',
                      color: colors.neutral,
                      border: `1px solid ${colors.grid}`,
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Dispensar
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OptimizationSuggestions;
