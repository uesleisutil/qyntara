"""
Example: Stock Ranking and Stability Monitoring

This example demonstrates how to use the StockRanker to:
1. Rank stocks by MAPE
2. Identify top performers
3. Calculate ranking stability
4. Trigger investigation alerts when stability is low
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pandas as pd
from datetime import datetime, timedelta
from ml.src.monitoring import StockRanker, AlertManager


def main():
    """Run stock ranking example"""
    
    # Initialize components
    ranker = StockRanker(stability_threshold=0.7)
    alert_manager = AlertManager()  # Will log alerts since no SNS configured
    
    print("=" * 60)
    print("Stock Ranking and Stability Monitoring Example")
    print("=" * 60)
    
    # Example 1: Rank stocks by MAPE
    print("\n1. Ranking stocks by MAPE")
    print("-" * 60)
    
    current_metrics = pd.DataFrame({
        'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 
                        'MGLU3', 'B3SA3', 'RENT3', 'WEGE3', 'RAIL3'],
        'mape': [5.2, 6.8, 4.5, 7.1, 5.9, 6.2, 5.5, 4.8, 5.1, 6.5]
    })
    
    ranked = ranker.rank_by_mape(current_metrics)
    print("\nCurrent Rankings:")
    print(ranked[['rank', 'stock_symbol', 'mape']].to_string(index=False))
    
    # Example 2: Get top 10 performers
    print("\n\n2. Top 10 Performers")
    print("-" * 60)
    
    top_10 = ranker.get_top_n(ranked, n=10)
    print("\nTop 10 stocks with lowest MAPE:")
    print(top_10[['rank', 'stock_symbol', 'mape']].to_string(index=False))
    
    # Example 3: Calculate ranking stability
    print("\n\n3. Ranking Stability Analysis")
    print("-" * 60)
    
    # Previous month's rankings (with some changes)
    previous_metrics = pd.DataFrame({
        'stock_symbol': ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 
                        'MGLU3', 'B3SA3', 'RENT3', 'WEGE3', 'RAIL3'],
        'mape': [5.5, 6.5, 4.8, 7.0, 6.2, 6.0, 5.8, 5.0, 5.3, 6.8]
    })
    
    previous_ranked = ranker.rank_by_mape(previous_metrics)
    
    correlation, needs_investigation = ranker.calculate_ranking_stability(
        ranked, previous_ranked
    )
    
    print(f"\nSpearman Correlation: {correlation:.4f}")
    print(f"Stability Threshold: {ranker.stability_threshold}")
    print(f"Needs Investigation: {needs_investigation}")
    
    if needs_investigation:
        print("\n⚠️  WARNING: Ranking instability detected!")
        print("Significant changes in stock rankings may indicate:")
        print("  - Market regime change")
        print("  - Model performance degradation")
        print("  - Data quality issues")
    else:
        print("\n✓ Rankings are stable")
    
    # Example 4: Detailed change analysis
    print("\n\n4. Detailed Ranking Changes")
    print("-" * 60)
    
    changes = ranker.analyze_ranking_changes(ranked, previous_ranked)
    
    print(f"\nCommon Stocks: {changes['common_stocks_count']}")
    print(f"New Entrants: {changes['new_entrants_count']}")
    print(f"Exits: {changes['exits_count']}")
    
    if changes['improved_count'] > 0:
        print(f"\nImproved Stocks ({changes['improved_count']}):")
        for stock in changes['improved_stocks'][:5]:  # Show top 5
            print(f"  {stock['stock_symbol']}: "
                  f"Rank {stock['previous_rank']} → {stock['current_rank']} "
                  f"(+{stock['rank_change']} positions)")
    
    if changes['declined_count'] > 0:
        print(f"\nDeclined Stocks ({changes['declined_count']}):")
        for stock in changes['declined_stocks'][:5]:  # Show top 5
            print(f"  {stock['stock_symbol']}: "
                  f"Rank {stock['previous_rank']} → {stock['current_rank']} "
                  f"({stock['rank_change']} positions)")
    
    # Example 5: Generate comprehensive report
    print("\n\n5. Comprehensive Ranking Report")
    print("-" * 60)
    
    report = ranker.generate_ranking_report(
        ranked,
        previous_ranked,
        report_date=datetime.now()
    )
    
    print(f"\nReport Date: {report['report_date']}")
    print(f"Total Stocks: {report['total_stocks']}")
    
    print("\nTop 10 Performers:")
    for i, stock in enumerate(report['top_10_performers'][:5], 1):
        print(f"  {i}. {stock['stock_symbol']}: MAPE {stock['mape']:.2f}%")
    
    if 'stability' in report:
        stability = report['stability']
        print(f"\nStability Metrics:")
        print(f"  Spearman Correlation: {stability['spearman_correlation']:.4f}")
        print(f"  Needs Investigation: {stability['needs_investigation']}")
    
    # Example 6: Time series ranking
    print("\n\n6. Time Series Ranking")
    print("-" * 60)
    
    # Create sample time series data
    dates = pd.date_range(start='2024-01-01', end='2024-01-05', freq='D')
    ts_data = []
    
    for date in dates:
        for stock in ['PETR4', 'VALE3', 'ITUB4']:
            # Simulate MAPE values with slight variations
            base_mape = {'PETR4': 5.2, 'VALE3': 6.8, 'ITUB4': 4.5}
            mape = base_mape[stock] + (hash(str(date) + stock) % 10) / 10
            ts_data.append({
                'date': date,
                'stock_symbol': stock,
                'mape': mape
            })
    
    ts_metrics = pd.DataFrame(ts_data)
    
    # Rank across time
    ranked_ts = ranker.rank_time_series(ts_metrics)
    
    print("\nRankings over time:")
    for date in dates[:3]:  # Show first 3 days
        day_ranks = ranked_ts[ranked_ts['date'] == date]
        print(f"\n{date.strftime('%Y-%m-%d')}:")
        for _, row in day_ranks.iterrows():
            print(f"  Rank {row['rank']}: {row['stock_symbol']} (MAPE: {row['mape']:.2f}%)")
    
    # Calculate stability over time
    stability_ts = ranker.calculate_stability_time_series(ranked_ts)
    
    print("\n\nStability over time:")
    for _, row in stability_ts.iterrows():
        prev_date = row['previous_date'].strftime('%Y-%m-%d')
        curr_date = row['current_date'].strftime('%Y-%m-%d')
        corr = row['spearman_correlation']
        needs_inv = "⚠️" if row['needs_investigation'] else "✓"
        print(f"  {prev_date} → {curr_date}: {corr:.4f} {needs_inv}")
    
    # Example 7: Integration with AlertManager
    print("\n\n7. Alert Integration")
    print("-" * 60)
    
    if needs_investigation:
        print("\nTriggering investigation alert...")
        
        # In production, this would send SNS notification
        alert_manager.send_performance_drift_alert(
            current_mape=ranked['mape'].mean(),
            baseline_mape=previous_ranked['mape'].mean(),
            mape_change_percentage=(ranked['mape'].mean() - previous_ranked['mape'].mean()) / previous_ranked['mape'].mean(),
            detection_date=datetime.now(),
            additional_info={
                'ranking_correlation': correlation,
                'stability_threshold': ranker.stability_threshold,
                'top_10_stocks': [s['stock_symbol'] for s in report['top_10_performers'][:10]]
            }
        )
        
        print("Alert sent (logged since SNS not configured)")
    else:
        print("\nNo alert needed - rankings are stable")
    
    print("\n" + "=" * 60)
    print("Example completed successfully!")
    print("=" * 60)


if __name__ == '__main__':
    main()
