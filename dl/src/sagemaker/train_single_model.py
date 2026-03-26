"""
Script de treino para SageMaker Training Job.
Treina um único modelo DL (Transformer+BiLSTM, TabTransformer ou FT-Transformer).

Recebe dados via S3 channel 'train', salva modelo em /opt/ml/model/.
SageMaker empacota /opt/ml/model/ em model.tar.gz automaticamente.
"""

import argparse
import json
import logging
import os
import pickle
import sys
import tarfile
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Importar modelos do train_deep_learning
sys.path.insert(0, '/opt/ml/code')
sys.path.insert(0, os.path.dirname(__file__))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-name', type=str, required=True)
    parser.add_argument('--epochs', type=int, default=120)
    parser.add_argument('--batch-size', type=int, default=128)
    parser.add_argument('--lr', type=float, default=5e-4)
    parser.add_argument('--patience', type=int, default=20)
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR', '/opt/ml/model'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAIN', '/opt/ml/input/data/train'))
    parser.add_argument('--output-data-dir', type=str, default=os.environ.get('SM_OUTPUT_DATA_DIR', '/opt/ml/output'))
    args, _ = parser.parse_known_args()

    logger.info(f"Training {args.model_name} with epochs={args.epochs}, lr={args.lr}")

    # Carregar dados
    train_file = os.path.join(args.train, 'train.csv')
    logger.info(f"Loading data from {train_file}")
    df = pd.read_csv(train_file)
    logger.info(f"Data loaded: {len(df)} rows, {len(df.columns)} columns")

    # Separar features e target
    target_col = 'target'
    if target_col not in df.columns:
        target_candidates = [c for c in df.columns if c == 'target' or 'target_return' in c.lower()]
        target_col = target_candidates[0] if target_candidates else df.columns[-1]

    exclude_cols = ['ticker', 'date', 'date_index'] + [c for c in df.columns if 'target' in c.lower() or 'market_return' in c.lower()]
    feature_cols = [c for c in df.columns if c not in exclude_cols and df[c].dtype in ['float64', 'float32', 'int64']]

    X = df[feature_cols].fillna(0).values.astype(np.float32)
    y = df[target_col].fillna(0).values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)

    # Remover outliers
    y_std = np.std(y)
    if y_std > 0:
        mask = np.abs(y) < 5 * y_std
        X, y = X[mask], y[mask]
        logger.info(f"After outlier removal: {len(X)} samples")

    # Split temporal
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    n_features = X.shape[1]
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Features: {n_features}")

    # Importar modelos
    from train_deep_learning import (
        DeepLearningTrainer, MODEL_REGISTRY,
        TransformerBiLSTMModel, TabTransformerModel, FTTransformerModel,
    )

    reg = MODEL_REGISTRY[args.model_name]
    model_cls = reg['class']
    kwargs = reg['default_kwargs'].copy()

    trainer = DeepLearningTrainer(n_features=n_features, device='cpu')
    trainer.model = model_cls(n_features=n_features, **kwargs).to(torch.device('cpu'))
    trainer.feature_names = feature_cols

    metrics = trainer.train(
        X_train, y_train, X_val, y_val,
        epochs=args.epochs, batch_size=args.batch_size, lr=args.lr, patience=args.patience,
    )
    metrics['model_name'] = args.model_name
    metrics['n_features'] = n_features
    metrics['train_samples'] = len(X_train)
    trainer.metrics = metrics

    logger.info(f"Training complete: RMSE={metrics.get('val_rmse', 0):.4f} DirAcc={metrics.get('directional_accuracy', 0):.1%}")

    # Salvar modelo no diretório do SageMaker
    model_dir = args.model_dir
    os.makedirs(model_dir, exist_ok=True)
    trainer.save(model_dir)

    logger.info(f"Model saved to {model_dir}")
    logger.info(f"Files: {os.listdir(model_dir)}")


if __name__ == '__main__':
    main()
