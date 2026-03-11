import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import TickerDetailModal from './recommendations/TickerDetailModal';

/**
 * RecommendationsTable Component
 * 
 * Displays stock recommendations with:
 * - Sortable columns
 * - Pagination (if > 100 rows)
 * - Click to view details modal
 * - Rank badges
 * - Color-coded returns
 * 
 * Requirements: 10.3, 10.4, 10.7, 20.5
 */
const RecommendationsTable = React.memo(({ recommendations }) => {
  const [sortColumn, setSortColumn] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTicker, setSelectedTicker] = useState(null);
  
  const itemsPerPage = 50;
  const shouldPaginate = recommendations.length > 100; // Req 20.5

  // Ordenação
  const sortedRecommendations = useMemo(() => {
    const sorted = [...recommendations].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'ticker':
          aVal = a.ticker || '';
          bVal = b.ticker || '';
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        
        case 'score':
          aVal = a.confidence_score || a.score || 0;
          bVal = b.confidence_score || b.score || 0;
          break;
        
        case 'return':
          aVal = a.expected_return || a.exp_return_20 || 0;
          bVal = b.expected_return || b.exp_return_20 || 0;
          break;
        
        case 'sector':
          aVal = a.sector || '';
          bVal = b.sector || '';
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
  }, [recommendations, sortColumn, sortDirection]);

  // Paginação
  const totalPages = Math.ceil(sortedRecommendations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = shouldPaginate 
    ? sortedRecommendations.slice(startIndex, endIndex)
    : sortedRecommendations.slice(0, 50);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleTickerClick = (rec) => {
    setSelectedTicker(rec);
  };

  if (sortedRecommendations.length === 0) {
    return <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nenhuma recomendação disponível</p>;
  }

  return (
    <>
      <div className="recommendations-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="recommendations-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Rank</th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => handleSort('ticker')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Ticker
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer' }}
                onClick={() => handleSort('score')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  Score
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer' }}
                onClick={() => handleSort('return')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  Retorno Prev.
                  <ArrowUpDown size={14} />
                </div>
              </th>
              <th 
                style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => handleSort('sector')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Setor
                  <ArrowUpDown size={14} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((rec, idx) => {
              const globalRank = startIndex + idx + 1;
              const returnValue = rec.expected_return || rec.exp_return_20 || 0;
              const scoreValue = rec.confidence_score || rec.score || 0;
              
              return (
                <tr 
                  key={idx}
                  onClick={() => handleTickerClick(rec)}
                  style={{ 
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: globalRank <= 10 ? '#fef3c7' : '#e2e8f0',
                      color: globalRank <= 10 ? '#92400e' : '#475569',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      #{globalRank}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <strong style={{ color: '#1e293b' }}>{rec.ticker}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: '#475569' }}>
                    {scoreValue.toFixed(1)}
                  </td>
                  <td style={{ 
                    padding: '0.75rem', 
                    textAlign: 'right',
                    color: returnValue >= 0 ? '#10b981' : '#ef4444',
                    fontWeight: '600'
                  }}>
                    {(returnValue * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.875rem' }}>
                    {rec.sector || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {shouldPaginate && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1rem',
          padding: '0.75rem',
          borderTop: '1px solid #e2e8f0'
        }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
            Mostrando {startIndex + 1} a {Math.min(endIndex, sortedRecommendations.length)} de {sortedRecommendations.length} recomendações
          </p>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                background: currentPage === 1 ? '#f8fafc' : 'white',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            
            <span style={{ 
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              color: '#475569',
              fontSize: '0.875rem'
            }}>
              Página {currentPage} de {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                background: currentPage === totalPages ? '#f8fafc' : 'white',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal de detalhes */}
      {selectedTicker && (
        <TickerDetailModal 
          ticker={selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </>
  );
});

RecommendationsTable.displayName = 'RecommendationsTable';

export default RecommendationsTable;
