"""
SageMaker Training Job — treina Edge Estimator e Anomaly Detector.

Chamado pelo EventBridge 1x/dia ou manualmente via admin.
Usa SageMaker PyTorch estimator com dados do S3.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

import boto3
import numpy as np

logger = logging.getLogger(__name__)

BUCKET = "predikt-data-200093399689"
REGION = "us-east-1"
ROLE_ARN = os.getenv("SAGEMAKER_ROLE_ARN", "")


def prepare_training_data() -> dict:
    """Prepara dados de treino a partir do histórico de mercados no S3."""
    s3 = boto3.client("s3", region_name=REGION)

    # Carregar snapshots de preço dos últimos 30 dias
    from ..storage import load_json
    from ..features import extract_features, FEATURE_NAMES

    markets = load_json("cache/markets.json") or []
    if not markets:
        logger.warning("No market data for training")
        return {}

    # Carregar histórico de preços
    history_data: dict[str, list] = {}
    now = datetime.now()
    for i in range(30):
        day = (now - __import__('datetime').timedelta(days=i)).strftime("%Y-%m-%d")
        snapshots = load_json(f"history/prices_{day}.json")
        if not snapshots:
            continue
        for snap in snapshots:
            for mid, price in snap.get("p", {}).items():
                if mid not in history_data:
                    history_data[mid] = []
                history_data[mid].append({"price": price, "t": snap["t"]})

    # Extrair features pra cada mercado
    X_list = []
    market_ids = []
    for m in markets:
        mid = m.get("market_id", "")
        hist = history_data.get(mid, [])
        features = extract_features(m, hist)
        X_list.append(features)
        market_ids.append(mid)

    if not X_list:
        return {}

    X = np.stack(X_list)

    # Salvar no S3 pra SageMaker
    data = {
        "X": X.tolist(),
        "market_ids": market_ids,
        "feature_names": FEATURE_NAMES,
        "n_samples": len(X_list),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    key = f"training/prepared_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    s3.put_object(
        Bucket=BUCKET, Key=key,
        Body=json.dumps(data, default=str),
        ContentType="application/json",
    )
    logger.info(f"Training data prepared: {len(X_list)} samples -> s3://{BUCKET}/{key}")
    return {"key": key, "n_samples": len(X_list)}


def train_local(epochs: int = 50) -> dict:
    """Treina modelos localmente (pra Lambda ou dev). Não precisa de SageMaker."""
    from ..storage import load_json, save_json
    from ..features import extract_features, FEATURE_NAMES

    markets = load_json("cache/markets.json") or []
    if len(markets) < 10:
        logger.warning(f"Not enough markets for training: {len(markets)}")
        return {"error": "Not enough data"}

    # Carregar histórico
    history_data: dict[str, list] = {}
    now = datetime.now()
    for i in range(30):
        day = (now - __import__('datetime').timedelta(days=i)).strftime("%Y-%m-%d")
        snapshots = load_json(f"history/prices_{day}.json")
        if not snapshots:
            continue
        for snap in snapshots:
            for mid, price in snap.get("p", {}).items():
                if mid not in history_data:
                    history_data[mid] = []
                history_data[mid].append({"price": price, "t": snap["t"]})

    # Features
    X_list = []
    prices = []
    for m in markets:
        mid = m.get("market_id", "")
        hist = history_data.get(mid, [])
        features = extract_features(m, hist)
        X_list.append(features)
        prices.append(m.get("yes_price", 0.5))

    X = np.stack(X_list)
    y_prices = np.array(prices)

    # Treinar Edge Estimator
    from ..models.edge_estimator import EdgeEstimator
    X_3d = X.reshape(X.shape[0], 1, X.shape[1])
    split = int(len(X) * 0.8)

    # Usar preço como proxy de target (mercados com preço extremo tendem a resolver nessa direção)
    y = (y_prices > 0.5).astype(np.float32)

    estimator = EdgeEstimator(n_features=len(FEATURE_NAMES))
    estimator.feature_names = FEATURE_NAMES

    if split > 5:
        metrics = estimator.train(
            X_3d[:split], y[:split], X_3d[split:], y[split:],
            epochs=epochs, batch_size=min(32, split),
        )
    else:
        metrics = {"error": "Not enough data for split"}
        return metrics

    # Salvar modelo no S3
    import tempfile as tmp
    with tmp.TemporaryDirectory() as tmpdir:
        estimator.save(tmpdir)
        s3 = boto3.client("s3", region_name=REGION)
        for fname in os.listdir(tmpdir):
            s3.upload_file(
                os.path.join(tmpdir, fname), BUCKET,
                f"models/edge_estimator/{fname}",
            )

    # Treinar Anomaly Detector
    from ..models.anomaly_detector import AnomalyDetector
    detector = AnomalyDetector(n_features=len(FEATURE_NAMES))
    anomaly_metrics = detector.train(X, epochs=30)

    with tmp.TemporaryDirectory() as tmpdir:
        detector.save(tmpdir)
        for fname in os.listdir(tmpdir):
            s3.upload_file(
                os.path.join(tmpdir, fname), BUCKET,
                f"models/anomaly_detector/{fname}",
            )

    # Salvar métricas
    result = {
        "edge_estimator": metrics,
        "anomaly_detector": anomaly_metrics,
        "n_samples": len(X),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    save_json("models/training_metrics.json", result)
    logger.info(f"Training complete: {result}")
    return result
