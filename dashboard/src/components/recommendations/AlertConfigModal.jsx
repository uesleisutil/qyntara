/**
 * AlertConfigModal Component
 * 
 * Modal for configuring ticker alerts:
 * - Create alerts with ticker, condition type, and threshold
 * - Support score change, return change, rank change conditions
 * - Edit and delete existing alerts
 * - Store alerts in localStorage (to be replaced with DynamoDB)
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.6, 5.7
 */

import React, { useState, useEffect } from 'react';
import { X, Bell, Save, Trash2 } from 'lucide-react';

const CONDITION_TYPES = [
  { value: 'score_change', label: 'Mudança no Score' },
  { value: 'return_change', label: 'Mudança no Retorno' },
  { value: 'rank_change', label: 'Mudança no Ranking' }
];

const AlertConfigModal = ({ ticker, existingAlert, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState({
    ticker: ticker || '',
    conditionType: 'score_change',
    threshold: '',
    enabled: true
  });

  const [errors, setErrors] = useState({});

  // Load existing alert data if editing
  useEffect(() => {
    if (existingAlert) {
      setFormData({
        ticker: existingAlert.ticker,
        conditionType: existingAlert.conditionType,
        threshold: existingAlert.threshold.toString(),
        enabled: existingAlert.enabled
      });
    }
  }, [existingAlert]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.ticker.trim()) {
      newErrors.ticker = 'Ticker é obrigatório';
    }

    if (!formData.threshold || isNaN(parseFloat(formData.threshold))) {
      newErrors.threshold = 'Threshold deve ser um número válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const alertData = {
      id: existingAlert?.id || Date.now().toString(),
      ticker: formData.ticker.toUpperCase(),
      conditionType: formData.conditionType,
      threshold: parseFloat(formData.threshold),
      enabled: formData.enabled,
      createdAt: existingAlert?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(alertData);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja excluir este alerta?')) {
      onDelete(existingAlert.id);
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={24} color="#3b82f6" />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1a1d27' }}>
              {existingAlert ? 'Editar Alerta' : 'Novo Alerta'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#64748b'
            }}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Ticker Input (Req 5.2) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
              Ticker *
            </label>
            <input
              type="text"
              value={formData.ticker}
              onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
              disabled={!!existingAlert}
              placeholder="Ex: PETR4"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${errors.ticker ? '#ef4444' : '#cbd5e1'}`,
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: existingAlert ? '#f8fafc' : 'white'
              }}
            />
            {errors.ticker && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0.25rem 0 0 0' }}>
                {errors.ticker}
              </p>
            )}
          </div>

          {/* Condition Type (Req 5.2, 5.3) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
              Tipo de Condição *
            </label>
            <select
              value={formData.conditionType}
              onChange={(e) => setFormData({ ...formData, conditionType: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {CONDITION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Threshold (Req 5.2) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
              Threshold *
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.threshold}
              onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
              placeholder="Ex: 5.0"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${errors.threshold ? '#ef4444' : '#cbd5e1'}`,
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
            {errors.threshold && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0.25rem 0 0 0' }}>
                {errors.threshold}
              </p>
            )}
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
              {formData.conditionType === 'score_change' && 'Alerta quando o score mudar mais que este valor'}
              {formData.conditionType === 'return_change' && 'Alerta quando o retorno mudar mais que este valor (%)'}
              {formData.conditionType === 'rank_change' && 'Alerta quando o ranking mudar mais que este valor'}
            </p>
          </div>

          {/* Enabled Toggle */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem', color: '#475569' }}>
                Alerta ativo
              </span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem',
            justifyContent: existingAlert ? 'space-between' : 'flex-end'
          }}>
            {existingAlert && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={16} />
                Excluir
              </button>
            )}
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'white',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              
              <button
                type="submit"
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
                <Save size={16} />
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertConfigModal;
