"""
Lambda: Ingestão de Features para o Feature Store.

Coleta e salva no S3:
- Dados fundamentalistas (BRAPI)
- Dados macroeconômicos (BCB)
- Sentimento de notícias

Roda diariamente após o mercado fechar para manter o Feature Store atualizado.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from typing import Any, Dict

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
secrets = boto3.client("secretsmanager")

BUCKET = os.environ["BUCKET"]
BRAPI_SECRET_ID = os.environ.get("BRAPI_SECRET_ID", "brapi/pro/token")


def get_brapi_token() -> str:
    """Carrega token BRAPI do Secrets Manager."""
    try:
        resp = secrets.get_secret_value(SecretId=BRAPI_SECRET_ID)
        secret_str = resp.get("SecretString", "")
        try:
            return json.loads(secret_str).get("token", secret_str)
        except json.JSONDecodeError:
            return secret_str
    except Exception as e:
        logger.error(f"Erro ao carregar token BRAPI: {e}")
        return ""


def load_universe() -> list[str]:
    """Carrega lista de tickers."""
    key = os.environ.get("B3TR_UNIVERSE_S3_KEY", "config/universe.txt")
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        text = obj["Body"].read().decode("utf-8")
        return [t.strip() for t in text.splitlines() if t.strip() and not t.strip().startswith("#")]
    except Exception as e:
        logger.error(f"Erro ao carregar universe: {e}")
        return []


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Ingere dados fundamentalistas, macro e sentimento para o Feature Store.
    """
    from dl.src.features.feature_store import FeatureStore
    from dl.src.features.fundamental_features import fetch_fundamentals_brapi, save_fundamentals_to_s3
    from dl.src.features.macro_features import fetch_all_macro_data, calculate_macro_features, save_macro_to_s3

    now = datetime.now(UTC)
    dt = now.date().isoformat()
    store = FeatureStore(BUCKET)

    results = {"date": dt, "fundamentals": 0, "macro": False, "sentiment": 0}

    # 1. Dados fundamentalistas
    token = get_brapi_token()
    if token:
        tickers = load_universe()
        logger.info(f"Ingerindo fundamentals para {len(tickers)} tickers...")

        for ticker in tickers:
            try:
                fund = fetch_fundamentals_brapi(ticker, token)
                if fund:
                    save_fundamentals_to_s3(BUCKET, ticker, fund, dt)
                    store.save_features("fundamentals", ticker, dt, fund)
                    results["fundamentals"] += 1
            except Exception as e:
                logger.warning(f"Erro fundamentals {ticker}: {e}")

        logger.info(f"Fundamentals salvos: {results['fundamentals']} tickers")

    # 2. Dados macroeconômicos (BCB)
    try:
        macro_data = fetch_all_macro_data(days=90)
        macro_features = calculate_macro_features(macro_data)
        save_macro_to_s3(BUCKET, macro_data, dt)
        store.save_features("macro", "macro", dt, macro_features)
        results["macro"] = True
        logger.info(f"Macro features salvas: {len(macro_features)} features")
    except Exception as e:
        logger.error(f"Erro ao ingerir macro: {e}")

    # 3. Sentimento (se analyzer disponível)
    try:
        from dl.src.sentiment.sentiment_analyzer import SentimentAnalyzer
        news_api_key = os.environ.get("NEWS_API_KEY")
        if news_api_key:
            analyzer = SentimentAnalyzer(news_api_key=news_api_key)
            tickers = load_universe()
            for ticker in tickers:
                try:
                    sentiment = analyzer.analyze_stock_sentiment(ticker)
                    if sentiment:
                        store.save_features("sentiment", ticker, dt, sentiment)
                        results["sentiment"] += 1
                except Exception as e:
                    logger.warning(f"Erro sentimento {ticker}: {e}")
            logger.info(f"Sentimento salvo: {results['sentiment']} tickers")
    except Exception as e:
        logger.warning(f"Sentimento não disponível: {e}")

    return {"ok": True, **results}
