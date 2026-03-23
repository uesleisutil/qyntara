"""
Features fundamentalistas via BRAPI.

P/L, P/VP, dividend yield, ROE, dívida/EBITDA.
Ações baratas por fundamento + momentum técnico é uma combinação poderosa.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

import boto3
import requests

logger = logging.getLogger(__name__)

s3 = boto3.client("s3")


def fetch_fundamentals_brapi(ticker: str, token: str) -> Dict[str, Any]:
    """
    Busca dados fundamentalistas de um ticker via BRAPI Pro.

    Usa modules=summaryProfile,financialData,defaultKeyStatistics para
    obter todos os indicadores disponíveis no plano pago.

    Args:
        ticker: Símbolo da ação (ex: PETR4)
        token: Token BRAPI Pro

    Returns:
        Dict com indicadores fundamentalistas
    """
    url = f"https://brapi.dev/api/quote/{ticker}"
    params = {
        "token": token,
        "fundamental": "true",
        "dividends": "true",
        "modules": "summaryProfile,financialData,defaultKeyStatistics,balanceSheetHistory,incomeStatementHistory",
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"BRAPI fundamentals {ticker}: HTTP {resp.status_code}")
            return {}

        data = resp.json()
        results = data.get("results", [])
        if not results:
            return {}

        r = results[0]
        financial = r.get("financialData", {}) or {}
        default_key = r.get("defaultKeyStatistics", {}) or {}
        summary = r.get("summaryProfile", {}) or {}

        # Balanço patrimonial (mais recente)
        balance_sheets = r.get("balanceSheetHistory", {}).get("balanceSheetStatements", [])
        bs = balance_sheets[0] if balance_sheets else {}

        # DRE (mais recente)
        income_stmts = r.get("incomeStatementHistory", {}).get("incomeStatementHistory", [])
        inc = income_stmts[0] if income_stmts else {}

        # EBITDA e dívida para calcular debt/EBITDA real
        ebitda = _safe_float(financial.get("ebitda"))
        total_debt = _safe_float(financial.get("totalDebt"))
        debt_to_ebitda = None
        if ebitda and ebitda > 0 and total_debt is not None:
            debt_to_ebitda = total_debt / ebitda

        # Dados do balanço
        total_assets = _safe_float(bs.get("totalAssets"))
        total_liabilities = _safe_float(bs.get("totalLiab"))
        total_equity = _safe_float(bs.get("totalStockholderEquity"))
        net_receivables = _safe_float(bs.get("netReceivables"))
        inventory = _safe_float(bs.get("inventory"))
        cash = _safe_float(bs.get("cash") or bs.get("cashAndShortTermInvestments"))
        short_term_debt = _safe_float(bs.get("shortLongTermDebt") or bs.get("shortTermDebt"))
        long_term_debt = _safe_float(bs.get("longTermDebt"))

        # Dados da DRE
        total_revenue = _safe_float(inc.get("totalRevenue"))
        gross_profit = _safe_float(inc.get("grossProfit"))
        net_income = _safe_float(inc.get("netIncome"))
        operating_income = _safe_float(inc.get("operatingIncome"))
        cost_of_revenue = _safe_float(inc.get("costOfRevenue"))
        interest_expense = _safe_float(inc.get("interestExpense"))

        # Ratios derivados do balanço/DRE
        asset_turnover = None
        if total_revenue and total_assets and total_assets > 0:
            asset_turnover = total_revenue / total_assets

        interest_coverage = None
        if operating_income and interest_expense and interest_expense != 0:
            interest_coverage = operating_income / abs(interest_expense)

        net_debt = None
        if total_debt is not None and cash is not None:
            net_debt = total_debt - cash

        return {
            # Valuation
            "pe_ratio": _safe_float(r.get("priceEarnings") or default_key.get("trailingPE")),
            "forward_pe": _safe_float(default_key.get("forwardPE")),
            "pb_ratio": _safe_float(default_key.get("priceToBook")),
            "dividend_yield": _safe_float(default_key.get("dividendYield")),
            "ev_to_ebitda": _safe_float(default_key.get("enterpriseToEbitda")),
            "ev_to_revenue": _safe_float(default_key.get("enterpriseToRevenue")),
            "peg_ratio": _safe_float(default_key.get("pegRatio")),
            "price_to_sales": _safe_float(default_key.get("priceToSalesTrailing12Months")),
            # Rentabilidade
            "roe": _safe_float(financial.get("returnOnEquity")),
            "roa": _safe_float(financial.get("returnOnAssets")),
            "profit_margin": _safe_float(financial.get("profitMargins") or default_key.get("profitMargins")),
            "operating_margin": _safe_float(financial.get("operatingMargins")),
            "ebitda_margin": _safe_float(financial.get("ebitdaMargins")),
            "gross_margin": _safe_float(financial.get("grossMargins")),
            # Crescimento
            "earnings_growth": _safe_float(financial.get("earningsGrowth")),
            "revenue_growth": _safe_float(financial.get("revenueGrowth")),
            "earnings_quarterly_growth": _safe_float(default_key.get("earningsQuarterlyGrowth")),
            # Endividamento
            "debt_to_equity": _safe_float(financial.get("debtToEquity")),
            "debt_to_ebitda": debt_to_ebitda,
            "current_ratio": _safe_float(financial.get("currentRatio")),
            "quick_ratio": _safe_float(financial.get("quickRatio")),
            "interest_coverage": interest_coverage,
            "net_debt": net_debt,
            # Tamanho
            "market_cap": _safe_float(r.get("marketCap") or default_key.get("marketCap")),
            "enterprise_value": _safe_float(default_key.get("enterpriseValue")),
            # Cash flow
            "free_cash_flow": _safe_float(financial.get("freeCashflow")),
            "operating_cash_flow": _safe_float(financial.get("operatingCashflow")),
            # Balanço
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
            "total_revenue": total_revenue,
            "net_income": net_income,
            "ebitda": ebitda,
            "total_debt": total_debt,
            "cash": cash,
            "asset_turnover": asset_turnover,
            # Setor
            "sector": summary.get("sector", "Unknown"),
            "industry": summary.get("industry", "Unknown"),
        }
    except Exception as e:
        logger.error(f"Erro ao buscar fundamentals {ticker}: {e}")
        return {}


def calculate_fundamental_features(fundamentals: Dict[str, Any]) -> Dict[str, float]:
    """
    Transforma dados fundamentalistas em features numéricas para o modelo.

    Gera ~30 features cobrindo valuation, rentabilidade, crescimento,
    endividamento, tamanho, cash flow e scores compostos.

    Args:
        fundamentals: Dict retornado por fetch_fundamentals_brapi

    Returns:
        Dict com features numéricas (prefixo f_)
    """
    import math

    features: Dict[str, float] = {}

    def _val(key: str, default: float = 0.0) -> float:
        v = fundamentals.get(key)
        return float(v) if v is not None else default

    # --- Valuation ---
    pe = fundamentals.get("pe_ratio")
    features["f_pe_ratio"] = pe if pe is not None else 0.0
    features["f_earnings_yield"] = (1.0 / pe) if pe and pe > 0 else 0.0

    fwd_pe = fundamentals.get("forward_pe")
    features["f_forward_pe"] = fwd_pe if fwd_pe is not None else 0.0

    features["f_pb_ratio"] = _val("pb_ratio")
    features["f_dividend_yield"] = _val("dividend_yield")
    features["f_ev_to_ebitda"] = _val("ev_to_ebitda")
    features["f_ev_to_revenue"] = _val("ev_to_revenue")
    features["f_peg_ratio"] = _val("peg_ratio")
    features["f_price_to_sales"] = _val("price_to_sales")

    # --- Rentabilidade ---
    features["f_roe"] = _val("roe")
    features["f_roa"] = _val("roa")
    features["f_profit_margin"] = _val("profit_margin")
    features["f_operating_margin"] = _val("operating_margin")
    features["f_ebitda_margin"] = _val("ebitda_margin")
    features["f_gross_margin"] = _val("gross_margin")

    # --- Crescimento ---
    features["f_earnings_growth"] = _val("earnings_growth")
    features["f_revenue_growth"] = _val("revenue_growth")
    features["f_earnings_quarterly_growth"] = _val("earnings_quarterly_growth")

    # --- Endividamento ---
    features["f_debt_to_equity"] = _val("debt_to_equity")
    features["f_debt_to_ebitda"] = _val("debt_to_ebitda")
    features["f_current_ratio"] = _val("current_ratio")
    features["f_quick_ratio"] = _val("quick_ratio")
    features["f_interest_coverage"] = _val("interest_coverage")

    net_debt = fundamentals.get("net_debt")
    mc = fundamentals.get("market_cap")
    features["f_net_debt_to_mcap"] = (net_debt / mc) if net_debt is not None and mc and mc > 0 else 0.0

    # --- Tamanho ---
    features["f_log_market_cap"] = math.log(mc) if mc and mc > 0 else 0.0

    ev = fundamentals.get("enterprise_value")
    features["f_log_enterprise_value"] = math.log(ev) if ev and ev > 0 else 0.0

    # --- Cash flow ---
    fcf = fundamentals.get("free_cash_flow")
    ocf = fundamentals.get("operating_cash_flow")
    features["f_fcf_yield"] = (fcf / mc) if fcf and mc and mc > 0 else 0.0
    features["f_ocf_yield"] = (ocf / mc) if ocf and mc and mc > 0 else 0.0

    # --- Eficiência (balanço/DRE) ---
    features["f_asset_turnover"] = _val("asset_turnover")

    total_assets = fundamentals.get("total_assets")
    total_liabilities = fundamentals.get("total_liabilities")
    if total_assets and total_assets > 0 and total_liabilities is not None:
        features["f_leverage_ratio"] = total_liabilities / total_assets
    else:
        features["f_leverage_ratio"] = 0.0

    cash = fundamentals.get("cash")
    total_debt = fundamentals.get("total_debt")
    if total_debt and total_debt > 0 and cash is not None:
        features["f_cash_to_debt"] = cash / total_debt
    else:
        features["f_cash_to_debt"] = 0.0

    # --- Score composto: value ---
    pb_component = (1.0 / (features["f_pb_ratio"] + 1e-6)) * 0.10 if features["f_pb_ratio"] > 0 else 0.0
    ev_ebitda_component = (1.0 / (features["f_ev_to_ebitda"] + 1e-6)) * 0.10 if features["f_ev_to_ebitda"] > 0 else 0.0
    features["f_value_score"] = (
        features["f_earnings_yield"] * 0.20
        + features["f_dividend_yield"] * 0.15
        + features["f_fcf_yield"] * 0.15
        + pb_component
        + ev_ebitda_component
    )

    # --- Score composto: quality ---
    de_component = (1.0 / (features["f_debt_to_equity"] + 1e-6)) * 0.10 if features["f_debt_to_equity"] > 0 else 0.0
    features["f_quality_score"] = (
        features["f_roe"] * 0.20
        + features["f_profit_margin"] * 0.15
        + features["f_gross_margin"] * 0.15
        + features["f_current_ratio"] * 0.10
        + features["f_interest_coverage"] * 0.005  # normalizado (tipicamente 1-20)
        + de_component
    )

    # --- Score composto: growth ---
    features["f_growth_score"] = (
        features["f_earnings_growth"] * 0.35
        + features["f_revenue_growth"] * 0.35
        + features["f_earnings_quarterly_growth"] * 0.30
    )

    return features


def save_fundamentals_to_s3(
    bucket: str, ticker: str, fundamentals: Dict[str, Any], date_str: str
) -> None:
    """Salva dados fundamentalistas no Feature Store (S3)."""
    key = f"feature_store/fundamentals/dt={date_str}/{ticker}.json"
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(fundamentals).encode("utf-8"),
        ContentType="application/json",
    )


def load_fundamentals_from_s3(bucket: str, ticker: str, date_str: str) -> Dict[str, Any]:
    """Carrega dados fundamentalistas do Feature Store (S3)."""
    key = f"feature_store/fundamentals/dt={date_str}/{ticker}.json"
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except Exception:
        return {}


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
