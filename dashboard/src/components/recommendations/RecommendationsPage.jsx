/**
 * RecommendationsPage Component
 * 
 * Main page for recommendations with all enhancements:
 * - Filter controls
 * - Export functionality
 * - Comparison mode
 * - Alerts panel
 * - Enhanced table with all features
 * 
 * Requirements: 1.x, 2.x, 3.x, 4.x, 5.x
 */

import React, { useState, useMemo } from 'react';
import RecommendationsKPIs from './RecommendationsKPIs';
import FilterBar from './FilterBar';
import ExportButton from './ExportButton';
import ComparisonModal from './ComparisonModal';
import AlertsPanel from './AlertsPanel';
import RecommendationsTable from './RecommendationsTable';
import { GitCompare, X, Bell } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';

const RecommendationsPage = ({ recommendations }) => {
  const { filters } = useFilters();
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [filteredCount, setFilteredCount] = useState(recommendations.length);

  const MAX_SELECTION = 5;

  // Apply filters to recommendations (Req 1.5)
  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendations];

    // Sector filter
    if (filters.sector) {
      filtered = filtered.filter(r => r.sector === filters.sector);
    }

    // Return range filter
    if (filters.minReturn !== undefined || filters.maxReturn !== undefined) {
      filtered = filtered.filter(r => {
        const returnValue = (r.expected_return || r.exp_return_20 || 0) * 100;
        const minOk = filters.minReturn === undefined || returnValue >= filters.minReturn;
        const maxOk = filters.maxReturn === undefined || returnValue <= filters.maxReturn;
        return minOk && maxOk;
      });
    }

    // Minimum score filter
    if (filters.minScore !== undefined) {
      filtered = filtered.filter(r => {
        const score = r.confidence_score || r.score || 0;
        return score >= filters.minScore;
      });
    }

    return filtered;
  }, [recommendations, filters]);

  const handleToggleComparison = () => {
    setComparisonMode(!comparisonMode);
    if (comparisonMode) {
      setSelectedTickers([]);
    }
  };

  const handleTickerSelect = (ticker) => {
    setSelectedTickers(prev => {
      const isSelected = prev.some(t => t.ticker === ticker.ticker);
      
      if (isSelected) {
        return prev.filter(t => t.ticker !== ticker.ticker);
      } else {
        if (prev.length < MAX_SELECTION) {
          return [...prev, ticker];
        } else {
          alert(`Você pode selecionar no máximo ${MAX_SELECTION} tickers para comparação.`);
          return prev;
        }
      }
    });
  };

  const isSelected = (ticker) => {
    return selectedTickers.some(t => t.ticker === ticker.ticker);
  };

  const handleCompare = () => {
    if (selectedTickers.length >= 2) {
      setShowComparison(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPIs */}
      <RecommendationsKPIs recommendations={filteredRecommendations} />

      {/* Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Comparison Mode Toggle */}
          <button
            onClick={handleToggleComparison}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: comparisonMode ? '#3b82f6' : 'white',
              color: comparisonMode ? 'white' : '#64748b',
              border: '1px solid',
              borderColor: comparisonMode ? '#3b82f6' : '#cbd5e1',
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

          {/* Comparison Controls */}
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
                  color: selectedTickers.length >= 2 ? 'white' : '#6b7280',
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
                Limpar
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Alerts Toggle */}
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: showAlerts ? '#3b82f6' : 'white',
              color: showAlerts ? 'white' : '#64748b',
              border: '1px solid',
              borderColor: showAlerts ? '#3b82f6' : '#cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Bell size={16} />
            Alertas
          </button>

          {/* Export Button */}
          <ExportButton 
            data={filteredRecommendations}
            filename="recommendations"
          />
        </div>
      </div>

      {/* Comparison Mode Info */}
      {comparisonMode && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '0.875rem', color: '#2563eb', margin: 0 }}>
            <strong>Modo de comparação ativo:</strong> Clique nas caixas de seleção ao lado de cada ticker para comparar até {MAX_SELECTION} ações.
          </p>
        </div>
      )}

      {/* Alerts Panel */}
      {showAlerts && (
        <AlertsPanel recommendations={filteredRecommendations} />
      )}

      {/* Filters */}
      <FilterBar 
        recommendations={recommendations}
        onFilteredCountChange={setFilteredCount}
      />

      {/* Table */}
      <RecommendationsTable 
        recommendations={filteredRecommendations}
        comparisonMode={comparisonMode}
        onTickerSelect={handleTickerSelect}
        isSelected={isSelected}
      />

      {/* Comparison Modal */}
      {showComparison && (
        <ComparisonModal 
          tickers={selectedTickers}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
};

export default RecommendationsPage;
