/**
 * AlertsPanel Component
 * 
 * Displays and manages ticker alerts:
 * - Shows active alerts
 * - Allows editing and deleting alerts
 * - Persists alerts in DynamoDB via API
 * - Displays triggered alerts
 * 
 * Requirements: 5.4, 5.5, 5.6, 5.7, 5.8
 */

import React, { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, AlertCircle, RefreshCw } from 'lucide-react';
import AlertConfigModal from './AlertConfigModal';
import api from '../../services/api';

const AlertsPanel = ({ recommendations }) => {
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load alerts from API (Req 5.5)
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.alerts.getAll();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setError('Falha ao carregar alertas. Usando dados locais.');
      
      // Fallback to localStorage if API fails
      const stored = localStorage.getItem('ticker_alerts');
      if (stored) {
        try {
          setAlerts(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to load alerts from localStorage:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Check for triggered alerts (Req 5.4)
  useEffect(() => {
    if (!recommendations || recommendations.length === 0 || alerts.length === 0) return;

    checkTriggeredAlerts();
  }, [recommendations, alerts]);

  const checkTriggeredAlerts = async () => {
    try {
      const data = await api.alerts.checkTriggered(recommendations);
      setTriggeredAlerts(data.triggered || []);
    } catch (err) {
      console.error('Failed to check triggered alerts:', err);
      // Fallback to client-side checking
      checkTriggeredAlertsLocally();
    }
  };

  const checkTriggeredAlertsLocally = () => {
    const triggered = [];
    
    alerts.forEach(alert => {
      if (!alert.enabled) return;

      const ticker = recommendations.find(r => r.ticker === alert.ticker);
      if (!ticker) return;

      // Check condition based on type
      let isTriggered = false;
      let message = '';

      switch (alert.conditionType) {
        case 'score_change':
          const currentScore = ticker.confidence_score || ticker.score || 0;
          const previousScore = alert.lastValue || currentScore;
          const scoreDiff = Math.abs(currentScore - previousScore);
          
          if (scoreDiff >= alert.threshold) {
            isTriggered = true;
            message = `Score mudou ${scoreDiff.toFixed(1)} pontos (threshold: ${alert.threshold})`;
          }
          break;

        case 'return_change':
          const currentReturn = (ticker.expected_return || ticker.exp_return_20 || 0) * 100;
          const previousReturn = alert.lastValue || currentReturn;
          const returnDiff = Math.abs(currentReturn - previousReturn);
          
          if (returnDiff >= alert.threshold) {
            isTriggered = true;
            message = `Retorno mudou ${returnDiff.toFixed(2)}% (threshold: ${alert.threshold}%)`;
          }
          break;

        case 'rank_change':
          const currentRank = recommendations.findIndex(r => r.ticker === alert.ticker) + 1;
          const previousRank = alert.lastValue || currentRank;
          const rankDiff = Math.abs(currentRank - previousRank);
          
          if (rankDiff >= alert.threshold) {
            isTriggered = true;
            message = `Ranking mudou ${rankDiff} posições (threshold: ${alert.threshold})`;
          }
          break;
      }

      if (isTriggered) {
        triggered.push({
          ...alert,
          message,
          timestamp: new Date().toISOString()
        });
      }
    });

    setTriggeredAlerts(triggered);
  };

  const handleSaveAlert = async (alertData) => {
    try {
      if (alertData.id && alerts.find(a => a.id === alertData.id)) {
        // Update existing alert (Req 5.6)
        await api.alerts.update(alertData.id, alertData);
        setAlerts(prev => prev.map(a => a.id === alertData.id ? alertData : a));
      } else {
        // Create new alert
        const response = await api.alerts.create(alertData);
        const newAlert = response.alert || alertData;
        setAlerts(prev => [...prev, newAlert]);
      }
      
      // Also save to localStorage as backup
      localStorage.setItem('ticker_alerts', JSON.stringify(alerts));
    } catch (err) {
      console.error('Failed to save alert:', err);
      alert('Falha ao salvar alerta. Tente novamente.');
    }
  };

  const handleDeleteAlert = async (alertId) => {
    try {
      // Delete from API (Req 5.7)
      await api.alerts.delete(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      
      // Also update localStorage
      const updated = alerts.filter(a => a.id !== alertId);
      localStorage.setItem('ticker_alerts', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to delete alert:', err);
      alert('Falha ao excluir alerta. Tente novamente.');
    }
  };

  const handleEditAlert = (alert) => {
    setEditingAlert(alert);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAlert(null);
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '1.5rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={20} color="#3b82f6" />
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Alertas Configurados
          </h3>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={loadAlerts}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              backgroundColor: 'white',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
            aria-label="Atualizar alertas"
          >
            <RefreshCw size={16} />
          </button>
          
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            Novo Alerta
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#dc2626'
        }}>
          {error}
        </div>
      )}

      {/* Triggered Alerts (Req 5.4) */}
      {triggeredAlerts.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#dc2626',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            Alertas Disparados
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {triggeredAlerts.map((alert, idx) => (
              <div key={idx} style={{
                padding: '0.75rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px'
              }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#991b1b', margin: '0 0 0.25rem 0' }}>
                  {alert.ticker}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#dc2626', margin: 0 }}>
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ 
          textAlign: 'center', 
          color: '#64748b', 
          fontSize: '0.875rem', 
          padding: '2rem 0' 
        }}>
          Carregando alertas...
        </div>
      )}

      {/* Active Alerts List (Req 5.8) */}
      {!loading && alerts.length === 0 && (
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', padding: '2rem 0' }}>
          Nenhum alerta configurado. Clique em "Novo Alerta" para criar um.
        </p>
      )}

      {!loading && alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{
              padding: '1rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: alert.enabled ? 'white' : '#f8fafc'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#1e293b' 
                  }}>
                    {alert.ticker}
                  </span>
                  {!alert.enabled && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#e2e8f0',
                      color: '#64748b',
                      borderRadius: '4px'
                    }}>
                      Inativo
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  {CONDITION_TYPES.find(t => t.value === alert.conditionType)?.label || alert.conditionType} • 
                  Threshold: {alert.threshold}
                </p>
              </div>
              
              <button
                onClick={() => handleEditAlert(alert)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  borderRadius: '4px'
                }}
                aria-label="Editar alerta"
              >
                <Edit2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Alert Config Modal */}
      {showModal && (
        <AlertConfigModal
          existingAlert={editingAlert}
          onClose={handleCloseModal}
          onSave={handleSaveAlert}
          onDelete={handleDeleteAlert}
        />
      )}
    </div>
  );
};

const CONDITION_TYPES = [
  { value: 'score_change', label: 'Mudança no Score' },
  { value: 'return_change', label: 'Mudança no Retorno' },
  { value: 'rank_change', label: 'Mudança no Ranking' }
];

export default AlertsPanel;
