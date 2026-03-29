"""
Script de treino — coleta dados históricos e treina o Edge Estimator.

Uso:
  python -m backend.train                    # coleta + treina
  python -m backend.train --skip-collect     # treina com dados existentes
  python -m backend.train --collect-only     # só coleta dados
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from pathlib import Path

import numpy as np

from backend.data.historical import collect_training_data, save_training_data, load_training_data
from backend.models.edge_estimator import EdgeEstimator
from backend.features import FEATURE_NAMES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

MODEL_DIR = Path("data/models/edge_estimator")


async def run_collection(n_markets: int = 500) -> str:
    samples = await collect_training_data(n_markets=n_markets)
    if not samples:
        raise RuntimeError("No training data collected")
    return save_training_data(samples)


def run_training(data_path: str | None = None, epochs: int = 100):
    samples = load_training_data(data_path)
    if not samples:
        raise RuntimeError("No training data found. Run with --collect first.")

    logger.info(f"Training with {len(samples)} samples")

    # Extrair features e target
    feature_keys = [k for k in FEATURE_NAMES]
    X_list = []
    y_list = []
    for s in samples:
        row = [s.get(k, 0.0) for k in feature_keys]
        X_list.append(row)
        y_list.append(s["outcome"])

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)

    # Reshape pra (n, 1, features) — single snapshot por mercado
    X = X.reshape(X.shape[0], 1, X.shape[1])

    # Split temporal (80/20)
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Features: {len(feature_keys)}")

    # Treinar
    estimator = EdgeEstimator(n_features=len(feature_keys))
    estimator.feature_names = feature_keys
    metrics = estimator.train(X_train, y_train, X_val, y_val, epochs=epochs)

    logger.info(f"Training complete: {metrics}")

    # Salvar
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    estimator.save(str(MODEL_DIR))
    logger.info(f"Model saved to {MODEL_DIR}")

    # Atualizar métricas no admin
    try:
        from backend.admin import update_model_trained
        update_model_trained("edge_estimator", {
            "brier_score": metrics.get("brier_score"),
            "accuracy": metrics.get("val_accuracy"),
            "train_samples": len(X_train),
        })
    except Exception:
        pass

    return metrics


async def main():
    parser = argparse.ArgumentParser(description="Train Edge Estimator")
    parser.add_argument("--skip-collect", action="store_true", help="Skip data collection")
    parser.add_argument("--collect-only", action="store_true", help="Only collect data")
    parser.add_argument("--n-markets", type=int, default=500, help="Markets to collect")
    parser.add_argument("--epochs", type=int, default=100, help="Training epochs")
    args = parser.parse_args()

    if not args.skip_collect:
        logger.info("Collecting training data...")
        data_path = await run_collection(args.n_markets)
        logger.info(f"Data saved to {data_path}")
    else:
        data_path = None

    if not args.collect_only:
        logger.info("Training model...")
        metrics = run_training(data_path, epochs=args.epochs)
        logger.info(f"Done. Metrics: {metrics}")


if __name__ == "__main__":
    asyncio.run(main())
