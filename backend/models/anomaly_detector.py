"""
Anomaly Detector — Autoencoder que detecta movimentos anômalos de volume/preço.

Identifica "smart money" entrando em mercados (volume spike + price move incomum).
Usado para alertas de movimentos suspeitos.
"""

from __future__ import annotations

import json
import logging
import os
import pickle

import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


class MarketAutoencoder(nn.Module):
    """Autoencoder para detectar anomalias em padrões de mercado."""

    def __init__(self, n_features: int, latent_dim: int = 8):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(n_features, 32),
            nn.GELU(),
            nn.Linear(32, 16),
            nn.GELU(),
            nn.Linear(16, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 16),
            nn.GELU(),
            nn.Linear(16, 32),
            nn.GELU(),
            nn.Linear(32, n_features),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z = self.encoder(x)
        reconstructed = self.decoder(z)
        return reconstructed, z


class AnomalyDetector:
    """Detecta movimentos anômalos em mercados de predição."""

    def __init__(self, n_features: int = 8, device: str = "cpu"):
        self.n_features = n_features
        self.device = torch.device(device)
        self.model = MarketAutoencoder(n_features).to(self.device)
        self.scaler = StandardScaler()
        self.threshold: float = 0.0  # Definido após treino

    def train(self, X_normal: np.ndarray, epochs: int = 50, lr: float = 1e-3) -> dict:
        """Treina em dados normais. Anomalias terão reconstruction error alto."""
        self.scaler.fit(X_normal)
        X_scaled = self.scaler.transform(X_normal).astype(np.float32)
        X_t = torch.FloatTensor(X_scaled).to(self.device)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        criterion = nn.MSELoss()

        for _epoch in range(epochs):
            self.model.train()
            recon, _ = self.model(X_t)
            loss = criterion(recon, X_t)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        # Definir threshold como percentil 95 do erro de reconstrução
        self.model.eval()
        with torch.no_grad():
            recon, _ = self.model(X_t)
            errors = ((recon - X_t) ** 2).mean(dim=1).cpu().numpy()
        self.threshold = float(np.percentile(errors, 95))
        logger.info(f"Anomaly threshold: {self.threshold:.6f}")
        return {"threshold": self.threshold, "mean_error": float(errors.mean())}

    def detect(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """
        Retorna (is_anomaly, anomaly_scores).
        is_anomaly: bool array, True se anomalia.
        anomaly_scores: float array, quanto maior mais anômalo.
        """
        self.model.eval()
        X_scaled = self.scaler.transform(X).astype(np.float32)
        with torch.no_grad():
            recon, _ = self.model(torch.FloatTensor(X_scaled).to(self.device))
            errors = ((recon - torch.FloatTensor(X_scaled).to(self.device)) ** 2).mean(dim=1)
        scores = errors.cpu().numpy()
        is_anomaly = scores > self.threshold
        return is_anomaly, scores

    def save(self, path: str):
        os.makedirs(path, exist_ok=True)
        torch.save(self.model.state_dict(), os.path.join(path, "autoencoder.pt"))
        with open(os.path.join(path, "scaler.pkl"), "wb") as f:
            pickle.dump(self.scaler, f)
        with open(os.path.join(path, "config.json"), "w") as f:
            json.dump({"n_features": self.n_features, "threshold": self.threshold}, f)

    @classmethod
    def load(cls, path: str, device: str = "cpu") -> AnomalyDetector:
        with open(os.path.join(path, "config.json")) as f:
            config = json.load(f)
        det = cls(n_features=config["n_features"], device=device)
        det.model.load_state_dict(torch.load(os.path.join(path, "autoencoder.pt"), map_location=device))
        with open(os.path.join(path, "scaler.pkl"), "rb") as f:
            det.scaler = pickle.load(f)
        det.threshold = config["threshold"]
        return det
