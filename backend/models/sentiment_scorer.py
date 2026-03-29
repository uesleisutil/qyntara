"""
Sentiment Scorer — Análise de sentimento de notícias relacionadas a mercados.

Usa keyword-based scoring (rápido, CPU) com fallback para modelo DL quando disponível.
"""

from __future__ import annotations

import logging
import re

import numpy as np

logger = logging.getLogger(__name__)

POSITIVE_KW = {
    "win", "wins", "winning", "victory", "approve", "approved", "pass", "passed",
    "success", "gain", "rise", "surge", "boost", "confirm", "confirmed", "agree",
    "deal", "breakthrough", "record", "strong", "positive", "bullish", "rally",
    "support", "launch", "grow", "growth", "profit", "beat", "exceed",
}
NEGATIVE_KW = {
    "lose", "loss", "losing", "defeat", "reject", "rejected", "fail", "failed",
    "crisis", "crash", "drop", "fall", "decline", "risk", "threat", "warn",
    "warning", "negative", "bearish", "weak", "cut", "slash", "miss", "delay",
    "cancel", "suspend", "ban", "sanction", "collapse", "scandal",
}


class SentimentScorer:
    """Calcula sentiment score de notícias para mercados de predição."""

    def score_articles(self, articles: list[dict]) -> dict:
        """
        Analisa lista de artigos e retorna scores agregados.

        Returns dict com:
        - sentiment_score: -1 a +1
        - sentiment_magnitude: 0 a 1
        - article_count: int
        - positive_ratio: 0 a 1
        """
        if not articles:
            return {
                "sentiment_score": 0.0,
                "sentiment_magnitude": 0.0,
                "article_count": 0,
                "positive_ratio": 0.5,
            }

        scores = []
        for article in articles:
            text = f"{article.get('title', '')} {article.get('description', '')}"
            score = self._keyword_score(text)
            scores.append(score)

        avg_score = float(np.mean(scores))
        magnitude = float(np.mean(np.abs(scores)))
        pos_ratio = sum(1 for s in scores if s > 0.05) / len(scores)

        return {
            "sentiment_score": avg_score,
            "sentiment_magnitude": magnitude,
            "article_count": len(articles),
            "positive_ratio": float(pos_ratio),
        }

    def _keyword_score(self, text: str) -> float:
        """Score baseado em keywords. Retorna -1 a +1."""
        words = set(re.sub(r"[^\w\s]", " ", text.lower()).split())
        pos = len(words & POSITIVE_KW)
        neg = len(words & NEGATIVE_KW)
        total = pos + neg
        if total == 0:
            return 0.0
        return (pos - neg) / total
