"""
Script de treinamento para SageMaker - Ensemble de Modelos

Treina XGBoost com features avançadas, walk-forward validation e feature selection.
Pode rodar em qualquer instância SageMaker (ml.m5.xlarge, ml.c5.2xlarge, etc)

Salva modelo em model.tar.gz pronto para inferência in-memory.
"""

import argparse
import json
import logging
import os
import pickle
import sys
import tarfile
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.feature_selection import SelectKBest, f_regression

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def select_best_features(X, y, k=30):
    """Seleciona as k melhores features usando F-statistic."""
    logger.info(f"Selecionando top {k} features de {X.shape[1]} disponíveis...")
    
    selector = SelectKBest(score_func=f_regression, k=min(k, X.shape[1]))
    selector.fit(X, y)
    
    # Obter scores das features
    scores = pd.DataFrame({
        'feature': X.columns,
        'score': selector.scores_
    }).sort_values('score', ascending=False)
    
    logger.info(f"Top 10 features: {scores.head(10)['feature'].tolist()}")
    
    selected_features = scores.head(k)['feature'].tolist()
    
    return selected_features, scores


def walk_forward_validation(X, y, hyperparameters, n_splits=5):
    """
    Walk-forward validation temporal.
    Treina em janelas crescentes e valida no período seguinte.
    """
    logger.info(f"Iniciando walk-forward validation com {n_splits} splits...")
    
    tscv = TimeSeriesSplit(n_splits=n_splits)
    fold_metrics = []
    
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
        logger.info(f"Fold {fold}/{n_splits}")
        
        X_train_fold = X.iloc[train_idx]
        y_train_fold = y.iloc[train_idx]
        X_val_fold = X.iloc[val_idx]
        y_val_fold = y.iloc[val_idx]
        
        dtrain = xgb.DMatrix(X_train_fold, label=y_train_fold)
        dval = xgb.DMatrix(X_val_fold, label=y_val_fold)
        
        params = {
            'objective': 'reg:squarederror',
            'max_depth': hyperparameters.get('max_depth', 6),
            'learning_rate': hyperparameters.get('learning_rate', 0.1),
            'subsample': hyperparameters.get('subsample', 0.8),
            'colsample_bytree': hyperparameters.get('colsample_bytree', 0.8),
            'eval_metric': 'rmse'
        }
        
        model = xgb.train(
            params,
            dtrain,
            num_boost_round=hyperparameters.get('n_estimators', 100),
            evals=[(dval, 'val')],
            early_stopping_rounds=10,
            verbose_eval=False
        )
        
        # Métricas
        val_pred = model.predict(dval)
        val_rmse = np.sqrt(np.mean((y_val_fold.values - val_pred) ** 2))
        val_mape = calculate_mape(y_val_fold.values, val_pred)
        
        fold_metrics.append({
            'fold': fold,
            'val_rmse': float(val_rmse),
            'val_mape': float(val_mape),
            'train_size': len(train_idx),
            'val_size': len(val_idx)
        })
        
        logger.info(f"Fold {fold} - Val RMSE: {val_rmse:.6f}, Val MAPE: {val_mape:.2f}%")
    
    # Métricas agregadas
    avg_rmse = np.mean([m['val_rmse'] for m in fold_metrics])
    avg_mape = np.mean([m['val_mape'] for m in fold_metrics])
    std_rmse = np.std([m['val_rmse'] for m in fold_metrics])
    
    logger.info(f"Walk-forward CV - Avg RMSE: {avg_rmse:.6f} ± {std_rmse:.6f}, Avg MAPE: {avg_mape:.2f}%")
    
    return fold_metrics, avg_rmse, avg_mape


def train_xgboost(X_train, y_train, X_val, y_val, hyperparameters):
    """Treina modelo XGBoost"""
    logger.info("Treinando XGBoost final...")
    
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)
    
    params = {
        'objective': 'reg:squarederror',
        'max_depth': hyperparameters.get('max_depth', 6),
        'learning_rate': hyperparameters.get('learning_rate', 0.1),
        'subsample': hyperparameters.get('subsample', 0.8),
        'colsample_bytree': hyperparameters.get('colsample_bytree', 0.8),
        'eval_metric': 'rmse',
        'tree_method': 'hist'  # Mais rápido
    }
    
    evals = [(dtrain, 'train'), (dval, 'val')]
    evals_result = {}
    
    model = xgb.train(
        params,
        dtrain,
        num_boost_round=hyperparameters.get('n_estimators', 100),
        evals=evals,
        early_stopping_rounds=10,
        evals_result=evals_result,
        verbose_eval=10
    )
    
    # Calcular métricas
    train_pred = model.predict(dtrain)
    val_pred = model.predict(dval)
    
    train_rmse = np.sqrt(np.mean((y_train - train_pred) ** 2))
    val_rmse = np.sqrt(np.mean((y_val - val_pred) ** 2))
    
    logger.info(f"XGBoost - Train RMSE: {train_rmse:.6f}, Val RMSE: {val_rmse:.6f}")
    
    return model, {
        'train_rmse': float(train_rmse),
        'val_rmse': float(val_rmse),
        'best_iteration': model.best_iteration
    }


def calculate_mape(y_true, y_pred):
    """Calcula MAPE"""
    epsilon = 1e-10
    return np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + epsilon))) * 100


def main():
    parser = argparse.ArgumentParser()
    
    # Hyperparameters
    parser.add_argument('--max_depth', type=int, default=6)
    parser.add_argument('--learning_rate', type=float, default=0.1)
    parser.add_argument('--n_estimators', type=int, default=100)
    parser.add_argument('--subsample', type=float, default=0.8)
    parser.add_argument('--colsample_bytree', type=float, default=0.8)
    parser.add_argument('--n_features', type=int, default=30)  # Feature selection
    parser.add_argument('--cv_splits', type=int, default=5)  # Walk-forward splits
    
    # SageMaker directories
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR', '/opt/ml/model'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAIN', '/opt/ml/input/data/train'))
    parser.add_argument('--output-data-dir', type=str, default=os.environ.get('SM_OUTPUT_DATA_DIR', '/opt/ml/output'))
    
    args = parser.parse_args()
    
    logger.info(f"Arguments: {args}")
    
    # Carregar dados
    train_file = Path(args.train) / 'train.csv'
    logger.info(f"Carregando dados de {train_file}")
    
    df = pd.read_csv(train_file)
    logger.info(f"Dados carregados: {len(df)} linhas, {len(df.columns)} colunas")
    
    # Separar features e target
    exclude_cols = ['target', 'ticker', 'date', 'date_index']
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    X = df[feature_cols]
    y = df['target']
    
    logger.info(f"Features iniciais: {len(feature_cols)}")
    logger.info(f"Target: {y.name}")
    
    # Feature selection
    selected_features, feature_scores = select_best_features(X, y, k=args.n_features)
    X_selected = X[selected_features]
    
    logger.info(f"Features selecionadas: {len(selected_features)}")
    
    # Split temporal (80/20)
    split_idx = int(len(X_selected) * 0.8)
    X_train = X_selected.iloc[:split_idx]
    X_val = X_selected.iloc[split_idx:]
    y_train = y.iloc[:split_idx]
    y_val = y.iloc[split_idx:]
    
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}")
    
    # Walk-forward validation
    hyperparameters = {
        'max_depth': args.max_depth,
        'learning_rate': args.learning_rate,
        'n_estimators': args.n_estimators,
        'subsample': args.subsample,
        'colsample_bytree': args.colsample_bytree
    }
    
    cv_metrics, cv_rmse, cv_mape = walk_forward_validation(
        X_selected, y, hyperparameters, n_splits=args.cv_splits
    )
    
    # Treinar modelo final
    xgb_model, xgb_metrics = train_xgboost(X_train, y_train, X_val, y_val, hyperparameters)
    
    # Calcular MAPE
    val_pred = xgb_model.predict(xgb.DMatrix(X_val))
    mape = calculate_mape(y_val.values, val_pred)
    xgb_metrics['mape'] = float(mape)
    
    logger.info(f"XGBoost MAPE: {mape:.2f}%")
    
    # Salvar modelo
    model_path = Path(args.model_dir)
    model_path.mkdir(parents=True, exist_ok=True)
    
    xgb_model.save_model(str(model_path / 'xgboost_model.json'))
    logger.info(f"Modelo XGBoost salvo em {model_path / 'xgboost_model.json'}")
    
    # Salvar métricas
    metrics = {
        'xgboost': xgb_metrics,
        'walk_forward_cv': {
            'avg_rmse': float(cv_rmse),
            'avg_mape': float(cv_mape),
            'folds': cv_metrics
        },
        'feature_selection': {
            'n_features_selected': len(selected_features),
            'selected_features': selected_features
        },
        'hyperparameters': hyperparameters,
        'train_date': datetime.now().isoformat(),
        'train_samples': len(X_train),
        'val_samples': len(X_val)
    }
    
    with open(model_path / 'metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)
    
    logger.info(f"Métricas salvas em {model_path / 'metrics.json'}")
    
    # Feature importance
    importance = xgb_model.get_score(importance_type='gain')
    importance_df = pd.DataFrame([
        {'feature': k, 'importance': v}
        for k, v in importance.items()
    ]).sort_values('importance', ascending=False)
    
    importance_df.to_csv(model_path / 'feature_importance.csv', index=False)
    logger.info("Feature importance salva")
    
    # Salvar feature scores
    feature_scores.to_csv(model_path / 'feature_scores.csv', index=False)
    logger.info("Feature scores salvos")
    
    # Salvar lista de features selecionadas
    with open(model_path / 'selected_features.json', 'w') as f:
        json.dump(selected_features, f, indent=2)
    
    logger.info("Treinamento concluído com sucesso!")
    logger.info(f"CV RMSE: {cv_rmse:.6f}, CV MAPE: {cv_mape:.2f}%")
    logger.info(f"Final Val RMSE: {xgb_metrics['val_rmse']:.6f}, Val MAPE: {mape:.2f}%")
    
    # Criar tar.gz para facilitar deploy
    logger.info("Criando model.tar.gz...")
    import tarfile
    tar_path = model_path / 'model.tar.gz'
    with tarfile.open(tar_path, 'w:gz') as tar:
        tar.add(model_path / 'xgboost_model.json', arcname='xgboost_model.json')
        tar.add(model_path / 'metrics.json', arcname='metrics.json')
        tar.add(model_path / 'selected_features.json', arcname='selected_features.json')
        tar.add(model_path / 'feature_importance.csv', arcname='feature_importance.csv')
    
    logger.info(f"model.tar.gz criado em {tar_path}")


if __name__ == '__main__':
    main()
