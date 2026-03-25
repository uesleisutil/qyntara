# API Reference

REST API for programmatic access to B3 Tactical Ranking Dashboard data.

Base URL: `https://api.example.com/v1`

## Authentication

All requests require an API key in the `X-Api-Key` header:

```bash
curl -H "X-Api-Key: btr_your_api_key_here" \
  https://api.example.com/v1/api/recommendations
```

API keys are managed via the dashboard Settings → API Keys panel. Keys are stored hashed in DynamoDB and must be rotated every 90 days.

## Rate Limiting

- **Limit:** 1,000 requests per hour per API key
- Response headers:
  - `X-RateLimit-Limit` — Max requests per hour
  - `X-RateLimit-Remaining` — Remaining requests in window
  - `X-RateLimit-Reset` — Unix timestamp when limit resets

## Response Format

All successful responses:

```json
{
  "data": { ... },
  "metadata": {
    "timestamp": "2026-03-12T10:30:00Z",
    "version": "1.0",
    "cached": false
  }
}
```

Error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "metadata": {
    "timestamp": "2026-03-12T10:30:00Z"
  }
}
```

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid parameters |
| 401 | `AUTHENTICATION_ERROR` | Missing or invalid API key |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Endpoints

### Recommendations

#### GET /api/recommendations

Returns stock recommendations with optional filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | string (YYYY-MM-DD) | today | Filter by date |
| `sector` | string | — | Filter by sector (e.g., "Financials") |
| `min_score` | float (0–1) | — | Minimum score threshold |
| `limit` | integer (1–500) | 100 | Max results |

**Example:**

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/recommendations?sector=Energy&min_score=0.7&limit=10"
```

**Response:**

```json
{
  "data": {
    "timestamp": "2026-03-12T10:30:00Z",
    "date": "2026-03-12",
    "recommendations": [
      {
        "ticker": "PETR4",
        "sector": "Energy",
        "score": 0.85,
        "exp_return_20": 0.12,
        "rank": 1
      },
      {
        "ticker": "VALE3",
        "sector": "Materials",
        "score": 0.82,
        "exp_return_20": 0.10,
        "rank": 2
      }
    ],
    "total_count": 2,
    "filters_applied": {
      "date": null,
      "sector": "Energy",
      "min_score": 0.7
    }
  },
  "metadata": {
    "timestamp": "2026-03-12T10:30:00Z",
    "version": "1.0",
    "cached": false
  }
}
```

#### GET /api/recommendations/latest

Returns the most recent recommendations without filtering.

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/recommendations/latest"
```

---

### Ticker Details

#### GET /api/ticker/{ticker}/history

Returns price history for a ticker.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | 90 | Number of days of history |

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/ticker/PETR4/history?days=30"
```

#### GET /api/ticker/{ticker}/fundamentals

Returns fundamental metrics for a ticker.

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/ticker/PETR4/fundamentals"
```

#### GET /api/ticker/{ticker}/news

Returns recent news for a ticker.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 5 | Max news articles |

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/ticker/PETR4/news?limit=10"
```

---

### Performance

#### GET /api/performance

Returns model performance metrics.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer (1–365) | 30 | Days of history |
| `model` | string | — | Filter by model ID (e.g., "xgboost_v1") |

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/performance?days=60"
```

**Response:**

```json
{
  "data": {
    "timestamp": "2026-03-12T10:30:00Z",
    "models": [
      {
        "model_id": "xgboost_v1",
        "model_name": "XGBoost",
        "mape": 0.15,
        "accuracy": 0.72,
        "sharpe_ratio": 1.45,
        "correlation": 0.68
      }
    ],
    "ensemble": {
      "mape": 0.12,
      "accuracy": 0.78,
      "sharpe_ratio": 1.62
    }
  },
  "metadata": { "timestamp": "2026-03-12T10:30:00Z", "version": "1.0", "cached": false }
}
```

---

### Validation

#### GET /api/validation

Returns predicted vs actual validation results.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer (1–365) | 30 | Days of history |

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/validation?days=90"
```

**Response:**

```json
{
  "data": {
    "summary": {
      "total_validations": 1250,
      "mean_absolute_error": 0.034,
      "rmse": 0.048
    },
    "validations": [
      {
        "ticker": "PETR4",
        "date": "2026-02-20",
        "predicted": 0.08,
        "actual": 0.065,
        "error": -0.015
      }
    ]
  },
  "metadata": { "timestamp": "2026-03-12T10:30:00Z", "version": "1.0", "cached": false }
}
```

---

### Costs

#### GET /api/costs

Returns AWS cost data.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer (1–365) | 30 | Days of history |

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/costs?days=30"
```

**Response:**

```json
{
  "data": {
    "total_cost": 28.50,
    "daily_costs": [
      { "date": "2026-03-11", "cost": 0.95 },
      { "date": "2026-03-12", "cost": 0.92 }
    ],
    "by_service": {
      "Lambda": 15.20,
      "S3": 3.10,
      "API Gateway": 5.80,
      "Other": 4.40
    }
  },
  "metadata": { "timestamp": "2026-03-12T10:30:00Z", "version": "1.0", "cached": false }
}
```

---

### Data Quality

#### GET /api/data-quality

Returns data completeness, anomalies, freshness, and coverage metrics.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer (1–365) | 30 | Days of history |

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/data-quality?days=30"
```

---

### Drift Detection

#### GET /api/drift

Returns data drift, concept drift, and performance degradation metrics.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer (1–365) | 30 | Days of history |
| `type` | string | — | Filter: `data`, `concept`, or `performance` |

```bash
curl -H "X-Api-Key: btr_xxx" \
  "https://api.example.com/v1/api/drift?type=data&days=60"
```

---

### Monitoring

#### GET /api/monitoring/data-quality

Data quality monitoring metrics.

#### GET /api/monitoring/model-performance

Model performance monitoring metrics.

#### GET /api/monitoring/drift

Drift monitoring metrics.

#### GET /api/monitoring/costs

Cost monitoring metrics.

#### GET /api/monitoring/ensemble-weights

Ensemble model weight distribution.

All monitoring endpoints accept `days` (integer, default 30) as a query parameter.

---

### Alerts

#### GET /api/alerts

Returns all configured alerts for the authenticated user.

#### POST /api/alerts

Creates a new alert.

**Request Body:**

```json
{
  "ticker": "PETR4",
  "condition": "score_above",
  "threshold": 0.8,
  "notification_channels": ["email", "dashboard"]
}
```

#### PUT /api/alerts/{alertId}

Updates an existing alert.

#### DELETE /api/alerts/{alertId}

Deletes an alert.

---

### Notifications

#### GET /api/notifications

Returns all notifications for the authenticated user.

#### PUT /api/notifications/{notificationId}/read

Marks a notification as read.

#### PUT /api/notifications/read-all

Marks all notifications as read.

#### DELETE /api/notifications/{notificationId}

Deletes a notification.

---

## OpenAPI Specification

The full OpenAPI 3.0 spec is available at `dl/src/lambdas/api_documentation.yaml`.
