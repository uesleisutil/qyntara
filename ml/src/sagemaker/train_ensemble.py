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

# Prophet
try:
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    HAS_PROPHET = False
    logging.warning("Prophet não disponível")

# LSTM (TensorFlow/Keras)
try:
    import tensorflow as tf
    from tensorflow import keras
    HAS_LSTM = True
except ImportError:
    HAS_LSTM = False
    logging.warning("TensorFlow não disponível para LSTM")

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
    logger.info("Treinando XGBoost...")
    
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)
    
    params = {
        'objective': 'reg:squarederror',
        'max_depth': hyperparameters.get('max_depth', 6),
        'learning_rate': hyperparameters.get('learning_rate', 0.1),
        'subsample': hyperparameters.get('subsample', 0.8),
        'colsample_bytree': hyperparameters.get('colsample_bytree', 0.8),
        'eval_metric': 'rmse',
        'tree_method': 'hist'
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


def train_lstm(X_train, y_train, X_val, y_val, hyperparameters):
    """Treina modelo LSTM"""
    if not HAS_LSTM:
        logger.warning("LSTM não disponível, pulando...")
        return None, {'error': 'TensorFlow não disponível'}
    
    logger.info("Treinando LSTM...")
    
    # Reshape para LSTM [samples, timesteps, features]
    X_train_lstm = X_train.values.reshape((X_train.shape[0], 1, X_train.shape[1]))
    X_val_lstm = X_val.values.reshape((X_val.shape[0], 1, X_val.shape[1]))
    
    # Criar modelo
    model = keras.Sequential([
        keras.layers.LSTM(64, activation='relu', input_shape=(1, X_train.shape[1])),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dense(1)
    ])
    
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    
    # Early stopping
    early_stop = keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True
    )
    
    # Treinar
    history = model.fit(
        X_train_lstm, y_train,
        validation_data=(X_val_lstm, y_val),
        epochs=100,
        batch_size=32,
        callbacks=[early_stop],
        verbose=0
    )
    
    # Métricas
    train_pred = model.predict(X_train_lstm, verbose=0).flatten()
    val_pred = model.predict(X_val_lstm, verbose=0).flatten()
    
    train_rmse = np.sqrt(np.mean((y_train.values - train_pred) ** 2))
    val_rmse = np.sqrt(np.mean((y_val.values - val_pred) ** 2))
    
    logger.info(f"LSTM - Train RMSE: {train_rmse:.6f}, Val RMSE: {val_rmse:.6f}")
    
    return model, {
        'train_rmse': float(train_rmse),
        'val_rmse': float(val_rmse),
        'epochs': len(history.history['loss'])
    }


def train_prophet(df_train, df_val, target_col='target'):
    """Treina modelo Prophet"""
    if not HAS_PROPHET:
        logger.warning("Prophet não disponível, pulando...")
        return None, {'error': 'Prophet não disponível'}
    
    logger.info("Treinando Prophet...")
    
    # Preparar dados para Prophet (precisa de 'ds' e 'y')
    prophet_train = pd.DataFrame({
        'ds': pd.date_range(start='2020-01-01', periods=len(df_train), freq='D'),
        'y': df_train[target_col].values
    })
    
    prophet_val = pd.DataFrame({
        'ds': pd.date_range(start='2020-01-01', periods=len(df_val), freq='D'),
        'y': df_val[target_col].values
    })
    
    # Criar e treinar modelo
    model = Prophet(
        changepoint_prior_scale=0.05,
        seasonality_prior_scale=10.0,
        daily_seasonality=False,
        weekly_seasonality=False,
        yearly_seasonality=False
    )
    
    model.fit(prophet_train)
    
    # Predições
    train_pred = model.predict(prophet_train)['yhat'].values
    val_pred = model.predict(prophet_val)['yhat'].values
    
    train_rmse = np.sqrt(np.mean((df_train[target_col].values - train_pred) ** 2))
    val_rmse = np.sqrt(np.mean((df_val[target_col].values - val_pred) ** 2))
    
    logger.info(f"Prophet - Train RMSE: {train_rmse:.6f}, Val RMSE: {val_rmse:.6f}")
    
    return model, {
        'train_rmse': float(train_rmse),
        'val_rmse': float(val_rmse)
    }


def calculate_ensemble_weights(metrics_dict):
    """
    Calcula pesos do ensemble baseado em performance (inverse RMSE).
    Modelos com menor RMSE recebem maior peso.
    """
    weights = {}
    total_inverse_rmse = 0
    
    # Calcular inverse RMSE para cada modelo
    for model_name, metrics in metrics_dict.items():
        if 'error' not in metrics and 'val_rmse' in metrics:
            inverse_rmse = 1.0 / (metrics['val_rmse'] + 1e-10)
            weights[model_name] = inverse_rmse
            total_inverse_rmse += inverse_rmse
    
    # Normalizar para somar 1
    if total_inverse_rmse > 0:
        for model_name in weights:
            weights[model_name] = weights[model_name] / total_inverse_rmse
    
    logger.info(f"Pesos do ensemble: {weights}")
    
    return weights


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
    
    # Hyperparameters (aceitar tanto underscore quanto hyphen)
    parser.add_argument('--max-depth', '--max_depth', type=int, default=6, dest='max_depth')
    parser.add_argument('--learning-rate', '--learning_rate', type=float, default=0.1, dest='learning_rate')
    parser.add_argument('--n-estimators', '--n_estimators', type=int, default=100, dest='n_estimators')
    parser.add_argument('--subsample', type=float, default=0.8)
    parser.add_argument('--colsample-bytree', '--colsample_bytree', type=float, default=0.8, dest='colsample_bytree')
    parser.add_argument('--n-features', '--n_features', type=int, default=30, dest='n_features')
    parser.add_argument('--cv-splits', '--cv_splits', type=int, default=5, dest='cv_splits')
    
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
    
    # ========================================
    # TREINAR ENSEMBLE DE 3 MODELOS
    # ========================================
    
    logger.info("=" * 60)
    logger.info("TREINANDO ENSEMBLE: XGBoost + LSTM + Prophet")
    logger.info("=" * 60)
    
    models = {}
    metrics = {}
    
    # 1. XGBoost
    logger.info("\n[1/3] Treinando XGBoost...")
    xgb_model, xgb_metrics = train_xgboost(X_train, y_train, X_val, y_val, hyperparameters)
    models['xgboost'] = xgb_model
    metrics['xgboost'] = xgb_metrics
    
    # 2. LSTM
    logger.info("\n[2/3] Treinando LSTM...")
    lstm_model, lstm_metrics = train_lstm(X_train, y_train, X_val, y_val, hyperparameters)
    if lstm_model is not None:
        models['lstm'] = lstm_model
        metrics['lstm'] = lstm_metrics
    
    # 3. Prophet
    logger.info("\n[3/3] Treinando Prophet...")
    # Prophet precisa do dataframe completo com target
    df_train_prophet = X_train.copy()
    df_train_prophet['target'] = y_train.values
    df_val_prophet = X_val.copy()
    df_val_prophet['target'] = y_val.values
    
    prophet_model, prophet_metrics = train_prophet(df_train_prophet, df_val_prophet)
    if prophet_model is not None:
        models['prophet'] = prophet_model
        metrics['prophet'] = prophet_metrics
    
    # Calcular pesos do ensemble
    logger.info("\n" + "=" * 60)
    logger.info("CALCULANDO PESOS DO ENSEMBLE")
    logger.info("=" * 60)
    
    ensemble_weights = calculate_ensemble_weights(metrics)
    
    # Fazer predições ensemble no validation set
    logger.info("\nGerando predições ensemble...")
    ensemble_val_pred = np.zeros(len(y_val))
    
    if 'xgboost' in models:
        xgb_pred = models['xgboost'].predict(xgb.DMatrix(X_val))
        ensemble_val_pred += xgb_pred * ensemble_weights.get('xgboost', 0)
    
    if 'lstm' in models:
        X_val_lstm = X_val.values.reshape((X_val.shape[0], 1, X_val.shape[1]))
        lstm_pred = models['lstm'].predict(X_val_lstm, verbose=0).flatten()
        ensemble_val_pred += lstm_pred * ensemble_weights.get('lstm', 0)
    
    if 'prophet' in models:
        prophet_df = pd.DataFrame({
            'ds': pd.date_range(start='2020-01-01', periods=len(X_val), freq='D')
        })
        prophet_pred = models['prophet'].predict(prophet_df)['yhat'].values
        ensemble_val_pred += prophet_pred * ensemble_weights.get('prophet', 0)
    
    # Métricas do ensemble
    ensemble_rmse = np.sqrt(np.mean((y_val.values - ensemble_val_pred) ** 2))
    ensemble_mae = np.mean(np.abs(y_val.values - ensemble_val_pred))
    
    logger.info(f"\nEnsemble - Val RMSE: {ensemble_rmse:.6f}, Val MAE: {ensemble_mae:.6f}")
    
    # Salvar modelos
    model_path = Path(args.model_dir)
    model_path.mkdir(parents=True, exist_ok=True)
    
    # Salvar XGBoost
    if 'xgboost' in models:
        models['xgboost'].save_model(str(model_path / 'xgboost_model.json'))
        logger.info(f"XGBoost salvo em {model_path / 'xgboost_model.json'}")
    
    # Salvar LSTM
    if 'lstm' in models:
        models['lstm'].save(str(model_path / 'lstm_model.h5'))
        logger.info(f"LSTM salvo em {model_path / 'lstm_model.h5'}")
    
    # Salvar Prophet
    if 'prophet' in models:
        with open(model_path / 'prophet_model.pkl', 'wb') as f:
            pickle.dump(models['prophet'], f)
        logger.info(f"Prophet salvo em {model_path / 'prophet_model.pkl'}")
    
    # Salvar métricas consolidadas
    all_metrics = {
        'ensemble': {
            'val_rmse': float(ensemble_rmse),
            'val_mae': float(ensemble_mae),
            'weights': ensemble_weights,
            'models_used': list(models.keys())
        },
        'individual_models': metrics,
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
        json.dump(all_metrics, f, indent=2)
    
    logger.info(f"Métricas salvas em {model_path / 'metrics.json'}")
    
    # Feature importance (apenas XGBoost)
    if 'xgboost' in models:
        importance = models['xgboost'].get_score(importance_type='gain')
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
    
    # Salvar pesos do ensemble
    with open(model_path / 'ensemble_weights.json', 'w') as f:
        json.dump(ensemble_weights, f, indent=2)
    
    logger.info("\n" + "=" * 60)
    logger.info("RESUMO DO TREINAMENTO")
    logger.info("=" * 60)
    logger.info(f"Modelos treinados: {list(models.keys())}")
    logger.info(f"Ensemble Val RMSE: {ensemble_rmse:.6f}")
    logger.info(f"Ensemble Val MAE: {ensemble_mae:.6f}")
    logger.info(f"Pesos: {ensemble_weights}")
    logger.info("=" * 60)
    
    # Criar tar.gz com todos os modelos
    logger.info("\nCriando model.tar.gz...")
    tar_path = model_path / 'model.tar.gz'
    
    with tarfile.open(tar_path, 'w:gz') as tar:
        # Adicionar todos os arquivos de modelo
        if (model_path / 'xgboost_model.json').exists():
            tar.add(model_path / 'xgboost_model.json', arcname='xgboost_model.json')
        if (model_path / 'lstm_model.h5').exists():
            tar.add(model_path / 'lstm_model.h5', arcname='lstm_model.h5')
        if (model_path / 'prophet_model.pkl').exists():
            tar.add(model_path / 'prophet_model.pkl', arcname='prophet_model.pkl')
        
        # Adicionar metadados
        tar.add(model_path / 'metrics.json', arcname='metrics.json')
        tar.add(model_path / 'selected_features.json', arcname='selected_features.json')
        tar.add(model_path / 'ensemble_weights.json', arcname='ensemble_weights.json')
        
        if (model_path / 'feature_importance.csv').exists():
            tar.add(model_path / 'feature_importance.csv', arcname='feature_importance.csv')
    
    logger.info(f"model.tar.gz criado em {tar_path}")
    logger.info("\n✅ Treinamento concluído com sucesso!")


if __name__ == '__main__':
    main()
