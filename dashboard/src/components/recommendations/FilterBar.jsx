/**
 * FilterBar Component
 * 
 * Provides filter controls for recommendations:
 * - Sector dropdown filter (Req 1.1, 1.2)
 * - Return range slider (Req 1.1, 1.3)
 * - Minimum score slider (Req 1.1, 1.4)
 * - Clear filters button (Req 1.6)
 * - Filtered result count display (Req 1.8)
 * 
 * All filters work together (intersection) - Req 1.5
 * Filter selections persist during session - Req 1.7 (handled by FilterContext)
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Filter, X, Link2, Check } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import './FilterBar.css';

const FilterBar = ({ recommendations, onFilteredCountChange }) => {
  const { filters, setFilter, clearAllFilters } = useFilters();
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Extract unique sectors from recommendations
  const sectors = useMemo(() => {
    const uniqueSectors = [...new Set(recommendations.map(r => r.sector).filter(Boolean))];
    return uniqueSectors.sort();
  }, [recommendations]);

  // Calculate min/max return values for slider bounds
  const returnBounds = useMemo(() => {
    const returns = recommendations.map(r => (r.expected_return || r.exp_return_20 || 0) * 100);
    return {
      min: Math.floor(Math.min(...returns)),
      max: Math.ceil(Math.max(...returns))
    };
  }, [recommendations]);

  // Calculate score bounds
  const scoreBounds = useMemo(() => {
    const scores = recommendations.map(r => r.confidence_score || r.score || 0);
    return {
      min: Math.floor(Math.min(...scores)),
      max: Math.ceil(Math.max(...scores))
    };
  }, [recommendations]);

  // Apply filters to recommendations (Req 1.5 - intersection of all filters)
  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendations];

    // Sector filter (Req 1.2)
    if (filters.sector) {
      filtered = filtered.filter(r => r.sector === filters.sector);
    }

    // Return range filter (Req 1.3)
    if (filters.minReturn !== undefined || filters.maxReturn !== undefined) {
      filtered = filtered.filter(r => {
        const returnValue = (r.expected_return || r.exp_return_20 || 0) * 100;
        const minOk = filters.minReturn === undefined || returnValue >= filters.minReturn;
        const maxOk = filters.maxReturn === undefined || returnValue <= filters.maxReturn;
        return minOk && maxOk;
      });
    }

    // Minimum score filter (Req 1.4)
    if (filters.minScore !== undefined) {
      filtered = filtered.filter(r => {
        const score = r.confidence_score || r.score || 0;
        return score >= filters.minScore;
      });
    }

    return filtered;
  }, [recommendations, filters]);

  // Notify parent of filtered count (Req 1.8)
  React.useEffect(() => {
    if (onFilteredCountChange) {
      onFilteredCountChange(filteredRecommendations.length);
    }
  }, [filteredRecommendations.length, onFilteredCountChange]);

  const hasActiveFilters = filters.sector || filters.minReturn !== undefined || 
                          filters.maxReturn !== undefined || filters.minScore !== undefined;

  // Handler for clearing all filters (Req 1.6)
  const handleClearFilters = useCallback(() => {
    clearAllFilters();
  }, [clearAllFilters]);

  // Handler for copying shareable URL (Req 1.7)
  const handleCopyShareableUrl = useCallback(() => {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      }).catch(err => {
        console.error('Failed to copy URL:', err);
      });
    }
  }, []);

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      padding: '1.5rem',
      borderRadius: '8px',
      marginBottom: '1.5rem',
      border: '1px solid #e2e8f0'
    }}>
      {/* Header with filter count (Req 1.8) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={20} color="#64748b" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1a1836' }}>
            Filtros
          </h3>
        </div>
        
        {/* Filtered result count - prominently displayed (Req 1.8) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{
            fontSize: '0.875rem',
            fontWeight: hasActiveFilters ? '600' : '500',
            color: hasActiveFilters ? '#8b5cf6' : '#64748b',
            padding: '0.25rem 0.75rem',
            backgroundColor: hasActiveFilters ? '#eff6ff' : 'transparent',
            borderRadius: '6px',
            border: hasActiveFilters ? '1px solid #bfdbfe' : 'none'
          }}>
            {filteredRecommendations.length} de {recommendations.length} resultados
          </span>
          
          {/* Share URL Button (Req 1.7) */}
          {hasActiveFilters && (
            <button
              onClick={handleCopyShareableUrl}
              title="Copiar link com filtros para compartilhar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: showCopySuccess ? '#10b981' : 'white',
                border: '1px solid',
                borderColor: showCopySuccess ? '#10b981' : '#cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: showCopySuccess ? 'white' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                if (!showCopySuccess) {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                  e.currentTarget.style.borderColor = '#8b5cf6';
                  e.currentTarget.style.color = '#8b5cf6';
                }
              }}
              onMouseLeave={(e) => {
                if (!showCopySuccess) {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              {showCopySuccess ? (
                <>
                  <Check size={16} />
                  Copiado!
                </>
              ) : (
                <>
                  <Link2 size={16} />
                  Compartilhar
                </>
              )}
            </button>
          )}
          
          {/* Clear Filters Button (Req 1.6) */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fee2e2';
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <X size={16} />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls Grid (Req 1.1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Sector Filter (Req 1.1, 1.2) */}
        <div>
          <label 
            htmlFor="sector-filter"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
            Setor
          </label>
          <select
            id="sector-filter"
            value={filters.sector || ''}
            onChange={(e) => setFilter('sector', e.target.value || undefined)}
            style={{
              width: '100%',
              padding: '0.625rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            <option value="">Todos os setores</option>
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>

        {/* Return Range Filter - Min (Req 1.1, 1.3) */}
        <div>
          <label 
            htmlFor="min-return-filter"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
            <span>Retorno Mínimo (%)</span>
            <span style={{ 
              fontWeight: '500', 
              color: filters.minReturn !== undefined ? '#8b5cf6' : '#9895b0',
              fontSize: '0.875rem'
            }}>
              {filters.minReturn !== undefined ? filters.minReturn.toFixed(1) : returnBounds.min.toFixed(1)}
            </span>
          </label>
          <input
            id="min-return-filter"
            type="range"
            min={returnBounds.min}
            max={returnBounds.max}
            step="0.5"
            value={filters.minReturn ?? returnBounds.min}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              setFilter('minReturn', value !== returnBounds.min ? value : undefined);
            }}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#9895b0',
            marginTop: '0.25rem'
          }}>
            <span>{returnBounds.min.toFixed(1)}%</span>
            <span>{returnBounds.max.toFixed(1)}%</span>
          </div>
        </div>

        {/* Return Range Filter - Max (Req 1.1, 1.3) */}
        <div>
          <label 
            htmlFor="max-return-filter"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
            <span>Retorno Máximo (%)</span>
            <span style={{ 
              fontWeight: '500', 
              color: filters.maxReturn !== undefined ? '#8b5cf6' : '#9895b0',
              fontSize: '0.875rem'
            }}>
              {filters.maxReturn !== undefined ? filters.maxReturn.toFixed(1) : returnBounds.max.toFixed(1)}
            </span>
          </label>
          <input
            id="max-return-filter"
            type="range"
            min={returnBounds.min}
            max={returnBounds.max}
            step="0.5"
            value={filters.maxReturn ?? returnBounds.max}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              setFilter('maxReturn', value !== returnBounds.max ? value : undefined);
            }}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#9895b0',
            marginTop: '0.25rem'
          }}>
            <span>{returnBounds.min.toFixed(1)}%</span>
            <span>{returnBounds.max.toFixed(1)}%</span>
          </div>
        </div>

        {/* Minimum Score Filter (Req 1.1, 1.4) */}
        <div>
          <label 
            htmlFor="min-score-filter"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '0.5rem'
            }}>
            <span>Score Mínimo</span>
            <span style={{ 
              fontWeight: '500', 
              color: filters.minScore !== undefined ? '#8b5cf6' : '#9895b0',
              fontSize: '0.875rem'
            }}>
              {filters.minScore !== undefined ? filters.minScore.toFixed(0) : scoreBounds.min.toFixed(0)}
            </span>
          </label>
          <input
            id="min-score-filter"
            type="range"
            min={scoreBounds.min}
            max={scoreBounds.max}
            step="1"
            value={filters.minScore ?? scoreBounds.min}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              setFilter('minScore', value !== scoreBounds.min ? value : undefined);
            }}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#9895b0',
            marginTop: '0.25rem'
          }}>
            <span>{scoreBounds.min.toFixed(0)}</span>
            <span>{scoreBounds.max.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#1e40af',
            marginBottom: '0.5rem'
          }}>
            Filtros Ativos:
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#1e40af'
          }}>
            {filters.sector && (
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #bfdbfe'
              }}>
                Setor: {filters.sector}
              </span>
            )}
            {filters.minReturn !== undefined && (
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #bfdbfe'
              }}>
                Retorno Min: {filters.minReturn.toFixed(1)}%
              </span>
            )}
            {filters.maxReturn !== undefined && (
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #bfdbfe'
              }}>
                Retorno Max: {filters.maxReturn.toFixed(1)}%
              </span>
            )}
            {filters.minScore !== undefined && (
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #bfdbfe'
              }}>
                Score Min: {filters.minScore.toFixed(0)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
