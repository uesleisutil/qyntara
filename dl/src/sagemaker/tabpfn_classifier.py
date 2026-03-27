"""
TabPFN Classifier para classificação binária de direção (sobe/desce).

TabPFN é um foundation model (Transformer pré-treinado) para dados tabulares
que supera XGBoost em classificação sem precisar de treino/tuning.

Approach híbrido:
- TabPFN → classificação binária (sobe/desce) + probabilidade de confiança
- Transformer+BiLSTM → regressão (magnitude do retorno)
- Combinação: sinal do TabPFN × magnitude do Transformer = predição final
"""

import json
import logging
import os
import pickle

import numpy as np
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


class TabPFNDirectionModel:
    """
    Wrapper do TabPFN para classificação de direção de ações.
    
    - Filtra amostras ambíguas (|retorno| < 1%) no treino
    - Usa TabPFN para classificação binária
    - Retorna probabilidade de alta e sinal de direção
    """

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names: list[str] = []
        self.metrics: dict = {}
        self.threshold = 0.01  # filtrar |retorno| < 1% no treino

    def train(self, X_train: np.ndarray, y_train: np.ndarray,
              X_val: np.ndarray = None, y_val: np.ndarray = None) -> dict:
        """Treina TabPFN com amostras filtradas."""
        from tabpfn import TabPFNClassifier

        # Filtrar amostras ambíguas (|retorno| < threshold)
        clear_mask = np.abs(y_train) >= self.threshold
        X_clear = X_train[clear_mask]
        y_clear = (y_train[clear_mask] > 0).astype(int)  # 0=desce, 1=sobe
        logger.info(f"TabPFN: {len(X_train)} -> {len(X_clear)} amostras (filtradas {(~clear_mask).sum()} ambíguas)")

        # Normalizar features
        self.scaler.fit(X_train)
        X_scaled = self.scaler.transform(X_clear)
        X_scaled = np.nan_to_num(X_scaled, nan=0.0, posinf=0.0, neginf=0.0)

        # Treinar TabPFN (usar v2.5 que não requer autenticação HuggingFace)
        from tabpfn import TabPFNClassifier
        from tabpfn.constants import ModelVersion
        self.model = TabPFNClassifier.create_default_for_version(
            ModelVersion.V2_5, device='cpu', ignore_pretraining_limits=True,
        )
        self.model.fit(X_scaled, y_clear)
        logger.info("TabPFN treinado")

        # Métricas na validação
        metrics = {}
        if X_val is not None:
            X_val_scaled = np.nan_to_num(self.scaler.transform(X_val), nan=0.0, posinf=0.0, neginf=0.0)
            y_val_dir = (y_val > 0).astype(int)
            preds = self.model.predict(X_val_scaled)
            proba = self.model.predict_proba(X_val_scaled)

            dir_acc = float(np.mean(preds == y_val_dir))
            # Acurácia só em amostras de alta confiança (prob > 0.6)
            confident_mask = np.max(proba, axis=1) > 0.6
            if confident_mask.any():
                confident_acc = float(np.mean(preds[confident_mask] == y_val_dir[confident_mask]))
                confident_pct = float(confident_mask.mean())
            else:
                confident_acc = dir_acc
                confident_pct = 0.0

            metrics = {
                'directional_accuracy': dir_acc,
                'confident_accuracy': confident_acc,
                'confident_pct': confident_pct,
                'train_samples': len(X_clear),
                'train_filtered': int((~clear_mask).sum()),
                'val_samples': len(X_val),
            }
            logger.info(f"TabPFN: DirAcc={dir_acc:.1%}, ConfidentAcc={confident_acc:.1%} ({confident_pct:.0%} amostras)")

        self.metrics = metrics
        return metrics

    def predict_direction(self, X: np.ndarray) -> tuple:
        """
        Retorna (directions, probabilities).
        Suporta modelo único ou ensemble de modelos.
        """
        X_scaled = np.nan_to_num(self.scaler.transform(X), nan=0.0, posinf=0.0, neginf=0.0)

        # Ensemble: self.model pode ser lista de modelos
        if isinstance(self.model, list):
            all_probas = [m.predict_proba(X_scaled) for m in self.model]
            proba = np.mean(all_probas, axis=0)
        else:
            proba = self.model.predict_proba(X_scaled)

        prob_up = proba[:, 1] if proba.shape[1] > 1 else proba[:, 0]
        directions = np.where(prob_up > 0.5, 1.0, -1.0)
        confidence = np.abs(prob_up - 0.5) * 2
        return directions, confidence

    def save(self, path: str):
        os.makedirs(path, exist_ok=True)
        with open(os.path.join(path, 'tabpfn_model.pkl'), 'wb') as f:
            pickle.dump(self.model, f)
        with open(os.path.join(path, 'tabpfn_scaler.pkl'), 'wb') as f:
            pickle.dump(self.scaler, f)
        with open(os.path.join(path, 'tabpfn_metrics.json'), 'w') as f:
            json.dump(self.metrics, f, indent=2)
        if self.feature_names:
            with open(os.path.join(path, 'tabpfn_features.json'), 'w') as f:
                json.dump(self.feature_names, f)
        config = {'model_type': 'TabPFN', 'threshold': self.threshold}
        with open(os.path.join(path, 'tabpfn_config.json'), 'w') as f:
            json.dump(config, f)
        logger.info(f"TabPFN salvo em {path}")

    @classmethod
    def load(cls, path: str) -> 'TabPFNDirectionModel':
        obj = cls()
        with open(os.path.join(path, 'tabpfn_model.pkl'), 'rb') as f:
            obj.model = pickle.load(f)
        with open(os.path.join(path, 'tabpfn_scaler.pkl'), 'rb') as f:
            obj.scaler = pickle.load(f)
        metrics_path = os.path.join(path, 'tabpfn_metrics.json')
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                obj.metrics = json.load(f)
        features_path = os.path.join(path, 'tabpfn_features.json')
        if os.path.exists(features_path):
            with open(features_path, 'r') as f:
                obj.feature_names = json.load(f)
        logger.info(f"TabPFN carregado de {path}")
        return obj
