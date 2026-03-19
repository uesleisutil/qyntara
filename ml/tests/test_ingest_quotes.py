"""
Testes unitários para ingest_quotes Lambda.

Valida:
- Integração com Secrets Manager
- Retry logic com backoff exponencial
- Tratamento de erros (429, 4xx, 5xx)
- Cálculo de latência
- Salvamento no S3
"""

import json
import time
from datetime import UTC, datetime
from unittest.mock import MagicMock, Mock, patch

import pytest

# Mock AWS services antes de importar o módulo
import sys
import os

# Set required env vars before module import
os.environ.setdefault("BUCKET", "test-bucket")

sys.modules['boto3'] = MagicMock()

from ml.src.lambdas.ingest_quotes import (
    get_brapi_token,
    fetch_with_retry,
    calculate_latency_percentiles,
)


class TestGetBrapiToken:
    """Testes para get_brapi_token (Req 1.1, 1.2)"""
    
    @patch('ml.src.lambdas.ingest_quotes.secrets')
    def test_load_token_from_json_secret(self, mock_secrets):
        """Token carregado de secret JSON"""
        mock_secrets.get_secret_value.return_value = {
            "SecretString": json.dumps({"token": "test-token-123"})
        }
        
        token = get_brapi_token()
        
        assert token == "test-token-123"
        mock_secrets.get_secret_value.assert_called_once()
    
    @patch('ml.src.lambdas.ingest_quotes.secrets')
    def test_load_token_from_plain_string(self, mock_secrets):
        """Token carregado de secret string simples"""
        mock_secrets.get_secret_value.return_value = {
            "SecretString": "plain-token-456"
        }
        
        token = get_brapi_token()
        
        assert token == "plain-token-456"
    
    @patch('ml.src.lambdas.ingest_quotes.secrets')
    def test_empty_token(self, mock_secrets):
        """Token vazio retorna string vazia"""
        mock_secrets.get_secret_value.return_value = {
            "SecretString": ""
        }
        
        token = get_brapi_token()
        
        assert token == ""
    
    @patch('ml.src.lambdas.ingest_quotes.secrets')
    def test_secrets_manager_error(self, mock_secrets):
        """Erro ao acessar Secrets Manager retorna string vazia"""
        mock_secrets.get_secret_value.side_effect = Exception("Access denied")
        
        token = get_brapi_token()
        
        assert token == ""


class TestFetchWithRetry:
    """Testes para fetch_with_retry (Req 2.4, 19.1-19.4)"""
    
    @patch('ml.src.lambdas.ingest_quotes.requests')
    def test_successful_request(self, mock_requests):
        """Request bem-sucedido retorna dados"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"results": [{"symbol": "PETR4"}]}
        mock_requests.get.return_value = mock_response
        
        data, error, latency = fetch_with_retry("http://test.com", {})
        
        assert data == {"results": [{"symbol": "PETR4"}]}
        assert error is None
        assert latency > 0
    
    @patch('ml.src.lambdas.ingest_quotes.requests')
    @patch('ml.src.lambdas.ingest_quotes.time.sleep')
    def test_retry_on_500_error(self, mock_sleep, mock_requests):
        """Erro 5xx faz retry com backoff exponencial (Req 19.3)"""
        # Primeira tentativa: 500, segunda: 500, terceira: 200
        mock_response_500 = Mock()
        mock_response_500.status_code = 500
        
        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"results": []}
        
        mock_requests.get.side_effect = [
            mock_response_500,
            mock_response_500,
            mock_response_200
        ]
        
        data, error, latency = fetch_with_retry("http://test.com", {}, max_retries=3)
        
        assert data == {"results": []}
        assert error is None
        assert mock_requests.get.call_count == 3
        assert mock_sleep.call_count == 2  # 2 retries
    
    @patch('ml.src.lambdas.ingest_quotes.requests')
    @patch('ml.src.lambdas.ingest_quotes.time.sleep')
    def test_retry_after_header_on_429(self, mock_sleep, mock_requests):
        """Erro 429 aguarda tempo do Retry-After header (Req 19.2)"""
        mock_response_429 = Mock()
        mock_response_429.status_code = 429
        mock_response_429.headers = {"Retry-After": "10"}
        
        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"results": []}
        
        mock_requests.get.side_effect = [mock_response_429, mock_response_200]
        
        data, error, latency = fetch_with_retry("http://test.com", {})
        
        assert data == {"results": []}
        assert error is None
        # Deve ter aguardado 10 segundos
        mock_sleep.assert_called_once()
        assert mock_sleep.call_args[0][0] == 10
    
    @patch('ml.src.lambdas.ingest_quotes.requests')
    def test_no_retry_on_4xx_error(self, mock_requests):
        """Erro 4xx (exceto 429) não faz retry (Req 19.4)"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Not found"
        mock_requests.get.return_value = mock_response
        
        data, error, latency = fetch_with_retry("http://test.com", {})
        
        assert data is None
        assert "404" in error
        assert mock_requests.get.call_count == 1  # Sem retry
    
    @patch('ml.src.lambdas.ingest_quotes.requests')
    @patch('ml.src.lambdas.ingest_quotes.time.sleep')
    def test_max_retries_exceeded(self, mock_sleep, mock_requests):
        """Após max retries, retorna erro (Req 19.5)"""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_requests.get.return_value = mock_response
        
        data, error, latency = fetch_with_retry("http://test.com", {}, max_retries=3)
        
        assert data is None
        assert "after 3 attempts" in error
        assert mock_requests.get.call_count == 3
    
    @patch('ml.src.lambdas.ingest_quotes.requests')
    @patch('ml.src.lambdas.ingest_quotes.time.sleep')
    def test_exponential_backoff_timing(self, mock_sleep, mock_requests):
        """Backoff exponencial segue padrão 1s, 2s, 4s (Req 19.1)"""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_requests.get.return_value = mock_response
        
        fetch_with_retry("http://test.com", {}, max_retries=3)
        
        # Verificar que sleep foi chamado 2 vezes (entre 3 tentativas)
        assert mock_sleep.call_count == 2
        
        # Primeira espera: ~1s (2^0 + jitter)
        first_wait = mock_sleep.call_args_list[0][0][0]
        assert 1.0 <= first_wait <= 2.0
        
        # Segunda espera: ~2s (2^1 + jitter)
        second_wait = mock_sleep.call_args_list[1][0][0]
        assert 2.0 <= second_wait <= 3.0


class TestCalculateLatencyPercentiles:
    """Testes para calculate_latency_percentiles (Req 16.2)"""
    
    def test_empty_latencies(self):
        """Lista vazia retorna zeros"""
        result = calculate_latency_percentiles([])
        
        assert result == {"avg": 0.0, "p50": 0.0, "p95": 0.0, "p99": 0.0}
    
    def test_single_latency(self):
        """Uma única latência"""
        result = calculate_latency_percentiles([100.0])
        
        assert result["avg"] == 100.0
        assert result["p50"] == 100.0
        assert result["p95"] == 100.0
        assert result["p99"] == 100.0
    
    def test_multiple_latencies(self):
        """Múltiplas latências calculam percentis corretamente"""
        latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        result = calculate_latency_percentiles(latencies)
        
        assert result["avg"] == 55.0
        # Implementation uses sorted_latencies[int(n * 0.50)] which is index 5 = 60
        assert result["p50"] == 60
        assert result["p95"] == 100
        assert result["p99"] == 100
    
    def test_percentiles_ordering(self):
        """Percentis devem estar em ordem crescente"""
        latencies = [100, 200, 300, 400, 500]
        result = calculate_latency_percentiles(latencies)
        
        assert result["p50"] <= result["p95"] <= result["p99"]


class TestIntegration:
    """Testes de integração"""
    
    @patch('ml.src.lambdas.ingest_quotes.s3')
    @patch('ml.src.lambdas.ingest_quotes.secrets')
    @patch('ml.src.lambdas.ingest_quotes.cloudwatch')
    @patch('ml.src.lambdas.ingest_quotes.requests')
    def test_successful_ingestion_flow(self, mock_requests, mock_cw, mock_secrets, mock_s3):
        """Fluxo completo de ingestão bem-sucedida"""
        # Setup mocks
        mock_secrets.get_secret_value.return_value = {
            "SecretString": json.dumps({"token": "test-token"})
        }
        
        mock_s3.get_object.return_value = {
            "Body": Mock(read=lambda: b"PETR4\nVALE3")
        }
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "symbol": "PETR4",
                    "historicalDataPrice": [
                        {
                            "date": int(datetime.now(UTC).timestamp()),
                            "open": 30.0,
                            "high": 31.0,
                            "low": 29.5,
                            "close": 30.5,
                            "volume": 1000000
                        }
                    ]
                }
            ]
        }
        mock_requests.get.return_value = mock_response
        
        # Import handler aqui para usar os mocks
        from ml.src.lambdas.ingest_quotes import handler
        
        result = handler({}, {})
        
        assert result["ok"] is True
        assert result["records_saved"] > 0
        assert mock_s3.put_object.called


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
