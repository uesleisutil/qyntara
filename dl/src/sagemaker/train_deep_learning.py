"""
Script de treinamento Deep Learning para SageMaker.

Treina modelo DL: Transformer Encoder + BiLSTM com:
- Multi-head self-attention para capturar dependências temporais
- BiLSTM para contexto bidirecional
- Residual connections e Layer Normalization
- Walk-forward validation temporal
- SHAP-based feature selection (compartilhada com DL)

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
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PositionalEncoding(nn.Module):
    """Positional encoding para sequências temporais."""

    def __init__(self, d_model: int, max_len: int = 512, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        if d_model > 1:
            pe[:, 1::2] = torch.cos(position * div_term[:d_model // 2])
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.pe[:, :x.size(1)]
        return self.dropout(x)


class TransformerBiLSTMModel(nn.Module):
    """
    Modelo híbrido Transformer Encoder + BiLSTM para previsão de retornos.

    Arquitetura:
    1. Input projection: features → d_model
    2. Positional encoding
    3. Transformer Encoder (multi-head self-attention)
    4. BiLSTM para contexto bidirecional
    5. Attention pooling
    6. MLP head com residual connections
    7. Output: retorno esperado (regressão)
    """

    def __init__(
        self,
        n_features: int,
        d_model: int = 128,
        nhead: int = 4,
        num_encoder_layers: int = 2,
        lstm_hidden: int = 64,
        lstm_layers: int = 1,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.n_features = n_features
        self.d_model = d_model

        # Input projection
        self.input_proj = nn.Sequential(
            nn.Linear(n_features, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # Positional encoding
        self.pos_enc = PositionalEncoding(d_model, dropout=dropout)

        # Transformer Encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=d_model * 4,
            dropout=dropout,
            activation='gelu',
            batch_first=True,
            norm_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_encoder_layers)

        # BiLSTM
        self.bilstm = nn.LSTM(
            input_size=d_model,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if lstm_layers > 1 else 0,
        )

        # Attention pooling
        self.attn_pool = nn.Linear(lstm_hidden * 2, 1)

        # MLP head
        mlp_input = lstm_hidden * 2
        self.head = nn.Sequential(
            nn.Linear(mlp_input, 64),
            nn.LayerNorm(64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Dropout(dropout * 0.5),
            nn.Linear(32, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, seq_len, n_features) ou (batch, n_features)
        Returns:
            (batch, 1) predicted return
        """
        if x.dim() == 2:
            x = x.unsqueeze(1)  # (batch, 1, features)

        # Project to d_model
        x = self.input_proj(x)  # (batch, seq, d_model)
        x = self.pos_enc(x)

        # Transformer
        x = self.transformer(x)  # (batch, seq, d_model)

        # BiLSTM
        lstm_out, _ = self.bilstm(x)  # (batch, seq, lstm_hidden*2)

        # Attention pooling
        attn_weights = torch.softmax(self.attn_pool(lstm_out), dim=1)  # (batch, seq, 1)
        pooled = (lstm_out * attn_weights).sum(dim=1)  # (batch, lstm_hidden*2)

        # MLP head
        return self.head(pooled)  # (batch, 1)


class DeepLearningTrainer:
    """Treina e avalia o modelo Transformer+BiLSTM."""

    def __init__(self, n_features: int, device: str = 'cpu', **model_kwargs):
        self.device = torch.device(device)
        self.n_features = n_features
        self.model = TransformerBiLSTMModel(n_features=n_features, **model_kwargs).to(self.device)
        self.scaler = StandardScaler()
        self.feature_names: list[str] = []
        self.metrics: dict = {}

    def _prepare_tensors(self, X: np.ndarray, y: np.ndarray = None):
        X_clean = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
        X_scaled = self.scaler.transform(X_clean) if hasattr(self.scaler, 'mean_') else self.scaler.fit_transform(X_clean)
        X_scaled = np.nan_to_num(X_scaled, nan=0.0, posinf=0.0, neginf=0.0)
        X_t = torch.FloatTensor(X_scaled).to(self.device)
        if y is not None:
            y_t = torch.FloatTensor(y).unsqueeze(1).to(self.device)
            return X_t, y_t
        return X_t

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray = None,
        y_val: np.ndarray = None,
        epochs: int = 100,
        batch_size: int = 64,
        lr: float = 1e-3,
        patience: int = 15,
    ) -> dict:
        """Treina o modelo com early stopping."""
        self.scaler.fit(X_train)
        X_t, y_t = self._prepare_tensors(X_train, y_train)

        dataset = TensorDataset(X_t, y_t)
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        optimizer = torch.optim.AdamW(self.model.parameters(), lr=lr, weight_decay=1e-3)
        scheduler = torch.optim.lr_scheduler.OneCycleLR(
            optimizer, max_lr=lr, epochs=epochs, steps_per_epoch=len(loader),
        )
        # Combinação de HuberLoss (robusta a outliers) + penalidade direcional
        huber = nn.HuberLoss(delta=0.02)

        best_val_loss = float('inf')
        best_state = None
        no_improve = 0
        history = {'train_loss': [], 'val_loss': []}

        for epoch in range(epochs):
            # Train
            self.model.train()
            train_losses = []
            for xb, yb in loader:
                optimizer.zero_grad()
                pred = self.model(xb)
                # Loss = Huber + penalidade por errar a direção
                loss_huber = huber(pred, yb)
                dir_penalty = torch.mean(torch.clamp(-pred * yb, min=0)) * 0.5
                loss = loss_huber + dir_penalty
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                train_losses.append(loss.item())

            avg_train = np.mean(train_losses)
            history['train_loss'].append(avg_train)

            # Validate
            if X_val is not None:
                self.model.eval()
                with torch.no_grad():
                    X_vt, y_vt = self._prepare_tensors(X_val, y_val)
                    vpred = self.model(X_vt)
                    val_loss = huber(vpred, y_vt).item()
                history['val_loss'].append(val_loss)

                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    best_state = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}
                    no_improve = 0
                else:
                    no_improve += 1

                if epoch % 10 == 0:
                    logger.info(f"Epoch {epoch}: train={avg_train:.6f} val={val_loss:.6f} best={best_val_loss:.6f}")

                if no_improve >= patience:
                    logger.info(f"Early stopping at epoch {epoch}")
                    break
            else:
                if epoch % 10 == 0:
                    logger.info(f"Epoch {epoch}: train={avg_train:.6f}")

        if best_state:
            self.model.load_state_dict(best_state)

        # Compute final metrics
        self.model.eval()
        metrics = {'epochs_trained': epoch + 1, 'best_val_loss': best_val_loss}
        if X_val is not None:
            metrics.update(self._compute_metrics(X_val, y_val))
        self.metrics = metrics
        return metrics

    def _evaluate(self, X: np.ndarray, y: np.ndarray, criterion) -> float:
        self.model.eval()
        with torch.no_grad():
            X_t, y_t = self._prepare_tensors(X, y)
            pred = self.model(X_t)
            return criterion(pred, y_t).item()

    def _compute_metrics(self, X: np.ndarray, y: np.ndarray) -> dict:
        self.model.eval()
        with torch.no_grad():
            X_t = self._prepare_tensors(X)
            preds = self.model(X_t).cpu().numpy().flatten()

        residuals = y - preds
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        mae = float(np.mean(np.abs(residuals)))
        mask = np.abs(y) > 1e-6
        mape = float(np.mean(np.abs(residuals[mask] / y[mask])) * 100) if mask.any() else 999.0
        dir_acc = float(np.mean(np.sign(preds) == np.sign(y)))

        return {
            'val_rmse': rmse,
            'val_mae': mae,
            'val_mape': min(mape, 999.0),
            'directional_accuracy': dir_acc,
        }

    def predict(self, X: np.ndarray) -> np.ndarray:
        self.model.eval()
        with torch.no_grad():
            X_t = self._prepare_tensors(X)
            return self.model(X_t).cpu().numpy().flatten()

    def save(self, path: str):
        """Salva modelo, scaler e metadados."""
        os.makedirs(path, exist_ok=True)
        torch.save(self.model.state_dict(), os.path.join(path, 'model_state.pt'))
        # Detectar tipo de modelo e salvar config adequada
        model = self.model
        model_type = type(model).__name__
        model_config = {
            'n_features': self.n_features,
            'model_class': model_type,
            'architecture': model_type,
        }
        # Salvar hiperparâmetros específicos de cada arquitetura
        if hasattr(model, 'd_model'):
            model_config['d_model'] = model.d_model
            model_config['nhead'] = model.transformer.layers[0].self_attn.num_heads
            model_config['num_encoder_layers'] = len(model.transformer.layers)
            model_config['lstm_hidden'] = model.bilstm.hidden_size
            model_config['lstm_layers'] = model.bilstm.num_layers
        if hasattr(model, 'hidden'):
            model_config['hidden'] = model.hidden
            model_config['n_blocks'] = model.n_blocks
        if hasattr(model, 'channels'):
            model_config['channels'] = model.channels
            model_config['kernel_size'] = model.kernel_size
            model_config['n_layers'] = model.n_layers
        with open(os.path.join(path, 'model_config.json'), 'w') as f:
            json.dump(model_config, f)
        with open(os.path.join(path, 'scaler.pkl'), 'wb') as f:
            pickle.dump(self.scaler, f)
        if self.feature_names:
            with open(os.path.join(path, 'selected_features.json'), 'w') as f:
                json.dump(self.feature_names, f)
        with open(os.path.join(path, 'metrics.json'), 'w') as f:
            json.dump(self.metrics, f, default=str)
        logger.info(f"Modelo salvo em {path}")

    @classmethod
    def load(cls, path: str, device: str = 'cpu') -> 'DeepLearningTrainer':
        """Carrega modelo salvo (qualquer arquitetura)."""
        with open(os.path.join(path, 'model_config.json'), 'r') as f:
            config = json.load(f)

        model_class_name = config.get('model_class', 'TransformerBiLSTMModel')
        n_features = config['n_features']

        # Reconstruir modelo com hiperparâmetros corretos
        model_kwargs = {}
        if model_class_name == 'TransformerBiLSTMModel':
            model_kwargs = {
                'd_model': config.get('d_model', 128),
                'nhead': config.get('nhead', 4),
                'num_encoder_layers': config.get('num_encoder_layers', 2),
                'lstm_hidden': config.get('lstm_hidden', 64),
                'lstm_layers': config.get('lstm_layers', 1),
            }
        elif model_class_name == 'ResidualMLPModel':
            model_kwargs = {
                'hidden': config.get('hidden', 128),
                'n_blocks': config.get('n_blocks', 3),
            }
        elif model_class_name == 'TemporalCNNModel':
            model_kwargs = {
                'channels': config.get('channels', 64),
                'kernel_size': config.get('kernel_size', 3),
                'n_layers': config.get('n_layers', 3),
            }

        trainer = cls(n_features=n_features, device=device)
        # Criar modelo do tipo correto
        model_classes = {
            'TransformerBiLSTMModel': TransformerBiLSTMModel,
            'ResidualMLPModel': ResidualMLPModel,
            'TemporalCNNModel': TemporalCNNModel,
        }
        model_cls = model_classes.get(model_class_name, TransformerBiLSTMModel)
        trainer.model = model_cls(n_features=n_features, **model_kwargs).to(torch.device(device))

        state = torch.load(os.path.join(path, 'model_state.pt'), map_location=device, weights_only=True)
        trainer.model.load_state_dict(state)
        trainer.model.eval()

        with open(os.path.join(path, 'scaler.pkl'), 'rb') as f:
            trainer.scaler = pickle.load(f)

        features_path = os.path.join(path, 'selected_features.json')
        if os.path.exists(features_path):
            with open(features_path, 'r') as f:
                trainer.feature_names = json.load(f)

        metrics_path = os.path.join(path, 'metrics.json')
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                trainer.metrics = json.load(f)

        logger.info(f"Modelo carregado de {path} ({config['n_features']} features)")
        return trainer


def walk_forward_cv(X: np.ndarray, y: np.ndarray, n_splits: int = 5, **train_kwargs) -> dict:
    """Walk-forward cross-validation temporal."""
    n = len(X)
    min_train = max(n // 3, 100)
    fold_size = (n - min_train) // n_splits

    fold_metrics = []
    for i in range(n_splits):
        train_end = min_train + i * fold_size
        val_end = min(train_end + fold_size, n)
        if train_end >= n or val_end <= train_end:
            break

        X_tr, y_tr = X[:train_end], y[:train_end]
        X_vl, y_vl = X[train_end:val_end], y[train_end:val_end]

        trainer = DeepLearningTrainer(n_features=X.shape[1])
        metrics = trainer.train(X_tr, y_tr, X_vl, y_vl, **train_kwargs)
        fold_metrics.append(metrics)
        logger.info(f"Fold {i+1}/{n_splits}: RMSE={metrics.get('val_rmse', 'N/A'):.4f}")

    if not fold_metrics:
        return {}

    avg = {}
    for key in fold_metrics[0]:
        vals = [m[key] for m in fold_metrics if isinstance(m.get(key), (int, float))]
        if vals:
            avg[f'avg_{key}'] = float(np.mean(vals))
    return avg


# ═══════════════════════════════════════════════════════════
# Modelo 2: Residual MLP
# ═══════════════════════════════════════════════════════════

class ResidualBlock(nn.Module):
    """Bloco residual com LayerNorm e GELU."""
    def __init__(self, dim: int, dropout: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, dim),
            nn.LayerNorm(dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(dim, dim),
            nn.LayerNorm(dim),
        )
        self.act = nn.GELU()
        self.drop = nn.Dropout(dropout)

    def forward(self, x):
        return self.drop(self.act(x + self.net(x)))


class ResidualMLPModel(nn.Module):
    """MLP com blocos residuais — baseline robusto para dados tabulares."""
    def __init__(self, n_features: int, hidden: int = 128, n_blocks: int = 3, dropout: float = 0.2):
        super().__init__()
        self.n_features = n_features
        self.hidden = hidden
        self.n_blocks = n_blocks
        self.input_proj = nn.Sequential(nn.Linear(n_features, hidden), nn.LayerNorm(hidden), nn.GELU())
        self.blocks = nn.Sequential(*[ResidualBlock(hidden, dropout) for _ in range(n_blocks)])
        self.head = nn.Sequential(nn.Linear(hidden, 32), nn.GELU(), nn.Linear(32, 1))

    def forward(self, x):
        if x.dim() == 3:
            x = x[:, -1, :]
        return self.head(self.blocks(self.input_proj(x)))


# ═══════════════════════════════════════════════════════════
# Modelo 3: Temporal 1D-CNN
# ═══════════════════════════════════════════════════════════

class TemporalCNNModel(nn.Module):
    """1D-CNN para capturar padrões locais em features técnicas."""
    def __init__(self, n_features: int, channels: int = 64, kernel_size: int = 3, n_layers: int = 3, dropout: float = 0.2):
        super().__init__()
        self.n_features = n_features
        self.channels = channels
        self.kernel_size = kernel_size
        self.n_layers = n_layers
        self.input_proj = nn.Linear(n_features, channels)
        layers = []
        for _ in range(n_layers):
            layers.extend([
                nn.Conv1d(channels, channels, kernel_size, padding=kernel_size // 2),
                nn.BatchNorm1d(channels),
                nn.GELU(),
                nn.Dropout(dropout),
            ])
        self.conv = nn.Sequential(*layers)
        self.head = nn.Sequential(nn.Linear(channels, 32), nn.GELU(), nn.Linear(32, 1))

    def forward(self, x):
        if x.dim() == 2:
            x = x.unsqueeze(1)
        x = self.input_proj(x)          # (B, seq, channels)
        x = x.transpose(1, 2)           # (B, channels, seq)
        x = self.conv(x)                # (B, channels, seq)
        x = x.mean(dim=2)               # (B, channels) — global avg pool
        return self.head(x)


# ═══════════════════════════════════════════════════════════
# Ensemble DL: combina os 3 modelos
# ═══════════════════════════════════════════════════════════

MODEL_REGISTRY = {
    'transformer_bilstm': {
        'class': TransformerBiLSTMModel,
        'default_kwargs': {'d_model': 192, 'nhead': 6, 'num_encoder_layers': 3, 'lstm_hidden': 96, 'dropout': 0.15},
    },
    'residual_mlp': {
        'class': ResidualMLPModel,
        'default_kwargs': {'hidden': 192, 'n_blocks': 4, 'dropout': 0.15},
    },
    'temporal_cnn': {
        'class': TemporalCNNModel,
        'default_kwargs': {'channels': 96, 'kernel_size': 3, 'n_layers': 4, 'dropout': 0.15},
    },
}


class EnsembleDLTrainer:
    """Treina e gerencia ensemble de 3 modelos DL."""

    def __init__(self, n_features: int, model_names: list[str] = None, device: str = 'cpu'):
        self.n_features = n_features
        self.device = torch.device(device)
        self.model_names = model_names or ['transformer_bilstm', 'residual_mlp', 'temporal_cnn']
        self.trainers: dict[str, DeepLearningTrainer] = {}
        self.weights: dict[str, float] = {}
        self.ensemble_metrics: dict = {}

    def train_all(self, X_train, y_train, X_val, y_val, epochs=80, batch_size=64, lr=1e-3, patience=15):
        """Treina todos os modelos e calcula pesos ótimos."""
        individual_metrics = {}
        val_rmses = {}

        for name in self.model_names:
            logger.info(f"\n{'='*40}\nTreinando {name}\n{'='*40}")
            reg = MODEL_REGISTRY[name]
            model_cls = reg['class']
            kwargs = reg['default_kwargs'].copy()

            # Criar trainer base (sem kwargs de modelo específico)
            trainer = DeepLearningTrainer(n_features=self.n_features, device=str(self.device))
            # Substituir o modelo pelo tipo correto
            trainer.model = model_cls(n_features=self.n_features, **kwargs).to(self.device)
            trainer.feature_names = []  # será preenchido depois

            metrics = trainer.train(X_train, y_train, X_val, y_val, epochs=epochs, batch_size=batch_size, lr=lr, patience=patience)
            self.trainers[name] = trainer
            individual_metrics[name] = metrics
            val_rmses[name] = metrics.get('val_rmse', 999.0)
            logger.info(f"{name}: RMSE={metrics.get('val_rmse', 'N/A'):.4f}, DirAcc={metrics.get('directional_accuracy', 'N/A'):.2%}")

        # Calcular pesos inversamente proporcionais ao RMSE
        inv_rmses = {k: 1.0 / (v + 1e-8) for k, v in val_rmses.items()}
        total = sum(inv_rmses.values())
        self.weights = {k: round(v / total, 4) for k, v in inv_rmses.items()}
        logger.info(f"Pesos do ensemble: {self.weights}")

        # Calcular métricas do ensemble
        ensemble_preds = self.predict(X_val)
        residuals = y_val - ensemble_preds
        ens_rmse = float(np.sqrt(np.mean(residuals ** 2)))
        ens_mae = float(np.mean(np.abs(residuals)))
        mask = np.abs(y_val) > 1e-6
        ens_mape = float(np.mean(np.abs(residuals[mask] / y_val[mask])) * 100) if mask.any() else 999.0
        ens_dir_acc = float(np.mean(np.sign(ensemble_preds) == np.sign(y_val)))

        self.ensemble_metrics = {
            'architecture': 'DL_Ensemble_3Models',
            'models': self.model_names,
            'weights': self.weights,
            'individual_metrics': individual_metrics,
            'ensemble_val_rmse': ens_rmse,
            'ensemble_val_mae': ens_mae,
            'ensemble_val_mape': min(ens_mape, 999.0),
            'ensemble_directional_accuracy': ens_dir_acc,
        }
        logger.info(f"Ensemble: RMSE={ens_rmse:.4f}, DirAcc={ens_dir_acc:.2%}")
        return self.ensemble_metrics

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predição ensemble (média ponderada)."""
        preds = np.zeros(len(X))
        for name, trainer in self.trainers.items():
            w = self.weights.get(name, 1.0 / len(self.trainers))
            preds += w * trainer.predict(X)
        return preds

    def predict_individual(self, X: np.ndarray) -> dict[str, np.ndarray]:
        """Retorna predições individuais de cada modelo."""
        return {name: trainer.predict(X) for name, trainer in self.trainers.items()}

    def save(self, path: str):
        """Salva ensemble completo."""
        os.makedirs(path, exist_ok=True)
        # Salvar cada modelo em subdiretório
        for name, trainer in self.trainers.items():
            model_dir = os.path.join(path, name)
            trainer.save(model_dir)
        # Salvar config do ensemble
        config = {
            'architecture': 'DL_Ensemble_3Models',
            'n_features': self.n_features,
            'model_names': self.model_names,
            'weights': self.weights,
        }
        with open(os.path.join(path, 'ensemble_config.json'), 'w') as f:
            json.dump(config, f, indent=2)
        with open(os.path.join(path, 'metrics.json'), 'w') as f:
            json.dump(self.ensemble_metrics, f, indent=2, default=str)
        logger.info(f"Ensemble salvo em {path}")

    @classmethod
    def load(cls, path: str, device: str = 'cpu') -> 'EnsembleDLTrainer':
        """Carrega ensemble salvo."""
        with open(os.path.join(path, 'ensemble_config.json'), 'r') as f:
            config = json.load(f)
        ens = cls(n_features=config['n_features'], model_names=config['model_names'], device=device)
        ens.weights = config['weights']
        for name in config['model_names']:
            model_dir = os.path.join(path, name)
            ens.trainers[name] = DeepLearningTrainer.load(model_dir, device=device)
        metrics_path = os.path.join(path, 'metrics.json')
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                ens.ensemble_metrics = json.load(f)
        logger.info(f"Ensemble carregado: {config['model_names']}, pesos={ens.weights}")
        return ens
