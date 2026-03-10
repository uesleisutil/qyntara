import React from 'react';

/**
 * RecommendationsTable Component
 * 
 * Displays the top 50 stock recommendations in a table format with:
 * - Rank badges
 * - Ticker symbols
 * - Scores (as percentages)
 * - Predicted returns (color-coded: green for positive, red for negative)
 * - Sector information
 * 
 * Requirements: 1.2, 1.5, 1.4, 1.3
 * 
 * Performance optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 */
const RecommendationsTable = React.memo(({ recommendations }) => {
  // Sort recommendations by score in descending order and take top 50
  const sortedRecommendations = [...recommendations]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  if (sortedRecommendations.length === 0) {
    return <p>Nenhuma recomendação disponível</p>;
  }

  return (
    <div className="recommendations-table-wrapper">
      <table className="recommendations-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Ticker</th>
            <th>Score</th>
            <th>Retorno Prev.</th>
            <th>Setor</th>
          </tr>
        </thead>
        <tbody>
          {sortedRecommendations.map((rec, idx) => (
            <tr key={idx}>
              <td>
                <span className="rank-badge">#{idx + 1}</span>
              </td>
              <td><strong>{rec.ticker}</strong></td>
              <td>{rec.score ? rec.score.toFixed(1) : 'N/A'}</td>
              <td className={(rec.exp_return_20 || 0) >= 0 ? 'positive' : 'negative'}>
                {rec.exp_return_20 ? (rec.exp_return_20 * 100).toFixed(2) + '%' : 'N/A'}
              </td>
              <td>{rec.sector || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

RecommendationsTable.displayName = 'RecommendationsTable';

export default RecommendationsTable;
