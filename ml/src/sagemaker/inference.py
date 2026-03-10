"""
Script de inferência para SageMaker - Ensemble de Modelos

Carrega modelos treinados e gera previsões.
"""

import json
import logging
import os
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def model_fn(model_dir):
    """
    Carrega o modelo do diretório.
    Chamado uma vez quando o endpoint é criado.
    """
    logger.info(f"Carregando modelo de {model_dir}")
    
    model_path = Path(model_dir)
    
    # Carregar XGBoost
    xgb_model = xgb.Booster()
    xgb_model.load_model(str(model_path / 'xgboost_model.json'))
    
    # Carregar métricas e feature names
    with open(model_path / 'metrics.json', 'r') as f:
        metrics = json.load(f)
    
    logger.info("Modelo carregado com sucesso")
    
    return {
        'xgboost': xgb_model,
        'feature_names': metrics['feature_names'],
        'metrics': metrics
    }


def input_fn(request_body, content_type='application/json'):
    """
    Processa a entrada da requisição.
    """
    logger.info(f"Processando input com content_type: {content_type}")
    
    if content_type == 'application/json':
        data = json.loads(request_body)
        
        # Espera formato: {"instances": [{"feature1": val1, "feature2": val2, ...}, ...]}
        if 'instances' in data:
            df = pd.DataFrame(data['instances'])
        else:
            df = pd.DataFrame([data])
        
        logger.info(f"Input processado: {len(df)} instâncias")
        return df
    
    elif content_type == 'text/csv':
        from io import StringIO
        df = pd.read_csv(StringIO(request_body))
        logger.info(f"CSV processado: {len(df)} instâncias")
        return df
    
    else:
        raise ValueError(f"Content type não suportado: {content_type}")


def predict_fn(input_data, model):
    """
    Gera previsões usando o modelo carregado.
    """
    logger.info(f"Gerando previsões para {len(input_data)} instâncias")
    
    xgb_model = model['xgboost']
    feature_names = model['feature_names']
    
    # Garantir que as features estão na ordem correta
    X = input_data[feature_names]
    
    # Converter para DMatrix
    dmatrix = xgb.DMatrix(X)
    
    # Gerar previsões
    predictions = xgb_model.predict(dmatrix)
    
    logger.info(f"Previsões geradas: {len(predictions)}")
    
    return predictions


def output_fn(prediction, accept='application/json'):
    """
    Formata a saída da previsão.
    """
    logger.info(f"Formatando output com accept: {accept}")
    
    if accept == 'application/json':
        return json.dumps({
            'predictions': prediction.tolist()
        }), accept
    
    elif accept == 'text/csv':
        from io import StringIO
        output = StringIO()
        pd.DataFrame({'prediction': prediction}).to_csv(output, index=False)
        return output.getvalue(), accept
    
    else:
        raise ValueError(f"Accept type não suportado: {accept}")
