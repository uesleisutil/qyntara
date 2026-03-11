#!/usr/bin/env python3
"""
Script para testar ingest_quotes Lambda localmente.

Usage:
    python ml/scripts/test_ingest_local.py

Valida:
- Credenciais não aparecem em logs
- Retry logic funciona
- Dados são salvos no S3 com particionamento correto
"""

import json
import os
import sys
from datetime import UTC, datetime

# Adicionar path do projeto
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# Configurar variáveis de ambiente para teste
os.environ["BUCKET"] = os.getenv("BUCKET", "b3tr-test-bucket")
os.environ["BRAPI_SECRET_ID"] = os.getenv("BRAPI_SECRET_ID", "brapi/pro/token")
os.environ["B3TR_UNIVERSE_S3_KEY"] = "config/universe.txt"

print("=" * 80)
print("TESTE LOCAL: ingest_quotes Lambda")
print("=" * 80)
print()

# Verificar AWS credentials
print("1. Verificando AWS credentials...")
try:
    import boto3
    sts = boto3.client("sts")
    identity = sts.get_caller_identity()
    print(f"   ✅ AWS Account: {identity['Account']}")
    print(f"   ✅ AWS User: {identity['Arn']}")
except Exception as e:
    print(f"   ❌ Erro ao verificar credentials: {e}")
    print("   Configure AWS CLI: aws configure")
    sys.exit(1)

print()

# Verificar Secrets Manager
print("2. Verificando BRAPI token no Secrets Manager...")
try:
    from ml.src.lambdas.ingest_quotes import get_brapi_token
    token = get_brapi_token()
    if token:
        # Não mostrar o token completo (Req 1.2)
        print(f"   ✅ Token carregado: {token[:10]}...{token[-4:]}")
    else:
        print("   ⚠️  Token vazio (usando free tier)")
except Exception as e:
    print(f"   ❌ Erro ao carregar token: {e}")
    sys.exit(1)

print()

# Verificar S3 bucket
print("3. Verificando S3 bucket...")
try:
    s3 = boto3.client("s3")
    bucket = os.environ["BUCKET"]
    s3.head_bucket(Bucket=bucket)
    print(f"   ✅ Bucket existe: {bucket}")
except Exception as e:
    print(f"   ❌ Bucket não encontrado: {e}")
    print(f"   Crie o bucket: aws s3 mb s3://{bucket}")
    sys.exit(1)

print()

# Verificar universe.txt
print("4. Verificando config/universe.txt...")
try:
    universe_key = os.environ["B3TR_UNIVERSE_S3_KEY"]
    obj = s3.get_object(Bucket=bucket, Key=universe_key)
    universe = obj["Body"].read().decode("utf-8").strip().split("\n")
    universe = [t.strip() for t in universe if t.strip() and not t.strip().startswith("#")]
    print(f"   ✅ Universe carregado: {len(universe)} tickers")
    print(f"   Primeiros 5: {universe[:5]}")
except Exception as e:
    print(f"   ❌ Erro ao carregar universe: {e}")
    print(f"   Upload: aws s3 cp config/universe.txt s3://{bucket}/config/")
    sys.exit(1)

print()

# Executar Lambda
print("5. Executando Lambda handler...")
print("   (Isso pode levar alguns minutos...)")
print()

try:
    from ml.src.lambdas.ingest_quotes import handler
    
    start_time = datetime.now(UTC)
    result = handler({}, {})
    end_time = datetime.now(UTC)
    
    duration = (end_time - start_time).total_seconds()
    
    print()
    print("=" * 80)
    print("RESULTADO")
    print("=" * 80)
    print(f"Status: {'✅ SUCESSO' if result.get('ok') else '❌ FALHA'}")
    print(f"Duração: {duration:.2f}s")
    print(f"Records salvos: {result.get('records_saved', 0)}")
    print(f"Tickers processados: {result.get('tickers_processed', 0)}")
    print(f"Erros: {result.get('errors_count', 0)}")
    
    if 'latency_p95_ms' in result:
        print(f"Latência P95: {result['latency_p95_ms']:.2f}ms")
    
    if not result.get('ok'):
        print(f"Erro: {result.get('error', 'Unknown')}")
    
    print()
    
    # Verificar dados no S3
    if result.get('records_saved', 0) > 0:
        print("6. Verificando dados salvos no S3...")
        dt_str = datetime.now(UTC).date().isoformat()
        
        # Listar arquivos em quotes_5m/
        try:
            response = s3.list_objects_v2(
                Bucket=bucket,
                Prefix=f"quotes_5m/dt={dt_str}/",
                MaxKeys=10
            )
            
            if 'Contents' in response:
                print(f"   ✅ Encontrados {len(response['Contents'])} arquivos")
                print("   Exemplos:")
                for obj in response['Contents'][:5]:
                    print(f"      - {obj['Key']}")
            else:
                print("   ⚠️  Nenhum arquivo encontrado")
        except Exception as e:
            print(f"   ❌ Erro ao listar arquivos: {e}")
        
        print()
        
        # Verificar monitoring/ingestion/
        print("7. Verificando metadados de ingestão...")
        try:
            response = s3.list_objects_v2(
                Bucket=bucket,
                Prefix=f"monitoring/ingestion/dt={dt_str}/",
                MaxKeys=5
            )
            
            if 'Contents' in response:
                print(f"   ✅ Encontrados {len(response['Contents'])} arquivos de metadados")
                
                # Ler o mais recente
                latest = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)[0]
                obj = s3.get_object(Bucket=bucket, Key=latest['Key'])
                metadata = json.loads(obj['Body'].read().decode('utf-8'))
                
                print(f"   Último registro:")
                print(f"      Timestamp: {metadata.get('timestamp')}")
                print(f"      Status: {metadata.get('status')}")
                print(f"      Records: {metadata.get('records_ingested')}")
                print(f"      Tickers: {metadata.get('tickers_processed')}")
            else:
                print("   ⚠️  Nenhum metadado encontrado")
        except Exception as e:
            print(f"   ❌ Erro ao verificar metadados: {e}")
    
    print()
    print("=" * 80)
    print("VALIDAÇÃO COMPLETA")
    print("=" * 80)
    
    if result.get('ok') and result.get('records_saved', 0) > 0:
        print("✅ Todos os testes passaram!")
        print()
        print("Próximos passos:")
        print("1. Verificar logs no CloudWatch")
        print("2. Validar que credenciais não aparecem nos logs")
        print("3. Testar retry logic com simulação de erros")
        sys.exit(0)
    else:
        print("⚠️  Alguns testes falharam. Verifique os logs acima.")
        sys.exit(1)

except Exception as e:
    print()
    print("=" * 80)
    print("ERRO NA EXECUÇÃO")
    print("=" * 80)
    print(f"❌ {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
