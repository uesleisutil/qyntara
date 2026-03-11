"""
Lambda para validação de dados históricos (últimos 2 anos).

Implementa:
- Req 3.1: Validar completude dos dados históricos para 50 tickers nos últimos 2 anos
- Req 3.2: Verificar ausência de gaps maiores que 5 dias úteis consecutivos
- Req 3.3, 3.4: Validar invariantes (high >= low, preços positivos, volume >= 0)
- Req 3.5: Gerar relatório detalhado com tickers e datas afetadas
- Req 3.6: Calcular score de qualidade (0-100) por ticker
- Req 14.1-14.6: Gerar relatório de validação histórica
"""

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Dict, List, Tuple

import boto3

s3 = boto3.client("s3")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET"]
UNIVERSE_KEY = os.environ.get("B3TR_UNIVERSE_S3_KEY", "config/universe.txt")
HOLIDAYS_KEY = os.environ.get("HOLIDAYS_S3_KEY", "config/b3_holidays_2026.json")


def load_universe() -> List[str]:
    """Carrega lista de tickers do S3."""
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=UNIVERSE_KEY)
        universe = obj["Body"].read().decode("utf-8").strip().split("\n")
        universe = [t.strip() for t in universe if t.strip() and not t.strip().startswith("#")]
        return universe
    except Exception as e:
        logger.error(f"Error loading universe: {e}")
        return []


def load_holidays() -> List[str]:
    """Carrega lista de feriados do S3."""
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=HOLIDAYS_KEY)
        holidays_data = json.loads(obj["Body"].read().decode("utf-8"))
        return holidays_data.get("holidays", [])
    except Exception as e:
        logger.warning(f"Error loading holidays: {e}")
        return []


def is_business_day(date: datetime, holidays: List[str]) -> bool:
    """
    Verifica se uma data é dia útil (segunda a sexta, exceto feriados).
    
    Args:
        date: Data a verificar
        holidays: Lista de feriados no formato YYYY-MM-DD
    
    Returns:
        True se é dia útil
    """
    # Verificar se é fim de semana (sábado=5, domingo=6)
    if date.weekday() >= 5:
        return False
    
    # Verificar se é feriado
    date_str = date.date().isoformat()
    if date_str in holidays:
        return False
    
    return True


def get_business_days(start_date: datetime, end_date: datetime, holidays: List[str]) -> List[datetime]:
    """
    Retorna lista de dias úteis entre duas datas.
    
    Args:
        start_date: Data inicial
        end_date: Data final
        holidays: Lista de feriados
    
    Returns:
        Lista de dias úteis
    """
    business_days = []
    current = start_date
    
    while current <= end_date:
        if is_business_day(current, holidays):
            business_days.append(current)
        current += timedelta(days=1)
    
    return business_days


def load_historical_data(ticker: str, start_date: str, end_date: str) -> Dict[str, List[Dict]]:
    """
    Carrega dados históricos de um ticker.
    
    Args:
        ticker: Ticker a carregar
        start_date: Data inicial (YYYY-MM-DD)
        end_date: Data final (YYYY-MM-DD)
    
    Returns:
        Dict mapeando data -> lista de cotações
    """
    quotes_by_date = {}
    
    # Iterar por cada data
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    current = start
    
    while current <= end:
        date_str = current.date().isoformat()
        prefix = f"quotes_5m/dt={date_str}/"
        
        try:
            response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
            
            for obj in response.get("Contents", []):
                key = obj["Key"]
                
                # Verificar se é do ticker correto
                if ticker not in key:
                    continue
                
                try:
                    obj_data = s3.get_object(Bucket=BUCKET, Key=key)
                    quote = json.loads(obj_data["Body"].read().decode("utf-8"))
                    
                    if date_str not in quotes_by_date:
                        quotes_by_date[date_str] = []
                    
                    quotes_by_date[date_str].append(quote)
                    
                except Exception as e:
                    logger.warning(f"Error loading {key}: {e}")
                    continue
        
        except Exception as e:
            # Data não existe no S3, continuar
            pass
        
        current += timedelta(days=1)
    
    return quotes_by_date


def detect_gaps(
    quotes_by_date: Dict[str, List[Dict]],
    business_days: List[datetime]
) -> List[Dict]:
    """
    Detecta gaps maiores que 5 dias úteis consecutivos.
    
    Implementa Req 3.2: Verificar ausência de gaps maiores que 5 dias úteis.
    
    Args:
        quotes_by_date: Cotações por data
        business_days: Lista de dias úteis esperados
    
    Returns:
        Lista de gaps detectados
    """
    gaps = []
    dates_with_data = set(quotes_by_date.keys())
    
    gap_start = None
    gap_days = 0
    
    for business_day in business_days:
        date_str = business_day.date().isoformat()
        
        if date_str not in dates_with_data:
            # Início ou continuação de gap
            if gap_start is None:
                gap_start = date_str
            gap_days += 1
        else:
            # Fim de gap
            if gap_start is not None and gap_days > 5:
                gap_end = (business_day - timedelta(days=1)).date().isoformat()
                gaps.append({
                    "start_date": gap_start,
                    "end_date": gap_end,
                    "duration_days": gap_days,
                    "recommendation": "Backfill data from alternative source"
                })
            
            gap_start = None
            gap_days = 0
    
    # Gap no final do período
    if gap_start is not None and gap_days > 5:
        gap_end = business_days[-1].date().isoformat()
        gaps.append({
            "start_date": gap_start,
            "end_date": gap_end,
            "duration_days": gap_days,
            "recommendation": "Backfill data from alternative source"
        })
    
    return gaps


def validate_historical_quotes(quotes_by_date: Dict[str, List[Dict]]) -> List[Dict]:
    """
    Valida invariantes de cotações históricas.
    
    Implementa Req 3.3, 3.4: Validar preços e volume.
    
    Args:
        quotes_by_date: Cotações por data
    
    Returns:
        Lista de inconsistências detectadas
    """
    inconsistencies = []
    
    for date_str, quotes in quotes_by_date.items():
        for quote in quotes:
            ticker = quote.get("ticker", "UNKNOWN")
            
            # Validar high >= low
            if quote.get("high", 0) < quote.get("low", 0):
                inconsistencies.append({
                    "ticker": ticker,
                    "date": date_str,
                    "field": "high/low",
                    "value": f"high={quote.get('high')}, low={quote.get('low')}",
                    "issue": "high < low",
                    "recommendation": "Correct or remove record"
                })
            
            # Validar preços positivos
            for field in ["open", "high", "low", "close"]:
                value = quote.get(field, 0)
                if value <= 0:
                    inconsistencies.append({
                        "ticker": ticker,
                        "date": date_str,
                        "field": field,
                        "value": value,
                        "issue": "Negative or zero price",
                        "recommendation": "Correct or remove record"
                    })
            
            # Validar volume não-negativo
            volume = quote.get("volume", 0)
            if volume < 0:
                inconsistencies.append({
                    "ticker": ticker,
                    "date": date_str,
                    "field": "volume",
                    "value": volume,
                    "issue": "Negative volume",
                    "recommendation": "Correct or remove record"
                })
    
    return inconsistencies


def calculate_ticker_quality_score(
    quotes_by_date: Dict[str, List[Dict]],
    business_days: List[datetime],
    inconsistencies_count: int
) -> float:
    """
    Calcula score de qualidade para um ticker (0-100).
    
    Implementa Req 3.6: Calcular score baseado em completude e consistência.
    
    Args:
        quotes_by_date: Cotações por data
        business_days: Dias úteis esperados
        inconsistencies_count: Número de inconsistências
    
    Returns:
        Score de qualidade (0-100)
    """
    # Completude: % de dias úteis com dados
    days_with_data = len(quotes_by_date)
    expected_days = len(business_days)
    
    if expected_days == 0:
        return 0.0
    
    completeness = (days_with_data / expected_days) * 100
    
    # Consistência: penalizar por inconsistências
    total_quotes = sum(len(quotes) for quotes in quotes_by_date.values())
    
    if total_quotes == 0:
        consistency = 0.0
    else:
        consistency = max(0, 100 - (inconsistencies_count / total_quotes * 100))
    
    # Score final: 70% completude, 30% consistência
    score = (completeness * 0.7) + (consistency * 0.3)
    
    return round(score, 2)


def handler(event, context):
    """
    Valida dados históricos dos últimos 2 anos.
    
    Implementa Req 3.1-3.6, 14.1-14.6.
    """
    now = datetime.now(UTC)
    
    # Período de validação: últimos 2 anos (730 dias)
    end_date = now.date()
    start_date = end_date - timedelta(days=730)
    
    logger.info(f"Validating historical data from {start_date} to {end_date}")
    
    try:
        # 1. Carregar configurações
        universe = load_universe()
        holidays = load_holidays()
        
        logger.info(f"Universe: {len(universe)} tickers")
        logger.info(f"Holidays: {len(holidays)} dates")
        
        if not universe:
            raise ValueError("Universe is empty")
        
        # 2. Calcular dias úteis esperados
        business_days = get_business_days(
            datetime.combine(start_date, datetime.min.time()),
            datetime.combine(end_date, datetime.min.time()),
            holidays
        )
        
        logger.info(f"Expected business days: {len(business_days)}")
        
        # 3. Validar cada ticker
        all_gaps = []
        all_inconsistencies = []
        ticker_scores = {}
        
        for i, ticker in enumerate(universe):
            logger.info(f"Validating {ticker} ({i+1}/{len(universe)})")
            
            # Carregar dados históricos
            quotes_by_date = load_historical_data(
                ticker,
                start_date.isoformat(),
                end_date.isoformat()
            )
            
            logger.info(f"  Loaded {len(quotes_by_date)} days of data")
            
            # Detectar gaps (Req 3.2)
            gaps = detect_gaps(quotes_by_date, business_days)
            for gap in gaps:
                gap["ticker"] = ticker
            all_gaps.extend(gaps)
            
            logger.info(f"  Found {len(gaps)} gaps")
            
            # Validar consistência (Req 3.3, 3.4)
            inconsistencies = validate_historical_quotes(quotes_by_date)
            all_inconsistencies.extend(inconsistencies)
            
            logger.info(f"  Found {len(inconsistencies)} inconsistencies")
            
            # Calcular score de qualidade (Req 3.6)
            score = calculate_ticker_quality_score(
                quotes_by_date,
                business_days,
                len(inconsistencies)
            )
            ticker_scores[ticker] = score
            
            logger.info(f"  Quality score: {score}")
        
        # 4. Calcular score geral
        overall_score = sum(ticker_scores.values()) / len(ticker_scores) if ticker_scores else 0.0
        
        # 5. Gerar relatório (Req 14.1-14.6)
        report = {
            "timestamp": now.isoformat(),
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "tickers_validated": len(universe),
            "expected_business_days": len(business_days),
            "overall_quality_score": round(overall_score, 2),
            "gaps": all_gaps,
            "gaps_count": len(all_gaps),
            "inconsistencies": all_inconsistencies,
            "inconsistencies_count": len(all_inconsistencies),
            "ticker_scores": ticker_scores
        }
        
        # 6. Salvar relatório (Req 14.6)
        report_key = f"monitoring/validation/historical_data_report_{now.strftime('%Y-%m-%d')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=report_key,
            Body=json.dumps(report, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Report saved to {report_key}")
        logger.info(f"Overall quality score: {overall_score:.2f}")
        logger.info(f"Total gaps: {len(all_gaps)}")
        logger.info(f"Total inconsistencies: {len(all_inconsistencies)}")
        
        return {
            "ok": True,
            "report_key": report_key,
            "overall_quality_score": overall_score,
            "gaps_count": len(all_gaps),
            "inconsistencies_count": len(all_inconsistencies)
        }
        
    except Exception as e:
        logger.error(f"Error in historical validation: {e}", exc_info=True)
        
        # Salvar erro
        error_key = f"monitoring/validation/error_{now.strftime('%Y-%m-%d_%H%M%S')}.json"
        error_data = {
            "timestamp": now.isoformat(),
            "status": "error",
            "error_message": str(e),
            "error_type": type(e).__name__
        }
        
        s3.put_object(
            Bucket=BUCKET,
            Key=error_key,
            Body=json.dumps(error_data).encode("utf-8"),
            ContentType="application/json",
        )
        
        return {"ok": False, "error": str(e)}
