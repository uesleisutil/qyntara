/**
 * ComparisonControls Component
 * 
 * Provides controls for multi-ticker comparison:
 * - Toggle comparison mode
 * - Display checkboxes for ticker selection
 * - Enable compare button when tickers selected
 * - Limit selection to 5 tickers
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.8
 */

import React, { useState } from 'react';
import { GitCompare, X } from 'lucide-react';
import ComparisonModal from './ComparisonModal';

const ComparisonControls = ({ recommendations }) => {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const MAX_SELECTION = 5; // Req 4.8

  const handleToggleComparison = () => {
    setComparisonMode(!comparisonMode);
    if (comparisonMode) {
      // Clear selections when exiting comparison mode
      setSelectedTickers([]);
    }
  };

  const handleTickerSelect = (ticker) => {
    setSelectedTickers(prev => {
      const isSelected = prev.some(t => t.ticker === ticker.ticker);
      
      if (isSelected) {
        // Remove ticker
        return prev.filter(t => t.ticker !== ticker.ticker);
      } else {
        // Add ticker if under limit (Req 4.8)
        if (prev.length < MAX_SELECTION) {
          return [...prev, ticker];
        } else {
          alert(`Você pode selecionar no máximo ${MAX_SELECTION} tickers para comparação.`);
          return prev;
        }
      }
    });
  };

  const handleCompare = () => {
    if (selectedTickers.length >= 2) {
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {/* Comparison Mode Toggle (Req 4.1) */}
        <button
          onClick={handleToggleComparison}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: comparisonMode ? '#8b5cf6' : 'white',
            color: comparisonMode ? 'white' : '#64748b',
            border: '1px solid',
            borderColor: comparisonMode ? '#8b5cf6' : '#cbd5e1',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <GitCompare size={16} />
          {comparisonMode ? 'Sair do Modo Comparação' : 'Modo Comparação'}
        </button>

        {/* Compare Button (Req 4.3) */}
        {comparisonMode && (
          <>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
              {selectedTickers.length} de {MAX_SELECTION} selecionados
            </span>
            
            <button
              onClick={handleCompare}
              disabled={selectedTickers.length < 2}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: selectedTickers.length >= 2 ? '#10b981' : '#e2e8f0',
                color: selectedTickers.length >= 2 ? 'white' : '#9895b0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: selectedTickers.length >= 2 ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              Comparar Selecionados
            </button>

            <button
              onClick={() => setSelectedTickers([])}
              disabled={selectedTickers.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'white',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: selectedTickers.length > 0 ? 'pointer' : 'not-allowed',
                opacity: selectedTickers.length > 0 ? 1 : 0.5,
                transition: 'all 0.2s'
              }}
            >
              <X size={16} />
              Limpar Seleção
            </button>
          </>
        )}
      </div>

      {/* Render checkboxes in table rows when comparison mode is active (Req 4.2) */}
      {comparisonMode && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0 }}>
            <strong>Modo de comparação ativo:</strong> Clique nas caixas de seleção ao lado de cada ticker para comparar até {MAX_SELECTION} ações.
          </p>
        </div>
      )}

      {/* Comparison Modal (Req 4.4) */}
      {showModal && (
        <ComparisonModal 
          tickers={selectedTickers}
          onClose={handleCloseModal}
        />
      )}

      {/* Export comparison mode state and handlers for use in table */}
      <div style={{ display: 'none' }}>
        {/* This component exports its state through props drilling or context */}
      </div>
    </>
  );
};

// Export helper hook for table integration
export const useComparison = () => {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState([]);

  const toggleComparison = () => {
    setComparisonMode(!comparisonMode);
    if (comparisonMode) {
      setSelectedTickers([]);
    }
  };

  const toggleTickerSelection = (ticker) => {
    setSelectedTickers(prev => {
      const isSelected = prev.some(t => t.ticker === ticker.ticker);
      
      if (isSelected) {
        return prev.filter(t => t.ticker !== ticker.ticker);
      } else {
        if (prev.length < 5) {
          return [...prev, ticker];
        } else {
          alert('Você pode selecionar no máximo 5 tickers para comparação.');
          return prev;
        }
      }
    });
  };

  const isSelected = (ticker) => {
    return selectedTickers.some(t => t.ticker === ticker.ticker);
  };

  const clearSelection = () => {
    setSelectedTickers([]);
  };

  return {
    comparisonMode,
    selectedTickers,
    toggleComparison,
    toggleTickerSelection,
    isSelected,
    clearSelection
  };
};

export default ComparisonControls;
