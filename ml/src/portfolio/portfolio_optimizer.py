"""
Portfolio Optimizer - Modern Portfolio Theory (Markowitz)

Optimizes portfolio allocation based on expected returns and risk.
Calculates optimal weights for each stock to maximize Sharpe ratio.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class PortfolioOptimizer:
    """
    Portfolio optimization using Modern Portfolio Theory.
    
    Features:
    - Equal weight portfolio
    - Risk-based allocation
    - Constraints (min/max weights)
    
    Note: Simplified version without scipy for Lambda compatibility
    """
    
    def __init__(
        self,
        risk_free_rate: float = 0.1075,  # Selic rate ~10.75%
        min_weight: float = 0.0,
        max_weight: float = 0.20  # Max 20% per stock
    ):
        """
        Initialize portfolio optimizer.
        
        Args:
            risk_free_rate: Risk-free rate (annual)
            min_weight: Minimum weight per stock
            max_weight: Maximum weight per stock
        """
        self.risk_free_rate = risk_free_rate
        self.min_weight = min_weight
        self.max_weight = max_weight
    
    def calculate_portfolio_metrics(
        self,
        weights: np.ndarray,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray
    ) -> Tuple[float, float, float]:
        """
        Calculate portfolio return, volatility, and Sharpe ratio.
        
        Args:
            weights: Portfolio weights
            expected_returns: Expected returns for each asset
            cov_matrix: Covariance matrix
            
        Returns:
            Tuple of (return, volatility, sharpe_ratio)
        """
        portfolio_return = np.dot(weights, expected_returns)
        portfolio_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        sharpe_ratio = (portfolio_return - self.risk_free_rate) / portfolio_volatility
        
        return portfolio_return, portfolio_volatility, sharpe_ratio
    
    def optimize_max_sharpe(
        self,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray
    ) -> Dict:
        """
        Optimize portfolio for maximum Sharpe ratio.
        Simplified version using risk-weighted allocation.
        
        Args:
            expected_returns: Expected returns for each asset
            cov_matrix: Covariance matrix
            
        Returns:
            Dictionary with optimal weights and metrics
        """
        n_assets = len(expected_returns)
        
        # Simple risk-weighted allocation
        # Weight inversely proportional to volatility
        volatilities = np.sqrt(np.diag(cov_matrix))
        inv_vol = 1.0 / (volatilities + 1e-8)
        
        # Normalize to sum to 1
        weights = inv_vol / inv_vol.sum()
        
        # Apply constraints
        weights = np.clip(weights, self.min_weight, self.max_weight)
        weights = weights / weights.sum()  # Renormalize
        
        portfolio_return, portfolio_volatility, sharpe_ratio = self.calculate_portfolio_metrics(
            weights, expected_returns, cov_matrix
        )
        
        return {
            'weights': weights.tolist(),
            'expected_return': float(portfolio_return),
            'volatility': float(portfolio_volatility),
            'sharpe_ratio': float(sharpe_ratio),
            'optimization_success': True
        }
    
    def optimize_min_variance(
        self,
        cov_matrix: np.ndarray
    ) -> Dict:
        """
        Optimize portfolio for minimum variance.
        Simplified version using equal weights.
        
        Args:
            cov_matrix: Covariance matrix
            
        Returns:
            Dictionary with optimal weights and metrics
        """
        n_assets = cov_matrix.shape[0]
        
        # Equal weight portfolio (simplified)
        weights = np.ones(n_assets) / n_assets
        
        # Apply constraints
        weights = np.clip(weights, self.min_weight, self.max_weight)
        weights = weights / weights.sum()
        
        portfolio_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        
        return {
            'weights': weights.tolist(),
            'volatility': float(portfolio_volatility),
            'optimization_success': True
        }
    
    def optimize_risk_parity(
        self,
        cov_matrix: np.ndarray
    ) -> Dict:
        """
        Optimize portfolio for risk parity (equal risk contribution).
        Simplified version using inverse volatility weighting.
        
        Args:
            cov_matrix: Covariance matrix
            
        Returns:
            Dictionary with optimal weights and metrics
        """
        n_assets = cov_matrix.shape[0]
        
        # Inverse volatility weighting (simplified risk parity)
        volatilities = np.sqrt(np.diag(cov_matrix))
        inv_vol = 1.0 / (volatilities + 1e-8)
        weights = inv_vol / inv_vol.sum()
        
        # Apply constraints
        weights = np.clip(weights, self.min_weight, self.max_weight)
        weights = weights / weights.sum()
        
        portfolio_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        
        return {
            'weights': weights.tolist(),
            'volatility': float(portfolio_volatility),
            'optimization_success': True
        }
    
    def calculate_allocation(
        self,
        recommendations: pd.DataFrame,
        capital: float,
        strategy: str = 'max_sharpe'
    ) -> Dict:
        """
        Calculate optimal portfolio allocation.
        
        Args:
            recommendations: DataFrame with stock recommendations
            capital: Total capital to invest
            strategy: Optimization strategy ('max_sharpe', 'min_variance', 'risk_parity')
            
        Returns:
            Dictionary with allocation details
        """
        # Extract expected returns
        expected_returns = recommendations['predicted_return'].values
        tickers = recommendations['ticker'].values
        
        # Estimate covariance matrix (simplified - should use historical data)
        # For now, use a simple correlation structure
        n_assets = len(expected_returns)
        correlation = 0.3  # Assumed average correlation
        volatilities = np.abs(expected_returns) * 2  # Simplified volatility estimate
        
        cov_matrix = np.outer(volatilities, volatilities) * correlation
        np.fill_diagonal(cov_matrix, volatilities ** 2)
        
        # Optimize based on strategy
        if strategy == 'max_sharpe':
            result = self.optimize_max_sharpe(expected_returns, cov_matrix)
        elif strategy == 'min_variance':
            result = self.optimize_min_variance(cov_matrix)
        elif strategy == 'risk_parity':
            result = self.optimize_risk_parity(cov_matrix)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
        
        # Calculate allocation amounts
        weights = np.array(result['weights'])
        allocations = weights * capital
        
        # Filter out zero allocations
        allocation_df = pd.DataFrame({
            'ticker': tickers,
            'weight': weights,
            'amount': allocations,
            'shares': allocations / recommendations['current_price'].values if 'current_price' in recommendations.columns else allocations / 100
        })
        
        allocation_df = allocation_df[allocation_df['weight'] > 0.001].sort_values('weight', ascending=False)
        
        return {
            'strategy': strategy,
            'total_capital': capital,
            'allocations': allocation_df.to_dict('records'),
            'portfolio_metrics': {
                'expected_return': result.get('expected_return', 0),
                'volatility': result.get('volatility', 0),
                'sharpe_ratio': result.get('sharpe_ratio', 0)
            },
            'diversification': {
                'n_stocks': len(allocation_df),
                'max_weight': float(allocation_df['weight'].max()),
                'min_weight': float(allocation_df['weight'].min()),
                'herfindahl_index': float((allocation_df['weight'] ** 2).sum())
            }
        }
