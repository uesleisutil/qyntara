"""
Stock Ranker

Ranks stocks by MAPE in ascending order, identifies top performers,
and calculates ranking stability using Spearman correlation.

Requirements: 9.1, 9.2, 9.3, 9.4
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime
import numpy as np
import pandas as pd
from scipy.stats import spearmanr


class StockRanker:
    """
    Ranks stocks by MAPE and monitors ranking stability.
    
    Ranks stocks by MAPE in ascending order (lower MAPE = better rank),
    identifies top performers, and calculates ranking stability using
    Spearman correlation. Triggers investigation when correlation < 0.7.
    """
    
    def __init__(self, stability_threshold: float = 0.7):
        """
        Initialize the stock ranker.
        
        Args:
            stability_threshold: Threshold for ranking stability (default: 0.7)
                Correlation below this triggers investigation
        """
        self.stability_threshold = stability_threshold
    
    def rank_by_mape(self, stock_metrics: pd.DataFrame) -> pd.DataFrame:
        """
        Rank stocks by MAPE in ascending order.
        
        Lower MAPE = better rank (rank 1 is best).
        
        Args:
            stock_metrics: DataFrame with columns ['stock_symbol', 'mape']
            
        Returns:
            DataFrame with added 'rank' column, sorted by rank
            
        Raises:
            ValueError: If required columns are missing
        """
        # Validate input
        required_columns = ['stock_symbol', 'mape']
        missing_columns = [col for col in required_columns if col not in stock_metrics.columns]
        
        if missing_columns:
            raise ValueError(
                f"Missing required columns: {missing_columns}. "
                f"Expected columns: {required_columns}"
            )
        
        if len(stock_metrics) == 0:
            return pd.DataFrame(columns=['stock_symbol', 'mape', 'rank'])
        
        # Create a copy to avoid modifying original
        ranked = stock_metrics.copy()
        
        # Rank by MAPE (ascending order, lower is better)
        # rank=1 is best (lowest MAPE)
        ranked['rank'] = ranked['mape'].rank(method='min', ascending=True).astype(int)
        
        # Sort by rank
        ranked = ranked.sort_values('rank').reset_index(drop=True)
        
        return ranked
    
    def get_top_n(self, ranked_stocks: pd.DataFrame, n: int = 10) -> pd.DataFrame:
        """
        Get top N performers (lowest MAPE).
        
        Args:
            ranked_stocks: DataFrame with 'rank' column from rank_by_mape()
            n: Number of top performers to return (default: 10)
            
        Returns:
            DataFrame with top N stocks
            
        Raises:
            ValueError: If 'rank' column is missing
        """
        if 'rank' not in ranked_stocks.columns:
            raise ValueError("Input must have 'rank' column. Use rank_by_mape() first.")
        
        # Return top N by rank
        return ranked_stocks.nsmallest(n, 'rank').reset_index(drop=True)
    
    def calculate_ranking_stability(
        self,
        current_ranking: pd.DataFrame,
        previous_ranking: pd.DataFrame
    ) -> Tuple[float, bool]:
        """
        Calculate ranking stability using Spearman correlation.
        
        Compares rankings between two time periods. Returns correlation
        coefficient and whether investigation is needed.
        
        Args:
            current_ranking: DataFrame with 'stock_symbol' and 'rank' columns
            previous_ranking: DataFrame with 'stock_symbol' and 'rank' columns
            
        Returns:
            Tuple of (correlation, needs_investigation)
            - correlation: Spearman correlation coefficient (-1 to 1)
            - needs_investigation: True if correlation < threshold
            
        Raises:
            ValueError: If required columns are missing or no common stocks
        """
        # Validate inputs
        for df, name in [(current_ranking, 'current'), (previous_ranking, 'previous')]:
            required_columns = ['stock_symbol', 'rank']
            missing = [col for col in required_columns if col not in df.columns]
            if missing:
                raise ValueError(
                    f"Missing columns in {name}_ranking: {missing}. "
                    f"Expected: {required_columns}"
                )
        
        # Find common stocks
        current_stocks = set(current_ranking['stock_symbol'])
        previous_stocks = set(previous_ranking['stock_symbol'])
        common_stocks = current_stocks & previous_stocks
        
        if len(common_stocks) == 0:
            raise ValueError("No common stocks between current and previous rankings")
        
        # Filter to common stocks
        current_filtered = current_ranking[
            current_ranking['stock_symbol'].isin(common_stocks)
        ].set_index('stock_symbol')
        
        previous_filtered = previous_ranking[
            previous_ranking['stock_symbol'].isin(common_stocks)
        ].set_index('stock_symbol')
        
        # Align by stock symbol
        current_ranks = current_filtered.loc[sorted(common_stocks), 'rank'].values
        previous_ranks = previous_filtered.loc[sorted(common_stocks), 'rank'].values
        
        # Calculate Spearman correlation
        if len(current_ranks) < 2:
            # Need at least 2 data points for correlation
            correlation = 1.0  # Perfect stability with single stock
        else:
            correlation, _ = spearmanr(current_ranks, previous_ranks)
            
            # Handle NaN (can occur if all ranks are identical)
            if np.isnan(correlation):
                correlation = 1.0
        
        # Check if investigation is needed
        needs_investigation = correlation < self.stability_threshold
        
        return float(correlation), needs_investigation
    
    def analyze_ranking_changes(
        self,
        current_ranking: pd.DataFrame,
        previous_ranking: pd.DataFrame
    ) -> Dict[str, any]:
        """
        Analyze changes between two rankings.
        
        Provides detailed analysis of ranking changes including:
        - Stocks that improved/declined
        - New entrants and exits
        - Largest rank changes
        
        Args:
            current_ranking: DataFrame with 'stock_symbol', 'rank', 'mape' columns
            previous_ranking: DataFrame with 'stock_symbol', 'rank', 'mape' columns
            
        Returns:
            Dictionary with analysis results
        """
        # Find common stocks
        current_stocks = set(current_ranking['stock_symbol'])
        previous_stocks = set(previous_ranking['stock_symbol'])
        common_stocks = current_stocks & previous_stocks
        
        # Create lookup dictionaries
        current_dict = current_ranking.set_index('stock_symbol').to_dict('index')
        previous_dict = previous_ranking.set_index('stock_symbol').to_dict('index')
        
        # Analyze changes for common stocks
        changes = []
        for stock in common_stocks:
            current_rank = current_dict[stock]['rank']
            previous_rank = previous_dict[stock]['rank']
            rank_change = previous_rank - current_rank  # Positive = improved
            
            changes.append({
                'stock_symbol': stock,
                'current_rank': current_rank,
                'previous_rank': previous_rank,
                'rank_change': rank_change,
                'current_mape': current_dict[stock]['mape'],
                'previous_mape': previous_dict[stock].get('mape', None)
            })
        
        changes_df = pd.DataFrame(changes)
        
        # Identify new entrants and exits
        new_entrants = list(current_stocks - previous_stocks)
        exits = list(previous_stocks - current_stocks)
        
        # Find largest improvements and declines
        if len(changes_df) > 0:
            improved = changes_df[changes_df['rank_change'] > 0].sort_values(
                'rank_change', ascending=False
            )
            declined = changes_df[changes_df['rank_change'] < 0].sort_values(
                'rank_change', ascending=True
            )
        else:
            improved = pd.DataFrame()
            declined = pd.DataFrame()
        
        return {
            'common_stocks_count': len(common_stocks),
            'new_entrants': new_entrants,
            'new_entrants_count': len(new_entrants),
            'exits': exits,
            'exits_count': len(exits),
            'improved_stocks': improved.to_dict('records'),
            'improved_count': len(improved),
            'declined_stocks': declined.to_dict('records'),
            'declined_count': len(declined),
            'stable_stocks_count': len(changes_df[changes_df['rank_change'] == 0])
        }
    
    def generate_ranking_report(
        self,
        current_ranking: pd.DataFrame,
        previous_ranking: Optional[pd.DataFrame] = None,
        report_date: Optional[datetime] = None
    ) -> Dict[str, any]:
        """
        Generate comprehensive ranking report.
        
        Args:
            current_ranking: Current ranking DataFrame
            previous_ranking: Optional previous ranking for stability analysis
            report_date: Optional report date (defaults to now)
            
        Returns:
            Dictionary with complete ranking report
        """
        if report_date is None:
            report_date = datetime.now()
        
        # Get top 10 performers
        top_10 = self.get_top_n(current_ranking, n=10)
        
        report = {
            'report_date': report_date.isoformat(),
            'total_stocks': len(current_ranking),
            'top_10_performers': top_10[['stock_symbol', 'rank', 'mape']].to_dict('records')
        }
        
        # Add stability analysis if previous ranking provided
        if previous_ranking is not None:
            try:
                correlation, needs_investigation = self.calculate_ranking_stability(
                    current_ranking,
                    previous_ranking
                )
                
                report['stability'] = {
                    'spearman_correlation': correlation,
                    'needs_investigation': needs_investigation,
                    'threshold': self.stability_threshold
                }
                
                # Add detailed change analysis
                changes = self.analyze_ranking_changes(current_ranking, previous_ranking)
                report['changes'] = changes
                
            except ValueError as e:
                report['stability'] = {
                    'error': str(e),
                    'spearman_correlation': None,
                    'needs_investigation': False
                }
        
        return report
    
    def rank_time_series(
        self,
        metrics_data: pd.DataFrame,
        date_column: str = 'date',
        stock_column: str = 'stock_symbol',
        mape_column: str = 'mape'
    ) -> pd.DataFrame:
        """
        Rank stocks across multiple time periods.
        
        Args:
            metrics_data: DataFrame with date, stock_symbol, and mape columns
            date_column: Name of date column
            stock_column: Name of stock symbol column
            mape_column: Name of MAPE column
            
        Returns:
            DataFrame with rankings for each date
        """
        # Validate columns
        required = [date_column, stock_column, mape_column]
        missing = [col for col in required if col not in metrics_data.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        
        # Ensure date column is datetime
        metrics_data = metrics_data.copy()
        metrics_data[date_column] = pd.to_datetime(metrics_data[date_column])
        
        # Group by date and rank
        ranked_list = []
        
        for date, group in metrics_data.groupby(date_column):
            # Prepare data for ranking
            stock_metrics = group[[stock_column, mape_column]].rename(
                columns={stock_column: 'stock_symbol', mape_column: 'mape'}
            )
            
            # Rank stocks
            ranked = self.rank_by_mape(stock_metrics)
            ranked[date_column] = date
            
            ranked_list.append(ranked)
        
        # Combine all rankings
        all_rankings = pd.concat(ranked_list, ignore_index=True)
        
        return all_rankings
    
    def calculate_stability_time_series(
        self,
        ranked_time_series: pd.DataFrame,
        date_column: str = 'date'
    ) -> pd.DataFrame:
        """
        Calculate ranking stability across consecutive time periods.
        
        Args:
            ranked_time_series: DataFrame from rank_time_series()
            date_column: Name of date column
            
        Returns:
            DataFrame with stability metrics for each date pair
        """
        # Sort by date
        ranked_time_series = ranked_time_series.sort_values(date_column)
        
        # Get unique dates
        dates = sorted(ranked_time_series[date_column].unique())
        
        if len(dates) < 2:
            return pd.DataFrame(columns=[
                'previous_date', 'current_date', 'spearman_correlation',
                'needs_investigation'
            ])
        
        stability_results = []
        
        # Compare consecutive dates
        for i in range(1, len(dates)):
            previous_date = dates[i-1]
            current_date = dates[i]
            
            previous_ranking = ranked_time_series[
                ranked_time_series[date_column] == previous_date
            ]
            current_ranking = ranked_time_series[
                ranked_time_series[date_column] == current_date
            ]
            
            try:
                correlation, needs_investigation = self.calculate_ranking_stability(
                    current_ranking,
                    previous_ranking
                )
                
                stability_results.append({
                    'previous_date': previous_date,
                    'current_date': current_date,
                    'spearman_correlation': correlation,
                    'needs_investigation': needs_investigation
                })
            except ValueError:
                # Skip if no common stocks
                continue
        
        return pd.DataFrame(stability_results)
