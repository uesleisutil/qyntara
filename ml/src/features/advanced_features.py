"""
Feature Engineering Avançado para Previsão de Retornos

Implementa features técnicas sofisticadas baseadas em:
- Análise técnica (RSI, MACD, Bollinger Bands, ATR)
- Momentum e reversão à média
- Volatilidade e risco
- Padrões de volume
- Features de regime de mercado
"""

import numpy as np
import pandas as pd
from typing import List, Dict
from statistics import pstdev


class AdvancedFeatureEngineer:
    """
    Engenharia de features avançada para séries temporais financeiras.
    """
    
    def __init__(self, lookback_short: int = 5, lookback_medium: int = 20, lookback_long: int = 60):
        self.lookback_short = lookback_short
        self.lookback_medium = lookback_medium
        self.lookback_long = lookback_long
    
    def calculate_rsi(self, prices: np.ndarray, period: int = 14) -> float:
        """Relative Strength Index"""
        if len(prices) < period + 1:
            return 50.0
        
        deltas = np.diff(prices[-period-1:])
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return float(rsi)
    
    def calculate_macd(self, prices: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, float]:
        """Moving Average Convergence Divergence"""
        if len(prices) < slow:
            return {'macd': 0.0, 'signal': 0.0, 'histogram': 0.0}
        
        # EMA
        ema_fast = self._ema(prices, fast)
        ema_slow = self._ema(prices, slow)
        
        macd_line = ema_fast - ema_slow
        
        # Signal line (EMA do MACD)
        macd_values = [macd_line]  # Simplificado
        signal_line = macd_line  # Simplificado
        
        histogram = macd_line - signal_line
        
        return {
            'macd': float(macd_line),
            'signal': float(signal_line),
            'histogram': float(histogram)
        }
    
    def _ema(self, prices: np.ndarray, period: int) -> float:
        """Exponential Moving Average"""
        if len(prices) < period:
            return np.mean(prices)
        
        multiplier = 2 / (period + 1)
        ema = np.mean(prices[:period])
        
        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema
        
        return ema
    
    def calculate_bollinger_bands(self, prices: np.ndarray, period: int = 20, num_std: float = 2.0) -> Dict[str, float]:
        """Bollinger Bands"""
        if len(prices) < period:
            return {'upper': prices[-1], 'middle': prices[-1], 'lower': prices[-1], 'bandwidth': 0.0, 'percent_b': 0.5}
        
        recent = prices[-period:]
        middle = np.mean(recent)
        std = np.std(recent)
        
        upper = middle + (num_std * std)
        lower = middle - (num_std * std)
        
        # Bandwidth (volatilidade relativa)
        bandwidth = (upper - lower) / middle if middle > 0 else 0.0
        
        # %B (posição do preço nas bandas)
        current_price = prices[-1]
        if upper != lower:
            percent_b = (current_price - lower) / (upper - lower)
        else:
            percent_b = 0.5
        
        return {
            'upper': float(upper),
            'middle': float(middle),
            'lower': float(lower),
            'bandwidth': float(bandwidth),
            'percent_b': float(percent_b)
        }
    
    def calculate_atr(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> float:
        """Average True Range (volatilidade)"""
        if len(closes) < period + 1:
            return 0.0
        
        # True Range
        tr_list = []
        for i in range(1, len(closes)):
            high_low = highs[i] - lows[i]
            high_close = abs(highs[i] - closes[i-1])
            low_close = abs(lows[i] - closes[i-1])
            tr = max(high_low, high_close, low_close)
            tr_list.append(tr)
        
        # ATR (média do TR)
        atr = np.mean(tr_list[-period:])
        
        return float(atr)
    
    def calculate_momentum_features(self, prices: np.ndarray) -> Dict[str, float]:
        """Features de momentum"""
        features = {}
        
        # Retornos em diferentes períodos
        for period in [1, 5, 10, 20]:
            if len(prices) > period:
                ret = (prices[-1] / prices[-period-1]) - 1.0
                features[f'return_{period}d'] = float(ret)
            else:
                features[f'return_{period}d'] = 0.0
        
        # Aceleração do momentum
        if len(prices) > 10:
            ret_5d = (prices[-1] / prices[-6]) - 1.0
            ret_10d = (prices[-6] / prices[-11]) - 1.0
            features['momentum_acceleration'] = float(ret_5d - ret_10d)
        else:
            features['momentum_acceleration'] = 0.0
        
        return features
    
    def calculate_volatility_features(self, prices: np.ndarray) -> Dict[str, float]:
        """Features de volatilidade"""
        features = {}
        
        # Volatilidade em diferentes períodos
        for period in [5, 10, 20]:
            if len(prices) > period:
                returns = [(prices[i] / prices[i-1]) - 1.0 for i in range(-period, 0)]
                vol = pstdev(returns) if len(returns) > 1 else 0.0
                features[f'volatility_{period}d'] = float(vol)
            else:
                features[f'volatility_{period}d'] = 0.0
        
        # Volatilidade relativa (vol curto / vol longo)
        if features['volatility_5d'] > 0 and features['volatility_20d'] > 0:
            features['volatility_ratio'] = features['volatility_5d'] / features['volatility_20d']
        else:
            features['volatility_ratio'] = 1.0
        
        return features
    
    def calculate_mean_reversion_features(self, prices: np.ndarray) -> Dict[str, float]:
        """Features de reversão à média"""
        features = {}
        
        # Distância das médias móveis
        for period in [5, 20, 60]:
            if len(prices) >= period:
                ma = np.mean(prices[-period:])
                distance = (prices[-1] / ma) - 1.0
                features[f'distance_from_ma{period}'] = float(distance)
            else:
                features[f'distance_from_ma{period}'] = 0.0
        
        # Z-score (quantos desvios padrão da média)
        if len(prices) >= 20:
            recent = prices[-20:]
            mean = np.mean(recent)
            std = np.std(recent)
            if std > 0:
                z_score = (prices[-1] - mean) / std
                features['z_score_20d'] = float(z_score)
            else:
                features['z_score_20d'] = 0.0
        else:
            features['z_score_20d'] = 0.0
        
        return features
    
    def calculate_trend_features(self, prices: np.ndarray) -> Dict[str, float]:
        """Features de tendência"""
        features = {}
        
        # Inclinação da regressão linear
        if len(prices) >= 20:
            x = np.arange(len(prices[-20:]))
            y = prices[-20:]
            
            # Regressão linear simples
            x_mean = np.mean(x)
            y_mean = np.mean(y)
            
            numerator = np.sum((x - x_mean) * (y - y_mean))
            denominator = np.sum((x - x_mean) ** 2)
            
            if denominator > 0:
                slope = numerator / denominator
                features['trend_slope_20d'] = float(slope / y_mean) if y_mean > 0 else 0.0
            else:
                features['trend_slope_20d'] = 0.0
        else:
            features['trend_slope_20d'] = 0.0
        
        # Força da tendência (ADX simplificado)
        if len(prices) >= 14:
            # Direção do movimento
            up_moves = []
            down_moves = []
            
            for i in range(-13, 0):
                move = prices[i] - prices[i-1]
                if move > 0:
                    up_moves.append(move)
                    down_moves.append(0)
                else:
                    up_moves.append(0)
                    down_moves.append(abs(move))
            
            avg_up = np.mean(up_moves)
            avg_down = np.mean(down_moves)
            
            if avg_up + avg_down > 0:
                features['trend_strength'] = float(abs(avg_up - avg_down) / (avg_up + avg_down))
            else:
                features['trend_strength'] = 0.0
        else:
            features['trend_strength'] = 0.0
        
        return features
    
    def calculate_regime_features(self, prices: np.ndarray) -> Dict[str, float]:
        """Features de regime de mercado"""
        features = {}
        
        # Volatilidade regime (alta vs baixa)
        if len(prices) >= 60:
            vol_20 = np.std([(prices[i] / prices[i-1]) - 1.0 for i in range(-20, 0)])
            vol_60 = np.std([(prices[i] / prices[i-1]) - 1.0 for i in range(-60, 0)])
            
            features['high_volatility_regime'] = 1.0 if vol_20 > vol_60 * 1.5 else 0.0
        else:
            features['high_volatility_regime'] = 0.0
        
        # Tendência regime (trending vs ranging)
        if len(prices) >= 20:
            # Calcular quantos dias consecutivos na mesma direção
            consecutive_up = 0
            consecutive_down = 0
            
            for i in range(-19, 0):
                if prices[i] > prices[i-1]:
                    consecutive_up += 1
                    consecutive_down = 0
                else:
                    consecutive_down += 1
                    consecutive_up = 0
            
            features['trending_regime'] = 1.0 if max(consecutive_up, consecutive_down) >= 5 else 0.0
        else:
            features['trending_regime'] = 0.0
        
        return features
    
    def generate_all_features(self, prices: np.ndarray, ticker: str = None) -> Dict[str, float]:
        """
        Gera todas as features para uma série de preços.
        
        Args:
            prices: Array de preços históricos
            ticker: Nome do ticker (opcional)
        
        Returns:
            Dict com todas as features
        """
        features = {}
        
        if ticker:
            features['ticker'] = ticker
        
        # Features básicas
        features['last_price'] = float(prices[-1])
        
        # RSI
        features['rsi_14'] = self.calculate_rsi(prices, 14)
        
        # MACD
        macd = self.calculate_macd(prices)
        features.update({f'macd_{k}': v for k, v in macd.items()})
        
        # Bollinger Bands
        bb = self.calculate_bollinger_bands(prices)
        features.update({f'bb_{k}': v for k, v in bb.items()})
        
        # Momentum
        features.update(self.calculate_momentum_features(prices))
        
        # Volatilidade
        features.update(self.calculate_volatility_features(prices))
        
        # Reversão à média
        features.update(self.calculate_mean_reversion_features(prices))
        
        # Tendência
        features.update(self.calculate_trend_features(prices))
        
        # Regime
        features.update(self.calculate_regime_features(prices))
        
        # Médias móveis
        for period in [5, 10, 20, 50]:
            if len(prices) >= period:
                features[f'ma_{period}'] = float(np.mean(prices[-period:]))
            else:
                features[f'ma_{period}'] = float(prices[-1])
        
        return features


def create_training_dataset(
    series_dict: Dict[str, List[float]],
    target_horizon: int = 20,
    min_history: int = 120
) -> pd.DataFrame:
    """
    Cria dataset de treino com features avançadas.
    
    Args:
        series_dict: Dict {ticker: [prices]}
        target_horizon: Horizonte de previsão (dias)
        min_history: Mínimo de histórico necessário
    
    Returns:
        DataFrame com features e target
    """
    engineer = AdvancedFeatureEngineer()
    
    data_list = []
    
    for ticker, prices in series_dict.items():
        if len(prices) < min_history + target_horizon:
            continue
        
        # Criar múltiplas janelas de treino (walk-forward)
        for i in range(min_history, len(prices) - target_horizon):
            window = prices[:i]
            
            # Gerar features
            features = engineer.generate_all_features(np.array(window), ticker)
            
            # Target: retorno futuro
            future_price = prices[i + target_horizon - 1]
            current_price = prices[i - 1]
            target = (future_price / current_price) - 1.0
            
            features['target'] = target
            features['date_index'] = i
            
            data_list.append(features)
    
    return pd.DataFrame(data_list)
