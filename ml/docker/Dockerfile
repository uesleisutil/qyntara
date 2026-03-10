# Dockerfile para Ensemble Training no SageMaker
# Contém: XGBoost, TensorFlow (LSTM), Prophet
# Arquitetura: linux/amd64 (SageMaker)

FROM --platform=linux/amd64 python:3.11-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Instalar bibliotecas Python
# Prophet 1.1.5 usa cmdstanpy em vez de pystan (mais compatível)
RUN pip install --no-cache-dir \
    numpy==1.24.3 \
    pandas==2.0.3 \
    scikit-learn==1.3.0 \
    xgboost==2.0.3 \
    tensorflow==2.15.0 \
    cmdstanpy==1.2.0 \
    prophet==1.1.5 \
    boto3==1.34.0 \
    sagemaker-training==4.6.0

# Instalar cmdstan (backend do Prophet)
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan()"

# Criar diretórios SageMaker
RUN mkdir -p /opt/ml/code /opt/ml/model /opt/ml/input /opt/ml/output

# Copiar script de treino
COPY train_ensemble.py /opt/ml/code/train_ensemble.py

# Definir working directory
WORKDIR /opt/ml/code

# Definir entrypoint para SageMaker Training Toolkit
ENV SAGEMAKER_PROGRAM train_ensemble.py
ENV PATH="/opt/ml/code:${PATH}"

# SageMaker usa o training toolkit como entrypoint
ENTRYPOINT ["python", "/opt/ml/code/train_ensemble.py"]
