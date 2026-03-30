"""
Model inference — carrega modelos treinados do S3 e gera predições.

Chamado pelo refresh horário pra gerar sinais com IA real.
"""

from __future__ import annotations

import logging
import os
import tempfile

import numpy as np

from ..features import extract_features
from ..storage import load_json  # noqa: F401 — used in get_edge_estimator

logger = logging.getLogger(__name__)

BUCKET = "predikt-data-200093399689"

# Cache de modelos carregados
_edge_estimator = None
_anomaly_detector = None


def _load_model_from_s3(prefix: str, local_dir: str) -> bool:
    """Baixa arquivos do modelo do S3."""
    import boto3
    s3 = boto3.client("s3", region_name="us-east-1")
    try:
        resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
        files = [obj["Key"] for obj in resp.get("Contents", [])]
        if not files:
            return False
        os.makedirs(local_dir, exist_ok=True)
        for key in files:
            fname = key.split("/")[-1]
            if fname:
                s3.download_file(BUCKET, key, os.path.join(local_dir, fname))
        return True
    except Exception as e:
        logger.warning(f"Failed to load model from s3://{BUCKET}/{prefix}: {e}")
        return False


def get_edge_estimator():
    """Carrega Edge Estimator do S3 (cached)."""
    global _edge_estimator
    if _edge_estimator is not None:
        return _edge_estimator
    try:
        tmpdir = tempfile.mkdtemp()
        if _load_model_from_s3("models/edge_estimator/", tmpdir):
            from ..models.edge_estimator import EdgeEstimator
            _edge_estimator = EdgeEstimator.load(tmpdir)
            logger.info("Edge Estimator loaded from S3")
            return _edge_estimator
    except Exception as e:
        logger.warning(f"Failed to load Edge Estimator: {e}")
    return None


def get_anomaly_detector():
    """Carrega Anomaly Detector do S3 (cached)."""
    global _anomaly_detector
    if _anomaly_detector is not None:
        return _anomaly_detector
    try:
        tmpdir = tempfile.mkdtemp()
        if _load_model_from_s3("models/anomaly_detector/", tmpdir):
            from ..models.anomaly_detector import AnomalyDetector
            _anomaly_detector = AnomalyDetector.load(tmpdir)
            logger.info("Anomaly Detector loaded from S3")
            return _anomaly_detector
    except Exception as e:
        logger.warning(f"Failed to load Anomaly Detector: {e}")
    return None


def generate_ai_signals(markets: list[dict]) -> list[dict]:
    """Gera sinais usando modelos treinados. Fallback pra heurística se não treinados."""
    estimator = get_edge_estimator()
    detector = get_anomaly_detector()

    if not estimator:
        logger.info("Edge Estimator not trained — using heuristic signals")
        return _heuristic_signals(markets)

    # Extrair features
    X_list = []
    valid_markets = []
    for m in markets:
        try:
            features = extract_features(m)
            X_list.append(features)
            valid_markets.append(m)
        except Exception:
            continue

    if not X_list:
        return []

    X = np.stack(X_list)

    # Edge Estimator — prediz P(YES) real
    X_3d = X.reshape(X.shape[0], 1, X.shape[1])
    try:
        predicted_probs = estimator.predict(X_3d)
    except Exception as e:
        logger.warning(f"Edge prediction failed: {e}")
        return _heuristic_signals(markets)

    # Anomaly Detector
    anomalies = np.zeros(len(X), dtype=bool)
    anomaly_scores = np.zeros(len(X))
    if detector:
        try:
            anomalies, anomaly_scores = detector.detect(X)
        except Exception as e:
            logger.warning(f"Anomaly detection failed: {e}")

    # Gerar sinais
    signals = []
    for i, m in enumerate(valid_markets):
        market_price = m.get("yes_price", 0.5)
        ai_price = float(predicted_probs[i])
        edge = ai_price - market_price

        # Só gera sinal se edge > 5%
        if abs(edge) < 0.05:
            continue

        direction = "YES" if edge > 0 else "NO"
        score = min(abs(edge) * 2, 1.0)  # Normaliza 0-1

        signal = {
            "market_id": m["market_id"],
            "source": m["source"],
            "question": m["question"],
            "yes_price": market_price,
            "ai_estimated_price": round(ai_price, 4),
            "edge": round(edge, 4),
            "volume_24h": m.get("volume_24h", 0),
            "signal_score": round(score, 4),
            "signal_type": "ai_edge",
            "direction": direction,
            "is_anomaly": bool(anomalies[i]),
            "anomaly_score": round(float(anomaly_scores[i]), 6),
            "category": m.get("category", ""),
        }
        signals.append(signal)

    signals.sort(key=lambda s: s["signal_score"], reverse=True)
    logger.info(f"AI signals: {len(signals)} from {len(valid_markets)} markets (model-based)")
    return signals[:30]


def _heuristic_signals(markets: list[dict]) -> list[dict]:
    """Fallback: sinais baseados em heurística quando modelos não estão treinados."""
    signals = []
    for m in markets:
        v24 = m.get("volume_24h", 0)
        vtot = max(m.get("volume", 1), 1)
        yp = m.get("yes_price", 0.5)
        vol_ratio = v24 / vtot
        extremity = abs(yp - 0.5) * 2
        score = vol_ratio * 0.6 + extremity * 0.4
        if score > 0.1 and v24 > 5000:
            signals.append({
                "market_id": m["market_id"], "source": m["source"],
                "question": m["question"], "yes_price": yp,
                "volume_24h": v24, "signal_score": round(score, 4),
                "signal_type": "heuristic",
                "direction": "YES" if yp < 0.4 else "NO" if yp > 0.6 else "NEUTRAL",
                "category": m.get("category", ""),
            })
    signals.sort(key=lambda s: s["signal_score"], reverse=True)
    return signals[:30]
