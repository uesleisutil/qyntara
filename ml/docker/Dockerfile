# Dockerfile para Ensemble Training no SageMaker
# Contém: XGBoost, TensorFlow (LSTM), Prophet

FROM python:3.11-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Instalar bibliotecas Python
RUN pip install --no-cache-dir \
    numpy==1.24.3 \
    pandas==2.0.3 \
    scikit-learn==1.3.0 \
    xgboost==2.0.3 \
    tensorflow==2.15.0 \
    prophet==1.1.5 \
    boto3==1.34.0 \
    sagemaker-training==4.6.0

# Criar diretórios SageMaker
RUN mkdir -p /opt/ml/code /opt/ml/model /opt/ml/input /opt/ml/output

# Copiar script de treino
COPY train_ensemble.py /opt/ml/code/train_ensemble.py

# Definir working directory
WORKDIR /opt/ml/code

# Definir entrypoint
ENV SAGEMAKER_PROGRAM train_ensemble.py

# Comando padrão
ENTRYPOINT ["python", "train_ensemble.py"]
