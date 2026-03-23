"""
Features setoriais — correlação entre ações do mesmo setor.

Se PETR4 sobe, PRIO3 e RECV3 tendem a seguir.
Hoje cada ação é tratada isoladamente; isso adiciona contexto setorial.
"""

from __future__ import annotations

import numpy as np
from typing import Dict, List


# Mapeamento de tickers para setores (B3)
SECTOR_MAP: Dict[str, str] = {
    # Petróleo & Gás
    "PETR4": "oil_gas", "PETR3": "oil_gas", "PRIO3": "oil_gas",
    "RECV3": "oil_gas", "RRRP3": "oil_gas", "CSAN3": "oil_gas",
    # Mineração & Siderurgia
    "VALE3": "mining", "CSNA3": "mining", "GGBR4": "mining",
    "GOAU4": "mining", "USIM5": "mining",
    # Bancos
    "ITUB4": "banks", "BBDC4": "banks", "BBAS3": "banks",
    "SANB11": "banks", "ITSA4": "banks", "BPAC11": "banks",
    # Varejo
    "MGLU3": "retail", "VIIA3": "retail", "LREN3": "retail",
    "AMER3": "retail", "PETZ3": "retail", "SOMA3": "retail",
    # Utilities (Energia)
    "ELET3": "utilities", "ELET6": "utilities", "ENGI11": "utilities",
    "EQTL3": "utilities", "CPFE3": "utilities", "CMIG4": "utilities",
    "TAEE11": "utilities", "ENBR3": "utilities",
    # Alimentos & Bebidas
    "ABEV3": "food_bev", "JBSS3": "food_bev", "BRFS3": "food_bev",
    "MRFG3": "food_bev", "BEEF3": "food_bev",
    # Saúde
    "RDOR3": "health", "HAPV3": "health", "FLRY3": "health",
    "QUAL3": "health", "HYPE3": "health",
    # Tecnologia
    "TOTS3": "tech", "LWSA3": "tech", "CASH3": "tech",
    "MLAS3": "tech", "BMOB3": "tech",
    # Construção
    "CYRE3": "construction", "MRVE3": "construction", "EZTC3": "construction",
    "EVEN3": "construction", "DIRR3": "construction",
    # Papel & Celulose
    "SUZB3": "paper", "KLBN11": "paper",
    # Seguros
    "BBSE3": "insurance", "PSSA3": "insurance", "IRBR3": "insurance",
    # Infraestrutura
    "B3SA3": "infra", "RENT3": "infra", "WEGE3": "infra",
    "RAIL3": "infra", "CCRO3": "infra", "ECOR3": "infra",
}


def get_sector(ticker: str) -> str:
    """Retorna o setor de um ticker."""
    return SECTOR_MAP.get(ticker, "other")


def calculate_sector_features(
    ticker: str,
    all_series: Dict[str, List[float]],
    lookback: int = 20,
) -> Dict[str, float]:
    """
    Calcula features setoriais para um ticker.

    Args:
        ticker: Ticker alvo
        all_series: Dict {ticker: [prices]} de todas as ações
        lookback: Janela de lookback para cálculos

    Returns:
        Dict com features setoriais
    """
    features: Dict[str, float] = {}
    sector = get_sector(ticker)
    features["sector_id"] = float(hash(sector) % 100)  # encoding numérico simples

    if ticker not in all_series or len(all_series[ticker]) < lookback:
        return {**features, **_default_sector_features()}

    ticker_prices = np.array(all_series[ticker][-lookback:])
    ticker_returns = np.diff(ticker_prices) / ticker_prices[:-1]

    # Peers do mesmo setor
    peer_returns_list = []
    for peer, prices in all_series.items():
        if peer == ticker:
            continue
        if get_sector(peer) != sector:
            continue
        if len(prices) < lookback:
            continue
        p = np.array(prices[-lookback:])
        r = np.diff(p) / p[:-1]
        if len(r) == len(ticker_returns):
            peer_returns_list.append(r)

    if not peer_returns_list:
        return {**features, **_default_sector_features()}

    # Retorno médio do setor
    sector_returns = np.mean(peer_returns_list, axis=0)
    features["sector_return_avg"] = float(np.sum(sector_returns))

    # Correlação com o setor
    if np.std(ticker_returns) > 0 and np.std(sector_returns) > 0:
        corr = np.corrcoef(ticker_returns, sector_returns)[0, 1]
        features["sector_correlation"] = float(corr) if not np.isnan(corr) else 0.0
    else:
        features["sector_correlation"] = 0.0

    # Relative strength vs setor (ticker outperformance)
    ticker_total = float(np.sum(ticker_returns))
    sector_total = float(np.sum(sector_returns))
    features["sector_relative_strength"] = ticker_total - sector_total

    # Dispersão do setor (alta dispersão = incerteza)
    if len(peer_returns_list) >= 2:
        peer_totals = [float(np.sum(r)) for r in peer_returns_list]
        features["sector_dispersion"] = float(np.std(peer_totals))
    else:
        features["sector_dispersion"] = 0.0

    # Momentum do setor
    features["sector_momentum"] = sector_total

    return features


def _default_sector_features() -> Dict[str, float]:
    return {
        "sector_return_avg": 0.0,
        "sector_correlation": 0.0,
        "sector_relative_strength": 0.0,
        "sector_dispersion": 0.0,
        "sector_momentum": 0.0,
    }
