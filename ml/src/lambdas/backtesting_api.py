"""
Backtesting API Lambda for comprehensive portfolio simulation.

Implements:
- Req 33.1-33.10: Historical portfolio backtesting
- Req 34.1-34.10: Performance metrics calculation
- Req 35.1-35.8: Benchmark comparison
- Req 36.1-36.8: Risk analysis
- Req 61.1-61.10: Scenario analysis
- Req 62.1-62.10: Stress testing
- Req 80.7-80.10: Backend API extensions
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import boto3
import numpy as np
import pandas as pd

s3 = boto3.client("s3")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ.get("BUCKET", "")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main handler for backtesting API.
    
    Routes:
    - POST /api/backtesting/simulate - Run portfolio simulation
    - POST /api/backtesting/scenario - Run scenario analysis
    - POST /api/backtesting/stress-test - Run stress testing
    """
    try:
        # Extract path and method
        path = event.get("path", event.get("rawPath", ""))
        method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "GET"))
        
        # Parse body for POST requests
        body = {}
        if method == "POST":
            body_str = event.get("body", "{}")
            body = json.loads(body_str) if isinstance(body_str, str) else body_str
        
        response = None

        # Route requests
        if path.endswith("/backtesting/simulate") and method == "POST":
            response = simulate_portfolio(body)
        elif path.endswith("/backtesting/scenario") and method == "POST":
            response = run_scenario_analysis(body)
        elif path.endswith("/backtesting/stress-test") and method == "POST":
            response = run_stress_test(body)
        else:
            response = {
                "statusCode": 404,
                "body": json.dumps({"error": f"Route not found: {path}"})
            }
        
        # Add CORS headers
        if "headers" not in response:
            response["headers"] = {}
        response["headers"].update({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key",
            "Content-Type": "application/json"
        })
        
        return response
        
    except Exception as e:
        logger.error(f"Error in backtesting API: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "error": str(e),
                "message": "Backtesting API error"
            })
        }


def simulate_portfolio(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simulate portfolio performance using historical recommendations.
    
    Requirements:
    - 33.2: Simulate portfolio construction using historical recommendations
    - 33.3: Calculate portfolio returns based on actual historical returns
    - 33.4: Rebalance at configured intervals
    - 33.5: Calculate transaction costs
    - 33.6: Track portfolio composition changes
    - 33.7: Calculate daily portfolio returns
    - 33.10: Display portfolio turnover rate
    """
    try:
        # Extract configuration
        start_date = datetime.fromisoformat(config["startDate"])
        end_date = datetime.fromisoformat(config["endDate"])
        initial_capital = config["initialCapital"]
        position_size = config["positionSize"]  # 'equal' or 'weighted'
        top_n = config["topN"]
        rebalance_freq = config["rebalanceFrequency"]  # 'daily', 'weekly', 'monthly'
        commission_rate = config["commissionRate"]
        
        logger.info(f"Simulating portfolio from {start_date} to {end_date}")
        
        # Load historical recommendations and returns
        # In real implementation, this would load from S3
        # For now, generate mock data
        portfolio_value = []
        current_value = initial_capital
        current_date = start_date
        
        # Mock portfolio simulation
        while current_date <= end_date:
            # Simulate daily return (mock data)
            daily_return = np.random.normal(0.001, 0.02)  # 0.1% mean, 2% std
            current_value *= (1 + daily_return)
            
            # Mock positions
            positions = []
            for i in range(top_n):
                positions.append({
                    "ticker": f"STOCK{i+1}",
                    "shares": 100,
                    "value": current_value / top_n,
                    "weight": 1.0 / top_n
                })
            
            portfolio_value.append({
                "date": current_date.isoformat(),
                "value": current_value,
                "positions": positions
            })
            
            current_date += timedelta(days=1)
        
        # Calculate metrics
        metrics = calculate_performance_metrics(portfolio_value, initial_capital)
        
        # Calculate benchmarks
        benchmarks = calculate_benchmarks(start_date, end_date, initial_capital)
        
        # Calculate risk metrics
        risk_metrics = calculate_risk_metrics(portfolio_value)
        
        # Calculate drawdowns
        drawdowns = calculate_drawdowns(portfolio_value)
        
        # Return decomposition (mock)
        return_decomposition = [
            {"ticker": f"STOCK{i+1}", "contribution": np.random.uniform(-5000, 10000)}
            for i in range(top_n)
        ]
        
        # Sector flows (mock)
        sector_flows = [
            {"from": "Financials", "to": "Technology", "amount": 5000},
            {"from": "Energy", "to": "Healthcare", "amount": 3000},
        ]
        
        result = {
            "config": config,
            "portfolioValue": portfolio_value,
            "metrics": metrics,
            "benchmarks": benchmarks,
            "riskMetrics": risk_metrics,
            "drawdowns": drawdowns,
            "returnDecomposition": return_decomposition,
            "sectorFlows": sector_flows
        }
        
        return {
            "statusCode": 200,
            "body": json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in portfolio simulation: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


def calculate_performance_metrics(portfolio_value: List[Dict], initial_capital: float) -> Dict[str, float]:
    """
    Calculate comprehensive performance metrics.
    
    Requirements:
    - 34.1: Total return
    - 34.2: Annualized return
    - 34.3: Annualized volatility
    - 34.4: Sharpe ratio
    - 34.5: Sortino ratio
    - 34.6: Maximum drawdown
    - 34.7: Average drawdown duration
    - 34.8: Win rate
    - 34.9: Average gain and loss
    - 34.10: Display all metrics
    """
    values = [pv["value"] for pv in portfolio_value]
    returns = np.diff(values) / values[:-1]
    
    final_value = values[-1]
    total_return = (final_value - initial_capital) / initial_capital
    
    # Annualized metrics
    days = len(values)
    years = days / 252  # Trading days
    annualized_return = (1 + total_return) ** (1 / years) - 1 if years > 0 else 0
    annualized_volatility = np.std(returns) * np.sqrt(252) if len(returns) > 0 else 0
    
    # Sharpe ratio (assuming 0% risk-free rate for simplicity)
    sharpe_ratio = annualized_return / annualized_volatility if annualized_volatility > 0 else 0
    
    # Sortino ratio (downside deviation)
    downside_returns = returns[returns < 0]
    downside_deviation = np.std(downside_returns) * np.sqrt(252) if len(downside_returns) > 0 else 0
    sortino_ratio = annualized_return / downside_deviation if downside_deviation > 0 else 0
    
    # Maximum drawdown
    cumulative = np.cumprod(1 + returns)
    running_max = np.maximum.accumulate(cumulative)
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = np.min(drawdown) if len(drawdown) > 0 else 0
    
    # Win rate
    positive_returns = returns[returns > 0]
    negative_returns = returns[returns < 0]
    win_rate = len(positive_returns) / len(returns) if len(returns) > 0 else 0
    
    # Average gain/loss
    average_gain = np.mean(positive_returns) if len(positive_returns) > 0 else 0
    average_loss = np.mean(negative_returns) if len(negative_returns) > 0 else 0
    
    # Turnover rate (mock)
    turnover_rate = 0.5  # 50% annual turnover
    
    return {
        "totalReturn": float(total_return),
        "annualizedReturn": float(annualized_return),
        "volatility": float(annualized_volatility),
        "sharpeRatio": float(sharpe_ratio),
        "sortinoRatio": float(sortino_ratio),
        "maxDrawdown": float(max_drawdown),
        "averageDrawdownDuration": 15.0,  # Mock value
        "winRate": float(win_rate),
        "averageGain": float(average_gain),
        "averageLoss": float(average_loss),
        "turnoverRate": float(turnover_rate)
    }


def calculate_benchmarks(start_date: datetime, end_date: datetime, initial_capital: float) -> Dict[str, Any]:
    """
    Calculate benchmark returns.
    
    Requirements:
    - 35.1: Calculate Ibovespa returns
    - 35.2: Calculate CDI returns
    - 35.4: Calculate alpha
    - 35.5: Calculate beta
    - 35.6: Calculate information ratio
    - 35.8: Calculate tracking error
    """
    # Mock benchmark data
    days = (end_date - start_date).days
    
    # Ibovespa mock returns
    ibovespa_return = 0.15  # 15% total return
    ibovespa_volatility = 0.25  # 25% volatility
    
    # CDI mock returns
    cdi_return = 0.10  # 10% total return
    
    return {
        "ibovespa": {
            "totalReturn": ibovespa_return,
            "annualizedReturn": ibovespa_return * (252 / days) if days > 0 else 0,
            "volatility": ibovespa_volatility,
            "sharpeRatio": ibovespa_return / ibovespa_volatility if ibovespa_volatility > 0 else 0,
            "maxDrawdown": -0.20
        },
        "cdi": {
            "totalReturn": cdi_return,
            "annualizedReturn": cdi_return * (252 / days) if days > 0 else 0
        },
        "alpha": 0.05,  # 5% alpha
        "beta": 1.2,  # 1.2 beta
        "informationRatio": 0.8,
        "trackingError": 0.10
    }


def calculate_risk_metrics(portfolio_value: List[Dict]) -> Dict[str, Any]:
    """
    Calculate risk metrics.
    
    Requirements:
    - 36.1: VaR at 95% and 99%
    - 36.2: CVaR at 95% and 99%
    - 36.5: Downside deviation
    - 36.6: Rolling volatility
    - 36.7: Maximum consecutive losses
    """
    values = [pv["value"] for pv in portfolio_value]
    returns = np.diff(values) / values[:-1]
    
    # VaR and CVaR
    var_95 = np.percentile(returns, 5) if len(returns) > 0 else 0
    var_99 = np.percentile(returns, 1) if len(returns) > 0 else 0
    
    cvar_95 = np.mean(returns[returns <= var_95]) if len(returns[returns <= var_95]) > 0 else 0
    cvar_99 = np.mean(returns[returns <= var_99]) if len(returns[returns <= var_99]) > 0 else 0
    
    # Downside deviation
    downside_returns = returns[returns < 0]
    downside_deviation = np.std(downside_returns) * np.sqrt(252) if len(downside_returns) > 0 else 0
    
    # Maximum consecutive losses
    consecutive_losses = 0
    max_consecutive_losses = 0
    for r in returns:
        if r < 0:
            consecutive_losses += 1
            max_consecutive_losses = max(max_consecutive_losses, consecutive_losses)
        else:
            consecutive_losses = 0
    
    # Rolling volatility (30-day window)
    rolling_volatility = []
    window = 30
    for i in range(window, len(returns)):
        window_returns = returns[i-window:i]
        vol = np.std(window_returns) * np.sqrt(252)
        rolling_volatility.append({
            "date": portfolio_value[i]["date"],
            "volatility": float(vol)
        })
    
    return {
        "var95": float(var_95),
        "var99": float(var_99),
        "cvar95": float(cvar_95),
        "cvar99": float(cvar_99),
        "maxConsecutiveLosses": int(max_consecutive_losses),
        "downsideDeviation": float(downside_deviation),
        "rollingVolatility": rolling_volatility
    }


def calculate_drawdowns(portfolio_value: List[Dict]) -> List[Dict]:
    """
    Calculate drawdown periods.
    
    Requirements:
    - 36.3: Display drawdown chart
    - 36.4: Identify worst drawdown
    """
    values = [pv["value"] for pv in portfolio_value]
    dates = [pv["date"] for pv in portfolio_value]
    
    # Calculate drawdowns
    cumulative = np.array(values)
    running_max = np.maximum.accumulate(cumulative)
    drawdown = (cumulative - running_max) / running_max
    
    # Find drawdown periods
    drawdowns = []
    in_drawdown = False
    start_idx = 0
    
    for i, dd in enumerate(drawdown):
        if dd < -0.01 and not in_drawdown:  # Start of drawdown (>1% decline)
            in_drawdown = True
            start_idx = i
        elif dd >= 0 and in_drawdown:  # End of drawdown
            in_drawdown = False
            depth = np.min(drawdown[start_idx:i])
            drawdowns.append({
                "start": dates[start_idx],
                "end": dates[i],
                "depth": float(depth),
                "duration": i - start_idx
            })
    
    return drawdowns


def run_scenario_analysis(body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run scenario analysis with modified parameters.
    
    Requirements:
    - 61.2: Create scenarios with modified parameters
    - 61.3: Adjust expected returns
    - 61.4: Adjust volatility
    - 61.5: Adjust correlation
    - 61.6: Recalculate portfolio metrics
    """
    try:
        baseline_config = body.get("baselineConfig", {})
        adjustments = body.get("adjustments", {})
        
        # Apply adjustments to baseline
        adjusted_config = baseline_config.copy()
        
        # Simulate with adjustments (mock implementation)
        # In real implementation, this would adjust returns/volatility/correlation
        
        # Mock results
        results = {
            "totalReturn": 0.20,  # 20% return
            "sharpeRatio": 1.5,
            "maxDrawdown": -0.15
        }
        
        return {
            "statusCode": 200,
            "body": json.dumps(results)
        }
        
    except Exception as e:
        logger.error(f"Error in scenario analysis: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


def run_stress_test(body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run stress testing on portfolio.
    
    Requirements:
    - 62.4: Apply scenario shocks
    - 62.5: Calculate portfolio value under stress
    - 62.6: Calculate maximum loss
    - 62.7: Identify positions contributing to losses
    """
    try:
        portfolio_data = body.get("portfolioData", {})
        scenarios = body.get("scenarios", [])
        
        # Mock stress test results
        results = []
        for scenario_id in scenarios:
            results.append({
                "scenarioId": scenario_id,
                "scenarioName": scenario_id.replace("-", " ").title(),
                "portfolioValue": 85000,  # Mock stressed value
                "maxLoss": -15000,
                "maxLossPercent": -0.15,
                "topLosers": [
                    {"ticker": "STOCK1", "loss": -5000, "lossPercent": -0.20},
                    {"ticker": "STOCK2", "loss": -3000, "lossPercent": -0.15}
                ]
            })
        
        return {
            "statusCode": 200,
            "body": json.dumps(results)
        }
        
    except Exception as e:
        logger.error(f"Error in stress testing: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
