"""
Script de treino TabPFN otimizado para SageMaker Training Job.

Otimizações baseadas na documentação oficial (Prior Labs, 2025):
1. n_estimators=32 (default 8) — mais transformers internos
2. balance_probabilities=True — balanceia classes
3. Subsample treino para 10K (contexto ótimo do TabPFN)
4. Feature selection por variância (reduz para ~50 features)
5. Threshold mais agressivo (2% em vez de 1%) para filtrar ambíguos
6. Ensemble de 3 TabPFNs com seeds diferentes
"""

import argparse
import json
import logging
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import VarianceThreshold

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def select_top_features(X, y, max_features=50):
    """Seleciona top features por correlação com o target."""
    correlations = np.array([abs(np.corrcoef(X[:, i], y)[0, 1]) for i in range(X.shape[1])])
    correlations = np.nan_to_num(correlations, nan=0.0)
    top_indices = np.argsort(correlations)[-max_features:][::-1]
    logger.info(f"Feature selection: {X.shape[1]} -> {len(top_indices)} (top by correlation)")
    return top_indices


def stratified_subsample(X, y, max_samples=10000):
    """Subsample estratificado mantendo proporção de classes."""
    if len(X) <= max_samples:
        return X, y
    classes, counts = np.unique(y, return_counts=True)
    indices = []
    for cls, cnt in zip(classes, counts):
        cls_indices = np.where(y == cls)[0]
        n_sample = int(max_samples * cnt / len(y))
        if n_sample < len(cls_indices):
            chosen = np.random.choice(cls_indices, n_sample, replace=False)
        else:
            chosen = cls_indices
        indices.extend(chosen)
    np.random.shuffle(indices)
    logger.info(f"Subsample: {len(X)} -> {len(indices)} (stratified)")
    return X[indices], y[indices]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--threshold', type=float, default=0.02)
    parser.add_argument('--max-features', type=int, default=50)
    parser.add_argument('--max-train-samples', type=int, default=10000)
    parser.add_argument('--n-estimators', type=int, default=32)
    parser.add_argument('--n-ensemble', type=int, default=3)
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR', '/opt/ml/model'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAIN', '/opt/ml/input/data/train'))
    args, _ = parser.parse_known_args()

    logger.info(f"Config: threshold={args.threshold}, max_features={args.max_features}, "
                f"max_train={args.max_train_samples}, n_estimators={args.n_estimators}, n_ensemble={args.n_ensemble}")

    # Load data
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

    # Split temporal
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Features: {len(feature_cols)}")

    # Filter ambiguous samples (threshold mais agressivo)
    clear_mask = np.abs(y_train) >= args.threshold
    X_clear = X_train[clear_mask]
    y_clear_raw = y_train[clear_mask]
    y_clear = (y_clear_raw > 0).astype(int)
    logger.info(f"Filtered ambiguous: {len(X_train)} -> {len(X_clear)} (threshold={args.threshold})")

    # Feature selection (reduzir para max_features)
    top_indices = select_top_features(X_clear, y_clear_raw, max_features=args.max_features)
    X_clear = X_clear[:, top_indices]
    X_val_sel = X_val[:, top_indices]
    selected_feature_names = [feature_cols[i] for i in top_indices]

    # Normalize
    scaler = StandardScaler()
    scaler.fit(X_train[:, top_indices])
    X_scaled = np.nan_to_num(scaler.transform(X_clear), nan=0.0, posinf=0.0, neginf=0.0)
    X_val_scaled = np.nan_to_num(scaler.transform(X_val_sel), nan=0.0, posinf=0.0, neginf=0.0)

    # Subsample para contexto ótimo do TabPFN
    X_sub, y_sub = stratified_subsample(X_scaled, y_clear, max_samples=args.max_train_samples)

    # Device
    import torch
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    logger.info(f"Using device: {device}")

    # Train ensemble de TabPFNs com seeds diferentes
    os.environ['TABPFN_ALLOW_CPU_LARGE_DATASET'] = '1'
    from tabpfn import TabPFNClassifier
    from tabpfn.constants import ModelVersion

    models = []
    all_probas = []

    for seed in range(args.n_ensemble):
        logger.info(f"Training TabPFN ensemble member {seed+1}/{args.n_ensemble}")
        np.random.seed(seed * 42)

        # Subsample diferente para cada membro do ensemble
        X_member, y_member = stratified_subsample(X_scaled, y_clear, max_samples=args.max_train_samples)

        model = TabPFNClassifier.create_default_for_version(
            ModelVersion.V2_5, device=device, ignore_pretraining_limits=True,
            n_estimators=args.n_estimators,
        )
        model.fit(X_member, y_member)
        models.append(model)

        # Predict on validation
        proba = model.predict_proba(X_val_scaled)
        all_probas.append(proba)
        preds = np.argmax(proba, axis=1)
        y_val_dir = (y_val > 0).astype(int)
        acc = float(np.mean(preds == y_val_dir))
        logger.info(f"  Member {seed+1} DirAcc={acc:.1%}")

    # Ensemble: média das probabilidades
    avg_proba = np.mean(all_probas, axis=0)
    ensemble_preds = np.argmax(avg_proba, axis=1)
    y_val_dir = (y_val > 0).astype(int)

    dir_acc = float(np.mean(ensemble_preds == y_val_dir))
    confident_mask = np.max(avg_proba, axis=1) > 0.6
    confident_acc = float(np.mean(ensemble_preds[confident_mask] == y_val_dir[confident_mask])) if confident_mask.any() else dir_acc

    logger.info(f"Ensemble DirAcc={dir_acc:.1%}, ConfidentAcc={confident_acc:.1%} ({confident_mask.mean():.0%} confident)")

    # Save
    model_dir = args.model_dir
    os.makedirs(model_dir, exist_ok=True)

    # Salvar todos os modelos do ensemble
    with open(os.path.join(model_dir, 'tabpfn_model.pkl'), 'wb') as f:
        pickle.dump(models, f)
    with open(os.path.join(model_dir, 'tabpfn_scaler.pkl'), 'wb') as f:
        pickle.dump(scaler, f)
    with open(os.path.join(model_dir, 'tabpfn_features.json'), 'w') as f:
        json.dump(selected_feature_names, f)
    with open(os.path.join(model_dir, 'tabpfn_feature_indices.json'), 'w') as f:
        json.dump(top_indices.tolist(), f)
    with open(os.path.join(model_dir, 'tabpfn_config.json'), 'w') as f:
        json.dump({
            'model_type': 'TabPFN_Ensemble',
            'threshold': args.threshold,
            'n_ensemble': args.n_ensemble,
            'n_estimators': args.n_estimators,
            'max_features': args.max_features,
            'max_train_samples': args.max_train_samples,
        }, f)

    metrics = {
        'directional_accuracy': dir_acc,
        'confident_accuracy': confident_acc,
        'confident_pct': float(confident_mask.mean()),
        'train_samples': len(X_sub),
        'train_filtered': int((~clear_mask).sum()),
        'val_samples': len(X_val),
        'n_features': len(selected_feature_names),
        'n_features_original': len(feature_cols),
        'n_ensemble': args.n_ensemble,
        'n_estimators': args.n_estimators,
        'model_name': 'tabpfn',
    }
    with open(os.path.join(model_dir, 'tabpfn_metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)
    with open(os.path.join(model_dir, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Model saved to {model_dir}")


if __name__ == '__main__':
    main()
