"""
Unit tests for Stock Ranker
"""

import unittest
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

from src.monitoring.stock_ranker import StockRanker


class TestStockRanker(unittest.TestCase):
    """Test cases for StockRanker"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.ranker = StockRanker(stability_threshold=0.7)
        
        # Create sample stock metrics
        self.sample_metrics = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3'],
            'mape': [5.2, 6.8, 4.5, 7.1, 5.9]
        })
    
    def test_initialization(self):
        """Test ranker initialization"""
        self.assertEqual(self.ranker.stability_threshold, 0.7)
        
        # Test custom threshold
        custom_ranker = StockRanker(stability_threshold=0.8)
        self.assertEqual(custom_ranker.stability_threshold, 0.8)
    
    def test_rank_by_mape(self):
        """Test ranking stocks by MAPE"""
        ranked = self.ranker.rank_by_mape(self.sample_metrics)
        
        # Check that rank column is added
        self.assertIn('rank', ranked.columns)
        
        # Check that stocks are sorted by rank
        self.assertTrue(ranked['rank'].is_monotonic_increasing)
        
        # Check that lowest MAPE gets rank 1
        best_stock = ranked.iloc[0]
        self.assertEqual(best_stock['stock_symbol'], 'ITUB4')  # MAPE 4.5
        self.assertEqual(best_stock['rank'], 1)
        
        # Check that highest MAPE gets highest rank
        worst_stock = ranked.iloc[-1]
        self.assertEqual(worst_stock['stock_symbol'], 'BBDC4')  # MAPE 7.1
        self.assertEqual(worst_stock['rank'], 5)
    
    def test_rank_by_mape_missing_columns(self):
        """Test ranking with missing columns"""
        invalid_data = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3']
            # Missing 'mape' column
        })
        
        with self.assertRaises(ValueError) as context:
            self.ranker.rank_by_mape(invalid_data)
        
        self.assertIn("Missing required columns", str(context.exception))
    
    def test_rank_by_mape_empty_data(self):
        """Test ranking with empty DataFrame"""
        empty_data = pd.DataFrame(columns=['stock_symbol', 'mape'])
        
        ranked = self.ranker.rank_by_mape(empty_data)
        
        self.assertEqual(len(ranked), 0)
        self.assertIn('rank', ranked.columns)
    
    def test_rank_by_mape_ties(self):
        """Test ranking with tied MAPE values"""
        tied_metrics = pd.DataFrame({
            'stock_symbol': ['STOCK1', 'STOCK2', 'STOCK3', 'STOCK4'],
            'mape': [5.0, 5.0, 6.0, 4.0]
        })
        
        ranked = self.ranker.rank_by_mape(tied_metrics)
        
        # Both stocks with MAPE 5.0 should get rank 2 (min method)
        tied_stocks = ranked[ranked['mape'] == 5.0]
        self.assertTrue(all(tied_stocks['rank'] == 2))
        
        # Stock with MAPE 4.0 should get rank 1
        best_stock = ranked[ranked['mape'] == 4.0]
        self.assertEqual(best_stock['rank'].iloc[0], 1)
    
    def test_get_top_n(self):
        """Test getting top N performers"""
        ranked = self.ranker.rank_by_mape(self.sample_metrics)
        
        top_3 = self.ranker.get_top_n(ranked, n=3)
        
        # Should return 3 stocks
        self.assertEqual(len(top_3), 3)
        
        # Should be sorted by rank
        self.assertTrue(top_3['rank'].is_monotonic_increasing)
        
        # First stock should be ITUB4 (lowest MAPE)
        self.assertEqual(top_3.iloc[0]['stock_symbol'], 'ITUB4')
    
    def test_get_top_n_default(self):
        """Test getting top 10 performers (default)"""
        # Create data with 15 stocks
        large_metrics = pd.DataFrame({
            'stock_symbol': [f'STOCK{i}' for i in range(15)],
            'mape': np.random.uniform(4.0, 8.0, 15)
        })
        
        ranked = self.ranker.rank_by_mape(large_metrics)
        top_10 = self.ranker.get_top_n(ranked)
        
        # Should return 10 stocks
        self.assertEqual(len(top_10), 10)
        
        # All should have rank <= 10
        self.assertTrue(all(top_10['rank'] <= 10))
    
    def test_get_top_n_missing_rank(self):
        """Test getting top N without rank column"""
        unranked_data = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3'],
            'mape': [5.2, 6.8]
        })
        
        with self.assertRaises(ValueError) as context:
            self.ranker.get_top_n(unranked_data)
        
        self.assertIn("rank", str(context.exception))
    
    def test_calculate_ranking_stability_stable(self):
        """Test stability calculation with stable rankings"""
        # Create two identical rankings
        current = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4'],
            'rank': [1, 2, 3]
        })
        
        previous = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4'],
            'rank': [1, 2, 3]
        })
        
        correlation, needs_investigation = self.ranker.calculate_ranking_stability(
            current, previous
        )
        
        # Perfect correlation
        self.assertAlmostEqual(correlation, 1.0, places=6)
        self.assertFalse(needs_investigation)
    
    def test_calculate_ranking_stability_unstable(self):
        """Test stability calculation with unstable rankings"""
        # Create rankings with significant changes
        current = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3'],
            'rank': [1, 2, 3, 4, 5]
        })
        
        previous = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3'],
            'rank': [5, 4, 3, 2, 1]  # Completely reversed
        })
        
        correlation, needs_investigation = self.ranker.calculate_ranking_stability(
            current, previous
        )
        
        # Should have negative correlation
        self.assertLess(correlation, 0)
        self.assertTrue(needs_investigation)
    
    def test_calculate_ranking_stability_at_threshold(self):
        """Test stability calculation at exact threshold"""
        # Create rankings with correlation exactly at 0.7
        # This requires careful construction
        current = pd.DataFrame({
            'stock_symbol': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
            'rank': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        })
        
        # Swap some rankings to get correlation around 0.7
        previous = pd.DataFrame({
            'stock_symbol': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
            'rank': [1, 3, 2, 5, 4, 6, 8, 7, 10, 9]
        })
        
        correlation, needs_investigation = self.ranker.calculate_ranking_stability(
            current, previous
        )
        
        # Correlation should be high but not perfect
        self.assertGreater(correlation, 0.6)
        self.assertLess(correlation, 1.0)
    
    def test_calculate_ranking_stability_missing_columns(self):
        """Test stability calculation with missing columns"""
        invalid_current = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3']
            # Missing 'rank' column
        })
        
        valid_previous = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3'],
            'rank': [1, 2]
        })
        
        with self.assertRaises(ValueError) as context:
            self.ranker.calculate_ranking_stability(invalid_current, valid_previous)
        
        self.assertIn("Missing columns", str(context.exception))
    
    def test_calculate_ranking_stability_no_common_stocks(self):
        """Test stability calculation with no common stocks"""
        current = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3'],
            'rank': [1, 2]
        })
        
        previous = pd.DataFrame({
            'stock_symbol': ['ITUB4', 'BBDC4'],
            'rank': [1, 2]
        })
        
        with self.assertRaises(ValueError) as context:
            self.ranker.calculate_ranking_stability(current, previous)
        
        self.assertIn("No common stocks", str(context.exception))
    
    def test_calculate_ranking_stability_partial_overlap(self):
        """Test stability calculation with partial stock overlap"""
        current = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4'],
            'rank': [1, 2, 3, 4]
        })
        
        previous = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ABEV3', 'MGLU3'],
            'rank': [2, 1, 3, 4]
        })
        
        # Should only compare PETR4 and VALE3 (common stocks)
        correlation, needs_investigation = self.ranker.calculate_ranking_stability(
            current, previous
        )
        
        # With only 2 stocks, correlation should be calculable
        self.assertIsInstance(correlation, float)
        self.assertFalse(np.isnan(correlation))
    
    def test_calculate_ranking_stability_single_stock(self):
        """Test stability calculation with single common stock"""
        current = pd.DataFrame({
            'stock_symbol': ['PETR4'],
            'rank': [1]
        })
        
        previous = pd.DataFrame({
            'stock_symbol': ['PETR4'],
            'rank': [1]
        })
        
        correlation, needs_investigation = self.ranker.calculate_ranking_stability(
            current, previous
        )
        
        # Single stock should have perfect stability
        self.assertEqual(correlation, 1.0)
        self.assertFalse(needs_investigation)
    
    def test_analyze_ranking_changes(self):
        """Test detailed ranking change analysis"""
        current = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4'],
            'rank': [1, 2, 3, 4],
            'mape': [4.5, 5.0, 5.5, 6.0]
        })
        
        previous = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'ABEV3'],
            'rank': [2, 1, 4, 3],
            'mape': [5.0, 4.8, 6.0, 5.5]
        })
        
        changes = self.ranker.analyze_ranking_changes(current, previous)
        
        # Check structure
        self.assertIn('common_stocks_count', changes)
        self.assertIn('new_entrants', changes)
        self.assertIn('exits', changes)
        self.assertIn('improved_stocks', changes)
        self.assertIn('declined_stocks', changes)
        
        # Check counts
        self.assertEqual(changes['common_stocks_count'], 3)  # PETR4, VALE3, ITUB4
        self.assertEqual(changes['new_entrants_count'], 1)  # BBDC4
        self.assertEqual(changes['exits_count'], 1)  # ABEV3
        
        # PETR4 improved from rank 2 to 1
        improved = changes['improved_stocks']
        petr4_change = [s for s in improved if s['stock_symbol'] == 'PETR4'][0]
        self.assertEqual(petr4_change['rank_change'], 1)  # Positive = improved
    
    def test_generate_ranking_report_without_previous(self):
        """Test report generation without previous ranking"""
        ranked = self.ranker.rank_by_mape(self.sample_metrics)
        
        report = self.ranker.generate_ranking_report(ranked)
        
        # Check structure
        self.assertIn('report_date', report)
        self.assertIn('total_stocks', report)
        self.assertIn('top_10_performers', report)
        
        # Check values
        self.assertEqual(report['total_stocks'], 5)
        self.assertEqual(len(report['top_10_performers']), 5)  # Only 5 stocks total
        
        # Should not have stability section
        self.assertNotIn('stability', report)
    
    def test_generate_ranking_report_with_previous(self):
        """Test report generation with previous ranking"""
        current = self.ranker.rank_by_mape(self.sample_metrics)
        
        previous_metrics = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3'],
            'mape': [5.5, 6.5, 4.8, 7.0, 6.2]
        })
        previous = self.ranker.rank_by_mape(previous_metrics)
        
        report = self.ranker.generate_ranking_report(current, previous)
        
        # Check structure
        self.assertIn('stability', report)
        self.assertIn('changes', report)
        
        # Check stability section
        stability = report['stability']
        self.assertIn('spearman_correlation', stability)
        self.assertIn('needs_investigation', stability)
        self.assertIn('threshold', stability)
        
        # Check changes section
        changes = report['changes']
        self.assertIn('improved_stocks', changes)
        self.assertIn('declined_stocks', changes)
    
    def test_rank_time_series(self):
        """Test ranking across multiple time periods"""
        # Create time series data
        dates = pd.date_range(start='2024-01-01', end='2024-01-03', freq='D')
        
        data = []
        for date in dates:
            for stock in ['PETR4', 'VALE3', 'ITUB4']:
                data.append({
                    'date': date,
                    'stock_symbol': stock,
                    'mape': np.random.uniform(4.0, 7.0)
                })
        
        metrics_data = pd.DataFrame(data)
        
        ranked_ts = self.ranker.rank_time_series(metrics_data)
        
        # Check structure
        self.assertIn('date', ranked_ts.columns)
        self.assertIn('stock_symbol', ranked_ts.columns)
        self.assertIn('rank', ranked_ts.columns)
        
        # Should have 3 dates × 3 stocks = 9 rows
        self.assertEqual(len(ranked_ts), 9)
        
        # Each date should have ranks 1, 2, 3
        for date in dates:
            date_ranks = ranked_ts[ranked_ts['date'] == date]['rank'].sort_values()
            self.assertEqual(list(date_ranks), [1, 2, 3])
    
    def test_rank_time_series_missing_columns(self):
        """Test time series ranking with missing columns"""
        invalid_data = pd.DataFrame({
            'date': ['2024-01-01'],
            'stock_symbol': ['PETR4']
            # Missing 'mape' column
        })
        
        with self.assertRaises(ValueError) as context:
            self.ranker.rank_time_series(invalid_data)
        
        self.assertIn("Missing required columns", str(context.exception))
    
    def test_calculate_stability_time_series(self):
        """Test stability calculation across time series"""
        # Create ranked time series
        dates = pd.date_range(start='2024-01-01', end='2024-01-05', freq='D')
        
        data = []
        for i, date in enumerate(dates):
            # Create consistent rankings with small variations
            for j, stock in enumerate(['PETR4', 'VALE3', 'ITUB4']):
                data.append({
                    'date': date,
                    'stock_symbol': stock,
                    'rank': j + 1 + (i % 2)  # Small rank variations
                })
        
        ranked_ts = pd.DataFrame(data)
        
        stability_ts = self.ranker.calculate_stability_time_series(ranked_ts)
        
        # Should have 4 comparisons (5 dates - 1)
        self.assertEqual(len(stability_ts), 4)
        
        # Check structure
        self.assertIn('previous_date', stability_ts.columns)
        self.assertIn('current_date', stability_ts.columns)
        self.assertIn('spearman_correlation', stability_ts.columns)
        self.assertIn('needs_investigation', stability_ts.columns)
    
    def test_calculate_stability_time_series_single_date(self):
        """Test stability calculation with single date"""
        single_date_data = pd.DataFrame({
            'date': ['2024-01-01', '2024-01-01', '2024-01-01'],
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4'],
            'rank': [1, 2, 3]
        })
        
        stability_ts = self.ranker.calculate_stability_time_series(single_date_data)
        
        # Should return empty DataFrame (no consecutive dates to compare)
        self.assertEqual(len(stability_ts), 0)
    
    def test_rank_by_mape_preserves_additional_columns(self):
        """Test that ranking preserves additional columns"""
        metrics_with_extra = pd.DataFrame({
            'stock_symbol': ['PETR4', 'VALE3', 'ITUB4'],
            'mape': [5.2, 6.8, 4.5],
            'coverage': [91.5, 90.2, 92.1],
            'sector': ['Energy', 'Materials', 'Finance']
        })
        
        ranked = self.ranker.rank_by_mape(metrics_with_extra)
        
        # Additional columns should be preserved
        self.assertIn('coverage', ranked.columns)
        self.assertIn('sector', ranked.columns)
    
    def test_custom_stability_threshold(self):
        """Test ranker with custom stability threshold"""
        strict_ranker = StockRanker(stability_threshold=0.9)
        
        current = pd.DataFrame({
            'stock_symbol': ['A', 'B', 'C', 'D', 'E'],
            'rank': [1, 2, 3, 4, 5]
        })
        
        previous = pd.DataFrame({
            'stock_symbol': ['A', 'B', 'C', 'D', 'E'],
            'rank': [1, 3, 2, 4, 5]  # Small change
        })
        
        correlation, needs_investigation = strict_ranker.calculate_ranking_stability(
            current, previous
        )
        
        # With strict threshold (0.9), even small changes might trigger investigation
        # Correlation should be high but might be below 0.9
        self.assertGreater(correlation, 0.8)
    
    def test_report_date_formatting(self):
        """Test that report date is properly formatted"""
        ranked = self.ranker.rank_by_mape(self.sample_metrics)
        
        report_date = datetime(2024, 3, 15, 10, 30, 0)
        report = self.ranker.generate_ranking_report(ranked, report_date=report_date)
        
        # Check that date is in ISO format
        self.assertEqual(report['report_date'], '2024-03-15T10:30:00')


if __name__ == '__main__':
    unittest.main()
