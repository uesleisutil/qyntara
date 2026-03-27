"""
Script de treino TabPFN para SageMaker Training Job.
Treina classificação binária de direção (sobe/desce) e salva modelo.
"""

import argparse
import json
import logging
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--threshold', type=float, default=0.01)
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR', '/opt/ml/model'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAIN', '/opt/ml/input/data/train'))
    args, _ = parser.parse_known_args()

    logger.info("Loading data...")
    df = pd.read_csv(os.path.join(args.train, 'train.csv'))
    logger.info(f"Data: {len(df)} rows, {len(df.columns)} cols")

    target_col = 'target'
    if target_col not in df.columns:
        target_candidates = [c for c in df.columns if c == 'target' or 'target_return' in c.lower()]
        target_col = target_candidates[0] if target_candidates else df.columns[-1]

    exclude = ['ticker', 'date', 'date_index'] + [c for c in df.columns if 'target' in c.lower() or 'market_return' in c.lower()]
    feature_cols = [c for c in df.columns if c not in exclude and df[c].dtype in ['float64', 'float32', 'int64']]

    X = df[feature_cols].fillna(0).values.astype(np.float32)
    y = df[target_col].fillna(0).values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)

    # Outlier removal
    y_std = np.std(y)
    if y_std > 0:
        mask = np.abs(y) < 5 * y_std
        X, y = X[mask], y[mask]

    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Features: {len(feature_cols)}")

    # Filter ambiguous samples
    threshold = args.threshold
    clear_mask = np.abs(y_train) >= threshold
    X_clear = X_train[clear_mask]
    y_clear = (y_train[clear_mask] > 0).astype(int)
    logger.info(f"Filtered: {len(X_train)} -> {len(X_clear)} (removed {(~clear_mask).sum()} ambiguous)")

    # Normalize
    scaler = StandardScaler()
    scaler.fit(X_train)
    X_scaled = np.nan_to_num(scaler.transform(X_clear), nan=0.0, posinf=0.0, neginf=0.0)

    # Train TabPFN
    os.environ['TABPFN_ALLOW_CPU_LARGE_DATASET'] = '1'
    from tabpfn import TabPFNClassifier
    from tabpfn.constants import ModelVersion

    import torch
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    logger.info(f"Using device: {device}")

    model = TabPFNClassifier.create_default_for_version(
        ModelVersion.V2_5, device=device, ignore_pretraining_limits=True,
    )
    model.fit(X_scaled, y_clear)
    logger.info("TabPFN trained")

    # Validate
    X_val_scaled = np.nan_to_num(scaler.transform(X_val), nan=0.0, posinf=0.0, neginf=0.0)
    y_val_dir = (y_val > 0).astype(int)
    preds = model.predict(X_val_scaled)
    proba = model.predict_proba(X_val_scaled)

    dir_acc = float(np.mean(preds == y_val_dir))
    confident_mask = np.max(proba, axis=1) > 0.6
    confident_acc = float(np.mean(preds[confident_mask] == y_val_dir[confident_mask])) if confident_mask.any() else dir_acc

    logger.info(f"DirAcc={dir_acc:.1%}, ConfidentAcc={confident_acc:.1%} ({confident_mask.mean():.0%} confident)")

    # Save
    model_dir = args.model_dir
    os.makedirs(model_dir, exist_ok=True)

    with open(os.path.join(model_dir, 'tabpfn_model.pkl'), 'wb') as f:
        pickle.dump(model, f)
    with open(os.path.join(model_dir, 'tabpfn_scaler.pkl'), 'wb') as f:
        pickle.dump(scaler, f)
    with open(os.path.join(model_dir, 'tabpfn_features.json'), 'w') as f:
        json.dump(feature_cols, f)
    with open(os.path.join(model_dir, 'tabpfn_config.json'), 'w') as f:
        json.dump({'model_type': 'TabPFN', 'threshold': threshold}, f)

    metrics = {
        'directional_accuracy': dir_acc,
        'confident_accuracy': confident_acc,
        'confident_pct': float(confident_mask.mean()),
        'train_samples': len(X_clear),
        'val_samples': len(X_val),
        'n_features': len(feature_cols),
        'model_name': 'tabpfn',
    }
    with open(os.path.join(model_dir, 'tabpfn_metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)
    # Also save as metrics.json for compatibility
    with open(os.path.join(model_dir, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Model saved to {model_dir}")


if __name__ == '__main__':
    main()
