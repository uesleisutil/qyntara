#!/bin/bash

# Script para verificar status do treinamento

JOB_NAME="b3tr-deepar-20260305-221718"

python3 << EOF
import boto3
from datetime import datetime, timezone

sagemaker = boto3.client('sagemaker')
job_name = '$JOB_NAME'

try:
    response = sagemaker.describe_training_job(TrainingJobName=job_name)
    
    status = response['TrainingJobStatus']
    start_time = response.get('TrainingStartTime')
    
    print(f"\n📊 Job: {job_name}")
    print(f"📊 Status: {status}")
    
    if start_time:
        now = datetime.now(timezone.utc)
        elapsed = (now - start_time).total_seconds() / 60
        estimated_total = 30  # minutos
        remaining = max(0, estimated_total - elapsed)
        
        print(f"⏱️  Tempo decorrido: {elapsed:.1f} minutos")
        print(f"⏳ Tempo restante estimado: {remaining:.1f} minutos")
        print(f"📈 Progresso: {min(100, (elapsed/estimated_total)*100):.1f}%")
        
        if status == 'Completed':
            print("\n✅ Treinamento concluído!")
            print("\n🚀 Próximo passo: Execute o ranking")
            print("   aws lambda invoke --function-name B3TacticalRankingStackV2-RankStart0C43949D-C8EvaGliJywJ --payload '{}' /tmp/rank.json")
        elif status == 'Failed':
            print(f"\n❌ Treinamento falhou: {response.get('FailureReason', 'Unknown')}")
        elif status == 'InProgress':
            print(f"\n🔄 Em progresso... aguarde mais ~{remaining:.0f} minutos")
            print(f"   Execute novamente: ./scripts/check-training-status.sh")
    else:
        print("⏳ Aguardando início do treinamento...")
        
except Exception as e:
    print(f"❌ Erro: {e}")

print()
EOF
