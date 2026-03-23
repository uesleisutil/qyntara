"""
Feature Store baseado em S3.

Evita recalcular features e garante consistência entre treino e inferência
(training-serving skew é um problema real).

Estrutura S3:
  feature_store/
    technical/dt=YYYY-MM-DD/{ticker}.json
    volume/dt=YYYY-MM-DD/{ticker}.json
    fundamentals/dt=YYYY-MM-DD/{ticker}.json
    sector/dt=YYYY-MM-DD/{ticker}.json
    macro/dt=YYYY-MM-DD/macro.json
    sentiment/dt=YYYY-MM-DD/{ticker}.json
    combined/dt=YYYY-MM-DD/{ticker}.json   <- todas as features unificadas
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, UTC
from typing import Any, Dict, List, Optional

import boto3

logger = logging.getLogger(__name__)

s3 = boto3.client("s3")


class FeatureStore:
    """Feature Store particionado por data no S3."""

    def __init__(self, bucket: str):
        self.bucket = bucket
        self.prefix = "feature_store"

    def save_features(
        self,
        category: str,
        key_name: str,
        date_str: str,
        features: Dict[str, Any],
    ) -> str:
        """
        Salva features no store.

        Args:
            category: Categoria (technical, volume, fundamentals, macro, sector, sentiment, combined)
            key_name: Nome do arquivo (ex: ticker ou 'macro')
            date_str: Data no formato YYYY-MM-DD
            features: Dict com features

        Returns:
            S3 key onde foi salvo
        """
        s3_key = f"{self.prefix}/{category}/dt={date_str}/{key_name}.json"
        s3.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=json.dumps(features, default=str).encode("utf-8"),
            ContentType="application/json",
        )
        return s3_key

    def load_features(
        self,
        category: str,
        key_name: str,
        date_str: str,
    ) -> Optional[Dict[str, Any]]:
        """Carrega features do store."""
        s3_key = f"{self.prefix}/{category}/dt={date_str}/{key_name}.json"
        try:
            obj = s3.get_object(Bucket=self.bucket, Key=s3_key)
            return json.loads(obj["Body"].read().decode("utf-8"))
        except Exception:
            return None

    def load_features_with_fallback(
        self,
        category: str,
        key_name: str,
        date_str: str,
        fallback_days: int = 7,
    ) -> Optional[Dict[str, Any]]:
        """
        Carrega features, tentando datas anteriores se não encontrar.
        Útil para dados que não mudam diariamente (fundamentals, macro).
        """
        dt = datetime.fromisoformat(date_str)
        for i in range(fallback_days):
            d = (dt - timedelta(days=i)).date().isoformat()
            result = self.load_features(category, key_name, d)
            if result:
                return result
        return None

    def load_combined_features(
        self,
        ticker: str,
        date_str: str,
    ) -> Optional[Dict[str, float]]:
        """Carrega features combinadas (todas as categorias) para um ticker."""
        return self.load_features("combined", ticker, date_str)

    def save_combined_features(
        self,
        ticker: str,
        date_str: str,
        features: Dict[str, float],
    ) -> str:
        """Salva features combinadas."""
        return self.save_features("combined", ticker, date_str, features)

    def list_tickers_for_date(self, category: str, date_str: str) -> List[str]:
        """Lista tickers disponíveis para uma data."""
        prefix = f"{self.prefix}/{category}/dt={date_str}/"
        tickers = []
        try:
            paginator = s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    filename = key.split("/")[-1].replace(".json", "")
                    tickers.append(filename)
        except Exception as e:
            logger.error(f"Erro ao listar tickers: {e}")
        return tickers

    def build_training_dataset(
        self,
        date_str: str,
        tickers: Optional[List[str]] = None,
    ) -> List[Dict[str, float]]:
        """
        Constrói dataset de treino a partir do Feature Store.
        Garante consistência entre treino e inferência.

        Args:
            date_str: Data de referência
            tickers: Lista de tickers (se None, usa todos disponíveis)

        Returns:
            Lista de dicts com features combinadas
        """
        if tickers is None:
            tickers = self.list_tickers_for_date("combined", date_str)

        dataset = []
        for ticker in tickers:
            features = self.load_combined_features(ticker, date_str)
            if features:
                dataset.append(features)

        logger.info(f"Feature Store: {len(dataset)} registros para {date_str}")
        return dataset
