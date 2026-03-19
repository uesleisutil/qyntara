/**
 * RetrainingRecommendations Component
 * 
 * Implements Requirements:
 * - 28.1: Generate retraining recommendations on the Drift Detection tab
 * - 28.2: Recommend retraining when > 30% features drifted
 * - 28.3: Recommend retraining when concept drift detected
 * - 28.4: Recommend retraining when degradation persists > 7 days
 * - 28.5: Display retraining priority (low, medium, high, critical)
 * - 28.6: Estimate expected performance improvement from retraining
 * - 28.7: Display time since last training
 * - 28.8: Provide retraining checklist with required steps
 * 
 * Features:
 * - Priority-based recommendations
 * - Performance improvement estimates
 * - Interactive retraining checklist
 * - Dark mode support
 * - Mobile responsive layout
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Circle, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';

interface RetrainingRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  expectedImprovement: number;
  daysSinceLastTraining: number;
  checklist: ChecklistItem[];
  triggers: RetrainingTrigger[];
}

interface ChecklistItem {
  item: string;
  completed: boolean;
  description?: string;
}

interface RetrainingTrigger {
  type: 'data_drift' | 'concept_drift' | 'performance_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  value: number;
  threshold: number;
}

interface RetrainingRecommendationsProps {
  driftedFeaturesPercentage?: number;
  conceptDriftDetected?: boolean;
  performanceDegradationDays?: number;
  daysSinceLastTraining?: number;
  darkMode?: boolean;
  isMobile?: boolean;
}

export const RetrainingRecommendations: React.FC<RetrainingRecommendationsProps> = ({
  driftedFeaturesPercentage = 0,
  conceptDriftDetected = false,
  performanceDegradationDays = 0,
  daysSinceLastTraining = 0,
  darkMode = false,
  isMobile = false,
}) => {
  const [recommendation, setRecommendation] = useState<RetrainingRecommendation | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    priorityBg: {
      critical: darkMode ? '#7f1d1d' : '#fef2f2',
      high: darkMode ? '#7c2d12' : '#fff7ed',
      medium: darkMode ? '#713f12' : '#fefce8',
      low: darkMode ? '#1e3a8a' : '#eff6ff',
    },
    priorityBorder: {
      critical: darkMode ? '#991b1b' : '#fecaca',
      high: darkMode ? '#9a3412' : '#fed7aa',
      medium: darkMode ? '#854d0e' : '#fef08a',
      low: darkMode ? '#1e40af' : '#bfdbfe',
    },
    priorityText: {
      critical: darkMode ? '#fca5a5' : '#dc2626',
      high: darkMode ? '#fdba74' : '#ea580c',
      medium: darkMode ? '#fde047' : '#ca8a04',
      low: darkMode ? '#93c5fd' : '#2563eb',
    },
  };

  // Generate retraining recommendation based on triggers (Req 28.1, 28.2, 28.3, 28.4)
  useEffect(() => {
    const triggers: RetrainingTrigger[] = [];
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let expectedImprovement = 0;

    // Check data drift trigger (Req 28.2)
    if (driftedFeaturesPercentage > 30) {
      triggers.push({
        type: 'data_drift',
        severity: driftedFeaturesPercentage > 50 ? 'critical' : driftedFeaturesPercentage > 40 ? 'high' : 'medium',
        description: `${driftedFeaturesPercentage.toFixed(1)}% of features show significant distribution drift`,
        value: driftedFeaturesPercentage,
        threshold: 30,
      });
      expectedImprovement += Math.min(driftedFeaturesPercentage * 0.3, 15);
      priority = driftedFeaturesPercentage > 50 ? 'critical' : driftedFeaturesPercentage > 40 ? 'high' : 'medium';
    }

    // Check concept drift trigger (Req 28.3)
    if (conceptDriftDetected) {
      triggers.push({
        type: 'concept_drift',
        severity: 'high',
        description: 'Feature-target relationships have changed significantly',
        value: 1,
        threshold: 1,
      });
      expectedImprovement += 10;
      if (priority === 'low' || priority === 'medium') {
        priority = 'high';
      }
    }

    // Check performance degradation trigger (Req 28.4)
    if (performanceDegradationDays > 7) {
      triggers.push({
        type: 'performance_degradation',
        severity: performanceDegradationDays > 14 ? 'critical' : 'high',
        description: `Performance degradation has persisted for ${performanceDegradationDays} days`,
        value: performanceDegradationDays,
        threshold: 7,
      });
      expectedImprovement += Math.min(performanceDegradationDays * 0.5, 20);
      if (performanceDegradationDays > 14) {
        priority = 'critical';
      } else if (priority !== 'critical') {
        priority = 'high';
      }
    }

    // Generate recommendation if any triggers are present
    if (triggers.length > 0) {
      const reason = generateRecommendationReason(triggers);
      const checklistItems = generateChecklist(triggers);

      setRecommendation({
        priority,
        reason,
        expectedImprovement: Math.min(expectedImprovement, 25), // Cap at 25%
        daysSinceLastTraining,
        checklist: checklistItems,
        triggers,
      });
      setChecklist(checklistItems);
    } else {
      setRecommendation(null);
      setChecklist([]);
    }
  }, [driftedFeaturesPercentage, conceptDriftDetected, performanceDegradationDays, daysSinceLastTraining]);

  // Generate recommendation reason text
  const generateRecommendationReason = (triggers: RetrainingTrigger[]): string => {
    const reasons: string[] = [];
    
    triggers.forEach(trigger => {
      switch (trigger.type) {
        case 'data_drift':
          reasons.push(`${trigger.value.toFixed(1)}% of features have drifted`);
          break;
        case 'concept_drift':
          reasons.push('concept drift detected');
          break;
        case 'performance_degradation':
          reasons.push(`performance degraded for ${trigger.value} days`);
          break;
      }
    });

    return `Model retraining recommended due to: ${reasons.join(', ')}.`;
  };

  // Generate retraining checklist (Req 28.8)
  const generateChecklist = (triggers: RetrainingTrigger[]): ChecklistItem[] => {
    const items: ChecklistItem[] = [
      {
        item: 'Review drift analysis and identify affected features',
        completed: false,
        description: 'Analyze which features have drifted and understand the root causes',
      },
      {
        item: 'Collect and validate new training data',
        completed: false,
        description: 'Ensure data quality and completeness for the retraining period',
      },
      {
        item: 'Update feature engineering pipeline if needed',
        completed: false,
        description: 'Adjust feature transformations based on drift patterns',
      },
      {
        item: 'Retrain models with updated data',
        completed: false,
        description: 'Execute training pipeline with new data and hyperparameters',
      },
      {
        item: 'Validate model performance on holdout set',
        completed: false,
        description: 'Ensure new model meets performance thresholds',
      },
      {
        item: 'Run backtesting on recent historical data',
        completed: false,
        description: 'Verify model performance on recent market conditions',
      },
      {
        item: 'Deploy new model to staging environment',
        completed: false,
        description: 'Test model in staging before production deployment',
      },
      {
        item: 'Monitor model performance post-deployment',
        completed: false,
        description: 'Track metrics closely after deployment to production',
      },
    ];

    // Add specific items based on triggers
    if (triggers.some(t => t.type === 'concept_drift')) {
      items.splice(3, 0, {
        item: 'Review and update model architecture if needed',
        completed: false,
        description: 'Consider model changes to capture new relationships',
      });
    }

    return items;
  };

  const toggleChecklistItem = (index: number) => {
    setChecklist(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle size={24} />;
      case 'high':
        return <AlertTriangle size={24} />;
      case 'medium':
        return <RefreshCw size={24} />;
      default:
        return <RefreshCw size={24} />;
    }
  };

  const formatDaysSinceTraining = (days: number): string => {
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  // No recommendation needed
  if (!recommendation) {
    return (
      <div
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: '8px',
          border: `1px solid ${theme.border}`,
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
          No Retraining Required
        </h4>
        <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textSecondary }}>
          Model performance is stable. No significant drift or degradation detected.
        </p>
        {daysSinceLastTraining > 0 && (
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
            Last trained: {formatDaysSinceTraining(daysSinceLastTraining)}
          </p>
        )}
      </div>
    );
  }

  const completedItems = checklist.filter(item => item.completed).length;
  const totalItems = checklist.length;
  const checklistProgress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Recommendation Card (Req 28.5, 28.6, 28.7) */}
      <div
        style={{
          backgroundColor: theme.priorityBg[recommendation.priority],
          border: `2px solid ${theme.priorityBorder[recommendation.priority]}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ color: theme.priorityText[recommendation.priority], flexShrink: 0 }}>
              {getPriorityIcon(recommendation.priority)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: theme.text }}>
                  Model Retraining Recommended
                </h4>
                <StatusBadge
                  status={recommendation.priority === 'critical' || recommendation.priority === 'high' ? 'error' : 'warning'}
                  label={recommendation.priority.toUpperCase()}
                />
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: theme.text, lineHeight: '1.5' }}>
                {recommendation.reason}
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '1rem',
              marginTop: '1.5rem',
            }}
          >
            {/* Expected Improvement (Req 28.6) */}
            <div
              style={{
                backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                padding: '1rem',
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <TrendingUp size={16} color={theme.textSecondary} />
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase' }}>
                  Expected Improvement
                </span>
              </div>
              <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                +{recommendation.expectedImprovement.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.25rem' }}>
                Estimated performance gain
              </div>
            </div>

            {/* Time Since Last Training (Req 28.7) */}
            <div
              style={{
                backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                padding: '1rem',
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Clock size={16} color={theme.textSecondary} />
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase' }}>
                  Last Training
                </span>
              </div>
              <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                {recommendation.daysSinceLastTraining}
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.25rem' }}>
                {formatDaysSinceTraining(recommendation.daysSinceLastTraining)}
              </div>
            </div>

            {/* Active Triggers */}
            <div
              style={{
                backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                padding: '1rem',
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <AlertTriangle size={16} color={theme.textSecondary} />
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase' }}>
                  Active Triggers
                </span>
              </div>
              <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: theme.text }}>
                {recommendation.triggers.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.25rem' }}>
                Retraining conditions met
              </div>
            </div>
          </div>

          {/* Triggers List */}
          <div style={{ marginTop: '1.5rem' }}>
            <h5
              style={{
                margin: '0 0 0.75rem 0',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: theme.text,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Retraining Triggers
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recommendation.triggers.map((trigger, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <StatusBadge
                    status={trigger.severity === 'critical' || trigger.severity === 'high' ? 'error' : 'warning'}
                    label={trigger.severity}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500', color: theme.text }}>
                      {trigger.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.125rem' }}>
                      {trigger.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Retraining Checklist (Req 28.8) */}
      <div
        style={{
          backgroundColor: theme.cardBg,
          borderRadius: '8px',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowChecklist(!showChecklist)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <RefreshCw size={20} color={theme.textSecondary} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: theme.text }}>
              Retraining Checklist
            </h4>
            <span
              style={{
                fontSize: '0.75rem',
                color: theme.textSecondary,
                backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
              }}
            >
              {completedItems} / {totalItems}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: theme.textSecondary }}>
              {checklistProgress.toFixed(0)}%
            </span>
            <div style={{ color: theme.textSecondary }}>
              {showChecklist ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            height: '4px',
            backgroundColor: darkMode ? '#334155' : '#e2e8f0',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${checklistProgress}%`,
              backgroundColor: checklistProgress === 100 ? '#10b981' : '#3b82f6',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Checklist Items */}
        {showChecklist && (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: `1px solid ${item.completed ? '#10b981' : theme.border}`,
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => toggleChecklistItem(idx)}
                >
                  <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                    {item.completed ? (
                      <CheckCircle size={20} color="#10b981" />
                    ) : (
                      <Circle size={20} color={theme.textSecondary} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: item.completed ? theme.textSecondary : theme.text,
                        textDecoration: item.completed ? 'line-through' : 'none',
                      }}
                    >
                      {item.item}
                    </div>
                    {item.description && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: theme.textSecondary,
                          marginTop: '0.25rem',
                          lineHeight: '1.4',
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Checklist Footer */}
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: theme.textSecondary,
                lineHeight: '1.5',
              }}
            >
              <strong>Note:</strong> This checklist provides a recommended workflow for model retraining. 
              Adjust steps based on your specific requirements and organizational processes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
