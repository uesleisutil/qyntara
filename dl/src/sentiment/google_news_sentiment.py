"""
Sentimento de notícias via Google News RSS + FinBERT-PT-BR.

Google News RSS é gratuito e não precisa de API key.
FinBERT-PT-BR é um modelo BERT treinado para sentimento financeiro em português.

Fluxo:
1. Busca notícias do Google News RSS para cada ticker
2. Analisa sentimento com FinBERT-PT-BR (ou fallback para keywords)
3. Calcula score agregado (-1 a +1) e features derivadas
"""

from __future__ import annotations

import json
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from urllib.parse import quote

import boto3
import requests

logger = logging.getLogger(__name__)

# Mapeamento ticker → nome da empresa para busca
TICKER_NAMES = {
    "PETR4": "Petrobras", "PETR3": "Petrobras", "VALE3": "Vale",
    "ITUB4": "Itaú Unibanco", "BBDC4": "Bradesco", "BBAS3": "Banco do Brasil",
    "ABEV3": "Ambev", "WEGE3": "WEG", "RENT3": "Localiza",
    "JBSS3": "JBS", "SUZB3": "Suzano", "ELET3": "Eletrobras",
    "PRIO3": "PetroRio PRIO", "MGLU3": "Magazine Luiza",
    "HAPV3": "Hapvida", "RDOR3": "Rede D'Or", "CSAN3": "Cosan",
    "CMIG4": "Cemig", "VIVT3": "Vivo Telefônica", "LREN3": "Lojas Renner",
    "EQTL3": "Equatorial", "TAEE11": "Taesa", "BBSE3": "BB Seguridade",
    "CSNA3": "CSN Siderúrgica", "GGBR4": "Gerdau", "GOAU4": "Metalúrgica Gerdau",
    "USIM5": "Usiminas", "BRFS3": "BRF", "MRFG3": "Marfrig",
    "SLCE3": "SLC Agrícola", "FLRY3": "Fleury", "TOTS3": "TOTVS",
    "SANB11": "Santander Brasil", "BPAC11": "BTG Pactual",
    "KLBN11": "Klabin", "CCRO3": "CCR", "ECOR3": "Ecorodovias",
    "B3SA3": "B3 Bolsa", "RAIL3": "Rumo", "CYRE3": "Cyrela",
    "MRVE3": "MRV", "EZTC3": "EZTec", "QUAL3": "Qualicorp",
    "LWSA3": "Locaweb", "PETZ3": "Petz", "ARZZ3": "Arezzo",
    "SOMA3": "Grupo Soma", "TIMS3": "TIM", "RECV3": "PetroReconcavo",
}

# Keywords para fallback (sem FinBERT)
POSITIVE_KW = {'alta', 'subiu', 'crescimento', 'lucro', 'positivo', 'otimista',
               'valorização', 'ganho', 'recuperação', 'forte', 'recorde', 'supera'}
NEGATIVE_KW = {'queda', 'caiu', 'prejuízo', 'negativo', 'pessimista', 'crise',
               'desvalorização', 'perda', 'fraco', 'risco', 'rebaixamento', 'multa'}


def fetch_google_news(query: str, max_articles: int = 15) -> List[Dict]:
    """Busca notícias do Google News RSS (gratuito, sem API key)."""
    url = f"https://news.google.com/rss/search?q={quote(query)}+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419"
    try:
        resp = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code != 200:
            logger.warning(f"Google News RSS {resp.status_code} for '{query}'")
            return []

        root = ET.fromstring(resp.content)
        articles = []
        for item in root.findall('.//item')[:max_articles]:
            title = item.findtext('title', '')
            pub_date = item.findtext('pubDate', '')
            link = item.findtext('link', '')
            desc = item.findtext('description', '')
            # Limpar HTML do description
            desc_clean = re.sub(r'<[^>]+>', '', desc)
            articles.append({
                'title': title,
                'description': desc_clean[:500],
                'pub_date': pub_date,
                'link': link,
            })
        return articles
    except Exception as e:
        logger.warning(f"Google News error for '{query}': {e}")
        return []


def analyze_sentiment_keywords(text: str) -> float:
    """Análise de sentimento por keywords (fallback rápido). Retorna -1 a +1."""
    words = set(re.sub(r'[^\w\s]', ' ', text.lower()).split())
    pos = len(words & POSITIVE_KW)
    neg = len(words & NEGATIVE_KW)
    total = pos + neg
    if total == 0:
        return 0.0
    return (pos - neg) / total


def analyze_sentiment_finbert(texts: List[str]) -> List[float]:
    """
    Análise de sentimento com FinBERT-PT-BR (modelo DL para português financeiro).
    Retorna lista de scores -1 a +1.
    """
    try:
        from transformers import pipeline
        classifier = pipeline(
            "sentiment-analysis",
            model="lucas-leme/FinBERT-PT-BR",
            device=-1,  # CPU (Lambda não tem GPU)
            truncation=True,
            max_length=512,
        )
        results = classifier(texts)
        scores = []
        for r in results:
            label = r['label'].lower()
            score = r['score']
            if label == 'positive':
                scores.append(score)
            elif label == 'negative':
                scores.append(-score)
            else:
                scores.append(0.0)
        return scores
    except Exception as e:
        logger.warning(f"FinBERT not available, using keywords: {e}")
        return [analyze_sentiment_keywords(t) for t in texts]


def get_ticker_sentiment(ticker: str, use_finbert: bool = False) -> Dict[str, float]:
    """
    Calcula sentimento para um ticker.
    
    Retorna dict com:
    - sentiment_score: score agregado (-1 a +1)
    - sentiment_magnitude: força do sentimento (0 a 1)
    - sentiment_article_count: número de artigos encontrados
    - sentiment_positive_ratio: % de artigos positivos
    - sentiment_trend: tendência (score recente - score antigo)
    """
    company = TICKER_NAMES.get(ticker, ticker)
    query = f"{company} {ticker} ações bolsa"

    articles = fetch_google_news(query)
    if not articles:
        return {
            'sentiment_score': 0.0,
            'sentiment_magnitude': 0.0,
            'sentiment_article_count': 0,
            'sentiment_positive_ratio': 0.5,
            'sentiment_trend': 0.0,
        }

    # Analisar sentimento de cada artigo
    texts = [f"{a['title']} {a['description']}" for a in articles]

    if use_finbert:
        scores = analyze_sentiment_finbert(texts)
    else:
        scores = [analyze_sentiment_keywords(t) for t in texts]

    # Agregar
    avg_score = sum(scores) / len(scores)
    magnitude = sum(abs(s) for s in scores) / len(scores)
    positive_ratio = sum(1 for s in scores if s > 0.1) / len(scores)

    # Tendência: comparar artigos recentes vs antigos
    mid = len(scores) // 2
    if mid > 0:
        recent_avg = sum(scores[:mid]) / mid
        older_avg = sum(scores[mid:]) / len(scores[mid:])
        trend = recent_avg - older_avg
    else:
        trend = 0.0

    return {
        'sentiment_score': float(avg_score),
        'sentiment_magnitude': float(magnitude),
        'sentiment_article_count': len(articles),
        'sentiment_positive_ratio': float(positive_ratio),
        'sentiment_trend': float(trend),
    }


def get_all_tickers_sentiment(tickers: List[str], use_finbert: bool = False) -> Dict[str, float]:
    """
    Calcula sentimento para todos os tickers.
    Retorna dict {ticker: sentiment_score}.
    """
    sentiment_dict = {}
    for ticker in tickers:
        try:
            result = get_ticker_sentiment(ticker, use_finbert=use_finbert)
            sentiment_dict[ticker] = result['sentiment_score']
            logger.info(f"Sentiment {ticker}: {result['sentiment_score']:.2f} ({result['sentiment_article_count']} articles)")
        except Exception as e:
            logger.warning(f"Sentiment error for {ticker}: {e}")
            sentiment_dict[ticker] = 0.0
    return sentiment_dict


def save_sentiment_to_s3(sentiment_data: Dict, bucket: str, dt: str):
    """Salva sentimento no Feature Store S3."""
    s3 = boto3.client('s3')
    for ticker, score in sentiment_data.items():
        key = f"feature_store/sentiment/dt={dt}/{ticker}.json"
        data = {'sentiment_score': score, 'timestamp': datetime.utcnow().isoformat(), 'ticker': ticker}
        s3.put_object(Bucket=bucket, Key=key, Body=json.dumps(data), ContentType='application/json')
    logger.info(f"Sentiment saved for {len(sentiment_data)} tickers to s3://{bucket}/feature_store/sentiment/dt={dt}/")
