"""
Stop Loss / Take Profit Calculator

Calculates optimal stop loss and take profit levels based on:
- ATR (Average True Range)
- Volatility
- Support/Resistance levels
- Risk/Reward ratio
"""

from __future__ import annotations

import logging
from typing import Dict

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class StopLossCalculator:
    """
    Calculate stop loss and take profit levels for risk management.
    
    Methods:
    - ATR-based stops
    - Percentage-based stops
    - Support/resistance-based stops
    - Trailing stops
    """
    
    def __init__(
        self,
        atr_multiplier_stop: float = 2.0,
        atr_multiplier_target: float = 3.0,
        risk_reward_ratio: float = 1.5
    ):
        """
        Initialize calculator.
        
        Args:
            atr_multiplier_stop: ATR multiplier for stop loss (default: 2.0)
            atr_multiplier_target: ATR multiplier for take profit (default: 3.0)
            risk_reward_ratio: Minimum risk/reward ratio (default: 1.5)
        """
        self.atr_multiplier_stop = atr_multiplier_stop
        self.atr_multiplier_target = atr_multiplier_target
        self.risk_reward_ratio = risk_reward_ratio
    
    def calculate_atr(
        self,
        high: pd.Series,
        low: pd.Series,
        close: pd.Series,
        period: int = 14
    ) -> pd.Series:
        """
        Calculate Average True Range (ATR).
        
        Args:
            high: High prices
            low: Low prices
            close: Close prices
            period: ATR period (default: 14)
            
        Returns:
            Series with ATR values
        """
        # True Range
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        # ATR (exponential moving average of TR)
        atr = tr.ewm(span=period, adjust=False).mean()
        
        return atr
    
    def calculate_atr_stops(
        self,
        current_price: float,
        atr: float,
        position_type: str = 'long'
    ) -> Dict:
        """
        Calculate ATR-based stop loss and take profit.
        
        Args:
            current_price: Current stock price
            atr: Current ATR value
            position_type: 'long' or 'short'
            
        Returns:
            Dictionary with stop loss and take profit levels
        """
        if position_type == 'long':
            stop_loss = current_price - (self.atr_multiplier_stop * atr)
            take_profit = current_price + (self.atr_multiplier_target * atr)
        else:  # short
            stop_loss = current_price + (self.atr_multiplier_stop * atr)
            take_profit = current_price - (self.atr_multiplier_target * atr)
        
        risk = abs(current_price - stop_loss)
        reward = abs(take_profit - current_price)
        risk_reward = reward / risk if risk > 0 else 0
        
        return {
            'stop_loss': float(stop_loss),
            'take_profit': float(take_profit),
            'risk': float(risk),
            'reward': float(reward),
            'risk_reward_ratio': float(risk_reward),
            'stop_loss_pct': float((stop_loss - current_price) / current_price),
            'take_profit_pct': float((take_profit - current_price) / current_price)
        }
    
    def calculate_position_size(
        self,
        account_balance: float,
        risk_per_trade_pct: float,
        entry_price: float,
        stop_loss: float
    ) -> Dict:
        """
        Calculate optimal position size based on risk.
        
        Args:
            account_balance: Total account balance
            risk_per_trade_pct: Risk per trade as percentage (e.g., 0.02 for 2%)
            entry_price: Entry price
            stop_loss: Stop loss price
            
        Returns:
            Dictionary with position sizing details
        """
        risk_amount = account_balance * risk_per_trade_pct
        risk_per_share = abs(entry_price - stop_loss)
        
        if risk_per_share == 0:
            return {
                'shares': 0,
                'position_value': 0,
                'risk_amount': 0,
                'error': 'Invalid stop loss (same as entry price)'
            }
        
        shares = int(risk_amount / risk_per_share)
        position_value = shares * entry_price
        
        # Check if position is too large
        max_position_pct = 0.20  # Max 20% of account per position
        max_position_value = account_balance * max_position_pct
        
        if position_value > max_position_value:
            shares = int(max_position_value / entry_price)
            position_value = shares * entry_price
            actual_risk = shares * risk_per_share
        else:
            actual_risk = risk_amount
        
        return {
            'shares': int(shares),
            'position_value': float(position_value),
            'position_pct': float(position_value / account_balance),
            'risk_amount': float(actual_risk),
            'risk_pct': float(actual_risk / account_balance),
            'risk_per_share': float(risk_per_share)
        }
    
    def generate_recommendations(
        self,
        ticker: str,
        current_price: float,
        price_data: pd.DataFrame,
        account_balance: float,
        risk_per_trade_pct: float = 0.02
    ) -> Dict:
        """
        Generate complete stop loss/take profit recommendations.
        
        Args:
            ticker: Stock ticker
            current_price: Current price
            price_data: Historical price data (high, low, close)
            account_balance: Account balance
            risk_per_trade_pct: Risk per trade percentage
            
        Returns:
            Dictionary with all recommendations
        """
        # Calculate ATR
        atr = self.calculate_atr(
            price_data['high'],
            price_data['low'],
            price_data['close']
        ).iloc[-1]
        
        # ATR-based stops
        atr_stops = self.calculate_atr_stops(current_price, atr)
        
        # Position sizing
        position_size = self.calculate_position_size(
            account_balance,
            risk_per_trade_pct,
            current_price,
            atr_stops['stop_loss']
        )
        
        return {
            'ticker': ticker,
            'current_price': float(current_price),
            'atr': float(atr),
            'atr_based': atr_stops,
            'position_sizing': position_size,
            'recommendation': {
                'entry_price': float(current_price),
                'stop_loss': atr_stops['stop_loss'],
                'take_profit': atr_stops['take_profit'],
                'shares': position_size['shares'],
                'total_investment': position_size['position_value'],
                'max_loss': position_size['risk_amount'],
                'expected_profit': position_size['shares'] * atr_stops['reward']
            }
        }
