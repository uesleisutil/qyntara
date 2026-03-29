"""
Cliente de notícias via Google News RSS (gratuito, sem API key).
Busca notícias relevantes para mercados de predição.
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)


class NewsClient:
    """Busca notícias do Google News RSS."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=10.0,
            headers={"User-Agent": "Mozilla/5.0"},
        )

    async def close(self):
        await self.client.aclose()

    async def search_news(self, query: str, max_articles: int = 10) -> list[dict]:
        """Busca notícias recentes (últimos 7 dias) para uma query."""
        url = (
            f"https://news.google.com/rss/search?"
            f"q={quote(query)}+when:7d&hl=en&gl=US&ceid=US:en"
        )
        try:
            resp = await self.client.get(url)
            if resp.status_code != 200:
                return []

            root = ET.fromstring(resp.content)
            articles = []
            for item in root.findall(".//item")[:max_articles]:
                title = item.findtext("title", "")
                pub_date = item.findtext("pubDate", "")
                link = item.findtext("link", "")
                desc = re.sub(r"<[^>]+>", "", item.findtext("description", ""))

                articles.append({
                    "title": title,
                    "description": desc[:500],
                    "pub_date": pub_date,
                    "link": link,
                    "query": query,
                })
            return articles
        except Exception as e:
            logger.warning(f"News search error for '{query}': {e}")
            return []

    async def get_market_news(self, question: str, max_articles: int = 8) -> list[dict]:
        """Busca notícias relevantes para um mercado de predição."""
        # Extrair keywords da pergunta do mercado
        keywords = _extract_keywords(question)
        if not keywords:
            return []
        return await self.search_news(keywords, max_articles)


def _extract_keywords(question: str) -> str:
    """Extrai keywords relevantes de uma pergunta de mercado."""
    # Remove palavras comuns de prediction markets
    stop = {
        "will", "the", "be", "by", "in", "on", "at", "to", "of", "a", "an",
        "before", "after", "end", "yes", "no", "this", "that", "or", "and",
        "is", "are", "was", "were", "has", "have", "had", "do", "does",
    }
    words = re.sub(r"[^\w\s]", " ", question.lower()).split()
    keywords = [w for w in words if w not in stop and len(w) > 2]
    return " ".join(keywords[:6])
