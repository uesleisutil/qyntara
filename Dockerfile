FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir \
    fastapi uvicorn[standard] websockets httpx pandas numpy \
    scikit-learn pydantic boto3 python-dateutil feedparser apscheduler \
    "pyjwt[crypto]" "passlib[bcrypt]" python-multipart stripe slowapi \
    python-dotenv psutil torch --index-url https://download.pytorch.org/whl/cpu

# App code
COPY backend/ backend/

# Frontend static (build separately and copy)
COPY frontend/dist/ static/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8000/stats || exit 1

CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
