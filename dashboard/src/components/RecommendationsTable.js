import React from 'react';

/**
 * RecommendationsTable Component
 * 
 * Displays the top 10 stock recommendations in a table format with:
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
  // Sort recommendations by rank in ascending order and take top 10
  const sortedRecommendations = [...recommendations]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10);

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
                <span className="rank-badge">#{rec.rank}</span>
              </td>
              <td><strong>{rec.ticker}</strong></td>
              <td>{(rec.score * 100).toFixed(1)}%</td>
              <td className={rec.predicted_return >= 0 ? 'positive' : 'negative'}>
                {(rec.predicted_return * 100).toFixed(2)}%
              </td>
              <td>{rec.sector}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

RecommendationsTable.displayName = 'RecommendationsTable';

export default RecommendationsTable;
