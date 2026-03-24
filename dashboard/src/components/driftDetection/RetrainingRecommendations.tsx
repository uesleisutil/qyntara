import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Circle, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface ChecklistItem { item: string; completed: boolean; description?: string; }
interface RetrainingTrigger { type: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; value: number; threshold: number; }
interface RetrainingRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical'; reason: string;
  expectedImprovement: number; daysSinceLastTraining: number;
  checklist: ChecklistItem[]; triggers: RetrainingTrigger[];
}

interface Props {
  driftedFeaturesPercentage?: number; conceptDriftDetected?: boolean;
  performanceDegradationDays?: number; daysSinceLastTraining?: number;
  darkMode?: boolean; isMobile?: boolean;
}

export const RetrainingRecommendations: React.FC<Props> = ({
  driftedFeaturesPercentage = 0, conceptDriftDetected = false,
  performanceDegradationDays = 0, daysSinceLastTraining = 0,
  darkMode = false, isMobile = false,
}) => {
  const [recommendation, setRecommendation] = useState<RetrainingRecommendation | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const theme = {
    cardBg: darkMode ? '#1a2626' : '#fff',
    text: darkMode ? '#e8f0ed' : '#121a1a',
    textSecondary: darkMode ? '#8fa89c' : '#5a7268',
    border: darkMode ? '#2a3d36' : '#d4e5dc',
    priorityBg: {
      critical: darkMode ? 'rgba(224,112,112,0.1)' : 'rgba(224,112,112,0.05)',
      high: darkMode ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.05)',
      medium: darkMode ? 'rgba(212,168,75,0.1)' : 'rgba(212,168,75,0.05)',
      low: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
    },
    priorityBorder: {
      critical: darkMode ? 'rgba(224,112,112,0.3)' : 'rgba(224,112,112,0.25)',
      high: darkMode ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.25)',
      medium: darkMode ? 'rgba(212,168,75,0.3)' : 'rgba(212,168,75,0.25)',
      low: darkMode ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.25)',
    },
    priorityText: { critical: '#e07070', high: '#d4944b', medium: '#d4a84b', low: '#5a9e87' },
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden',
  };

  const severityLabel: Record<string, string> = { critical: 'CRÍTICO', high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' };
  const triggerTypeLabel: Record<string, string> = { data_drift: 'Data Drift', concept_drift: 'Concept Drift', performance_degradation: 'Degradação de Performance' };

  useEffect(() => {
    const triggers: RetrainingTrigger[] = [];
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let expectedImprovement = 0;

    if (driftedFeaturesPercentage > 30) {
      triggers.push({
        type: 'data_drift',
        severity: driftedFeaturesPercentage > 50 ? 'critical' : driftedFeaturesPercentage > 40 ? 'high' : 'medium',
        description: `${driftedFeaturesPercentage.toFixed(1)}% das features apresentam drift significativo na distribuição`,
        value: driftedFeaturesPercentage, threshold: 30,
      });
      expectedImprovement += Math.min(driftedFeaturesPercentage * 0.3, 15);
      priority = driftedFeaturesPercentage > 50 ? 'critical' : driftedFeaturesPercentage > 40 ? 'high' : 'medium';
    }

    if (conceptDriftDetected) {
      triggers.push({
        type: 'concept_drift', severity: 'high',
        description: 'As relações entre features e target mudaram significativamente',
        value: 1, threshold: 1,
      });
      expectedImprovement += 10;
      if (priority === 'low' || priority === 'medium') priority = 'high';
    }

    if (performanceDegradationDays > 7) {
      triggers.push({
        type: 'performance_degradation',
        severity: performanceDegradationDays > 14 ? 'critical' : 'high',
        description: `Degradação de performance persiste há ${performanceDegradationDays} dias`,
        value: performanceDegradationDays, threshold: 7,
      });
      expectedImprovement += Math.min(performanceDegradationDays * 0.5, 20);
      if (performanceDegradationDays > 14) priority = 'critical';
      else if (priority !== 'critical') priority = 'high';
    }

    if (triggers.length > 0) {
      const reasons = triggers.map(t => {
        if (t.type === 'data_drift') return `${t.value.toFixed(1)}% das features driftaram`;
        if (t.type === 'concept_drift') return 'concept drift detectado';
        return `performance degradada há ${t.value} dias`;
      });
      const checklistItems: ChecklistItem[] = [
        { item: 'Revisar análise de drift e identificar features afetadas', completed: false, description: 'Analisar quais features driftaram e entender as causas raiz' },
        { item: 'Coletar e validar novos dados de treino', completed: false, description: 'Garantir qualidade e completude dos dados para o período de retreinamento' },
        { item: 'Atualizar pipeline de feature engineering se necessário', completed: false, description: 'Ajustar transformações de features baseado nos padrões de drift' },
        ...(triggers.some(t => t.type === 'concept_drift') ? [{ item: 'Revisar e atualizar arquitetura do modelo se necessário', completed: false, description: 'Considerar mudanças no modelo para capturar novas relações' }] : []),
        { item: 'Retreinar modelos com dados atualizados', completed: false, description: 'Executar pipeline de treino com novos dados e hiperparâmetros' },
        { item: 'Validar performance em conjunto de holdout', completed: false, description: 'Garantir que o novo modelo atende os limites de performance' },
        { item: 'Executar backtesting em dados históricos recentes', completed: false, description: 'Verificar performance em condições recentes de mercado' },
        { item: 'Deploy do novo modelo em staging', completed: false, description: 'Testar modelo em staging antes do deploy em produção' },
        { item: 'Monitorar performance pós-deploy', completed: false, description: 'Acompanhar métricas de perto após deploy em produção' },
      ];
      setRecommendation({
        priority, reason: `Retreinamento recomendado: ${reasons.join(', ')}.`,
        expectedImprovement: Math.min(expectedImprovement, 25),
        daysSinceLastTraining, checklist: checklistItems, triggers,
      });
      setChecklist(checklistItems);
    } else {
      setRecommendation(null); setChecklist([]);
    }
  }, [driftedFeaturesPercentage, conceptDriftDetected, performanceDegradationDays, daysSinceLastTraining]);

  const toggleChecklistItem = (idx: number) => setChecklist(prev => prev.map((item, i) => i === idx ? { ...item, completed: !item.completed } : item));

  const formatDaysSince = (d: number) => {
    if (d === 0) return 'Hoje';
    if (d === 1) return '1 dia atrás';
    if (d < 7) return `${d} dias atrás`;
    if (d < 30) return `${Math.floor(d / 7)} semanas atrás`;
    return `${Math.floor(d / 30)} meses atrás`;
  };

  if (!recommendation) {
    return (
      <div style={{ ...cardStyle, padding: '2rem', textAlign: 'center' }}>
        <CheckCircle size={40} color="#4ead8a" style={{ marginBottom: '0.75rem' }} />
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: 600, color: theme.text }}>Retreinamento Não Necessário</h4>
        <p style={{ margin: 0, fontSize: '0.85rem', color: theme.textSecondary }}>Performance do modelo está estável. Nenhum drift ou degradação significativa detectada.</p>
        {daysSinceLastTraining > 0 && (
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.72rem', color: theme.textSecondary }}>Último treino: {formatDaysSince(daysSinceLastTraining)}</p>
        )}
      </div>
    );
  }

  const completedItems = checklist.filter(i => i.completed).length;
  const totalItems = checklist.length;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Card de recomendação */}
      <div style={{ background: theme.priorityBg[recommendation.priority], border: `2px solid ${theme.priorityBorder[recommendation.priority]}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ color: theme.priorityText[recommendation.priority], flexShrink: 0 }}>
              <AlertTriangle size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: theme.text }}>Retreinamento do Modelo Recomendado</h4>
                <span style={{
                  padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.65rem', fontWeight: 600,
                  background: theme.priorityBg[recommendation.priority], color: theme.priorityText[recommendation.priority],
                  border: `1px solid ${theme.priorityBorder[recommendation.priority]}`,
                }}>{severityLabel[recommendation.priority]}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: theme.text, lineHeight: 1.5 }}>{recommendation.reason}</p>
            </div>
          </div>

          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
            {[
              { icon: <TrendingUp size={14} />, label: 'MELHORIA ESPERADA', value: `+${recommendation.expectedImprovement.toFixed(1)}%`, sub: 'Ganho estimado de performance' },
              { icon: <Clock size={14} />, label: 'ÚLTIMO TREINO', value: `${recommendation.daysSinceLastTraining}`, sub: formatDaysSince(recommendation.daysSinceLastTraining) },
              { icon: <AlertTriangle size={14} />, label: 'GATILHOS ATIVOS', value: `${recommendation.triggers.length}`, sub: 'Condições de retreinamento atingidas' },
            ].map((m, i) => (
              <div key={i} style={{ background: darkMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.5)', padding: '0.85rem', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: theme.textSecondary }}>{m.icon}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase' as const }}>{m.label}</span>
                </div>
                <div style={{ fontSize: isMobile ? '1.3rem' : '1.5rem', fontWeight: 700, color: theme.text }}>{m.value}</div>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginTop: '0.15rem' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Gatilhos */}
          <div style={{ marginTop: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', fontWeight: 600, color: theme.text, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Gatilhos de Retreinamento</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {recommendation.triggers.map((trigger, idx) => (
                <div key={idx} style={{ background: darkMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.5)', padding: '0.65rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    padding: '0.15rem 0.45rem', borderRadius: 10, fontSize: '0.6rem', fontWeight: 600,
                    background: theme.priorityBg[trigger.severity], color: theme.priorityText[trigger.severity],
                    border: `1px solid ${theme.priorityBorder[trigger.severity]}`,
                  }}>{severityLabel[trigger.severity]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: theme.text }}>{triggerTypeLabel[trigger.type] || trigger.type}</div>
                    <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.1rem' }}>{trigger.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div style={cardStyle}>
        <div style={{ padding: '1rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowChecklist(!showChecklist)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <RefreshCw size={18} color={theme.textSecondary} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Checklist de Retreinamento</h4>
            <span style={{ fontSize: '0.72rem', color: theme.textSecondary, background: darkMode ? '#2a3d36' : '#e8f0ed', padding: '0.1rem 0.45rem', borderRadius: 10 }}>{completedItems} / {totalItems}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{progress.toFixed(0)}%</span>
            <div style={{ color: theme.textSecondary }}>{showChecklist ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
          </div>
        </div>
        <div style={{ height: 4, background: darkMode ? '#2a3d36' : '#d4e5dc', position: 'relative' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#4ead8a' : '#5a9e87', transition: 'width 0.3s ease' }} />
        </div>
        {showChecklist && (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {checklist.map((item, idx) => (
                <div key={idx} onClick={() => toggleChecklistItem(idx)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.65rem',
                  background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${item.completed ? '#4ead8a' : theme.border}`, transition: 'all 0.2s ease',
                }}>
                  <div style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                    {item.completed ? <CheckCircle size={18} color="#4ead8a" /> : <Circle size={18} color={theme.textSecondary} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: item.completed ? theme.textSecondary : theme.text, textDecoration: item.completed ? 'line-through' : 'none' }}>{item.item}</div>
                    {item.description && <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '0.15rem', lineHeight: 1.4 }}>{item.description}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: darkMode ? '#121a1a' : '#f6faf8', borderRadius: 8, fontSize: '0.72rem', color: theme.textSecondary, lineHeight: 1.5 }}>
              <strong style={{ color: theme.text }}>Nota:</strong> Este checklist fornece um fluxo recomendado para retreinamento do modelo. Ajuste os passos conforme seus requisitos e processos organizacionais.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
