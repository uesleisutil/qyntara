"""
Edge Estimator — Transformer que estima a probabilidade real de um evento
e compara com o preço do mercado para encontrar edges.

Features de entrada (por mercado):
- Preço atual (yes/no)
- Volume (total, 24h)
- Liquidez
- Tempo até resolução
- Velocidade de mudança de preço (momentum)
- Sentiment score das notícias
- Volatilidade histórica do preço
- Spread bid/ask
- Categoria do mercado (encoded)

Treinado em mercados já resolvidos: o target é 1.0 (YES) ou 0.0 (NO).
O modelo aprende a estimar P(YES) melhor que o mercado.
"""

from __future__ import annotations

import json
import logging
import math
import os
import pickle
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


class MarketTransformer(nn.Module):
    """
    Transformer encoder para estimar probabilidade real de mercados.

    Cada mercado é representado por um vetor de features.
    O modelo processa um batch de snapshots temporais de um mercado
    e produz uma estimativa de probabilidade.
    """

    def __init__(self, n_features: int, d_model: int = 64, nhead: int = 4,
                 num_layers: int = 3, dropout: float = 0.1):
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
        self.pos_encoding = nn.Parameter(torch.randn(1, 128, d_model) * 0.02)

        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
            dropout=dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        # Attention pooling
        self.attn_pool = nn.Linear(d_model, 1)

        # Output head — probabilidade [0, 1]
        self.head = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        x: (batch, seq_len, n_features) — snapshots temporais de um mercado
        returns: (batch, 1) — probabilidade estimada
        """
        B, S, _ = x.shape
        h = self.input_proj(x)
        h = h + self.pos_encoding[:, :S, :]
        h = self.encoder(h)

        # Attention pooling
        attn_weights = torch.softmax(self.attn_pool(h), dim=1)  # (B, S, 1)
        pooled = (h * attn_weights).sum(dim=1)  # (B, d_model)

        return self.head(pooled)


class EdgeEstimator:
    """
    Wrapper de treino/inferência para o MarketTransformer.
    Estima P(YES) e calcula edge vs preço de mercado.
    """

    def __init__(self, n_features: int = 12, device: str = "cpu"):
        self.n_features = n_features
        self.device = torch.device(device)
        self.model = MarketTransformer(n_features=n_features).to(self.device)
        self.scaler = StandardScaler()
        self.feature_names: list[str] = []
        self.metrics: dict = {}

    def train(self, X: np.ndarray, y: np.ndarray, X_val: np.ndarray, y_val: np.ndarray,
              epochs: int = 100, batch_size: int = 64, lr: float = 1e-3,
              patience: int = 15) -> dict:
        """Treina o modelo. X shape: (n_samples, seq_len, n_features), y: (n_samples,) in [0,1]."""
        self.scaler.fit(X.reshape(-1, X.shape[-1]))
        X_scaled = self._scale(X)
        X_val_scaled = self._scale(X_val)

        X_t = torch.FloatTensor(X_scaled).to(self.device)
        y_t = torch.FloatTensor(y).unsqueeze(1).to(self.device)
        X_v = torch.FloatTensor(X_val_scaled).to(self.device)
        y_v = torch.FloatTensor(y_val).unsqueeze(1).to(self.device)

        optimizer = torch.optim.AdamW(self.model.parameters(), lr=lr, weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.OneCycleLR(
            optimizer, max_lr=lr, epochs=epochs,
            steps_per_epoch=max(1, len(X_t) // batch_size),
        )
        criterion = nn.BCELoss()

        best_val_loss = float("inf")
        patience_counter = 0

        for epoch in range(epochs):
            self.model.train()
            indices = torch.randperm(len(X_t))
            epoch_loss = 0.0
            n_batches = 0

            for i in range(0, len(X_t), batch_size):
                batch_idx = indices[i:i + batch_size]
                xb, yb = X_t[batch_idx], y_t[batch_idx]

                pred = self.model(xb)
                loss = criterion(pred, yb)

                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()

                epoch_loss += loss.item()
                n_batches += 1

            # Validation
            self.model.eval()
            with torch.no_grad():
                val_pred = self.model(X_v)
                val_loss = criterion(val_pred, y_v).item()

                # Calibration: Brier score
                brier = float(((val_pred - y_v) ** 2).mean())

                # Accuracy (threshold 0.5)
                val_acc = float(((val_pred > 0.5).float() == y_v).float().mean())

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                best_state = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}
            else:
                patience_counter += 1

            if epoch % 10 == 0:
                logger.info(
                    f"Epoch {epoch}: train_loss={epoch_loss / n_batches:.4f} "
                    f"val_loss={val_loss:.4f} brier={brier:.4f} acc={val_acc:.1%}"
                )

            if patience_counter >= patience:
                logger.info(f"Early stopping at epoch {epoch}")
                break

        self.model.load_state_dict(best_state)
        self.metrics = {
            "best_val_loss": best_val_loss, "brier_score": brier,
            "val_accuracy": val_acc, "epochs_trained": epoch + 1,
        }
        return self.metrics

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Estima P(YES) para cada mercado. X: (n, seq_len, n_features)."""
        self.model.eval()
        X_scaled = self._scale(X)
        with torch.no_grad():
            pred = self.model(torch.FloatTensor(X_scaled).to(self.device))
        return pred.cpu().numpy().flatten()

    def estimate_edge(self, X: np.ndarray, market_prices: np.ndarray) -> np.ndarray:
        """Calcula edge: P_modelo - P_mercado. Positivo = mercado subprecifica YES."""
        estimated = self.predict(X)
        return estimated - market_prices

    def _scale(self, X: np.ndarray) -> np.ndarray:
        shape = X.shape
        flat = X.reshape(-1, shape[-1])
        scaled = self.scaler.transform(flat)
        return scaled.reshape(shape)

    def save(self, path: str):
        os.makedirs(path, exist_ok=True)
        torch.save(self.model.state_dict(), os.path.join(path, "model_state.pt"))
        with open(os.path.join(path, "scaler.pkl"), "wb") as f:
            pickle.dump(self.scaler, f)
        with open(os.path.join(path, "config.json"), "w") as f:
            json.dump({"n_features": self.n_features, "feature_names": self.feature_names,
                        "metrics": self.metrics}, f, indent=2)

    @classmethod
    def load(cls, path: str, device: str = "cpu") -> EdgeEstimator:
        with open(os.path.join(path, "config.json")) as f:
            config = json.load(f)
        est = cls(n_features=config["n_features"], device=device)
        est.model.load_state_dict(torch.load(os.path.join(path, "model_state.pt"), map_location=device))
        with open(os.path.join(path, "scaler.pkl"), "rb") as f:
            est.scaler = pickle.load(f)
        est.feature_names = config.get("feature_names", [])
        est.metrics = config.get("metrics", {})
        return est
